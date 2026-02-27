(function (root) {
  'use strict';
  // Phase 2: load real libraries from /data when available.
  // Worker runs from /workers, so data lives at ../data/* (relative).

  const BUILTIN_ATOM_LINES = [
    { species:'Hα', speciesKey:'H', nm:656.28, kind:'atom', tags:['lab','astro','hydrogen'] },
    { species:'Hβ', speciesKey:'H', nm:486.13, kind:'atom', tags:['lab','astro','hydrogen'] },
    { species:'Hγ', speciesKey:'H', nm:434.05, kind:'atom', tags:['lab','astro','hydrogen'] },
    { species:'Na I', speciesKey:'Na', nm:589.00, kind:'atom', tags:['lab','astro','sodium'] },
    { species:'Na I', speciesKey:'Na', nm:589.59, kind:'atom', tags:['lab','astro','sodium'] },
    { species:'Hg I', speciesKey:'Hg', nm:404.66, kind:'atom', tags:['lab','mercury'] },
    { species:'Hg I', speciesKey:'Hg', nm:435.83, kind:'atom', tags:['lab','mercury'] },
    { species:'Hg I', speciesKey:'Hg', nm:546.07, kind:'atom', tags:['lab','mercury'] },
    { species:'Hg I', speciesKey:'Hg', nm:576.96, kind:'atom', tags:['lab','mercury'] },
    { species:'Hg I', speciesKey:'Hg', nm:579.07, kind:'atom', tags:['lab','mercury'] },
    { species:'Ne I', speciesKey:'Ne', nm:585.25, kind:'atom', tags:['lab','neon'] },
    { species:'Ne I', speciesKey:'Ne', nm:640.22, kind:'atom', tags:['lab','neon'] },
    { species:'Ne I', speciesKey:'Ne', nm:703.24, kind:'atom', tags:['lab','neon'] },
    { species:'O I', speciesKey:'O', nm:777.19, kind:'atom', tags:['lab','astro','oxygen'] },
    { species:'Ca II K', speciesKey:'Ca', nm:393.37, kind:'atom', tags:['astro','solar','stellar'] },
    { species:'Ca II H', speciesKey:'Ca', nm:396.85, kind:'atom', tags:['astro','solar','stellar'] }
  ];

  function guessElementKey(speciesKey) {
    const k = String(speciesKey || '').trim();
    // Common formats in line_library_general_atomic.json:
    // "Fe", "Na", "198Hg", "10B", "Ar", etc.
    // Strategy: take the first element-like token: one capital + optional lowercase.
    const m = k.match(/[A-Z][a-z]?/);
    return m ? m[0] : (k || null);
  }

  function normalizeAtomicMapping(jsonObj) {
    const out = [];
    if (!jsonObj || typeof jsonObj !== 'object') return out;
    Object.keys(jsonObj).forEach(function (key) {
      const arr = jsonObj[key];
      if (!Array.isArray(arr)) return;
      const element = guessElementKey(key);
      for (let i = 0; i < arr.length; i++) {
        const nm = Number(arr[i]);
        if (!Number.isFinite(nm)) continue;
        out.push({
          species: String(key),
          speciesKey: String(key),
          element: element,
          nm: nm,
          kind: 'atom',
          tags: ['general', 'atomic']
        });
      }
    });
    return out;
  }

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      return { __error: String(err && err.message || err) };
    }
  }

  async function loadLibraries(payload) {
    const manifestIn = payload && payload.manifest ? payload.manifest : null;

    // Default library path (present in this repo)
    const atomicPath = (manifestIn && manifestIn.atomicPath) ? String(manifestIn.atomicPath) : '../data/line_library_general_atomic.json';

    // Try to load real atomic library first.
    const raw = await fetchJsonSafe(atomicPath);
    let atomLines = [];
    let source = 'builtin-lite';
    let warnings = [];

    if (raw && !raw.__error) {
      atomLines = normalizeAtomicMapping(raw);
      source = atomicPath;
      if (!atomLines.length) warnings.push('Atomic library loaded but contained 0 usable lines.');
    } else {
      warnings.push('Failed to load atomic library from ' + atomicPath + ' (' + (raw && raw.__error ? raw.__error : 'unknown error') + '). Falling back to builtin-lite.');
      atomLines = BUILTIN_ATOM_LINES.slice();
    }

    // De-dup by speciesKey+nm (rounded to 1e-4)
    const seen = new Set();
    atomLines = atomLines.filter(function (l) {
      const key = String(l.speciesKey || l.species || '') + '@' + String(Math.round((Number(l.nm) || 0) * 10000) / 10000);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      ok: true,
      manifest: Object.assign({ source: source, version: 'phase2-mvp', atomicPath: atomicPath }, manifestIn || {}),
      atomLines: atomLines,
      warnings: warnings
    };
  }
  root.SPECTRA_PRO_libraryLoader = { loadLibraries };
})(typeof self !== 'undefined' ? self : this);
