(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const store = sp.store;
  const bus = sp.eventBus;

  function isStaticImageSource() {
    try {
      const img = document.getElementById('cameraImage');
      if (!img || !img.src || !img.complete || !(Number(img.naturalWidth) > 0)) return false;
      const rt = sp.runtime || {};
      if (typeof rt.isSourceLive === 'function' && rt.isSourceLive()) return false;
      const filename = document.getElementById('loadedImageFilename');
      if (filename && String(filename.textContent || '').trim() && global.getComputedStyle(filename).display !== 'none') return true;
      return global.getComputedStyle(img).display !== 'none';
    } catch (_) {
      return false;
    }
  }

  function redrawStaticImage(options) {
    if (!isStaticImageSource()) return false;
    const opts = Object.assign({ suppressGraphFrame: false, invalidatePeaks: false }, options || {});
    const redraw = global.redrawGraphIfLoadedImage;
    const draw = global.drawGraph;
    const hooks = sp.coreHooks;
    const originalEmit = hooks && typeof hooks.emit === 'function' ? hooks.emit : null;

    if (opts.suppressGraphFrame && originalEmit) {
      hooks.emit = function (name) {
        if (name === 'graphFrame') return undefined;
        return originalEmit.apply(this, arguments);
      };
    }

    try {
      if (typeof redraw === 'function') redraw(!!opts.invalidatePeaks);
      else if (typeof draw === 'function') draw();
      return true;
    } catch (_) {
      return false;
    } finally {
      if (opts.suppressGraphFrame && originalEmit) hooks.emit = originalEmit;
    }
  }

  function patchKeys(evt) {
    const patch = evt && evt.patch && typeof evt.patch === 'object' ? evt.patch : null;
    return patch ? Object.keys(patch) : [];
  }

  function matchesAny(keys, paths) {
    return keys.some(function (key) {
      const k = String(key || '');
      return paths.some(function (path) {
        const p = String(path || '');
        return k === p || k.indexOf(p + '.') === 0;
      });
    });
  }

  function getScoreShare(row) {
    const raw = row && (row.scoreSharePct != null ? row.scoreSharePct : row.likelyPct);
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function getEvidenceCount(row) {
    const raw = row && (
      row.plasmaMatchedBands != null ? row.plasmaMatchedBands :
      row.matchedPeaks != null ? row.matchedPeaks :
      row.matchedCount != null ? row.matchedCount :
      row.lineCount != null ? row.lineCount : row.matchCount
    );
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function strongSmartGroupsFromRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
      const share = getScoreShare(row);
      const evidence = getEvidenceCount(row);
      return share != null && share >= 5 && evidence != null && evidence >= 2;
    }).slice(0, 3);
  }

  function sameElements(a, b) {
    const aa = (Array.isArray(a) ? a : []).map(function (x) { return String(x && x.element || ''); });
    const bb = (Array.isArray(b) ? b : []).map(function (x) { return String(x && x.element || ''); });
    return aa.length === bb.length && aa.every(function (v, i) { return v === bb[i]; });
  }

  function applyStrongSmartFilter() {
    if (!store || typeof store.getState !== 'function' || typeof store.update !== 'function') return;
    const state = store.getState() || {};
    const analysis = state.analysis || {};
    const rows = Array.isArray(analysis.elementScores) ? analysis.elementScores : [];
    if (!rows.length) return;

    const strongGroups = strongSmartGroupsFromRows(rows);
    const currentGroups = Array.isArray(analysis.smartFindGroups) ? analysis.smartFindGroups : [];
    const allowed = Object.create(null);
    strongGroups.forEach(function (g) { allowed[String(g && g.element || '')] = true; });

    if (!sameElements(currentGroups, strongGroups)) {
      const normalizedGroups = strongGroups.map(function (g) {
        return Object.assign({}, g, {
          lineCount: Number(g && g.matchedPeaks) || Number(g && g.lineCount) || 0,
          memberCount: Number(g && g.matchCount) || Number(g && g.memberCount) || 0,
          bestConfidence: Number(g && g.explainedShare) || 0,
          avgConfidence: Number(g && g.closenessScore) || 0
        });
      });
      store.update('analysis.smartFindGroups', normalizedGroups, { source: 'labReactivePatch.smartFilter' });
    }

    const currentHits = Array.isArray(analysis.smartFindHits) ? analysis.smartFindHits : [];
    const filteredHits = currentHits.filter(function (h) { return allowed[String(h && h.element || '')]; });
    if (filteredHits.length !== currentHits.length) {
      store.update('analysis.smartFindHits', filteredHits, { source: 'labReactivePatch.smartFilter' });
    }
  }

  function patchVisibleSmartLabels() {
    if (!store || typeof store.getState !== 'function') return;
    const state = store.getState() || {};
    const rows = state.analysis && Array.isArray(state.analysis.smartFindGroups) ? state.analysis.smartFindGroups : [];
    const smartRows = document.querySelectorAll('.sp-hit--smart');
    smartRows.forEach(function (el, idx) {
      const row = rows[idx] || null;
      if (!row || !el) return;
      const noun = String(row.mode || '').toLowerCase() === 'molecular' ? 'bands' : 'lines';
      const text = String(el.textContent || '');
      const next = text.replace(/\b(?:lines|bands)\s*$/i, noun);
      if (next !== text) el.textContent = next;
    });
  }

  function installStaticImageRefresh() {
    if (!bus || typeof bus.on !== 'function') return;

    const reanalyzePaths = [
      'analysis.enabled',
      'analysis.presetId',
      'analysis.includeWeakPeaks',
      'analysis.peakThresholdRel',
      'analysis.peakDistancePx',
      'analysis.maxDistanceNm',
      'analysis.strongPeakLevel',
      'analysis.useRgbScore',
      'subtraction.mode',
      'peaks.threshold',
      'peaks.distance',
      'peaks.smoothing',
      'calibration.coefficients',
      'calibration.points',
      'calibration.isCalibrated'
    ];
    const redrawPaths = [
      'analysis.showHits',
      'analysis.smartFindEnabled',
      'analysis.topHits',
      'analysis.rawTopHits',
      'analysis.smartFindHits',
      'analysis.smartFindGroups',
      'analysis.elementScores',
      'analysis.winnerBreakdown',
      'analysis.qcFlags',
      'analysis.offsetNm'
    ];

    let analyzeTimer = null;
    let redrawTimer = null;

    function queueAnalyze() {
      if (analyzeTimer) global.clearTimeout(analyzeTimer);
      analyzeTimer = global.setTimeout(function () {
        analyzeTimer = null;
        // This redraw intentionally emits graphFrame. That makes proBootstrap
        // run the worker again using the new LAB settings.
        redrawStaticImage({ suppressGraphFrame: false, invalidatePeaks: true });
      }, 340);
    }

    function queueOverlayRedraw() {
      if (redrawTimer) global.clearTimeout(redrawTimer);
      redrawTimer = global.setTimeout(function () {
        redrawTimer = null;
        // Worker output needs a fresh overlay, not another worker job.
        redrawStaticImage({ suppressGraphFrame: true, invalidatePeaks: false });
      }, 35);
    }

    bus.on('state:changed', function (evt) {
      if (!isStaticImageSource()) return;
      const source = evt && evt.meta && evt.meta.source ? String(evt.meta.source) : '';
      const keys = patchKeys(evt);
      if (!keys.length) return;

      if (source === 'labReactivePatch.smartFilter') {
        queueOverlayRedraw();
        return;
      }
      if (matchesAny(keys, reanalyzePaths)) {
        queueAnalyze();
        return;
      }
      if (matchesAny(keys, redrawPaths)) queueOverlayRedraw();
    });
  }

  function installSmartFiltering() {
    if (!bus || typeof bus.on !== 'function') return;

    bus.on('state:changed', function (evt) {
      const source = evt && evt.meta && evt.meta.source ? String(evt.meta.source) : '';
      if (source === 'labReactivePatch.smartFilter') return;
      const keys = patchKeys(evt);
      if (!matchesAny(keys, ['analysis.elementScores', 'analysis.smartFindGroups', 'analysis.smartFindHits'])) return;
      global.setTimeout(function () {
        applyStrongSmartFilter();
        patchVisibleSmartLabels();
      }, 0);
    });

    applyStrongSmartFilter();
    patchVisibleSmartLabels();

    if (typeof MutationObserver !== 'undefined' && document.body) {
      const observer = new MutationObserver(function () { patchVisibleSmartLabels(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function install() {
    installStaticImageRefresh();
    installSmartFiltering();
  }

  sp.labReactivePatch = {
    isStaticImageSource: isStaticImageSource,
    redrawStaticImage: redrawStaticImage,
    applyStrongSmartFilter: applyStrongSmartFilter
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window);
