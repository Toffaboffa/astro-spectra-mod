(function (root) {
  'use strict';

  function analyzeFrame(frame, state, options) {
    const continuumEngine = root.SPECTRA_PRO_astroContinuum;
    const featureEngine = root.SPECTRA_PRO_spectralFeatures;
    const references = root.SPECTRA_PRO_astroReferences;
    const matcher = root.SPECTRA_PRO_lineMatcher;
    const diagnosticsEngine = root.SPECTRA_PRO_calibrationDiagnostics;
    const dopplerEstimate = root.SPECTRA_PRO_dopplerEstimate;
    const qcRules = root.SPECTRA_PRO_qcRules;
    if (!frame || !Array.isArray(frame.I) || !continuumEngine || !featureEngine || !references || !matcher || !diagnosticsEngine || !dopplerEstimate || !qcRules) {
      return { ok: false, error: 'astro-analysis-missing-deps' };
    }

    const opt = options && typeof options === 'object' ? options : {};
    const astroOptions = opt.astro && typeof opt.astro === 'object' ? opt.astro : {};
    const continuum = continuumEngine.estimate(frame, astroOptions.continuum || {});
    const calibrated = frame.calibrated === true && Array.isArray(frame.nm) && frame.nm.length === frame.I.length;
    const usableNormalized = continuum.normalized.length === frame.I.length && continuum.normalized.every(Number.isFinite);
    const normalizedFrame = {
      I: usableNormalized ? continuum.normalized : [],
      processedI: usableNormalized ? continuum.normalized : [],
      nm: calibrated ? frame.nm : null,
      px: Array.isArray(frame.px) ? frame.px : null,
      calibrated: calibrated
    };
    const detectedFeatures = usableNormalized ? featureEngine.detectFeatures(normalizedFrame, {
      polarity: 'absorption',
      smoothingRadiusPx: Math.max(0, Math.round(Number(astroOptions.featureSmoothingRadiusPx) || 1)),
      windowRadiusPx: Math.max(6, Math.round(Number(astroOptions.featureWindowRadiusPx) || 10)),
      minProminenceRel: Math.max(0.01, Number(astroOptions.minProminenceRel) || 0.04),
      minProminence: Math.max(0, Number(astroOptions.minDepth) || 0.01),
      minDistancePx: Math.max(2, Math.round(Number(astroOptions.minDistancePx) || 3))
    }).filter(function (feature) {
      return feature && feature.polarity === 'absorption' && Number(feature.depth) >= Math.max(0.01, Number(astroOptions.minDepth) || 0.01);
    }) : [];
    // Dense reference spectra can contain hundreds of shallow lines. Keep the
    // strongest bounded set across the full wavelength range instead of the
    // first 96 samples, which would otherwise bias matches toward the blue end.
    const features = detectedFeatures.length > 96
      ? detectedFeatures.slice().sort(function (a, b) { return Number(b.depth) - Number(a.depth); }).slice(0, 96).sort(function (a, b) { return a.sampleIndex - b.sampleIndex; })
      : detectedFeatures;

    const calibrationDiagnostics = diagnosticsEngine.evaluate(opt.calibration || frame.calibration || null, frame);
    const requestedCap = Math.max(0.2, Math.min(5, Number(opt.maxDistanceNm) || 1.8));
    const matchUncertaintyModel = diagnosticsEngine.createMatchingModel(
      calibrationDiagnostics,
      opt.hardware || frame.hardware || null,
      features,
      requestedCap,
      requestedCap
    );
    const observed = features.filter(function (feature) { return Number.isFinite(feature.centerNm); }).map(function (feature) {
      return { index: feature.sampleIndex, nm: feature.centerNm, value: feature.depth, prominence: feature.depth };
    });
    const rawMatches = calibrated ? matcher.matchLines(observed, references.lines, {
      toleranceNm: requestedCap,
      hardMaxDistanceNm: matchUncertaintyModel.effectiveToleranceNm,
      maxMatches: 48,
      maxPerPeak: 2
    }) : [];
    const featureByIndex = Object.create(null);
    features.forEach(function (feature) { featureByIndex[String(feature.sampleIndex)] = feature; });
    const referenceByNm = Object.create(null);
    references.lines.forEach(function (line) { referenceByNm[Number(line.nm).toFixed(6)] = line; });
    const topHits = rawMatches.map(function (match) {
      const feature = featureByIndex[String(match.peakIndex)] || null;
      const reference = referenceByNm[Number(match.refNm).toFixed(6)] || null;
      return {
        referenceId: reference ? reference.id : null,
        label: reference ? reference.label : match.speciesKey,
        family: reference ? reference.family : null,
        species: match.species,
        speciesKey: match.speciesKey,
        element: match.element,
        referenceNm: match.refNm,
        observedNm: match.obsNm,
        peakIndex: match.peakIndex,
        deltaNm: match.deltaNm,
        score: +(Math.max(0, Math.min(1, Number(match.rawScore) || 0)) * 100).toFixed(1),
        kind: 'astro-absorption',
        depth: feature ? feature.depth : null,
        fwhmNm: feature ? feature.fwhmNm : null,
        equivalentWidthNm: feature ? feature.equivalentWidthNm : null,
        snr: feature ? feature.snr : null,
        featureQuality: feature ? feature.quality : 'unavailable',
        featureQualityFlags: feature && Array.isArray(feature.qualityFlags) ? feature.qualityFlags.slice() : [],
        centerUncertaintyNm: feature ? feature.centerUncertaintyNm : null
      };
    });
    const radialVelocity = dopplerEstimate.estimate(topHits, {
      calibrationDiagnostics: calibrationDiagnostics,
      matchUncertaintyModel: matchUncertaintyModel
    });
    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    if (!calibrated) qc.flags = (qc.flags || []).concat(['uncalibrated']);

    const responseCorrected = !!(frame && frame.preprocessing && frame.preprocessing.responseCorrection && frame.preprocessing.responseCorrection.applied);
    return {
      ok: true,
      mode: 'astro',
      presetId: 'astro-absorption',
      calibrated: calibrated,
      continuum: continuum,
      features: features,
      absorptionFeatures: features,
      topHits: topHits,
      overlayHits: topHits.slice(),
      qcFlags: qc.flags || [],
      preprocessing: frame.preprocessing && typeof frame.preprocessing === 'object' ? frame.preprocessing : null,
      calibrationDiagnostics: calibrationDiagnostics,
      matchUncertaintyModel: matchUncertaintyModel,
      hardMatchCapNm: requestedCap,
      astro: {
        model: 'astro-absorption-analysis-v1',
        continuum: continuum,
        absorptionFeatures: features,
        referenceMatches: topHits,
        radialVelocity: radialVelocity,
        referenceSet: {
          id: references.id,
          wavelengthMedium: references.wavelengthMedium,
          source: references.source,
          sourceUrl: references.sourceUrl,
          sourceUrls: references.sourceUrls.slice(),
          lineCount: references.lines.length
        },
        limitations: [
          calibrated ? null : 'wavelength-calibration-required-for-reference-matching',
          'reference-match-is-not-a-stellar-classification',
          'radial-velocity-is-not-barycentric-or-heliocentric-corrected',
          responseCorrected ? 'response-correction-is-relative-not-absolute-radiometry' : 'continuum-shape-requires-instrument-response-context'
        ].filter(Boolean)
      }
    };
  }

  root.SPECTRA_PRO_astroAnalysis = { analyzeFrame: analyzeFrame };
})(typeof self !== 'undefined' ? self : this);
