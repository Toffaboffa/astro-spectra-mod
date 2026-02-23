
(function (root) {
  'use strict';
  function buildConfidence(matches, qc) {
    return { overall: qc && qc.ok ? 0.2 : 0.0 };
  }
  root.SPECTRA_PRO_confidenceModel = { buildConfidence };
})(typeof self !== 'undefined' ? self : this);
