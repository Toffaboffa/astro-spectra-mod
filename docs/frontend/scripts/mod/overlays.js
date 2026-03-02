(function(global){
  "use strict";
  const sp = global.SpectraPro = global.SpectraPro || {};
  function getCanvasTheme(canvas){
    const styles = (canvas && global.getComputedStyle) ? global.getComputedStyle(canvas) : null;
    function read(name, fallback){
      if (!styles) return fallback;
      const v = String(styles.getPropertyValue(name) || '').trim();
      return v || fallback;
    }
    function readNum(name, fallback){
      const raw = read(name, '');
      const n = Number(String(raw).replace(/[^0-9+-.]/g, ''));
      return Number.isFinite(n) ? n : fallback;
    }
    function readDash(name, fallback){
      const raw = read(name, '');
      if (!raw) return fallback;
      const arr = raw.split(/[ ,]+/).map(function(v){ return Number(v); }).filter(Number.isFinite);
      return arr.length ? arr : fallback;
    }
    return {
      overlayFont: read('--sp-graph-overlay-font', '12px Arial'),
      overlayTextColor: read('--sp-graph-overlay-text-color', 'rgba(255,255,255,0.95)'),
      overlayTextStroke: read('--sp-graph-overlay-text-stroke', 'rgba(0,0,0,0.85)'),
      overlayLineColor: read('--sp-graph-overlay-line-color', 'rgba(0,0,0,0.35)'),
      overlayLineWidth: readNum('--sp-graph-overlay-line-width', 1),
      overlayLineDash: readDash('--sp-graph-overlay-line-dash', [4,4]),
      smartBg: read('--sp-graph-smart-bg', 'rgba(214,169,52,0.95)'),
      smartBorder: read('--sp-graph-smart-border', 'rgba(71,48,0,0.95)'),
      smartTextColor: read('--sp-graph-smart-text-color', 'rgba(22,22,22,0.98)'),
      smartPadX: readNum('--sp-graph-smart-pad-x', 5),
      smartPadY: readNum('--sp-graph-smart-pad-y', 2),
      smartHeight: readNum('--sp-graph-smart-height', 14),
      smartRadius: readNum('--sp-graph-smart-radius', 7)
    };
  }
  function drawOnGraph(ctx, graphState){
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const mode = sp.appMode && typeof sp.appMode.getMode === 'function' ? sp.appMode.getMode() : 'CORE';
      if (String(mode || 'CORE').toUpperCase() !== 'LAB') return { ok:true, labels:0, bands:0, graphState: !!graphState };
      if (!state || !(state.analysis && state.analysis.enabled)) return { ok:true, labels:0, bands:0, graphState: !!graphState };
      if (state.analysis && state.analysis.showHits === false) return { ok:true, labels:0, bands:0, graphState: !!graphState, hidden:true };
      const smartEnabled = !!(state.analysis && state.analysis.smartFindEnabled);
      const hits = (state.analysis && Array.isArray(state.analysis.rawTopHits) && state.analysis.rawTopHits.length)
        ? state.analysis.rawTopHits
        : ((state.analysis && Array.isArray(state.analysis.topHits)) ? state.analysis.topHits : []);
      const smartGroups = (state.analysis && Array.isArray(state.analysis.smartFindGroups)) ? state.analysis.smartFindGroups : [];
      if (!hits.length) return { ok:true, labels:0, bands:0, graphState: !!graphState };

      const canvas = ctx && ctx.canvas;
      if (!canvas) return { ok:true, labels:0, bands:0, graphState: !!graphState };

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

      function formatDeltaNm(v){
        const n = Math.abs(Number(v));
        if (!Number.isFinite(n)) return '';
        const rounded = Math.round(n * 10) / 10;
        return String(rounded.toFixed(1)).replace(/\.0$/, '');
      }

      const w = canvas.width;
      const h = canvas.height;
      const theme = getCanvasTheme(canvas);
      const wCalc = widthForCalc || w;
      const latestFrame = (state && state.frame && state.frame.latest) ? state.frame.latest : null;
      const latestI = latestFrame && Array.isArray(latestFrame.I) ? latestFrame.I : null;
      let latestMaxValue = 0;
      if (latestI && latestI.length) {
        for (let ii = 0; ii < latestI.length; ii += 1) {
          const val = Number(latestI[ii]) || 0;
          if (val > latestMaxValue) latestMaxValue = val;
        }
        latestMaxValue += 15;
      }
      function calcPeakY(pxObserved){
        if (!latestI || !latestI.length || !Number.isFinite(pxObserved)) return null;
        const idx = Math.max(0, Math.min(latestI.length - 1, Math.round(pxObserved)));
        let localMax = 0;
        for (let jj = Math.max(0, idx - 1); jj <= Math.min(latestI.length - 1, idx + 1); jj += 1) {
          const val = Number(latestI[jj]) || 0;
          if (val > localMax) localMax = val;
        }
        if (!Number.isFinite(localMax) || localMax <= 0 || !Number.isFinite(latestMaxValue) || latestMaxValue <= 0) return null;
        const paddingY = 30;
        return h - paddingY - (localMax / latestMaxValue) * (h - 2 * paddingY);
      }
      const highlightElements = Object.create(null);
      for (let gi = 0; gi < smartGroups.length && gi < 6; gi += 1) {
        const el = String((smartGroups[gi] && smartGroups[gi].element) || '').trim();
        if (el) highlightElements[el] = gi;
      }
      const highlightedSeen = Object.create(null);
      const clustered = [];
      const clusterTolerancePx = 2.5;

      for (let i = 0; i < hits.length; i += 1) {
        const hit = hits[i] || {};
        const observedNm = Number(hit.observedNm != null ? hit.observedNm : (hit.referenceNm != null ? hit.referenceNm : null));
        const referenceNm = Number(hit.referenceNm != null ? hit.referenceNm : observedNm);
        const peakIndexRaw = Number(hit.peakIndex);
        let pxObserved = Number.isFinite(peakIndexRaw) ? peakIndexRaw : NaN;
        if (!Number.isFinite(pxObserved) && Number.isFinite(observedNm)) pxObserved = pxFromNm(observedNm);
        if (!Number.isFinite(pxObserved) || pxObserved < zoomStart || pxObserved >= zoomEnd) continue;
        const x = calcX(pxObserved - zoomStart, zoomEnd - zoomStart, wCalc);
        const xCanvas = (wCalc && w && wCalc !== w) ? (x * (w / wCalc)) : x;
        if (!Number.isFinite(xCanvas) || xCanvas < padding || xCanvas > (w - padding)) continue;
        const name = String(hit.element || hit.species || '').trim();
        if (!name) continue;
        const deltaNm = Number.isFinite(referenceNm) ? Math.abs(referenceNm - observedNm) : NaN;
        const item = {
          hit: hit,
          label: name + ' ' + formatDeltaNm(deltaNm),
          element: name,
          deltaNm: deltaNm,
          observedNm: observedNm,
          referenceNm: referenceNm,
          xCanvas: xCanvas,
          peakY: calcPeakY(pxObserved)
        };
        let group = null;
        for (let ci = 0; ci < clustered.length; ci += 1) {
          if (Math.abs(clustered[ci].xCanvas - xCanvas) <= clusterTolerancePx) { group = clustered[ci]; break; }
        }
        if (!group) {
          group = { xCanvas: xCanvas, items: [] };
          clustered.push(group);
        }
        group.items.push(item);
      }

      clustered.sort(function(a, b){ return a.xCanvas - b.xCanvas; });
      let labels = 0;

      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.font = theme.overlayFont;
      ctx.textBaseline = 'top';
      ctx.fillStyle = theme.overlayTextColor;
      ctx.strokeStyle = theme.overlayLineColor;
      ctx.lineWidth = theme.overlayLineWidth;
      ctx.setLineDash(theme.overlayLineDash);
      const textStroke = theme.overlayTextStroke;
      const markerStroke = theme.overlayLineColor;
      const rowStep = Math.max(14, Math.round(theme.smartHeight + 2));
      const xOffset = 5;
      const topAnchorY = 2;
      const lowPeakThresholdY = 92;
      const peakLabelGap = 4;

      for (let gi = 0; gi < clustered.length; gi += 1) {
        const group = clustered[gi];
        const xCanvas = group.xCanvas;
        group.items.sort(function(a, b){
          const ad = Number.isFinite(a.deltaNm) ? a.deltaNm : 1e9;
          const bd = Number.isFinite(b.deltaNm) ? b.deltaNm : 1e9;
          if (ad !== bd) return ad - bd;
          return (Number(b.hit.confidence) || 0) - (Number(a.hit.confidence) || 0);
        });

        ctx.beginPath();
        ctx.moveTo(xCanvas, 0);
        ctx.lineTo(xCanvas, h);
        ctx.save();
        ctx.strokeStyle = markerStroke;
        ctx.stroke();
        ctx.restore();

        const peakY = group.items.reduce(function(best, item){
          if (!Number.isFinite(item.peakY)) return best;
          return !Number.isFinite(best) ? item.peakY : Math.min(best, item.peakY);
        }, NaN);
        const stackHeight = Math.max(theme.smartHeight, group.items.length * rowStep);
        const startY = (Number.isFinite(peakY) && peakY > lowPeakThresholdY)
          ? Math.max(2, Math.min(h - stackHeight - 2, Math.round(peakY - stackHeight - peakLabelGap)))
          : topAnchorY;

        for (let ri = 0; ri < group.items.length; ri += 1) {
          const item = group.items[ri];
          const label = item.label;
          const tx = Math.max(2, Math.min(w - 26, xCanvas + xOffset));
          const ty = startY + ri * rowStep;
          ctx.save();
          ctx.setLineDash([]);
          const isSmartHighlight = !!(smartEnabled && item.element && Object.prototype.hasOwnProperty.call(highlightElements, item.element) && !highlightedSeen[item.element]);
          if (isSmartHighlight) {
            highlightedSeen[item.element] = true;
            const metrics = ctx.measureText(label);
            const padX = theme.smartPadX;
            const padY = theme.smartPadY;
            const bw = Math.max(14, Math.ceil(metrics.width + padX * 2));
            const bh = theme.smartHeight;
            const bx = Math.max(2, Math.min(w - bw - 2, tx - padX));
            const by = Math.max(1, ty - padY);
            const radius = theme.smartRadius;
            ctx.beginPath();
            ctx.fillStyle = theme.smartBg;
            ctx.strokeStyle = theme.smartBorder;
            ctx.lineWidth = 1.2;
            ctx.moveTo(bx + radius, by);
            ctx.lineTo(bx + bw - radius, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
            ctx.lineTo(bx + bw, by + bh - radius);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
            ctx.lineTo(bx + radius, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
            ctx.lineTo(bx, by + radius);
            ctx.quadraticCurveTo(bx, by, bx + radius, by);
            ctx.fill();
            ctx.stroke();
          }
          ctx.lineWidth = 3;
          ctx.strokeStyle = textStroke;
          ctx.strokeText(label, tx, ty);
          ctx.fillStyle = isSmartHighlight ? theme.smartTextColor : theme.overlayTextColor;
          ctx.fillText(label, tx, ty);
          ctx.restore();
          labels += 1;
        }
      }

      ctx.restore();
      return { ok:true, labels:labels, bands:0, graphState: !!graphState };
    } catch (e) {
      return { ok:true, labels:0, bands:0, graphState: !!graphState };
    }
  }
  sp.overlays = { drawOnGraph };
})(window);
