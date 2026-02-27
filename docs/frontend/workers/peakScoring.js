
(function (root) {
  'use strict';
  function scorePeaks(peaks, options) {
    const opts = Object.assign({
      maxPeaks: 24,
      // Relative threshold to suppress tiny noise maxima.
      minRelHeight: 0.06
    }, options || {});

    const arr = Array.isArray(peaks) ? peaks.slice() : [];
    if (!arr.length) return [];

    // Determine a simple scale for thresholding.
    let maxV = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const v = +arr[i].value || 0;
      if (v > maxV) maxV = v;
    }
    const minV = maxV * opts.minRelHeight;

    // Enrich peaks with a usable prominence proxy.
    const enriched = arr
      .map(function (p) {
        const v = +p.value || 0;
        return Object.assign({
          prominence: v,
          height: v
        }, p);
      })
      .filter(function (p) { return (+p.value || 0) >= minV; });

    // Prefer strong lines first.
    enriched.sort(function (a, b) { return (+b.value || 0) - (+a.value || 0); });

    return enriched.slice(0, Math.max(1, opts.maxPeaks));
  }
  root.SPECTRA_PRO_peakScoring = { scorePeaks };
})(typeof self !== 'undefined' ? self : this);
