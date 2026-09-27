(function (root) {
  'use strict';

  const MODEL = 'instrument-resolution-v1';

  function finitePositive(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function median(values) {
    const clean = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!clean.length) return null;
    const middle = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
  }

  function measuredSampling(frame) {
    const nm = frame && Array.isArray(frame.nm) ? frame.nm.map(Number).filter(Number.isFinite) : [];
    if (nm.length < 2) return null;
    const steps = [];
    for (let index = 1; index < nm.length; index += 1) {
      const step = Math.abs(nm[index] - nm[index - 1]);
      if (step > 0) steps.push(step);
    }
    return finitePositive(median(steps));
  }

  function build(hardware, frame) {
    const hw = hardware && typeof hardware === 'object' ? hardware : {};
    const fwhm = finitePositive(hw.spectrometerResolutionFwhmNm);
    const calibratedSampling = measuredSampling(frame);
    const declaredSampling = finitePositive(hw.pixelResolutionNm);
    const sampling = calibratedSampling || declaredSampling;
    const effectiveFwhm = fwhm || (sampling ? sampling * 2 : null);
    const samplesPerFwhm = effectiveFwhm && sampling ? effectiveFwhm / sampling : null;
    const rayleighLikeSeparation = effectiveFwhm;
    const undersampled = samplesPerFwhm !== null ? samplesPerFwhm < 2 : null;

    return {
      model: MODEL,
      instrumentFwhmNm: fwhm,
      samplingNmPerPixel: sampling,
      samplingSource: calibratedSampling ? 'calibrated-frame' : (declaredSampling ? 'hardware-profile' : 'unavailable'),
      effectiveResolutionFwhmNm: effectiveFwhm,
      nominalResolvableSeparationNm: rayleighLikeSeparation,
      samplesPerFwhm: samplesPerFwhm === null ? null : +samplesPerFwhm.toFixed(4),
      undersampled: undersampled
    };
  }

  function annotateHits(hits, model) {
    const arr = Array.isArray(hits) ? hits.map(function (hit) { return Object.assign({}, hit); }) : [];
    const resolution = finitePositive(model && model.effectiveResolutionFwhmNm);
    if (!resolution || arr.length < 2) {
      return arr.map(function (hit) {
        hit.resolutionBlendRisk = false;
        hit.nearestAcceptedSeparationNm = null;
        return hit;
      });
    }

    return arr.map(function (hit, index) {
      const ref = Number(hit && hit.refNm);
      let nearest = null;
      if (Number.isFinite(ref)) {
        arr.forEach(function (other, otherIndex) {
          if (otherIndex === index) return;
          const otherRef = Number(other && other.refNm);
          if (!Number.isFinite(otherRef)) return;
          const separation = Math.abs(ref - otherRef);
          if (nearest === null || separation < nearest) nearest = separation;
        });
      }
      hit.nearestAcceptedSeparationNm = nearest === null ? null : +nearest.toFixed(6);
      hit.resolutionBlendRisk = nearest !== null && nearest < resolution;
      return hit;
    });
  }

  root.SPECTRA_PRO_instrumentResolution = {
    model: MODEL,
    build: build,
    annotateHits: annotateHits
  };
})(typeof self !== 'undefined' ? self : this);
