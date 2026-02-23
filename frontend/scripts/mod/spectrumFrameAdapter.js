
(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function adapt(rawFrame, calibration) {
    if (!rawFrame || !Array.isArray(rawFrame.I)) return null;
    return {
      px: rawFrame.px || rawFrame.I.map((_, i) => i),
      nm: rawFrame.nm || null,
      R: rawFrame.R || null,
      G: rawFrame.G || null,
      B: rawFrame.B || null,
      I: rawFrame.I.slice(),
      timestamp: rawFrame.timestamp || Date.now(),
      source: rawFrame.source || 'unknown',
      calibrated: !!(calibration && calibration.isCalibrated)
    };
  }

  sp.spectrumFrameAdapter = { adapt };
})(window);
