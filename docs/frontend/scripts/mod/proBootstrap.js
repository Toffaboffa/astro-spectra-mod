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

  function getStoreState() {
    try { return (store && store.getState) ? (store.getState() || {}) : {}; }
    catch (_) { return {}; }
  }

  function syncActiveTabToStore(tab) {
    if (!store || !store.setState) return;
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
      card.innerHTML = [
        '<div class="sp-form-grid">',
        '  <label>App mode<select id="spAppMode"><option value="CORE">CORE</option><option value="LAB">LAB</option><option value="ASTRO">ASTRO</option></select></label>',
        '  <label>Worker<select id="spWorkerMode"><option value="auto">Auto</option><option value="on">On</option><option value="off">Off</option></select></label>',
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
      const setVal = (path, value) => { if (store && store.update) store.update(path, value, { source: 'proBootstrap.core' }); };

      modeSel && modeSel.addEventListener('change', (e) => {
        const mode = String(e.target.value || 'CORE').toUpperCase();
        setVal('appMode', mode);
      });
      workerSel && workerSel.addEventListener('change', (e) => {
        const val = String(e.target.value || 'auto');
        if (val === 'on') { setVal('worker.enabled', true); setVal('worker.status', 'ready'); }
        else if (val === 'off') { setVal('worker.enabled', false); setVal('worker.status', 'idle'); }
      });
      card.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === 'spPingWorkerBtn') {
          setVal('worker.lastPingAt', Date.now());
          if (store && store.getState && store.getState().worker && store.getState().worker.enabled) setVal('worker.status', 'ready');
        }
        if (t.id === 'spInitLibBtn') {
          setVal('analysis.presetId', 'libraries-init-requested');
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
    const f = state && state.frame ? state.frame : {};
    const latest = f.latest || null;
    let min = '—', max = '—', avg = '—', dyn = '—', satText = '0/0 (0%)';

    const arr = Array.isArray(latest?.combined)
      ? latest.combined
      : Array.isArray(latest?.intensity)
      ? latest.intensity
      : Array.isArray(latest?.values)
      ? latest.values
      : null;

    if (arr && arr.length) {
      let mn = Infinity, mx = -Infinity, sum = 0, sat = 0;
      for (let i = 0; i < arr.length; i += 1) {
        const v = Number(arr[i]);
        if (!Number.isFinite(v)) continue;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
        sum += v;
        if (v >= 254) sat += 1;
      }
      if (mn !== Infinity && mx !== -Infinity) {
        min = mn.toFixed(1); max = mx.toFixed(1);
        avg = (sum / arr.length).toFixed(1);
        dyn = (mx - mn).toFixed(1);
        const pct = arr.length ? ((sat / arr.length) * 100).toFixed(1) : '0.0';
        satText = `${sat}/${arr.length} (${pct}%)`;
      }
    }

    return {
      status: [
        `Mode: ${state.appMode || 'CORE'}`,
        `Worker: ${state.worker?.status || 'idle'}`,
        `Frame source: ${state.frame?.source || 'none'}`,
        `Calibration: ${(state.calibration?.isCalibrated ? 'calibrated' : 'uncalibrated')} · pts ${state.calibration?.points?.length || 0}`
      ],
      dq: [
        `Signal: ${min} - ${max}`,
        `Avg: ${avg} · Dyn: ${dyn}`,
        `Saturation: ${satText}`
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
    if (bus && bus.on) {
      bus.on('state:changed', render);
      bus.on('ui:refresh', render);
      bus.on('mode:changed', render);
      bus.on('frame:updated', render);
    }
    window.addEventListener('resize', render, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
