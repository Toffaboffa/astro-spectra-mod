(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function createHookRegistry() {
    const hooks = {
      graphFrame: [],
      graphRenderAfter: [],
      calibrationChanged: [],
      referenceChanged: []
    };

    function on(name, fn) {
      if (!hooks[name]) hooks[name] = [];
      if (typeof fn !== 'function') return function noop(){};
      hooks[name].push(fn);
      return function off() {
        hooks[name] = (hooks[name] || []).filter(function (x) { return x !== fn; });
      };
    }

    function emit(name, payload) {
      const list = hooks[name] || [];
      list.forEach(function (fn) {
        try { fn(payload); } catch (err) { console.error('[SPECTRA-PRO coreHooks]', name, err); }
      });
    }

    return { on: on, emit: emit };
  }

  sp.coreHooks = sp.coreHooks || createHookRegistry();

  // Shared bridge cache (read-only from mod modules)
  sp.coreBridge = sp.coreBridge || {
    frame: null,
    calibration: { isCalibrated: false, coefficients: [], points: [], residualStatus: 'unknown' },
    reference: { curve: null, label: null, updatedAt: null }
  };
})(window);
