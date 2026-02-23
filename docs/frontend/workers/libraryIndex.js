
(function (root) {
  'use strict';
  function buildIndex(atomLines) {
    return { buckets: {}, count: Array.isArray(atomLines) ? atomLines.length : 0 };
  }
  root.SPECTRA_PRO_libraryIndex = { buildIndex };
})(typeof self !== 'undefined' ? self : this);
