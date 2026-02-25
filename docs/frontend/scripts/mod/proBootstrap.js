(function () {
  'use strict';

  const sp = window.SpectraPro || (window.SpectraPro = {});
  const store = sp.store;
// --- PRO Console Log (LAB Step 1 UI Hotfix) ---
const CONSOLE_PATH = 'ui.console.lines';
function getConsoleLines() {
  try { return (store?.getState()?.ui?.console?.lines) || []; } catch { return []; }
}
function appendConsole(line) {
  const ts = new Date();
  const hh = String(ts.getHours()).padStart(2,'0');
  const mm = String(ts.getMinutes()).padStart(2,'0');
  const ss = String(ts.getSeconds()).padStart(2,'0');
  const prefix = `[${hh}:${mm}:${ss}] `;
  const safe = (line ?? '').toString().replace(/\s+$/,'');
  const lines = getConsoleLines();
  const maxLines = store?.getState()?.ui?.console?.maxLines || 200;
  const next = lines.concat(prefix + safe).slice(-maxLines);
  try { store.update(CONSOLE_PATH, next); } catch {}
}
function appendConsoleErr(line) { appendConsole('ERROR: ' + line); }

sp.consoleLog = { append: appendConsole, error: appendConsoleErr };

  const bus = sp.eventBus;
  const TABS = ['general', 'core', 'lab', 'astro', 'other'];

  let ui = null;
  let booted = false;

  const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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


  function getV15FillModes() {
    try {
      const list = (sp.v15 && sp.v15.graphAppearance && typeof sp.v15.graphAppearance.getFillModes === 'function')
        ? sp.v15.graphAppearance.getFillModes()
        : ['INHERIT', 'OFF', 'SYNTHETIC', 'SOURCE'];
      return Array.isArray(list) && list.length ? list : ['INHERIT', 'OFF', 'SOURCE'];
    } catch (_) { return ['INHERIT', 'OFF', 'SOURCE']; }
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

let lastLabAnalyzeAt = 0;

function shouldRunLabAnalysis(state) {
  if (!state) return false;
  if (String(state.appMode || 'CORE').toUpperCase() !== 'LAB') return false;
  if (!(state.analysis && state.analysis.enabled)) return false;
  const wm = (state.worker && state.worker.mode) ? String(state.worker.mode).toLowerCase() : 'auto';
  if (wm === 'off') return false;
  return true;
}

function maybeRunLabAnalyze(frameNormalized) {
  try {
    const state = getStoreState();
    if (!shouldRunLabAnalysis(state)) return;
    if (!frameNormalized || !Array.isArray(frameNormalized.I) || !frameNormalized.I.length) return;
    const libsLoaded = !!(state.worker && state.worker.librariesLoaded);
    if (!libsLoaded) return;
    const maxHz = Number(state.analysis && state.analysis.maxHz);
    const minInterval = (Number.isFinite(maxHz) && maxHz > 0) ? (1000 / maxHz) : 250;
    const now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (now - lastLabAnalyzeAt < minInterval) return;
    lastLabAnalyzeAt = now;

    const client = ensureWorkerClient();
    if (!client || typeof client.analyzeFrame !== 'function') return;

    const nmOk = Array.isArray(frameNormalized.nm) && frameNormalized.nm.length === frameNormalized.I.length;
    const payloadFrame = {
      I: frameNormalized.I,
      nm: nmOk ? frameNormalized.nm : null,
      calibrated: nmOk,
      timestamp: frameNormalized.timestamp || Date.now()
    };

    client.analyzeFrame(payloadFrame);
  } catch (e) {}
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


  async function probeCameraCapabilitiesIntoStore() {
    const mod = sp.v15 && sp.v15.cameraCapabilities;
    if (!store || !store.update) return null;
    try {
      store.update('camera.status', 'probing', { source: 'proBootstrap.cameraCaps' });
      let result = null;
      if (mod && typeof mod.probeCurrent === 'function') {
        result = await mod.probeCurrent();
      } else if (mod && typeof mod.probe === 'function') {
        result = await mod.probe();
      } else {
        result = { status: 'unavailable', source: 'none', supported: {}, values: {}, summary: {} };
      }
      const supported = (result && result.supported && typeof result.supported === 'object') ? result.supported : {};
      const values = (result && result.values && typeof result.values === 'object') ? result.values : {};
      const summary = (result && result.summary && typeof result.summary === 'object') ? result.summary : {};
      const status = String((result && result.status) || (result && result.source === 'track' ? 'ok' : 'no-track'));
      store.update('camera.source', String((result && result.source) || 'none'), { source: 'proBootstrap.cameraCaps' });
      store.update('camera.supported', supported, { source: 'proBootstrap.cameraCaps' });
      store.update('camera.values', values, { source: 'proBootstrap.cameraCaps' });
      store.update('camera.summary', summary, { source: 'proBootstrap.cameraCaps' });
      store.update('camera.lastProbeAt', Date.now(), { source: 'proBootstrap.cameraCaps' });
      store.update('camera.error', result && result.error ? String(result.error) : null, { source: 'proBootstrap.cameraCaps' });
      store.update('camera.status', status, { source: 'proBootstrap.cameraCaps' });
      return result;
    } catch (err) {
      try { store.update('camera.status', 'error', { source: 'proBootstrap.cameraCaps' }); } catch (_) {}
      try { store.update('camera.error', String(err && err.message || err), { source: 'proBootstrap.cameraCaps' }); } catch (_) {}
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
    // only rebuild if any of the three panes are missing
    if ($('spStatusText') && $('spDataQualityText') && $('spConsolePre')) return;

    ui.statusRail.innerHTML = '';
    const grid = el('div', 'sp-status-grid');

    const status = el('div', 'sp-status-card');
    status.innerHTML = '<h4>STATUS</h4><div id="spStatusText" class="sp-status-lines"></div>';

    const dq = el('div', 'sp-status-card');
    dq.innerHTML = '<h4>DATA QUALITY</h4><div id="spDataQualityText" class="sp-status-lines"></div>';

    const consoleCard = el('div', 'sp-status-card sp-console-card');
    consoleCard.innerHTML = '<h4>CONSOLE</h4><div id="spConsoleBody" class="sp-console-body"><pre id="spConsolePre" class="sp-console-pre"></pre><span class="sp-console-cursor">█</span></div>';

    grid.appendChild(status);
    grid.appendChild(dq);
    grid.appendChild(consoleCard);
    ui.statusRail.appendChild(grid);
  }

  function ensurePanelContent() {
    if (!ui) return;

    const core = ui.panels.core;
    if (core && !core.dataset.built) {
      const card = el('div', 'sp-card sp-card--flat');
      const displayOptions = getV15DisplayModes().map(function (m) { return `<option value=\"${String(m).toLowerCase()}\">${m}</option>`; }).join('');
      const yAxisOptions = getV15YAxisModes().map(function (m) { return `<option value=\"${String(m).toLowerCase()}\">${m}</option>`; }).join('');
      const fillModeOptions = getV15FillModes().map(function (m) { return `<option value=\"${String(m).toLowerCase()}\">${m}</option>`; }).join('');

      card.innerHTML = [
        '<div class="sp-form-grid">',
        '  <label id="spFieldAppMode" class="sp-field sp-field--app-mode">App mode<select id="spAppMode" class="spctl-select spctl-select--app-mode"><option value="CORE">CORE</option><option value="LAB">LAB</option><option value="ASTRO">ASTRO</option></select></label>',
        '  <label id="spFieldWorkerMode" class="sp-field sp-field--worker-mode">Worker<select id="spWorkerMode" class="spctl-select spctl-select--worker-mode"><option value="auto">Auto</option><option value="on">On</option><option value="off">Off</option></select></label>',
        '  <label id="spFieldDisplayMode" class="sp-field sp-field--display-mode">Display mode<select id="spDisplayMode" class="spctl-select spctl-select--display-mode">' + displayOptions + '</select></label>',
        '  <label id="spFieldYAxisMode" class="sp-field sp-field--y-axis-mode">Y-axis<select id="spYAxisMode" class="spctl-select spctl-select--y-axis-mode">' + yAxisOptions + '</select></label>',
        '  <label id="spYAxisMaxWrap" class="sp-field sp-field--y-axis-max">Y max<input id="spYAxisMax" class="spctl-input spctl-input--y-axis-max" type="number" min="1" max="4096" step="1" value="255"></label>',
        '  <label id="spFieldPeakThreshold" class="sp-field sp-field--peak-threshold">Peak threshold<input id="spPeakThreshold" class="spctl-input spctl-input--peak-threshold" type="number" min="0" max="255" step="1" value="1"></label>',
        '  <label id="spFieldPeakDistance" class="sp-field sp-field--peak-distance">Peak distance<input id="spPeakDistance" class="spctl-input spctl-input--peak-distance" type="number" min="1" max="512" step="1" value="1"></label>',
        '  <label id="spFieldPeakSmoothing" class="sp-field sp-field--peak-smoothing">Peak smoothing<input id="spPeakSmoothing" class="spctl-input spctl-input--peak-smoothing" type="number" min="0" max="8" step="1" value="0"></label>',
        '  <label id="spFieldFillMode" class="sp-field sp-field--fill-mode">Fill mode<select id="spFillMode" class="spctl-select spctl-select--fill-mode">' + fillModeOptions + '</select></label>',
        '  <label id="spFieldFillOpacity" class="sp-field sp-field--fill-opacity">Fill opacity<input id="spFillOpacity" class="spctl-input spctl-input--fill-opacity spctl-range spctl-range--fill-opacity" type="range" min="0" max="1" step="0.01" value="0.70"></label>',
        '</div>',
        '<div class="sp-actions">',
        '  <button type="button" id="spInitLibBtn">Init libraries</button>',
        '  <button type="button" id="spPingWorkerBtn">Ping worker</button>',
        '  <button type="button" id="spRefreshUiBtn">Refresh UI</button>',
        '  <button type="button" id="spProbeCameraBtn">Probe camera</button>',
        '</div>',
        '<div id="spCoreActionFeedback" class="sp-note sp-note--feedback" aria-live="polite"></div>'
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
      const fillModeSel = card.querySelector('#spFillMode');
      const fillOpacityInput = card.querySelector('#spFillOpacity');
      const setVal = (path, value) => { if (store && store.update) store.update(path, value, { source: 'proBootstrap.core' }); };
      const peakInit = getInitialPeakUiValues();
      if (peakThresholdInput) peakThresholdInput.value = String(peakInit.threshold);
      if (peakDistanceInput) peakDistanceInput.value = String(peakInit.distance);
      if (peakSmoothingInput) peakSmoothingInput.value = String(peakInit.smoothing);
      const displayStateInit = (getStoreState().display || {});
      if (fillModeSel) fillModeSel.value = String(displayStateInit.fillMode || 'inherit').toLowerCase();
      if (fillOpacityInput) {
        const fo = Number(displayStateInit.fillOpacity);
        fillOpacityInput.value = Number.isFinite(fo) ? String(Math.max(0, Math.min(1, fo))) : '0.70';
      }

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

      fillModeSel && fillModeSel.addEventListener('change', (e) => {
        const mode = String(e.target.value || 'inherit').toLowerCase();
        setVal('display.fillMode', mode);
      });
      const syncFillOpacityLabel = function (_val) { return; };
      fillOpacityInput && fillOpacityInput.addEventListener('input', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(0, Math.min(1, n));
        setVal('display.fillOpacity', v);
      });
      fillOpacityInput && fillOpacityInput.addEventListener('change', (e) => {
        const n = Number(e.target.value);
        const v = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.70;
        e.target.value = String(v);
      });

      peakThresholdInput && peakThresholdInput.addEventListener('input', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(0, Math.min(255, Math.round(n)));
        setVal('peaks.threshold', v);
      });
      peakDistanceInput && peakDistanceInput.addEventListener('input', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(1, Math.min(512, Math.round(n)));
        setVal('peaks.distance', v);
      });
      peakSmoothingInput && peakSmoothingInput.addEventListener('input', (e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(0, Math.min(8, Math.round(n)));
        setVal('peaks.smoothing', v);
      });

      peakThresholdInput && peakThresholdInput.addEventListener('blur', (e) => { const n = Number(e.target.value); e.target.value = String(Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 1); });
      peakDistanceInput && peakDistanceInput.addEventListener('blur', (e) => { const n = Number(e.target.value); e.target.value = String(Number.isFinite(n) ? Math.max(1, Math.min(512, Math.round(n))) : 1); });
      peakSmoothingInput && peakSmoothingInput.addEventListener('blur', (e) => { const n = Number(e.target.value); e.target.value = String(Number.isFinite(n) ? Math.max(0, Math.min(8, Math.round(n))) : 0); });

      card.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === 'spPingWorkerBtn') {
          setCoreActionFeedback('Pinging worker…', 'info');
          const client = ensureWorkerClient();
          if (client && typeof client.ping === 'function') {
            try {
              store.update('worker.enabled', true, { source: 'proBootstrap.core' });
              client.ping();
              setCoreActionFeedback('Worker ping sent.', 'ok');
            } catch (err) {
              setVal('worker.status', 'error');
              setVal('worker.lastError', String(err && err.message || err));
              setCoreActionFeedback('Ping worker failed: ' + String(err && err.message || err), 'error');
            }
          } else {
            setVal('worker.lastPingAt', Date.now());
            setVal('worker.lastError', 'Worker client unavailable (fallback ping marker)');
            if (store && store.getState && store.getState().worker && store.getState().worker.enabled) setVal('worker.status', 'ready');
            setCoreActionFeedback('Worker client unavailable; recorded fallback ping marker.', 'warn');
          }
        }
        if (t.id === 'spInitLibBtn') {
          setCoreActionFeedback('Initializing libraries…', 'info');
          const client = ensureWorkerClient();
          setVal('analysis.presetId', 'libraries-init-requested');
          if (client && typeof client.initLibraries === 'function') {
            try {
              store.update('worker.enabled', true, { source: 'proBootstrap.core' });
              client.initLibraries(null);
              setCoreActionFeedback('Library init request sent to worker.', 'ok');
            } catch (err) {
              setVal('worker.status', 'error');
              setVal('worker.lastError', String(err && err.message || err));
              setCoreActionFeedback('Init libraries failed: ' + String(err && err.message || err), 'error');
            }
          } else {
            setVal('worker.lastError', 'Worker client unavailable (cannot init libraries)');
            setCoreActionFeedback('Worker client unavailable; cannot init libraries yet.', 'warn');
          }
        }
        if (t.id === 'spRefreshUiBtn') {
          setCoreActionFeedback('UI refreshed (dock + status rerender).', 'ok');
          try { render(); 
    autoCloseInfoPopupIfDefault();
} catch (e) {}
          try { renderStatus(); } catch (e) {}
          try { renderConsole(); } catch (e) {}
          return;
        }
        if (t.id === 'spProbeCameraBtn') {
          setCoreActionFeedback('Probing camera capabilities…', 'info');
          probeCameraCapabilitiesIntoStore().then(function (res) { setCoreActionFeedback('Probe camera done (' + String((res && res.status) || 'unknown') + ').', 'ok'); renderStatus();
    renderConsole(); }).catch(function (err) { setCoreActionFeedback('Probe camera failed: ' + String(err && err.message || err), 'error'); });
          return;
        }
      });
    }

    ensureLabPanel();

    ['astro'].forEach((tab) => {
      const panel = ui.panels[tab];
      if (!panel || panel.dataset.built) return;
      const card = el('div', 'sp-card sp-card--flat');
      card.innerHTML = `<div class="sp-empty">${tab.toUpperCase()} panel placeholder (tab wiring OK).</div>`;
      panel.appendChild(card);
      panel.dataset.built = '1';
    });

    ensureCalibrationShell();
    ensureStatusRail();
  }


function setCoreActionFeedback(text, tone) {
  const el = $('spCoreActionFeedback') || $('spCalIoFeedback');
  if (!el) return;
  el.textContent = text || '';
  el.dataset.tone = tone || 'info';
}



function getCalibrationShellManager() {
  try {
    if (sp.calibrationPointManager) return sp.calibrationPointManager;
    const mgrMod = sp.v15 && sp.v15.calibrationPointManager;
    if (mgrMod && typeof mgrMod.create === 'function') {
      sp.calibrationPointManager = mgrMod.create();
      return sp.calibrationPointManager;
    }
  } catch (_) {}
  return null;
}

function getNormalizedShellCalibrationPoints() {
  const mgr = getCalibrationShellManager();
  const raw = (mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : [];
  const ioMod = sp.v15 && sp.v15.calibrationIO;
  if (ioMod && typeof ioMod.normalizeAndValidatePoints === 'function') {
    return ioMod.normalizeAndValidatePoints(raw, { minPoints: 2, maxPoints: 15, sortBy: 'px', dedupe: true });
  }
  const pts = Array.isArray(raw) ? raw.filter(function (p) {
    return p && Number.isFinite(Number(p.px)) && Number.isFinite(Number(p.nm));
  }).map(function (p) { return { px: Number(p.px), nm: Number(p.nm), label: p.label }; }) : [];
  pts.sort(function (a, b) { return (a.px - b.px) || (a.nm - b.nm); });
  const limited = pts.slice(0, 15);
  return { ok: limited.length >= 2, points: limited, count: limited.length, truncated: pts.length > limited.length, message: limited.length >= 2 ? 'OK' : 'Need at least 2 points' };
}

function setCalIoValidationText(msg, level) {
  const el = $('spCalIoValidation');
  if (!el) return;
  const text = String(msg || '').trim();
  el.textContent = text;
  el.className = 'sp-note sp-note--validation' + (level ? (' is-' + level) : '');
  el.style.display = text ? '' : 'none';
}

function previewShellCalibrationNormalization(points) {
  try {
    const ioMod = sp.v15 && sp.v15.calibrationIO;
    if (!ioMod || typeof ioMod.normalizeAndValidatePoints !== 'function') return null;
    return ioMod.normalizeAndValidatePoints(points, { minPoints: 2, maxPoints: 15, sortBy: 'px', dedupe: true });
  } catch (_) { return null; }
}

function formatCalValidationPreview(result) {
  if (!result) return { text: '', level: '' };
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  let text = result.message || ('Points: ' + (result.count || 0));
  if (warnings.length) text += ' — ' + warnings.join('; ');
  let level = result.ok ? 'ok' : 'warn';
  if (warnings.length && result.ok) level = 'warn';
  return { text: text, level: level };
}

function applyShellCalibrationPointsToOriginal() {
  const normalized = getNormalizedShellCalibrationPoints();
  if (!normalized || !normalized.ok) {
    return { ok: false, reason: (normalized && normalized.message) || 'No valid shell points' };
  }
  const pts = normalized.points;
  try {
    if (typeof window.resetCalibrationPoints !== 'function' || typeof window.setCalibrationPoints !== 'function') {
      return { ok: false, reason: 'Original calibration functions unavailable' };
    }
    window.resetCalibrationPoints();
    while (true) {
      const nextIndex = document.getElementById('point' + (pts.length) + 'px') ? pts.length : null;
      if (nextIndex != null) break;
      if (typeof window.addInputPair !== 'function') return { ok: false, reason: 'Cannot create calibration input pairs' };
      const before = document.querySelectorAll('#input-container .input-pair').length;
      window.addInputPair();
      const after = document.querySelectorAll('#input-container .input-pair').length;
      if (after <= before) break;
    }
    for (let i = 0; i < pts.length; i += 1) {
      const idx = i + 1;
      const pxEl = document.getElementById('point' + idx + 'px');
      const nmEl = document.getElementById('point' + idx + 'nm');
      if (!pxEl || !nmEl) return { ok: false, reason: 'Calibration input pair #' + idx + ' missing' };
      pxEl.value = String(pts[i].px);
      nmEl.value = String(pts[i].nm);
    }
    try { window.setCalibrationPoints(); } catch (err) { return { ok: false, reason: String(err && err.message || err) }; }

    let detailed = null;
    try {
      if (window.SpectraCore && window.SpectraCore.calibration) {
        if (typeof window.SpectraCore.calibration.emitCalibrationState === 'function') window.SpectraCore.calibration.emitCalibrationState();
        if (typeof window.SpectraCore.calibration.getDetailedState === 'function') detailed = window.SpectraCore.calibration.getDetailedState();
        else if (typeof window.SpectraCore.calibration.getState === 'function') detailed = window.SpectraCore.calibration.getState();
      }
    } catch (_) {}
    if (detailed) {
      updateStorePath('calibration', normalizeCalibrationState(detailed), { source: 'proBootstrap.calIO.apply' });
    } else {
      updateStorePath('calibration.shellPointCount', pts.length, { source: 'proBootstrap.calIO.apply' });
    }
    return { ok: true, count: pts.length, truncated: !!normalized.truncated, calibrated: !!(detailed && (detailed.calibrated || (detailed.coefficients && detailed.coefficients.length))) };
  } catch (err) {
    return { ok: false, reason: String(err && err.message || err) };
  }
}

function ensureLabPanel() {
  if (!ui || !ui.panels.lab) return;
  const panel = ui.panels.lab;
  let card = $('spLabCard');
  if (card) return card;
  card = el('div', 'sp-card sp-card--flat');
  card.id = 'spLabCard';
  card.innerHTML = [
    '<div class="sp-lab-head">',
    '  <div class="sp-lab-title">LAB</div>',
    '  <div id="spLabFeedback" class="sp-note sp-note--feedback" aria-live="polite"></div>',
    '</div>',
    '<div class="sp-form-grid sp-form-grid--lab">',
    '  <label id="spFieldLabEnabled" class="sp-field sp-field--lab-enabled">Analyze<input id="spLabEnabled" type="checkbox"></label>',
    '  <label id="spFieldLabMaxHz" class="sp-field sp-field--lab-maxhz">Max Hz<input id="spLabMaxHz" class="spctl-input spctl-input--lab-maxhz" type="number" min="1" max="30" step="1" value="4"></label>',
    '  <label id="spFieldLabPreset" class="sp-field sp-field--lab-preset">Preset<select id="spLabPreset" class="spctl-select spctl-select--lab-preset">',
    '    <option value="">(default)</option>',
    '    <option value="general">General</option>',
    '    <option value="alkali">Alkali</option>',
    '    <option value="metal">Metals</option>',
    '    <option value="gas">Gases</option>',
    '  </select></label>',
    '</div>',
    '<div class="sp-actions sp-actions--lab">',
    '  <button type="button" id="spLabInitLibBtn">Init libraries</button>',
    '  <button type="button" id="spLabPingBtn">Ping worker</button>',
    '  <button type="button" id="spLabQueryBtn">Query library</button>',
    '</div>',
    '<div class="sp-lab-split">',
    '  <div class="sp-lab-col">',
    '    <h4 class="sp-subtitle">Top hits</h4>',
    '    <div id="spLabHits" class="sp-lab-hits"></div>',
    '  </div>',
    '  <div class="sp-lab-col">',
    '    <h4 class="sp-subtitle">QC</h4>',
    '    <div id="spLabQc" class="sp-lab-qc"></div>',
    '  </div>',
    '</div>'
  ].join('');
  panel.appendChild(card);
  panel.dataset.built = '1';

  const setFeedback = function (text, tone) {
    const fb = $('spLabFeedback');
    if (!fb) return;
    fb.textContent = text || '';
    fb.dataset.tone = tone || '';
  };

  const s = getStoreState();
  const enabled = !!(s.analysis && s.analysis.enabled);
  const maxHz = Number(s.analysis && s.analysis.maxHz);
  const presetId = (s.analysis && s.analysis.presetId) ? String(s.analysis.presetId) : '';
  const enabledEl = $('spLabEnabled');
  const hzEl = $('spLabMaxHz');
  const presetEl = $('spLabPreset');
  if (enabledEl) enabledEl.checked = enabled;
  if (hzEl && Number.isFinite(maxHz) && maxHz > 0) hzEl.value = String(maxHz);
  if (presetEl) presetEl.value = presetId;

  const setVal = (path, value) => { if (store && store.update) store.update(path, value, { source: 'proBootstrap.lab' }); };

  enabledEl && enabledEl.addEventListener('change', function (e) {
    const on = !!e.target.checked;
    setVal('analysis.enabled', on);
    setFeedback(on ? 'LAB analysis enabled.' : 'LAB analysis disabled.', on ? 'ok' : 'info');
  });

  hzEl && hzEl.addEventListener('change', function (e) {
    const n = Number(e.target.value);
    if (!Number.isFinite(n) || n <= 0) return;
    setVal('analysis.maxHz', Math.max(1, Math.min(30, Math.round(n))));
    setFeedback('Max Hz set to ' + String(Math.max(1, Math.min(30, Math.round(n)))) + '.', 'info');
  });

  presetEl && presetEl.addEventListener('change', function (e) {
    const v = String(e.target.value || '');
    setVal('analysis.presetId', v || null);
    setFeedback(v ? ('Preset: ' + v) : 'Preset cleared.', 'info');
  });

  $('spLabInitLibBtn') && $('spLabInitLibBtn').addEventListener('click', function () {
    const client = ensureWorkerClient();
    if (!client || !client.initLibraries) { setFeedback('Worker client unavailable.', 'warn'); return; }
    setFeedback('Initializing libraries…', 'info');
    try {
      client.initLibraries(null);
    } catch (err) {
      setFeedback('Init libraries failed: ' + String(err && err.message || err), 'error');
    }
  });

  $('spLabPingBtn') && $('spLabPingBtn').addEventListener('click', function () {
    const client = ensureWorkerClient();
    if (!client || !client.ping) { setFeedback('Worker client unavailable.', 'warn'); return; }
    setFeedback('Pinging worker…', 'info');
    try { client.ping(); } catch (err) { setFeedback('Ping failed: ' + String(err && err.message || err), 'error'); }
  });

  $('spLabQueryBtn') && $('spLabQueryBtn').addEventListener('click', function () {
    setFeedback('Query library (coming next).', 'info');
  });

  return card;
}

function ensureCalibrationShell() {
  if (!ui || !ui.panels.other) return;
  const panel = ui.panels.other;
  let shell = $('spCalShell');
  if (shell) return shell;
  const card = el('div', 'sp-card sp-card--flat');
  card.id = 'spCalShell';
  card.innerHTML = [
    '<div class="sp-form-grid">',
    '  <label id="spFieldCalIoFormat" class="sp-field">Cal format<select id="spCalIoFormat" class="spctl-select"><option value="json">JSON</option><option value="csv">CSV</option></select></label>',
    '  <label id="spFieldCalIoText" class="sp-field sp-field--wide">Calibration I/O<textarea id="spCalIoText" class="spctl-input spctl-textarea" rows="5" placeholder="Paste calibration points here (JSON/CSV)"></textarea></label>',
    '</div>',
    '<div class="sp-actions">',
    '  <button type="button" id="spCalCaptureBtn">Capture current points</button>',
    '  <button type="button" id="spCalExportBtn">Export points</button>',
    '  <button type="button" id="spCalImportBtn">Import to shell</button>',
    '  <button type="button" id="spCalApplyBtn">Apply shell to calibration</button>',
    '  <button type="button" id="spCalClearBtn">Clear shell points</button>',
    '</div>',
    '<div id="spCalIoFeedback" class="sp-note sp-note--feedback" aria-live="polite"></div>',
    '<div id="spCalIoValidation" class="sp-note sp-note--validation" style="display:none"></div>'
  ].join('');
  panel.appendChild(card);
  panel.dataset.built = '1';

  const mgrMod = sp.v15 && sp.v15.calibrationPointManager;
  if (!sp.calibrationPointManager && mgrMod && typeof mgrMod.create === 'function') {
    try { sp.calibrationPointManager = mgrMod.create(); } catch (_) {}
  }
  const getMgr = function () {
    return sp.calibrationPointManager || (mgrMod && typeof mgrMod.create === 'function' ? (sp.calibrationPointManager = mgrMod.create()) : null);
  };
  const ioMod = sp.v15 && sp.v15.calibrationIO;

  panel.addEventListener('click', function (e) {
    const t = e.target.closest('button');
    if (!t) return;
    const txt = $('spCalIoText');
    const fmtSel = $('spCalIoFormat');
    const fmt = String((fmtSel && fmtSel.value) || 'json').toLowerCase();
    const mgr = getMgr();

    if (t.id === 'spCalCaptureBtn') {
      const st = getStoreState();
      const pts = (st.calibration && Array.isArray(st.calibration.points)) ? st.calibration.points : [];
      if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints(pts);
      if (txt) txt.value = '';
      updateStorePath('calibration.shellPointCount', Array.isArray(pts) ? pts.length : 0, { source: 'proBootstrap.calIO' });
      setCoreActionFeedback('Captured calibration points from current state into shell.', 'ok');
      var pvCapture = formatCalValidationPreview(previewShellCalibrationNormalization(pts));
      setCalIoValidationText(pvCapture.text, pvCapture.level);
      renderStatus();
    }
    if (t.id === 'spCalExportBtn') {
      const pts = (mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : [];
      let out = '';
      if (ioMod && typeof ioMod.serializeCalibrationPoints === 'function') {
        out = ioMod.serializeCalibrationPoints(pts, { format: fmt });
      } else {
        out = JSON.stringify(pts, null, 2);
      }
      if (txt) txt.value = out || '';
      updateStorePath('calibration.shellPointCount', Array.isArray(pts) ? pts.length : 0, { source: 'proBootstrap.calIO' });
      setCoreActionFeedback('Exported shell points to text area (' + fmt.toUpperCase() + ').', 'ok');
      var pvExport = formatCalValidationPreview(previewShellCalibrationNormalization(pts));
      setCalIoValidationText(pvExport.text, pvExport.level);
    }
    if (t.id === 'spCalImportBtn') {
      const raw = String((txt && txt.value) || '');
      if (!raw.trim()) { setCoreActionFeedback('Nothing to import. Paste JSON/CSV calibration points first.', 'warn'); return; }
      let pts = [];
      if (ioMod && typeof ioMod.parseCalibrationFile === 'function') pts = ioMod.parseCalibrationFile(raw, { formatHint: fmt });
      if (!Array.isArray(pts)) pts = [];
      if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints(pts);
      updateStorePath('calibration.shellPointCount', pts.length, { source: 'proBootstrap.calIO' });
      var pvImport = formatCalValidationPreview(previewShellCalibrationNormalization(pts));
      setCalIoValidationText(pvImport.text, pvImport.level);
      setCoreActionFeedback('Imported ' + pts.length + ' calibration point(s) into shell manager.', pts.length ? 'ok' : 'warn');
      renderStatus();
    }

    if (t.id === 'spCalApplyBtn') {
      const result = applyShellCalibrationPointsToOriginal();
      if (!result || !result.ok) {
        setCoreActionFeedback('Apply failed: ' + String((result && result.reason) || 'unknown error'), 'error');
        return;
      }
      updateStorePath('calibration.shellPointCount', Number(result.count) || 0, { source: 'proBootstrap.calIO' });
      var mgrPts = (mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : [];
      var pvApply = previewShellCalibrationNormalization(mgrPts);
      var pvApplyFmt = formatCalValidationPreview(pvApply);
      setCalIoValidationText(pvApplyFmt.text, pvApplyFmt.level);
      var warnTag = (pvApply && Array.isArray(pvApply.warnings) && pvApply.warnings.length) ? (' [' + pvApply.warnings.join('; ') + ']') : '';
      setCoreActionFeedback('Applied ' + result.count + ' shell point(s) to original calibration' + (result.truncated ? ' (truncated to max).' : '.') + warnTag, 'ok');
      renderStatus();
      return;
    }

    if (t.id === 'spCalClearBtn') {
      if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints([]);
      if (txt) txt.value = '';
      updateStorePath('calibration.shellPointCount', 0, { source: 'proBootstrap.calIO' });
      setCoreActionFeedback('Cleared shell calibration points.', 'ok');
      setCalIoValidationText('', '');
      renderStatus();
    }
  });

  panel.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || t.id !== 'spCalIoText') return;
    var raw = String(t.value || '');
    if (!raw.trim()) { setCalIoValidationText('', ''); return; }
    var fmtSel2 = $('spCalIoFormat');
    var fmt2 = String((fmtSel2 && fmtSel2.value) || 'json').toLowerCase();
    var ioMod2 = sp.v15 && sp.v15.calibrationIO;
    var pts2 = [];
    try { if (ioMod2 && typeof ioMod2.parseCalibrationFile === 'function') pts2 = ioMod2.parseCalibrationFile(raw, { formatHint: fmt2 }); } catch (_) {}
    var pvText = formatCalValidationPreview(previewShellCalibrationNormalization(pts2));
    setCalIoValidationText(pvText.text, pvText.level);
  });

  panel.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.id !== 'spCalIoFormat') return;
    var txt2 = $('spCalIoText');
    var raw2 = String((txt2 && txt2.value) || '');
    if (!raw2.trim()) { setCalIoValidationText('', ''); return; }
    var ioMod3 = sp.v15 && sp.v15.calibrationIO;
    var pts3 = [];
    try { if (ioMod3 && typeof ioMod3.parseCalibrationFile === 'function') pts3 = ioMod3.parseCalibrationFile(raw2, { formatHint: String(t.value || 'json').toLowerCase() }); } catch (_) {}
    var pvFmt2 = formatCalValidationPreview(previewShellCalibrationNormalization(pts3));
    setCalIoValidationText(pvFmt2.text, pvFmt2.level);
  });

  return card;
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


  function shouldSkipSyncValue(el) {
    try { return !!el && document.activeElement === el; } catch (_) { return false; }
  }
function renderConsole() {
  const pre = document.getElementById('spConsolePre');
  if (!pre) return;
  const lines = getConsoleLines();
  pre.textContent = lines.join('\n');
  try {
    const body = document.getElementById('spConsoleBody');
    if (body) body.scrollTop = body.scrollHeight;
  } catch {}
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
    if (appModeSel && !shouldSkipSyncValue(appModeSel) && state.appMode && appModeSel.value !== state.appMode) appModeSel.value = state.appMode;
    const workerSel = $('spWorkerMode');
    if (workerSel && !shouldSkipSyncValue(workerSel)) {
      const ws = state.worker || {};
      const inferred = ws.enabled ? (ws.status === 'idle' ? 'auto' : 'on') : 'off';
      const nextWorkerSel = (ws.mode === 'auto' || ws.mode === 'on' || ws.mode === 'off') ? ws.mode : inferred;
      if (workerSel.value !== nextWorkerSel) workerSel.value = nextWorkerSel;
    }
    const displaySel = $('spDisplayMode');
    if (displaySel && !shouldSkipSyncValue(displaySel)) {
      const m = String((state.display && state.display.mode) || 'normal').toLowerCase();
      if (displaySel.value !== m) displaySel.value = m;
    }
    const yAxisSel = $('spYAxisMode');
    const yAxisMaxInput = $('spYAxisMax');
    if (yAxisSel && !shouldSkipSyncValue(yAxisSel)) {
      const ym = String((state.display && state.display.yAxisMode) || 'auto').toLowerCase();
      if (yAxisSel.value !== ym) yAxisSel.value = ym;
      if (yAxisMaxInput) yAxisMaxInput.disabled = (ym !== 'manual');
    }
    if (yAxisMaxInput && !shouldSkipSyncValue(yAxisMaxInput)) {
      const v = Number((state.display && state.display.yAxisMax));
      const next = Number.isFinite(v) && v > 0 ? String(Math.round(v)) : '255';
      if (String(yAxisMaxInput.value) !== next) yAxisMaxInput.value = next;
    }
    const peakThresholdInput = $('spPeakThreshold');
    const peakDistanceInput = $('spPeakDistance');
    const peakSmoothingInput = $('spPeakSmoothing');
    const fillModeSel = $('spFillMode');
    const fillOpacityInput = $('spFillOpacity');
    const peaks = state.peaks || {};
    if (fillModeSel && !shouldSkipSyncValue(fillModeSel)) {
      const mode = String((state.display && state.display.fillMode) || 'inherit').toLowerCase();
      if (fillModeSel.value !== mode) fillModeSel.value = mode;
    }
    if (fillOpacityInput && !shouldSkipSyncValue(fillOpacityInput)) {
      const fo = Number(state.display && state.display.fillOpacity);
      if (Number.isFinite(fo)) {
        const nextNum = Math.max(0, Math.min(1, Math.round(fo * 100) / 100));
        const next = String(nextNum);
        if (String(fillOpacityInput.value) !== next) fillOpacityInput.value = next;
      }
    }
    if (peakThresholdInput && !shouldSkipSyncValue(peakThresholdInput) && Number.isFinite(Number(peaks.threshold))) {
      const next = String(Math.max(0, Math.min(255, Math.round(Number(peaks.threshold)))));
      if (String(peakThresholdInput.value) !== next) peakThresholdInput.value = next;
    }
    if (peakDistanceInput && !shouldSkipSyncValue(peakDistanceInput) && Number.isFinite(Number(peaks.distance))) {
      const next = String(Math.max(1, Math.min(512, Math.round(Number(peaks.distance)))));
      if (String(peakDistanceInput.value) !== next) peakDistanceInput.value = next;
    }
    if (peakSmoothingInput && !shouldSkipSyncValue(peakSmoothingInput) && Number.isFinite(Number(peaks.smoothing))) {
      const next = String(Math.max(0, Math.min(8, Math.round(Number(peaks.smoothing)))));
      if (String(peakSmoothingInput.value) !== next) peakSmoothingInput.value = next;
    }
  }

  
function cleanupSpuriousPopup() {
  const popup = $('infoPopup');
  const msg = $('infoPopupMessage');
  if (!popup) return;
  const defaultMsg = (msg && (msg.textContent || '').trim()) === 'Info message';
  if (popup.classList.contains('show') && defaultMsg && typeof window.closeInfoPopup === 'function') {
    try { window.closeInfoPopup(); } catch (e) {}
  }
}

function renderLabPanel() {
  if (!ui || !ui.panels || !ui.panels.lab) return;
  const hitsEl = $('spLabHits');
  const qcEl = $('spLabQc');
  if (!hitsEl || !qcEl) return;
  const state = getStoreState();
  const hits = (state.analysis && Array.isArray(state.analysis.topHits)) ? state.analysis.topHits : [];
  const qc = (state.analysis && Array.isArray(state.analysis.qcFlags)) ? state.analysis.qcFlags : [];
  const libsLoaded = !!(state.worker && state.worker.librariesLoaded);

  if (!libsLoaded) {
    hitsEl.innerHTML = '<div class="sp-empty">Libraries not initialized yet. Click Init libraries.</div>';
  } else if (!hits.length) {
    hitsEl.innerHTML = '<div class="sp-empty">No hits yet. Enable Analyze and point at a source.</div>';
  } else {
    const rows = hits.slice(0, 8).map(function (h) {
      const name = String(h && (h.label || h.element || h.name) || 'Unknown');
      const score = (h && (h.confidence ?? h.score)) != null ? Number(h.confidence ?? h.score) : null;
      const nm = (h && h.nm) != null ? Number(h.nm) : null;
      const scoreTxt = Number.isFinite(score) ? (Math.round(score * 100) / 100).toFixed(2) : '';
      const nmTxt = Number.isFinite(nm) ? (Math.round(nm * 100) / 100).toFixed(2) + ' nm' : '';
      return '<div class="sp-hit"><div class="sp-hit-name">' + escapeHtml(name) + '</div><div class="sp-hit-meta">' + escapeHtml(nmTxt) + (scoreTxt ? (' · ' + escapeHtml(scoreTxt)) : '') + '</div></div>';
    }).join('');
    hitsEl.innerHTML = rows;
  }

  if (!qc.length) {
    qcEl.innerHTML = '<div class="sp-empty">No QC flags.</div>';
  } else {
    qcEl.innerHTML = qc.slice(0, 8).map(function (q) {
      return '<div class="sp-qc-flag">' + escapeHtml(String(q)) + '</div>';
    }).join('');
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
    renderLabPanel();
    cleanupSpuriousPopup();
  }

  function init() {
function wrapShowInfoPopup() {
  try {
    if (window.__spOriginalShowInfoPopup) return;
    if (typeof window.showInfoPopup !== 'function') return;
    window.__spOriginalShowInfoPopup = window.showInfoPopup;
    window.showInfoPopup = function (message, buttonContainer, callback) {
      const msg = String(message == null ? '' : message).trim();
      if (msg === 'Info message' || msg === 'Info') {
        // swallow generic placeholder popup
        return;
      }
      return window.__spOriginalShowInfoPopup(message, buttonContainer, callback);
    };
  } catch (e) {}
}

function autoCloseInfoPopupIfDefault() {
  try {
    const popup = document.getElementById('infoPopup');
    const msgEl = document.getElementById('infoPopupMessage');
    if (!popup || !msgEl) return;
    const msg = (msgEl.textContent || '').trim();
    // only close the generic default popup, never real error popups
    if (msg === 'Info message' || msg === 'Info') {
      popup.classList.remove('show');
    }
  } catch (e) {}
}

    if (booted) return;
    booted = true;
    wrapShowInfoPopup();
    render();
    // Step 1 wiring: create a singleton worker client if available (lazy worker start remains in client).
    ensureWorkerClient();
    setTimeout(function () { probeCameraCapabilitiesIntoStore(); }, 0);
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
      bus.on('worker:ready', function(){ setCoreActionFeedback('Worker ready.', 'ok'); renderStatus(); });
      bus.on('worker:libraries', function(){ setCoreActionFeedback('Worker libraries initialized.', 'ok'); renderStatus(); });
      bus.on('worker:error', function(){ setCoreActionFeedback('Worker error. See STATUS.', 'error'); renderStatus(); });
      bus.on('worker:timeout', function(){ setCoreActionFeedback('Worker timeout.', 'warn'); renderStatus(); });
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
              maybeRunLabAnalyze(normalized);
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