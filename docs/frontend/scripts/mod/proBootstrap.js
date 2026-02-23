(function(global){
  "use strict";
  const sp = global.SpectraPro = global.SpectraPro || {};

  function safeUpdate(path, value, source){
    if (sp.store && sp.store.update) sp.store.update(path, value, { source: source || 'proBootstrap' });
  }

  function wireCoreEvents(){
    if (!sp.coreHooks || wireCoreEvents._done) return;
    wireCoreEvents._done = true;

    sp.coreHooks.on('graphFrame', function(frame){
      safeUpdate('frame.source', frame && frame.source ? frame.source : 'camera');
      safeUpdate('frame.latest', frame || null, 'graphFrame');

      const adapted = sp.spectrumFrameAdapter && sp.spectrumFrameAdapter.adapt
        ? sp.spectrumFrameAdapter.adapt(frame, (sp.store && sp.store.getState && sp.store.getState().calibration) || null)
        : frame;

      if (sp._workerClient && adapted) {
        try { sp._workerClient.analyzeFrame(adapted); } catch (e) { console.warn('[SPECTRA-PRO] analyzeFrame failed', e); }
      }
    });

    sp.coreHooks.on('calibrationChanged', function(cal){
      const current = (sp.store && sp.store.getState && sp.store.getState().calibration) || {};
      safeUpdate('calibration', Object.assign({}, current, cal || {}), 'calibrationChanged');
    });

    sp.coreHooks.on('referenceChanged', function(ref){
      safeUpdate('analysis.referenceState', ref || null, 'referenceChanged');
    });
  }

  function makePanel(){
    if (document.getElementById('spectraProPanel')) return;
    const host = document.createElement('div');
    host.id = 'spectraProPanel';
    host.innerHTML = `
      <div class="sp-head">
        <div><strong>SPECTRA-PRO</strong> <span class="sp-pill ok">P1.5</span></div>
        <button id="spPanelToggle" type="button" class="btn btn-sm btn-secondary">Hide</button>
      </div>
      <div id="spPanelBody" class="sp-body">
        <div id="spModeTabsHost"></div>
        <div class="sp-card">
          <div class="sp-card-title">CORE controls (v5-inspired)</div>
          <div id="spCoreControlsHost"></div>
        </div>
        <div class="sp-card">
          <div class="sp-card-title">Status</div>
          <div id="spStatusHost" class="sp-status"></div>
        </div>
        <div class="sp-card">
          <div class="sp-card-title">Data quality</div>
          <div id="spQualityHost" class="sp-status"></div>
        </div>
      </div>`;
    document.body.appendChild(host);

    const tabsHost = host.querySelector('#spModeTabsHost');
    if (sp.uiPanels && sp.uiPanels.createModeTabs) sp.uiPanels.createModeTabs(tabsHost);

    const controlsHost = host.querySelector('#spCoreControlsHost');
    controlsHost.innerHTML = `
      <div class="sp-grid2">
        <label>Display mode
          <select id="spDisplayMode" class="form-select form-select-sm">
            <option value="NORMAL">Normal</option>
            <option value="DIFFERENCE">Difference (prep)</option>
            <option value="RATIO">Ratio (prep)</option>
            <option value="TRANSMITTANCE">Transmittance (prep)</option>
            <option value="ABSORBANCE">Absorbance (prep)</option>
          </select>
        </label>
        <label>Y-axis
          <select id="spYAxisMode" class="form-select form-select-sm">
            <option value="AUTO">Auto</option>
            <option value="FIXED_255">Fixed 0–255</option>
            <option value="MANUAL">Manual (later)</option>
          </select>
        </label>
      </div>
      <div class="sp-grid2">
        <label>Peak lower bound
          <input id="spPeakLower" type="number" min="1" max="255" step="1" class="form-control form-control-sm" value="1">
        </label>
        <label>Fill opacity
          <input id="spFillOpacity" type="range" min="0.1" max="1" step="0.1" class="form-range" value="0.7">
        </label>
      </div>
      <div class="sp-row">
        <button id="spApplyCoreTweaks" class="btn btn-sm btn-secondary">Apply</button>
        <button id="spSyncCoreTweaks" class="btn btn-sm btn-secondary">Sync from CORE</button>
      </div>
      <div class="sp-note">Non-destructive bridge: maps to existing CORE controls only.</div>`;

    function getDom(id){ return document.getElementById(id); }
    function syncFromCoreDom(){
      const peak = getDom('peakSizeLower');
      const opacity = getDom('gradientOpacitySlider');
      const panelPeak = getDom('spPeakLower');
      const panelOpacity = getDom('spFillOpacity');
      if (peak && panelPeak) panelPeak.value = peak.value || '1';
      if (opacity && panelOpacity) panelOpacity.value = opacity.value || '0.7';
      safeUpdate('coreControls.displayMode', getDom('spDisplayMode')?.value || 'NORMAL', 'sync');
      safeUpdate('coreControls.yAxisMode', getDom('spYAxisMode')?.value || 'AUTO', 'sync');
    }
    function applyCoreTweaks(){
      const peak = getDom('peakSizeLower');
      const opacity = getDom('gradientOpacitySlider');
      const opacityVal = getDom('gradientOpacityValue');
      const panelPeak = getDom('spPeakLower');
      const panelOpacity = getDom('spFillOpacity');
      if (peak && panelPeak) {
        peak.value = String(panelPeak.value || 1);
        peak.dispatchEvent(new Event('change', { bubbles:true }));
        peak.dispatchEvent(new Event('input', { bubbles:true }));
      }
      if (opacity && panelOpacity) {
        opacity.value = String(panelOpacity.value || 0.7);
        opacity.dispatchEvent(new Event('change', { bubbles:true }));
        opacity.dispatchEvent(new Event('input', { bubbles:true }));
        if (opacityVal) opacityVal.textContent = opacity.value;
      }
      safeUpdate('coreControls.displayMode', getDom('spDisplayMode')?.value || 'NORMAL', 'panel');
      safeUpdate('coreControls.yAxisMode', getDom('spYAxisMode')?.value || 'AUTO', 'panel');
      safeUpdate('analysis.peakLowerBound', Number(panelPeak?.value || 1), 'panel');
      safeUpdate('graph.fillOpacity', Number(panelOpacity?.value || 0.7), 'panel');
    }

    controlsHost.querySelector('#spApplyCoreTweaks').addEventListener('click', applyCoreTweaks);
    controlsHost.querySelector('#spSyncCoreTweaks').addEventListener('click', syncFromCoreDom);
    controlsHost.querySelectorAll('select,input').forEach(el => {
      el.addEventListener('change', function(){ safeUpdate('ui.lastControlChange', Date.now(), 'panel-change'); });
    });

    let _rendering = false;
    let _lastQualityKey = '';

    function render(){
      if (_rendering) return;
      _rendering = true;
      try {
      const s = (sp.store && sp.store.getState && sp.store.getState()) || {};
      const f = (s.frame && s.frame.latest) || {};
      const c = s.calibration || {};
      const w = s.worker || {};
      const topHits = (s.analysis && s.analysis.topHits) || [];
      const intensity = Array.isArray(f.I) ? f.I : [];
      let min=Infinity,max=-Infinity,sum=0,sat=0;
      for (let i=0;i<intensity.length;i++) {
        const v = Number(intensity[i]) || 0;
        if (v<min) min=v; if (v>max) max=v; sum += v;
        if (v >= 250) sat++;
      }
      const n = intensity.length || 0;
      const avg = n ? (sum/n) : 0;
      const satPct = n ? (100*sat/n) : 0;
      const dynamic = (isFinite(max) && isFinite(min)) ? (max-min) : 0;
      const qFlag = !n ? 'no frame' : satPct > 5 ? 'saturated risk' : dynamic < 20 ? 'low contrast' : 'ok';
      const qClass = qFlag === 'ok' ? 'ok' : (qFlag === 'no frame' ? '' : 'warn');

      host.querySelector('#spStatusHost').innerHTML = [
        `<div><span class="muted">Mode</span>: <b>${s.appMode || 'CORE'}</b></div>`,
        `<div><span class="muted">Worker</span>: ${w.status || 'idle'}${w.analysisHz ? ` (${w.analysisHz} Hz)` : ''}</div>`,
        `<div><span class="muted">Frame</span>: ${n} px ${f.source ? '('+f.source+')' : ''}</div>`,
        `<div><span class="muted">Calibration</span>: ${c.calibrated ? 'calibrated' : 'uncalibrated'} · pts ${c.pointCount || 0}</div>`,
        `<div><span class="muted">Top hits</span>: ${topHits.length}</div>`
      ].join('');

      host.querySelector('#spQualityHost').innerHTML = [
        `<div><span class="muted">Signal</span>: min ${isFinite(min)?min.toFixed(1):'—'} · max ${isFinite(max)?max.toFixed(1):'—'} · avg ${avg.toFixed(1)}</div>`,
        `<div><span class="muted">Dynamic range</span>: ${dynamic.toFixed(1)}</div>`,
        `<div><span class="muted">Saturation</span>: ${sat}/${n} (${satPct.toFixed(1)}%)</div>`,
        `<div><span class="muted">Quality</span>: <span class="sp-pill ${qClass}">${qFlag}</span></div>`
      ].join('');

      const qualityObj = { n, min, max, avg, dynamic, sat, satPct, qFlag };
      const qualityKey = [n, min, max, avg, dynamic, sat, satPct, qFlag].join('|');
      if (qualityKey !== _lastQualityKey) {
        _lastQualityKey = qualityKey;
        safeUpdate('quality', qualityObj, 'qualityRender');
      }
      } finally {
        _rendering = false;
      }
    }
    if (sp.eventBus && sp.eventBus.on) sp.eventBus.on('state:changed', render);
    render();
    syncFromCoreDom();

    host.querySelector('#spPanelToggle').addEventListener('click', function(){
      const body = host.querySelector('#spPanelBody');
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'block' : 'none';
      this.textContent = hidden ? 'Hide' : 'Show';
    });
  }

  function initWorkerClient(){
    if (!sp.createAnalysisWorkerClient || sp._workerClient) return;
    sp._workerClient = sp.createAnalysisWorkerClient({
      workerUrl: '../workers/analysis.worker.js',
      throttleMs: 350,
      timeoutMs: 2500
    });
    try { sp._workerClient.start(); } catch (e) { console.warn('[SPECTRA-PRO] worker start skipped', e); }
  }

  function applyLayoutFixes(){
    try {
      // Avoid mutating stripe geometry in P1.5 (can desync preview vs graph in original SPECTRA layout).
      const right = document.getElementById('sidebar-right');
      if (right && !right.querySelector('*')) right.classList.add('hidden');
      const graphWin = document.getElementById('graphWindowContainer');
      if (graphWin) {
        // let canvas resize settle after drawer/layout changes
        setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 60);
        setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 220);
      }
    } catch(e){ console.warn('[SPECTRA-PRO] layout fix skipped', e); }
  }

  function boot(){
    wireCoreEvents();
    makePanel();
    initWorkerClient();
    applyLayoutFixes();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  sp.proBootstrap = { boot, wireCoreEvents };
})(window);
