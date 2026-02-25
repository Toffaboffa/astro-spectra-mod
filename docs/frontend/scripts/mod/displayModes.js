(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.displayModes || (v15.displayModes = {});

  const DISPLAY_MODES = ['NORMAL','DIFFERENCE','RATIO','TRANSMITTANCE','ABSORBANCE'];

  mod.DISPLAY_MODES = DISPLAY_MODES.slice();
  mod.getDisplayModes = function () { return DISPLAY_MODES.slice(); };
  mod.getDefaultDisplayMode = function () { return 'NORMAL'; };
  mod.version = 'step4-scaffold';
})();
