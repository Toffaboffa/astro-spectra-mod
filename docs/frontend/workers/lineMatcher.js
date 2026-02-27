(function (root) {
  'use strict';
  function matchLines(observedPeaks, atomLines, options) {
    const opts = Object.assign({ toleranceNm: 2.5, maxMatches: 12, preferredElements: null, elementBoost: null }, options || {});
    const peaks = Array.isArray(observedPeaks) ? observedPeaks : [];
    const lines = Array.isArray(atomLines) ? atomLines : [];
    const out = [];
    const preferred = Array.isArray(opts.preferredElements) ? opts.preferredElements.map(String) : null;
    const boostMap = (opts.elementBoost && typeof opts.elementBoost === 'object') ? opts.elementBoost : null;
    for (let i = 0; i < peaks.length; i += 1) {
      const p = peaks[i]; if (!p || !Number.isFinite(p.nm)) continue;
      let best = null;
      for (let j = 0; j < lines.length; j += 1) {
        const l = lines[j]; if (!Number.isFinite(l.nm)) continue;
        // Optional filtering: keep only preferred elements (useful for lamp/known-source presets).
        if (preferred && preferred.length) {
          const el = String(l.element || '').trim();
          if (!el || preferred.indexOf(el) === -1) continue;
        }
        const d = Math.abs(l.nm - p.nm);
        if (d > opts.toleranceNm) continue;
        if (!best || d < best.deltaNm) best = { line:l, deltaNm:d };
      }
      if (best) {
        const el = String(best.line.element || '').trim();
        const bonus = boostMap && el && Number.isFinite(+boostMap[el]) ? +boostMap[el] : 0;
        out.push({
          species: best.line.species,
          speciesKey: best.line.speciesKey || best.line.species,
          refNm: best.line.nm,
          obsNm: p.nm,
          deltaNm: +(p.nm - best.line.nm).toFixed(3),
          peakIndex: p.index,
          peakValue: p.value,
          prominence: p.prominence || 0,
          rawScore: Math.max(0, 1 - (best.deltaNm / opts.toleranceNm)) + bonus
        });
      }
    }
    // Sort by (distance score + optional element bonus) and a tiny prominence tie-break.
    out.sort((a,b)=>(b.rawScore+b.prominence*0.002)-(a.rawScore+a.prominence*0.002));
    return out.slice(0, opts.maxMatches);
  }
  root.SPECTRA_PRO_lineMatcher = { matchLines };
})(typeof self !== 'undefined' ? self : this);
