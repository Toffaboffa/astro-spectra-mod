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
        <div><strong>SPECTRA-PRO</strong> <span class="sp-pill ok">P1</span></div>
        <button id="spPanelToggle" type="button" class="btn btn-sm btn-secondary">Hide</button>
      </div>
      <div id="spPanelBody" class="sp-body">
        <div id="spModeTabsHost"></div>
        <div id="spStatusHost" class="sp-status"></div>
      </div>`;
    document.body.appendChild(host);

    const tabsHost = host.querySelector('#spModeTabsHost');
    if (sp.uiPanels && sp.uiPanels.createModeTabs) sp.uiPanels.createModeTabs(tabsHost);

    function render(){
      const s = (sp.store && sp.store.getState && sp.store.getState()) || {};
      const f = (s.frame && s.frame.latest) || {};
      const c = s.calibration || {};
      const w = s.worker || {};
      const topHits = (s.analysis && s.analysis.topHits) || [];
      host.querySelector('#spStatusHost').innerHTML = [
        `<div><span class="muted">Mode</span>: <b>${s.appMode || 'CORE'}</b></div>`,
        `<div><span class="muted">Worker</span>: ${w.status || 'idle'}${w.analysisHz ? ` (${w.analysisHz} Hz)` : ''}</div>`,
        `<div><span class="muted">Frame</span>: ${Array.isArray(f.I) ? f.I.length : 0} px ${f.source ? '('+f.source+')' : ''}</div>`,
        `<div><span class="muted">Calibration</span>: ${c.calibrated ? 'calibrated' : 'uncalibrated'} · pts ${c.pointCount || 0}</div>`,
        `<div><span class="muted">Top hits</span>: ${topHits.length}</div>`
      ].join('');
    }
    if (sp.eventBus && sp.eventBus.on) sp.eventBus.on('state:changed', render);
    render();

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

  function boot(){
    wireCoreEvents();
    makePanel();
    initWorkerClient();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  sp.proBootstrap = { boot, wireCoreEvents };
})(window);
