
(function (root) {
  'use strict';
  function scorePeaks(peaks, options) {
    const opts = Object.assign({
      maxPeaks: 24,
      // Relative threshold to suppress tiny noise maxima.
      minRelHeight: 0.06,
      minPeakDistancePx: 4
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

    // Prefer strong lines first, then perform simple non-maximum suppression
    // so nearby small ripples do not crowd out genuine but weaker distant lines.
    enriched.sort(function (a, b) { return (+b.value || 0) - (+a.value || 0); });
    const kept = [];
    const minDist = Math.max(1, Math.round(+opts.minPeakDistancePx || 1));
    for (let i = 0; i < enriched.length; i += 1) {
      const cand = enriched[i];
      const idx = Number(cand.index);
      let tooClose = false;
      for (let j = 0; j < kept.length; j += 1) {
        if (Math.abs(idx - Number(kept[j].index)) < minDist) { tooClose = true; break; }
      }
      if (!tooClose) kept.push(cand);
      if (kept.length >= Math.max(1, opts.maxPeaks)) break;
    }
    kept.sort(function (a, b) { return (+a.index || 0) - (+b.index || 0); });
    return kept;
  }
  root.SPECTRA_PRO_peakScoring = { scorePeaks };
})(typeof self !== 'undefined' ? self : this);
