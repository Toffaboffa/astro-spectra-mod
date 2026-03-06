(function(){
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});

  const api = sp.framePreview || (sp.framePreview = {});

  const slots = api.slots || (api.slots = { source:{}, dark:{}, ref:{} });

  let mode = 'source'; // source|dark|ref
  let initialized = false;

  function $(id){ return document.getElementById(id); }

  function getSubState(){
    try {
      const store = sp.store;
      const st = store && typeof store.getState === 'function' ? store.getState() : null;
      return (st && st.subtraction) ? st.subtraction : {};
    } catch(e){ return {}; }
  }

  function getRgb(kind){
    const sub = getSubState();
    if (kind === 'dark') return sub.darkRGB || null;
    if (kind === 'ref') return sub.referenceRGB || null;
    return null;
  }

  function setUiEnabled(){
    const sub = getSubState();
    const hasDark = !!sub.hasDark && !!sub.darkImageSrc;
    const hasRef  = !!sub.hasReference && !!sub.referenceImageSrc;

    const darkRadio = $('spFrameViewDark');
    const refRadio = $('spFrameViewRef');
    if (darkRadio) darkRadio.disabled = !hasDark;
    if (refRadio) refRadio.disabled = !hasRef;

    // Graph toggles in CORE
    const tDark = $('toggleDark');
    const tRef = $('toggleRef');
    if (tDark) tDark.disabled = !hasDark;
    if (tRef) tRef.disabled = !hasRef;

    const pDark = $('spToggleDarkProxy');
    const pRef = $('spToggleRefProxy');
    if (pDark) pDark.disabled = !hasDark;
    if (pRef) pRef.disabled = !hasRef;

    // If current view is unavailable, fall back to source
    if (mode === 'dark' && !hasDark) setMode('source');
    if (mode === 'ref' && !hasRef) setMode('source');
  }

  function syncToggleUi(){
    const s = $('spFrameViewSource');
    const d = $('spFrameViewDark');
    const r = $('spFrameViewRef');
    if (s) s.checked = (mode === 'source');
    if (d) d.checked = (mode === 'dark');
    if (r) r.checked = (mode === 'ref');
  }


  // We want View(Source/Dark/Ref) to control BOTH what is visible in the camera window
  // and what the stripe/graph pipeline samples from. The legacy code samples from the global
  // `videoElement` (cameraScript.js). So we temporarily swap that reference when viewing Dark/Ref.
  let saved = null;
  function getGlobalVideoElement(){
    try { return window.videoElement || null; } catch(_) { return null; }
  }
  function setGlobalVideoElement(el){
    try { window.videoElement = el; } catch(_) {}
  }

  function ensureLabel(){
    const host = document.getElementById('cameraMainWindow') || document.body;
    if (!host) return null;
    let lbl = document.getElementById('spFrameModeLabel');
    if (lbl) return lbl;
    lbl = document.createElement('div');
    lbl.id = 'spFrameModeLabel';
    lbl.className = 'sp-frame-mode-label';
    try {
      const st = window.getComputedStyle(host);
      if (st && st.position === 'static') host.style.position = 'relative';
    } catch(_) {}
    host.appendChild(lbl);
    return lbl;
  }

  function setLabelText(){
    const lbl = ensureLabel();
    if (!lbl) return;
    if (mode === 'dark') { lbl.textContent = 'DARK'; return; }
    if (mode === 'ref') { lbl.textContent = 'REF'; return; }
    const ve = getGlobalVideoElement();
    const live = !!(ve && ve.id === 'videoMain' && ve.srcObject);
    lbl.textContent = live ? 'SOURCE: Live' : 'SOURCE: Image';
  }


  function saveStripeFor(which){
    const k = (which === 'dark' || which === 'ref') ? which : 'source';
    const wEl = document.getElementById('stripeWidthRange');
    const pEl = document.getElementById('stripePlacementRange');
    if (!wEl || !pEl) return;
    slots[k] = slots[k] || {};
    slots[k].stripeWidth = Number(wEl.value);
    slots[k].stripePlace = Number(pEl.value);
  }

  function restoreStripeFor(which){
    const k = (which === 'dark' || which === 'ref') ? which : 'source';
    const wEl = document.getElementById('stripeWidthRange');
    const pEl = document.getElementById('stripePlacementRange');
    const wTxt = document.getElementById('stripeWidthValue');
    const pTxt = document.getElementById('stripePlacementValue');
    if (!wEl || !pEl) return;
    const slot = slots[k] || {};
    if (Number.isFinite(slot.stripeWidth)) wEl.value = String(slot.stripeWidth);
    if (Number.isFinite(slot.stripePlace)) pEl.value = String(slot.stripePlace);
    if (wTxt) wTxt.textContent = String(wEl.value);
    if (pTxt && typeof window.getStripePositionRangeText === 'function') pTxt.textContent = window.getStripePositionRangeText();
    // Apply into globals + redraw
    try { if (typeof window.changeStripeWidth === 'function') window.changeStripeWidth(0); } catch(e) {}
    try { if (typeof window.changeStripePlacement === 'function') window.changeStripePlacement(0); } catch(e) {}
  }

  function maybeRebuildActiveSub(){
    if (mode !== 'dark' && mode !== 'ref') return;
    const sub = getSubState();
    const src = (mode === 'dark') ? (sub.darkImageSrc || '') : (sub.referenceImageSrc || '');
    if (!src) return;
    const fn = sp.rebuildSubFromSrc;
    if (typeof fn === 'function') {
      try { fn(mode, src); } catch(e) {}
    }
  }

  function applyDisplayMode(){
    const video = document.getElementById('videoMain');
    const imgEl = document.getElementById('cameraImage');
    const previewCanvas = document.getElementById('spFramePreviewCanvas');
    if (previewCanvas) previewCanvas.style.display = 'none';
    if (!video || !imgEl) return;

    const currentGlobal = getGlobalVideoElement();
    // Refresh saved source state each time before switching away
    saved = {
        globalEl: currentGlobal,
        sourceWasImage: !!(currentGlobal && currentGlobal.id === 'cameraImage'),
        sourceImgSrc: imgEl.getAttribute('src') || imgEl.src || '',
        videoDisplay: video.style.display,
        imgDisplay: imgEl.style.display
      };


    if (mode === 'source') {
      if (saved && saved.sourceWasImage) {
        if (saved.sourceImgSrc) imgEl.src = saved.sourceImgSrc;
        imgEl.style.display = saved.imgDisplay || 'block';
        video.style.display = 'none';
        setGlobalVideoElement(imgEl);
      } else {
        imgEl.style.display = 'none';
        video.style.display = saved ? (saved.videoDisplay || '') : '';
        setGlobalVideoElement(video);
      }
      setLabelText();
      return;
    }

    const sub = getSubState();
    const src = (mode === 'dark') ? (sub.darkImageSrc || '') : (sub.referenceImageSrc || '');
    if (!src) {
      mode = 'source';
      syncToggleUi();
      applyDisplayMode();
      return;
    }

    imgEl.src = src;
    imgEl.style.display = 'block';
    video.style.display = 'none';
    setGlobalVideoElement(imgEl);

    try {
      imgEl.onload = function(){
        try { if (typeof window.initializeZoomList === 'function') window.initializeZoomList(); } catch(_) {}
        try { if (typeof window.redrawGraphIfLoadedImage === 'function') window.redrawGraphIfLoadedImage(true); } catch(_) {}
        try { if (typeof window.drawGraph === 'function') window.drawGraph(); } catch(_) {}
      };
    } catch(_) {}
    setLabelText();
  }

function hide(el){ if(el) el.style.display='none'; }
  function show(el){ if(el) el.style.display=''; }

  function renderRgbStrip(rgb){
    const canvas = $('spFramePreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width || canvas.clientWidth || 0;
    const h = canvas.height || canvas.clientHeight || 0;
    if (w <= 0 || h <= 0) return;

    const R = rgb && Array.isArray(rgb.R) ? rgb.R : null;
    const G = rgb && Array.isArray(rgb.G) ? rgb.G : null;
    const B = rgb && Array.isArray(rgb.B) ? rgb.B : null;
    const n = Math.min(w, R ? R.length : (G ? G.length : (B ? B.length : 0)));
    if (!n) {
      ctx.clearRect(0,0,w,h);
      return;
    }

    // Determine scaling: if values are already 0..255, keep them; otherwise normalize to max.
    let maxv = 0;
    for (let i=0;i<n;i++){
      const rv = R ? Number(R[i]) : 0;
      const gv = G ? Number(G[i]) : 0;
      const bv = B ? Number(B[i]) : 0;
      if (rv>maxv) maxv=rv;
      if (gv>maxv) maxv=gv;
      if (bv>maxv) maxv=bv;
    }
    const needsNorm = maxv <= 1.5; // treat as 0..1 arrays
    const scale = needsNorm ? 255 : 1;

    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let x=0; x<w; x++){
      const i = Math.min(n-1, Math.floor(x * (n / w)));
      const rr = Math.max(0, Math.min(255, Math.round((R ? Number(R[i]) : 0) * scale)));
      const gg = Math.max(0, Math.min(255, Math.round((G ? Number(G[i]) : 0) * scale)));
      const bb = Math.max(0, Math.min(255, Math.round((B ? Number(B[i]) : 0) * scale)));
      for (let y=0; y<h; y++){
        const idx = (y*w + x)*4;
        data[idx]=rr;
        data[idx+1]=gg;
        data[idx+2]=bb;
        data[idx+3]=255;
      }
    }
    ctx.putImageData(img,0,0);

    // Label
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0,0,70,18);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '12px Verdana, Arial, sans-serif';
    ctx.fillText(mode.toUpperCase(), 6, 13);
    ctx.restore();
  }

  function applyView(){
    // Swap the visible source under the selection-line canvas.
    applyDisplayMode();
  }

  function setMode(next){
    const prev = mode;
    const m = String(next || 'source').toLowerCase();
    mode = (m === 'dark' || m === 'ref') ? m : 'source';
    try { saveStripeFor(prev); } catch(e) {}
    try { restoreStripeFor(mode); } catch(e) {}
    syncToggleUi();
    setUiEnabled();
    applyView();
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

    // Keep toggle availability in sync with capture/clear
    try {
      const store = sp.store;
      if (store && typeof store.subscribe === 'function'){
        store.subscribe(function(path){
          if (String(path||'').indexOf('subtraction.') === 0){
            setUiEnabled();
            if (mode !== 'source') applyView();
          }
        });
      }
    } catch(e){}

    // Track per-slot stripe settings
    const sw = document.getElementById('stripeWidthRange');
    const spc = document.getElementById('stripePlacementRange');
    const onStripe = function(){ try { saveStripeFor(mode); } catch(e) {} try { maybeRebuildActiveSub(); } catch(e) {} };
    if (sw) { sw.addEventListener('input', onStripe); sw.addEventListener('change', onStripe); }
    if (spc) { spc.addEventListener('input', onStripe); spc.addEventListener('change', onStripe); }

    // Resize hook: redraw strip when canvas size changes
    window.addEventListener('resize', function(){ if (mode !== 'source') applyView(); });

    setUiEnabled();
    setMode('source');
  }

  api.setMode = setMode;
  api.getMode = function(){ return mode; };
  api.init = attach;

  window.addEventListener('load', attach);
})();
