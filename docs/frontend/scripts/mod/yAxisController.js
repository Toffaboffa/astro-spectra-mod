(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.yAxisController || (v15.yAxisController = {});

  const Y_AXIS_MODES = ['AUTO','FIXED_255','MANUAL'];

  mod.Y_AXIS_MODES = Y_AXIS_MODES.slice();
  mod.getModes = function () { return Y_AXIS_MODES.slice(); };
  mod.getDefaultMode = function () { return 'AUTO'; };
  mod.version = 'step3-scaffold';
})();
