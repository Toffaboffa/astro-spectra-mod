import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROMPT_CONTRACT_VERSION,
  buildDeveloperInstructions,
  buildModelInput,
  buildPromptPackage
} from '../src/prompt.js';
import {
  RESPONSE_CONTRACT_VERSION,
  buildResponseFormat,
  validateStructuredResult,
  flattenStructuredResult
} from '../src/response.js';

const payload = {
  schema: 'spectra-pro-ai-analysis/v1',
  observation: 'Det lyser starkt i det röda området.',
  context: {
    appMode: 'LAB',
    analysisContext: 'lab-atomic',
    deterministicAnalysis: true
  },
  settings: {},
  instrument: {},
  calibration: { calibrated: true, points: [], coefficients: [] },
  preprocessing: {},
  quality: {
    qcFlags: [],
    measurement: { overallStatus: 'moderate', mainLimitation: null, dimensions: {} }
  },
  analysis: {
    scoreSemantics: 'relative-score-share-not-probability-or-abundance',
    bestMatch: null,
    topCandidate: { species: 'O', scoreSharePct: 25 },
    candidates: [{ species: 'O', scoreSharePct: 25, matchedPeaks: 1 }],
    hits: [{ species: 'O', observedNm: 844.582, referenceNm: 844.65, deltaNm: -0.068 }],
    winnerBreakdown: {
      primaryEmitter: 'O',
      primaryLikelyPct: 25,
      primaryEvidence: {
        model: 'primary-evidence-gate-v1',
        applicable: true,
        reportable: false,
        reason: 'single-line-evidence-in-calibration-extrapolation',
        acceptedHitCount: 1,
        independentEvidenceCount: 1,
        inAnchorIndependentEvidenceCount: 0,
        extrapolatedHitCount: 1,
        diagnosticMatchedPeaks: 1
      }
    }
  },
  trace: { xUnit: 'nm', points: [[400, 0], [844.582, 1]] },
  readiness: { hasFrame: true, calibrated: true, hasAnalysisResult: true }
};

test('prompt contract is versioned and keeps instructions separate from observation data', () => {
  assert.equal(PROMPT_CONTRACT_VERSION, 'spectra-pro-interpretation/v11');
  const instructions = buildDeveloperInstructions();
  assert.ok(instructions.includes('Respect winner.primaryEvidence'));
  assert.ok(instructions.includes('Score share/rank is not probability'));
  assert.ok(!instructions.includes(payload.observation));

  const input = buildModelInput(payload);
  assert.ok(input.includes(payload.observation));
  assert.ok(input.includes('"topCandidate":"O"'));
  assert.ok(input.includes('"reportable":false'));
});

test('buildPromptPackage binds prompt and response contracts without executing OpenAI', () => {
  const pack = buildPromptPackage(payload);
  assert.equal(pack.contractVersion, PROMPT_CONTRACT_VERSION);
  assert.equal(pack.responseContractVersion, RESPONSE_CONTRACT_VERSION);
  assert.equal(pack.responsePolicy.structuredOutput, true);
  assert.equal(pack.responsePolicy.inputTokenBudget, 3500);
  assert.equal(pack.responseFormat.type, 'json_schema');
  assert.equal(pack.responseFormat.strict, true);
});

test('response contract accepts complete structured prose and flattens it deterministically', () => {
  assert.equal(RESPONSE_CONTRACT_VERSION, 'spectra-pro-ai-response/v1');
  const result = {
    language: 'sv',
    summary: 'Sammanfattning.',
    interpretation: 'Tolkning.',
    dataQuality: 'Kvalitet.',
    caveats: 'Begränsning.',
    conclusion: 'Slutsats.'
  };
  assert.deepEqual(validateStructuredResult(result), { ok: true, errors: [] });
  assert.equal(
    flattenStructuredResult(result),
    'Sammanfattning.\n\nTolkning.\n\nKvalitet.\n\nBegränsning.\n\nSlutsats.'
  );
});

test('response contract rejects missing, extra and mistyped fields', () => {
  const format = buildResponseFormat();
  assert.equal(format.schema.additionalProperties, false);
  const checked = validateStructuredResult({
    language: 'sv',
    summary: 'x',
    interpretation: 'x',
    dataQuality: 'x',
    caveats: 'x',
    conclusion: 42,
    extra: 'nope'
  });
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.some((message) => message.includes('Unexpected response field')));
  assert.ok(checked.errors.some((message) => message.includes('conclusion must be a string')));
});
