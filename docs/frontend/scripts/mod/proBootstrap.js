(function(){
  const NS = window.SpectraPro = window.SpectraPro || {};
  const stateStore = NS.stateStore;
  const eventBus = NS.eventBus;
  const ensure = NS.ensureModeFeatures || function(){};

  const TABS = [
    { key:'general', label:'General' },
    { key:'core', label:'CORE controls' },
    { key:'lab', label:'LAB' },
    { key:'astro', label:'ASTRO' },
    { key:'other', label:'Other' }
  ];

  function safeUpdate(patch){
    if (stateStore && typeof stateStore.update === 'function') stateStore.update(patch);
  }

  function getState(){
    return (stateStore && typeof stateStore.getState === 'function') ? stateStore.getState() : {};
  }

  function q(id){ return document.getElementById(id); }

  function createDockHost(){
    let host = q('SpectraProDockHost');
    if (host) return host;
    const drawer = q('graphSettingsDrawerLeft');
    if (!drawer) return null;

    host = document.createElement('div');
    host.id = 'SpectraProDockHost';
    host.className = 'sp-dock-host';
    // Preserve existing CORE graph controls (#graphSettingsWindow) already rendered in drawer.
    // Clearing innerHTML here deletes that subtree and breaks graphScript listeners/queries.
    drawer.appendChild(host);
    return host;
  }

  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function buildShell(host){
    if (!host || host.dataset.spBuilt === '1') return;
    host.dataset.spBuilt = '1';
    host.innerHTML = `
      <div class="sp-shell">
        <div class="sp-main" id="sp-main">
          <div class="sp-tabbar" role="tablist" aria-label="SPECTRA-PRO tabs">
            ${TABS.map((t,i)=>`<button class="sp-tab-btn ${i===0?'is-active':''}" data-sp-tab="${t.key}" role="tab" aria-selected="${i===0?'true':'false'}">${t.label}</button>`).join('')}
          </div>
          <div class="sp-body-row">
            <div class="sp-tabpanels" id="sp-tabpanels">
              ${TABS.map((t,i)=>`<section class="sp-tabpanel ${i===0?'is-active':''}" data-sp-panel="${t.key}" role="tabpanel"></section>`).join('')}
            </div>
            <aside class="sp-status-rail" id="SPStatusRail" aria-label="status rail"></aside>
          </div>
        </div>
      </div>`;

    host.querySelectorAll('.sp-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.spTab;
        activateTab(host, tab);
      });
    });
  }

  function activateTab(host, tab){
    host.querySelectorAll('.sp-tab-btn').forEach(b => {
      const on = b.dataset.spTab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true':'false');
    });
    host.querySelectorAll('.sp-tabpanel').forEach(p => p.classList.toggle('is-active', p.dataset.spPanel === tab));
    safeUpdate({ ui: { activeTab: tab }});
  }

  function moveNodeIntoPanel(node, panel){
    if (!node || !panel) return;
    if (panel.contains(node)) return;
    panel.innerHTML = '';
    panel.appendChild(node);
  }

  function fillPlaceholder(panel, title, text){
    if (!panel) return;
    if (panel.children.length > 0) return;
    panel.innerHTML = `<div class="sp-card"><div class="sp-card-title">${escapeHtml(title)}</div><div class="sp-card-body"><p>${escapeHtml(text)}</p></div></div>`;
  }

  function renderStatusRail(rail, st){
    if (!rail) return;
    const ui = st.ui || {};
    const dq = st.dataQuality || {};
    rail.innerHTML = `
      <div class="sp-card compact"><div class="sp-card-title">STATUS</div><div class="sp-card-body">
        <div>Mode: <b>${escapeHtml(ui.mode || 'CORE')}</b></div>
        <div>Worker: ${escapeHtml(ui.workerStatus || 'ready')}</div>
        <div>Frame: ${escapeHtml(ui.frameWidth ?? 0)} px</div>
        <div>Calibration: ${escapeHtml(ui.calibrationLabel || 'uncalibrated')} · pts ${escapeHtml(ui.calibrationPoints ?? 0)}</div>
      </div></div>
      <div class="sp-card compact"><div class="sp-card-title">DATA QUALITY</div><div class="sp-card-body">
        <div>Signal: ${escapeHtml(dq.min ?? '—')} .. ${escapeHtml(dq.max ?? '—')}</div>
        <div>Avg: ${escapeHtml(dq.avg ?? 0)} · Dyn: ${escapeHtml(dq.dynamicRange ?? 0)}</div>
        <div>Saturation: ${escapeHtml(dq.saturated ?? 0)}/${escapeHtml(dq.total ?? 0)} (${escapeHtml(dq.saturationPct ?? 0)}%)</div>
        <div>Quality: <span class="sp-badge">${escapeHtml(dq.label || 'no frame')}</span></div>
      </div></div>`;
  }

  function render(){
    const host = createDockHost();
    if (!host) return;
    buildShell(host);

    // Hide legacy floating panel if present
    const legacyFloat = q('spectraProPanel') || q('SpectraProPanel');
    if (legacyFloat) legacyFloat.style.display = 'none';

    const st = getState();
    const ui = st.ui || {};
    ensure(ui.mode || 'CORE');

    const panels = {
      general: host.querySelector('.sp-tabpanel[data-sp-panel="general"]'),
      core: host.querySelector('.sp-tabpanel[data-sp-panel="core"]'),
      lab: host.querySelector('.sp-tabpanel[data-sp-panel="lab"]'),
      astro: host.querySelector('.sp-tabpanel[data-sp-panel="astro"]'),
      other: host.querySelector('.sp-tabpanel[data-sp-panel="other"]')
    };

    // Move ORIGINAL graph settings window (the real SPECTRA controls) into General tab.
    // graphScript binds directly to controls by id, so we move the whole window intact.
    const graphControlsWindow = q('graphSettingsWindow');
    if (graphControlsWindow) moveNodeIntoPanel(graphControlsWindow, panels.general);

    // Keep placeholders for remaining tabs until implemented.
    if (panels.core && panels.core.children.length === 0) {
      panels.core.innerHTML = `
        <div class="sp-card sp-core-panel">
          <div class="sp-core-grid">
            <label>App mode<select><option>CORE</option><option>LAB</option><option>ASTRO</option></select></label>
            <label>Worker<select><option>On</option><option>Off</option></select></label>
          </div>
          <div class="sp-core-actions">
            <button type="button">Init libraries</button>
            <button type="button">Ping worker</button>
            <button type="button">Refresh UI</button>
          </div>
          <div class="sp-help">CORE remains primary. LAB/ASTRO add overlays + analysis on top.</div>
        </div>`;
    }
    fillPlaceholder(panels.lab, 'LAB', 'LAB-MVP panel (placeholder) – analyspresets och labbverktyg kopplas här.');
    fillPlaceholder(panels.astro, 'ASTRO', 'ASTRO panel (placeholder) – kalibrering mot linjebibliotek och astro-overlay kommer här.');
    fillPlaceholder(panels.other, 'Other', 'Övriga verktyg, export och debug.');

    renderStatusRail(q('SPStatusRail'), st);

    const active = ui.activeTab || 'general';
    activateTab(host, active);
  }

  function init(){
    render();
    if (eventBus && typeof eventBus.on === 'function') {
      eventBus.on('state:changed', render);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
