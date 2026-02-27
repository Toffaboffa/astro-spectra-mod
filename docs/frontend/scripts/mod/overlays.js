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
      // IMPORTANT: the graph uses padding + zoomStart/zoomEnd when rendering X labels.
      // Use the same mapping so overlay lines actually land on the plotted area.
      const pxFromNm = (typeof global.getPxByWaveLengthBisection === 'function') ? global.getPxByWaveLengthBisection : null;
      const calcX = (typeof global.calculateXPosition === 'function') ? global.calculateXPosition : null;
      const zoomStart = (typeof global.zoomStart !== 'undefined') ? Number(global.zoomStart) : null;
      const zoomEnd = (typeof global.zoomEnd !== 'undefined') ? Number(global.zoomEnd) : null;
      const padding = 30; // must match graphScript.js
      const hasZoom = Number.isFinite(zoomStart) && Number.isFinite(zoomEnd) && zoomEnd > zoomStart;
      if (!pxFromNm || !calcX || !hasZoom) return { ok:true, labels:0, bands:0, graphState: !!graphState };

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
        if (px < zoomStart || px >= zoomEnd) continue;
        const x = calcX(px - zoomStart, zoomEnd - zoomStart, w);
        if (!Number.isFinite(x) || x < padding || x > (w - padding)) continue;

        // Marker line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Label
        // In-graph label should be compact: just the element/symbol.
        const name = String(hit.element || hit.species || '').trim();
        const label = name || '';
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
