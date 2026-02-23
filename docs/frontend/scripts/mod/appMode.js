
(function (global) {
  'use strict';

  const MODES = ['CORE', 'LAB', 'ASTRO'];
  const sp = global.SpectraPro = global.SpectraPro || {};
  const bus = sp.eventBus;
  const store = sp.store;

  function getMode() {
    return (store && store.getState().appMode) || 'CORE';
  }

  function setMode(nextMode, meta) {
    const mode = String(nextMode || '').toUpperCase();
    if (!MODES.includes(mode)) {
      console.warn('[SPECTRA-PRO] Invalid mode:', nextMode);
      return getMode();
    }
    const prev = getMode();
    if (prev === mode) return prev;
    if (store) store.update('appMode', mode, meta || { source: 'appMode.setMode' });
    if (bus) bus.emit('mode:changed', { prevMode: prev, nextMode: mode, meta: meta || null });
    return mode;
  }

  sp.appMode = { MODES, getMode, setMode };
})(window);
