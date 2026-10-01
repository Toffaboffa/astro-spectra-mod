import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { validatePayload } from '../src/index.js';

function validPayload() {
  return {
    schema: 'spectra-pro-ai-analysis/v1',
    generatedAt: '2026-09-29T00:00:00.000Z',
    app: { name: 'SPECTRA PRO', version: '1.4.1' },
    observation: 'A bright line spectrum.',
    context: {
      appMode: 'LAB',
      analysisContext: 'lab-atomic',
      deterministicAnalysis: true
    },
    settings: {},
    instrument: {},
    calibration: {
      calibrated: true,
      points: [
        { px: 10, nm: 447.148 },
        { px: 20, nm: 587.562 }
      ],
      coefficients: [400, 1]
    },
    preprocessing: {},
    quality: {
      qcFlags: [],
      measurement: {
        overallStatus: 'good',
        mainLimitation: null,
        dimensions: {}
      }
    },
    analysis: {
      scoreSemantics: 'relative-score-share-not-probability-or-abundance',
      candidates: [],
      hits: []
    },
    trace: {
      xUnit: 'nm',
      points: [[447.148, 0.7], [587.562, 1]]
    },
    readiness: {
      hasFrame: true,
      calibrated: true,
      hasAnalysisResult: true
    }
  };
}

function env(overrides = {}) {
  return {
    ALLOWED_ORIGINS: 'https://toffaboffa.github.io,http://localhost:8000',
    MAX_BODY_BYTES: '65536',
    OPENAI_MODEL: 'gpt-5.6-terra',
    AI_RATE_LIMITER: {
      async limit() { return { success: true }; }
    },
    ...overrides
  };
}

async function bodyJson(response) {
  return JSON.parse(await response.text());
}

test('validatePayload accepts a compact deterministic LAB payload', () => {
  assert.deepEqual(validatePayload(validPayload()), []);
});

test('validatePayload rejects unsupported context and unexpected top-level data', () => {
  const payload = validPayload();
  payload.context.analysisContext = 'planetary';
  payload.secret = 'nope';
  const errors = validatePayload(payload);
  assert.ok(errors.some((message) => message.includes('supported scientific context')));
  assert.ok(errors.some((message) => message.includes('Unexpected top-level field')));
});

test('GET /health returns non-secret contract metadata', async () => {
  const response = await worker.fetch(new Request('https://worker.example/health'), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await bodyJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'spectra-pro-ai');
  assert.equal(body.appVersion, '1.4.1');
  assert.equal(body.model, 'gpt-5.6-terra');
  assert.match(body.promptContract, /^spectra-pro-interpretation\/v\d+$/);
  assert.equal(body.responseContract, 'spectra-pro-ai-response/v1');
  assert.equal('OPENAI_API_KEY' in body, false);
});

test('interpret endpoint rejects unapproved origins before processing the body', async () => {
  const request = new Request('https://worker.example/api/interpret', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'content-type': 'application/json'
    },
    body: JSON.stringify(validPayload())
  });
  const response = await worker.fetch(request, env());
  assert.equal(response.status, 403);
  assert.deepEqual(await bodyJson(response), { ok: false, error: 'ORIGIN_NOT_ALLOWED' });
});

test('OPTIONS returns CORS headers only for an approved origin', async () => {
  const request = new Request('https://worker.example/api/interpret', {
    method: 'OPTIONS',
    headers: { origin: 'https://toffaboffa.github.io' }
  });
  const response = await worker.fetch(request, env());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://toffaboffa.github.io');
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('interpret endpoint rejects non-JSON content', async () => {
  const request = new Request('https://worker.example/api/interpret', {
    method: 'POST',
    headers: {
      origin: 'https://toffaboffa.github.io',
      'content-type': 'text/plain'
    },
    body: 'hello'
  });
  const response = await worker.fetch(request, env());
  assert.equal(response.status, 415);
  assert.equal((await bodyJson(response)).error, 'UNSUPPORTED_MEDIA_TYPE');
});

test('rate-limit failure returns 429 without contacting OpenAI', async () => {
  const request = new Request('https://worker.example/api/interpret', {
    method: 'POST',
    headers: {
      origin: 'https://toffaboffa.github.io',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.9'
    },
    body: JSON.stringify(validPayload())
  });
  const response = await worker.fetch(request, env({
    AI_RATE_LIMITER: {
      async limit({ key }) {
        assert.equal(key, 'interpret|203.0.113.9');
        return { success: false };
      }
    }
  }));
  assert.equal(response.status, 429);
  assert.equal((await bodyJson(response)).error, 'RATE_LIMITED');
});

test('valid request without API key fails safely at the connector boundary', async () => {
  const request = new Request('https://worker.example/api/interpret', {
    method: 'POST',
    headers: {
      origin: 'https://toffaboffa.github.io',
      'content-type': 'application/json'
    },
    body: JSON.stringify(validPayload())
  });
  const response = await worker.fetch(request, env({ OPENAI_API_KEY: '' }));
  assert.equal(response.status, 503);
  const body = await bodyJson(response);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'OPENAI_KEY_MISSING');
  assert.ok(body.runId);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://toffaboffa.github.io');
});

test('oversized request is rejected before schema validation', async () => {
  const request = new Request('https://worker.example/api/interpret', {
    method: 'POST',
    headers: {
      origin: 'https://toffaboffa.github.io',
      'content-type': 'application/json'
    },
    body: JSON.stringify(validPayload()) + ' '.repeat(5000)
  });
  const response = await worker.fetch(request, env({ MAX_BODY_BYTES: '4096' }));
  assert.equal(response.status, 413);
  const body = await bodyJson(response);
  assert.equal(body.error, 'INVALID_REQUEST');
  assert.match(body.message, /exceeds 4096 bytes/);
});
