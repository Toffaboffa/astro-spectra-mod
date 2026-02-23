
(function (root) {
  'use strict';

  const TYPES = root.SPECTRA_PRO_WORKER_TYPES && root.SPECTRA_PRO_WORKER_TYPES.MSG;
  const STATE = root.SPECTRA_PRO_WORKER_STATE;

  async function handleMessage(msg) {
    const type = msg && msg.type;
    const requestId = msg && msg.requestId;
    try {
      switch (type) {
        case TYPES.PING:
          return { type: TYPES.PONG, requestId: requestId, payload: { ts: Date.now() } };
        case TYPES.INIT_LIBRARIES: {
          const result = await root.SPECTRA_PRO_libraryLoader.loadLibraries(msg.payload || {});
          STATE.librariesLoaded = !!result.ok;
          STATE.manifest = result.manifest || null;
          STATE.atomLines = result.atomLines || [];
          STATE.libraryIndex = root.SPECTRA_PRO_libraryIndex.buildIndex(STATE.atomLines);
          return { type: TYPES.INIT_LIBRARIES_RESULT, requestId: requestId, payload: { ok: true, count: STATE.atomLines.length } };
        }
        case TYPES.ANALYZE_FRAME: {
          const out = root.SPECTRA_PRO_analysisPipeline.analyzeFrame((msg.payload && msg.payload.frame) || null, STATE);
          STATE.lastAnalysis = out;
          return { type: TYPES.ANALYZE_RESULT, requestId: requestId, payload: out };
        }
        default:
          return { type: TYPES.ERROR, requestId: requestId, payload: { message: 'Unknown message type: ' + type } };
      }
    } catch (err) {
      return { type: TYPES.ERROR, requestId: requestId, payload: { message: err.message || String(err) } };
    }
  }

  root.SPECTRA_PRO_workerRouter = { handleMessage };
})(typeof self !== 'undefined' ? self : this);
