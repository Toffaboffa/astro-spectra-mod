(function (global) {
  'use strict';
  const core = global.SpectraCore = global.SpectraCore || {};
  core.camera = core.camera || {
    startCamera: function () {
      core.state = core.state || {};
      core.state.sourceType = 'camera-placeholder';
      console.info('[SPECTRA-PRO Phase 0] cameraScript placeholder loaded. Replace with original SPECTRA file.');
      if (global.plotRGBLineFromCamera) global.plotRGBLineFromCamera();
    },
    resetCamera: function () {},
    pauseCamera: function () {}
  };
})(window);
