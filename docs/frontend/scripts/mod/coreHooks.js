(function(){
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const listeners = {};
  sp.coreBridge = sp.coreBridge || { frame:null, calibration:null, reference:null };
  sp.coreHooks = sp.coreHooks || {
    on: function(evt, cb){ (listeners[evt] = listeners[evt] || []).push(cb); return function(){ this.off(evt, cb); }.bind(this); },
    off: function(evt, cb){ if(!listeners[evt]) return; listeners[evt] = listeners[evt].filter(fn => fn !== cb); },
    emit: function(evt, payload){ (listeners[evt] || []).forEach(function(fn){ try { fn(payload); } catch (e) { console.warn('coreHooks listener error', e); } }); }
  };
})();
