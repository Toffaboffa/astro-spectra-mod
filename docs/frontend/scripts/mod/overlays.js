(function(global){
  "use strict";
  const sp = global.SpectraPro = global.SpectraPro || {};
  const formatChemicalLabel = (sp.utils && typeof sp.utils.formatChemicalLabel === 'function')
    ? sp.utils.formatChemicalLabel
    : function (label) { return String(label == null ? '' : label); };

  function normalizeSpeciesKey(value){
    return String(value == null ? '' : value)
      .trim()
      .replace(/[₀-₉]/g, function(ch){ return String('₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)); })
      .replace(/⁺/g, '+')
      .replace(/⁻/g, '-')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

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
      smartRadius: readNum('--sp-graph-smart-radius', 7),
      labelBg: read('--sp-graph-label-bg', 'rgba(255,255,255,0.82)'),
      labelBorder: read('--sp-graph-label-border', 'rgba(30,41,59,0.22)'),
      excludedMark: read('--sp-graph-excluded-mark', 'rgba(220,38,38,0.98)'),
      diffractionBg: read('--sp-graph-diffraction-bg', 'rgba(248,245,255,0.92)'),
      diffractionBorder: read('--sp-graph-diffraction-border', 'rgba(109,40,217,0.46)'),
      diffractionText: read('--sp-graph-diffraction-text', 'rgba(76,29,149,0.96)'),
      diffractionLine: read('--sp-graph-diffraction-line', 'rgba(109,40,217,0.46)')
    };
  }

  function drawDiffractionCandidates(ctx, graphState, state, activeMode) {
    try {
      if (String(activeMode || '').toUpperCase() !== 'LAB') return 0;
      if (state && state.display && state.display.diffractionOverlay === false) return 0;
      const candidates = state && state.analysis && Array.isArray(state.analysis.diffractionCandidates)
        ? state.analysis.diffractionCandidates
        : [];
      if (!candidates.length || !ctx || !ctx.canvas) return 0;

      const calcX = (typeof global.calculateXPosition === 'function') ? global.calculateXPosition : null;
      const pxFromNm = (typeof global.getPxByWaveLengthBisection === 'function') ? global.getPxByWaveLengthBisection : null;
      const zoomStart = graphState && Number.isFinite(+graphState.zoomStart) ? +graphState.zoomStart : null;
      const zoomEnd = graphState && Number.isFinite(+graphState.zoomEnd) ? +graphState.zoomEnd : null;
      const widthForCalc = graphState && Number.isFinite(+graphState.cssWidth) && +graphState.cssWidth > 0 ? +graphState.cssWidth : null;
      if (!calcX || !Number.isFinite(zoomStart) || !Number.isFinite(zoomEnd) || !(zoomEnd > zoomStart)) return 0;

      const canvas = ctx.canvas;
      const w = canvas.width;
      const wCalc = widthForCalc || w;
      const plotBounds = (typeof global.getGraphPlotBounds === 'function') ? global.getGraphPlotBounds(canvas) : null;
      const plotLeft = plotBounds && Number.isFinite(+plotBounds.left) ? +plotBounds.left : 30;
      const plotRight = plotBounds && Number.isFinite(+plotBounds.right) ? +plotBounds.right : (w - 30);
      const plotTop = plotBounds && Number.isFinite(+plotBounds.top) ? +plotBounds.top : 30;
      const plotBottom = plotBounds && Number.isFinite(+plotBounds.bottom) ? +plotBounds.bottom : (canvas.height - 30);
      let drawn = 0;

      const theme = getCanvasTheme(canvas);
      ctx.save();
      ctx.font = '9px Verdana';
      ctx.textBaseline = 'middle';

      function roundedRectPath(x, y, width, height, radius) {
        const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }

      candidates.slice(0, 12).forEach(function (candidate) {
        let px = Number(candidate && candidate.childSampleIndex);
        if (!Number.isFinite(px) && pxFromNm && Number.isFinite(Number(candidate && candidate.observedNm))) {
          px = Number(pxFromNm(Number(candidate.observedNm)));
        }
        if (!Number.isFinite(px) || px < zoomStart || px >= zoomEnd) return;

        const rawX = calcX(px - zoomStart, zoomEnd - zoomStart, wCalc);
        const x = (wCalc && w && wCalc !== w) ? rawX * (w / wCalc) : rawX;
        if (!Number.isFinite(x) || x < plotLeft || x > plotRight) return;

        const order = Math.max(2, Math.round(Number(candidate.order) || 2));
        const observed = Number(candidate.observedNm);
        const parent = Number(candidate.parentNm);
        const label = order + '×? ' +
          (Number.isFinite(observed) ? observed.toFixed(1) : '?') +
          ' ← ' + (Number.isFinite(parent) ? parent.toFixed(1) : '?');

        const row = drawn % 4;
        const y = plotTop + 10 + row * 15;
        const metrics = ctx.measureText(label);
        const boxW = Math.ceil(metrics.width + 8);
        const boxH = 13;
        let boxX = x + 4;
        if (boxX + boxW > plotRight - 2) boxX = x - boxW - 4;
        boxX = Math.max(plotLeft + 2, Math.min(plotRight - boxW - 2, boxX));
        const boxY = Math.max(plotTop + 2, Math.min(plotBottom - boxH - 2, y - boxH / 2));

        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = theme.diffractionLine;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x, boxY + boxH);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();

        ctx.setLineDash([]);
        roundedRectPath(boxX, boxY, boxW, boxH, 4);
        ctx.fillStyle = theme.diffractionBg;
        ctx.fill();
        ctx.strokeStyle = theme.diffractionBorder;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.fillStyle = theme.diffractionText;
        ctx.fillText(label, boxX + 4, boxY + boxH / 2 + 0.2);
        drawn += 1;
      });

      ctx.restore();
      return drawn;
    } catch (_) {
      return 0;
    }
  }

  function drawOnGraph(ctx, graphState){
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const mode = sp.appMode && typeof sp.appMode.getMode === 'function' ? sp.appMode.getMode() : 'CORE';
      const activeMode = String(mode || 'CORE').toUpperCase();
      const isAstro = activeMode === 'ASTRO';
      if (activeMode !== 'LAB' && !isAstro) return { ok:true, labels:0, bands:0, graphState: !!graphState };
      if (!state || !(state.analysis && state.analysis.enabled)) return { ok:true, labels:0, bands:0, graphState: !!graphState };
      const astroLabelSettings = (state.analysis && state.analysis.astroLabels) || {};
      if (isAstro && astroLabelSettings.enabled === false) return { ok:true, labels:0, bands:0, graphState: !!graphState, hidden:true };
      const showLabHits = !isAstro && !(state.analysis && state.analysis.showHits === false);
      const smartEnabled = !isAstro && !!(state.analysis && state.analysis.smartFindEnabled);
      const hits = isAstro
        ? ((state.analysis && state.analysis.astro && Array.isArray(state.analysis.astro.referenceMatches)) ? state.analysis.astro.referenceMatches : [])
        : (showLabHits
          ? ((state.analysis && Array.isArray(state.analysis.rawTopHits) && state.analysis.rawTopHits.length)
            ? state.analysis.rawTopHits
            : ((state.analysis && Array.isArray(state.analysis.topHits)) ? state.analysis.topHits : []))
          : []);
      const smartGroups = !isAstro && state.analysis && Array.isArray(state.analysis.smartFindGroups) ? state.analysis.smartFindGroups : [];

      const canvas = ctx && ctx.canvas;
      if (!canvas) return { ok:true, labels:0, bands:0, graphState: !!graphState };

      const diffractionMarkers = drawDiffractionCandidates(ctx, graphState, state, activeMode);
      if (!hits.length) return { ok:true, labels:0, bands:0, diffractionMarkers:diffractionMarkers, graphState: !!graphState, hidden:!showLabHits };

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
      const plotBounds = (typeof global.getGraphPlotBounds === 'function') ? global.getGraphPlotBounds(canvas) : null;
      const plotLeft = plotBounds && Number.isFinite(+plotBounds.left) ? +plotBounds.left : padding;
      const plotRight = plotBounds && Number.isFinite(+plotBounds.right) ? +plotBounds.right : (w - padding);
      const plotTop = plotBounds && Number.isFinite(+plotBounds.top) ? +plotBounds.top : 30;
      const plotBottom = plotBounds && Number.isFinite(+plotBounds.bottom) ? +plotBounds.bottom : (h - 30);
      const plotHeight = Math.max(1, plotBottom - plotTop);
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
        return plotBottom - (localMax / latestMaxValue) * plotHeight;
      }
      function calcDipY(pxObserved){
        if (!latestI || !latestI.length || !Number.isFinite(pxObserved)) return null;
        const idx = Math.max(0, Math.min(latestI.length - 1, Math.round(pxObserved)));
        let localMin = Infinity;
        for (let jj = Math.max(0, idx - 1); jj <= Math.min(latestI.length - 1, idx + 1); jj += 1) {
          const val = Number(latestI[jj]);
          if (Number.isFinite(val) && val < localMin) localMin = val;
        }
        if (!Number.isFinite(localMin) || !Number.isFinite(latestMaxValue) || latestMaxValue <= 0) return null;
        return plotBottom - (Math.max(0, localMin) / latestMaxValue) * plotHeight;
      }

      const highlightElements = Object.create(null);
      let bestHighlightKey = '';
      for (let gi = 0; gi < smartGroups.length && gi < 6; gi += 1) {
        const raw = String((smartGroups[gi] && (smartGroups[gi].element || smartGroups[gi].species || smartGroups[gi].speciesKey)) || '').trim();
        const key = normalizeSpeciesKey(raw);
        if (key) {
          highlightElements[key] = gi;
          if (!bestHighlightKey) bestHighlightKey = key;
        }
      }
      const highlightedSeen = Object.create(null);
      const clustered = [];
      const clusterTolerancePx = 2.5;
      const astroMinDepth = Number.isFinite(Number(astroLabelSettings.minDepth))
        ? Math.max(0.01, Math.min(0.95, Number(astroLabelSettings.minDepth)))
        : 0.08;
      const astroMinSpacingPx = Number.isFinite(Number(astroLabelSettings.minSpacingPx))
        ? Math.max(8, Math.min(240, Number(astroLabelSettings.minSpacingPx)))
        : 48;

      for (let i = 0; i < hits.length; i += 1) {
        const hit = hits[i] || {};
        const depth = Number(hit.depth);
        if (isAstro && (!Number.isFinite(depth) || depth < astroMinDepth)) continue;
        const observedNm = Number(hit.observedNm != null ? hit.observedNm : (hit.referenceNm != null ? hit.referenceNm : null));
        const referenceNm = Number(hit.referenceNm != null ? hit.referenceNm : observedNm);
        const peakIndexRaw = Number(hit.peakIndex);
        let pxObserved = Number.isFinite(peakIndexRaw) ? peakIndexRaw : NaN;
        if (!Number.isFinite(pxObserved) && Number.isFinite(observedNm)) pxObserved = pxFromNm(observedNm);
        if (!Number.isFinite(pxObserved) || pxObserved < zoomStart || pxObserved >= zoomEnd) continue;
        const x = calcX(pxObserved - zoomStart, zoomEnd - zoomStart, wCalc);
        const xCanvas = (wCalc && w && wCalc !== w) ? (x * (w / wCalc)) : x;
        if (!Number.isFinite(xCanvas) || xCanvas < plotLeft || xCanvas > plotRight) continue;
        const name = String(isAstro ? (hit.label || hit.species || hit.speciesKey || hit.element || '') : (hit.element || hit.species || hit.speciesKey || '')).trim();
        if (!name) continue;
        const deltaNm = Number.isFinite(referenceNm) ? Math.abs(referenceNm - observedNm) : NaN;
        const species = String(hit.species || '').trim();
        const astroLabel = isAstro && species && normalizeSpeciesKey(name).indexOf(normalizeSpeciesKey(species)) !== 0
          ? (name + ' · ' + species)
          : name;
        const item = {
          hit: hit,
          label: isAstro ? formatChemicalLabel(astroLabel) : (formatChemicalLabel(name) + ' ' + formatDeltaNm(deltaNm)),
          speciesKey: normalizeSpeciesKey(name),
          deltaNm: deltaNm,
          depth: depth,
          observedNm: observedNm,
          referenceNm: referenceNm,
          xCanvas: xCanvas,
          peakY: isAstro ? calcDipY(pxObserved) : calcPeakY(pxObserved),
          excludedByDiffraction: !!hit.excludedByDiffraction
        };
        if (isAstro) {
          clustered.push({ xCanvas: xCanvas, items: [item] });
          continue;
        }
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

      if (isAstro && clustered.length > 1) {
        const strongestFirst = clustered.slice().sort(function (a, b) {
          const ai = a.items[0];
          const bi = b.items[0];
          if (bi.depth !== ai.depth) return bi.depth - ai.depth;
          const as = Number(ai.hit.score) || 0;
          const bs = Number(bi.hit.score) || 0;
          return bs - as;
        });
        const selected = [];
        for (let si = 0; si < strongestFirst.length; si += 1) {
          const candidate = strongestFirst[si];
          const isFarEnough = selected.every(function (chosen) {
            return Math.abs(chosen.xCanvas - candidate.xCanvas) >= astroMinSpacingPx;
          });
          if (isFarEnough) selected.push(candidate);
        }
        clustered.length = 0;
        Array.prototype.push.apply(clustered, selected);
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
      const topAnchorY = Math.max(1, Math.round(plotTop + 2));
      const lowPeakThresholdY = 92;
      const peakLabelGap = 4;
      const occupiedLabelRects = [];

      function rectsOverlap(a, b) {
        return !(a.right + 2 <= b.left || a.left >= b.right + 2 || a.bottom + 2 <= b.top || a.top >= b.bottom + 2);
      }

      function placeLabelStack(group, preferredY, stackHeight) {
        let maxWidth = 0;
        group.items.forEach(function (item) {
          maxWidth = Math.max(maxWidth, Math.ceil(ctx.measureText(item.label).width) + theme.smartPadX * 2 + 4);
        });
        const left = Math.max(plotLeft + 1, Math.min(plotRight - maxWidth - 1, group.xCanvas + xOffset - theme.smartPadX));
        const maxTop = Math.max(topAnchorY, plotBottom - stackHeight - 2);
        const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];
        let fallback = null;
        for (let oi = 0; oi < offsets.length; oi += 1) {
          const top = Math.max(topAnchorY, Math.min(maxTop, preferredY + offsets[oi] * rowStep));
          const rect = { left: left, right: left + maxWidth, top: top, bottom: top + stackHeight };
          if (!fallback) fallback = { top: top, rect: rect };
          if (!occupiedLabelRects.some(function (used) { return rectsOverlap(rect, used); })) {
            occupiedLabelRects.push(rect);
            return top;
          }
        }
        occupiedLabelRects.push(fallback.rect);
        return fallback.top;
      }

      for (let gi = 0; gi < clustered.length; gi += 1) {
        const group = clustered[gi];
        const xCanvas = group.xCanvas;
        group.items.sort(function(a, b){
          const ad = Number.isFinite(a.deltaNm) ? a.deltaNm : 1e9;
          const bd = Number.isFinite(b.deltaNm) ? b.deltaNm : 1e9;
          if (ad !== bd) return ad - bd;
          return (Number(b.hit.confidence) || 0) - (Number(a.hit.confidence) || 0);
        });

        const peakY = group.items.reduce(function(best, item){
          if (!Number.isFinite(item.peakY)) return best;
          return !Number.isFinite(best) ? item.peakY : Math.min(best, item.peakY);
        }, NaN);
        const stackHeight = Math.max(theme.smartHeight, group.items.length * rowStep);
        const preferredStartY = isAstro
          ? Math.max(topAnchorY, Math.min(plotBottom - stackHeight - 2, topAnchorY + (gi % 2) * rowStep))
          : ((Number.isFinite(peakY) && peakY > lowPeakThresholdY)
            ? Math.max(Math.round(plotTop + 2), Math.min(Math.round(plotBottom - stackHeight - 2), Math.round(peakY - stackHeight - peakLabelGap)))
            : topAnchorY);
        const startY = placeLabelStack(group, preferredStartY, stackHeight);
        const lineTopY = Math.max(plotTop, Math.min(plotBottom, startY + Math.round(theme.smartHeight * 0.5)));

        ctx.beginPath();
        if (isAstro) {
          ctx.moveTo(xCanvas, lineTopY);
          ctx.lineTo(xCanvas, Number.isFinite(peakY) ? peakY : plotBottom);
        } else {
          ctx.moveTo(xCanvas, plotBottom);
          ctx.lineTo(xCanvas, lineTopY);
        }
        ctx.save();
        ctx.strokeStyle = markerStroke;
        ctx.stroke();
        ctx.restore();

        for (let ri = 0; ri < group.items.length; ri += 1) {
          const item = group.items[ri];
          const label = item.label;
          const labelWidth = Math.ceil(ctx.measureText(label).width);
          const tx = Math.max(2, Math.min(w - labelWidth - 2, xCanvas + xOffset));
          const ty = startY + ri * rowStep;
          ctx.save();
          ctx.setLineDash([]);
          const isBestMatchHit = !!(bestHighlightKey && item.speciesKey === bestHighlightKey);
          const isSmartHighlight = !!(
            !item.excludedByDiffraction &&
            smartEnabled &&
            item.speciesKey &&
            Object.prototype.hasOwnProperty.call(highlightElements, item.speciesKey) &&
            (isBestMatchHit || !highlightedSeen[item.speciesKey])
          );
          if (isSmartHighlight) {
            if (!isBestMatchHit) highlightedSeen[item.speciesKey] = true;
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
          } else if (!isAstro) {
            const metrics = ctx.measureText(label);
            const padX = 3;
            const padY = 2;
            const bw = Math.max(12, Math.ceil(metrics.width + padX * 2));
            const bh = Math.max(13, theme.smartHeight - 1);
            const bx = Math.max(2, Math.min(w - bw - 2, tx - padX));
            const by = Math.max(1, ty - padY);
            ctx.fillStyle = theme.labelBg;
            ctx.strokeStyle = theme.labelBorder;
            ctx.lineWidth = 0.8;
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeRect(bx, by, bw, bh);
          }
          ctx.lineWidth = 3;
          ctx.strokeStyle = textStroke;
          ctx.strokeText(label, tx, ty);
          ctx.fillStyle = isSmartHighlight ? theme.smartTextColor : theme.overlayTextColor;
          ctx.fillText(label, tx, ty);

          if (item.excludedByDiffraction && !isAstro) {
            const cx = tx + labelWidth * 0.5;
            const cy = Math.max(plotTop + 5, ty - 5);
            const arm = 4;
            ctx.beginPath();
            ctx.strokeStyle = theme.excludedMark;
            ctx.lineWidth = 2.3;
            ctx.setLineDash([]);
            ctx.moveTo(cx - arm, cy - arm);
            ctx.lineTo(cx + arm, cy + arm);
            ctx.moveTo(cx + arm, cy - arm);
            ctx.lineTo(cx - arm, cy + arm);
            ctx.stroke();
          }
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
