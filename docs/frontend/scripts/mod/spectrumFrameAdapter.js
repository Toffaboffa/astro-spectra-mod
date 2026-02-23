(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function evalPoly(coeffs, x){
    if (!Array.isArray(coeffs) || !coeffs.length) return null;
    let y = 0;
    for (let i = 0; i < coeffs.length; i += 1) y += (Number(coeffs[i]) || 0) * Math.pow(x, i);
    return Number.isFinite(y) ? y : null;
  }

  function buildNm(px, calibration){
    const coeffs = calibration && Array.isArray(calibration.coefficients) ? calibration.coefficients : [];
    if (!coeffs.length || !Array.isArray(px)) return null;
    const nm = new Array(px.length);
    for (let i = 0; i < px.length; i += 1) nm[i] = evalPoly(coeffs, Number(px[i]) || i);
    return nm;
  }

  function adapt(rawFrame, calibration) {
    if (!rawFrame || !Array.isArray(rawFrame.I)) return null;
    const px = Array.isArray(rawFrame.px) ? rawFrame.px.slice() : rawFrame.I.map((_, i) => i);
    const calOk = !!(calibration && (calibration.isCalibrated || calibration.calibrated) && Array.isArray(calibration.coefficients) && calibration.coefficients.length);
    const nm = Array.isArray(rawFrame.nm) ? rawFrame.nm.slice() : (calOk ? buildNm(px, calibration) : null);
    return {
      px,
      nm,
      R: Array.isArray(rawFrame.R) ? rawFrame.R.slice() : null,
      G: Array.isArray(rawFrame.G) ? rawFrame.G.slice() : null,
      B: Array.isArray(rawFrame.B) ? rawFrame.B.slice() : null,
      I: rawFrame.I.slice(),
      timestamp: rawFrame.timestamp || Date.now(),
      source: rawFrame.source || 'unknown',
      calibrated: !!calOk
    };
  }

  sp.spectrumFrameAdapter = { adapt };
})(window);
