(function(window){
  'use strict';
  const sp = window.SpectraPro = window.SpectraPro || {};

  function safeUpdate(path, value, source){
    if (sp.store && sp.store.update) sp.store.update(path, value, source || 'proBootstrap');
  }
  function getState(){ return (sp.store && sp.store.getState && sp.store.getState()) || {}; }

  function wireCoreEvents(){
    if (!sp.eventBus || !sp.eventBus.emit) return;

    const emitFrame = () => {
      try {
        if (sp.spectrumFrameAdapter && sp.spectrumFrameAdapter.captureFromGlobals) {
          const frame = sp.spectrumFrameAdapter.captureFromGlobals();
          if (frame && frame.I && frame.I.length) sp.eventBus.emit('frame:updated', frame);
        }
      } catch (e) { console.warn('[SPECTRA-PRO] frame hook failed', e); }
    };

    let lastTick = 0;
    setInterval(function(){
      emitFrame();
      const now = Date.now();
      if (now - lastTick > 450 && sp._workerClient) {
        lastTick = now;
        const s = getState();
        if (s.worker && s.worker.enabled && s.frame && s.frame.latest && s.frame.latest.I) {
          try {
            sp._workerClient.analyzeFrame({
              frame: s.frame.latest,
              mode: s.appMode || 'CORE',
              presetId: s.analysis && s.analysis.presetId,
              subtraction: s.subtraction || {}
            });
          } catch (e) { console.warn('[SPECTRA-PRO] analyze tick failed', e); }
        }
      }
    }, 250);
  }

  function removeHomeButton(){
    const btn = document.querySelector('#graphSettingsDrawerRight button[onclick*="openRedirectionModal"]');
    if (btn) btn.remove();
  }

  function relabelFlrButton(){
    const flrBtn = document.querySelector('button[onclick*="LongExpo"]');
    if (flrBtn) {
      flrBtn.textContent = 'Long Exposure';
      flrBtn.title = 'Long exposure / frame recording settings (original SPECTRA FLR)';
    }
  }

  function makePanel(){
    if (document.getElementById('spectraProPanel')) return;
    const drawer = document.getElementById('graphSettingsDrawer');
    const drawerLeft = document.getElementById('graphSettingsDrawerLeft');
    if (!drawer || !drawerLeft) return;

    let dock = document.getElementById('spectraProDockHost');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'spectraProDockHost';
      dock.className = 'sp-dock-host';
      drawer.insertAdjacentElement('afterend', dock);
    }

    const host = document.createElement('div');
    host.id = 'spectraProPanel';
    host.className = 'sp-inline-panel sp-docked';
    dock.classList.add('sp-dock-host');
    // Hard reset inline/floating leftovers (old cached CSS/previous patches)
    Object.assign(host.style, {
      position: 'static',
      inset: 'auto',
      right: 'auto',
      bottom: 'auto',
      left: 'auto',
      top: 'auto',
      width: '100%',
      maxWidth: 'none',
      minWidth: '0',
      transform: 'none',
      zIndex: 'auto',
      margin: '12px 0 0 0',
      alignSelf: 'stretch'
    });
    host.innerHTML = `
    <div class="sp-shell">
      <button id="spDockToggle" class="sp-dock-toggle" type="button" aria-label="Hide/Show panel" title="Hide/Show panel">▾</button>
      <div id="spRoot" class="sp-root">
        <div class="sp-main">
          <div class="sp-tabbar" role="tablist" aria-label="SPECTRA-PRO panels">
            <button class="sp-tab is-active" type="button" data-tab="general">General</button>
            <button class="sp-tab" type="button" data-tab="core">CORE controls</button>
            <button class="sp-tab" type="button" data-tab="lab">LAB</button>
            <button class="sp-tab" type="button" data-tab="astro">ASTRO</button>
            <button class="sp-tab" type="button" data-tab="other">Other</button>
          </div>
          <div class="sp-tabpanels">
            <section class="sp-tabpanel is-active" data-panel="general">
              <div class="sp-note">General panel scaffold (PRO dock controls live below as phases unlock).</div>
            </section>
            <section class="sp-tabpanel" data-panel="core">
              <div class="sp-form-grid">
                <label class="sp-field"><span>Subtraction mode</span>
                  <select id="spSubMode"><option value="none">None</option><option value="dark">Dark</option><option value="reference">Reference</option><option value="both">Dark + Reference</option></select>
                </label>
                <label class="sp-field"><span>Lab preset</span>
                  <select id="spLabPreset"><option value="none">None</option><option value="emission">Emission lamp</option><option value="absorption">Absorption</option><option value="continuum">Continuum</option></select>
                </label>
                <button id="spSyncCoreTweaks" type="button">Sync CORE → PRO</button>
                <button id="spApplyCoreTweaks" type="button">Apply PRO → CORE</button>
                <button id="spRefreshUi" type="button">Refresh UI</button>
              </div>
            </section>
            <section class="sp-tabpanel" data-panel="lab">
              <div class="sp-form-grid">
                <button id="spCapDark" type="button">Capture dark</button>
                <button id="spCapRef" type="button">Capture reference</button>
                <button id="spClearRef" type="button">Clear ref/dark</button>
                <label class="sp-field"><span>LAB subtraction</span><select id="spLabSubState"><option value="off">Off</option><option value="on">On</option></select></label>
                <div class="sp-note">LAB-MVP scaffold connected to state store.</div>
              </div>
            </section>
            <section class="sp-tabpanel" data-panel="astro">
              <div class="sp-note">ASTRO panel scaffold (coming in later phase).</div>
            </section>
            <section class="sp-tabpanel" data-panel="other">
              <div class="sp-form-grid">
                <label class="sp-field"><span>App mode</span>
                  <select id="spAppModeSelect"><option value="core">CORE</option><option value="lab">LAB</option><option value="astro">ASTRO</option></select>
                </label>
                <label class="sp-field"><span>Worker</span>
                  <select id="spWorkerToggle"><option value="on">On</option><option value="off">Off</option></select>
                </label>
                <button id="spInitWorker" type="button">Init libraries</button>
                <button id="spPingWorker" type="button">Ping worker</button>
              </div>
            </section>
          </div>
        </div>
        <aside class="sp-status-rail">
          <div class="sp-brand-row"><div class="sp-brand">SPECTRA-PRO</div><span id="spModeBadge" class="sp-mode-badge">P1</span></div>
          <section class="sp-card"><h4>STATUS</h4><div id="spStatusHost" class="sp-list"></div></section>
          <section class="sp-card"><h4>DATA QUALITY</h4><div id="spQualityHost" class="sp-list"></div></section>
          <section class="sp-card"><h4>TOP HITS</h4><div id="spTopHitsHost" class="sp-list">No peaks yet.</div></section>
        </aside>
      </div>
    </div>`;

    // Append inside the drawer (docked under CORE controls), never floating.
    dock.replaceChildren(host);

    function getDom(id){ return document.getElementById(id); }

    function syncFromCoreDom(){
      const peak = getDom('peakSizeLower');
      const opacity = getDom('gradientOpacitySlider');
      const panelPeak = getDom('spPeakLower');
      const panelOpacity = getDom('spFillOpacity');
      if (peak && panelPeak) panelPeak.value = peak.value || '1';
      if (opacity && panelOpacity) panelOpacity.value = opacity.value || '0.7';
    }

    function applyCoreTweaks(){
      const peak = getDom('peakSizeLower');
      const opacity = getDom('gradientOpacitySlider');
      const opacityVal = getDom('gradientOpacityValue');
      const panelPeak = getDom('spPeakLower');
      const panelOpacity = getDom('spFillOpacity');
      if (peak && panelPeak) {
        peak.value = String(panelPeak.value || 1);
        peak.dispatchEvent(new Event('input', { bubbles:true }));
        peak.dispatchEvent(new Event('change', { bubbles:true }));
      }
      if (opacity && panelOpacity) {
        opacity.value = String(panelOpacity.value || 0.7);
        opacity.dispatchEvent(new Event('input', { bubbles:true }));
        opacity.dispatchEvent(new Event('change', { bubbles:true }));
        if (opacityVal) opacityVal.textContent = opacity.value;
      }
      safeUpdate('analysis.peakLowerBound', Number(panelPeak?.value || 1), 'panel');
      safeUpdate('graph.fillOpacity', Number(panelOpacity?.value || 0.7), 'panel');
    }

    function captureBuffer(kind){
      const s = getState();
      const f = s.frame && s.frame.latest;
      if (!f || !Array.isArray(f.I) || !f.I.length) return;
      safeUpdate('buffers.' + kind, { timestamp: Date.now(), n: f.I.length }, 'lab-capture');
      if (kind === 'dark') safeUpdate('subtraction.hasDark', true, 'lab-capture');
      if (kind === 'reference') safeUpdate('subtraction.hasReference', true, 'lab-capture');
    }
    function clearBuffers(){
      safeUpdate('buffers', {}, 'lab-clear');
      safeUpdate('subtraction.hasDark', false, 'lab-clear');
      safeUpdate('subtraction.hasReference', false, 'lab-clear');
    }
    function ensureWorkerLibraries(){
      if (!sp._workerClient) return;
      try { sp._workerClient.initLibraries({ profile:'builtin-lite' }); } catch(e){ console.warn('[SPECTRA-PRO] initLibraries failed', e); }
    }

    host.querySelectorAll('.sp-tab').forEach(btn => {
      btn.addEventListener('click', function(){
        const tab = this.dataset.tab;
        host.querySelectorAll('.sp-tab').forEach(b => b.classList.toggle('is-active', b === this));
        host.querySelectorAll('.sp-tabpanel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab));
      });
    });

    host.querySelector('#spRefreshUi').addEventListener('click', function(){
      syncFromCoreDom(); render();
      window.dispatchEvent(new Event('resize'));
    });
    host.querySelector('#spApplyCoreTweaks').addEventListener('click', applyCoreTweaks);
    host.querySelector('#spSyncCoreTweaks').addEventListener('click', syncFromCoreDom);

    host.querySelector('#spAppModeSelect').addEventListener('change', function(){
      if (sp.appMode && sp.appMode.setMode) sp.appMode.setMode(this.value);
      safeUpdate('appMode', this.value, 'ui');
      render();
    });
    host.querySelector('#spWorkerToggle').addEventListener('change', function(){ safeUpdate('worker.enabled', this.value !== 'off', 'ui'); render(); });
    host.querySelector('#spInitWorker').addEventListener('click', ensureWorkerLibraries);
    host.querySelector('#spPingWorker').addEventListener('click', function(){ if (sp._workerClient) sp._workerClient.ping(); });
    host.querySelector('#spCapDark').addEventListener('click', function(){ captureBuffer('dark'); render(); });
    host.querySelector('#spCapRef').addEventListener('click', function(){ captureBuffer('reference'); render(); });
    host.querySelector('#spClearRef').addEventListener('click', function(){ clearBuffers(); render(); });
    host.querySelector('#spLabPreset').addEventListener('change', function(){ safeUpdate('analysis.presetId', this.value, 'lab-preset'); render(); });
    host.querySelector('#spSubMode').addEventListener('change', function(){ safeUpdate('subtraction.mode', this.value, 'lab-submode'); render(); });

    let rendering = false;
    function render(){
      if (rendering) return;
      rendering = true;
      try {
        const s = getState();
        const f = (s.frame && s.frame.latest) || {};
        const c = s.calibration || {};
        const w = s.worker || {};
        const topHits = (s.analysis && s.analysis.topHits) || [];
        const intensity = Array.isArray(f.I) ? f.I : [];
        let min=Infinity, max=-Infinity, sum=0, sat=0;
        for (let i=0;i<intensity.length;i++) {
          const v = Number(intensity[i]) || 0;
          if (v < min) min = v;
          if (v > max) max = v;
          sum += v;
          if (v >= 250) sat++;
        }
        const n = intensity.length || 0;
        const avg = n ? sum / n : 0;
        const satPct = n ? (100 * sat / n) : 0;
        const dynamic = (isFinite(max) && isFinite(min)) ? (max - min) : 0;
        const qFlag = !n ? 'no frame' : satPct > 5 ? 'saturated risk' : dynamic < 20 ? 'low contrast' : 'ok';
        const qClass = qFlag === 'ok' ? 'ok' : (qFlag === 'no frame' ? '' : 'warn');

        const mode = (s.appMode || (sp.appMode && sp.appMode.getMode && sp.appMode.getMode()) || 'CORE');
        const modeSelect = host.querySelector('#spAppModeSelect');
        if (modeSelect && modeSelect.value !== mode) modeSelect.value = mode;
        const badge = host.querySelector('#spModeBadge');
        if (badge) badge.textContent = mode === 'CORE' ? 'P1' : (mode === 'LAB' ? 'P2-LAB' : 'ASTRO');

        const statusHost = host.querySelector('#spStatusHost');
        if (statusHost) statusHost.innerHTML = [
          `<div><span class="muted">Mode</span>: <b>${mode}</b></div>`,
          `<div><span class="muted">Worker</span>: ${w.status || 'idle'}${w.librariesLoaded ? ' · libs ✓' : ''}</div>`,
          `<div><span class="muted">Frame</span>: ${n} px ${f.source ? '('+f.source+')' : ''}</div>`,
          `<div><span class="muted">Calibration</span>: ${c.isCalibrated ? 'calibrated' : 'uncalibrated'} · pts ${(Array.isArray(c.points) ? c.points.length : 0)}</div>`
        ].join('');

        const qualityHost = host.querySelector('#spQualityHost');
        if (qualityHost) qualityHost.innerHTML = [
          `<div><span class="muted">Signal</span>: min ${isFinite(min)?min.toFixed(1):'—'} · max ${isFinite(max)?max.toFixed(1):'—'}</div>`,
          `<div><span class="muted">Avg</span>: ${avg.toFixed(1)} · <span class="muted">Dyn</span>: ${dynamic.toFixed(1)}</div>`,
          `<div><span class="muted">Saturation</span>: ${sat}/${n} (${satPct.toFixed(1)}%)</div>`,
          `<div><span class="muted">Quality</span>: <span class="sp-pill ${qClass}">${qFlag}</span></div>`
        ].join('');

        const sub = s.subtraction || {};
        const subEl = host.querySelector('#spLabSubState');
        if (subEl) subEl.textContent = `Dark: ${sub.hasDark ? 'yes' : 'no'} · Ref: ${sub.hasReference ? 'yes' : 'no'} · Mode: ${sub.mode || 'raw'}`;

        const hitsEl = host.querySelector('#spTopHitsHost');
        if (hitsEl) {
          if (!topHits.length) {
            hitsEl.innerHTML = `<div class="sp-note">No hits yet. This is normal if calibration/worker is not configured yet.</div>`;
          } else {
            hitsEl.innerHTML = topHits.slice(0,6).map((h,i)=>`<div class="sp-hit"><span class="sp-rank">${i+1}</span><span class="sp-name">${h.species || '—'}</span><span class="sp-nm">${Number.isFinite(h.observedNm)?h.observedNm.toFixed(2):'—'} nm</span><span class="sp-conf">${h.confidence!=null?Math.round(h.confidence*100):0}%</span></div>`).join('');
          }
        }
      } finally { rendering = false; }
    }

    if (sp.eventBus && sp.eventBus.on) {
      sp.eventBus.on('state:changed', render);
      sp.eventBus.on('mode:changed', function(){ render(); });
    }
    syncFromCoreDom();
    render();
  }

  function initWorkerClient(){
    if (!sp.createAnalysisWorkerClient || sp._workerClient) return;
    sp._workerClient = sp.createAnalysisWorkerClient({ workerUrl:'../workers/analysis.worker.js', throttleMs:350, timeoutMs:2500 });
    try { sp._workerClient.start(); } catch (e) { console.warn('[SPECTRA-PRO] worker start skipped', e); }
  }

  function applyLayoutFixes(){
    try {
      const right = document.getElementById('sidebar-right');
      if (right && !right.querySelector('*')) right.classList.add('hidden');
      setTimeout(()=>window.dispatchEvent(new Event('resize')), 80);
      setTimeout(()=>window.dispatchEvent(new Event('resize')), 260);
    } catch(e){ console.warn('[SPECTRA-PRO] layout fix skipped', e); }
  }

  function boot(){
    removeHomeButton();
    relabelFlrButton();
    wireCoreEvents();
    makePanel();
    initWorkerClient();
    applyLayoutFixes();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  sp.proBootstrap = { boot, wireCoreEvents };
})(window);
