
(function (global) {
  'use strict';

  function createEventBus() {
    const listeners = new Map();

    function on(eventName, handler) {
      if (!eventName || typeof handler !== 'function') return function noop() {};
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      const set = listeners.get(eventName);
      set.add(handler);
      return function unsubscribe() {
        set.delete(handler);
        if (set.size === 0) listeners.delete(eventName);
      };
    }

    function once(eventName, handler) {
      const off = on(eventName, function wrapped(payload) {
        off();
        handler(payload);
      });
      return off;
    }

    function emit(eventName, payload) {
      const set = listeners.get(eventName);
      if (!set) return 0;
      let count = 0;
      Array.from(set).forEach(function (handler) {
        try {
          handler(payload);
          count += 1;
        } catch (err) {
          console.error('[SPECTRA-PRO eventBus] listener error on', eventName, err);
        }
      });
      return count;
    }

    function clear(eventName) {
      if (eventName) listeners.delete(eventName);
      else listeners.clear();
    }

    return { on, once, emit, clear };
  }

  global.SpectraPro = global.SpectraPro || {};
  global.SpectraPro.createEventBus = createEventBus;
  global.SpectraPro.eventBus = global.SpectraPro.eventBus || createEventBus();
})(window);
