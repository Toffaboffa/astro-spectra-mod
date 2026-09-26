import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { console, setTimeout, clearTimeout };
context.window = context;
context.SpectraPro = {
  version: '3.0.1',
  store: {
    getState() {
      return state;
    }
  }
};

const state = {
  appMode: 'ASTRO',
  frame: {
    source: 'solar-example',
    provenance: {
      kind: 'bundled-example',
      sampleId: 'solar-tsis1-hsrs',
      sampleKind: 'numeric',
      sourceLabel: 'Solar spectrum — TSIS-1 HSRS (calibrated)',
      sourceLabelEn: 'Solar spectrum — TSIS-1 HSRS (calibrated)',
      sourceLabelSv: 'Solspektrum — TSIS-1 HSRS (kalibrerat)',
      assetId: 'solar-tsis1-hsrs-visible',
      assetPath: '../data/examples/solar-tsis1-hsrs-visible-0p2nm.json',
      scientificRole: 'measured-reference-spectrum',
      scientificProvenance: {
        provider: 'LASP, University of Colorado Boulder',
        dataset: 'TSIS-1 Hybrid Solar Reference Spectrum (HSRS)'
      }
    },
    latest: { source: 'solar-example', px: [0, 1, 2], nm: [480, 486.2, 492], I: [10, 6, 9], processedI: [1, 0.6, 0.9], normalizedI: [1, 0.75, 1] }
  },
  calibration: { isCalibrated: true, points: [{ px: 0, nm: 480 }, { px: 2, nm: 492 }], coefficients: [480, 6] },
  preprocessing: { responseCorrection: { enabled: true, profileId: 'test-profile', maxCorrectionFactor: 5 }, baselineMode: 'continuum', normalizationMode: 'continuum' },
  analysis: {
    resultContext: 'astro', presetId: null,
    detectedPeaks: [], detectedPeakCount: null,
    calibrationDiagnostics: { status: 'usable', rmsResidualNm: 0.12, maxAbsResidualNm: 0.2 },
    matchUncertaintyModel: { calibrationRmsNm: 0.12, samplingNmPerPx: 0.2 }, hardMatchCapNm: 1.8,
    preprocessing: { schema: 'spectra-pro-preprocessing/v1', intensityBasis: 'response-corrected-relative-intensity', activeOperations: ['instrument-response'], responseCorrection: { enabled: true, applied: true, profileId: 'test-profile' } },
    measurementQuality: { model: 'measurement-quality-v1', overallStatus: 'moderate', mainLimitation: { code: 'resolution', status: 'moderate', reason: 'Limited resolution.' } },
    features: [{ centerNm: 486.2, polarity: 'absorption', equivalentWidthNm: -0.3 }],
    topHits: [], rawTopHits: [], elementScores: [], winnerBreakdown: null, fluorescenceSummary: null, narrowLineCandidates: [], qcFlags: ['resolution-limited'],
    astro: {
      continuum: { state: 'available', method: 'rolling-upper-quantile' },
      absorptionFeatures: [{ centerNm: 486.2, equivalentWidthNm: -0.3 }],
      referenceMatches: [{ label: 'H-beta', observedNm: 486.2, referenceNm: 486.13 }],
      radialVelocity: { state: 'available', velocityKmS: 43.2, uncertaintyKmS: 18.4, corrections: { barycentric: false, heliocentric: false } },
      stellarClassification: { state: 'available', bestClass: 'G', evidenceStrength: 'limited' }
    },
    referenceComparison: { state: 'available', alignment: { mode: 'manual', shiftNm: 0.1, radialVelocityMeasurement: false } }
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exportUi.js'), 'utf8'), context, { filename: 'exportUi.js' });
context.document = { getElementById() { return null; } };
const bundle = context.SpectraPro.exportUi.buildAnalysisBundle();

assert.equal(bundle.schema, 'spectra-pro-export/v2');
assert.equal(bundle.scientificAnalysis.context.resultContext, 'astro');
assert.equal(bundle.scientificAnalysis.calibration.diagnostics.rmsResidualNm, 0.12);
assert.equal(bundle.scientificAnalysis.preprocessing.result.intensityBasis, 'response-corrected-relative-intensity');
assert.equal(bundle.scientificAnalysis.instrumentResponse.result.applied, true);
assert.equal(bundle.scientificAnalysis.measurementQuality.overallStatus, 'moderate');
assert.equal(bundle.scientificAnalysis.detectedPeakCount, null, 'result types without emission-peak data must keep peak count unavailable instead of coercing null to zero');
assert.equal(bundle.scientificAnalysis.lab.offsetNm, null, 'result types without a line-match offset must not coerce an unavailable offset to zero');
assert.equal(bundle.scientificAnalysis.lab.rawMatchOffsetNm, null, 'result types without raw matcher residuals must keep raw offset unavailable');
assert.equal(bundle.scientificAnalysis.detectedFeatures[0].polarity, 'absorption');
assert.equal(bundle.scientificAnalysis.astro.radialVelocity.uncertaintyKmS, 18.4);
assert.equal(bundle.scientificAnalysis.astro.stellarClassification.bestClass, 'G');
assert.equal(bundle.scientificAnalysis.referenceComparison.alignment.radialVelocityMeasurement, false);
assert.deepEqual(Array.from(bundle.spectrumData.nm), [480, 486.2, 492]);
assert.equal(bundle.sourceMetadata.kind, 'bundled-example', 'JSON export must preserve source provenance kind');
assert.equal(bundle.sourceMetadata.sampleId, 'solar-tsis1-hsrs', 'JSON export must preserve bundled sample identity');
assert.equal(bundle.sourceMetadata.sourceLabel, 'Solar spectrum — TSIS-1 HSRS (calibrated)', 'JSON export must preserve canonical source label');
assert.equal(bundle.sourceMetadata.scientificProvenance.dataset, 'TSIS-1 Hybrid Solar Reference Spectrum (HSRS)', 'JSON export must preserve scientific provenance metadata');
assert.equal(bundle.frameSummary.sampleId, 'solar-tsis1-hsrs', 'frameSummary must expose sample identity for reproducibility');
assert.equal(bundle.frameSummary.sourceLabel, 'Solar spectrum — TSIS-1 HSRS (calibrated)', 'frameSummary must expose source identity');
assert.equal(bundle.frameSummary.assetId, 'solar-tsis1-hsrs-visible', 'frameSummary must expose source asset identity');

bundle.scientificAnalysis.detectedFeatures[0].centerNm = 999;
assert.equal(state.analysis.features[0].centerNm, 486.2, 'export must be detached from live state');
bundle.sourceMetadata.scientificProvenance.dataset = 'mutated';
assert.equal(state.frame.provenance.scientificProvenance.dataset, 'TSIS-1 Hybrid Solar Reference Spectrum (HSRS)', 'exported source provenance must be detached from live state');

console.log('Export reproducibility regression: explicit scientific snapshot and detached numeric data passed.');
