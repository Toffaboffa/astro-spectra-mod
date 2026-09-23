(function (root) {
  'use strict';
  const MODEL = 'higher-order-diffraction-v1';

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function strength(feature) {
    const amplitude = finite(feature && feature.amplitude);
    if (amplitude !== null) return Math.max(0, amplitude);
    const prominence = finite(feature && feature.prominence);
    return prominence !== null ? Math.max(0, prominence) : 0;
  }

  function lineLike(feature, instrumentFwhmNm) {
    const width = finite(feature && feature.fwhmNm);
    if (width === null) return true;
    const instrument = finite(instrumentFwhmNm);
    const maximumWidth = Math.max(8, instrument !== null && instrument > 0 ? instrument * 4 : 8);
    return width <= maximumWidth;
  }

  function toleranceNm(result, options, order, parent, child) {
    const uncertainty = result && result.matchUncertaintyModel
      ? finite(result.matchUncertaintyModel.effectiveToleranceNm)
      : null;
    const instrument = options && options.hardware
      ? finite(options.hardware.spectrometerResolutionFwhmNm)
      : null;
    const parentUncertainty = finite(parent && parent.centerUncertaintyNm);
    const childUncertainty = finite(child && child.centerUncertaintyNm);
    let propagated = null;
    if (parentUncertainty !== null || childUncertainty !== null) {
      const pu = parentUncertainty !== null ? parentUncertainty : 0;
      const cu = childUncertainty !== null ? childUncertainty : 0;
      propagated = 3 * Math.sqrt(cu * cu + Math.pow(order * pu, 2));
    }
    let tolerance = 0.75;
    if (uncertainty !== null && uncertainty > 0) tolerance = Math.max(tolerance, uncertainty);
    if (instrument !== null && instrument > 0) tolerance = Math.max(tolerance, instrument * 0.85);
    if (propagated !== null && propagated > 0) tolerance = Math.max(tolerance, propagated);
    if (order >= 3) tolerance *= 1.15;
    return Math.min(order >= 3 ? 3.5 : 3.0, tolerance);
  }

  function candidateFor(parent, child, order, result, options, maxStrength) {
    const parentNm = finite(parent && parent.centerNm);
    const childNm = finite(child && child.centerNm);
    if (parentNm === null || childNm === null || !(parentNm > 0) || !(childNm > parentNm)) return null;

    const parentStrength = strength(parent);
    const childStrength = strength(child);
    if (!(parentStrength > 0) || !(childStrength > 0)) return null;
    if (parentStrength < Math.max(1e-9, maxStrength * 0.12)) return null;

    const strengthRatio = childStrength / parentStrength;
    if (!(strengthRatio < 0.9)) return null;

    const instrument = options && options.hardware ? finite(options.hardware.spectrometerResolutionFwhmNm) : null;
    if (!lineLike(parent, instrument) || !lineLike(child, instrument)) return null;

    const expectedNm = parentNm * order;
    const tolerance = toleranceNm(result, options, order, parent, child);
    const deltaNm = childNm - expectedNm;
    if (Math.abs(deltaNm) > tolerance) return null;

    const normalizedDelta = tolerance > 0 ? Math.abs(deltaNm) / tolerance : 1;
    const parentRelativeStrength = maxStrength > 0 ? Math.min(1, parentStrength / maxStrength) : 0;
    const geometryFit = Math.max(0, 1 - normalizedDelta);
    const evidence = geometryFit >= 0.6 && parentRelativeStrength >= 0.2 && strengthRatio <= 0.65
      ? 'strong'
      : 'moderate';

    return {
      model: MODEL,
      kind: 'possible-higher-order-diffraction',
      order: order,
      parentSampleIndex: Number.isFinite(Number(parent.sampleIndex)) ? Number(parent.sampleIndex) : null,
      childSampleIndex: Number.isFinite(Number(child.sampleIndex)) ? Number(child.sampleIndex) : null,
      parentNm: +parentNm.toFixed(4),
      observedNm: +childNm.toFixed(4),
      expectedNm: +expectedNm.toFixed(4),
      deltaNm: +deltaNm.toFixed(4),
      ratio: +(childNm / parentNm).toFixed(6),
      toleranceNm: +tolerance.toFixed(4),
      parentAmplitude: +parentStrength.toFixed(6),
      observedAmplitude: +childStrength.toFixed(6),
      strengthRatio: +strengthRatio.toFixed(4),
      geometryFit: +geometryFit.toFixed(4),
      evidence: evidence
    };
  }

  function analyze(result, frame, options) {
    if (!result || !result.ok) return result;
    result.diffractionModel = MODEL;
    result.diffractionCandidates = [];

    const context = String((options && options.analysisContext) || result.mode || 'lab').toLowerCase();
    if (context === 'astro' || result.mode === 'astro') return result;
    if (!(result.calibrated || (frame && frame.calibrated === true))) return result;

    const features = Array.isArray(result.features) ? result.features : [];
    const emission = features.filter(function (feature) {
      return feature &&
        String(feature.polarity || 'emission').toLowerCase() === 'emission' &&
        finite(feature.centerNm) !== null &&
        strength(feature) > 0;
    });
    if (emission.length < 2) return result;

    const maxStrength = emission.reduce(function (maximum, feature) {
      return Math.max(maximum, strength(feature));
    }, 0);
    if (!(maxStrength > 0)) return result;

    const byChild = Object.create(null);
    emission.forEach(function (parent) {
      emission.forEach(function (child) {
        if (parent === child) return;
        [2, 3].forEach(function (order) {
          const candidate = candidateFor(parent, child, order, result, options || {}, maxStrength);
          if (!candidate) return;
          const key = Number.isFinite(candidate.childSampleIndex)
            ? String(candidate.childSampleIndex)
            : candidate.observedNm.toFixed(4);
          const previous = byChild[key];
          if (!previous ||
              candidate.geometryFit > previous.geometryFit ||
              (candidate.geometryFit === previous.geometryFit && candidate.parentAmplitude > previous.parentAmplitude)) {
            byChild[key] = candidate;
          }
        });
      });
    });

    const candidates = Object.keys(byChild).map(function (key) { return byChild[key]; }).sort(function (a, b) {
      if (a.evidence !== b.evidence) return a.evidence === 'strong' ? -1 : 1;
      return (b.geometryFit - a.geometryFit) || (a.observedNm - b.observedNm);
    });
    result.diffractionCandidates = candidates;

    if (candidates.length) {
      const featureByIndex = Object.create(null);
      features.forEach(function (feature) {
        if (feature && Number.isFinite(Number(feature.sampleIndex))) featureByIndex[String(Number(feature.sampleIndex))] = feature;
      });
      candidates.forEach(function (candidate) {
        const child = featureByIndex[String(candidate.childSampleIndex)];
        if (!child) return;
        const flags = Array.isArray(child.qualityFlags) ? child.qualityFlags : (child.qualityFlags = []);
        const flag = 'POSSIBLE_DIFFRACTION_ORDER_' + candidate.order;
        if (flags.indexOf(flag) === -1) flags.push(flag);
        child.diffractionCandidate = {
          order: candidate.order,
          parentNm: candidate.parentNm,
          expectedNm: candidate.expectedNm,
          deltaNm: candidate.deltaNm,
          evidence: candidate.evidence
        };
        child.quality = 'limited';
      });
      const qcFlags = Array.isArray(result.qcFlags) ? result.qcFlags : (result.qcFlags = []);
      if (qcFlags.indexOf('POSSIBLE_HIGHER_ORDER_DIFFRACTION') === -1) qcFlags.push('POSSIBLE_HIGHER_ORDER_DIFFRACTION');
    }
    return result;
  }

  root.SPECTRA_PRO_diffractionArtifacts = { model: MODEL, analyze: analyze };
})(typeof self !== 'undefined' ? self : this);
