(function (root) {
  'use strict';

  function smoothSeries(values) {
    const n = Array.isArray(values) ? values.length : 0;
    if (!n) return [];
    const out = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const a = +values[Math.max(0, i - 2)] || 0;
      const b = +values[Math.max(0, i - 1)] || 0;
      const c = +values[i] || 0;
      const d = +values[Math.min(n - 1, i + 1)] || 0;
      const e = +values[Math.min(n - 1, i + 2)] || 0;
      out[i] = (a + 2 * b + 3 * c + 2 * d + e) / 9;
    }
    return out;
  }

  function detectPeaks(intensity, options) {
    const opts = Object.assign({ prominenceWindowPx: 8 }, options || {});
    const src = Array.isArray(intensity) ? intensity : [];
    const n = src.length;
    const peaks = [];
    if (n < 3) return peaks;

    const smooth = smoothSeries(src);
    const promWindow = Math.max(2, Math.min(48, Math.round(+opts.prominenceWindowPx || 8)));

    for (let i = 1; i < n - 1; i += 1) {
      const prev = +smooth[i - 1] || 0;
      const curr = +smooth[i] || 0;
      const next = +smooth[i + 1] || 0;
      if (!(curr > prev && curr >= next)) continue;

      let leftMin = curr;
      for (let j = Math.max(0, i - promWindow); j < i; j += 1) {
        const v = +smooth[j] || 0;
        if (v < leftMin) leftMin = v;
      }
      let rightMin = curr;
      for (let j = i + 1; j <= Math.min(n - 1, i + promWindow); j += 1) {
        const v = +smooth[j] || 0;
        if (v < rightMin) rightMin = v;
      }
      const base = Math.max(leftMin, rightMin);
      const prominence = Math.max(0, curr - base);
      peaks.push({
        index: i,
        value: +src[i] || curr,
        smoothedValue: curr,
        prominence: prominence,
        height: curr,
        baseline: base
      });
    }
    return peaks;
  }
  root.SPECTRA_PRO_peakDetect = { detectPeaks };
})(typeof self !== 'undefined' ? self : this);
