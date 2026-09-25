(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const store = sp.store;
  const bus = sp.eventBus;
  const PRESET = 'smart-fluorescent';
  let libraryInitInFlight = false;
  let libraryRetryTimer = null;
  let renderQueued = false;
  let installed = false;

  function $(id) { return global.document ? global.document.getElementById(id) : null; }

  function state() {
    try { return store && store.getState ? (store.getState() || {}) : {}; }
    catch (_) { return {}; }
  }

  function translateDynamicRoot(root) {
    try {
      const i18n = sp && sp.i18n;
      if (root && i18n && typeof i18n.translateSubtree === 'function' && i18n.getLanguage && i18n.getLanguage() === 'sv') {
        i18n.translateSubtree(root);
      }
    } catch (_) {}
  }

  function isFluorescent() {
    const s = state();
    return String(s.analysis && s.analysis.presetId || '') === PRESET;
  }

  function isLab() {
    const s = state();
    return String(s.appMode || '').toUpperCase() === 'LAB' || String(s.ui && s.ui.activeTab || '').toLowerCase() === 'lab';
  }

  function ensureClient() {
    try {
      if (!sp.workerClient && typeof sp.createAnalysisWorkerClient === 'function') {
        sp.workerClient = sp.createAnalysisWorkerClient();
      }
      return sp.workerClient || null;
    } catch (_) { return null; }
  }

  function updateLibraryButton() {
    const btn = $('spLabInitLibBtn');
    if (!btn) return;
    const loaded = !!(state().worker && state().worker.librariesLoaded);
    btn.textContent = libraryInitInFlight ? 'Loading libraries…' : (loaded ? 'Reload libraries' : 'Load libraries');
    btn.disabled = !!libraryInitInFlight;
    btn.title = loaded
      ? 'Reload the spectral libraries manually. LAB loads them automatically on entry.'
      : 'Load the spectral libraries. LAB normally does this automatically.';
  }

  function ensureLibraries() {
    if (!isLab()) return;
    const s = state();
    if (s.worker && s.worker.librariesLoaded) {
      libraryInitInFlight = false;
      if (libraryRetryTimer) { global.clearTimeout(libraryRetryTimer); libraryRetryTimer = null; }
      updateLibraryButton();
      return;
    }
    if (libraryInitInFlight) return;
    const client = ensureClient();
    if (!client || typeof client.initLibraries !== 'function') {
      if (!libraryRetryTimer) {
        libraryRetryTimer = global.setTimeout(function () {
          libraryRetryTimer = null;
          ensureLibraries();
        }, 250);
      }
      return;
    }
    if (libraryRetryTimer) { global.clearTimeout(libraryRetryTimer); libraryRetryTimer = null; }
    libraryInitInFlight = true;
    updateLibraryButton();
    try {
      if (sp.consoleLog && typeof sp.consoleLog.append === 'function') sp.consoleLog.append('[LAB] Loading spectral libraries automatically…');
      client.initLibraries(null);
    } catch (err) {
      libraryInitInFlight = false;
      updateLibraryButton();
      if (sp.consoleLog && typeof sp.consoleLog.error === 'function') sp.consoleLog.error('[LAB] Automatic library load failed: ' + String(err && err.message || err));
    }
  }

  function installStyle() {
    if (!global.document || $('spFluorescenceV220Style')) return;
    const style = global.document.createElement('style');
    style.id = 'spFluorescenceV220Style';
    style.textContent = [
      '.sp-fluo-summary{padding:5px 7px;font-size:11px;line-height:1.45;color:#d9f7fb;}',
      '.sp-fluo-summary__title{font-weight:800;color:#8cebf0;margin-bottom:5px;letter-spacing:.02em;}',
      '.sp-fluo-summary__grid{display:grid;grid-template-columns:minmax(105px,auto) 1fr;gap:2px 9px;}',
      '.sp-fluo-summary__k{color:#86aeb9;}',
      '.sp-fluo-summary__v{color:#effcff;font-weight:650;}',
      '.sp-fluo-note{margin-top:7px;color:#91b7c1;font-size:10px;line-height:1.4;}',
      '.sp-fluo-feature{padding:3px 7px;border-bottom:1px solid rgba(80,202,215,.08);font-size:11px;color:#dff8fb;}',
      '.sp-fluo-feature b{color:#8cebf0;}',
      '#spFieldFluorescenceNarrow{display:none;}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function ensureNarrowControl() {
    if (!global.document) return null;
    let label = $('spFieldFluorescenceNarrow');
    if (label) return label;
    const anchor = $('spFieldLabShowHits');
    if (!anchor || !anchor.parentNode) return null;

    label = global.document.createElement('label');
    label.id = 'spFieldFluorescenceNarrow';
    label.className = 'sp-field sp-field--checkbox-row';
    label.title = 'Clear coherent narrow-line matches are shown automatically. Enable this only to add weaker raw line coincidences.';
    label.innerHTML = '<span>Narrow-line overlay</span><input id="spFluorescenceNarrow" type="checkbox">';
    anchor.parentNode.insertBefore(label, anchor.nextSibling);

    const input = $('spFluorescenceNarrow');
    if (input) {
      input.addEventListener('change', function () {
        if (store && store.update) store.update('analysis.narrowLineOverlay', !!input.checked, { source: 'fluorescenceUi' });
        applyNarrowOverlay();
        scheduleRender();
      });
    }
    return label;
  }

  function formatNm(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1) + ' nm' : 'N/A';
  }

  function formatNumber(value, digits) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits == null ? 1 : digits) : 'N/A';
  }

  function currentSummary() {
    const s = state();
    return s.analysis && s.analysis.fluorescenceSummary && typeof s.analysis.fluorescenceSummary === 'object'
      ? s.analysis.fluorescenceSummary
      : null;
  }

  function currentNarrowCandidates() {
    const s = state();
    return s.analysis && Array.isArray(s.analysis.narrowLineCandidates) ? s.analysis.narrowLineCandidates : [];
  }

  function currentClearNarrowHits() {
    const s = state();
    return s.analysis && Array.isArray(s.analysis.clearNarrowLineHits) ? s.analysis.clearNarrowLineHits : [];
  }

  function mergeLineHits(primary, secondary, limit) {
    const out = [];
    const seen = Object.create(null);
    [primary, secondary].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (hit) {
        if (!hit) return;
        const element = String(hit.element || hit.speciesKey || hit.species || '').trim();
        const ref = Number(hit.referenceNm != null ? hit.referenceNm : hit.refNm);
        const obs = Number(hit.observedNm != null ? hit.observedNm : hit.obsNm);
        const key = element + '|' + (Number.isFinite(ref) ? ref.toFixed(3) : '?') + '|' + (Number.isFinite(obs) ? obs.toFixed(3) : '?');
        if (seen[key]) return;
        seen[key] = true;
        out.push(hit);
      });
    });
    return out.slice(0, Math.max(1, Number(limit) || 80));
  }

  function applyNarrowOverlay() {
    if (!store || !isFluorescent()) return;
    const s = state();
    const enabled = !!(s.analysis && s.analysis.narrowLineOverlay);
    const clear = currentClearNarrowHits().slice(0, 48);
    const extras = enabled ? currentNarrowCandidates().slice(0, 80) : [];
    const hits = mergeLineHits(clear, extras, 80);
    const analysisNext = Object.assign({}, s.analysis || {}, {
      rawTopHits: hits,
      topHits: clear,
      smartFindHits: hits,
      smartFindGroups: []
    });
    if (typeof store.setState === 'function') {
      store.setState({ analysis: analysisNext }, { source: 'fluorescenceUi.overlay' });
    } else if (typeof store.update === 'function') {
      store.update('analysis', analysisNext, { source: 'fluorescenceUi.overlay' });
    }
    try {
      if (typeof global.redrawGraphIfLoadedImage === 'function') global.redrawGraphIfLoadedImage();
      else if (typeof global.drawGraph === 'function') global.drawGraph();
    } catch (_) {}
  }

  function setHeaders(fluorescent) {
    const table = global.document && global.document.querySelector('#spPanel-lab .sp-lab-table');
    if (!table) return;
    const headers = table.querySelectorAll('.sp-lab-th');
    if (headers[0]) headers[0].textContent = fluorescent ? 'BAND FEATURES' : 'TOP HITS';
    if (headers[1]) headers[1].textContent = fluorescent ? 'FLUORESCENCE SUMMARY' : 'MATCH SCORE';
  }

  function renderFluorescence() {
    renderQueued = false;
    if (!global.document) return;
    installStyle();
    const narrowField = ensureNarrowControl();
    const showHitsField = $('spFieldLabShowHits');
    const smartField = $('spFieldLabSmart');
    const fluorescent = isFluorescent();

    if (narrowField) narrowField.style.display = fluorescent ? '' : 'none';
    if (showHitsField) showHitsField.style.display = fluorescent ? 'none' : '';
    if (smartField) smartField.style.display = fluorescent ? 'none' : '';
    setHeaders(fluorescent);
    updateLibraryButton();

    if (!fluorescent) return;

    const input = $('spFluorescenceNarrow');
    const s = state();
    if (input) input.checked = !!(s.analysis && s.analysis.narrowLineOverlay);

    const hitsEl = $('spLabHits');
    const summaryEl = $('spLabQc');
    if (!hitsEl || !summaryEl) return;
    const summary = currentSummary();

    if (!summary) {
      hitsEl.innerHTML = '<div class="sp-empty">Waiting for broadband fluorescence analysis…</div>';
      summaryEl.innerHTML = '<div class="sp-empty">No fluorescence summary yet.</div>';
      translateDynamicRoot(hitsEl);
      translateDynamicRoot(summaryEl);
      return;
    }

    const shoulders = Array.isArray(summary.shoulders) ? summary.shoulders : [];
    let features = '<div class="sp-fluo-feature"><b>Broad emission band</b><br>' +
      formatNm(summary.bandMinNm) + ' – ' + formatNm(summary.bandMaxNm) + '</div>';
    features += '<div class="sp-fluo-feature"><b>Emission maximum</b><br>' + formatNm(summary.lambdaMaxNm) + '</div>';
    if (shoulders.length) {
      features += shoulders.map(function (sh) {
        return '<div class="sp-fluo-feature"><b>Shoulder</b><br>' + formatNm(sh.nm) +
          ' · ' + formatNumber(Number(sh.relativeHeight) * 100, 0) + '% of main peak</div>';
      }).join('');
    }

    const narrowEnabled = !!(s.analysis && s.analysis.narrowLineOverlay);
    const clear = currentClearNarrowHits();
    const narrow = currentNarrowCandidates();

    if (clear.length) {
      features += '<div class="sp-fluo-feature"><b>Narrow emission lines</b><br>' + clear.length + ' coherent match(es)</div>';
      features += clear.slice(0, 10).map(function (hit) {
        const species = String(hit.species || hit.element || '?');
        const obs = Number(hit.observedNm);
        const ref = Number(hit.referenceNm);
        const delta = Math.abs(Number(hit.deltaNm));
        return '<div class="sp-fluo-feature">' + species + ' · ' +
          (Number.isFinite(obs) ? obs.toFixed(1) : '?') + ' nm' +
          (Number.isFinite(ref) ? ' → ' + ref.toFixed(1) + ' nm' : '') +
          (Number.isFinite(delta) ? ' · Δ ' + delta.toFixed(1) + ' nm' : '') + '</div>';
      }).join('');
      features += '<div class="sp-fluo-note">Clear coherent line matches are marked in the graph. Click a peak to inspect it.</div>';
    } else {
      features += '<div class="sp-fluo-note">No clear multi-line atomic signature detected.</div>';
    }

    if (narrowEnabled) {
      const clearKeys = Object.create(null);
      clear.forEach(function (hit) {
        const element = String(hit.element || hit.speciesKey || hit.species || '').trim();
        const ref = Number(hit.referenceNm);
        const obs = Number(hit.observedNm);
        clearKeys[element + '|' + (Number.isFinite(ref) ? ref.toFixed(3) : '?') + '|' + (Number.isFinite(obs) ? obs.toFixed(3) : '?')] = true;
      });
      const extras = narrow.filter(function (hit) {
        const element = String(hit.element || hit.speciesKey || hit.species || '').trim();
        const ref = Number(hit.referenceNm);
        const obs = Number(hit.observedNm);
        const key = element + '|' + (Number.isFinite(ref) ? ref.toFixed(3) : '?') + '|' + (Number.isFinite(obs) ? obs.toFixed(3) : '?');
        return !clearKeys[key];
      });
      if (extras.length) {
        features += '<div class="sp-fluo-feature"><b>Additional line candidates</b><br>' + extras.length + ' raw coincidence(s)</div>';
      }
    }
    hitsEl.innerHTML = features;

    const typeText = summary.broadbandDetected ? 'Broadband fluorescence detected' : 'Mixed / narrow emission';
    summaryEl.innerHTML =
      '<div class="sp-fluo-summary">' +
      '<div class="sp-fluo-summary__title">' + typeText + '</div>' +
      '<div class="sp-fluo-summary__grid">' +
      '<div class="sp-fluo-summary__k">λmax</div><div class="sp-fluo-summary__v">' + formatNm(summary.lambdaMaxNm) + '</div>' +
      '<div class="sp-fluo-summary__k">Centroid</div><div class="sp-fluo-summary__v">' + formatNm(summary.centroidNm) + '</div>' +
      '<div class="sp-fluo-summary__k">FWHM</div><div class="sp-fluo-summary__v">' + formatNm(summary.fwhmNm) + '</div>' +
      '<div class="sp-fluo-summary__k">Band width</div><div class="sp-fluo-summary__v">' + formatNm(summary.bandWidthNm) + '</div>' +
      '<div class="sp-fluo-summary__k">Asymmetry</div><div class="sp-fluo-summary__v">' + String(summary.asymmetry || 'N/A') + '</div>' +
      '<div class="sp-fluo-summary__k">Integrated signal</div><div class="sp-fluo-summary__v">' + formatNumber(summary.integratedIntensity, 1) + '</div>' +
      '</div>' +
      '<div class="sp-fluo-note">Band-shape metrics describe the measured fluorescence. They do not uniquely identify a fluorophore without a reference spectrum.</div>' +
      '</div>';

    translateDynamicRoot(hitsEl);
    translateDynamicRoot(summaryEl);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    global.requestAnimationFrame(function () {
      global.setTimeout(renderFluorescence, 0);
    });
  }

  function handleWorkerResult(msg) {
    // analysisWorkerClient commits fluorescence summary, narrow-line candidates and
    // the optional overlay in the same transaction as the rest of the LAB result.
    // This listener now only schedules the specialized fluorescence repaint.
    if (!msg || !msg.payload) return;
    scheduleRender();
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyle();
    ensureNarrowControl();

    if (bus && typeof bus.on === 'function') {
      bus.on('worker:result', handleWorkerResult);
      bus.on('worker:libraries', function (msg) {
        libraryInitInFlight = false;
        updateLibraryButton();
        const p = msg && msg.payload;
        if (p && p.ok && sp.consoleLog && typeof sp.consoleLog.append === 'function') {
          sp.consoleLog.append('[LAB] Libraries ready automatically · ' + String(Number(p.count) || 0) + ' lines.');
        }
        scheduleRender();
      });
      bus.on('worker:error', function () {
        libraryInitInFlight = false;
        if (libraryRetryTimer) { global.clearTimeout(libraryRetryTimer); libraryRetryTimer = null; }
        updateLibraryButton();
      });
      bus.on('state:changed', function (evt) {
        const patch = evt && evt.patch && typeof evt.patch === 'object' ? evt.patch : {};
        const keys = Object.keys(patch);
        if (!keys.length) return;

        const libraryRelevant = keys.some(function (key) {
          return key === 'appMode' || key === 'ui.activeTab' || key === 'worker' || key.indexOf('worker.') === 0;
        });
        if (libraryRelevant && isLab()) ensureLibraries();

        const renderRelevant = keys.some(function (key) {
          return key === 'analysis' || key.indexOf('analysis.') === 0 ||
            key === 'appMode' || key === 'ui.activeTab' ||
            key === 'worker' || key === 'worker.librariesLoaded';
        });
        if (renderRelevant) scheduleRender();
      });
      bus.on('mode:changed', function () {
        if (isLab()) ensureLibraries();
        scheduleRender();
      });
      bus.on('ui:refresh', scheduleRender);
    }

    [0, 150, 500, 1200].forEach(function (delay) {
      global.setTimeout(function () {
        ensureNarrowControl();
        if (isLab()) ensureLibraries();
        scheduleRender();
      }, delay);
    });
  }

  sp.fluorescenceUi = {
    install: install,
    ensureLibraries: ensureLibraries,
    render: renderFluorescence
  };

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(window);
