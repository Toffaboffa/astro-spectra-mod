import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exportUi.js'), 'utf8');
const state = {
  appMode: 'LAB',
  frame: { latest: { source: 'numeric-contract', px: [0, 1, 2], nm: [500, 501, 502], I: [2, 8, 3] } },
  calibration: { isCalibrated: true, points: [{ px: 0, nm: 500 }, { px: 2, nm: 502 }], coefficients: [500, 1] },
  subtraction: { mode: 'raw' },
  hardware: { profileName: 'Contract instrument', spectrometerResolutionFwhmNm: 1.2 },
  analysis: {
    resultContext: 'lab', presetId: 'lamp-hg', detectedPeakCount: 1,
    detectedPeaks: [{ index: 1, value: 8, prominence: 6 }],
    offsetNm: -0.1, rawMatchOffsetNm: -0.1, offsetBasis: 'matcher-residuals',
    topHits: [{ element: 'Hg', species: 'Hg I', observedNm: 501, referenceNm: 501.1, deltaNm: -0.1 }],
    rawTopHits: [{ element: 'Hg', species: 'Hg I', observedNm: 501, referenceNm: 501.1, deltaNm: -0.1 }],
    elementScores: [{ element: 'Hg', likelyPct: 80, matchedCount: 1, medianDeltaNm: 0.1 }],
    qcFlags: ['limited-resolution'],
    preprocessing: { schema: 'spectra-pro-preprocessing/v1', intensityBasis: 'uncorrected-relative-intensity', activeOperations: [] },
    measurementQuality: {
      overallStatus: 'limited',
      mainLimitation: { code: 'resolution', reason: 'Limited resolution.' },
      dimensions: {
        noise: {
          status: 'good',
          reason: 'usable-snr',
          metrics: {
            snr: 12.34,
            noiseSigma: 0.5,
            signalSpanP95P05: 6.17,
            snrDefinition: 'p95-p05-over-noise-sigma'
          }
        }
      }
    }
  }
};

const longAiText = 'AI evidence sentence. '.repeat(180).trim();
const context = { console, setTimeout, clearTimeout };
context.window = context;
context.SpectraPro = {
  version: '3.0.1',
  store: { getState: () => state },
  aiAnalysisUi: {
    getLastResultText: () => longAiText,
    getLastPayload: () => ({ schema: 'spectra-pro-ai-analysis/v1', compact: true }),
    getLastResponse: () => ({ result: { summary: 'Optional interpretation.' } })
  }
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'exportUi.js' });
context.document = { getElementById: () => null };

const bundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const report = context.SpectraPro.exportUi.buildPdfReportModel(bundle);

assert.equal(bundle.schema, 'spectra-pro-export/v2', 'JSON must remain the complete versioned reproducibility artifact');
assert.equal(bundle.ai.resultText, longAiText, 'JSON must retain the complete completed AI text');
assert.equal(report.schema, 'spectra-pro-pdf-report/v1');
assert.equal(report.sourceExportSchema, 'spectra-pro-export/v2');
assert.equal(report.deterministicCore, true);
assert.deepEqual(Array.from(report.sections), [
  'cover', 'deterministic-abstract', 'spectrum-and-source', 'method-and-calibration',
  'deterministic-results', 'quality-and-status', 'reproducibility'
]);
assert.ok(!report.abstract.includes('AI evidence sentence'), 'AI text must not be blended into the deterministic abstract');
assert.equal(report.aiInterpretation.included, true);
assert.equal(report.aiInterpretation.label, 'OPTIONAL AI INTERPRETATION');
assert.ok(report.aiInterpretation.disclaimer.includes('does not replace the deterministic report results'));
assert.ok(report.aiInterpretation.text.length <= 2400, 'optional AI prose must not make the human report unbounded');
assert.ok(report.methodNarrative.length <= 3, 'human method narrative must remain concise');
assert.ok(report.analysisLog.length <= 12, 'human analysis log must remain bounded');
assert.equal(bundle.scientificAnalysis.detectedPeakCount, 1, 'scientific export snapshot must preserve the canonical worker peak count');
assert.equal(bundle.scientificAnalysis.detectedPeaks.length, 1, 'scientific export snapshot must preserve the canonical worker peak list');
assert.equal(bundle.scientificAnalysis.lab.offsetNm, -0.1, 'scientific export snapshot must preserve the canonical reported wavelength offset');
assert.equal(bundle.scientificAnalysis.lab.rawMatchOffsetNm, -0.1, 'scientific export snapshot must preserve the broader raw matcher offset separately');
assert.equal(bundle.scientificAnalysis.lab.offsetBasis, 'matcher-residuals', 'scientific export snapshot must preserve offset provenance');
assert.equal(bundle.scientificAnalysis.measurementQuality.dimensions.noise.metrics.snr, 12.34, 'scientific export must preserve the canonical worker SNR value');
assert.equal(bundle.scientificAnalysis.measurementQuality.dimensions.noise.metrics.snrDefinition, 'p95-p05-over-noise-sigma', 'scientific export must preserve the canonical SNR definition');
assert.ok(report.methodNarrative.some((line) => line.includes('(P95-P05)/noise sigma')), 'PDF method narrative must define the reported SNR quantity explicitly');
assert.equal(bundle.scientificAnalysis.lab.matchMeanAbsResidualNm, 0.1, 'scientific export snapshot must keep unsigned match MAE separate from signed offset');
assert.ok(report.analysisLog.some((line) => line.includes('match MAE=0.1000 nm')), 'PDF analysis log must name the unsigned match-error magnitude separately');
assert.ok(report.analysisLog.some((line) => line.includes('Detected peaks=1;')), 'PDF analysis log must report the canonical worker peak count instead of an unavailable placeholder');
assert.ok(report.limitations.includes('use-json-v2-for-complete-state-and-numeric-data'));

state.analysis.presetId = 'smart-fluorescent';
state.analysis.offsetNm = 0.623;
state.analysis.rawMatchOffsetNm = -0.272;
state.analysis.offsetBasis = 'clear-narrow-line-hits';
state.analysis.fluorescenceSummary = { model: 'broadband-fluorescence-v1', broadbandDetected: true, lambdaMaxNm: 595.5, centroidNm: 591.6, fwhmNm: 70.7, bandMinNm: 524.5, bandMaxNm: 659.8 };
state.analysis.clearNarrowLineHits = [
  { element: 'Hg', observedNm: 404.385, referenceNm: 404.656, deltaNm: -0.271 },
  { element: 'Hg', observedNm: 436.605, referenceNm: 435.833, deltaNm: 0.772 },
  { element: 'Hg', observedNm: 546.697, referenceNm: 546.074, deltaNm: 0.623 }
];
state.analysis.measurementQuality.overallStatus = 'good';
state.analysis.measurementQuality.mainLimitation = null;
state.analysis.measurementQuality.dimensions.coverage = {
  status: 'good',
  reason: 'analysis-region-within-calibration-anchors',
  metrics: {
    minNm: 376.24,
    maxNm: 910.34,
    analysisMinNm: 404.385,
    analysisMaxNm: 659.8,
    anchorMinNm: 388.86,
    anchorMaxNm: 837.76,
    fullFrameMinNm: 376.24,
    fullFrameMaxNm: 910.34,
    fullFrameExtrapolated: true,
    analysisRegionExtrapolated: false,
    analysisCoverageBasis: 'fluorescence-band-and-accepted-hits'
  }
};
const fluorescentBundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const fluorescentReport = context.SpectraPro.exportUi.buildPdfReportModel(fluorescentBundle);
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('coherent narrow-line hits accepted in the Fluorescent result')), 'Fluorescent PDF narrative must identify the accepted coherent hit set used for the reported offset');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('basis=clear-narrow-line-hits')), 'PDF analysis log must record machine-readable offset provenance');
assert.ok(Math.abs(fluorescentBundle.scientificAnalysis.lab.matchMeanAbsResidualNm - 0.5553333333333333) < 1e-12, 'Fluorescent scientific export must compute MAE from the accepted hit residual magnitudes');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('match MAE=0.5553 nm')), 'Fluorescent PDF log must keep +0.623 nm signed offset distinct from 0.5553 nm match MAE');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('full-frame extrapolation=yes')), 'PDF analysis log must retain the full-frame extrapolation warning');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('reason=analysis-region-within-calibration-anchors')), 'PDF analysis log must state that the reported Fluorescent result lies inside calibration anchors');
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('full-frame wavelength range extends beyond the calibration anchors')), 'PDF narrative must explain why edge extrapolation does not by itself lower safe result coverage');

context.SpectraPro.aiAnalysisUi = null;
const noAiBundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const noAiReport = context.SpectraPro.exportUi.buildPdfReportModel(noAiBundle);
assert.equal(noAiReport.aiInterpretation.included, false);
assert.equal(noAiReport.aiInterpretation.text, null);
assert.ok(noAiReport.abstract.length > 0, 'deterministic report must remain complete without AI');

assert.ok(source.includes('const reportModel = buildPdfReportModel(bundle);'));
assert.ok(source.includes('reportModel.aiInterpretation.disclaimer'));

console.log('PDF REPORT CONTRACT: deterministic summary, bounded narrative and separately labelled optional AI passed.');
