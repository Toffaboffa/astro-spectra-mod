
(function (root) {
  'use strict';
  function scorePeaks(peaks, options) {
    const opts = Object.assign({
      maxPeaks: 24,
      minRelHeight: 0.06,
      minPeakDistancePx: 4
    }, options || {});

    const arr = Array.isArray(peaks) ? peaks.slice() : [];
    if (!arr.length) return [];

    let maxProm = 0;
    let maxHeight = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i] || {};
      const prom = +p.prominence || 0;
      const h = +p.value || +p.height || 0;
      if (prom > maxProm) maxProm = prom;
      if (h > maxHeight) maxHeight = h;
    }
    if (maxProm <= 0) maxProm = maxHeight || 1;
    if (maxHeight <= 0) maxHeight = 1;
    const minProm = maxProm * opts.minRelHeight;

    const enriched = arr
      .map(function (p) {
        const prom = +p.prominence || 0;
        const h = +p.value || +p.height || 0;
        return Object.assign({
          prominence: prom,
          height: h,
          rankScore: (prom / maxProm) * 0.72 + (h / maxHeight) * 0.28
        }, p);
      })
      .filter(function (p) { return (+p.prominence || 0) >= minProm; });

    enriched.sort(function (a, b) {
      return (+b.rankScore || 0) - (+a.rankScore || 0) || (+b.prominence || 0) - (+a.prominence || 0);
    });

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
