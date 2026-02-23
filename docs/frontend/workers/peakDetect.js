
(function (root) {
  'use strict';
  function detectPeaks(intensity) {
    const peaks = [];
    if (!Array.isArray(intensity)) return peaks;
    for (let i = 1; i < intensity.length - 1; i += 1) {
      const a = +intensity[i - 1] || 0; const b = +intensity[i] || 0; const c = +intensity[i + 1] || 0;
      if (b > a && b >= c) peaks.push({ index: i, value: b });
    }
    return peaks;
  }
  root.SPECTRA_PRO_peakDetect = { detectPeaks };
})(typeof self !== 'undefined' ? self : this);
