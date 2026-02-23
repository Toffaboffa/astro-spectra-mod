(function (global) {
  'use strict';
  const core = global.SpectraCore = global.SpectraCore || {};
  const sp = global.SpectraPro = global.SpectraPro || {};

  const refState = core.referenceGraph = core.referenceGraph || { curve: null, label: null, updatedAt: null };

  function setReference(curve, label) {
    refState.curve = curve || null;
    refState.label = label || null;
    refState.updatedAt = Date.now();
    if (sp.coreBridge) sp.coreBridge.reference = { curve: refState.curve, label: refState.label, updatedAt: refState.updatedAt };
    if (sp.coreHooks) sp.coreHooks.emit('referenceChanged', sp.coreBridge.reference);
  }

  core.referenceGraphApi = {
    getState: function () { return refState; },
    setReference: setReference,
    clear: function () { setReference(null, null); }
  };
})(window);
