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

      // Use the same mapping as graphScript.js. The legacy code keeps zoomStart/zoomEnd
      // inside graphScript, so we rely on graphState injected by the drawGraph wrapper.
      const pxFromNm = (typeof global.getPxByWaveLengthBisection === 'function') ? global.getPxByWaveLengthBisection : null;
      const calcX = (typeof global.calculateXPosition === 'function') ? global.calculateXPosition : null;
      const zoomStart = graphState && Number.isFinite(+graphState.zoomStart) ? +graphState.zoomStart : null;
      const zoomEnd = graphState && Number.isFinite(+graphState.zoomEnd) ? +graphState.zoomEnd : null;
      const padding = graphState && Number.isFinite(+graphState.padding) ? +graphState.padding : 30;
      const widthForCalc = (graphState && Number.isFinite(+graphState.cssWidth) && +graphState.cssWidth > 0)
        ? +graphState.cssWidth
        : null;
      const hasZoom = Number.isFinite(zoomStart) && Number.isFinite(zoomEnd) && zoomEnd > zoomStart;
      if (!pxFromNm || !calcX || !hasZoom) return { ok:true, labels:0, bands:0, graphState: !!graphState };

      const w = canvas.width;
      const h = canvas.height;
      const wCalc = widthForCalc || w;
      const maxLabels = 6;
      let labels = 0;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = '12px Arial';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      const textStroke = 'rgba(0,0,0,0.85)';
      const markerStroke = 'rgba(0,0,0,0.35)';

      for (let i = 0; i < hits.length && labels < maxLabels; i++) {
        const hit = hits[i] || {};
        const conf = Number(hit.confidence);
        if (Number.isFinite(conf) && conf < 0.15) continue;
        const nm = (hit.referenceNm != null ? Number(hit.referenceNm) : (hit.observedNm != null ? Number(hit.observedNm) : null));
        if (!Number.isFinite(nm)) continue;
        const px = pxFromNm(nm);
        if (!Number.isFinite(px)) continue;
        if (px < zoomStart || px >= zoomEnd) continue;
        const x = calcX(px - zoomStart, zoomEnd - zoomStart, wCalc);
        if (!Number.isFinite(x)) continue;

        // If calculateXPosition used CSS pixels, but the canvas uses device pixels, rescale.
        const xCanvas = (wCalc && w && wCalc !== w) ? (x * (w / wCalc)) : x;
        if (!Number.isFinite(xCanvas) || xCanvas < padding || xCanvas > (w - padding)) continue;

        // Marker line
        ctx.beginPath();
        ctx.moveTo(xCanvas, 0);
        ctx.lineTo(xCanvas, h);
        ctx.save();
        ctx.strokeStyle = markerStroke;
        ctx.stroke();
        ctx.restore();

        // Label
        // In-graph label should be compact: just the element/symbol.
        const name = String(hit.element || hit.species || '').trim();
        const label = name || '';
        const tx = Math.max(2, Math.min(w - 2, xCanvas + 4));
        const ty = 2 + labels * 14;
        ctx.save();
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = textStroke;
        ctx.strokeText(label, tx, ty);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(label, tx, ty);
        ctx.restore();

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
