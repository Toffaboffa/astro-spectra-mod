import test from 'node:test';
import assert from 'node:assert/strict';

import { interpretWithOpenAI, OpenAIConnectorError } from '../src/openaiClient.js';
import { buildPromptPackage } from '../src/prompt.js';

const payload = {
  schema: 'spectra-pro-ai-analysis/v1',
  observation: null,
  context: { appMode: 'LAB', analysisContext: 'lab-atomic', deterministicAnalysis: true },
  settings: {},
  instrument: {},
  calibration: { calibrated: true, points: [], coefficients: [] },
  preprocessing: {},
  quality: { qcFlags: [], measurement: { overallStatus: 'good', mainLimitation: null, dimensions: {} } },
  analysis: { scoreSemantics: 'relative-score-share-not-probability-or-abundance', candidates: [], hits: [] },
  trace: null,
  readiness: { hasFrame: true, calibrated: true, hasAnalysisResult: true }
};

const promptPackage = buildPromptPackage(payload);

test('missing API key fails before any upstream network request', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('network should not be reached');
  };
  try {
    await assert.rejects(
      () => interpretWithOpenAI(promptPackage, { OPENAI_API_KEY: '' }),
      (error) => error instanceof OpenAIConnectorError && error.code === 'OPENAI_KEY_MISSING' && error.status === 503
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('successful upstream response is schema-validated and returned with compact usage', async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    const result = {
      language: 'en',
      summary: 'Summary.',
      interpretation: 'Interpretation.',
      dataQuality: '',
      caveats: 'Caveat.',
      conclusion: 'Conclusion.'
    };
    return new Response(JSON.stringify({
      id: 'resp_test_123',
      status: 'completed',
      model: 'gpt-5.6-terra',
      output_text: JSON.stringify(result),
      usage: {
        input_tokens: 100,
        output_tokens: 40,
        total_tokens: 140,
        output_tokens_details: { reasoning_tokens: 5 }
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req_test_123' }
    });
  };

  try {
    const out = await interpretWithOpenAI(promptPackage, {
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5.6-terra',
      OPENAI_TIMEOUT_MS: '10000',
      OPENAI_MAX_OUTPUT_TOKENS: '700'
    });

    assert.equal(captured.url, 'https://api.openai.com/v1/responses');
    assert.equal(captured.options.method, 'POST');
    assert.equal(captured.options.headers.authorization, 'Bearer test-key');
    assert.equal(captured.body.store, false);
    assert.equal(captured.body.reasoning.effort, 'low');
    assert.equal(captured.body.text.verbosity, 'low');
    assert.equal(captured.body.text.format.type, 'json_schema');
    assert.equal(captured.body.input[0].role, 'developer');
    assert.equal(captured.body.input[1].role, 'user');

    assert.equal(out.model, 'gpt-5.6-terra');
    assert.equal(out.responseId, 'resp_test_123');
    assert.equal(out.result.summary, 'Summary.');
    assert.equal(out.text, 'Summary.\n\nInterpretation.\n\nCaveat.\n\nConclusion.');
    assert.deepEqual(out.usage, {
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      reasoningTokens: 5
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('upstream authentication failures are mapped to a non-secret public error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'invalid_api_key', message: 'secret upstream detail' }
  }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req_auth' }
  });

  try {
    await assert.rejects(
      () => interpretWithOpenAI(promptPackage, { OPENAI_API_KEY: 'bad-key' }),
      (error) => {
        assert.ok(error instanceof OpenAIConnectorError);
        assert.equal(error.code, 'OPENAI_AUTH_FAILED');
        assert.equal(error.status, 502);
        assert.equal(error.message, 'OpenAI rejected the project credentials or endpoint permissions.');
        assert.equal(error.details.upstreamStatus, 401);
        assert.equal(error.details.upstreamCode, 'invalid_api_key');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
