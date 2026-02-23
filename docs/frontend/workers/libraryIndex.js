(function (root) {
  'use strict';
  function buildIndex(atomLines) {
    const lines = Array.isArray(atomLines) ? atomLines.slice().sort((a,b)=>(a.nm||0)-(b.nm||0)) : [];
    return { lines: lines, count: lines.length };
  }
  root.SPECTRA_PRO_libraryIndex = { buildIndex };
})(typeof self !== 'undefined' ? self : this);
