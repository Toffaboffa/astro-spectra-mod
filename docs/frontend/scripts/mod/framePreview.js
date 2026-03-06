(function(){
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});

  const api = sp.framePreview || (sp.framePreview = {});

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
    const hasDark = !!sub.hasDark && sub.darkRGB && (Array.isArray(sub.darkRGB.R) || Array.isArray(sub.darkRGB.G) || Array.isArray(sub.darkRGB.B));
    const hasRef = !!sub.hasReference && sub.referenceRGB && (Array.isArray(sub.referenceRGB.R) || Array.isArray(sub.referenceRGB.G) || Array.isArray(sub.referenceRGB.B));

    const darkRadio = $('spFrameViewDark');
    const refRadio = $('spFrameViewRef');
    if (darkRadio) darkRadio.disabled = !hasDark;
    if (refRadio) refRadio.disabled = !hasRef;

    // Graph toggles in CORE
    const tDark = $('toggleDark');
    const tRef = $('toggleRef');
    if (tDark) tDark.disabled = !hasDark;
    if (tRef) tRef.disabled = !hasRef;

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
    const video = $('videoMain');
    const img = $('cameraImage');
    const preview = $('spFramePreviewCanvas');

    if (mode === 'source'){
      hide(preview);
      // Let existing logic decide whether video or image is visible
      return;
    }

    // Force preview canvas and hide video/image to avoid confusion
    if (video) hide(video);
    if (img) hide(img);
    if (preview) show(preview);

    const rgb = getRgb(mode === 'dark' ? 'dark' : 'ref');
    renderRgbStrip(rgb || {});
  }

  function setMode(next){
    const m = String(next || 'source').toLowerCase();
    mode = (m === 'dark' || m === 'ref') ? m : 'source';
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
