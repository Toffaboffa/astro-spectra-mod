import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildDeveloperInstructions, buildModelInput, buildPromptPackage } from '../backend/ai-worker/src/prompt.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intensity = Array.from({ length: 1280 }, (_, index) =>
  20 + 200 * Math.exp(-Math.pow((index - 620) / 90, 2))
);
const wavelengths = intensity.map((_, index) => 380 + index * 0.4);
const hits = Array.from({ length: 64 }, (_, index) => ({
  species: `X${index}`,
  element: 'X',
  observedNm: 400 + index * 3,
  referenceNm: 400.08 + index * 3,
  deltaNm: -0.08,
  prominence: 100 - index,
  confidence: 0.8
}));
const candidates = Array.from({ length: 8 }, (_, index) => ({
  element: `Species ${index}`,
  rank: index + 1,
  likelyPct: 30 - index * 2,
  matchedCount: 8 - index,
  medianDeltaNm: 0.12 + index * 0.02,
  evidenceModel: 'atomic-fingerprint-v1'
}));

const state = {
  appMode: 'LAB',
  frame: { latest: {
    I: intensity,
    nm: wavelengths,
    px: intensity.map((_, index) => index),
    calibrated: true,
    timestamp: 1,
    source: 'token-budget-fixture'
  } },
  analysis: {
    presetId: 'smart-atomic',
    resultContext: 'lab',
    elementScores: candidates,
    rawTopHits: hits,
    measurementQuality: {
      model: 'measurement-quality-v1',
      overallStatus: 'limited',
      mainLimitation: { code: 'calibration', status: 'limited', reason: 'Finite calibration residual.' },
      dimensions: {
        signal: { status: 'good', reason: 'Signal available.', metrics: { min: 20, max: 220, mean: 55 } },
        calibration: { status: 'limited', reason: 'Finite residual.', metrics: { rmsResidualNm: 0.1, maxAbsResidualNm: 0.2 } }
      }
    },
    calibrationDiagnostics: {
      model: 'calibration-match-uncertainty-v1',
      available: true,
      pointCount: 3,
      polynomialOrder: 2,
      rmsResidualNm: 0.1,
      maxAbsResidualNm: 0.2,
      samplingNmPerPixel: 0.4,
      wavelengthCoverageNm: { min: 380, max: 891.6 },
      anchorWavelengthCoverageNm: { min: 380, max: 891.6 },
      extrapolation: { any: false, left: false, right: false }
    },
    preprocessing: { intensityBasis: 'uncorrected-relative-intensity', activeOperations: [], warnings: [] }
  },
  calibration: {
    isCalibrated: true,
    coefficients: [380, 0.4],
    points: [{ px: 0, nm: 380 }, { px: 640, nm: 636 }, { px: 1279, nm: 891.6 }]
  },
  hardware: { spectrometerResolutionFwhmNm: 1.5 },
  preprocessing: {}, subtraction: { mode: 'raw' }, display: { mode: 'normal' }, peaks: {}
};

const context = { window: null, console, Date, Math, JSON, setTimeout, clearTimeout };
context.window = context;
context.SpectraPro = { version: 'v3.0.1', store: { getState: () => state } };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/aiAnalysisPayload.js'), 'utf8'),
  context,
  { filename: 'aiAnalysisPayload.js' }
);

const payload = context.SpectraPro.aiAnalysisPayload.build({ observation: 'x'.repeat(1200) });
const promptPackage = buildPromptPackage(payload);
const modelInput = buildModelInput(payload);
const promptChars = modelInput.length + buildDeveloperInstructions().length + JSON.stringify(promptPackage.responseFormat).length;
const estimatedInputTokens = Math.ceil(promptChars / 4);
const payloadBytes = Buffer.byteLength(JSON.stringify(payload));

assert.deepEqual(Object.assign({}, context.SpectraPro.aiAnalysisPayload.defaults), {
  maxTracePoints: 112,
  maxHits: 28,
  maxCandidates: 6
});
assert.equal(payload.observation.length, 600, 'observation context must have a compact hard cap');
assert.ok(payload.trace.points.length >= 96 && payload.trace.points.length <= 112, 'trace must remain informative but bounded');
assert.equal(payload.analysis.hits.length, 28, 'only the most relevant bounded hit set should be sent');
assert.equal(payload.analysis.candidates.length, 6, 'candidate evidence should remain bounded');
assert.ok(payload.analysis.calibrationDiagnostics, 'calibration evidence must survive compaction');
assert.equal(payload.analysis.calibrationDiagnostics.samplingNmPerPixel, 0.4, 'compact AI payload must preserve canonical calibration sampling');
assert.deepEqual(Object.assign({}, payload.analysis.calibrationDiagnostics.extrapolation), { any: false, left: false, right: false }, 'compact AI payload must preserve calibration extrapolation state');
assert.ok(payload.quality.measurement, 'measurement quality must survive compaction');
assert.ok(payloadBytes <= 9000, `dense LAB payload exceeded 9 kB: ${payloadBytes}`);
assert.ok(estimatedInputTokens <= 2500, `estimated dense input exceeded 2500 tokens: ${estimatedInputTokens}`);
assert.deepEqual(promptPackage.responsePolicy.preferredWordRange, [100, 170]);
assert.ok(buildDeveloperInstructions().includes('Do not repeat the same fact across fields.'));

console.log(`AI TOKEN BUDGET: ${payloadBytes} bytes, ~${estimatedInputTokens} input tokens, ${payload.trace.points.length} trace points, ${payload.analysis.hits.length} hits, ${payload.analysis.candidates.length} candidates.`);
