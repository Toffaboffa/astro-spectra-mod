
(function (root) {
  'use strict';

  function percentile(values, q) {
    const arr = values.slice().sort(function (a, b) { return a - b; });
    if (!arr.length) return null;
    const pos = Math.max(0, Math.min(1, Number(q) || 0)) * (arr.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const t = pos - lo;
    return arr[lo] * (1 - t) + arr[hi] * t;
  }

  function median(values) {
    return percentile(values, 0.5);
  }

  function estimateNoise(values) {
    if (values.length < 9) return null;
    const residuals = values.map(function (value, index) {
      let sum = 0;
      let count = 0;
      for (let offset = -2; offset <= 2; offset += 1) {
        const sample = values[index + offset];
        if (!Number.isFinite(sample)) continue;
        sum += sample;
        count += 1;
      }
      return value - (count ? sum / count : value);
    });
    const absoluteResiduals = residuals.map(function (value) { return Math.abs(value); });
    const mad = median(absoluteResiduals);
    return Number.isFinite(mad) ? mad * 1.4826 : null;
  }

  function evaluateQC(ctx) {
    const flags = [];
    const source = ctx && ctx.frame && Array.isArray(ctx.frame.I) ? ctx.frame.I : [];
    const metrics = {
      sampleCount: source.length,
      validSampleCount: 0,
      validFraction: source.length ? 0 : null,
      min: null,
      max: null,
      dynamicRange: null,
      fullScale: null,
      saturationCount: 0,
      saturationFraction: null,
      noiseSigma: null,
      snr: null
    };
    if (source.length < 8) {
      flags.push('FRAME_TOO_SMALL');
      return { flags: flags, ok: false, metrics: metrics };
    }

    const values = source.map(Number).filter(Number.isFinite);
    metrics.validSampleCount = values.length;
    metrics.validFraction = values.length / source.length;
    if (values.length < 8 || values.length < source.length * 0.8) {
      flags.push('INVALID_SAMPLES');
      return { flags: flags, ok: false, metrics: metrics };
    }

    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const normalized = min >= -0.01 && max <= 1.01;
    const fullScale = normalized ? 1 : 255;
    const saturationThreshold = normalized ? 0.995 : (max >= 250 ? 250 : 254);
    const saturatedCount = values.filter(function (value) { return value >= saturationThreshold; }).length;
    metrics.min = min;
    metrics.max = max;
    metrics.fullScale = fullScale;
    metrics.saturationCount = saturatedCount;
    metrics.saturationFraction = saturatedCount / values.length;
    if (saturatedCount > 0) flags.push('SATURATION');

    const low = percentile(values, 0.05);
    const high = percentile(values, 0.95);
    const dynamicRange = Number(high) - Number(low);
    metrics.dynamicRange = dynamicRange;
    const minimumRange = fullScale * 0.002;
    if (!(dynamicRange > minimumRange)) {
      flags.push('NO_SIGNAL');
    } else {
      const noise = estimateNoise(values);
      const snr = Number.isFinite(noise) && noise > 0 ? dynamicRange / noise : null;
      metrics.noiseSigma = Number.isFinite(noise) ? noise : null;
      metrics.snr = Number.isFinite(snr) ? snr : null;
      if (Number.isFinite(snr) && snr < 3) flags.push('LOW_SNR');
    }
    return { flags: flags, ok: flags.length === 0, metrics: metrics };
  }
  root.SPECTRA_PRO_qcRules = { evaluateQC };
})(typeof self !== 'undefined' ? self : this);
