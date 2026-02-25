(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.graphAppearance || (v15.graphAppearance = {});

  mod.FILL_MODES = ['INHERIT', 'OFF', 'SYNTHETIC', 'SOURCE'];

  function normMode(mode) {
    const m = String(mode || 'inherit').trim().toUpperCase();
    if (m === 'REAL' || m === 'REAL-SAMPLED' || m === 'REAL_SAMPLED' || m === 'SOURCE') return 'SOURCE';
    if (m === 'SYNTH' || m === 'SYNTHETIC') return 'SYNTHETIC';
    if (m === 'OFF' || m === 'NONE') return 'OFF';
    return 'INHERIT';
  }

  function clampOpacity(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  mod.getFillModes = function getFillModes() {
    return mod.FILL_MODES.slice();
  };

  mod.getEffective = function getEffective(state, fallback) {
    const st = state || {};
    const d = st.display || {};
    const fb = Object.assign({ fillMode: 'inherit', fillOpacity: null }, fallback || {});
    const mode = normMode(d.fillMode || fb.fillMode || 'inherit');
    const opacityRaw = (d.fillOpacity != null ? d.fillOpacity : fb.fillOpacity);
    const opacity = opacityRaw == null ? null : clampOpacity(opacityRaw, null);
    return { fillMode: mode, fillOpacity: opacity };
  };

  mod.apply = function applyGraphAppearance(opts) {
    return { applied: false, placeholder: true, options: opts || {} };
  };
  mod.version = 'step4-appearance-source';
})();