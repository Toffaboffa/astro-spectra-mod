import { buildPromptPackage, PROMPT_CONTRACT_VERSION } from './prompt.js';
import { RESPONSE_CONTRACT_VERSION } from './response.js';
import { interpretWithOpenAI, OpenAIConnectorError } from './openaiClient.js';

const EXPECTED_SCHEMA = 'spectra-pro-ai-analysis/v1';
const DEFAULT_MAX_BODY_BYTES = 65536;
const MAX_OBSERVATION_CHARS = 600;
const MAX_CANDIDATES = 12;
const MAX_HITS = 160;
const MAX_TRACE_POINTS = 512;
const MAX_CALIBRATION_POINTS = 20;
const MAX_COEFFICIENTS = 8;
const MAX_QC_FLAGS = 24;
const ANALYSIS_CONTEXTS = new Set(['lab-atomic', 'lab-molecular', 'fluorescence', 'astro']);
const MAX_ASTRO_FEATURES = 24;
const MAX_ASTRO_MATCHES = 32;
const MAX_ASTRO_VELOCITY_LINES = 16;

function json(data, status, origin) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'vary': 'Origin'
  });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set('access-control-allow-headers', 'Content-Type');
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function parseAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function allowedOrigin(request, env) {
  const origin = String(request.headers.get('origin') || '').trim();
  if (!origin) return null;
  return parseAllowedOrigins(env).includes(origin) ? origin : null;
}

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringWithin(value, maxLength) {
  return typeof value === 'string' && value.length <= maxLength;
}

function validatePointPair(point) {
  return Array.isArray(point) && point.length === 2 && finiteNumber(point[0]) && finiteNumber(point[1]) && point[1] >= 0 && point[1] <= 1;
}

export function validatePayload(payload) {
  const errors = [];

  if (!plainObject(payload)) return ['Body must be a JSON object.'];
  if (payload.schema !== EXPECTED_SCHEMA) errors.push('Unsupported analysis schema.');

  const allowedTopLevel = new Set([
    'schema', 'generatedAt', 'app', 'observation', 'context', 'settings', 'instrument',
    'calibration', 'preprocessing', 'quality', 'analysis', 'trace', 'readiness'
  ]);
  Object.keys(payload).forEach((key) => {
    if (!allowedTopLevel.has(key)) errors.push('Unexpected top-level field: ' + key);
  });

  if (payload.observation != null && !stringWithin(payload.observation, MAX_OBSERVATION_CHARS)) {
    errors.push('Observation must be a string of at most ' + MAX_OBSERVATION_CHARS + ' characters.');
  }

  const analysisContext = payload.context && payload.context.analysisContext;
  if (!plainObject(payload.context) || !ANALYSIS_CONTEXTS.has(analysisContext)) {
    errors.push('context.analysisContext must identify a supported scientific context.');
  } else if (payload.context.deterministicAnalysis !== true) {
    errors.push('context.deterministicAnalysis must be true.');
  }

  if (!plainObject(payload.readiness)) {
    errors.push('Missing readiness object.');
  } else {
    ['hasFrame', 'calibrated', 'hasAnalysisResult'].forEach((key) => {
      if (typeof payload.readiness[key] !== 'boolean') errors.push('readiness.' + key + ' must be boolean.');
    });
  }

  if (!plainObject(payload.analysis)) {
    errors.push('Missing analysis object.');
  } else {
    const candidates = payload.analysis.candidates;
    const hits = payload.analysis.hits;
    if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) {
      errors.push('analysis.candidates must contain at most ' + MAX_CANDIDATES + ' items.');
    }
    if (!Array.isArray(hits) || hits.length > MAX_HITS) {
      errors.push('analysis.hits must contain at most ' + MAX_HITS + ' items.');
    }
    const astro = payload.analysis.astro;
    if (analysisContext === 'astro' && !plainObject(astro)) {
      errors.push('analysis.astro is required for astro context.');
    } else if (analysisContext !== 'astro' && astro != null) {
      errors.push('analysis.astro is only allowed for astro context.');
    }
    if (plainObject(astro)) {
      if (!Array.isArray(astro.absorptionFeatures) || astro.absorptionFeatures.length > MAX_ASTRO_FEATURES) {
        errors.push('analysis.astro.absorptionFeatures must contain at most ' + MAX_ASTRO_FEATURES + ' items.');
      }
      if (!Array.isArray(astro.referenceMatches) || astro.referenceMatches.length > MAX_ASTRO_MATCHES) {
        errors.push('analysis.astro.referenceMatches must contain at most ' + MAX_ASTRO_MATCHES + ' items.');
      }
      const velocityLines = astro.radialVelocity && astro.radialVelocity.lines;
      if (velocityLines != null && (!Array.isArray(velocityLines) || velocityLines.length > MAX_ASTRO_VELOCITY_LINES)) {
        errors.push('analysis.astro.radialVelocity.lines must contain at most ' + MAX_ASTRO_VELOCITY_LINES + ' items.');
      }
    }
  }

  if (!plainObject(payload.calibration)) {
    errors.push('Missing calibration object.');
  } else {
    const points = payload.calibration.points;
    const coefficients = payload.calibration.coefficients;
    if (!Array.isArray(points) || points.length > MAX_CALIBRATION_POINTS) {
      errors.push('calibration.points must contain at most ' + MAX_CALIBRATION_POINTS + ' items.');
    } else {
      points.forEach((point, index) => {
        if (!plainObject(point) || !finiteNumber(point.px) || !finiteNumber(point.nm)) {
          errors.push('Invalid calibration point at index ' + index + '.');
        }
      });
    }
    if (!Array.isArray(coefficients) || coefficients.length > MAX_COEFFICIENTS || !coefficients.every(finiteNumber)) {
      errors.push('calibration.coefficients must be a finite numeric array of at most ' + MAX_COEFFICIENTS + ' items.');
    }
  }

  if (payload.trace != null) {
    if (!plainObject(payload.trace) || !Array.isArray(payload.trace.points) || payload.trace.points.length > MAX_TRACE_POINTS) {
      errors.push('trace.points must contain at most ' + MAX_TRACE_POINTS + ' compact points.');
    } else if (!payload.trace.points.every(validatePointPair)) {
      errors.push('Each trace point must be [x, normalizedIntensity] with normalizedIntensity in the range 0..1.');
    }
  }

  if (!plainObject(payload.quality)) {
    errors.push('Missing quality object.');
  } else {
    if (!Array.isArray(payload.quality.qcFlags) || payload.quality.qcFlags.length > MAX_QC_FLAGS || !payload.quality.qcFlags.every((flag) => stringWithin(flag, 96))) {
      errors.push('quality.qcFlags must contain at most ' + MAX_QC_FLAGS + ' short strings.');
    }
    if (!plainObject(payload.quality.measurement) || !stringWithin(payload.quality.measurement.overallStatus, 24)) {
      errors.push('quality.measurement must include a deterministic overallStatus.');
    }
  }

  return errors.slice(0, 12);
}

async function applyRateLimit(request, env) {
  if (!env.AI_RATE_LIMITER || typeof env.AI_RATE_LIMITER.limit !== 'function') return true;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const result = await env.AI_RATE_LIMITER.limit({ key: 'interpret|' + ip });
  return !!(result && result.success);
}

async function readJsonBody(request, maxBodyBytes) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return { error: 'Request body exceeds ' + maxBodyBytes + ' bytes.', status: 413 };
  }

  const raw = await request.arrayBuffer();
  if (raw.byteLength > maxBodyBytes) {
    return { error: 'Request body exceeds ' + maxBodyBytes + ' bytes.', status: 413 };
  }

  try {
    const text = new TextDecoder().decode(raw);
    return { value: JSON.parse(text) };
  } catch (_) {
    return { error: 'Request body must be valid JSON.', status: 400 };
  }
}

function connectorErrorResponse(error, origin, runId) {
  if (error instanceof OpenAIConnectorError) {
    const body = {
      ok: false,
      error: error.code,
      message: error.message,
      runId: runId || null
    };
    if (error.details && error.code !== 'OPENAI_AUTH_FAILED') body.details = error.details;
    return json(body, error.status || 502, origin);
  }
  return json({
    ok: false,
    error: 'AI_CONNECTOR_ERROR',
    message: 'The AI interpretation service failed unexpectedly.',
    runId: runId || null
  }, 502, origin);
}

function makeRunId() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_) {}
  return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({
        ok: true,
        service: 'spectra-pro-ai',
        appVersion: '3.1.5',
        model: String(env.OPENAI_MODEL || 'gpt-5.6-terra'),
        promptContract: PROMPT_CONTRACT_VERSION,
        responseContract: RESPONSE_CONTRACT_VERSION
      }, 200, null);
    }

    if (url.pathname !== '/api/interpret') {
      return json({ ok: false, error: 'NOT_FOUND' }, 404, null);
    }

    const originHeader = String(request.headers.get('origin') || '').trim();
    const origin = allowedOrigin(request, env);
    if (!origin || origin !== originHeader) {
      return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403, null);
    }

    if (request.method === 'OPTIONS') {
      const headers = new Headers({
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'access-control-max-age': '600',
        'cache-control': 'no-store',
        'vary': 'Origin'
      });
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);
    }

    const contentType = String(request.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      return json({ ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' }, 415, origin);
    }

    let rateAllowed = false;
    try {
      rateAllowed = await applyRateLimit(request, env);
    } catch (_) {
      return json({ ok: false, error: 'RATE_LIMIT_UNAVAILABLE' }, 503, origin);
    }
    if (!rateAllowed) {
      return json({ ok: false, error: 'RATE_LIMITED', message: 'Too many AI interpretation requests. Try again shortly.' }, 429, origin);
    }

    const configuredMax = Number(env.MAX_BODY_BYTES);
    const maxBodyBytes = Number.isFinite(configuredMax) && configuredMax >= 4096
      ? Math.min(configuredMax, 262144)
      : DEFAULT_MAX_BODY_BYTES;

    const parsed = await readJsonBody(request, maxBodyBytes);
    if (parsed.error) return json({ ok: false, error: 'INVALID_REQUEST', message: parsed.error }, parsed.status, origin);

    const errors = validatePayload(parsed.value);
    if (errors.length) {
      return json({ ok: false, error: 'INVALID_ANALYSIS_PAYLOAD', details: errors }, 422, origin);
    }

    const runId = makeRunId();
    const startedAt = new Date().toISOString();
    const promptPackage = buildPromptPackage(parsed.value);
    try {
      const interpreted = await interpretWithOpenAI(promptPackage, env);
      return json({
        ok: true,
        appVersion: '3.1.5',
        runId,
        startedAt,
        completedAt: new Date().toISOString(),
        promptContract: PROMPT_CONTRACT_VERSION,
        responseContract: RESPONSE_CONTRACT_VERSION,
        model: interpreted.model,
        openaiResponseId: interpreted.responseId || null,
        result: interpreted.result,
        text: interpreted.text,
        usage: interpreted.usage
      }, 200, origin);
    } catch (error) {
      return connectorErrorResponse(error, origin, runId);
    }
  }
};
