
(function (root) {
  'use strict';
  function scorePeaks(peaks) {
    return (peaks || []).map(function (p) { return Object.assign({ prominence: p.value || 0 }, p); });
  }
  root.SPECTRA_PRO_peakScoring = { scorePeaks };
})(typeof self !== 'undefined' ? self : this);
