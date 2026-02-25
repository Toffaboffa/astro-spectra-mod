(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.cameraCapabilities || (v15.cameraCapabilities = {});

  mod.probe = async function probeCameraCapabilities(track) {
    return {
      placeholder: true,
      supported: {},
      values: {},
      source: track ? 'track' : 'none'
    };
  };
  mod.version = 'step3-scaffold';
})();
