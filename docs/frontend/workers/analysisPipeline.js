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

  const PRIMARY_EVIDENCE_GATE_MODEL = 'primary-evidence-gate-v1';

  function finite(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function candidateKey(row) {
    return String(row && (row.element || row.species || row.speciesKey || row.name) || '').trim();
  }

  function hitMatchesCandidate(hit, key) {
    const candidate = String(key || '').trim();
    if (!candidate || !hit) return false;
    const direct = String(hit.element || hit.speciesKey || hit.species || hit.name || '').trim();
    if (direct === candidate) return true;
    return String(hit.element || '').trim() === candidate;
  }

  function hitWavelength(hit) {
    const observed = finite(hit && hit.observedNm);
    if (observed !== null) return observed;
    return finite(hit && hit.referenceNm);
  }

  function anchorRange(diagnostics) {
    const source = diagnostics && diagnostics.anchorWavelengthCoverageNm;
    const min = finite(source && source.min);
    const max = finite(source && source.max);
    return min !== null && max !== null ? { min: Math.min(min, max), max: Math.max(min, max) } : null;
  }

  function hitInsideAnchors(hit, diagnostics) {
    if (hit && hit.extrapolated === true) return false;
    if (hit && hit.extrapolated === false) return true;
    const range = anchorRange(diagnostics);
    const wavelength = hitWavelength(hit);
    return range && wavelength !== null ? wavelength >= range.min && wavelength <= range.max : null;
  }

  function independentEvidenceCount(hits, resolutionModel) {
    const wavelengths = (Array.isArray(hits) ? hits : []).map(hitWavelength).filter(function (value) {
      return value !== null;
    });
    const resolution = root.SPECTRA_PRO_instrumentResolution;
    if (resolution && typeof resolution.independentEvidenceCount === 'function') {
      return resolution.independentEvidenceCount(wavelengths, resolutionModel);
    }
    const unique = Object.create(null);
    wavelengths.forEach(function (value) { unique[value.toFixed(3)] = true; });
    return Object.keys(unique).length;
  }

  function qualifyPrimaryEvidence(result) {
    const output = result || {};
    const rows = Array.isArray(output.elementScores) ? output.elementScores : [];
    const winner = rows[0] || null;
    const breakdown = output.winnerBreakdown && typeof output.winnerBreakdown === 'object' ? output.winnerBreakdown : null;
    if (!winner || !breakdown) return null;

    const key = candidateKey(winner) || String(breakdown.primaryEmitter || '').trim();
    const evidenceModel = String(winner.evidenceModel || breakdown.evidenceModel || '');
    const atomicApplicable = String(winner.mode || '').toLowerCase() === 'atomic' || evidenceModel.indexOf('atomic-fingerprint') !== -1;
    const base = {
      model: PRIMARY_EVIDENCE_GATE_MODEL,
      applicable: atomicApplicable,
      candidate: key || null,
      reportable: true,
      reason: atomicApplicable ? 'coherent-multi-line-evidence' : 'not-atomic-fingerprint-candidate',
      acceptedHitCount: 0,
      independentEvidenceCount: 0,
      inAnchorHitCount: null,
      inAnchorIndependentEvidenceCount: null,
      extrapolatedHitCount: 0,
      diagnosticMatchedPeaks: Math.max(0, Number(winner.diagnosticMatchedPeaks) || 0),
      diagnosticExpected: Math.max(0, Number(winner.diagnosticExpected) || 0),
      scoreSharePct: Math.max(0, Number(winner.scoreSharePct != null ? winner.scoreSharePct : winner.likelyPct) || 0),
      anchorRangeNm: anchorRange(output.calibrationDiagnostics),
      mainLimitation: output.measurementQuality && output.measurementQuality.mainLimitation
        ? {
            code: String(output.measurementQuality.mainLimitation.code || ''),
            status: String(output.measurementQuality.mainLimitation.status || ''),
            reason: String(output.measurementQuality.mainLimitation.reason || '')
          }
        : null,
      requirements: {
        minimumAcceptedHits: 2,
        minimumIndependentEvidence: 2,
        minimumInAnchorIndependentEvidence: 2,
        minimumDiagnosticMatches: 1
      }
    };
    if (!atomicApplicable) return base;

    const hits = (Array.isArray(output.topHits) ? output.topHits : []).filter(function (hit) {
      return hit && hit.excludedFromScoring !== true && hitMatchesCandidate(hit, key);
    });
    const extrapolated = hits.filter(function (hit) { return hitInsideAnchors(hit, output.calibrationDiagnostics) === false; });
    const anchorKnown = !!base.anchorRangeNm || hits.some(function (hit) { return typeof hit.extrapolated === 'boolean'; });
    const inAnchor = anchorKnown ? hits.filter(function (hit) { return hitInsideAnchors(hit, output.calibrationDiagnostics) === true; }) : [];

    base.acceptedHitCount = hits.length;
    base.independentEvidenceCount = independentEvidenceCount(hits, output.instrumentResolutionModel);
    base.extrapolatedHitCount = extrapolated.length;
    if (anchorKnown) {
      base.inAnchorHitCount = inAnchor.length;
      base.inAnchorIndependentEvidenceCount = independentEvidenceCount(inAnchor, output.instrumentResolutionModel);
    }

    const main = base.mainLimitation;
    if (main && main.status === 'poor' && (main.code === 'signal' || main.code === 'saturation')) {
      base.reportable = false;
      base.reason = 'measurement-quality-' + main.code;
      return base;
    }
    if (hits.length < 2) {
      base.reportable = false;
      base.reason = hits.length === 1 && extrapolated.length === 1
        ? 'single-line-evidence-in-calibration-extrapolation'
        : (hits.length === 1 ? 'single-line-evidence' : 'no-accepted-primary-evidence');
      return base;
    }
    if (base.independentEvidenceCount < 2) {
      base.reportable = false;
      base.reason = 'insufficient-independent-primary-evidence';
      return base;
    }
    if (anchorKnown && Number(base.inAnchorIndependentEvidenceCount) < 2) {
      base.reportable = false;
      base.reason = 'insufficient-in-anchor-primary-evidence';
      return base;
    }
    if (base.diagnosticMatchedPeaks < 1) {
      base.reportable = false;
      base.reason = 'no-diagnostic-primary-evidence';
      return base;
    }
    return base;
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
    const instrumentResolution = root.SPECTRA_PRO_instrumentResolution;
    if (instrumentResolution && typeof instrumentResolution.build === 'function') {
      result.instrumentResolutionModel = instrumentResolution.build(options && options.hardware || frame && frame.hardware || null, frame);
      if (typeof instrumentResolution.annotateHits === 'function') {
        result.topHits = instrumentResolution.annotateHits(result.topHits, result.instrumentResolutionModel);
        result.overlayHits = instrumentResolution.annotateHits(result.overlayHits, result.instrumentResolutionModel);
        if (result.astro && typeof result.astro === 'object') result.astro.referenceMatches = result.topHits.slice();
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
    const primaryEvidence = qualifyPrimaryEvidence(result);
    if (primaryEvidence && result.winnerBreakdown && typeof result.winnerBreakdown === 'object') {
      result.winnerBreakdown = Object.assign({}, result.winnerBreakdown, { primaryEvidence: primaryEvidence });
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

  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame: analyzeFrame, finalizeResult: finalizeResult, qualifyPrimaryEvidence: qualifyPrimaryEvidence, primaryEvidenceGateModel: PRIMARY_EVIDENCE_GATE_MODEL };
})(typeof self !== 'undefined' ? self : this);
