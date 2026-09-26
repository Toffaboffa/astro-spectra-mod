import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exportUi.js'), 'utf8');
const state = {
  appMode: 'LAB',
  frame: {
    source: 'numeric-contract',
    provenance: {
      kind: 'user-image',
      sourceLabel: 'contract-spectrum.png',
      fileName: 'contract-spectrum.png',
      mimeType: 'image/png',
      fileSizeBytes: 2048,
      origin: 'local-file'
    },
    latest: { source: 'numeric-contract', px: [0, 1, 2], nm: [500, 501, 502], I: [2, 8, 3] }
  },
  calibration: { isCalibrated: true, points: [{ px: 0, nm: 500 }, { px: 2, nm: 502 }], coefficients: [500, 1] },
  subtraction: { mode: 'raw' },
  hardware: {
    profileName: 'Contract instrument',
    spectralRangeMinNm: 360,
    spectralRangeMaxNm: 930,
    spectrometerResolutionFwhmNm: 1.2,
    pixelResolutionNm: 0.5
  },
  analysis: {
    resultContext: 'lab', presetId: 'lamp-hg', detectedPeakCount: 1,
    detectedPeaks: [{ index: 1, value: 8, prominence: 6 }],
    offsetNm: -0.1, rawMatchOffsetNm: -0.1, offsetBasis: 'matcher-residuals',
    topHits: [{ element: 'Hg', species: 'Hg I', observedNm: 501, referenceNm: 501.1, deltaNm: -0.1 }],
    rawTopHits: [{ element: 'Hg', species: 'Hg I', observedNm: 501, referenceNm: 501.1, deltaNm: -0.1 }],
    elementScores: [{ element: 'Hg', likelyPct: 80, matchedCount: 1, medianDeltaNm: 0.1 }],
    qcFlags: ['limited-resolution'],
    preprocessing: { schema: 'spectra-pro-preprocessing/v1', intensityBasis: 'uncorrected-relative-intensity', activeOperations: [] },
    calibrationDiagnostics: {
      model: 'calibration-match-uncertainty-v1',
      available: true,
      pointCount: 2,
      polynomialOrder: 1,
      fitDegreesOfFreedom: 0,
      fitResidualIndependent: false,
      exactInterpolation: true,
      fitResidualStatus: 'exact-interpolation-residual-not-independent',
      rmsResidualNm: 0,
      maxAbsResidualNm: 0,
      wavelengthCoverageNm: { min: 376.240561, max: 910.338212 },
      anchorWavelengthCoverageNm: { min: 388.86, max: 837.76 },
      samplingNmPerPixel: 0.417590031834,
      extrapolation: { any: false, left: false, right: false }
    },
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

assert.equal(
  context.SpectraPro.exportUi.pdfSafeText('λ Δ σ ≈ ± × μ µ α β γ Ω H₂O CO₂ 10⁻³ → ≤ ≥ − – — · Å €'),
  'lambda Delta sigma approx +/- x mu mu alpha beta gamma Omega H2O CO2 10-3 -> <= >= - - - - Angstrom EUR',
  'PDF text sanitizer must transliterate scientific Unicode into core-Helvetica-safe text'
);
assert.equal(
  context.SpectraPro.exportUi.pdfSafeText('Noise σ: ≈ 0.30 · Ångström äö'),
  'Noise sigma: approx 0.30 - Ångström äö',
  'PDF text sanitizer must preserve supported Swedish Latin characters while replacing unsupported scientific glyphs'
);
assert.ok(!/[λΔσ≈μΩ₂₃⁻→≤≥−–—Å]/.test(context.SpectraPro.exportUi.pdfSafeText('λ Δ σ ≈ μ Ω H₂O 10⁻³ → ≤ ≥ − – — Å')), 'unsupported scientific Unicode must not survive into the core Helvetica PDF text path');

const compactQualityHeight = context.SpectraPro.exportUi.estimateQualityStatusBlockHeight(
  Array.from({ length: 18 }, (_, index) => ({ label: 'Q' + index, value: String(index) })),
  Array.from({ length: 14 }, (_, index) => ({ label: 'S' + index, value: String(index) })),
  ['LOW_SIGNAL']
);
assert.ok(compactQualityHeight < 120, 'compact Quality/Status block estimate must fit comfortably on one A4 page instead of forcing a tiny spill page');

assert.equal(bundle.schema, 'spectra-pro-export/v2', 'JSON must remain the complete versioned reproducibility artifact');
assert.equal(bundle.ai.resultText, longAiText, 'JSON must retain the complete completed AI text');
assert.equal(report.schema, 'spectra-pro-pdf-report/v1');
assert.equal(report.sourceExportSchema, 'spectra-pro-export/v2');
assert.equal(bundle.sourceMetadata.kind, 'user-image', 'PDF/JSON bundle must retain local-image source kind');
assert.equal(bundle.sourceMetadata.fileName, 'contract-spectrum.png', 'PDF/JSON bundle must retain imported image filename');
assert.equal(bundle.frameSummary.sourceLabel, 'contract-spectrum.png', 'frameSummary must retain imported source identity');
assert.ok(report.analysisLog.some((line) => line.includes('Source identity=contract-spectrum.png; kind=user-image')), 'PDF analysis log must record source identity and kind');
assert.equal(report.deterministicCore, true);
assert.deepEqual(Array.from(report.sections), [
  'cover', 'deterministic-abstract', 'spectrum-and-source', 'method-and-calibration',
  'deterministic-results', 'quality-and-status', 'reproducibility'
]);
assert.ok(!report.abstract.includes('AI evidence sentence'), 'AI text must not be blended into the deterministic abstract');
assert.ok(report.abstract.includes('Source identity: contract-spectrum.png.'), 'deterministic abstract must include the persisted source identity when available');
assert.ok(report.abstract.includes('Canonical SNR is 12.34 using (P95-P05)/noise sigma'), 'deterministic abstract must name the canonical SNR definition');
assert.ok(report.abstract.includes('Calibration fit, actual calibrated sampling/coverage, instrument FWHM and QC are treated as separate quantities.'), 'deterministic abstract must keep fit, sampling, coverage and instrument resolution conceptually separate');
assert.equal(report.aiInterpretation.included, true);
assert.equal(report.aiInterpretation.label, 'OPTIONAL AI INTERPRETATION');
assert.ok(report.aiInterpretation.disclaimer.includes('does not replace the deterministic report results'));
assert.ok(report.aiInterpretation.text.length <= 2400, 'optional AI prose must not make the human report unbounded');
assert.ok(report.methodNarrative.length <= 3, 'human method narrative must remain concise');
assert.ok(source.includes("sv ? 'Nominell pixelskala' : 'Nominal pixel scale'"), 'PDF instrument table must label the hardware value as nominal pixel scale');
assert.ok(source.includes("sv ? 'Kalibrerad sampling' : 'Calibrated sampling'"), 'PDF instrument table must show calibrated sampling separately');
assert.ok(source.includes("sv ? 'Konfigurerat hårdvaruomfång' : 'Configured hardware range'"), 'PDF instrument table must label configured hardware range explicitly');
assert.ok(source.includes("sv ? 'Kalibrerad täckning' : 'Calibrated coverage'"), 'PDF instrument table must show actual calibrated coverage separately');
assert.ok(source.includes("if (String(a.presetId || '') === 'smart-fluorescent')"), 'PDF matched-feature selector must special-case Fluorescent accepted hits');
assert.ok(source.includes('clearNarrowLineHits') && source.includes('optional weaker overlay candidates are visual and do not change the deterministic report result'), 'PDF source must document that Fluorescent overlay candidates are visual only');
assert.ok(source.includes('function pdfTableRow(row)'), 'PDF export must centralize table-cell sanitization');
assert.ok(source.includes('head: [pdfTableRow(head)]') && source.includes('body: paired.map(pdfTableRow)'), 'matched-feature AutoTable must sanitize both headers and cells');
assert.ok(source.includes("body: rows.map(pdfTableRow)"), 'quality/status AutoTable must sanitize diagnostic labels such as Noise sigma');
assert.ok(source.includes("pageBreak: 'avoid'") && source.includes("rowPageBreak: 'avoid'"), 'Quality/Status and reproducibility tables must avoid tiny spill pages when the block fits as a unit');
assert.ok(source.includes('estimateQualityStatusBlockHeight(dq, status, qc)'), 'PDF layout must estimate Quality/Status height before choosing a page');
assert.ok(source.includes('if (y + qualityBlockHeight > 276) { doc.addPage(); y = 18; }'), 'Quality/Status must move cleanly to a fresh page when remaining space is insufficient');
assert.ok(source.includes('Do not force a new page here'), 'analysis log should share the Quality/Status tail page when space permits');
assert.ok(!source.includes("// Detailed log and reproducibility\n    doc.addPage();"), 'the old unconditional page break before the analysis log must not return');
assert.ok(source.includes("fontSize: 6.8, cellPadding: 0.9"), 'Quality/Status table must use the compact print layout');
assert.ok(source.includes("fontSize: 6.9, cellPadding: 0.9"), 'reproducibility table must use the compact print layout');
assert.ok(source.includes("'σ':'sigma'") && source.includes("'≈':' approx '") && source.includes("'±':' +/- '") && source.includes("'×':' x '"), 'PDF sanitizer must cover the scientific symbols that previously rendered incorrectly');
assert.ok(!source.includes('instrument/sampling resolution'), 'English report prose must not conflate instrument resolution with calibrated sampling');
assert.ok(!source.includes('instrument-/samplingupplösningen'), 'Swedish report prose must not conflate instrument resolution with calibrated sampling');
assert.ok(source.includes('Calibrated sampling, nominal pixel scale and instrument FWHM are separate quantities.'), 'LAB report prose must state the canonical separation between sampling and instrument resolution');
assert.ok(source.includes('fitvärde misstolkas som fysisk noggrannhet') && source.includes('numerical fit statistic is not mistaken for physical accuracy'), 'report prose must preserve the distinction between fit residual and physical accuracy');
assert.ok(source.includes(".replace(/[^\\x09\\x0A\\x0D\\x20-\\xFF]/g, '?')"), 'PDF sanitizer must replace any remaining unsupported Unicode instead of emitting broken glyphs');
assert.ok(source.includes('function finiteReportNumber(value)') && source.includes("value === null || value === undefined || value === '' || typeof value === 'boolean'"), 'PDF export must centralize null-safe numeric conversion before formatting');
assert.ok(source.includes('const analysisMin = finiteReportNumber(cm.analysisMinNm)') && source.includes("analysisRange = analysisMin !== null && analysisMax !== null"), 'PDF coverage log must use null-safe numeric range checks');
assert.ok(source.includes("Object.prototype.hasOwnProperty.call(metrics, 'snr')"), 'PDF canonical SNR logic must distinguish an explicit unavailable worker value from an absent metric');
assert.ok(report.analysisLog.length <= 12, 'human analysis log must remain bounded');
assert.equal(bundle.scientificAnalysis.detectedPeakCount, 1, 'scientific export snapshot must preserve the canonical worker peak count');
assert.equal(bundle.scientificAnalysis.detectedPeaks.length, 1, 'scientific export snapshot must preserve the canonical worker peak list');
assert.equal(bundle.scientificAnalysis.lab.offsetNm, -0.1, 'scientific export snapshot must preserve the canonical reported wavelength offset');
assert.equal(bundle.scientificAnalysis.lab.rawMatchOffsetNm, -0.1, 'scientific export snapshot must preserve the broader raw matcher offset separately');
assert.equal(bundle.scientificAnalysis.lab.offsetBasis, 'matcher-residuals', 'scientific export snapshot must preserve offset provenance');
assert.equal(bundle.scientificAnalysis.calibration.diagnostics.fitDegreesOfFreedom, 0, 'scientific export must preserve calibration fit degrees of freedom');
assert.equal(bundle.scientificAnalysis.calibration.diagnostics.exactInterpolation, true, 'scientific export must preserve exact-interpolation status');
assert.equal(bundle.scientificAnalysis.calibration.diagnostics.fitResidualStatus, 'exact-interpolation-residual-not-independent', 'scientific export must preserve the non-independent residual status');
assert.ok(report.analysisLog.some((line) => line.includes('Calibration fit RMS=0.0000 nm; fit dof=0;')), 'PDF analysis log must label zero-residual calibration as a fit statistic with zero degrees of freedom');
assert.ok(report.methodNarrative.some((line) => line.includes('exact interpolation of the calibration points')), 'PDF narrative must explain that zero-DOF zero RMS is exact interpolation, not an accuracy measurement');
assert.ok(report.methodNarrative.some((line) => line.includes('not an independent estimate of wavelength accuracy')), 'PDF narrative must reject the wavelength-accuracy interpretation explicitly');
assert.ok(report.analysisLog.some((line) => line.includes('Nominal hardware pixel scale=0.5000 nm/px; calibrated sampling=0.4176 nm/px')), 'PDF analysis log must keep nominal hardware pixel scale separate from calibrated sampling');
assert.ok(report.analysisLog.some((line) => line.includes('configured hardware range=360.0–930.0 nm; calibrated coverage=376.2–910.3 nm')), 'PDF analysis log must keep configured hardware range separate from actual calibrated coverage');
assert.ok(report.methodNarrative.some((line) => line.includes('These are different quantities and need not be numerically equal')), 'PDF narrative must explain why nominal pixel scale and calibrated sampling are not a contradiction');
assert.equal(bundle.scientificAnalysis.measurementQuality.dimensions.noise.metrics.snr, 12.34, 'scientific export must preserve the canonical worker SNR value');
assert.equal(bundle.scientificAnalysis.measurementQuality.dimensions.noise.metrics.snrDefinition, 'p95-p05-over-noise-sigma', 'scientific export must preserve the canonical SNR definition');
assert.ok(report.methodNarrative.some((line) => line.includes('(P95-P05)/noise sigma')), 'PDF method narrative must define the reported SNR quantity explicitly');
assert.ok(report.methodNarrative.some((line) => line.includes('reported signed wavelength offset is -0.100 nm')), 'PDF method narrative must identify offset as a signed wavelength residual');
assert.ok(report.methodNarrative.some((line) => line.includes('positive means observed wavelength above the reference value and negative means below')), 'PDF method narrative must define the wavelength-offset sign convention');
assert.ok(report.methodNarrative.some((line) => line.includes('Match MAE is 0.100 nm')), 'PDF method narrative must report unsigned Match MAE separately from signed offset');
assert.ok(report.methodNarrative.some((line) => line.includes('Offset and Match MAE describe different properties')), 'PDF method narrative must state that offset and Match MAE are not interchangeable');
assert.equal(bundle.scientificAnalysis.lab.matchMeanAbsResidualNm, 0.1, 'scientific export snapshot must keep unsigned match MAE separate from signed offset');
assert.ok(report.analysisLog.some((line) => line.includes('match MAE=0.1000 nm')), 'PDF analysis log must name the unsigned match-error magnitude separately');
assert.ok(report.analysisLog.some((line) => line.includes('Detected peaks=1;')), 'PDF analysis log must report the canonical worker peak count instead of an unavailable placeholder');
assert.ok(report.limitations.includes('use-json-v2-for-complete-state-and-numeric-data'));

assert.equal(context.SpectraPro.exportUi.pdfSafeNumber(null), null, 'PDF numeric conversion must preserve null as unavailable');
assert.equal(context.SpectraPro.exportUi.pdfSafeNumber(undefined), null, 'PDF numeric conversion must preserve undefined as unavailable');
assert.equal(context.SpectraPro.exportUi.pdfSafeNumber(''), null, 'PDF numeric conversion must preserve empty numeric fields as unavailable');
assert.equal(context.SpectraPro.exportUi.pdfSafeNumber(false), null, 'PDF numeric conversion must not coerce booleans to 0/1');
assert.equal(context.SpectraPro.exportUi.pdfSafeNumber('0'), 0, 'PDF numeric conversion must still preserve a real numeric zero');

const savedNullSemantics = {
  noise: state.analysis.measurementQuality.dimensions.noise,
  coverage: state.analysis.measurementQuality.dimensions.coverage,
  saturation: state.analysis.measurementQuality.dimensions.saturation,
  offsetNm: state.analysis.offsetNm,
  maxDistanceNm: state.analysis.maxDistanceNm,
  hardMatchCapNm: state.analysis.hardMatchCapNm,
  topHits: state.analysis.topHits,
  rawTopHits: state.analysis.rawTopHits
};
state.analysis.measurementQuality.dimensions.noise = {
  status: 'unavailable',
  reason: 'snr-unavailable',
  metrics: {
    snr: null,
    noiseSigma: 0,
    signalSpanP95P05: 180,
    snrDefinition: 'p95-p05-over-noise-sigma'
  }
};
state.analysis.measurementQuality.dimensions.saturation = {
  status: 'unavailable',
  reason: 'saturation-unavailable',
  metrics: { saturationFraction: null }
};
state.analysis.measurementQuality.dimensions.coverage = {
  status: 'poor',
  reason: 'coverage-includes-extrapolation',
  metrics: {
    analysisMinNm: null,
    analysisMaxNm: null,
    anchorMinNm: null,
    anchorMaxNm: null,
    fullFrameExtrapolated: true,
    analysisRegionExtrapolated: null
  }
};
state.analysis.offsetNm = null;
state.analysis.maxDistanceNm = null;
state.analysis.hardMatchCapNm = null;
state.analysis.topHits = [{ element: 'X', observedNm: null, referenceNm: null, deltaNm: null, confidence: null }];
state.analysis.rawTopHits = state.analysis.topHits.slice();

const nullBundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const nullReport = context.SpectraPro.exportUi.buildPdfReportModel(nullBundle);
assert.ok(nullReport.abstract.includes('Canonical SNR is — using (P95-P05)/noise sigma'), 'PDF abstract must render canonical SNR=null as unavailable, never 0.00');
assert.ok(!nullReport.abstract.includes('Canonical SNR is 0.00'), 'PDF abstract must not coerce unavailable SNR to zero');
assert.ok(nullReport.analysisLog.some((line) => line.includes('analysis range=not defined; calibration anchors=not available')), 'PDF analysis log must render null result/anchor ranges as unavailable rather than 0.00–0.00 nm');
assert.ok(!nullReport.analysisLog.some((line) => line.includes('analysis range=0.00–0.00 nm')), 'PDF analysis log must not coerce a null analysis range to zero');
assert.equal(nullBundle.scientificAnalysis.calibration.hardMatchCapNm, null, 'scientific export must preserve an unavailable hard match cap instead of coercing it to zero');
assert.ok(nullReport.methodNarrative.some((line) => line.includes('reported signed wavelength offset is not available')), 'PDF narrative must preserve unavailable offset semantics');
assert.ok(nullReport.methodNarrative.some((line) => line.includes('the active preset limit')), 'PDF narrative must preserve unavailable max-distance semantics rather than showing 0.00 nm');
assert.deepEqual(Array.from(nullReport.matchedFeatureRows[0]), ['X', '—', '—', '—', '—'], 'PDF matched-feature rows must not turn null wavelengths/confidence into numeric zeroes');

state.analysis.measurementQuality.dimensions.noise = savedNullSemantics.noise;
if (savedNullSemantics.coverage === undefined) delete state.analysis.measurementQuality.dimensions.coverage;
else state.analysis.measurementQuality.dimensions.coverage = savedNullSemantics.coverage;
if (savedNullSemantics.saturation === undefined) delete state.analysis.measurementQuality.dimensions.saturation;
else state.analysis.measurementQuality.dimensions.saturation = savedNullSemantics.saturation;
state.analysis.offsetNm = savedNullSemantics.offsetNm;
if (savedNullSemantics.maxDistanceNm === undefined) delete state.analysis.maxDistanceNm;
else state.analysis.maxDistanceNm = savedNullSemantics.maxDistanceNm;
if (savedNullSemantics.hardMatchCapNm === undefined) delete state.analysis.hardMatchCapNm;
else state.analysis.hardMatchCapNm = savedNullSemantics.hardMatchCapNm;
state.analysis.topHits = savedNullSemantics.topHits;
state.analysis.rawTopHits = savedNullSemantics.rawTopHits;

state.frame.provenance = {
  kind: 'bundled-example',
  sampleId: 'fluorescent-tube',
  sampleKind: 'image',
  sourceLabel: 'Fluorescent tube — Philips MASTER TL5 HE 28W/830 (calibrated)',
  sourceLabelEn: 'Fluorescent tube — Philips MASTER TL5 HE 28W/830 (calibrated)',
  sourceLabelSv: 'Lysrör — Philips MASTER TL5 HE 28W/830 (kalibrerat)',
  assetId: 'fluorescent-tube',
  assetPath: '../assets/examples/fluorescent-tube/fluorescent-tube.png',
  assetSha256: 'ecd5cc32f7eceb11778e69ba568b56ba6f8261b929b91e880d80a0507e2c38c3'
};
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
state.analysis.narrowLineCandidates = [
  { element: 'Hg', observedNm: 404.385, referenceNm: 404.656, deltaNm: -0.271 },
  { element: 'Hg', observedNm: 436.605, referenceNm: 435.833, deltaNm: 0.772 },
  { element: 'Hg', observedNm: 546.697, referenceNm: 546.074, deltaNm: 0.623 },
  { element: 'Hg', observedNm: 576.995, referenceNm: 576.961, deltaNm: 0.034, confidence: 0.2 },
  { element: 'Ar', observedNm: 696.4, referenceNm: 696.543, deltaNm: -0.143, confidence: 0.1 }
];
state.analysis.narrowLineOverlay = false;
state.analysis.topHits = state.analysis.clearNarrowLineHits.slice();
state.analysis.rawTopHits = state.analysis.clearNarrowLineHits.slice();
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
const fluorescentRowsOverlayOff = JSON.stringify(fluorescentReport.matchedFeatureRows);
const fluorescentLogOverlayOff = JSON.stringify(fluorescentReport.analysisLog);
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('coherent narrow-line hits accepted in the Fluorescent result')), 'Fluorescent PDF narrative must identify the accepted coherent hit set used for the reported offset');
assert.ok(fluorescentReport.abstract.includes('Source identity: Fluorescent tube — Philips MASTER TL5 HE 28W/830 (calibrated).'), 'Fluorescent deterministic abstract must identify the actual bundled source');
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('reported signed wavelength offset is 0.623 nm')), 'Fluorescent narrative must report the canonical accepted-hit signed offset');
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('Match MAE is 0.555 nm')), 'Fluorescent narrative must keep accepted-hit MAE separate from signed offset');
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('optional weaker overlay candidates do not change the table')), 'Fluorescent narrative must state that overlay-only candidates do not alter deterministic results');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('basis=clear-narrow-line-hits')), 'PDF analysis log must record machine-readable offset provenance');
assert.equal(fluorescentReport.matchedFeatureBasis, 'accepted-clear-narrow-line-hits', 'Fluorescent report model must identify accepted clear narrow-line hits as the table basis');
assert.equal(fluorescentReport.matchedFeatureRows.length, 3, 'Fluorescent matched-feature table must contain only accepted coherent hits when overlay is off');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('accepted narrow-line hits=3; narrow-line candidates=5')), 'Fluorescent analysis log must report accepted hits and candidate count without using overlay-dependent raw-hit count');
assert.ok(Math.abs(fluorescentBundle.scientificAnalysis.lab.matchMeanAbsResidualNm - 0.5553333333333333) < 1e-12, 'Fluorescent scientific export must compute MAE from the accepted hit residual magnitudes');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('match MAE=0.5553 nm')), 'Fluorescent PDF log must keep +0.623 nm signed offset distinct from 0.5553 nm match MAE');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('full-frame extrapolation=yes')), 'PDF analysis log must retain the full-frame extrapolation warning');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('reason=analysis-region-within-calibration-anchors')), 'PDF analysis log must state that the reported Fluorescent result lies inside calibration anchors');
assert.ok(fluorescentReport.methodNarrative.some((line) => line.includes('full-frame wavelength range extends beyond the calibration anchors')), 'PDF narrative must explain why edge extrapolation does not by itself lower safe result coverage');
assert.equal(fluorescentBundle.sourceMetadata.sampleId, 'fluorescent-tube', 'Fluorescent export must retain bundled example ID');
assert.equal(fluorescentBundle.sourceMetadata.sourceLabel, 'Fluorescent tube — Philips MASTER TL5 HE 28W/830 (calibrated)', 'Fluorescent export must retain the full source identity');
assert.equal(fluorescentBundle.sourceMetadata.assetSha256, 'ecd5cc32f7eceb11778e69ba568b56ba6f8261b929b91e880d80a0507e2c38c3', 'Fluorescent export must retain bundled asset SHA-256');
assert.ok(fluorescentReport.analysisLog.some((line) => line.includes('Source identity=Fluorescent tube — Philips MASTER TL5 HE 28W/830 (calibrated)')), 'Fluorescent PDF analysis log must preserve the human source identity');
assert.ok(source.includes("sv ? 'Källidentitet' : 'Source identity'"), 'PDF reproducibility table must contain source identity');
assert.ok(source.includes("sv ? 'Källtyp' : 'Source kind'"), 'PDF reproducibility table must contain source kind');
assert.ok(source.includes("sv ? 'Exempel-ID' : 'Sample ID'"), 'PDF reproducibility table must contain bundled sample ID');
assert.ok(source.includes("'SHA-256'"), 'PDF reproducibility table must expose bundled asset SHA-256');
assert.ok(source.includes("sv ? 'Proveniens' : 'Provenance'"), 'PDF reproducibility table must expose scientific provenance');

state.analysis.narrowLineOverlay = true;
state.analysis.rawTopHits = state.analysis.narrowLineCandidates.slice();
state.analysis.smartFindHits = state.analysis.narrowLineCandidates.slice();
const fluorescentOverlayBundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const fluorescentOverlayReport = context.SpectraPro.exportUi.buildPdfReportModel(fluorescentOverlayBundle);
assert.equal(fluorescentOverlayReport.matchedFeatureRows.length, 3, 'Enabling the Fluorescent visual overlay must not promote weak candidates into the deterministic PDF result table');
assert.equal(JSON.stringify(fluorescentOverlayReport.matchedFeatureRows), fluorescentRowsOverlayOff, 'Fluorescent deterministic matched-feature rows must be identical with overlay off or on');
assert.equal(JSON.stringify(fluorescentOverlayReport.analysisLog), fluorescentLogOverlayOff, 'Fluorescent deterministic PDF analysis log must be identical with overlay off or on');
assert.equal(fluorescentOverlayReport.matchedFeatureBasis, 'accepted-clear-narrow-line-hits', 'Overlay state must not change the report hit basis');
assert.ok(!JSON.stringify(fluorescentOverlayReport.matchedFeatureRows).includes('696.400'), 'Weak overlay-only candidates must not enter the deterministic PDF result table');

context.SpectraPro.aiAnalysisUi = null;
const noAiBundle = context.SpectraPro.exportUi.buildAnalysisBundle();
const noAiReport = context.SpectraPro.exportUi.buildPdfReportModel(noAiBundle);
assert.equal(noAiReport.aiInterpretation.included, false);
assert.equal(noAiReport.aiInterpretation.text, null);
assert.ok(noAiReport.abstract.length > 0, 'deterministic report must remain complete without AI');

assert.ok(source.includes('const reportModel = buildPdfReportModel(bundle);'));
assert.ok(source.includes('reportModel.aiInterpretation.disclaimer'));

console.log('PDF REPORT CONTRACT: deterministic summary, bounded narrative and separately labelled optional AI passed.');
