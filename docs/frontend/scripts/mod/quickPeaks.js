
(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function detectQuickPeaks(intensity, opts) {
    const options = Object.assign({ threshold: 0.1, distance: 3 }, opts || {});
    if (!Array.isArray(intensity) || intensity.length < 3) return [];
    const max = Math.max.apply(null, intensity);
    const minHeight = max * options.threshold;
    const out = [];
    for (let i = 1; i < intensity.length - 1; i += 1) {
      if (intensity[i] >= minHeight && intensity[i] > intensity[i - 1] && intensity[i] >= intensity[i + 1]) {
        if (out.length && i - out[out.length - 1].index < options.distance) {
          if (intensity[i] > out[out.length - 1].value) out[out.length - 1] = { index: i, value: intensity[i] };
        } else out.push({ index: i, value: intensity[i] });
      }
    }
    return out;
  }

  sp.quickPeaks = { detectQuickPeaks };
})(window);
