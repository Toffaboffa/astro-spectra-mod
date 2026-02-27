(function (root) {
  'use strict';

  function matchLines(observedPeaks, atomLines, options) {
    const opts = Object.assign({
      toleranceNm: 2.5,
      maxMatches: 12,
      preferredElements: null,
      elementBoost: null,
      maxPerPeak: 2,
      seededMatches: null
    }, options || {});
    const peaks = Array.isArray(observedPeaks) ? observedPeaks : [];
    const lines = Array.isArray(atomLines) ? atomLines : [];
    const out = [];
    const preferred = Array.isArray(opts.preferredElements) ? opts.preferredElements.map(String) : null;
    const boostMap = (opts.elementBoost && typeof opts.elementBoost === 'object') ? opts.elementBoost : null;
    const seen = Object.create(null);

    function pushMatch(m) {
      if (!m) return;
      const key = String(m.speciesKey || m.species || '') + '|' + Number(m.refNm).toFixed(3);
      if (seen[key]) return;
      seen[key] = true;
      out.push(m);
    }

    const seeded = Array.isArray(opts.seededMatches) ? opts.seededMatches : [];
    for (let i = 0; i < seeded.length; i += 1) pushMatch(seeded[i]);

    for (let i = 0; i < peaks.length; i += 1) {
      const p = peaks[i]; if (!p || !Number.isFinite(p.nm)) continue;
      const candidates = [];
      for (let j = 0; j < lines.length; j += 1) {
        const l = lines[j]; if (!Number.isFinite(l.nm)) continue;
        const d = Math.abs(l.nm - p.nm);
        if (d > opts.toleranceNm) continue;
        const el = String(l.element || '').trim();
        let bonus = boostMap && el && Number.isFinite(+boostMap[el]) ? +boostMap[el] : 0;
        if (preferred && preferred.length && el && preferred.indexOf(el) !== -1) bonus += 0.035;
        const prom = +p.prominence || 0;
        candidates.push({
          species: l.species,
          speciesKey: l.speciesKey || l.species,
          refNm: l.nm,
          obsNm: p.nm,
          deltaNm: +(p.nm - l.nm).toFixed(3),
          peakIndex: p.index,
          peakValue: p.value,
          prominence: prom,
          rawScore: Math.max(0, 1 - (d / opts.toleranceNm)) + bonus + Math.min(0.08, prom / 2000),
          element: el
        });
      }
      candidates.sort(function (a, b) {
        return (+b.rawScore || 0) - (+a.rawScore || 0) || Math.abs(+a.deltaNm || 0) - Math.abs(+b.deltaNm || 0);
      });
      const limit = Math.max(1, Math.min(4, Math.round(+opts.maxPerPeak || 1)));
      for (let k = 0; k < candidates.length && k < limit; k += 1) pushMatch(candidates[k]);
    }

    out.sort(function (a, b) {
      return (+b.rawScore || 0) - (+a.rawScore || 0) || (+b.prominence || 0) - (+a.prominence || 0);
    });
    return out.slice(0, opts.maxMatches);
  }
  root.SPECTRA_PRO_lineMatcher = { matchLines };
})(typeof self !== 'undefined' ? self : this);
