(function (root) {
  'use strict';
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
  async function loadLibraries(payload) {
    return {
      ok: true,
      manifest: payload && payload.manifest ? payload.manifest : { source:'builtin-lite', version:'mvp1' },
      atomLines: BUILTIN_ATOM_LINES.slice()
    };
  }
  root.SPECTRA_PRO_libraryLoader = { loadLibraries };
})(typeof self !== 'undefined' ? self : this);
