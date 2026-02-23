(function (global) {
  'use strict';
  const core = global.SpectraCore = global.SpectraCore || {};
  const sp = global.SpectraPro = global.SpectraPro || {};

  const calibration = core.calibration = core.calibration || {
    points: [],
    coefficients: [],
    isCalibrated: false,
    residualStatus: 'unknown'
  };

  function setCalibration(data) {
    const next = Object.assign({}, calibration, data || {});
    core.calibration = next;
    if (sp.coreBridge) sp.coreBridge.calibration = {
      isCalibrated: !!next.isCalibrated,
      coefficients: next.coefficients || [],
      points: next.points || [],
      residualStatus: next.residualStatus || 'unknown'
    };
    if (sp.coreHooks) sp.coreHooks.emit('calibrationChanged', sp.coreBridge.calibration);
    return next;
  }

  core.calibrationApi = {
    getState: function () { return core.calibration; },
    setCalibration: setCalibration
  };

  // Placeholder default
  setCalibration({ isCalibrated: false, coefficients: [], points: [], residualStatus: 'not-calibrated' });
})(window);
