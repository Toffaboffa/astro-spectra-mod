(function (root) {
  'use strict';
  function queryByRange(index, minNm, maxNm) {
    const lines = (index && index.lines) || [];
    return lines.filter(l => typeof l.nm === 'number' && l.nm >= minNm && l.nm <= maxNm);
  }
  root.SPECTRA_PRO_libraryQuery = { queryByRange };
})(typeof self !== 'undefined' ? self : this);
