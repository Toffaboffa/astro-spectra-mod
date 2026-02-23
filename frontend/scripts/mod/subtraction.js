
(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function safeDiv(a, b) { return b === 0 ? 0 : a / b; }
  function safeLog10(x) { return x > 0 ? Math.log(x) / Math.LN10 : 0; }

  function applyMode(raw, ref, dark, mode) {
    const n = Array.isArray(raw) ? raw.length : 0;
    const out = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const R = raw[i] || 0;
      const D = dark ? (dark[i] || 0) : 0;
      const RF = ref ? (ref[i] || 0) : 0;
      const rMinusD = R - D;
      const refMinusD = RF - D;
      switch (mode) {
        case 'raw-dark': out[i] = rMinusD; break;
        case 'difference': out[i] = R - RF; break;
        case 'ratio': out[i] = safeDiv(R, RF); break;
        case 'transmittance': out[i] = 100 * safeDiv(rMinusD, refMinusD); break;
        case 'absorbance': out[i] = -safeLog10(safeDiv(rMinusD, refMinusD)); break;
        case 'raw':
        default: out[i] = R;
      }
    }
    return out;
  }

  sp.subtraction = { applyMode };
})(window);
