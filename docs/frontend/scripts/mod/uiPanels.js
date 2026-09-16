(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function createModeTabs(container) {
    if (!container) return null;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'sp-mode-tabs';
    (sp.appMode ? sp.appMode.MODES : ['CORE', 'LAB', 'ASTRO']).forEach(function(mode) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = mode;
      btn.dataset.mode = mode;
      btn.addEventListener('click', function () { if (sp.appMode) sp.appMode.setMode(mode, { source: 'ui' }); updateActive(); });
      wrap.appendChild(btn);
    });
    container.appendChild(wrap);

    function updateActive() {
      const current = sp.appMode ? sp.appMode.getMode() : 'CORE';
      wrap.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === current); });
    }
    updateActive();
    if (sp.eventBus) sp.eventBus.on('mode:changed', updateActive);
    return wrap;
  }

  function renderStatus(container) {
    if (!container || !sp.store) return;
    const s = sp.store.getState();
    container.innerHTML = [
      '<strong>SPECTRA-PRO status</strong>',
      'Mode: ' + s.appMode,
      'Worker: ' + s.worker.status,
      'Top hits: ' + (s.analysis.topHits || []).length,
      'Display mode: ' + s.display.mode
    ].join('<br>');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatSpecies(value) {
    try {
      if (sp.utils && typeof sp.utils.formatChemicalLabel === 'function') {
        return sp.utils.formatChemicalLabel(String(value == null ? '' : value));
      }
    } catch (_) {}
    return String(value == null ? '' : value);
  }

  function getAnalysisRows() {
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      return state && state.analysis && Array.isArray(state.analysis.elementScores) ? state.analysis.elementScores : [];
    } catch (_) {
      return [];
    }
  }

  function getBestSmartRow() {
    const rows = getAnalysisRows();
    return rows.length ? rows[0] : null;
  }

  function patchSmartScoreSemantics(root) {
    const scope = root || document;
    const headers = scope.querySelectorAll ? scope.querySelectorAll('.sp-lab-th') : [];
    headers.forEach(function (el) {
      if (String(el.textContent || '').trim() === 'ELEMENT SCORE') {
        el.textContent = 'MATCH SCORE';
        el.title = 'Smart-match ranking. Percentages are relative score shares, not statistical probabilities or abundance estimates.';
      }
    });

    const rows = getAnalysisRows();
    const winner = rows.length ? rows[0] : null;
    const summaries = scope.querySelectorAll ? scope.querySelectorAll('.sp-es-summary') : [];
    summaries.forEach(function (el) {
      if (!el) return;

      if (winner) {
        const species = escapeHtml(formatSpecies(winner.element || '?'));
        const shareRaw = winner.scoreSharePct != null ? winner.scoreSharePct : winner.likelyPct;
        const share = Number.isFinite(Number(shareRaw)) ? Math.max(0, Math.min(100, Math.round(Number(shareRaw)))) : 0;
        const matchedRaw = winner.plasmaMatchedBands != null
          ? winner.plasmaMatchedBands
          : (winner.matchedPeaks != null ? winner.matchedPeaks : winner.matchedCount);
        const matched = Number.isFinite(Number(matchedRaw)) ? Math.max(0, Math.round(Number(matchedRaw))) : 0;
        const delta = Number.isFinite(Number(winner.medianDeltaNm)) ? Number(winner.medianDeltaNm).toFixed(2) : null;
        const evidenceKind = String(winner.mode || '').toLowerCase() === 'molecular' ? 'bands' : 'lines';
        let html = 'Best match: <b>' + species + '</b> · Score share ' + share + '%';
        if (matched > 0) html += ' · Evidence ' + matched + ' ' + evidenceKind;
        if (delta != null) html += ' · Δmed ' + escapeHtml(delta) + ' nm';
        if (el.innerHTML !== html) el.innerHTML = html;
      } else if (el.innerHTML) {
        const originalHtml = el.innerHTML;
        let html = originalHtml;
        html = html.replace(/Winner:\s*<b>/g, 'Best match: <b>');
        html = html.replace(/<\/b>\s*•\s*([0-9]+)%/g, '</b> · Score share $1%');
        if (html !== originalHtml) el.innerHTML = html;
      }

      el.title = 'Best current Smart-match. Score share is the relative share of positive candidate score, not a statistical probability or abundance estimate.';
    });

    const smartRows = scope.querySelectorAll ? scope.querySelectorAll('.sp-hit--smart') : [];
    smartRows.forEach(function (el, idx) {
      const row = rows[idx] || null;
      if (!el || !row) return;
      const noun = String(row.mode || '').toLowerCase() === 'molecular' ? 'bands' : 'lines';
      const txt = String(el.textContent || '');
      const next = txt.replace(/\b(?:lines|bands)\s*$/i, noun);
      if (next !== txt) el.textContent = next;

      const shareRaw = row.scoreSharePct != null ? row.scoreSharePct : row.likelyPct;
      const share = Number(shareRaw);
      const evidenceRaw = row.matchedPeaks != null ? row.matchedPeaks : (row.matchedCount != null ? row.matchedCount : row.lineCount);
      const evidence = Number(evidenceRaw);
      const isStrong = idx < 3 && Number.isFinite(share) && share >= 5 && Number.isFinite(evidence) && evidence >= 2;
      el.style.display = isStrong ? '' : 'none';
    });
  }

  function installSmartScoreSemanticsPatch() {
    function apply() {
      patchSmartScoreSemantics(document.getElementById('spPanel-lab') || document);
    }
    apply();
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(function () { apply(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

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

  function redrawLoadedImage(suppressGraphFrame, invalidatePeaks) {
    if (!isStaticImageSource()) return false;
    const redraw = global.redrawGraphIfLoadedImage;
    const draw = global.drawGraph;
    const hooks = sp.coreHooks;
    const originalEmit = hooks && typeof hooks.emit === 'function' ? hooks.emit : null;
    if (suppressGraphFrame && originalEmit) {
      hooks.emit = function (name) {
        if (name === 'graphFrame') return undefined;
        return originalEmit.apply(this, arguments);
      };
    }
    try {
      if (typeof redraw === 'function') redraw(!!invalidatePeaks);
      else if (typeof draw === 'function') draw();
      return true;
    } catch (_) {
      return false;
    } finally {
      if (suppressGraphFrame && originalEmit) hooks.emit = originalEmit;
    }
  }

  function eventPatchKeys(evt) {
    const patch = evt && evt.patch && typeof evt.patch === 'object' ? evt.patch : null;
    return patch ? Object.keys(patch) : [];
  }

  function keyMatches(keys, exactOrPrefix) {
    for (let i = 0; i < keys.length; i += 1) {
      const key = String(keys[i] || '');
      for (let j = 0; j < exactOrPrefix.length; j += 1) {
        const wanted = String(exactOrPrefix[j] || '');
        if (key === wanted || key.indexOf(wanted + '.') === 0) return true;
      }
    }
    return false;
  }

  function installStaticImageAutoRefresh() {
    const bus = sp.eventBus;
    if (!bus || typeof bus.on !== 'function') return;

    const reanalyzeKeys = [
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
    const redrawOnlyKeys = [
      'analysis.showHits',
      'analysis.smartFindEnabled'
    ];
    const resultKeys = [
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
    let resultRedrawTimer = null;

    function scheduleAnalyzeRedraw() {
      if (analyzeTimer) global.clearTimeout(analyzeTimer);
      analyzeTimer = global.setTimeout(function () {
        analyzeTimer = null;
        redrawLoadedImage(false, true);
      }, 340);
    }

    function scheduleResultRedraw() {
      if (resultRedrawTimer) global.clearTimeout(resultRedrawTimer);
      resultRedrawTimer = global.setTimeout(function () {
        resultRedrawTimer = null;
        redrawLoadedImage(true, false);
      }, 24);
    }

    bus.on('state:changed', function (evt) {
      if (!isStaticImageSource()) return;
      const source = evt && evt.meta && evt.meta.source ? String(evt.meta.source) : '';
      const keys = eventPatchKeys(evt);
      if (!keys.length) return;

      if (keyMatches(keys, resultKeys)) {
        scheduleResultRedraw();
        return;
      }
      if (source.indexOf('proBootstrap.frameSync') === 0 || source.indexOf('workerClient') === 0) return;
      if (keyMatches(keys, redrawOnlyKeys)) {
        scheduleResultRedraw();
        return;
      }
      if (keyMatches(keys, reanalyzeKeys)) scheduleAnalyzeRedraw();
    });
  }

  function installSmartHitHighlightFilter() {
    const overlays = sp.overlays;
    if (!overlays || typeof overlays.drawOnGraph !== 'function' || overlays.drawOnGraph.__strongEvidenceFilter) return;
    const original = overlays.drawOnGraph;

    const wrapped = function (ctx, graphState) {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const analysis = state && state.analysis ? state.analysis : null;
      if (!analysis || !Array.isArray(analysis.smartFindGroups)) return original.apply(this, arguments);

      const originalGroups = analysis.smartFindGroups;
      const strongGroups = originalGroups.filter(function (group) {
        const shareRaw = group && (group.scoreSharePct != null ? group.scoreSharePct : group.likelyPct);
        const share = Number(shareRaw);
        const evidenceRaw = group && (group.matchedPeaks != null ? group.matchedPeaks : (group.lineCount != null ? group.lineCount : group.matchCount));
        const evidence = Number(evidenceRaw);
        return Number.isFinite(share) && share >= 5 && Number.isFinite(evidence) && evidence >= 2;
      }).slice(0, 3);

      analysis.smartFindGroups = strongGroups;
      try {
        return original.apply(this, arguments);
      } finally {
        analysis.smartFindGroups = originalGroups;
      }
    };
    wrapped.__strongEvidenceFilter = true;
    overlays.drawOnGraph = wrapped;
  }

  function installAllPatches() {
    installSmartScoreSemanticsPatch();
    installSmartHitHighlightFilter();
    installStaticImageAutoRefresh();
  }

  sp.uiPanels = {
    createModeTabs,
    renderStatus,
    patchSmartScoreSemantics,
    isStaticImageSource,
    redrawLoadedImage
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAllPatches, { once: true });
  } else {
    installAllPatches();
  }
})(window);
