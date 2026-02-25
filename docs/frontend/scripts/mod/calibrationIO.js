(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.calibrationIO || (v15.calibrationIO = {});

  mod.parseCalibrationFile = function parseCalibrationFile(text) {
    return [];
  };
  mod.serializeCalibrationPoints = function serializeCalibrationPoints(points) {
    return Array.isArray(points) ? String(points.length) : '0';
  };
  mod.version = 'step3-scaffold';
})();
