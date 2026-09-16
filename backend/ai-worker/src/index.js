import { buildPromptPackage, PROMPT_CONTRACT_VERSION } from './prompt.js';

const EXPECTED_SCHEMA = 'spectra-pro-ai-analysis/v1';
const DEFAULT_MAX_BODY_BYTES = 65536;
const MAX_OBSERVATION_CHARS = 1200;
const MAX_CANDIDATES = 12;
const MAX_HITS = 160;
const MAX_TRACE_POINTS = 512;
const MAX_CALIBRATION_POINTS = 20;
const MAX_COEFFICIENTS = 8;
const MAX_QC_FLAGS = 24;

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

function validatePayload(payload) {
  const errors = [];

  if (!plainObject(payload)) return ['Body must be a JSON object.'];
  if (payload.schema !== EXPECTED_SCHEMA) errors.push('Unsupported analysis schema.');

  const allowedTopLevel = new Set([
    'schema', 'generatedAt', 'app', 'observation', 'context', 'settings', 'instrument',
    'calibration', 'quality', 'analysis', 'trace', 'readiness'
  ]);
  Object.keys(payload).forEach((key) => {
    if (!allowedTopLevel.has(key)) errors.push('Unexpected top-level field: ' + key);
  });

  if (payload.observation != null && !stringWithin(payload.observation, MAX_OBSERVATION_CHARS)) {
    errors.push('Observation must be a string of at most ' + MAX_OBSERVATION_CHARS + ' characters.');
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
  } else if (!Array.isArray(payload.quality.qcFlags) || payload.quality.qcFlags.length > MAX_QC_FLAGS || !payload.quality.qcFlags.every((flag) => stringWithin(flag, 96))) {
    errors.push('quality.qcFlags must contain at most ' + MAX_QC_FLAGS + ' short strings.');
  }

  return errors.slice(0, 12);
}

function requestSummary(payload) {
  const candidates = payload.analysis && Array.isArray(payload.analysis.candidates) ? payload.analysis.candidates.length : 0;
  const hits = payload.analysis && Array.isArray(payload.analysis.hits) ? payload.analysis.hits.length : 0;
  const tracePoints = payload.trace && Array.isArray(payload.trace.points) ? payload.trace.points.length : 0;
  return {
    schema: payload.schema,
    candidates,
    hits,
    tracePoints,
    calibrated: !!(payload.readiness && payload.readiness.calibrated),
    hasObservation: typeof payload.observation === 'string' && payload.observation.trim().length > 0
  };
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({
        ok: true,
        service: 'spectra-pro-ai',
        stage: 4,
        promptContract: PROMPT_CONTRACT_VERSION
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
      return json({ ok: false, error: 'RATE_LIMITED' }, 429, origin);
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

    // Step 4 prepares a stable scientific developer instruction plus a separate
    // untrusted-data input. The package is built here so deployment catches prompt
    // integration errors before Step 6 enables the actual OpenAI request.
    const promptPackage = buildPromptPackage(parsed.value);

    return json({
      ok: false,
      error: 'AI_CONNECTOR_NOT_ENABLED',
      stage: 4,
      accepted: requestSummary(parsed.value),
      prompt: {
        contractVersion: promptPackage.contractVersion,
        textOnly: promptPackage.responsePolicy.textOnly,
        languagePolicy: promptPackage.responsePolicy.language,
        structuredOutput: promptPackage.responsePolicy.structuredOutput
      }
    }, 501, origin);
  }
};
