(function(global){
  "use strict";
  const sp = global.SpectraPro = global.SpectraPro || {};
  function drawOnGraph(ctx, graphState){
    // Phase 2: draw lightweight line labels for LAB top hits.
    // Must remain CORE-safe: if anything is missing, do nothing.
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const mode = sp.appMode && typeof sp.appMode.getMode === 'function' ? sp.appMode.getMode() : 'CORE';
      if (String(mode || 'CORE').toUpperCase() !== 'LAB') return { ok:true, labels:0, bands:0, graphState: !!graphState };
      if (!state || !(state.analysis && state.analysis.enabled)) return { ok:true, labels:0, bands:0, graphState: !!graphState };
      const hits = (state.analysis && Array.isArray(state.analysis.topHits)) ? state.analysis.topHits : [];
      if (!hits.length) return { ok:true, labels:0, bands:0, graphState: !!graphState };

      const canvas = ctx && ctx.canvas;
      if (!canvas) return { ok:true, labels:0, bands:0, graphState: !!graphState };

      // Access globals used by original SPECTRA scripts.
      const rb = (typeof global.rangeBeginX !== 'undefined') ? Number(global.rangeBeginX) : 0;
      const re = (typeof global.rangeEndX !== 'undefined') ? Number(global.rangeEndX) : (typeof global.width !== 'undefined' ? Number(global.width) : 0);
      const hasRange = Number.isFinite(rb) && Number.isFinite(re) && re > rb;
      const pxFromNm = (typeof global.getPxByWaveLengthBisection === 'function') ? global.getPxByWaveLengthBisection : null;
      if (!hasRange || !pxFromNm) return { ok:true, labels:0, bands:0, graphState: !!graphState };

      const w = canvas.width;
      const h = canvas.height;
      const maxLabels = 6;
      let labels = 0;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = '12px Arial';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;

      for (let i = 0; i < hits.length && labels < maxLabels; i++) {
        const hit = hits[i] || {};
        const conf = Number(hit.confidence);
        if (Number.isFinite(conf) && conf < 0.15) continue;
        const nm = (hit.referenceNm != null ? Number(hit.referenceNm) : (hit.observedNm != null ? Number(hit.observedNm) : null));
        if (!Number.isFinite(nm)) continue;
        const px = pxFromNm(nm);
        if (!Number.isFinite(px)) continue;
        const x = ((px - rb) / (re - rb)) * w;
        if (!Number.isFinite(x) || x < 0 || x > w) continue;

        // Marker line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Label
        const name = String(hit.species || hit.element || '');
        const label = name ? (name + ' ' + (Math.round(nm * 100) / 100).toFixed(2) + 'nm') : ((Math.round(nm * 100) / 100).toFixed(2) + 'nm');
        const tx = Math.max(2, Math.min(w - 2, x + 4));
        const ty = 2 + labels * 14;
        ctx.fillText(label, tx, ty);

        labels += 1;
      }

      ctx.restore();
      return { ok:true, labels:labels, bands:0, graphState: !!graphState };
    } catch (e) {
      return { ok:true, labels:0, bands:0, graphState: !!graphState };
    }
  }
  sp.overlays = { drawOnGraph };
})(window);
