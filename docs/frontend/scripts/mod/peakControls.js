(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.peakControls || (v15.peakControls = {});

  const DEFAULTS = {
    threshold: null,
    distance: null,
    smoothing: null
  };

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.round(n);
    return Math.min(max, Math.max(min, v));
  }

  mod.getState = function getPeakControlState(state) {
    const st = state || ((sp.store && typeof sp.store.getState === 'function') ? sp.store.getState() : {}) || {};
    const p = st.peaks || {};
    return {
      threshold: Number.isFinite(Number(p.threshold)) ? clampInt(p.threshold, 0, 255, null) : null,
      distance: Number.isFinite(Number(p.distance)) ? clampInt(p.distance, 1, 512, null) : null,
      smoothing: Number.isFinite(Number(p.smoothing)) ? clampInt(p.smoothing, 0, 8, null) : null,
      placeholder: false
    };
  };

  mod.getEffective = function getEffectivePeakControls(state, fallback) {
    const st = mod.getState(state);
    const fb = fallback || {};
    return {
      threshold: st.threshold == null ? (Number.isFinite(Number(fb.threshold)) ? Number(fb.threshold) : 1) : st.threshold,
      distance: st.distance == null ? (Number.isFinite(Number(fb.distance)) ? Number(fb.distance) : 1) : st.distance,
      smoothing: st.smoothing == null ? (Number.isFinite(Number(fb.smoothing)) ? Number(fb.smoothing) : 0) : st.smoothing,
      placeholder: false
    };
  };

  mod.DEFAULTS = DEFAULTS;
  mod.version = 'step4-peak-controls';
})();
