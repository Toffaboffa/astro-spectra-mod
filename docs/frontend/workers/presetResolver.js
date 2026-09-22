(function (root) {
  'use strict';

  const aliases = {
    general: 'nearest',
    'general-wide': 'wide',
    'general-tight': 'tight',
    smart: 'smart-atomic'
  };

  const configs = {
    nearest: { type: 'base', toleranceNm: 3, maxMatches: 10, maxPerPeak: 2 },
    tight: { type: 'base', toleranceNm: 1.5, maxMatches: 10, maxPerPeak: 2 },
    wide: { type: 'base', toleranceNm: 5, maxMatches: 14, maxPerPeak: 3 },
    fast: { type: 'base', toleranceNm: 3, maxMatches: 8, maxPerPeak: 1 },
    'lamp-hg': {
      type: 'base', toleranceNm: 2.8, maxMatches: 18, maxPerPeak: 3,
      allowedElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
      preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
      familyWeights: { lamp: 1.12, noble: 1.06 }
    },
    'smart-atomic': {
      type: 'smart', mode: 'atomic', toleranceNm: 2.4, maxMatches: 140, maxPerPeak: 4,
      allowedElements: ['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'C', 'N', 'O', 'Na', 'Hg'],
      familyWeights: { noble: 1.18, lamp: 1.12, generic: 0.84 }, candidateLimit: 8
    },
    'smart-molecular': {
      type: 'smart', mode: 'molecular', toleranceNm: 2.8, maxMatches: 160, maxPerPeak: 5,
      allowedMolecules: ['N2', 'O2', 'CN', 'CH', 'C2', 'OH'],
      familyWeights: { molecular: 1.18 }, candidateLimit: 8
    },
    'smart-gastube': {
      type: 'smart', mode: 'mixture', toleranceNm: 2.6, maxMatches: 180, maxPerPeak: 5,
      allowedElements: ['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'Hg', 'N', 'O', 'C', 'Na'],
      allowedMolecules: ['N2', 'O2'],
      familyWeights: { noble: 1.18, lamp: 1.15, generic: 0.9, molecular: 1.05 }, candidateLimit: 10
    },
    'smart-flame': {
      type: 'smart', mode: 'mixture', toleranceNm: 3, maxMatches: 200, maxPerPeak: 5,
      allowedElements: ['Na', 'K', 'Li', 'Ca', 'Sr', 'Ba', 'Cu', 'C', 'H', 'O'],
      allowedMolecules: ['OH', 'CH', 'C2', 'O2', 'CN'],
      familyWeights: { flame: 1.28, background: 0.72, generic: 0.82, molecular: 1.14 },
      atomicSpeciesWeights: { Na: 1.2, K: 1.12, Li: 1.08, Ca: 1.08, Sr: 1.08, Ba: 1.08, Cu: 1.1, C: 0.7, H: 0.68, O: 0.68 },
      molecularSpeciesWeights: { CH: 1.24, C2: 1.22, OH: 1.18, O2: 0.9, CN: 0.82 },
      bandSpecies: ['OH', 'CH', 'C2'], backgroundSpecies: ['C', 'H', 'O', 'O2', 'CN'], candidateLimit: 12
    },
    'smart-fluorescent': {
      type: 'smart', mode: 'mixture', toleranceNm: 2.6, maxMatches: 170, maxPerPeak: 5,
      allowedElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'], allowedMolecules: ['O2'],
      familyWeights: { lamp: 1.2, noble: 1.12, molecular: 0.94 }, candidateLimit: 8
    }
  };

  function resolve(rawPresetId) {
    const raw = String(rawPresetId || '').trim();
    const presetId = aliases[raw] || raw || 'nearest';
    return Object.assign({ id: presetId }, configs[presetId] || configs.nearest);
  }

  function elementFamily(element) {
    const key = String(element || '').trim();
    if ({ He: 1, Ne: 1, Ar: 1, Kr: 1, Xe: 1 }[key]) return 'noble';
    if ({ Hg: 1, Ar: 1, Ne: 1, Kr: 1, Xe: 1 }[key]) return 'lamp';
    if ({ Na: 1, K: 1, Li: 1, Ca: 1, Sr: 1, Ba: 1, Cu: 1 }[key]) return 'flame';
    if ({ C: 1, H: 1, O: 1 }[key]) return 'background';
    return 'generic';
  }

  function filterAtomicLines(atomLines, preset, range) {
    const allowed = Array.isArray(preset.allowedElements) && preset.allowedElements.length ? Object.create(null) : null;
    if (allowed) preset.allowedElements.forEach(function (element) { allowed[String(element)] = true; });
    const minNm = Number(range && range.min) || 380;
    const maxNm = Number(range && range.max) || 900;
    return (Array.isArray(atomLines) ? atomLines : []).filter(function (line) {
      const nm = Number(line && line.nm);
      const element = String(line && line.element || '').trim();
      return Number.isFinite(nm) && !!element && nm >= minNm - 2 && nm <= maxNm + 2 && (!allowed || allowed[element]);
    });
  }

  function filterMolecularBands(molecularBands, preset, range) {
    const allowed = Array.isArray(preset.allowedMolecules) && preset.allowedMolecules.length ? Object.create(null) : null;
    if (allowed) preset.allowedMolecules.forEach(function (species) { allowed[String(species)] = true; });
    const minNm = Number(range && range.min) || 380;
    const maxNm = Number(range && range.max) || 900;
    return (Array.isArray(molecularBands) ? molecularBands : []).filter(function (band) {
      const low = Number(band && band.minNm);
      const high = Number(band && band.maxNm);
      const species = String((band && band.species) || (band && band.element) || '').trim();
      return !!species && Number.isFinite(low) && Number.isFinite(high) && high >= minNm - 4 && low <= maxNm + 4 && (!allowed || allowed[species]);
    });
  }

  root.SPECTRA_PRO_presetResolver = {
    resolve: resolve,
    elementFamily: elementFamily,
    filterAtomicLines: filterAtomicLines,
    filterMolecularBands: filterMolecularBands
  };
})(typeof self !== 'undefined' ? self : this);
