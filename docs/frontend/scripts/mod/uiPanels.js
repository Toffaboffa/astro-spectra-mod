(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};
  const APP_VERSION = '1.4.1';
  const DISPLAY_VERSION = 'v' + APP_VERSION;
  sp.version = APP_VERSION;

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

  function getPrimaryEvidence() {
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const winner = state && state.analysis && state.analysis.winnerBreakdown;
      return winner && winner.primaryEvidence && typeof winner.primaryEvidence === 'object'
        ? winner.primaryEvidence
        : null;
    } catch (_) {
      return null;
    }
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
    const primaryEvidence = getPrimaryEvidence();
    const rejected = !!(primaryEvidence && primaryEvidence.applicable === true && primaryEvidence.reportable === false);
    const possible = !!(primaryEvidence && primaryEvidence.applicable === true &&
      primaryEvidence.reportable !== false && primaryEvidence.status === 'possible-identification');
    const winnerReportable = !rejected && !possible;
    const strong = !!(primaryEvidence && primaryEvidence.applicable === true &&
      primaryEvidence.status === 'strong-evidence');
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
        const isSv = sp.i18n && typeof sp.i18n.getLanguage === 'function' && sp.i18n.getLanguage() === 'sv';
        const statusLabel = possible ? (isSv ? 'Möjlig identifiering: ' : 'Possible identification: ')
          : rejected ? (isSv ? 'Högst rankad kandidat: ' : 'Top candidate: ')
            : strong ? (isSv ? 'Starkt stöd: ' : 'Strong evidence: ')
              : (isSv ? 'Bästa matchning: ' : 'Best match: ');
        let html = statusLabel + '<b>' + species + '</b> · Score share ' + share + '%';
        if (matched > 0) html += ' · Evidence ' + matched + ' ' + evidenceKind;
        if (delta != null) html += ' · Δmed ' + escapeHtml(delta) + ' nm';
        if (rejected) html += isSv ? ' · Otillräckligt underlag' : ' · Insufficient evidence';
        if (possible) html += isSv
          ? ' · Preliminär tolkning: kontrollera kalibrering och mätkvalitet.'
          : ' · Tentative interpretation: check calibration and measurement quality.';
        const currentState = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
        const sourceReview = currentState && currentState.analysis && currentState.analysis.gasTubeSourceAssessment;
        if (sourceReview && (sourceReview.parentGasStatus === 'unresolved-competing-emission' ||
            sourceReview.parentGasStatus === 'unresolved-oxygen-emission')) {
          const isSv = sp.i18n && typeof sp.i18n.getLanguage === 'function' && sp.i18n.getLanguage() === 'sv';
          const competing = sourceReview.parentGasStatus === 'unresolved-competing-emission';
          const message = competing
            ? (isSv
              ? 'Stark emission från atomärt syre (O I), men även CO-band matchar. Gasen i röret är inte fastställd; O₂ och CO₂ måste skiljas med ytterligare mätning.'
              : 'Strong atomic oxygen (O I) emission, but CO bands also match. Parent gas unconfirmed; O2 and CO2 require further testing.')
            : (isSv
              ? 'Stark emission från atomärt syre (O I) men otillräckliga modergasbevis. O I är inte automatiskt samma sak som ett O₂-rör.'
              : 'Strong atomic oxygen (O I) emission, but insufficient parent-gas evidence. O I does not automatically establish an O2 tube.');
          html += '<div class="sp-gastube-source-review" style="margin-top:5px;font-size:11px;line-height:1.5;color:#edc47b">' +
            escapeHtml(message) + '</div>';
        }
        const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
        const review = state && state.analysis && Array.isArray(state.analysis.tentativeLineMatches)
          ? state.analysis.tentativeLineMatches.filter(function (hit) {
              return hit && hit.accepted === false && String(hit.element) === String(winner.element);
            }) : [];
        if (review.length) {
          const hit = review[0];
          const sv = sp.i18n && typeof sp.i18n.getLanguage === 'function' && sp.i18n.getLanguage() === 'sv';
          const formatNm = function (value) { return Number(value).toFixed(2); };
          html += '<div class="sp-strong-line-review" style="margin-top:4px;font-size:11px;line-height:1.45;color:#edc47b">' +
            (sv ? 'Möjlig stark linje (inte godkänd): ' : 'Possible strong line (not accepted): ') +
            escapeHtml(String(hit.species || hit.element)) + ' ' + escapeHtml(formatNm(hit.observedNm)) +
            ' nm ↔ ' + escapeHtml(formatNm(hit.referenceNm)) + ' nm (Δ ' +
            escapeHtml(formatNm(hit.deltaNm)) + ' nm). ' +
            (sv ? 'Kontrollera kalibreringen.' : 'Check wavelength calibration.') + '</div>';
        }
        if (el.innerHTML !== html) el.innerHTML = html;
      } else if (el.innerHTML) {
        const originalHtml = el.innerHTML;
        let html = originalHtml;
        html = html.replace(/Winner:\s*<b>/g, possible ? 'Possible identification: <b>'
          : rejected ? 'Top candidate: <b>' : strong ? 'Strong evidence: <b>' : 'Best match: <b>');
        html = html.replace(/<\/b>\s*•\s*([0-9]+)%/g, '</b> · Score share $1%');
        if (rejected && html.indexOf('Insufficient evidence for Best Match') === -1) html += ' · Insufficient evidence for Best Match';
        if (possible && html.indexOf('Tentative interpretation') === -1) html += ' · Tentative interpretation';
        if (html !== originalHtml) el.innerHTML = html;
      }

      el.title = possible
        ? 'Possible identification: independent calibration support or measurement quality is limited. Score share is not probability.'
        : winnerReportable
          ? (strong
            ? 'Strong multi-feature evidence, not independently verified source identity or probability.'
            : 'Best current ranking; no three-tier evidence assessment applies to this result.')
          : 'Top-ranked candidate only. Best Match is not established (' + String(primaryEvidence && primaryEvidence.reason || 'insufficient-evidence') + ').';
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

  function installVersionBadge() {
    const host = document.getElementById('sidebarLogo');
    if (!host) return;
    try {
      if (global.getComputedStyle(host).position === 'static') host.style.position = 'relative';
    } catch (_) {
      host.style.position = 'relative';
    }

    let badge = document.getElementById('spVersionBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'spVersionBadge';
      badge.className = 'sp-version-badge';
      host.appendChild(badge);
    }
    badge.textContent = DISPLAY_VERSION;
    badge.title = 'SPECTRA PRO ' + DISPLAY_VERSION;
  }

  function installVersionBadgeCss() {
    if (document.getElementById('spVersionBadgeStyle')) return;
    const style = document.createElement('style');
    style.id = 'spVersionBadgeStyle';
    style.textContent = [
      '#sidebarLogo{position:relative;}',
      '.sp-version-badge{',
      'position:absolute;right:8px;bottom:6px;z-index:20;',
      'padding:2px 7px;border-radius:999px;',
      'font:600 11px/1.25 system-ui,-apple-system,Segoe UI,sans-serif;',
      'letter-spacing:.02em;color:#dff8ff;',
      'background:rgba(5,18,34,.82);border:1px solid rgba(66,217,230,.58);',
      'box-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:none;user-select:none;',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function isStaticImageSource() {
    try {
      const numeric = global.SpectraCore && global.SpectraCore.graph && typeof global.SpectraCore.graph.getNumericFrame === 'function'
        ? global.SpectraCore.graph.getNumericFrame()
        : null;
      if (numeric && Array.isArray(numeric.I) && numeric.I.length) return true;
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

  function withGraphFrameSuppressed(fn) {
    const hooks = sp.coreHooks;
    const originalEmit = hooks && typeof hooks.emit === 'function' ? hooks.emit : null;
    if (originalEmit) {
      hooks.emit = function (name) {
        if (name === 'graphFrame') return undefined;
        return originalEmit.apply(this, arguments);
      };
    }
    try {
      return fn();
    } finally {
      if (originalEmit) hooks.emit = originalEmit;
    }
  }

  function redrawLoadedImage(suppressGraphFrame, invalidatePeaks, forceDraw) {
    if (!isStaticImageSource()) return false;
    const redraw = global.redrawGraphIfLoadedImage;
    const draw = global.drawGraph;
    const perform = function () {
      let didSomething = false;
      try {
        if (typeof redraw === 'function') {
          redraw(!!invalidatePeaks);
          didSomething = true;
        }
      } catch (_) {}
      try {
        if (forceDraw && typeof draw === 'function') {
          draw();
          didSomething = true;
        } else if (!didSomething && typeof draw === 'function') {
          draw();
          didSomething = true;
        }
      } catch (_) {}
      return didSomething;
    };
    return suppressGraphFrame ? withGraphFrameSuppressed(perform) : perform();
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
      'analysis.stableHits',
      'subtraction.mode',
      'peaks.threshold',
      'peaks.distance',
      'peaks.smoothing',
      'calibration',
      'calibration.coefficients',
      'calibration.points',
      'calibration.isCalibrated'
    ];
    const redrawOnlyKeys = [
      'analysis.showHits',
      'analysis.smartFindEnabled',
      'display.saturationOverlay',
      'display.diffractionOverlay',
      'display.calibrationExtrapolationOverlay',
      'display.calibrationExtrapolationOpacity'
    ];
    const resultKeys = [
      'analysis.topHits',
      'analysis.rawTopHits',
      'analysis.smartFindHits',
      'analysis.smartFindGroups',
      'analysis.elementScores',
      'analysis.winnerBreakdown',
      'analysis.qcFlags',
      'analysis.offsetNm',
      'analysis.diffractionCandidates'
    ];

    let analyzeTimer = null;
    let resultRedrawTimer = null;

    function scheduleAnalyzeRedraw() {
      if (analyzeTimer) global.clearTimeout(analyzeTimer);
      analyzeTimer = global.setTimeout(function () {
        analyzeTimer = null;
        // For a still image there is no next camera frame. Rebuild the graph so a
        // fresh graphFrame is emitted and the worker analyzes the current image
        // with the new LAB settings.
        redrawLoadedImage(false, true, false);
      }, 120);
    }

    function scheduleResultRedraw() {
      if (resultRedrawTimer) global.clearTimeout(resultRedrawTimer);
      resultRedrawTimer = global.setTimeout(function () {
        resultRedrawTimer = null;
        // Worker results change the labels, not the source spectrum. Repaint the
        // graph with graphFrame suppressed so this does not start another analysis.
        redrawLoadedImage(true, false, true);
        patchSmartScoreSemantics(document.getElementById('spPanel-lab') || document);
      }, 16);
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

    // This is the reliable end-of-analysis signal. State updates arrive as a
    // series of small patches; worker:result guarantees we repaint after the
    // complete Smart result has landed.
    bus.on('worker:result', function () {
      if (isStaticImageSource()) scheduleResultRedraw();
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

  function installSmartScoreSemanticsPatch() {
    function apply() {
      patchSmartScoreSemantics(document.getElementById('spPanel-lab') || document);
    }
    apply();
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(function () { apply(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function installAllPatches() {
    installVersionBadgeCss();
    installVersionBadge();
    installSmartScoreSemanticsPatch();
    installSmartHitHighlightFilter();
    installStaticImageAutoRefresh();
  }

  sp.uiPanels = {
    createModeTabs,
    renderStatus,
    patchSmartScoreSemantics,
    installVersionBadge,
    isStaticImageSource,
    redrawLoadedImage
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAllPatches, { once: true });
  } else {
    installAllPatches();
  }
})(window);
