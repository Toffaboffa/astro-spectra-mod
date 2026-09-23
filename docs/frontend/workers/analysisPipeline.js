(function (root) {
  'use strict';

  function analyzeFrame(frame, state, options) {
    if (String(options && options.analysisContext || '').toLowerCase() === 'astro') {
      const astroAnalysis = root.SPECTRA_PRO_astroAnalysis;
      if (!astroAnalysis || typeof astroAnalysis.analyzeFrame !== 'function') {
        return { ok: false, error: 'astro-analysis-missing-deps' };
      }
      return astroAnalysis.analyzeFrame(frame, state, options);
    }
    const candidateAnalysis = root.SPECTRA_PRO_candidateAnalysis;
    if (!candidateAnalysis || typeof candidateAnalysis.analyzeFrame !== 'function') {
      return { ok: false, error: 'analysis-missing-deps' };
    }
    return candidateAnalysis.analyzeFrame(frame, state, options);
  }

  function finalizeResult(result, frame, options) {
    const calibrationDiagnostics = root.SPECTRA_PRO_calibrationDiagnostics;
    if (!result || !result.ok) return result;
    if (calibrationDiagnostics && result.matchUncertaintyModel) {
      result.topHits = (Array.isArray(result.topHits) ? result.topHits : []).map(function (hit) {
        return calibrationDiagnostics.annotateHit(hit, result.matchUncertaintyModel, result.calibrationDiagnostics, frame);
      });
      result.overlayHits = (Array.isArray(result.overlayHits) ? result.overlayHits : []).map(function (hit) {
        return calibrationDiagnostics.annotateHit(hit, result.matchUncertaintyModel, result.calibrationDiagnostics, frame);
      });
      if (result.astro && typeof result.astro === 'object') {
        result.astro.referenceMatches = result.topHits.slice();
      }
    }
    const diffractionArtifacts = root.SPECTRA_PRO_diffractionArtifacts;
    if (diffractionArtifacts && typeof diffractionArtifacts.analyze === 'function') {
      result = diffractionArtifacts.analyze(result, frame, options || {});
    }
    const measurementQuality = root.SPECTRA_PRO_measurementQuality;
    if (measurementQuality && typeof measurementQuality.build === 'function') {
      result.measurementQuality = measurementQuality.build(result, frame, options || {});
    }
    const stellarClassification = root.SPECTRA_PRO_stellarClassification;
    if (result.mode === 'astro' && result.astro && stellarClassification && typeof stellarClassification.assess === 'function') {
      result.astro.stellarClassification = stellarClassification.assess(result, frame, options || {});
    }
    const referenceComparison = root.SPECTRA_PRO_referenceComparison;
    const comparisonOptions = options && options.referenceComparison;
    if (referenceComparison && typeof referenceComparison.compare === 'function' && comparisonOptions && comparisonOptions.enabled) {
      result.referenceComparison = referenceComparison.compare(
        frame,
        comparisonOptions.reference,
        {
          normalization: comparisonOptions.normalization,
          alignmentMode: comparisonOptions.alignmentMode,
          manualShiftNm: comparisonOptions.manualShiftNm,
          maxAutoShiftNm: comparisonOptions.maxAutoShiftNm,
          autoStepNm: comparisonOptions.autoStepNm,
          resolutionFwhmNm: options && options.hardware && options.hardware.spectrometerResolutionFwhmNm
        }
      );
    } else {
      result.referenceComparison = null;
    }
    return result;
  }

  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame: analyzeFrame, finalizeResult: finalizeResult };
})(typeof self !== 'undefined' ? self : this);
