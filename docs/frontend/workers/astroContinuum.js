(function (root) {
  'use strict';

  const math = root.SPECTRA_PRO_spectrumMath;
  const MODEL = 'astro-continuum-v1';
  if (!math) return;

  function sourceValues(frame) {
    if (!frame || typeof frame !== 'object') return [];
    if (Array.isArray(frame.processedI) && Array.isArray(frame.I) && frame.processedI.length === frame.I.length) {
      return frame.processedI;
    }
    return Array.isArray(frame.I) ? frame.I : [];
  }

  function movingAverage(values, radius) {
    const r = Math.max(0, Math.floor(Number(radius) || 0));
    if (!r) return values.slice();
    const prefix = [0];
    for (let index = 0; index < values.length; index += 1) prefix.push(prefix[index] + values[index]);
    return values.map(function (_, index) {
      const low = Math.max(0, index - r);
      const high = Math.min(values.length - 1, index + r);
      return (prefix[high + 1] - prefix[low]) / (high - low + 1);
    });
  }

  function estimate(frame, options) {
    const values = sourceValues(frame).map(Number);
    if (values.length < 12 || values.some(function (value) { return !Number.isFinite(value); })) {
      return {
        model: MODEL,
        state: 'unavailable',
        method: 'rolling-upper-quantile',
        rawIntensity: values,
        continuum: [],
        normalized: [],
        warnings: ['insufficient-or-invalid-samples']
      };
    }

    const opts = options && typeof options === 'object' ? options : {};
    const quantile = math.clamp(Number(opts.quantile) || 0.82, 0.65, 0.95);
    const defaultRadius = Math.max(6, Math.min(48, Math.round(values.length / 28)));
    const radius = Math.max(4, Math.min(96, Math.round(Number(opts.windowRadiusPx) || defaultRadius)));
    const envelope = values.map(function (_, index) {
      return math.percentile(values.slice(Math.max(0, index - radius), Math.min(values.length, index + radius + 1)), quantile);
    });
    const continuum = movingAverage(envelope, Math.max(2, Math.round(radius / 3)));
    const scale = Math.max.apply(null, values.map(function (value) { return Math.abs(value); }));
    const epsilon = Math.max(1e-12, scale * 1e-9);
    const responseCorrected = !!(frame && frame.preprocessing && frame.preprocessing.responseCorrection && frame.preprocessing.responseCorrection.applied);
    const warnings = [];
    let invalidContinuum = 0;
    const normalized = values.map(function (value, index) {
      const baseline = continuum[index];
      if (!Number.isFinite(baseline) || Math.abs(baseline) <= epsilon) {
        invalidContinuum += 1;
        return null;
      }
      return value / baseline;
    });
    if (invalidContinuum) warnings.push('continuum-near-zero');
    warnings.push(responseCorrected ? 'response-corrected-relative-shape-not-absolute-radiometry' : 'relative-shape-only-unless-instrument-response-corrected');

    return {
      model: MODEL,
      state: invalidContinuum ? 'limited' : 'available',
      method: 'rolling-upper-quantile',
      assumptions: [
        'continuum-varies-more-slowly-than-absorption-features',
        'upper-local-quantile-contains-continuum-samples',
        responseCorrected ? 'continuum-shape-is-response-corrected-but-remains-relative' : 'continuum-shape-is-relative-without-response-correction'
      ],
      wavelengthNm: frame && Array.isArray(frame.nm) && frame.nm.length === values.length ? frame.nm.slice() : null,
      rawIntensity: values,
      continuum: continuum.map(function (value) { return +value.toFixed(8); }),
      normalized: normalized.map(function (value) { return Number.isFinite(value) ? +value.toFixed(8) : null; }),
      windowRadiusPx: radius,
      quantile: quantile,
      warnings: warnings
    };
  }

  root.SPECTRA_PRO_astroContinuum = { model: MODEL, estimate: estimate };
})(typeof self !== 'undefined' ? self : this);
