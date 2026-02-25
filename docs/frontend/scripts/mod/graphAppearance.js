(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.graphAppearance || (v15.graphAppearance = {});

  mod.FILL_MODES = ['OFF', 'SYNTHETIC', 'REAL_SAMPLED'];
  mod.apply = function applyGraphAppearance(opts) {
    return { applied: false, placeholder: true, options: opts || {} };
  };
  mod.version = 'step3-scaffold';
})();
