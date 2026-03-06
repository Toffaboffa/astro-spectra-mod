(function(){
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const api = sp.framePreview || (sp.framePreview = {});

  let mode = 'source';
  let initialized = false;
  const slotState = {
    source: { stripePlacement: null, stripeWidth: null },
    dark: { stripePlacement: null, stripeWidth: null },
    ref: { stripePlacement: null, stripeWidth: null }
  };
  const sourceState = { wasImage: false, imageSrc: '' };

  function $(id){ return document.getElementById(id); }
  function runtime(){ return sp.runtime || {}; }
  function getVideoElement(){ try { return runtime().getVideoElement ? runtime().getVideoElement() : null; } catch(_) { return null; } }
  function setVideoElement(el){ try { return runtime().setVideoElement ? runtime().setVideoElement(el) : el; } catch(_) { return el; } }
  function refreshMetrics(){ try { if (runtime().refreshActiveSourceMetrics) runtime().refreshActiveSourceMetrics(); } catch(_) {} }


  function saveCurrentSourceState(){
    const img = $('cameraImage');
    const current = getVideoElement();
    sourceState.wasImage = !!(current && current.id === 'cameraImage');
    sourceState.imageSrc = img ? (img.getAttribute('src') || img.src || '') : '';
  }

  function getSubState(){
    try {
      const store = sp.store;
      const st = store && typeof store.getState === 'function' ? store.getState() : null;
      return (st && st.subtraction) ? st.subtraction : {};
    } catch(e){ return {}; }
  }

  function getStripeUi(){
    const place = $('stripePlacementRange');
    const width = $('stripeWidthRange');
    return {
      stripePlacement: place ? Number(place.value || 0) : null,
      stripeWidth: width ? Number(width.value || 0) : null
    };
  }

  function applyStripeUi(v){
    if (!v) return;
    const place = $('stripePlacementRange');
    const width = $('stripeWidthRange');
    const placeVal = $('stripePlacementValue');
    const widthVal = $('stripeWidthValue');
    if (width && Number.isFinite(Number(v.stripeWidth)) && Number(v.stripeWidth) > 0) {
      width.value = String(Math.round(Number(v.stripeWidth)));
      if (widthVal) widthVal.textContent = String(Math.round(Number(v.stripeWidth)));
      try { if (typeof changeStripeWidth === 'function') changeStripeWidth(0); } catch(_) {}
    }
    if (place && Number.isFinite(Number(v.stripePlacement)) && Number(v.stripePlacement) > 0) {
      place.value = String(Math.round(Number(v.stripePlacement)));
      let applied = false;
      try { if (typeof changeStripePlacement === 'function') { changeStripePlacement(0); applied = true; } } catch(_) {}
      if (!applied && placeVal && typeof getStripePositionRangeText === 'function') placeVal.textContent = getStripePositionRangeText();
    }
  }

  function saveCurrentSlotStripe(){
    slotState[mode] = Object.assign({}, slotState[mode] || {}, getStripeUi());
  }

  function rebuildActivePreviewData(){
    try {
      if (mode === 'source' || typeof sp.loadSubImage !== 'function') return;
      const sub = getSubState();
      const src = mode === 'dark' ? sub.darkImageSrc : sub.referenceImageSrc;
      if (!src) return;
      const img = $('cameraImage');
      if (!img) return;
      const canvas = document.createElement('canvas');
      const w = Number(img.naturalWidth || img.width || 0);
      const h = Number(img.naturalHeight || img.height || 0);
      if (!w || !h) return;
      const stripeWidth = (typeof getStripeWidth === 'function') ? Number(getStripeWidth()) : 1;
      const yPct = (typeof getYPercentage === 'function') ? Number(getYPercentage()) : 0.5;
      canvas.width = w;
      canvas.height = Math.max(1, Math.round(stripeWidth));
      const ctx = canvas.getContext('2d', { willReadFrequently:true });
      if (!ctx) return;
      let startY = (h * yPct) - (stripeWidth / 2);
      startY = Math.max(0, Math.min(h - stripeWidth, startY));
      ctx.drawImage(img, 0, startY, w, stripeWidth, 0, 0, w, stripeWidth);
      let px = ctx.getImageData(0,0,w,canvas.height).data;
      if (canvas.height > 1 && typeof averagePixels === 'function') px = averagePixels(px, w);
      const R = new Array(w), G = new Array(w), B = new Array(w), I = new Array(w);
      for (let i=0;i<w;i++){
        const base=i*4;
        const r=Number(px[base]||0), g=Number(px[base+1]||0), b=Number(px[base+2]||0);
        R[i]=r; G[i]=g; B[i]=b; I[i]=Math.max(r,g,b);
      }
      const setVal = sp.store && typeof sp.store.updatePath === 'function' ? sp.store.updatePath.bind(sp.store) : null;
      if (!setVal) return;
      if (mode === 'dark') {
        setVal('subtraction.darkI', I.slice(), { source:'framePreview.rebuildDark' });
        setVal('subtraction.darkRGB', { R:R.slice(), G:G.slice(), B:B.slice() }, { source:'framePreview.rebuildDark' });
      } else {
        setVal('subtraction.referenceI', I.slice(), { source:'framePreview.rebuildRef' });
        setVal('subtraction.referenceRGB', { R:R.slice(), G:G.slice(), B:B.slice() }, { source:'framePreview.rebuildRef' });
      }
    } catch(_) {}
  }

  function setUiEnabled(){
    const sub = getSubState();
    const hasDark = !!sub.hasDark && !!sub.darkImageSrc;
    const hasRef = !!sub.hasReference && !!sub.referenceImageSrc;
    const darkRadio = $('spFrameViewDark');
    const refRadio = $('spFrameViewRef');
    if (darkRadio) darkRadio.disabled = !hasDark;
    if (refRadio) refRadio.disabled = !hasRef;
    const tDark = $('toggleDark');
    const tRef = $('toggleRef');
    if (tDark) tDark.disabled = !hasDark;
    if (tRef) tRef.disabled = !hasRef;
    const pDark = $('spToggleDarkProxy');
    const pRef = $('spToggleRefProxy');
    if (pDark) pDark.disabled = !hasDark;
    if (pRef) pRef.disabled = !hasRef;
    if (mode === 'dark' && !hasDark) setMode('source');
    if (mode === 'ref' && !hasRef) setMode('source');
  }

  function syncToggleUi(){
    const s = $('spFrameViewSource');
    const d = $('spFrameViewDark');
    const r = $('spFrameViewRef');
    if (s) s.checked = mode === 'source';
    if (d) d.checked = mode === 'dark';
    if (r) r.checked = mode === 'ref';
  }

  function ensureLabel(){
    const host = $('cameraMainWindow') || document.body;
    if (!host) return null;
    let lbl = $('spFrameModeLabel');
    if (lbl) return lbl;
    lbl = document.createElement('div');
    lbl.id = 'spFrameModeLabel';
    lbl.className = 'sp-frame-mode-label';
    try { const st = window.getComputedStyle(host); if (st && st.position === 'static') host.style.position = 'relative'; } catch(_) {}
    host.appendChild(lbl);
    return lbl;
  }

  function ensureGraphBadge(){
    const host = $('graphCanvasWindow') || $('graphWindow') || document.body;
    if (!host) return null;
    let badge = $('spGraphPreviewBadge');
    if (badge) return badge;
    badge = document.createElement('div');
    badge.id = 'spGraphPreviewBadge';
    badge.className = 'sp-graph-preview-badge';
    try { const st = window.getComputedStyle(host); if (st && st.position === 'static') host.style.position = 'relative'; } catch(_) {}
    host.appendChild(badge);
    return badge;
  }

  function updateLabels(){
    const lbl = ensureLabel();
    if (lbl) {
      if (mode === 'dark') lbl.textContent = 'DARK';
      else if (mode === 'ref') lbl.textContent = 'REF';
      else lbl.textContent = (runtime().isSourceLive && runtime().isSourceLive()) ? 'SOURCE Cam' : 'SOURCE: Image';
    }
    const badge = ensureGraphBadge();
    if (badge) {
      if (mode === 'dark') { badge.textContent = 'DARK PREVIEW'; badge.style.display = 'block'; }
      else if (mode === 'ref') { badge.textContent = 'REF PREVIEW'; badge.style.display = 'block'; }
      else { badge.textContent = ''; badge.style.display = 'none'; }
    }
    syncCaptureButtons();
  }

  function syncCaptureButtons(){
    const canCapture = (mode === 'source') && !!(runtime().isSourceLive && runtime().isSourceLive());
    const ids = ['spSubCapDarkBtn','spSubCapRefBtn'];
    ids.forEach(function(id){
      const btn = $(id);
      if (!btn) return;
      btn.disabled = !canCapture;
      btn.title = canCapture ? '' : 'Capture works only for SOURCE when camera live is active.';
    });
  }

  function refreshVisuals(){
    try { refreshMetrics(); } catch(_) {}
    try { if (typeof window.initializeZoomList === 'function') window.initializeZoomList(); } catch(_) {}
    try { if (typeof window.redrawGraphIfLoadedImage === 'function') window.redrawGraphIfLoadedImage(true); } catch(_) {}
    try { if (typeof window.drawSelectionLine === 'function') window.drawSelectionLine(); } catch(_) {}
    try { if (typeof window.showSelectedStripe === 'function') window.showSelectedStripe(); } catch(_) {}
    try { if (typeof window.drawGraph === 'function') window.drawGraph(); } catch(_) {}
    try { if (sp.coreHooks && typeof sp.coreHooks.emit === 'function') sp.coreHooks.emit('framePreviewChanged', { mode }); } catch(_) {}
  }

  function applyDisplayMode(){
    const video = $('videoMain');
    const img = $('cameraImage');
    const previewCanvas = $('spFramePreviewCanvas');
    if (previewCanvas) previewCanvas.style.display = 'none';
    if (!video || !img) return;

    if (mode === 'source') {
      const useImage = !!(sourceState.wasImage && sourceState.imageSrc);
      if (useImage) {
        if (img.src !== sourceState.imageSrc) img.src = sourceState.imageSrc;
        video.style.display = 'none';
        img.style.display = 'block';
        setVideoElement(img);
      } else {
        img.style.display = 'none';
        video.style.display = '';
        setVideoElement(video);
      }
      updateLabels();
      refreshVisuals();
      return;
    }

    const sub = getSubState();
    const src = mode === 'dark' ? (sub.darkImageSrc || '') : (sub.referenceImageSrc || '');
    if (!src) { mode='source'; syncToggleUi(); applyDisplayMode(); return; }
    video.style.display = 'none';
    img.style.display = 'block';
    if (img.src !== src) img.src = src;
    setVideoElement(img);
    const done = function(){ updateLabels(); refreshVisuals(); };
    if (img.complete) done(); else img.onload = done;
  }

  function setMode(next){
    const m = String(next || 'source').toLowerCase();
    if (mode === 'source') saveCurrentSourceState();
    saveCurrentSlotStripe();
    mode = (m === 'dark' || m === 'ref') ? m : 'source';
    syncToggleUi();
    setUiEnabled();
    applyDisplayMode();
    const saved = slotState[mode];
    if (saved) applyStripeUi(saved);
    if (mode !== 'source') rebuildActivePreviewData();
    updateLabels();
    refreshVisuals();
  }

  function bindStripePersistence(){
    const place = $('stripePlacementRange');
    const width = $('stripeWidthRange');
    const onChange = function(){
      saveCurrentSlotStripe();
      if (mode !== 'source') {
        rebuildActivePreviewData();
        updateLabels();
        refreshVisuals();
      }
    };
    if (place) { place.addEventListener('input', onChange); place.addEventListener('change', onChange); }
    if (width) { width.addEventListener('input', onChange); width.addEventListener('change', onChange); }
  }

  function attach(){
    if (initialized) return;
    initialized = true;
    const s = $('spFrameViewSource');
    const d = $('spFrameViewDark');
    const r = $('spFrameViewRef');
    if (s) s.addEventListener('change', function(){ if (s.checked) setMode('source'); });
    if (d) d.addEventListener('change', function(){ if (d.checked) setMode('dark'); });
    if (r) r.addEventListener('change', function(){ if (r.checked) setMode('ref'); });
    bindStripePersistence();
    try {
      const store = sp.store;
      if (store && typeof store.subscribe === 'function') {
        store.subscribe(function(path){
          if (String(path||'').indexOf('subtraction.') === 0) {
            setUiEnabled();
            updateLabels();
            syncCaptureButtons();
          }
        });
      }
    } catch(_) {}
    window.addEventListener('resize', function(){ updateLabels(); refreshVisuals(); });
    saveCurrentSourceState();
    saveCurrentSlotStripe();
    setUiEnabled();
    syncCaptureButtons();
    setMode('source');
  }

  api.setMode = setMode;
  api.getMode = function(){ return mode; };
  api.init = attach;
  window.addEventListener('load', attach);
})();
