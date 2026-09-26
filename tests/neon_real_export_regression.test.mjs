import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/neon_real_export_20260926.json'), 'utf8'));

function loadWorkerContext() {
  const context = vm.createContext({ console });
  context.self = context;
  for (const name of ['spectrumMath.js', 'measurementQuality.js', 'atomicProfiles.js', 'atomicEvidence.js']) {
    const source = fs.readFileSync(path.join(root, 'docs/frontend/workers', name), 'utf8');
    new vm.Script(source, { filename: name }).runInContext(context);
  }
  return context;
}

const worker = loadWorkerContext();

assert.equal(fixture.id, 'neon-export-20260926-101102', 'fixture must remain tied to the reviewed Neon export');
assert.equal(fixture.detectedPeakCount, 16, 'reviewed Neon export must retain its 16 worker-detected peaks');
assert.equal(fixture.historical.topHitCount, 42, 'fixture must retain the reviewed pre-fix accepted-hit count');
assert.equal(fixture.historical.rawTopHitCount, 46, 'fixture must retain the reviewed raw-hit count');
assert.equal(fixture.historical.outOfHardCapHits.length, 5, 'fixture must preserve the five reviewed >1.8 nm accepted-hit defects');
assert.ok(fixture.historical.outOfHardCapHits.every((hit) => Math.abs(hit.deltaNm) > fixture.expected.hardMatchCapNm), 'historical defect rows must truly lie outside the advertised hard gate');

const atomic = worker.SPECTRA_PRO_atomicEvidence.enhance({
  ok: true,
  calibrated: true,
  presetId: 'smart-gastube',
  autoTune: true,
  maxDistanceNm: fixture.expected.hardMatchCapNm,
  peaks: fixture.detectedPeaks,
  topHits: [],
  overlayHits: [],
  elementScores: [],
  diffractionCandidates: []
}, {
  calibrated: true,
  nm: [fixture.calibrationDiagnostics.wavelengthCoverageNm.min, fixture.calibrationDiagnostics.wavelengthCoverageNm.max],
  I: [1, 1]
}, {}, {});

assert.ok(atomic.autoTuneSummary && atomic.autoTuneSummary.confirmationIsScoringOnly === true, 'real Neon peaks must keep the 3 nm confirmation pass scoring-only');
assert.equal(atomic.autoTuneSummary.reportableToleranceNm, fixture.expected.hardMatchCapNm, 'real Neon accepted-hit gate must remain 1.8 nm');
assert.ok(atomic.topHits.length > 0, 'real Neon peaks should still yield accepted atomic hits');
assert.ok(atomic.topHits.every((hit) => Math.abs(Number(hit.deltaNm)) <= fixture.expected.hardMatchCapNm + 1e-9), 'real Neon accepted hits must all respect the advertised hard gate');
assert.ok(atomic.overlayHits.every((hit) => Math.abs(Number(hit.deltaNm)) <= fixture.expected.hardMatchCapNm + 1e-9), 'real Neon ordinary overlays must all respect the advertised hard gate');

const acceptedHits = fixture.acceptedNeHits.concat([fixture.bestAcceptedHit]);
const qc = {
  flags: [],
  metrics: {
    sampleCount: 1280,
    validFraction: 1,
    dynamicRange: 60,
    saturationCount: 0,
    saturationFraction: 0,
    noiseSigma: fixture.historical.measurementQuality.noise.metrics.noiseSigma,
    signalSpanP95P05: fixture.historical.measurementQuality.noise.metrics.signalSpanP95P05,
    snr: fixture.historical.measurementQuality.noise.metrics.snr,
    snrDefinition: 'p95-p05-over-noise-sigma'
  }
};
const quality = worker.SPECTRA_PRO_measurementQuality.build({
  ok: true,
  calibrated: true,
  presetId: 'smart-gastube',
  features: fixture.detectedPeaks.map((peak) => ({ quality: (peak.featureQualityFlags || []).length ? 'limited' : 'good' })),
  topHits: acceptedHits,
  calibrationDiagnostics: fixture.calibrationDiagnostics,
  matchUncertaintyModel: fixture.matchUncertaintyModel
}, { I: Array.from({ length: 1280 }, (_, i) => i % 61) }, {
  qc,
  hardware: fixture.hardware
});

assert.equal(quality.dimensions.coverage.status, fixture.expected.coverageStatus, 'real Neon result-scope coverage must be good');
assert.equal(quality.dimensions.coverage.reason, 'analysis-region-within-calibration-anchors', 'real Neon coverage must be classified from accepted result hits');
assert.equal(quality.dimensions.coverage.metrics.analysisCoverageBasis, fixture.expected.coverageBasis, 'real Neon coverage basis must remain accepted-result-hits');
assert.equal(quality.dimensions.coverage.metrics.fullFrameExtrapolated, true, 'real Neon unused frame-edge extrapolation must remain visible');
assert.equal(quality.dimensions.coverage.metrics.analysisRegionExtrapolated, false, 'real Neon accepted result region must remain inside calibration anchors');
assert.equal(quality.dimensions.calibration.status, fixture.expected.calibrationStatus, 'real Neon zero-DOF calibration must be moderate rather than poor when accepted hits are inside anchors');
assert.equal(quality.overallStatus, fixture.expected.overallStatus, 'real Neon overall quality must be moderate after result-scoped coverage');
assert.equal(quality.dimensions.noise.metrics.snr, fixture.expected.snr, 'real Neon unavailable SNR must remain null');

const framePreviewSource = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/framePreview.js'), 'utf8');
function sourceDescriptor(provenance, language) {
  const state = { frame: { provenance } };
  const video = { id: 'videoMain', srcObject: {} };
  const image = { id: 'cameraImage' };
  const documentStub = {
    documentElement: { lang: language },
    body: {},
    getElementById(id) {
      if (id === 'videoMain') return video;
      if (id === 'cameraImage') return image;
      return null;
    }
  };
  const windowStub = {
    SpectraPro: {
      store: { getState() { return state; } },
      runtime: { getVideoElement() { return video; } },
      i18n: { getLanguage() { return language; } }
    },
    addEventListener() {},
    getComputedStyle() { return { position: 'static' }; }
  };
  const context = vm.createContext({ console, document: documentStub, window: windowStub });
  new vm.Script(framePreviewSource, { filename: 'framePreview.js' }).runInContext(context);
  return context.window.SpectraPro.framePreview.getSourceDescriptor();
}
const sourceSv = sourceDescriptor(fixture.sourceMetadata, 'sv');
assert.equal(sourceSv.badge, fixture.expected.sourceBadgeSv, 'real Neon bundled source must not render as SOURCE Cam');
assert.equal(sourceSv.identity, fixture.expected.sourceLabelSv, 'real Neon source identity must use the Swedish provenance label');

const dqSource = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/dataQualityPanel.js'), 'utf8');
const dqFrame = { source: 'image', I: [0, 1, 0.5, 0.2] };
const dqWindow = { SpectraPro: { v15: {} } };
const dqContext = vm.createContext({ console, document: { getElementById() { return null; } }, window: dqWindow });
new vm.Script(dqSource, { filename: 'dataQualityPanel.js' }).runInContext(dqContext);
const dqResult = dqContext.window.SpectraPro.v15.dataQualityPanel.compute({
  appMode: 'LAB',
  hardware: fixture.hardware,
  analysis: {
    enabled: true,
    topHits: acceptedHits,
    qcFlags: [],
    calibrationDiagnostics: fixture.calibrationDiagnostics,
    measurementQuality: quality
  },
  worker: {},
  frame: { latest: dqFrame }
}, { latestFrame: dqFrame });
const dqRows = Object.fromEntries(dqResult.dq.map((row) => [row.label, row]));
assert.equal(dqRows['Best hit conf:'].value, '0.87', 'real Neon GUI must label 0.87 as best individual hit confidence');
assert.ok(!dqRows['Conf:'], 'real Neon GUI must not restore the ambiguous Conf label');

const exportSource = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exportUi.js'), 'utf8');
const exportState = {
  appMode: 'LAB',
  frame: {
    source: 'image',
    provenance: fixture.sourceMetadata,
    latest: { source: 'image', I: [0, 1, 0.5, 0.2], nm: [584.67, 610, 650, 721.58] }
  },
  calibration: { isCalibrated: true, points: [], coefficients: [] },
  subtraction: { mode: 'raw' },
  hardware: fixture.hardware,
  analysis: {
    presetId: 'smart-gastube',
    detectedPeakCount: fixture.detectedPeakCount,
    topHits: acceptedHits,
    rawTopHits: acceptedHits.concat(fixture.historical.outOfHardCapHits),
    qcFlags: [],
    offsetNm: 0.0975,
    offsetBasis: 'matcher-residuals',
    calibrationDiagnostics: fixture.calibrationDiagnostics,
    matchUncertaintyModel: fixture.matchUncertaintyModel,
    measurementQuality: quality
  }
};
const exportContext = { console, setTimeout, clearTimeout };
exportContext.window = exportContext;
exportContext.SpectraPro = { version: '3.1.7', store: { getState: () => exportState } };
vm.createContext(exportContext);
new vm.Script(exportSource, { filename: 'exportUi.js' }).runInContext(exportContext);
exportContext.document = { getElementById: () => null };
const bundle = exportContext.SpectraPro.exportUi.buildAnalysisBundle();
const report = exportContext.SpectraPro.exportUi.buildPdfReportModel(bundle);

assert.equal(report.matchedFeatureBasis, 'accepted-top-hits', 'real Neon PDF result table must use accepted topHits');
assert.equal(report.matchedFeatureRows.length, acceptedHits.length, 'real Neon PDF table must exclude raw diagnostic/confirmation-only hits');
assert.ok(report.matchedFeatureRows.every((row) => Math.abs(Number(row[3])) <= fixture.expected.hardMatchCapNm + 1e-9), 'real Neon PDF rows must respect the 1.8 nm hard gate');
assert.ok(report.abstract.includes('Canonical SNR is —'), 'real Neon PDF abstract must keep unavailable SNR unavailable');
assert.ok(report.analysisLog.some((line) => line.includes('reason=analysis-region-within-calibration-anchors')), 'real Neon PDF log must preserve result-scoped coverage semantics');
assert.ok(report.analysisLog.some((line) => line.includes('report hit basis=accepted-top-hits')), 'real Neon PDF log must state the deterministic accepted-hit basis');
assert.equal(bundle.sourceMetadata.sourceLabelSv, fixture.expected.sourceLabelSv, 'real Neon export must preserve localized source provenance');

const neonTailHeight = exportContext.SpectraPro.exportUi.estimateResultDetailsPageHeight(
  fixture.expected.acceptedTopHitCountAfterHardCap,
  fixture.historical.visibleDataQualityCount,
  fixture.historical.visibleStatusCount,
  0,
  fixture.expected.analysisLogMaxCount,
  fixture.expected.reproducibilityRowCount
);
assert.ok(neonTailHeight <= 258, 'reviewed Neon result-details tail must fit within one A4 content page so the report remains six pages');
assert.ok(exportSource.includes('Quality/Status, analysis log and reproducibility together on page 6.'), 'PDF layout contract must keep the compact six-page Neon report target');
assert.ok(exportSource.includes("pageBreak: 'avoid'") && exportSource.includes("rowPageBreak: 'avoid'"), 'PDF result-detail tables must avoid tiny spill pages');

console.log('Neon real-export regression: PASS');
