(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.peakControls || (v15.peakControls = {});

  mod.getState = function getPeakControlState() {
    return {
      threshold: null,
      distance: null,
      smoothing: null,
      placeholder: true
    };
  };
  mod.version = 'step4-scaffold';
})();
