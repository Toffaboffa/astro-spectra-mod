(function () {
  'use strict';

  const sp = window.SpectraPro || (window.SpectraPro = {});
  const store = sp.store;
  const bus = sp.eventBus;
  const TABS = ['general', 'core', 'lab', 'astro', 'other'];

  let ui = null;
  let booted = false;

  const $ = (id) => document.getElementById(id);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function ensureHost() {
    const left = $('graphSettingsDrawerLeft');
    if (!left) return null;

    let spMain = $('spMain');
    if (!spMain) {
      spMain = document.createElement('div');
      spMain.id = 'spMain';
      left.appendChild(spMain);
    }

    let host = $('SpectraProDockHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'SpectraProDockHost';
      spMain.appendChild(host);
    } else if (host.parentElement !== spMain) {
      spMain.appendChild(host);
    }

    host.classList.add('sp-dock-host');
    return { left, spMain, host };
  }

  function buildShell(host) {
    if (ui && ui.host === host) return ui;
    host.innerHTML = '';

    const shell = el('div', 'sp-shell');
    const tabs = el('div', 'sp-tabs');
    tabs.id = 'spTabs';

    const body = el('div', 'sp-body');
    body.id = 'spBody';

    const tabPanels = el('div', 'sp-tabpanels');
    tabPanels.id = 'spTabPanels';

    const statusRail = el('aside', 'sp-statusrail');
    statusRail.id = 'spStatusRail';

    const panels = {};
    TABS.forEach((tab, idx) => {
      const btn = el('button', 'sp-tab', tab === 'core' ? 'CORE controls' : (tab === 'general' ? 'General' : tab.toUpperCase()));
      btn.type = 'button';
      btn.dataset.tab = tab;
      if (idx === 0) btn.classList.add('is-active');
      tabs.appendChild(btn);

      const panel = el('section', 'sp-tabpanel');
      panel.id = `spPanel-${tab}`;
      panel.dataset.tab = tab;
      if (idx !== 0) panel.hidden = true;
      tabPanels.appendChild(panel);
      panels[tab] = panel;
    });

    body.appendChild(tabPanels);
    body.appendChild(statusRail);
    shell.appendChild(tabs);
    shell.appendChild(body);
    host.appendChild(shell);

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.sp-tab');
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
      syncActiveTabToStore(btn.dataset.tab);
    });

    ui = { host, shell, tabs, body, tabPanels, statusRail, panels };
    ensurePanelContent();
    return ui;
  }


  function ensureV15Registry() {
    const v15 = sp.v15 || (sp.v15 = {});
    if (!v15.registry) {
      v15.registry = {
        modules: {
          displayModes: !!v15.displayModes,
          dataQualityPanel: !!v15.dataQualityPanel,
          yAxisController: !!v15.yAxisController,
          peakControls: !!v15.peakControls,
          graphAppearance: !!v15.graphAppearance,
          cameraCapabilities: !!v15.cameraCapabilities,
          calibrationIO: !!v15.calibrationIO,
          calibrationPointManager: !!v15.calibrationPointManager
        },
        loadedAt: Date.now(),
        scaffold: true,
        version: 'step4'
      };
    } else {
      const mods = v15.registry.modules || (v15.registry.modules = {});
      ['displayModes','dataQualityPanel','yAxisController','peakControls','graphAppearance','cameraCapabilities','calibrationIO','calibrationPointManager'].forEach(function (k) {
        mods[k] = !!v15[k];
      });
      v15.registry.loadedAt = v15.registry.loadedAt || Date.now();
      v15.registry.scaffold = true;
      v15.registry.version = 'step4';
    }
    return v15.registry;
  }

  function getStoreState() {
    try { return (store && store.getState) ? (store.getState() || {}) : {}; }
    catch (_) { return {}; }
  }

  function getV15DisplayModes() {
    try {
      const list = (sp.v15 && sp.v15.displayModes && typeof sp.v15.displayModes.getDisplayModes === 'function')
        ? sp.v15.displayModes.getDisplayModes()
        : ['NORMAL', 'DIFFERENCE', 'RATIO', 'TRANSMITTANCE', 'ABSORBANCE'];
      return Array.isArray(list) && list.length ? list : ['NORMAL'];
    } catch (_) { return ['NORMAL']; }
  }

  function getV15YAxisModes() {
    try {
      const list = (sp.v15 && sp.v15.yAxisController && typeof sp.v15.yAxisController.getModes === 'function')
        ? sp.v15.yAxisController.getModes()
        : ['AUTO', 'FIXED_255', 'MANUAL'];
      return Array.isArray(list) && list.length ? list : ['AUTO'];
    } catch (_) { return ['AUTO']; }
  }

  function getInitialPeakUiValues() {
    const state = getStoreState();
    const peaks = state.peaks || {};
    let threshold = Number.isFinite(Number(peaks.threshold)) ? Math.round(Number(peaks.threshold)) : null;
    let distance = Number.isFinite(Number(peaks.distance)) ? Math.round(Number(peaks.distance)) : null;
    let smoothing = Number.isFinite(Number(peaks.smoothing)) ? Math.round(Number(peaks.smoothing)) : null;
    if (threshold == null) {
      const el = $('peakSizeLower');
      const n = el ? Number(el.value) : NaN;
      if (Number.isFinite(n)) threshold = Math.round(n);
    }
    if (distance == null) distance = 1;
    if (smoothing == null) smoothing = 0;
    return {
      threshold: Math.max(0, Math.min(255, threshold == null ? 1 : threshold)),
      distance: Math.max(1, Math.min(512, distance)),
      smoothing: Math.max(0, Math.min(8, smoothing))
    };
  }


  function updateStorePath(path, value, meta) {
    if (!store || !store.update) return;
    try { store.update(path, value, meta || { source: 'proBootstrap' }); } catch (_) {}
  }

  function normalizeGraphFrame(frame) {
    if (!frame || typeof frame !== 'object') return null;
    const latest = Object.assign({}, frame);
    const I = Array.isArray(frame.I) ? frame.I.slice()
      : Array.isArray(frame.intensity) ? frame.intensity.slice()
      : Array.isArray(frame.combined) ? frame.combined.slice()
      : Array.isArray(frame.values) ? frame.values.slice()
      : null;
    if (I && !Array.isArray(latest.I)) latest.I = I;
    if (!latest.pixelWidth) {
      latest.pixelWidth = Array.isArray(latest.px) ? latest.px.length : (I ? I.length : 0);
    }
    if (!latest.source) latest.source = 'camera';
    if (!latest.timestamp) latest.timestamp = Date.now();
    return latest;
  }

  function normalizeCalibrationState(payload) {
    const p = payload || {};
    const points = Array.isArray(p.points) ? p.points.slice() : [];
    const coefficients = Array.isArray(p.coefficients) ? p.coefficients.slice() : [];
    const isCalibrated = !!(p.isCalibrated || p.calibrated || coefficients.length);
    return {
      isCalibrated,
      coefficients,
      points,
      residualStatus: p.residualStatus || (isCalibrated ? 'available' : 'uncalibrated'),
      pointCount: Number.isFinite(p.pointCount) ? p.pointCount : points.length,
      timestamp: p.timestamp || Date.now()
    };
  }

  function normalizeReferenceState(payload) {
    const p = payload || {};
    const count = Number.isFinite(p.count) ? p.count : 0;
    return {
      count,
      hasReference: !!(p.hasReference || count > 0),
      updatedAt: p.updatedAt || Date.now()
    };
  }


  function getLiveFrame(state) {
    const st = state || getStoreState();
    const byState = st && st.frame && st.frame.latest ? st.frame.latest : null;
    if (byState) return byState;
    try {
      const sp = window.SpectraPro || {};
      if (sp.coreBridge && sp.coreBridge.frame) return sp.coreBridge.frame;
    } catch (_) {}
    try {
      if (window.SpectraCore && window.SpectraCore.graph && typeof window.SpectraCore.graph.getLatestFrame === 'function') {
        return window.SpectraCore.graph.getLatestFrame() || null;
      }
    } catch (_) {}
    return null;
  }


  function ensureWorkerClient() {
    try {
      if (!sp.workerClient && typeof sp.createAnalysisWorkerClient === 'function') {
        sp.workerClient = sp.createAnalysisWorkerClient();
      }
      return sp.workerClient || null;
    } catch (err) {
      console.warn('[SPECTRA-PRO] Failed to create worker client', err);
      if (store && store.update) {
        try { store.update('worker.status', 'error', { source: 'proBootstrap.workerClient' }); } catch (_) {}
        try { store.update('worker.lastError', String(err && err.message || err), { source: 'proBootstrap.workerClient' }); } catch (_) {}
      }
      return null;
    }
  }

  function setCoreWorkerMode(mode) {
    const val = String(mode || 'auto').toLowerCase();
    if (!store || !store.update) return;
    const client = ensureWorkerClient();
    if (val === 'on') {
      store.update('worker.mode', 'on', { source: 'proBootstrap.core' });
      store.update('worker.enabled', true, { source: 'proBootstrap.core' });
      if (client && typeof client.start === 'function') client.start();
      return;
    }
    if (val === 'off') {
      if (client && typeof client.stop === 'function') client.stop();
      store.update('worker.mode', 'off', { source: 'proBootstrap.core' });
      store.update('worker.enabled', false, { source: 'proBootstrap.core' });
      store.update('worker.status', 'idle', { source: 'proBootstrap.core' });
      return;
    }
    // auto = enabled but lazy-start only when mode/analysis needs it.
    store.update('worker.mode', 'auto', { source: 'proBootstrap.core' });
    store.update('worker.enabled', true, { source: 'proBootstrap.core' });
    if ((store.getState().worker || {}).status === 'error') {
      store.update('worker.status', 'idle', { source: 'proBootstrap.core' });
      store.update('worker.lastError', null, { source: 'proBootstrap.core' });
    }
  }

  function syncActiveTabToStore(tab) {
    if (!store || !store.setState) return;
    ensureV15Registry();
    const state = getStoreState();
    const nextUi = Object.assign({}, state.ui || {}, { activeTab: tab });
    store.setState({ ui: nextUi }, { source: 'proBootstrap.tab' });
  }

  function setActiveTab(tab) {
    if (!ui) return;
    const active = TABS.includes(tab) ? tab : 'general';
    ui.tabs.querySelectorAll('.sp-tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === active));
    TABS.forEach((t) => {
      const panel = ui.panels[t];
      if (panel) panel.hidden = (t !== active);
    });
  }

  function mountGeneralOriginalControls() {
    if (!ui || !ui.panels.general) return;
    const left = $('graphSettingsDrawerLeft');
    if (!left) return;

    const panel = ui.panels.general;
    let hostWrap = $('spGeneralHost');
    if (!hostWrap) {
      hostWrap = el('div', 'sp-general-host');
      hostWrap.id = 'spGeneralHost';
      panel.appendChild(hostWrap);
    }

    // Move original graph controls (left drawer children) into General panel, but keep IDs/listeners intact.
    const children = Array.from(left.children);
    children.forEach((node) => {
      if (node.id === 'spMain') return; // keep dock host in drawer
      hostWrap.appendChild(node);
    });
  }

  function ensureStatusRail() {
    if (!ui || !ui.statusRail) return;
    if ($('spStatusText') && $('spDataQualityText')) return;

    ui.statusRail.innerHTML = '';
    const grid = el('div', 'sp-status-grid');

    const status = el('div', 'sp-status-card');
    status.innerHTML = '<h4>STATUS</h4><div id="spStatusText" class="sp-status-lines"></div>';

    const dq = el('div', 'sp-status-card');
    dq.innerHTML = '<h4>DATA QUALITY</h4><div id="spDataQualityText" class="sp-status-lines"></div>';

    grid.appendChild(status);
    grid.appendChild(dq);
    ui.statusRail.appendChild(grid);
  }

  function ensurePanelContent() {
    if (!ui) return;

    const core = ui.panels.core;
    if (core && !core.dataset.built) {
      const card = el('div', 'sp-card sp-card--flat');
      const displayOptions = getV15DisplayModes().map(function (m) { return `<option value=\"${String(m).toLowerCase()}\">${m}</option>`; }).join('');
      const yAxisOptions = getV15YAxisModes().map(function (m) { return `<option value=\"${String(m).toLowerCase()}\">${m}</option>`; }).join('');

      card.innerHTML = [
        '<div class="sp-form-grid">',
        '  <label>App mode<select id="spAppMode"><option value="CORE">CORE</option><option value="LAB">LAB</option><option value="ASTRO">ASTRO</option></select></label>',
        '  <label>Worker<select id="spWorkerMode"><option value="auto">Auto</option><option value="on">On</option><option value="off">Off</option></select></label>',
        '  <label>Display mode<select id="spDisplayMode">' + displayOptions + '</select></label>',
        '  <label>Y-axis<select id="spYAxisMode">' + yAxisOptions + '</select></label>',
        '  <label id="spYAxisMaxWrap">Y max<input id="spYAxisMax" type="number" min="1" max="4096" step="1" value="255"></label>',
        '  <label>Peak threshold<input id="spPeakThreshold" type="number" min="0" max="255" step="1" value="1"></label>',
        '  <label>Peak distance<input id="spPeakDistance" type="number" min="1" max="512" step="1" value="1"></label>',
        '  <label>Peak smoothing<input id="spPeakSmoothing" type="number" min="0" max="8" step="1" value="0"></label>',
        '</div>',
        '<div class="sp-actions">',
        '  <button type="button" id="spInitLibBtn">Init libraries</button>',
        '  <button type="button" id="spPingWorkerBtn">Ping worker</button>',
        '  <button type="button" id="spRefreshUiBtn">Refresh UI</button>',
        '</div>',
        '<p class="sp-note">Placeholder controls for SPECTRA-PRO. Original graph controls live in General.</p>'
      ].join('');
      core.appendChild(card);
      core.dataset.built = '1';

      const modeSel = card.querySelector('#spAppMode');
      const workerSel = card.querySelector('#spWorkerMode');
      const displaySel = card.querySelector('#spDisplayMode');
      const yAxisSel = card.querySelector('#spYAxisMode');
      const yAxisMaxInput = card.querySelector('#spYAxisMax');
      const peakThresholdInput = card.querySelector('#spPeakThreshold');
      const peakDistanceInput = card.querySelector('#spPeakDistance');
      const peakSmoothingInput = card.querySelector('#spPeakSmoothing');
      const setVal = (path, value) => { if (store && store.update) store.update(path, value, { source: 'proBootstrap.core' }); };
      const peakInit = getInitialPeakUiValues();
      if (peakThresholdInput) peakThresholdInput.value = String(peakInit.threshold);
      if (peakDistanceInput) peakDistanceInput.value = String(peakInit.distance);
      if (peakSmoothingInput) peakSmoothingInput.value = String(peakInit.smoothing);

      modeSel && modeSel.addEventListener('change', (e) => {
        const mode = String(e.target.value || 'CORE').toUpperCase();
        if (sp.appMode && typeof sp.appMode.setMode === 'function') {
          sp.appMode.setMode(mode, { source: 'proBootstrap.core' });
        } else {
          setVal('appMode', mode);
        }
      });
      workerSel && workerSel.addEventListener('change', (e) => {
        setCoreWorkerMode(e.target.value || 'auto');
      });
      displaySel && displaySel.addEventListener('change', (e) => {
        const mode = String(e.target.value || 'normal').toLowerCase();
        setVal('display.mode', mode);
      });
      yAxisSel && yAxisSel.addEventListener('change', (e) => {
        const mode = String(e.target.value || 'auto').toLowerCase();
        setVal('display.yAxisMode', mode);
        if (yAxisMaxInput) yAxisMaxInput.disabled = (mode !== 'manual');
      });
      yAxisMaxInput && yAxisMaxInput.addEventListener('change', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n) || n <= 0) return;
        setVal('display.yAxisMax', Math.round(n));
      });

      peakThresholdInput && peakThresholdInput.addEventListener('change', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(0, Math.min(255, Math.round(n)));
        e.target.value = String(v);
        setVal('peaks.threshold', v);
      });
      peakDistanceInput && peakDistanceInput.addEventListener('change', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(1, Math.min(512, Math.round(n)));
        e.target.value = String(v);
        setVal('peaks.distance', v);
      });
      peakSmoothingInput && peakSmoothingInput.addEventListener('change', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(0, Math.min(8, Math.round(n)));
        e.target.value = String(v);
        setVal('peaks.smoothing', v);
      });

      card.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === 'spPingWorkerBtn') {
          const client = ensureWorkerClient();
          if (client && typeof client.ping === 'function') {
            try {
              store.update('worker.enabled', true, { source: 'proBootstrap.core' });
              client.ping();
            } catch (err) {
              setVal('worker.status', 'error');
              setVal('worker.lastError', String(err && err.message || err));
            }
          } else {
            setVal('worker.lastPingAt', Date.now());
            if (store && store.getState && store.getState().worker && store.getState().worker.enabled) setVal('worker.status', 'ready');
          }
        }
        if (t.id === 'spInitLibBtn') {
          const client = ensureWorkerClient();
          setVal('analysis.presetId', 'libraries-init-requested');
          if (client && typeof client.initLibraries === 'function') {
            try {
              store.update('worker.enabled', true, { source: 'proBootstrap.core' });
              client.initLibraries(null);
            } catch (err) {
              setVal('worker.status', 'error');
              setVal('worker.lastError', String(err && err.message || err));
            }
          }
        }
        if (t.id === 'spRefreshUiBtn') {
          render();
        }
      });
    }

    ['lab', 'astro', 'other'].forEach((tab) => {
      const panel = ui.panels[tab];
      if (!panel || panel.dataset.built) return;
      const card = el('div', 'sp-card sp-card--flat');
      card.innerHTML = `<div class="sp-empty">${tab.toUpperCase()} panel placeholder (tab wiring OK).</div>`;
      panel.appendChild(card);
      panel.dataset.built = '1';
    });

    ensureStatusRail();
  }

  function computeDataQualityLines(state) {
    try {
      const mod = sp.v15 && sp.v15.dataQualityPanel;
      if (mod && typeof mod.compute === 'function') {
        const computed = mod.compute(state, { latestFrame: getLiveFrame(state) });
        if (computed && Array.isArray(computed.status) && Array.isArray(computed.dq)) return computed;
      }
    } catch (_) {}

    return {
      status: [
        `Mode: ${state.appMode || 'CORE'}`,
        `Worker: ${state.worker?.status || 'idle'}`,
        `Frame source: ${(state.frame && state.frame.source) || 'none'}`
      ],
      dq: [
        'Data Quality module unavailable',
        'Fallback rendering active'
      ]
    };
  }

  function renderStatus() {
    const sEl = $('spStatusText');
    const qEl = $('spDataQualityText');
    if (!sEl || !qEl) return;
    const state = getStoreState();
    const lines = computeDataQualityLines(state);
    sEl.innerHTML = lines.status.join('<br>');
    qEl.innerHTML = lines.dq.join('<br>');

    const appModeSel = $('spAppMode');
    if (appModeSel && state.appMode && appModeSel.value !== state.appMode) appModeSel.value = state.appMode;
    const workerSel = $('spWorkerMode');
    if (workerSel) {
      const ws = state.worker || {};
      const inferred = ws.enabled ? (ws.status === 'idle' ? 'auto' : 'on') : 'off';
      const nextWorkerSel = (ws.mode === 'auto' || ws.mode === 'on' || ws.mode === 'off') ? ws.mode : inferred;
      if (workerSel.value !== nextWorkerSel) workerSel.value = nextWorkerSel;
    }
    const displaySel = $('spDisplayMode');
    if (displaySel) {
      const m = String((state.display && state.display.mode) || 'normal').toLowerCase();
      if (displaySel.value !== m) displaySel.value = m;
    }
    const yAxisSel = $('spYAxisMode');
    const yAxisMaxInput = $('spYAxisMax');
    if (yAxisSel) {
      const ym = String((state.display && state.display.yAxisMode) || 'auto').toLowerCase();
      if (yAxisSel.value !== ym) yAxisSel.value = ym;
      if (yAxisMaxInput) yAxisMaxInput.disabled = (ym !== 'manual');
    }
    if (yAxisMaxInput) {
      const v = Number((state.display && state.display.yAxisMax));
      const next = Number.isFinite(v) && v > 0 ? String(Math.round(v)) : '255';
      if (String(yAxisMaxInput.value) !== next) yAxisMaxInput.value = next;
    }
    const peakThresholdInput = $('spPeakThreshold');
    const peakDistanceInput = $('spPeakDistance');
    const peakSmoothingInput = $('spPeakSmoothing');
    const peaks = state.peaks || {};
    if (peakThresholdInput && Number.isFinite(Number(peaks.threshold))) {
      const next = String(Math.max(0, Math.min(255, Math.round(Number(peaks.threshold)))));
      if (String(peakThresholdInput.value) !== next) peakThresholdInput.value = next;
    }
    if (peakDistanceInput && Number.isFinite(Number(peaks.distance))) {
      const next = String(Math.max(1, Math.min(512, Math.round(Number(peaks.distance)))));
      if (String(peakDistanceInput.value) !== next) peakDistanceInput.value = next;
    }
    if (peakSmoothingInput && Number.isFinite(Number(peaks.smoothing))) {
      const next = String(Math.max(0, Math.min(8, Math.round(Number(peaks.smoothing)))));
      if (String(peakSmoothingInput.value) !== next) peakSmoothingInput.value = next;
    }
  }

  function cleanupSpuriousPopup() {
    const popup = $('infoPopup');
    const blocker = $('infoPopupBlock');
    const msg = $('infoPopupMessage');
    if (!popup) return;
    const defaultMsg = (msg && (msg.textContent || '').trim()) === 'Info message';
    if (popup.classList.contains('show') && defaultMsg && typeof window.closeInfoPopup === 'function') {
      try { window.closeInfoPopup(); } catch (_) {}
      return;
    }
    if (blocker && blocker.classList.contains('show') && !popup.classList.contains('show')) {
      blocker.classList.remove('show');
    }
  }

  function render() {
    const hostBits = ensureHost();
    if (!hostBits) return;
    buildShell(hostBits.host);
    mountGeneralOriginalControls();
    ensurePanelContent();
    ensureStatusRail();

    const state = getStoreState();
    const active = String(state.ui?.activeTab || 'general').toLowerCase();
    setActiveTab(active);
    renderStatus();
    cleanupSpuriousPopup();
  }

  function init() {
    if (booted) return;
    booted = true;
    render();
    // Step 1 wiring: create a singleton worker client if available (lazy worker start remains in client).
    ensureWorkerClient();
    if (bus && bus.on) {
      bus.on('state:changed', function (evt) {
        const src = evt && evt.meta && evt.meta.source ? String(evt.meta.source) : '';
        if (src.indexOf('proBootstrap.frameSync') === 0) { renderStatus(); return; }
        if (src.indexOf('proBootstrap.calibrationSync') === 0 || src.indexOf('proBootstrap.referenceSync') === 0) { renderStatus(); return; }
        render();
      });
      bus.on('ui:refresh', render);
      bus.on('mode:changed', render);
      bus.on('frame:updated', renderStatus);
      bus.on('worker:ready', renderStatus);
      bus.on('worker:libraries', renderStatus);
      bus.on('worker:error', renderStatus);
      bus.on('worker:timeout', renderStatus);
      bus.on('worker:result', renderStatus);
    }
    if (window.SpectraPro && window.SpectraPro.coreHooks && window.SpectraPro.coreHooks.on) {
      let statusRafId = 0;
      let frameSyncRafId = 0;
      let pendingFrame = null;
      const queueStatusRender = function () {
        if (statusRafId) return;
        statusRafId = requestAnimationFrame(function () {
          statusRafId = 0;
          renderStatus();
        });
      };
      window.SpectraPro.coreHooks.on('graphFrame', function (payload) {
        pendingFrame = payload || pendingFrame;
        if (!frameSyncRafId) {
          frameSyncRafId = requestAnimationFrame(function () {
            frameSyncRafId = 0;
            const normalized = normalizeGraphFrame(pendingFrame);
            pendingFrame = null;
            if (normalized) {
              updateStorePath('frame.latest', normalized, { source: 'proBootstrap.frameSync' });
              updateStorePath('frame.source', normalized.source || 'unknown', { source: 'proBootstrap.frameSync' });
            }
            if (bus && bus.emit) bus.emit('frame:updated', { source: 'proBootstrap.frameSync' });
            queueStatusRender();
          });
        }
      });
      window.SpectraPro.coreHooks.on('calibrationChanged', function (payload) {
        const normalized = normalizeCalibrationState(payload);
        updateStorePath('calibration', normalized, { source: 'proBootstrap.calibrationSync' });
        queueStatusRender();
      });
      window.SpectraPro.coreHooks.on('referenceChanged', function (payload) {
        const normalized = normalizeReferenceState(payload);
        updateStorePath('reference', normalized, { source: 'proBootstrap.referenceSync' });
        queueStatusRender();
      });
    }
    window.addEventListener('resize', render, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
