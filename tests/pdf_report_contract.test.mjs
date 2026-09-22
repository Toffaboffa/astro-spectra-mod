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
    topHits: [{ element: 'Hg', species: 'Hg I', observedNm: 501, referenceNm: 501.1, deltaNm: -0.1 }],
    rawTopHits: [{ element: 'Hg', species: 'Hg I', observedNm: 501, referenceNm: 501.1, deltaNm: -0.1 }],
    elementScores: [{ element: 'Hg', likelyPct: 80, matchedCount: 1, medianDeltaNm: 0.1 }],
    qcFlags: ['limited-resolution'],
    preprocessing: { schema: 'spectra-pro-preprocessing/v1', intensityBasis: 'uncorrected-relative-intensity', activeOperations: [] },
    measurementQuality: { overallStatus: 'limited', mainLimitation: { code: 'resolution', reason: 'Limited resolution.' } }
  }
};

const longAiText = 'AI evidence sentence. '.repeat(180).trim();
const context = { console, setTimeout, clearTimeout };
context.window = context;
context.SpectraPro = {
  version: '3.0.0',
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
assert.ok(report.limitations.includes('use-json-v2-for-complete-state-and-numeric-data'));

context.SpectraPro.aiAnalysisUi = null;
const noAiBundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const noAiReport = context.SpectraPro.exportUi.buildPdfReportModel(noAiBundle);
assert.equal(noAiReport.aiInterpretation.included, false);
assert.equal(noAiReport.aiInterpretation.text, null);
assert.ok(noAiReport.abstract.length > 0, 'deterministic report must remain complete without AI');

assert.ok(source.includes('const reportModel = buildPdfReportModel(bundle);'));
assert.ok(source.includes('reportModel.aiInterpretation.disclaimer'));

console.log('PDF REPORT CONTRACT: deterministic summary, bounded narrative and separately labelled optional AI passed.');
