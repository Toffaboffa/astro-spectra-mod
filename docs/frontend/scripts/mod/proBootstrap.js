(function(){
  function qs(id){ return document.getElementById(id); }

  function createDockHost(){
    const host = document.createElement('div');
    host.id = 'SpectraProDockHost';
    host.innerHTML = `
      <div class="sp-main" id="spMain">
        <div class="sp-tabs" role="tablist" aria-label="Spectra Pro tabs">
          <button class="sp-tab is-active" data-sp-tab="general">General</button>
          <button class="sp-tab" data-sp-tab="core">CORE controls</button>
          <button class="sp-tab" data-sp-tab="lab">LAB</button>
          <button class="sp-tab" data-sp-tab="astro">ASTRO</button>
          <button class="sp-tab" data-sp-tab="other">Other</button>
        </div>

        <div class="sp-content">
          <div class="sp-tabpanel" id="spTabPanel"></div>
          <aside class="sp-statusrail" id="spStatusRail">
            <div class="sp-status-grid">
              <section class="sp-card sp-card--flat">
                <div class="sp-card-title">STATUS</div>
                <div id="spStatusContent"></div>
              </section>
              <section class="sp-card sp-card--flat">
                <div class="sp-card-title">DATA QUALITY</div>
                <div id="spQualityContent"></div>
              </section>
            </div>
          </aside>
        </div>
      </div>`;
    return host;
  }

  function mk(el){ const d=document.createElement('div'); d.className='sp-card sp-card--flat'; if(el) d.appendChild(el); return d; }

  function buildCorePanel(){
    const wrap=document.createElement('div'); wrap.className='sp-core-wrap';
    wrap.innerHTML = `
      <div class="sp-core-grid">
        <label class="sp-field"><span>App mode</span><select id="spAppMode"><option>CORE</option><option>LAB</option><option>ASTRO</option></select></label>
        <label class="sp-field"><span>Worker</span><select id="spWorkerMode"><option>On</option><option>Off</option></select></label>
      </div>
      <div class="sp-row">
        <button class="sp-btn" type="button" id="spInitLibrariesBtn">Init libraries</button>
        <button class="sp-btn" type="button" id="spPingWorkerBtn">Ping worker</button>
        <button class="sp-btn" type="button" id="spRefreshUiBtn">Refresh UI</button>
      </div>
      <div class="sp-note">CORE placeholder controls (LAB/ASTRO wire-up continues in next phase).</div>`;
    return mk(wrap);
  }

  function buildPlaceholder(kind){
    const d=document.createElement('div'); d.className='sp-card sp-card--flat';
    d.innerHTML=`<div class="sp-placeholder"><div class="sp-card-title">${kind}</div><div class="sp-note">${kind} controls coming next.</div></div>`;
    return d;
  }

  function mountOriginalControlsIntoGeneral(panel, cache){
    panel.innerHTML='';
    if (!cache || !cache.length) {
      panel.appendChild(buildPlaceholder('General'));
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'sp-general-wrap';
    cache.forEach(node => wrap.appendChild(node));
    panel.appendChild(wrap);
  }

  function renderStatus(store){
    const s = (window.SpectraProState && window.SpectraProState.getState && window.SpectraProState.getState()) || {};
    const st = qs('spStatusContent');
    const dq = qs('spQualityContent');
    if (st) st.innerHTML = `
      <div>Mode: <b>${String(s.mode||'CORE')}</b></div>
      <div>Worker: ${s.workerReady ? 'ready' : 'idle'}</div>
      <div>Frame: ${Number.isFinite(s.frameWidth)?s.frameWidth:0} px</div>
      <div>Calibration: ${(s.calibration && s.calibration.state) || 'uncalibrated'} · pts ${(s.calibration && s.calibration.points)||0}</div>`;
    if (dq) dq.innerHTML = `
      <div>Signal: ${Number.isFinite(s.signalMin)?s.signalMin:'—'}–${Number.isFinite(s.signalMax)?s.signalMax:'—'}</div>
      <div>Avg: ${Number.isFinite(s.signalAvg)?s.signalAvg.toFixed(1):'0.0'} · Dyn: ${Number.isFinite(s.dynamicRange)?s.dynamicRange.toFixed(1):'0.0'}</div>
      <div>Saturation: ${(s.saturatedPixels||0)}/${(s.totalPixels||0)} (${s.totalPixels?(((s.saturatedPixels||0)/s.totalPixels)*100).toFixed(1):'0.0'}%)</div>`;
  }

  function init(){
    const drawer = qs('graphSettingsDrawer');
    const left = qs('graphSettingsDrawerLeft');
    if (!drawer || !left) return;

    // Capture original graph controls once (the real controls live directly in graphSettingsDrawerLeft in SPECTRA-1)
    let originalControls = window.__spOriginalGeneralControls;
    if (!originalControls) {
      originalControls = Array.from(left.children).filter(n => !(n.id === 'SpectraProDockHost'));
      window.__spOriginalGeneralControls = originalControls;
    }

    let host = qs('SpectraProDockHost');
    if (!host) {
      host = createDockHost();
      left.appendChild(host);
    }

    let active = 'general';
    const panel = qs('spTabPanel');

    function renderTab(){
      if (!panel) return;
      if (active === 'general') mountOriginalControlsIntoGeneral(panel, window.__spOriginalGeneralControls);
      else if (active === 'core') { panel.innerHTML=''; panel.appendChild(buildCorePanel()); }
      else if (active === 'lab') { panel.innerHTML=''; panel.appendChild(buildPlaceholder('LAB')); }
      else if (active === 'astro') { panel.innerHTML=''; panel.appendChild(buildPlaceholder('ASTRO')); }
      else { panel.innerHTML=''; panel.appendChild(buildPlaceholder('Other')); }
    }

    host.querySelectorAll('.sp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        active = btn.dataset.spTab || 'general';
        host.querySelectorAll('.sp-tab').forEach(b => b.classList.toggle('is-active', b===btn));
        renderTab();
      });
    });

    renderTab();
    renderStatus();

    if (!window.__spStatusListener && window.SpectraProEvents && window.SpectraProEvents.on) {
      window.__spStatusListener = window.SpectraProEvents.on('state:changed', () => { renderStatus(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
