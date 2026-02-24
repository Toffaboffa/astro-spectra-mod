(function(){
  const bus = window.SpectraProEventBus;
  const store = window.SpectraProStateStore;
  const $ = (id)=>document.getElementById(id);

  const TABS = ["general","core","lab","astro","other"];
  let initialized = false;
  let panels = {};
  let mountedGeneral = false;
  let mountedStatus = false;

  function el(tag, cls, text){ const n=document.createElement(tag); if(cls) n.className=cls; if(text!=null) n.textContent=text; return n; }
  function safeUpdate(patch){ try{ store && store.update && store.update(patch); }catch(e){ console.warn('[SPECTRA-PRO] state update failed', e); } }

  function ensureShell(){
    const host = $('SpectraProDockHost');
    const main = $('spMain');
    if(!host || !main) return null;
    if(initialized) return {host,main};

    host.innerHTML = '';
    host.classList.add('sp-dock-host');

    const shell = el('div','sp-shell');
    const tabs = el('div','sp-tabs'); tabs.id='spTabs';
    TABS.forEach(t=>{
      const b=el('button','sp-tab', t==='core' ? 'CORE controls' : t.toUpperCase());
      if(t==='general') b.textContent='General';
      b.dataset.tab=t;
      b.type='button';
      tabs.appendChild(b);
    });

    const body = el('div','sp-body'); body.id='spBody';
    const tabWrap = el('div','sp-tabpanels');
    TABS.forEach(t=>{
      const panel=el('section','sp-tabpanel');
      panel.id='spPanel-'+t;
      panel.dataset.tab=t;
      if(t!=='general') panel.hidden=true;
      tabWrap.appendChild(panel);
      panels[t]=panel;
    });

    const statusRail = el('aside','sp-statusrail');
    statusRail.id='spStatusRail';
    body.appendChild(tabWrap);
    body.appendChild(statusRail);

    shell.appendChild(tabs);
    shell.appendChild(body);
    host.appendChild(shell);
    main.appendChild(host);

    tabs.addEventListener('click',(e)=>{
      const btn=e.target.closest('.sp-tab'); if(!btn) return;
      setActiveTab(btn.dataset.tab);
      safeUpdate({ ui: { ...(store.getState?.().ui||{}), activeTab: btn.dataset.tab } });
    });

    ensureCorePanelContent();
    ensurePlaceholderPanels();
    mountStatusRail();
    mountGeneralOriginalControls();

    initialized=true;
    return {host,main};
  }

  function setActiveTab(tab){
    TABS.forEach(t=>{
      const btn = document.querySelector(`.sp-tab[data-tab="${t}"]`);
      if(btn) btn.classList.toggle('is-active', t===tab);
      if(panels[t]) panels[t].hidden = t!==tab;
    });
  }

  function mountGeneralOriginalControls(){
    if(mountedGeneral) return;
    const panel = panels.general || $('spPanel-general');
    const rightDrawer = $('graphSettingsDrawerRight');
    if(!panel || !rightDrawer) return;

    // Keep original IDs and listeners intact; move the whole drawer into General panel.
    panel.innerHTML = '';
    rightDrawer.classList.add('sp-general-mounted');
    rightDrawer.style.display = 'block';
    rightDrawer.style.position = 'static';
    rightDrawer.style.width = '100%';
    rightDrawer.style.maxWidth = 'none';
    rightDrawer.style.height = '100%';
    rightDrawer.style.maxHeight = 'none';
    rightDrawer.style.overflow = 'visible';
    panel.appendChild(rightDrawer);
    mountedGeneral = true;
  }

  function mountStatusRail(){
    if(mountedStatus) return;
    const rail = $('spStatusRail');
    if(!rail) return;
    rail.innerHTML = '';

    const statusCard = el('div','sp-status-card');
    statusCard.innerHTML = `<h4>STATUS</h4>
      <div id="spStatusText" class="sp-status-lines">Mode: CORE<br>Worker: ready<br>Frame: 0 px<br>Calibration: uncalibrated · pts 0</div>`;

    const dqCard = el('div','sp-status-card');
    dqCard.innerHTML = `<h4>DATA QUALITY</h4>
      <div id="spDataQualityText" class="sp-status-lines">Signal: —, —<br>Avg: 0 · Dyn: 0<br>Saturation: 0/0 (0%)</div>`;

    rail.appendChild(statusCard);
    rail.appendChild(dqCard);
    mountedStatus = true;
  }

  function ensureCorePanelContent(){
    const panel = panels.core || $('spPanel-core');
    if(!panel || panel.dataset.built==='1') return;
    const card = el('div','sp-card sp-card--flat');
    card.innerHTML = `
      <div class="sp-form-grid">
        <label>App mode<select id="spAppMode"><option value="core">CORE</option><option value="lab">LAB</option><option value="astro">ASTRO</option></select></label>
        <label>Worker<select id="spWorkerMode"><option value="on">On</option><option value="off">Off</option></select></label>
      </div>
      <div class="sp-actions">
        <button type="button" id="spInitLibBtn">Init libraries</button>
        <button type="button" id="spPingWorkerBtn">Ping worker</button>
        <button type="button" id="spRefreshUiBtn">Refresh UI</button>
      </div>
      <p class="sp-note">CORE remains primary. LAB/ASTRO add overlays + analysis on top.</p>`;
    panel.appendChild(card);
    panel.dataset.built='1';

    card.addEventListener('click', (e)=>{
      const t=e.target;
      if(!(t instanceof HTMLElement)) return;
      if(t.id==='spInitLibBtn'){ safeUpdate({ worker:{ ...(store.getState?.().worker||{}), librariesInitialized:true } }); }
      if(t.id==='spPingWorkerBtn'){ safeUpdate({ worker:{ ...(store.getState?.().worker||{}), ready:true, lastPingAt: Date.now() } }); }
      if(t.id==='spRefreshUiBtn'){ render(); }
    });
    card.querySelector('#spAppMode')?.addEventListener('change',(e)=>{
      const v=e.target.value; safeUpdate({ mode:v.toUpperCase(), ui:{ ...(store.getState?.().ui||{}), activeTab:v } }); setActiveTab(v);
    });
    card.querySelector('#spWorkerMode')?.addEventListener('change',(e)=>{
      const on=e.target.value==='on'; safeUpdate({ worker:{ ...(store.getState?.().worker||{}), ready:on } });
    });
  }

  function ensurePlaceholderPanels(){
    ['lab','astro','other'].forEach(t=>{
      const panel = panels[t] || $('spPanel-'+t); if(!panel || panel.dataset.built==='1') return;
      const c=el('div','sp-card sp-card--flat');
      c.innerHTML = `<div class="sp-empty">${t.toUpperCase()} panel coming next.</div>`;
      panel.appendChild(c); panel.dataset.built='1';
    });
  }

  function updateStatusFromState(state){
    const sEl = $('spStatusText');
    const qEl = $('spDataQualityText');
    if(!sEl || !qEl) return;
    const mode = state?.mode || 'CORE';
    const ready = state?.worker?.ready ? 'ready' : 'off';
    const frame = Number(state?.frame?.widthPx || 0);
    const pts = Number(state?.calibration?.points?.length || 0);
    const cal = state?.calibration?.isCalibrated ? 'calibrated' : 'uncalibrated';
    sEl.innerHTML = `Mode: ${mode}<br>Worker: ${ready}<br>Frame: ${frame} px<br>Calibration: ${cal} · pts ${pts}`;

    const dq = state?.dataQuality || {};
    const min = Number.isFinite(dq.min) ? dq.min.toFixed(1) : '—';
    const max = Number.isFinite(dq.max) ? dq.max.toFixed(1) : '—';
    const avg = Number.isFinite(dq.avg) ? dq.avg.toFixed(1) : '0';
    const dyn = Number.isFinite(dq.dynamicRange) ? dq.dynamicRange.toFixed(1) : '0';
    const sat = Number.isFinite(dq.saturatedPixels) ? dq.saturatedPixels : 0;
    const tot = Number.isFinite(dq.totalPixels) ? dq.totalPixels : 0;
    const pct = tot>0 ? ((sat/tot)*100).toFixed(1) : '0.0';
    qEl.innerHTML = `Signal: ${min} - ${max}<br>Avg: ${avg} · Dyn: ${dyn}<br>Saturation: ${sat}/${tot} (${pct}%)`;
  }

  function render(){
    ensureShell();
    mountGeneralOriginalControls();
    mountStatusRail();
    const state = store?.getState ? store.getState() : {};
    const active = (state?.ui?.activeTab || 'general').toLowerCase();
    setActiveTab(TABS.includes(active)?active:'general');
    updateStatusFromState(state||{});
  }

  function init(){
    ensureShell();
    render();
    bus?.on?.('state:changed', render);
    bus?.on?.('ui:refresh', render);
    bus?.on?.('frame:updated', ()=>{
      const st = store?.getState ? store.getState() : {};
      const q = window.SpectraProDataQuality?.fromFrame?.(st.frame || {}) || {};
      safeUpdate({ dataQuality: q });
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
