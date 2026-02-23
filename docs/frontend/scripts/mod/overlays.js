(function(global){
  "use strict";
  const sp = global.SpectraPro = global.SpectraPro || {};
  function drawOnGraph(ctx, graphState){
    // Phase 1 shell: reserved hook. Keep no-op to avoid touching CORE rendering behavior.
    return { ok:true, labels:0, bands:0, graphState: !!graphState };
  }
  sp.overlays = { drawOnGraph };
})(window);
