import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildDeveloperInstructions, buildModelInput, buildPromptPackage } from '../backend/ai-worker/src/prompt.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/n2_real_export_20260926.json'), 'utf8'));

assert.equal(fixture.schema, 'spectra-pro-n2-real-export-regression/v1');
assert.equal(fixture.id, 'n2-export-20260926-155042');
assert.equal(fixture.reviewedExport.appVersion, 'v1.3.8');
assert.equal(fixture.reviewedExport.interfaceLanguage, 'sv');
assert.equal(fixture.reviewedExport.sourceAssetSha256, 'dc624e7ca38032b9ca6c93e09f14feec476617c35742316e4f6063b050e3bbea');
assert.equal(fixture.reviewedExport.pdfPageCount, 6, 'reviewed N2 PDF must remain the six-page reference case');
assert.equal(fixture.reviewedExport.pdfPage3RotationDeg, 90, 'reviewed N2 page 3 rotation is intentional');
assert.equal(fixture.reviewedExport.acceptedTopHitCount, 37);
assert.equal(fixture.reviewedExport.rawTopHitCount, 42);
assert.equal(fixture.reviewedExport.detectedPeakCount, 34);
assert.equal(fixture.reviewedExport.historicalAiInputTokens, 3723, 'fixture must preserve the pre-fix real AI token count');
assert.ok(fixture.reviewedExport.historicalAiInputTokens > fixture.expected.tokenBudget, 'reviewed pre-fix N2 AI input must document the old over-budget state');
assert.deepEqual(fixture.reviewedExport.historicalAiPossibleBands, ['[object Object]'], 'fixture must preserve the reviewed lossy possibleBands defect');
assert.equal(fixture.reviewedExport.historicalAiHitCount, 28, 'fixture must preserve the reviewed pre-fix AI hit count');
assert.equal(fixture.reviewedExport.historicalAiTracePoints, 107, 'fixture must preserve the reviewed pre-fix AI trace size');
assert.equal(fixture.reviewedExport.historicalModuleTooltip, 'Loaded v1.5 frontend modules.', 'fixture must preserve the reviewed stale module tooltip');

const excludedN2 = fixture.excludedRawN2Hit;
assert.equal(excludedN2.referenceNm, 771);
assert.equal(excludedN2.observedNm, 770.2863);
assert.equal(excludedN2.excludedByDiffraction, true);
assert.equal(excludedN2.excludedFromScoring, true);
assert.equal(excludedN2.exclusionReason, 'possible-higher-order-diffraction');
assert.equal(excludedN2.diffractionOrder, 2);

function buildN2State() {
  const sampleCount = 1280;
  const [c0, c1, c2] = fixture.calibration.coefficients;
  const px = Array.from({ length: sampleCount }, (_, i) => i);
  const nm = px.map((i) => c0 + c1 * i + c2 * i * i);
  const I = px.map((i) => 5 + 0.8 * Math.sin(i / 31) + 0.35 * Math.cos(i / 17));
  fixture.acceptedHits.forEach((hit, hitIndex) => {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < nm.length; i += 1) {
      const distance = Math.abs(nm[i] - hit.observedNm);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = i; }
    }
    const amplitude = 40 - hitIndex * 2;
    for (let offset = -4; offset <= 4; offset += 1) {
      const index = bestIndex + offset;
      if (index < 0 || index >= I.length) continue;
      I[index] += amplitude * Math.exp(-(offset * offset) / 4);
    }
  });

  return {
    appMode: 'LAB',
    frame: {
      source: 'image',
      provenance: fixture.sourceMetadata,
      latest: {
        source: 'image', px, nm, I, calibrated: true,
        timestamp: fixture.reviewedExport.generatedAt,
        provenance: fixture.sourceMetadata,
        sampleId: fixture.sourceMetadata.sampleId,
        sourceLabel: fixture.sourceMetadata.sourceLabel,
        sourceKind: fixture.sourceMetadata.kind
      }
    },
    calibration: {
      isCalibrated: true,
      points: fixture.calibration.points,
      coefficients: fixture.calibration.coefficients,
      residualStatus: 'available'
    },
    hardware: fixture.hardware,
    subtraction: { mode: 'raw' },
    display: { mode: 'normal' },
    preprocessing: {},
    peaks: { distance: 7 },
    worker: { status: 'ready', analysisHz: 0.02 },
    analysis: {
      enabled: true,
      resultContext: 'lab',
      presetId: 'smart-gastube',
      topHits: fixture.acceptedHits,
      rawTopHits: fixture.acceptedHits.concat([fixture.excludedRawN2Hit]),
      elementScores: fixture.candidates,
      winnerBreakdown: fixture.winnerBreakdown,
      calibrationDiagnostics: Object.assign({
        model: 'calibration-match-uncertainty-v1',
        available: true,
        pointCount: fixture.calibration.points.length
      }, fixture.calibration.diagnostics),
      measurementQuality: {
        model: 'measurement-quality-v1',
        overallStatus: fixture.quality.overallStatus,
        mainLimitation: fixture.quality.mainLimitation,
        dimensions: {
          coverage: fixture.quality.coverage,
          calibration: fixture.quality.calibration,
          noise: fixture.quality.noise
        },
        qcFlags: []
      },
      preprocessing: {
        schema: 'spectra-pro-preprocessing/v1',
        intensityBasis: 'uncorrected-relative-intensity',
        activeOperations: [], warnings: []
      },
      hardMatchCapNm: fixture.expected.hardMatchCapNm,
      maxDistanceNm: fixture.expected.hardMatchCapNm,
      includeWeakPeaks: false,
      peakThresholdRel: 0.015,
      peakDistancePx: 2,
      offsetNm: -0.1475,
      rawMatchOffsetNm: -0.1475,
      offsetBasis: 'matcher-residuals',
      qcFlags: ['POSSIBLE_HIGHER_ORDER_DIFFRACTION'],
      detectedPeakCount: fixture.reviewedExport.detectedPeakCount
    }
  };
}

const state = buildN2State();
const aiSource = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/aiAnalysisPayload.js'), 'utf8');
const aiContext = { console, Date, Math, JSON, setTimeout, clearTimeout };
aiContext.window = aiContext;
aiContext.SpectraPro = { version: 'v1.3.8', store: { getState: () => state } };
vm.createContext(aiContext);
new vm.Script(aiSource, { filename: 'aiAnalysisPayload.js' }).runInContext(aiContext);

const defaults = Object.assign({}, aiContext.SpectraPro.aiAnalysisPayload.defaults);
assert.deepEqual(defaults, {
  maxTracePoints: fixture.expected.defaultTraceMax,
  maxHits: fixture.expected.defaultHitMax,
  maxCandidates: fixture.expected.candidateMax
});

const payload = aiContext.SpectraPro.aiAnalysisPayload.build({ observation: fixture.reviewedExport.historicalObservation });
assert.ok(payload.trace && payload.trace.points.length <= fixture.expected.defaultTraceMax, 'real N2-shaped trace must obey the 80-point AI cap');
assert.ok(payload.analysis.hits.length <= fixture.expected.defaultHitMax, 'real N2 accepted evidence must obey the 20-hit AI cap');
assert.ok(payload.analysis.hits.every((hit) => Math.abs(Number(hit.deltaNm)) <= fixture.expected.hardMatchCapNm + 1e-9), 'AI evidence must obey the same 1.8 nm hard gate as accepted results');
assert.ok(!payload.analysis.hits.some((hit) => Math.abs(Number(hit.referenceNm) - 771) < 1e-9), 'excluded 770.2863 -> 771 nm higher-order N2 hit must not reach AI evidence');
assert.ok(!payload.analysis.hits.some((hit) => hit.excludedFromScoring === true || hit.excludedByDiffraction === true), 'AI hits must never contain excluded diffraction diagnostics');
assert.equal(payload.analysis.winnerBreakdown.possibleBands[0].element, 'N2+', 'structured N2+ possible-band evidence must survive frontend compaction');

const modelInput = buildModelInput(payload);
const promptPackage = buildPromptPackage(payload);
const estimatedInputTokens = Math.ceil((modelInput.length + buildDeveloperInstructions().length + JSON.stringify(promptPackage.responseFormat).length) / 4);
assert.ok(!modelInput.includes('[object Object]'), 'real N2 AI model input must not contain lossy object stringification');
assert.ok(!modelInput.includes(fixture.sourceMetadata.sampleId), 'source sample ID must remain provenance rather than model evidence');
assert.ok(!modelInput.includes(fixture.sourceMetadata.sourceLabel), 'source label must not act as an identification hint to the model');
assert.equal(promptPackage.responsePolicy.inputTokenBudget, fixture.expected.tokenBudget);
assert.ok(estimatedInputTokens <= fixture.expected.tokenBudget, 'real N2-shaped AI input exceeded ' + fixture.expected.tokenBudget + ' tokens: ' + estimatedInputTokens);

const exportSource = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exportUi.js'), 'utf8');
const exportContext = { console, setTimeout, clearTimeout };
exportContext.window = exportContext;
exportContext.SpectraPro = { version: 'v1.3.8', store: { getState: () => state } };
vm.createContext(exportContext);
new vm.Script(exportSource, { filename: 'exportUi.js' }).runInContext(exportContext);
exportContext.document = { getElementById: () => null };

const candidateRows = exportContext.SpectraPro.exportUi.buildPdfCandidateRows({ elementScores: fixture.candidates });
const candidateByName = Object.fromEntries(candidateRows.map((row) => [row[0], row]));
for (const [species, expectedCount] of Object.entries(fixture.expected.candidateMatchCounts)) {
  assert.equal(candidateByName[species][2], String(expectedCount), 'real N2 PDF candidate Matches must agree with GUI/JSON for ' + species);
}

const safeCameraStatus = exportContext.SpectraPro.exportUi.pdfSafeText(fixture.reviewedExport.cameraStatusValue);
assert.ok(!safeCameraStatus.includes('?'), 'real N2 camera status must not render a broken PDF glyph');
assert.ok(safeCameraStatus.includes('exp yes') && safeCameraStatus.includes('zoom-'), 'real N2 camera capability status must remain readable in the PDF-safe text path');

const n2TailHeight = exportContext.SpectraPro.exportUi.estimateResultDetailsPageHeight(
  fixture.reviewedExport.acceptedTopHitCount,
  fixture.reviewedExport.visibleDataQualityCount,
  fixture.reviewedExport.visibleStatusCount,
  1,
  fixture.expected.analysisLogMaxCount,
  fixture.expected.reproducibilityRowCount
);
assert.ok(n2TailHeight <= 263, 'reviewed N2 result-details density must stay within the current six-page layout envelope');
assert.ok(exportSource.includes('ctx.rotate(Math.PI / 2)'), 'intentional 90-degree page-3 visual rotation must remain wired');
assert.ok(exportSource.includes("pageBreak: 'avoid'") && exportSource.includes("rowPageBreak: 'avoid'"), 'N2 result tables must retain anti-spill page-break guards');
assert.ok(exportSource.includes('former pages') && exportSource.includes('single readable print page'), 'six-page result-tail layout intent must remain explicit');

const dqSource = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/dataQualityPanel.js'), 'utf8');
assert.ok(dqSource.includes('Loaded frontend modules.'), 'module status tooltip must remain version-neutral');
assert.ok(!dqSource.includes('Loaded v1.5 frontend modules.'), 'reviewed stale v1.5 tooltip must not return');

console.log('N2 real-export regression: PASS (~' + estimatedInputTokens + ' estimated AI input tokens, ' + payload.trace.points.length + ' trace points, ' + payload.analysis.hits.length + ' accepted AI hits).');
