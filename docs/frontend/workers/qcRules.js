
(function (root) {
  'use strict';
  function evaluateQC(ctx) {
    const flags = [];
    if (!ctx || !ctx.frame || !Array.isArray(ctx.frame.I) || ctx.frame.I.length < 8) flags.push('FRAME_TOO_SMALL');
    return { flags: flags, ok: flags.length === 0 };
  }
  root.SPECTRA_PRO_qcRules = { evaluateQC };
})(typeof self !== 'undefined' ? self : this);
