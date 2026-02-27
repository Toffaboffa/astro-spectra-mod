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
  const safe = (line ?? '').toString().replace(/\s+$/,'');
  const lines = getConsoleLines();
  const maxLines = store?.getState()?.ui?.console?.maxLines || 300;
  const next = lines.concat(safe).slice(-maxLines);
  try { store.update(CONSOLE_PATH, next); } catch (e) {}
  try { renderConsole(); } catch (e) {}
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
      const btn = el('button', 'sp-tab', tab === 'core' ? 'CORE' : (tab === 'general' ? 'General' : tab.toUpperCase()));
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

    // Phase 2: run LAB processing pipeline (subtraction/ratio/absorbance + quick peaks)
    // before sending to worker matching.
    const sub = state.subtraction || {};
    const subtractionMode = String(sub.mode || 'raw');
    let referenceI = Array.isArray(sub.referenceI) ? sub.referenceI : null;
    let darkI = Array.isArray(sub.darkI) ? sub.darkI : null;

    // If no PRO-captured reference exists, fall back to the original reference graph if available.
    try {
      if (!referenceI && window.SpectraCore && window.SpectraCore.reference && typeof window.SpectraCore.reference.getLatestPixels === 'function') {
        const ref = window.SpectraCore.reference.getLatestPixels();
        if (Array.isArray(ref)) referenceI = ref;
      }
    } catch (_) {}

    const pipe = (sp && sp.processingPipeline && typeof sp.processingPipeline.run === 'function') ? sp.processingPipeline : null;
    const peakUi = getInitialPeakUiValues();
    const processed = pipe
      ? pipe.run(frameNormalized, {
          subtractionMode,
          referenceI,
          darkI,
          // use existing Peak controls to tune quick peak sensitivity
          quickPeakThreshold: Math.max(0.01, Math.min(0.95, (Number(peakUi.threshold) || 1) / 255)),
          quickPeakDistance: Math.max(1, Math.min(32, Number(peakUi.distance) || 4))
        })
      : { processedI: frameNormalized.I.slice(), normalizedI: null, quickPeaks: [] };

    const nmOk = Array.isArray(frameNormalized.nm) && frameNormalized.nm.length === frameNormalized.I.length;
    const payloadFrame = {
      I: frameNormalized.I,
      processedI: Array.isArray(processed.processedI) ? processed.processedI : frameNormalized.I,
      nm: nmOk ? frameNormalized.nm : null,
      calibrated: nmOk,
      subtractionMode,
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
      const ranges = (result && result.ranges && typeof result.ranges === 'object') ? result.ranges : {};
      const summary = (result && result.summary && typeof result.summary === 'object') ? result.summary : {};
      const status = String((result && result.status) || (result && result.source === 'track' ? 'ok' : 'no-track'));
      store.update('camera.source', String((result && result.source) || 'none'), { source: 'proBootstrap.cameraCaps' });
      store.update('camera.supported', supported, { source: 'proBootstrap.cameraCaps' });
      store.update('camera.values', values, { source: 'proBootstrap.cameraCaps' });
      store.update('camera.ranges', ranges, { source: 'proBootstrap.cameraCaps' });
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

    // Keep PRO "tab" and PRO "app mode" in sync.
    // User tabs are General / CORE / LAB / ASTRO / OTHER.
    // App mode must follow LAB/ASTRO to enable worker overlays + analysis.
    try {
      const t = String(tab || '').toLowerCase();
      const nextMode = (t === 'lab') ? 'LAB' : ((t === 'astro') ? 'ASTRO' : 'CORE');
      if (sp.appMode && typeof sp.appMode.setMode === 'function') {
        sp.appMode.setMode(nextMode, { source: 'proBootstrap.tab' });
      } else if (store && store.update) {
        store.update('appMode', nextMode, { source: 'proBootstrap.tab' });
      }
      // Ensure worker is enabled in LAB/ASTRO so the user doesn't have to hunt in CORE.
      if (nextMode !== 'CORE') setCoreWorkerMode('auto');
    } catch (_) {}
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

  function ensureSideConsole() {
  const host = document.getElementById('cameraSettingsWindow');
  if (!host) return;
  if (document.getElementById('spSideConsolePre')) return;

  const wrap = document.createElement('div');
  wrap.id = 'spSideConsoleWrap';
  wrap.className = 'sp-side-console';

  const body = document.createElement('div');
  body.id = 'spSideConsoleBody';
  body.className = 'sp-side-console-body';

  const pre = document.createElement('pre');
  pre.id = 'spSideConsolePre';
  pre.className = 'sp-side-console-pre';
  body.appendChild(pre);

  const cursor = document.createElement('span');
  cursor.className = 'sp-side-console-cursor';
  cursor.textContent = '█';
  body.appendChild(cursor);

  wrap.appendChild(body);
  host.appendChild(wrap);
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
        '  <label id="spFieldToggleNmPeaks" class="sp-field sp-field--toggle-nm-peaks sp-field--checkbox-row"><span>Toggle nm peaks</span><input id="spToggleNmPeaks" type="checkbox"></label>',
        '  <label id="spFieldFillMode" class="sp-field sp-field--fill-mode">Fill mode<select id="spFillMode" class="spctl-select spctl-select--fill-mode">' + fillModeOptions + '</select></label>',
        '  <label id="spFieldFillOpacity" class="sp-field sp-field--fill-opacity">Fill opacity<input id="spFillOpacity" class="spctl-input spctl-input--fill-opacity spctl-range spctl-range--fill-opacity" type="range" min="0" max="1" step="0.01" value="0.70"></label>',
        '</div>',
        '<div class="sp-actions">',
        '  <button type="button" id="spInitLibBtn">Init libraries</button>',
        '  <button type="button" id="spPingWorkerBtn">Ping worker</button>',
        '  <button type="button" id="spRefreshUiBtn">Refresh UI</button>',
        '  <button type="button" id="spProbeCameraBtn">Probe camera</button>',
        '</div>',
        '<div id="spCameraCtlWrap" class="sp-card-sub" style="margin-top:10px; display:none">',
        '  <h4 class="sp-subtitle" style="margin:0 0 8px 0">Camera controls (optional)</h4>',
        '  <div class="sp-form-grid">',
        '    <label class="sp-field">Zoom<input id="spCamZoom" class="spctl-input" type="range" min="1" max="10" step="0.1" value="1"></label>',
        '    <label class="sp-field">Exposure<input id="spCamExposure" class="spctl-input" type="range" min="1" max="1000" step="1" value="1"></label>',
        '  </div>',
        '  <div id="spCameraCtlNote" class="sp-note sp-note--feedback" aria-live="polite"></div>',
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
      const toggleNmPeaksInput = card.querySelector('#spToggleNmPeaks');
      const fillModeSel = card.querySelector('#spFillMode');
      const fillOpacityInput = card.querySelector('#spFillOpacity');
      const camCtlWrap = card.querySelector('#spCameraCtlWrap');
      const camZoomInput = card.querySelector('#spCamZoom');
      const camExposureInput = card.querySelector('#spCamExposure');
      const camCtlNote = card.querySelector('#spCameraCtlNote');
      const setVal = (path, value) => { if (store && store.update) store.update(path, value, { source: 'proBootstrap.core' }); };
      const peakInit = getInitialPeakUiValues();
      if (peakThresholdInput) peakThresholdInput.value = String(peakInit.threshold);
      if (peakDistanceInput) peakDistanceInput.value = String(peakInit.distance);
      if (peakSmoothingInput) peakSmoothingInput.value = String(peakInit.smoothing);
      const legacyTogglePeaks = $('togglePeaksCheckbox');
      if (toggleNmPeaksInput && legacyTogglePeaks) {
        toggleNmPeaksInput.checked = !!legacyTogglePeaks.checked;
      }
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
      toggleNmPeaksInput && toggleNmPeaksInput.addEventListener('change', (e) => {
        const target = $('togglePeaksCheckbox');
        if (!target) return;
        target.checked = !!e.target.checked;
        try { target.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
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
    clearInlineFeedbackAreas(); 
    
    clearInlineFeedbackAreas();
autoCloseInfoPopupIfDefault();
} catch (e) {}
          try { renderStatus(); } catch (e) {}
          try { renderConsole(); } catch (e) {}
          return;
        }
        if (t.id === 'spProbeCameraBtn') {
          setCoreActionFeedback('Probing camera capabilities…', 'info');
          probeCameraCapabilitiesIntoStore().then(function (res) {
            setCoreActionFeedback('Probe camera done (' + String((res && res.status) || 'unknown') + ').', 'ok');
            try { renderStatus(); } catch (_) {}
            try { renderConsole(); } catch (_) {}
            try { renderCameraControlsFromStore(); } catch (_) {}
          }).catch(function (err) { setCoreActionFeedback('Probe camera failed: ' + String(err && err.message || err), 'error'); });
          return;
        }
      });

      // Camera controls (optional) — apply constraints only if supported.
      const applyCamSetting = function (key, val) {
        const camMod = sp.v15 && sp.v15.cameraCapabilities;
        if (!camMod || typeof camMod.applySetting !== 'function') {
          if (camCtlNote) camCtlNote.textContent = 'Camera controls unavailable (module missing).';
          return;
        }
        // Persist desired value for reproducibility/debugging.
        setVal('camera.desired.' + key, val);
        camMod.applySetting(key, val).then(function (res) {
          const ok = !!(res && res.ok);
          const msg = ok
            ? ('Applied ' + key + ' = ' + String(res.value))
            : ('Failed to apply ' + key + ' (' + String((res && res.reason) || 'unknown') + ')');
          if (camCtlNote) camCtlNote.textContent = msg;
          try { appendConsole('[CAM] ' + msg); } catch (_) {}
          // Refresh probe after apply so Status/DQ stays truthful.
          return probeCameraCapabilitiesIntoStore();
        }).then(function () {
          try { renderStatus(); } catch (_) {}
          try { renderCameraControlsFromStore(); } catch (_) {}
        }).catch(function (err) {
          const msg = 'Camera apply error: ' + String(err && err.message || err);
          if (camCtlNote) camCtlNote.textContent = msg;
          try { appendConsole('[CAM] ' + msg); } catch (_) {}
        });
      };

      camZoomInput && camZoomInput.addEventListener('change', function (e) {
        applyCamSetting('zoom', Number(e.target.value));
      });
      camExposureInput && camExposureInput.addEventListener('change', function (e) {
        applyCamSetting('exposureTime', Number(e.target.value));
      });

      // Render camera controls based on store state.
      function renderCameraControlsFromStore() {
        const st = getStoreState();
        const cam = st.camera || {};
        const supported = cam.supported || {};
        const values = cam.values || {};
        const ranges = cam.ranges || {};
        const show = !!(supported.zoom || supported.exposureTime);
        if (camCtlWrap) camCtlWrap.style.display = show ? '' : 'none';
        if (!show) return;

        if (camZoomInput) {
          camZoomInput.disabled = !supported.zoom;
          if (supported.zoom && ranges.zoom) {
            if (ranges.zoom.min != null) camZoomInput.min = String(ranges.zoom.min);
            if (ranges.zoom.max != null) camZoomInput.max = String(ranges.zoom.max);
            if (ranges.zoom.step != null) camZoomInput.step = String(ranges.zoom.step);
          }
          const zv = Number(values.zoom);
          if (Number.isFinite(zv)) camZoomInput.value = String(zv);
        }

        if (camExposureInput) {
          camExposureInput.disabled = !supported.exposureTime;
          if (supported.exposureTime && ranges.exposureTime) {
            if (ranges.exposureTime.min != null) camExposureInput.min = String(ranges.exposureTime.min);
            if (ranges.exposureTime.max != null) camExposureInput.max = String(ranges.exposureTime.max);
            if (ranges.exposureTime.step != null) camExposureInput.step = String(ranges.exposureTime.step);
          }
          const ev = Number(values.exposureTime);
          if (Number.isFinite(ev)) camExposureInput.value = String(ev);
        }

        if (camCtlNote && cam.error) camCtlNote.textContent = String(cam.error);
      }

      // Initial render (in case camera already running and a probe ran).
      try { renderCameraControlsFromStore(); } catch (_) {}
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
    ensureDataQualityDetails();
    ensureStatusRail();
    ensureSideConsole();
  }


function ensureDataQualityDetails() {
  if (!ui || !ui.panels.other) return;
  const panel = ui.panels.other;
  if ($('spDQDetails')) return;
  const card = el('div', 'sp-card sp-card--flat');
  card.id = 'spDQDetails';
  card.innerHTML = [
    '<h3 style="margin:0 0 8px 0">Data Quality (details)</h3>',
    '<div class="sp-note" style="opacity:0.9">This is a read-only breakdown of the same metrics shown in the status rail.</div>',
    '<div id="spDQDetailsBody" class="sp-status-lines" style="margin-top:8px"></div>'
  ].join('');
  panel.appendChild(card);
}


function setCoreActionFeedback(text, tone) {
  try { if (text) appendConsole(String(text)); } catch (e) {}
}
function setLabFeedback(text, tone) {
  try { if (text) appendConsole(String(text)); } catch (e) {}
}
function setCalIoFeedback(text, tone) {
  try { if (text) appendConsole(String(text)); } catch (e) {}
}

function getCalibrationShellManager
() {
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
  const raw = (mgr && typeof mgr.getEnabledPoints === 'function') ? mgr.getEnabledPoints()
    : ((mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : []);
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

    // Save a rollback backup (best-effort) before overwriting inputs.
    try {
      const st = getStoreState();
      const cur = (st.calibration && Array.isArray(st.calibration.points)) ? st.calibration.points : [];
      updateStorePath('calibration.lastApplyBackup', Array.isArray(cur) ? cur.slice() : cur, { source: 'proBootstrap.calIO.apply' });
      updateStorePath('calibration.lastApplyBackupAt', Date.now(), { source: 'proBootstrap.calIO.apply' });
    } catch (_) {}

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
	    '<div class="sp-lab-layout">',
	    '  <div class="sp-lab-left">',
	    '    <div class="sp-lab-head">',
	    '      <div class="sp-lab-title">LAB</div>',
	    '      <div id="spLabFeedback" class="sp-note sp-note--feedback" aria-live="polite"></div>',
	    '    </div>',
	    '    <div class="sp-lab-fields">',
	    '      <div class="sp-lab-fields-col">',
	    '        <label id="spFieldLabEnabled" class="sp-field sp-field--lab-enabled sp-field--checkbox-row"><span>Analyze</span><input id="spLabEnabled" type="checkbox"></label>',
	    '        <label id="spFieldLabMaxHz" class="sp-field sp-field--lab-maxhz">Max Hz<input id="spLabMaxHz" class="spctl-input spctl-input--lab-maxhz" type="number" min="1" max="30" step="1" value="4"></label>',
	    '        <label id="spFieldLabPreset" class="sp-field sp-field--lab-preset">Preset<select id="spLabPreset" class="spctl-select spctl-select--lab-preset">',
	    '          <option value="">(default)</option>',
	    '          <option value="general">General</option>',
	    '          <option value="lamp-hg">Lamp (Hg/Ar/Ne)</option>',
	    '          <option value="smart">Smart</option>',
	    '          <option value="general-tight">General (tight)</option>',
	    '          <option value="general-wide">General (wide)</option>',
	    '          <option value="fast">Fast</option>',
	    '        </select></label>',
	    '        <label id="spFieldLabSubMode" class="sp-field sp-field--lab-sub">Mode<select id="spLabSubMode" class="spctl-select spctl-select--lab-sub">',
	    '          <option value="raw">Raw</option>',
	    '          <option value="raw-dark">Raw - Dark</option>',
	    '          <option value="difference">Difference (Raw - Ref)</option>',
	    '          <option value="ratio">Ratio (Raw / Ref)</option>',
	    '          <option value="transmittance">Transmittance %</option>',
	    '          <option value="absorbance">Absorbance</option>',
	    '        </select></label>',
	    '      </div>',
	    '      <div class="sp-lab-fields-col">',
	    '        <label id="spFieldLabWeak" class="sp-field sp-field--lab-weak sp-field--checkbox-row"><span>Weak peaks</span><input id="spLabWeak" type="checkbox"></label>',
	    '        <label id="spFieldLabStable" class="sp-field sp-field--lab-stable sp-field--checkbox-row"><span>Stable hits</span><input id="spLabStable" type="checkbox"></label>',
	    '        <label id="spFieldLabSmart" class="sp-field sp-field--lab-smart sp-field--checkbox-row"><span>Smart find</span><input id="spLabSmart" type="checkbox"></label>',
	    '        <label id="spFieldLabPeakThr" class="sp-field sp-field--lab-thr">Peak threshold<input id="spLabPeakThr" class="spctl-input spctl-input--lab-thr" type="number" min="0.5" max="50" step="0.5" value="5"></label>',
	    '        <label id="spFieldLabPeakDist" class="sp-field sp-field--lab-dist">Peak distance<input id="spLabPeakDist" class="spctl-input spctl-input--lab-dist" type="number" min="1" max="64" step="1" value="5"></label>',
	    '      </div>',
	    '    </div>',
	    '    <div class="sp-actions sp-actions--lab">',
	    '      <button type="button" id="spLabInitLibBtn">Init libraries</button>',
	    '      <button type="button" id="spLabPingBtn">Ping worker</button>',
	    '      <button type="button" id="spLabQueryBtn">Query library</button>',
	    '      <button type="button" id="spLabCapRefBtn">Capture ref</button>',
	    '      <button type="button" id="spLabCapDarkBtn">Capture dark</button>',
	    '      <button type="button" id="spLabClearSubBtn">Clear</button>',
	    '    </div>',
	    '  </div>',
	    '  <div class="sp-lab-right">',
	    '    <div class="sp-lab-table">',
	    '      <div class="sp-lab-th">TOP HITS</div>',
	    '      <div class="sp-lab-th">QC</div>',
	    '      <div id="spLabHits" class="sp-lab-hits"></div>',
	    '      <div id="spLabQc" class="sp-lab-qc"></div>',
	    '    </div>',
	    '  </div>',
	    '</div>'
  ].join('');
  panel.appendChild(card);
  panel.dataset.built = '1';

  // LAB must log to the *on-page* console (the right-side console panel),
  // not to an inline LAB div and not to DevTools.
  const logLab = function (text, tone) {
    const msg = '[LAB] ' + String(text || '');
    try {
      if (sp && sp.consoleLog && typeof sp.consoleLog.append === 'function') {
        sp.consoleLog.append(msg);
      }
    } catch (_) {}
  };

  const setFeedback = function (text, tone) {
    // Keep the feedback container empty (layout only). Everything goes to the on-page console.
    const fb = $('spLabFeedback');
    if (fb) {
      fb.textContent = '';
      fb.dataset.tone = '';
    }
    if (text) logLab(text, tone);
  };

  const s = getStoreState();
  const enabled = !!(s.analysis && s.analysis.enabled);
  const maxHz = Number(s.analysis && s.analysis.maxHz);
  const presetId = (s.analysis && s.analysis.presetId) ? String(s.analysis.presetId) : '';
  const includeWeak = !!(s.analysis && s.analysis.includeWeakPeaks);
  const stableHits = !!(s.analysis && s.analysis.stableHits);
  const smartFind = !!(s.analysis && s.analysis.smartFindEnabled);
  const enabledEl = $('spLabEnabled');
  const hzEl = $('spLabMaxHz');
  const presetEl = $('spLabPreset');
  const subModeEl = $('spLabSubMode');
  const weakEl = $('spLabWeak');
  const stableEl = $('spLabStable');
  const smartEl = $('spLabSmart');
  const peakThrEl = $('spLabPeakThr');
  const peakDistEl = $('spLabPeakDist');
  if (enabledEl) enabledEl.checked = enabled;
  if (hzEl && Number.isFinite(maxHz) && maxHz > 0) hzEl.value = String(maxHz);
  if (presetEl) presetEl.value = presetId;
  if (weakEl) weakEl.checked = includeWeak;
  if (stableEl) stableEl.checked = stableHits;
  if (smartEl) smartEl.checked = smartFind;
  if (peakThrEl) peakThrEl.value = String(Math.max(0.5, Math.min(50, ((Number(s.analysis && s.analysis.peakThresholdRel) || 0.05) * 100))));
  if (peakDistEl) peakDistEl.value = String(Math.max(1, Math.min(64, Math.round(Number(s.analysis && s.analysis.peakDistancePx) || 5))));
  // subtraction mode
  try {
    const sm = (s.subtraction && s.subtraction.mode) ? String(s.subtraction.mode) : 'raw';
    if (subModeEl) subModeEl.value = sm;
  } catch (_) {}

  const setVal = (path, value) => { if (store && store.update) store.update(path, value, { source: 'proBootstrap.lab' }); };

  enabledEl && enabledEl.addEventListener('change', function (e) {
    const on = !!e.target.checked;
    setVal('analysis.enabled', on);
    // Make LAB usable without touching CORE.
    if (on) {
      try { setCoreWorkerMode('auto'); } catch (_) {}
      try {
        const client = ensureWorkerClient();
        if (client && typeof client.start === 'function') client.start();
      } catch (_) {}
    }
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
    // Tell worker about preset (worker may use it later for filtering/settings).
    try {
      const client = ensureWorkerClient();
      if (client && typeof client.setPreset === 'function') client.setPreset(v || null);
    } catch (_) {}
    setFeedback(v ? ('Preset: ' + v) : 'Preset cleared.', 'info');
  });

  subModeEl && subModeEl.addEventListener('change', function (e) {
    const v = String(e.target.value || 'raw');
    setVal('subtraction.mode', v);
    setFeedback('Mode: ' + v, 'info');
  });

  weakEl && weakEl.addEventListener('change', function (e) {
    const on = !!e.target.checked;
    setVal('analysis.includeWeakPeaks', on);
    setFeedback(on ? 'Weak peaks enabled.' : 'Weak peaks disabled.', 'info');
  });

  stableEl && stableEl.addEventListener('change', function (e) {
    const on = !!e.target.checked;
    setVal('analysis.stableHits', on);
    setFeedback(on ? 'Stable hits enabled (rolling).' : 'Stable hits disabled.', 'info');
  });

  smartEl && smartEl.addEventListener('change', function (e) {
    const on = !!e.target.checked;
    setVal('analysis.smartFindEnabled', on);
    setFeedback(on ? 'Smart find enabled.' : 'Smart find disabled.', 'info');
  });

  peakThrEl && peakThrEl.addEventListener('change', function (e) {
    const n = Number(e.target.value);
    if (!Number.isFinite(n)) return;
    const pct = Math.max(0.5, Math.min(50, n));
    setVal('analysis.peakThresholdRel', +(pct / 100).toFixed(4));
    setFeedback('Peak threshold set to ' + pct + '%.', 'info');
  });

  peakDistEl && peakDistEl.addEventListener('change', function (e) {
    const n = Number(e.target.value);
    if (!Number.isFinite(n)) return;
    const dist = Math.max(1, Math.min(64, Math.round(n)));
    setVal('analysis.peakDistancePx', dist);
    setFeedback('Peak distance set to ' + dist + ' px.', 'info');
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
    const client = ensureWorkerClient();
    if (!client || typeof client.queryLibrary !== 'function') {
      setFeedback('Worker client unavailable.', 'warn');
      return;
    }
    const state = getStoreState();
    const frame = getLiveFrame(state);
    let minNm = 380;
    let maxNm = 780;
    try {
      if (frame && Array.isArray(frame.nm) && frame.nm.length) {
        const nums = frame.nm.map(Number).filter(Number.isFinite);
        if (nums.length) {
          minNm = Math.min.apply(null, nums);
          maxNm = Math.max.apply(null, nums);
        }
      }
    } catch (_) {}
    // Clamp to sane range to avoid extreme/noise values.
    if (!Number.isFinite(minNm)) minNm = 380;
    if (!Number.isFinite(maxNm)) maxNm = 780;
    minNm = Math.max(200, Math.min(1200, minNm));
    maxNm = Math.max(200, Math.min(1200, maxNm));
    setFeedback('Querying library for ' + Math.round(minNm) + '–' + Math.round(maxNm) + ' nm…', 'info');
    try { client.queryLibrary(minNm, maxNm, null); } catch (err) { setFeedback('Query failed: ' + String(err && err.message || err), 'error'); }

    // Open popup once results land (renderLabPanel handles actual content).
    try { openLabQueryPopup(); } catch (_) {}
  });

  function openLabQueryPopup() {
    let modal = $('spLabQueryModal');
    if (!modal) {
      modal = el('div', 'sp-modal');
      modal.id = 'spLabQueryModal';
      modal.innerHTML = [
        '<div class="sp-modal__backdrop" data-close="1"></div>',
        '<div class="sp-modal__panel">',
        '  <div class="sp-modal__head">',
        '    <div class="sp-modal__title">Library lines</div>',
        '    <button type="button" class="sp-modal__close" id="spLabQueryClose">×</button>',
        '  </div>',
        '  <div class="sp-form-grid sp-form-grid--tight">',
        '    <label class="sp-field sp-field--wide">Search<input id="spLabQuerySearch" class="spctl-input" type="text" placeholder="e.g. Fe, Na, 198Hg"></label>',
        '  </div>',
        '  <div id="spLabQueryList" class="sp-modal__body sp-lab-query-list"></div>',
        '</div>'
      ].join('');
      // IMPORTANT: append modal to document.body so it overlays the entire page
      // (not just the LAB card/panel), avoiding clipping/stacking-context issues.
      (document.body || document.documentElement).appendChild(modal);
      modal.addEventListener('click', function (ev) {
        const t = ev.target;
        if (t && (t.id === 'spLabQueryClose' || t.dataset && t.dataset.close === '1')) close();
      });
      const search = $('spLabQuerySearch');
      search && search.addEventListener('input', function () { renderLabQueryList(); });
    }
    modal.classList.add('is-open');
    renderLabQueryList();
    function close() { modal.classList.remove('is-open'); }
  }

  function renderLabQueryList() {
    const modal = $('spLabQueryModal');
    if (!modal || !modal.classList.contains('is-open')) return;
    const host = $('spLabQueryList');
    if (!host) return;
    const state = getStoreState();
    const qHits = (state.analysis && Array.isArray(state.analysis.libraryQueryHits)) ? state.analysis.libraryQueryHits : [];
    const qCount = (state.analysis && typeof state.analysis.libraryQueryCount === 'number') ? state.analysis.libraryQueryCount : null;
    const qMin = (state.analysis && typeof state.analysis.libraryQueryMinNm === 'number') ? state.analysis.libraryQueryMinNm : null;
    const qMax = (state.analysis && typeof state.analysis.libraryQueryMaxNm === 'number') ? state.analysis.libraryQueryMaxNm : null;
    const search = $('spLabQuerySearch');
    const q = search ? String(search.value || '').trim().toLowerCase() : '';
    const list = q ? qHits.filter(function (h) {
      const name = String(h && (h.speciesKey || h.species || h.element) || '').toLowerCase();
      const el = String(h && (h.element || '') || '').toLowerCase();
      return name.indexOf(q) !== -1 || el === q;
    }) : qHits;
    if (!qHits.length) {
      host.innerHTML = '<div class="sp-empty">No query results yet. Click Query library.</div>';
      return;
    }
    const head = '<div class="sp-note sp-note--small">' +
      (qMin != null && qMax != null ? ('Range: ' + escapeHtml(String(Math.round(qMin))) + '–' + escapeHtml(String(Math.round(qMax))) + ' nm') : 'Range query') +
      (qCount != null ? (' · ' + escapeHtml(String(qCount)) + ' total') : '') +
      (q ? (' · filtered') : '') +
      '</div>';
    const rows = list.slice(0, 200).map(function (h) {
      const name = String(h && (h.speciesKey || h.species || h.element) || 'Unknown');
      const nm = (h && h.nm) != null ? Number(h.nm) : null;
      const nmTxt = Number.isFinite(nm) ? (Math.round(nm * 100) / 100).toFixed(2) + ' nm' : '';
      const elTxt = h && h.element ? (' · ' + String(h.element)) : '';
      return '<div class="sp-hit"><div class="sp-hit-name">' + escapeHtml(name) + '</div><div class="sp-hit-meta">' + escapeHtml(nmTxt + elTxt) + '</div></div>';
    }).join('');
    host.innerHTML = head + rows;
  }

  // Capture reference/dark workflows (Phase 2 subtraction MVP)
  function capture(kind) {
    const state = getStoreState();
    const frame = getLiveFrame(state);
    const f = normalizeGraphFrame(frame);
    if (!f || !Array.isArray(f.I) || !f.I.length) {
      setFeedback('No live frame to capture.', 'warn');
      return;
    }
    const arr = f.I.slice();
    if (kind === 'ref') {
      setVal('subtraction.referenceI', arr);
      setVal('subtraction.hasReference', true);
      setVal('subtraction.referenceCapturedAt', Date.now());
      setFeedback('Captured reference (' + arr.length + ' pts).', 'ok');
    } else {
      setVal('subtraction.darkI', arr);
      setVal('subtraction.hasDark', true);
      setVal('subtraction.darkCapturedAt', Date.now());
      setFeedback('Captured dark (' + arr.length + ' pts).', 'ok');
    }
  }

  $('spLabCapRefBtn') && $('spLabCapRefBtn').addEventListener('click', function () { capture('ref'); });
  $('spLabCapDarkBtn') && $('spLabCapDarkBtn').addEventListener('click', function () { capture('dark'); });
  $('spLabClearSubBtn') && $('spLabClearSubBtn').addEventListener('click', function () {
    setVal('subtraction.referenceI', null);
    setVal('subtraction.darkI', null);
    setVal('subtraction.hasReference', false);
    setVal('subtraction.hasDark', false);
    setVal('subtraction.referenceCapturedAt', null);
    setVal('subtraction.darkCapturedAt', null);
    setFeedback('Cleared reference/dark.', 'info');
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
    '<div class="sp-cal-layout">',
    '  <div class="sp-cal-left">',
    '    <div class="sp-form-grid sp-form-grid--cal-io">',
    '      <label id="spFieldCalIoFormat" class="sp-field">Cal format<select id="spCalIoFormat" class="spctl-select"><option value="json">JSON</option><option value="csv">CSV</option></select></label>',
    '      <label id="spFieldCalIoText" class="sp-field sp-field--wide">Calibration I/O<textarea id="spCalIoText" class="spctl-input spctl-textarea" rows="5" placeholder="Paste calibration points here (JSON/CSV)"></textarea></label>',
    '    </div>',
    '    <div class="sp-actions">',
    '      <button type="button" id="spCalCaptureBtn">Capture current points</button>',
    '      <button type="button" id="spCalExportBtn">Export points</button>',
    '      <button type="button" id="spCalImportBtn">Import to shell</button>',
    '      <button type="button" id="spCalSyncFromCoreBtn">Sync from calibration</button>',
    '      <button type="button" id="spCalImportFileBtn">Import from file</button>',
    '      <button type="button" id="spCalApplyBtn">Apply shell to calibration</button>',
    '      <button type="button" id="spCalClearBtn">Clear shell points</button>',
    '      <button type="button" id="spCalUndoShellBtn">Undo shell edit</button>',
    '      <button type="button" id="spCalRollbackBtn">Rollback last apply</button>',
    '    </div>',
    '    <div id="spCalIoFeedback" class="sp-note sp-note--feedback" aria-live="polite"></div>',
    '    <div id="spCalIoValidation" class="sp-note sp-note--validation" style="display:none"></div>',
    '    <div id="spCalShellNote" class="sp-note sp-note--feedback" aria-live="polite"></div>',
    '  </div>',
    '  <div class="sp-cal-right">',
    '    <h4 class="sp-subtitle" style="margin:0 0 8px 0">Shell points</h4>',
    '    <div id="spCalShellTable" class="sp-cal-shell-table"></div>',
    '  </div>',
    '</div>'
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

  function setShellNote(text) {
    const n = $('spCalShellNote');
    if (n) n.textContent = String(text || '');
  }

  function renderShellPointsTable() {
    const host = $('spCalShellTable');
    if (!host) return;
    const mgr = getMgr();
    const pts = (mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : [];
    if (!pts.length) {
      host.innerHTML = '<div class="sp-empty">No shell points.</div>';
      return;
    }
    const rows = pts.map(function (p, idx) {
      const en = (p && p.enabled === false) ? '' : 'checked';
      const label = p && p.label ? String(p.label) : '';
      return [
        '<div class="sp-cal-row" data-idx="' + idx + '">',
        '  <label class="sp-cal-en"><input type="checkbox" class="spCalEn" ' + en + '> enable</label>',
        '  <div class="sp-cal-cell">px: <span class="sp-cal-val">' + (p && Number.isFinite(Number(p.px)) ? Number(p.px).toFixed(2) : '—') + '</span></div>',
        '  <div class="sp-cal-cell">nm: <span class="sp-cal-val">' + (p && Number.isFinite(Number(p.nm)) ? Number(p.nm).toFixed(2) : '—') + '</span></div>',
        '  <div class="sp-cal-cell sp-cal-label">' + label + '</div>',
        '  <button type="button" class="spCalRemove">Remove</button>',
        '</div>'
      ].join('');
    }).join('');
    host.innerHTML = rows;
  }

  function updateShellCountsAndValidation() {
    const mgr = getMgr();
    const pts = (mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : [];
    const enabledPts = (mgr && typeof mgr.getEnabledPoints === 'function') ? mgr.getEnabledPoints() : pts;
    updateStorePath('calibration.shellPointCount', Array.isArray(pts) ? pts.length : 0, { source: 'proBootstrap.calIO.shell' });
    updateStorePath('calibration.shellEnabledCount', Array.isArray(enabledPts) ? enabledPts.length : 0, { source: 'proBootstrap.calIO.shell' });
    const pv = formatCalValidationPreview(previewShellCalibrationNormalization(enabledPts));
    setCalIoValidationText(pv.text, pv.level);
  }

  function captureBackupFromCurrentCalibrationState() {
    const st = getStoreState();
    const pts = (st.calibration && Array.isArray(st.calibration.points)) ? st.calibration.points : [];
    // Keep a shallow backup for rollback.
    updateStorePath('calibration.lastApplyBackup', pts.slice ? pts.slice() : pts, { source: 'proBootstrap.calIO.backup' });
    updateStorePath('calibration.lastApplyBackupAt', Date.now(), { source: 'proBootstrap.calIO.backup' });
  }

  function rollbackLastApply() {
    const st = getStoreState();
    const backup = st.calibration && Array.isArray(st.calibration.lastApplyBackup) ? st.calibration.lastApplyBackup : [];
    if (!backup || !backup.length) return { ok: false, reason: 'No backup points saved yet.' };
    const mgr = getMgr();
    if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints(backup);
    const normalized = (sp.v15 && sp.v15.calibrationIO && typeof sp.v15.calibrationIO.normalizeAndValidatePoints === 'function')
      ? sp.v15.calibrationIO.normalizeAndValidatePoints(backup, { minPoints: 2, maxPoints: 15, sortBy: 'px', dedupe: true })
      : { ok: backup.length >= 2, points: backup.slice(0, 15), count: Math.min(15, backup.length) };
    if (!normalized.ok) return { ok: false, reason: 'Backup points invalid.' };
    // Reuse the same apply logic but with the backup points currently in shell.
    const res = applyShellCalibrationPointsToOriginal();
    return res && res.ok ? { ok: true, count: res.count } : { ok: false, reason: (res && res.reason) || 'Rollback apply failed.' };
  }

  panel.addEventListener('click', function (e) {
    const t = e.target.closest('button');
    if (!t) return;

    // Shell table row actions
    if (t.classList && t.classList.contains('spCalRemove')) {
      const row = t.closest('.sp-cal-row');
      const idx = row ? Number(row.getAttribute('data-idx')) : NaN;
      const mgrX = getMgr();
      if (mgrX && typeof mgrX.removeAt === 'function' && Number.isFinite(idx)) {
        mgrX.removeAt(idx);
        renderShellPointsTable();
        updateShellCountsAndValidation();
        setShellNote('Removed shell point #' + (idx + 1) + '.');
      }
      return;
    }

    if (t.id === 'spCalUndoShellBtn') {
      const mgrU = getMgr();
      if (mgrU && typeof mgrU.undo === 'function') {
        mgrU.undo();
        renderShellPointsTable();
        updateShellCountsAndValidation();
        setShellNote('Undo applied.');
      }
      return;
    }

    if (t.id === 'spCalRollbackBtn') {
      const resRb = rollbackLastApply();
      if (!resRb || !resRb.ok) {
        setShellNote('Rollback failed: ' + String((resRb && resRb.reason) || 'unknown'));
      } else {
        setShellNote('Rollback applied (' + String(resRb.count || 0) + ' point(s)).');
      }
      renderShellPointsTable();
      updateShellCountsAndValidation();
      renderStatus();
      return;
    }

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
      renderShellPointsTable();
      updateShellCountsAndValidation();
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
      var pvExport = formatCalValidationPreview(previewShellCalibrationNormalization((mgr && typeof mgr.getEnabledPoints === 'function') ? mgr.getEnabledPoints() : pts));
      setCalIoValidationText(pvExport.text, pvExport.level);
      renderShellPointsTable();
      updateShellCountsAndValidation();
    }
    if (t.id === 'spCalImportBtn') {
      const raw = String((txt && txt.value) || '');
      if (!raw.trim()) { setCoreActionFeedback('Nothing to import. Paste JSON/CSV calibration points first.', 'warn'); return; }
      let pts = [];
      if (ioMod && typeof ioMod.parseCalibrationFile === 'function') pts = ioMod.parseCalibrationFile(raw, { formatHint: fmt });
      if (!Array.isArray(pts)) pts = [];
      if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints(pts);
      updateStorePath('calibration.shellPointCount', pts.length, { source: 'proBootstrap.calIO' });
      var pvImport = formatCalValidationPreview(previewShellCalibrationNormalization((mgr && typeof mgr.getEnabledPoints === 'function') ? mgr.getEnabledPoints() : pts));
      setCalIoValidationText(pvImport.text, pvImport.level);
      setCoreActionFeedback('Imported ' + pts.length + ' calibration point(s) into shell manager.', pts.length ? 'ok' : 'warn');
      renderShellPointsTable();
      updateShellCountsAndValidation();
      renderStatus();
    }

    // Sync shell from the active ORIGINAL calibration (px/nm arrays already solved).
    if (t.id === 'spCalSyncFromCoreBtn') {
      let corePts = [];
      try {
        if (window.SpectraCore && window.SpectraCore.calibration && typeof window.SpectraCore.calibration.getState === 'function') {
          const cs = window.SpectraCore.calibration.getState();
          corePts = (cs && Array.isArray(cs.points)) ? cs.points : [];
        }
      } catch (_) {}
      if (!corePts.length) {
        setCoreActionFeedback('No active calibration points found to sync.', 'warn');
        return;
      }
      if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints(corePts);
      updateStorePath('calibration.shellPointCount', corePts.length, { source: 'proBootstrap.calIO' });
      setCoreActionFeedback('Synced shell points from current calibration (' + corePts.length + ').', 'ok');
      var pvSync = formatCalValidationPreview(previewShellCalibrationNormalization((mgr && typeof mgr.getEnabledPoints === 'function') ? mgr.getEnabledPoints() : corePts));
      setCalIoValidationText(pvSync.text, pvSync.level);
      renderShellPointsTable();
      updateShellCountsAndValidation();
      renderStatus();
      return;
    }

    // Convenience: trigger the ORIGINAL import-from-file flow (txt px;nm) and then sync.
    if (t.id === 'spCalImportFileBtn') {
      try {
        const fileEl = document.getElementById('my-file');
        if (!fileEl) {
          setCoreActionFeedback('Original file input not found (#my-file).', 'warn');
          return;
        }
        // When the original import completes, it calls setCalibrationPoints() which emits calibrationChanged.
        // We then sync shell from core after a short delay.
        fileEl.click();
        setCoreActionFeedback('Select a calibration .txt file (px;nm). After import, the shell will sync automatically.', 'info');
        setTimeout(function () {
          try {
            const cs = window.SpectraCore && window.SpectraCore.calibration && window.SpectraCore.calibration.getState ? window.SpectraCore.calibration.getState() : null;
            const pts = (cs && Array.isArray(cs.points)) ? cs.points : [];
            if (pts.length && mgr && typeof mgr.setPoints === 'function') {
              mgr.setPoints(pts);
              updateStorePath('calibration.shellPointCount', pts.length, { source: 'proBootstrap.calIO' });
              renderShellPointsTable();
              updateShellCountsAndValidation();
              renderStatus();
              setShellNote('Synced ' + pts.length + ' point(s) from imported calibration.');
            }
          } catch (_) {}
        }, 600);
      } catch (err) {
        setCoreActionFeedback('Import-from-file failed: ' + String(err && err.message || err), 'error');
      }
      return;
    }

    if (t.id === 'spCalApplyBtn') {
      const result = applyShellCalibrationPointsToOriginal();
      if (!result || !result.ok) {
        setCoreActionFeedback('Apply failed: ' + String((result && result.reason) || 'unknown error'), 'error');
        return;
      }
      updateStorePath('calibration.shellPointCount', Number(result.count) || 0, { source: 'proBootstrap.calIO' });
      var mgrPts = (mgr && typeof mgr.getEnabledPoints === 'function') ? mgr.getEnabledPoints() : ((mgr && typeof mgr.getPoints === 'function') ? mgr.getPoints() : []);
      var pvApply = previewShellCalibrationNormalization(mgrPts);
      var pvApplyFmt = formatCalValidationPreview(pvApply);
      setCalIoValidationText(pvApplyFmt.text, pvApplyFmt.level);
      var warnTag = (pvApply && Array.isArray(pvApply.warnings) && pvApply.warnings.length) ? (' [' + pvApply.warnings.join('; ') + ']') : '';
      setCoreActionFeedback('Applied ' + result.count + ' shell point(s) to original calibration' + (result.truncated ? ' (truncated to max).' : '.') + warnTag, 'ok');
      renderShellPointsTable();
      updateShellCountsAndValidation();
      renderStatus();
      return;
    }

    if (t.id === 'spCalClearBtn') {
      if (mgr && typeof mgr.setPoints === 'function') mgr.setPoints([]);
      if (txt) txt.value = '';
      updateStorePath('calibration.shellPointCount', 0, { source: 'proBootstrap.calIO' });
      setCoreActionFeedback('Cleared shell calibration points.', 'ok');
      setCalIoValidationText('', '');
      renderShellPointsTable();
      updateShellCountsAndValidation();
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
    if (!t) return;

    // Enable/disable shell points
    if (t.classList && t.classList.contains('spCalEn')) {
      const row = t.closest('.sp-cal-row');
      const idx = row ? Number(row.getAttribute('data-idx')) : NaN;
      const mgrE = getMgr();
      if (mgrE && typeof mgrE.setEnabled === 'function' && Number.isFinite(idx)) {
        mgrE.setEnabled(idx, !!t.checked);
        updateShellCountsAndValidation();
        setShellNote('Shell point #' + (idx + 1) + ' ' + (t.checked ? 'enabled' : 'disabled') + '.');
      }
      return;
    }

    if (t.id !== 'spCalIoFormat') return;
    var txt2 = $('spCalIoText');
    var raw2 = String((txt2 && txt2.value) || '');
    if (!raw2.trim()) { setCalIoValidationText('', ''); return; }
    var ioMod3 = sp.v15 && sp.v15.calibrationIO;
    var pts3 = [];
    try { if (ioMod3 && typeof ioMod3.parseCalibrationFile === 'function') pts3 = ioMod3.parseCalibrationFile(raw2, { formatHint: String(t.value || 'json').toLowerCase() }); } catch (_) {}
    var pvFmt2 = formatCalValidationPreview(previewShellCalibrationNormalization(pts3));
    setCalIoValidationText(pvFmt2.text, pvFmt2.level);
  });

  // Initial render
  try { renderShellPointsTable(); } catch (_) {}
  try { updateShellCountsAndValidation(); } catch (_) {}

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
  const pre = document.getElementById('spSideConsolePre');
  if (!pre) return;
  const lines = getConsoleLines();
  pre.textContent = lines.join('\n');
  try {
    const body = document.getElementById('spSideConsoleBody');
    if (body) body.scrollTop = body.scrollHeight;
  } catch (e) {}
}




  function renderStatus() {
    const sEl = $('spStatusText');
    const qEl = $('spDataQualityText');
    if (!sEl || !qEl) return;
    const state = getStoreState();
    const lines = computeDataQualityLines(state);
    sEl.innerHTML = lines.status.join('<br>');
    qEl.innerHTML = lines.dq.join('<br>');

    const dqDetails = $('spDQDetailsBody');
    if (dqDetails) {
      const combined = [];
      combined.push('<b>Status</b>');
      combined.push(lines.status.join('<br>'));
      combined.push('<br><br><b>Data Quality</b>');
      combined.push(lines.dq.join('<br>'));
      dqDetails.innerHTML = combined.join('');
    }

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
  const smartEnabled = !!(state.analysis && state.analysis.smartFindEnabled);
  const smartHits = (state.analysis && Array.isArray(state.analysis.smartFindHits)) ? state.analysis.smartFindHits : [];
  const smartGroups = (state.analysis && Array.isArray(state.analysis.smartFindGroups)) ? state.analysis.smartFindGroups : [];
  const hits = smartEnabled && smartHits.length
    ? smartHits
    : ((state.analysis && Array.isArray(state.analysis.topHits)) ? state.analysis.topHits : []);
  const qc = (state.analysis && Array.isArray(state.analysis.qcFlags)) ? state.analysis.qcFlags : [];
  const libsLoaded = !!(state.worker && state.worker.librariesLoaded);
  const mode = String(state.appMode || 'CORE').toUpperCase();
  const enabled = !!(state.analysis && state.analysis.enabled);
  const calibrated = !!(state.calibration && (state.calibration.calibrated || (state.calibration.coefficients && state.calibration.coefficients.length)));

  if (mode !== 'LAB') {
    hitsEl.innerHTML = '<div class="sp-empty">LAB mode is not active. Open the LAB tab.</div>';
  } else if (!libsLoaded) {
    hitsEl.innerHTML = '<div class="sp-empty">Libraries not initialized yet. Click <b>Init libraries</b>.</div>';
  } else if (!enabled) {
    hitsEl.innerHTML = '<div class="sp-empty">Analysis is off. Tick <b>Analyze</b> to start matching.</div>';
  } else if (!calibrated) {
    hitsEl.innerHTML = '<div class="sp-empty">Not calibrated yet. Import calibration points (old Calibrate screen) or apply points in OTHER, then try again.</div>';
  } else if (!hits.length) {
    hitsEl.innerHTML = '<div class="sp-empty">No hits yet. Point at a bright source (e.g. fluorescent lamp) and wait 1–2 seconds. Use <b>Query library</b> to browse lines.</div>';
  } else {
    // Compact one-line rows: "6σ • He (Helium) • 123.2nm"
    const PERIODIC = {
      H:'Hydrogen',He:'Helium',Li:'Lithium',Be:'Beryllium',B:'Boron',C:'Carbon',N:'Nitrogen',O:'Oxygen',F:'Fluorine',Ne:'Neon',
      Na:'Sodium',Mg:'Magnesium',Al:'Aluminum',Si:'Silicon',P:'Phosphorus',S:'Sulfur',Cl:'Chlorine',Ar:'Argon',K:'Potassium',Ca:'Calcium',
      Sc:'Scandium',Ti:'Titanium',V:'Vanadium',Cr:'Chromium',Mn:'Manganese',Fe:'Iron',Co:'Cobalt',Ni:'Nickel',Cu:'Copper',Zn:'Zinc',
      Ga:'Gallium',Ge:'Germanium',As:'Arsenic',Se:'Selenium',Br:'Bromine',Kr:'Krypton',Rb:'Rubidium',Sr:'Strontium',Y:'Yttrium',Zr:'Zirconium',
      Nb:'Niobium',Mo:'Molybdenum',Tc:'Technetium',Ru:'Ruthenium',Rh:'Rhodium',Pd:'Palladium',Ag:'Silver',Cd:'Cadmium',In:'Indium',Sn:'Tin',
      Sb:'Antimony',Te:'Tellurium',I:'Iodine',Xe:'Xenon',Cs:'Cesium',Ba:'Barium',La:'Lanthanum',Ce:'Cerium',Pr:'Praseodymium',Nd:'Neodymium',
      Pm:'Promethium',Sm:'Samarium',Eu:'Europium',Gd:'Gadolinium',Tb:'Terbium',Dy:'Dysprosium',Ho:'Holmium',Er:'Erbium',Tm:'Thulium',Yb:'Ytterbium',
      Lu:'Lutetium',Hf:'Hafnium',Ta:'Tantalum',W:'Tungsten',Re:'Rhenium',Os:'Osmium',Ir:'Iridium',Pt:'Platinum',Au:'Gold',Hg:'Mercury',
      Tl:'Thallium',Pb:'Lead',Bi:'Bismuth',Po:'Polonium',At:'Astatine',Rn:'Radon',Fr:'Francium',Ra:'Radium',Ac:'Actinium',Th:'Thorium',
      Pa:'Protactinium',U:'Uranium',Np:'Neptunium',Pu:'Plutonium',Am:'Americium',Cm:'Curium',Bk:'Berkelium',Cf:'Californium',Es:'Einsteinium',Fm:'Fermium',
      Md:'Mendelevium',No:'Nobelium',Lr:'Lawrencium',Rf:'Rutherfordium',Db:'Dubnium',Sg:'Seaborgium',Bh:'Bohrium',Hs:'Hassium',Mt:'Meitnerium',Ds:'Darmstadtium',
      Rg:'Roentgenium',Cn:'Copernicium',Nh:'Nihonium',Fl:'Flerovium',Mc:'Moscovium',Lv:'Livermorium',Ts:'Tennessine',Og:'Oganesson'
    };
    function toSymbol(v){
      const raw = String(v || '').trim();
      if (!raw) return '';
      const s = raw.replace(/^[0-9]+/, '');
      const m = s.match(/^([A-Z][a-z]?)/);
      return m ? m[1] : '';
    }
    function sigmaFromConfidence(c){
      const conf = Number(c);
      if (!Number.isFinite(conf)) return 0;
      return Math.max(1, Math.min(6, Math.round(conf * 6)));
    }
    const groupRows = smartEnabled && smartGroups.length ? smartGroups.slice(0, 6).map(function (g, idx) {
      const symbol = String((g && g.element) || '').trim();
      const fullName = symbol && PERIODIC[symbol] ? PERIODIC[symbol] : '';
      const lines = Math.max(1, Number(g && g.lineCount) || 0);
      const left = '#' + String(idx + 1);
      const who = symbol ? (symbol + (fullName ? (' (' + fullName + ')') : '')) : 'Unknown';
      const line = left + ' • Smart find • ' + who + ' • ' + lines + ' lines';
      return '<div class="sp-hit sp-hit--one sp-hit--smart">' + escapeHtml(line) + '</div>';
    }).join('') : '';
    const rows = hits.slice(0, 80).map(function (h) {
      const symbol = String((h && (h.element || '')) || '').trim() || toSymbol(h && (h.species || h.speciesKey || h.name));
      const fullName = symbol && PERIODIC[symbol] ? PERIODIC[symbol] : '';
      const nm = (h && (h.referenceNm != null ? h.referenceNm : (h.observedNm != null ? h.observedNm : h.nm))) != null ? Number(h.referenceNm != null ? h.referenceNm : (h.observedNm != null ? h.observedNm : h.nm)) : null;
      const sig = sigmaFromConfidence(h && (h.confidence != null ? h.confidence : h.score));
      const nmTxt = Number.isFinite(nm) ? (Math.round(nm * 10) / 10).toFixed(1) + 'nm' : '';
      const left = (sig ? (sig + 'σ') : '•');
      const who = symbol ? (symbol + (fullName ? (' (' + fullName + ')') : '')) : 'Unknown';
      const smartTxt = h && h.smartFind ? (' • group #' + String((h.smartGroupRank || 0) + 1)) : '';
      const line = left + ' • ' + who + (nmTxt ? (' • ' + nmTxt) : '') + smartTxt;
      return '<div class="sp-hit sp-hit--one' + (h && h.smartFind ? ' sp-hit--smartline' : '') + '">' + escapeHtml(line) + '</div>';
    }).join('');
    hitsEl.innerHTML = groupRows + rows;
  }

  if (!qc.length) {
    qcEl.innerHTML = '<div class="sp-empty">No QC flags.</div>';
  } else {
    qcEl.innerHTML = qc.slice(0, 8).map(function (q) {
      return '<div class="sp-qc-flag">' + escapeHtml(String(q)) + '</div>';
    }).join('');
  }

  // If the query modal is open, refresh its list from the latest store state.
  try {
    const modal = $('spLabQueryModal');
    const host = $('spLabQueryList');
    if (modal && host && modal.classList.contains('is-open')) {
      const qHits = (state.analysis && Array.isArray(state.analysis.libraryQueryHits)) ? state.analysis.libraryQueryHits : [];
      const qCount = (state.analysis && typeof state.analysis.libraryQueryCount === 'number') ? state.analysis.libraryQueryCount : null;
      const qMin = (state.analysis && typeof state.analysis.libraryQueryMinNm === 'number') ? state.analysis.libraryQueryMinNm : null;
      const qMax = (state.analysis && typeof state.analysis.libraryQueryMaxNm === 'number') ? state.analysis.libraryQueryMaxNm : null;
      const search = $('spLabQuerySearch');
      const q = search ? String(search.value || '').trim().toLowerCase() : '';
      const list = q ? qHits.filter(function (h) {
        const name = String(h && (h.speciesKey || h.species || h.element) || '').toLowerCase();
        const el = String(h && (h.element || '') || '').toLowerCase();
        return name.indexOf(q) !== -1 || el === q;
      }) : qHits;
      if (!qHits.length) {
        host.innerHTML = '<div class="sp-empty">No query results yet. Click Query library.</div>';
      } else {
        const head = '<div class="sp-note sp-note--small">' +
          (qMin != null && qMax != null ? ('Range: ' + escapeHtml(String(Math.round(qMin))) + '–' + escapeHtml(String(Math.round(qMax))) + ' nm') : 'Range query') +
          (qCount != null ? (' · ' + escapeHtml(String(qCount)) + ' total') : '') +
          (q ? (' · filtered') : '') +
          '</div>';
        const rows = list.slice(0, 200).map(function (h) {
          const name = String(h && (h.speciesKey || h.species || h.element) || 'Unknown');
          const nm = (h && h.nm) != null ? Number(h.nm) : null;
          const nmTxt = Number.isFinite(nm) ? (Math.round(nm * 100) / 100).toFixed(2) + ' nm' : '';
          const elTxt = h && h.element ? (' · ' + String(h.element)) : '';
          return '<div class="sp-hit"><div class="sp-hit-name">' + escapeHtml(name) + '</div><div class="sp-hit-meta">' + escapeHtml(nmTxt + elTxt) + '</div></div>';
        }).join('');
        host.innerHTML = head + rows;
      }
    }
  } catch (_) {}
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
function clearInlineFeedbackAreas() {
  try {
    const a = ['spCoreActionFeedback','spLabFeedback','spCalIoFeedback'];
    a.forEach((id) => { const elx = document.getElementById(id); if (elx) elx.textContent=''; });
  } catch (e) {}
}

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
      bus.on('worker:libraries', function(msg){
        try {
          const p = msg && msg.payload ? msg.payload : {};
          const count = (p && typeof p.count === 'number') ? p.count : null;
          const warn = Array.isArray(p.warnings) ? p.warnings : [];
          setCoreActionFeedback('Worker libraries initialized.' + (count != null ? (' (' + count + ' lines)') : ''), 'ok');
          if (sp && sp.consoleLog && typeof sp.consoleLog.append === 'function') {
            sp.consoleLog.append('[LAB] Libraries ready' + (count != null ? (' · ' + count + ' lines') : '') + '.');
            warn.slice(0, 3).forEach(function(w){ sp.consoleLog.append('[LAB] Library warning: ' + String(w)); });
          }
        } catch (_) { setCoreActionFeedback('Worker libraries initialized.', 'ok'); }
        renderStatus();
      });
      bus.on('worker:error', function(){ setCoreActionFeedback('Worker error. See STATUS.', 'error'); renderStatus(); });
      bus.on('worker:timeout', function(){ setCoreActionFeedback('Worker timeout.', 'warn'); renderStatus(); });
      bus.on('worker:result', renderStatus);
      bus.on('worker:query', function(msg){
        try {
          const p = msg && msg.payload ? msg.payload : {};
          if (sp && sp.consoleLog && typeof sp.consoleLog.append === 'function') {
            if (p && p.ok) {
              sp.consoleLog.append('[LAB] Query result: ' + String(p.shown || 0) + ' shown (' + String(p.count || 0) + ' total) for ' + Math.round(Number(p.minNm) || 0) + '–' + Math.round(Number(p.maxNm) || 0) + ' nm.');
            } else {
              sp.consoleLog.append('[LAB] Query failed: ' + String(p.message || 'unknown')); 
            }
          }
        } catch (_) {}
        render();
      });
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
              // Phase 2: ensure nm-axis exists when calibration coefficients are available.
              // This enables worker matching and top hits.
              let adapted = normalized;
              try {
                const st = getStoreState();
                if (window.SpectraPro && window.SpectraPro.spectrumFrameAdapter && typeof window.SpectraPro.spectrumFrameAdapter.adapt === 'function') {
                  const a = window.SpectraPro.spectrumFrameAdapter.adapt(normalized, st && st.calibration);
                  if (a) adapted = a;
                }
              } catch (_) {}

              updateStorePath('frame.latest', adapted, { source: 'proBootstrap.frameSync' });
              updateStorePath('frame.source', adapted.source || 'unknown', { source: 'proBootstrap.frameSync' });
              maybeRunLabAnalyze(adapted);
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