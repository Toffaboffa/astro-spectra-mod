
(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const bus = sp.eventBus;
  const store = sp.store;
  const types = (sp.workerTypes || {});

  function nowMs() { return (global.performance && performance.now) ? performance.now() : Date.now(); }

  function createAnalysisWorkerClient(options) {
    const opts = Object.assign({
      workerUrl: '../workers/analysis.worker.js',
      throttleMs: 300,
      timeoutMs: 3000,
      enabledModes: ['LAB', 'ASTRO']
    }, options || {});

    let worker = null;
    let reqCounter = 0;
    let lastAnalyzeAt = 0;
    let inFlight = null;
    let stats = { lastWindowStart: nowMs(), count: 0 };

    function setWorkerState(status, extra) {
      if (!store) return;
      const current = store.getState().worker || {};
      store.update('worker', Object.assign({}, current, { status: status }, extra || {}), { source: 'workerClient' });
    }

    function canUseWorker() {
      const mode = sp.appMode ? sp.appMode.getMode() : 'CORE';
      return opts.enabledModes.indexOf(mode) !== -1;
    }

    function start() {
      if (worker || !global.Worker) {
        if (!global.Worker) setWorkerState('error', { lastError: 'Worker API unsupported' });
        return;
      }
      setWorkerState('starting');
      try {
        worker = new Worker(opts.workerUrl);
      } catch (err) {
        setWorkerState('error', { lastError: String(err && err.message || err) });
        return;
      }
      worker.onmessage = onMessage;
      worker.onerror = function (err) {
        console.error('[SPECTRA-PRO] Worker error', err);
        setWorkerState('error', { lastError: err.message || 'Worker error' });
        if (bus) bus.emit('worker:error', err);
      };
      ping();
    }

    function stop() {
      if (worker) worker.terminate();
      worker = null;
      inFlight = null;
      setWorkerState('idle');
    }

    function send(type, payload) {
      if (!worker) return null;
      const requestId = ++reqCounter;
      worker.postMessage({ type: type, requestId: requestId, payload: payload || {} });
      return requestId;
    }

    function ping() {
      if (!worker) start();
      if (!worker) return;
      const t = types.MSG && types.MSG.PING || 'PING';
      send(t, { ts: Date.now() });
    }

    function initLibraries(manifest) {
      if (!worker) start();
      if (!worker) return;
      const t = types.MSG && types.MSG.INIT_LIBRARIES || 'INIT_LIBRARIES';
      send(t, { manifest: manifest || null });
    }

    function setPreset(preset) {
      if (!worker) start();
      if (!worker) return;
      const t = types.MSG && types.MSG.SET_PRESET || 'SET_PRESET';
      send(t, { preset: preset || null });
    }

    function queryLibrary(minNm, maxNm, query) {
      if (!worker) start();
      if (!worker) return;
      const t = types.MSG && types.MSG.QUERY_LIBRARY || 'QUERY_LIBRARY';
      send(t, { minNm: minNm, maxNm: maxNm, query: query || null });
    }

    function analyzeFrame(frame) {
      if (!canUseWorker()) return false;
      if (!worker) start();
      if (!worker) return false;
      const now = nowMs();
      if (now - lastAnalyzeAt < opts.throttleMs) return false;
      if (inFlight) {
        const ws = store.getState().worker;
        store.update('worker', Object.assign({}, ws, { droppedJobs: (ws.droppedJobs || 0) + 1 }));
        return false;
      }
      lastAnalyzeAt = now;
      const requestId = send(types.MSG && types.MSG.ANALYZE_FRAME || 'ANALYZE_FRAME', { frame: frame || null });
      inFlight = { requestId: requestId, startedAt: now };
      setWorkerState('running');
      global.setTimeout(function () {
        if (inFlight && inFlight.requestId === requestId) {
          inFlight = null;
          setWorkerState('error', { lastError: 'Analysis timeout' });
          if (bus) bus.emit('worker:timeout', { requestId: requestId });
        }
      }, opts.timeoutMs);
      return true;
    }

    function onMessage(evt) {
      const msg = evt.data || {};
      const type = msg.type;
      if (type === (types.MSG && types.MSG.PONG || 'PONG')) {
        const ws = store.getState().worker;
        store.update('worker', Object.assign({}, ws, { status: 'ready', lastPingAt: Date.now(), lastError: null }));
        if (bus) bus.emit('worker:ready', msg);
        return;
      }
      if (type === (types.MSG && types.MSG.INIT_LIBRARIES_RESULT || 'INIT_LIBRARIES_RESULT')) {
        const ws = store.getState().worker;
        store.update('worker', Object.assign({}, ws, { status: 'ready', lastError: null, librariesLoaded: !!(msg.payload && msg.payload.ok) }));
        if (bus) bus.emit('worker:libraries', msg);
        return;
      }
      if (type === (types.MSG && types.MSG.SET_PRESET_RESULT || 'SET_PRESET_RESULT')) {
        if (bus) bus.emit('worker:preset', msg);
        return;
      }
      if (type === (types.MSG && types.MSG.QUERY_LIBRARY_RESULT || 'QUERY_LIBRARY_RESULT')) {
        if (msg.payload && store) {
          if (Array.isArray(msg.payload.hits)) store.update('analysis.libraryQueryHits', msg.payload.hits);
          if (typeof msg.payload.count === 'number') store.update('analysis.libraryQueryCount', msg.payload.count);
          if (typeof msg.payload.minNm === 'number') store.update('analysis.libraryQueryMinNm', msg.payload.minNm);
          if (typeof msg.payload.maxNm === 'number') store.update('analysis.libraryQueryMaxNm', msg.payload.maxNm);
        }
        if (bus) bus.emit('worker:query', msg);
        return;
      }
      if (type === (types.MSG && types.MSG.ANALYZE_RESULT || 'ANALYZE_RESULT')) {
        if (inFlight && msg.requestId === inFlight.requestId) inFlight = null;
        const ws = store.getState().worker;
        const tNow = nowMs();
        stats.count += 1;
        const elapsed = tNow - stats.lastWindowStart;
        let hz = ws.analysisHz || 0;
        if (elapsed >= 1000) {
          hz = stats.count / (elapsed / 1000);
          stats = { lastWindowStart: tNow, count: 0 };
        }
        store.update('worker', Object.assign({}, ws, { status: 'ready', lastResultAt: Date.now(), analysisHz: +hz.toFixed(2), lastError: null }));
        if (msg.payload && store) {
          if (Array.isArray(msg.payload.topHits)) store.update('analysis.topHits', msg.payload.topHits);
          if (typeof msg.payload.offsetNm === 'number') store.update('analysis.offsetNm', msg.payload.offsetNm);
          if (Array.isArray(msg.payload.qcFlags)) store.update('analysis.qcFlags', msg.payload.qcFlags);
        }
        if (bus) bus.emit('worker:result', msg);
        return;
      }
      if (type === (types.MSG && types.MSG.ERROR || 'ERROR')) {
        inFlight = null;
        setWorkerState('error', { lastError: (msg.payload && msg.payload.message) || 'Worker returned error' });
        if (bus) bus.emit('worker:error', msg);
      }
    }

    return { start, stop, ping, initLibraries, setPreset, queryLibrary, analyzeFrame };
  }

  sp.createAnalysisWorkerClient = createAnalysisWorkerClient;
})(window);
