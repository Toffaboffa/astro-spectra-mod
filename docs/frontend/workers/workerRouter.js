
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
          return { type: TYPES.INIT_LIBRARIES_RESULT, requestId: requestId, payload: { ok: true, count: STATE.atomLines.length, manifest: STATE.manifest || null, warnings: result.warnings || [] } };
        }
        case TYPES.SET_PRESET: {
          const preset = (msg.payload && msg.payload.preset) ? msg.payload.preset : null;
          STATE.activePreset = preset;
          return { type: TYPES.SET_PRESET_RESULT, requestId: requestId, payload: { ok: true, preset: preset } };
        }
        case TYPES.QUERY_LIBRARY: {
          const p = msg.payload || {};
          const minNm = Number(p.minNm);
          const maxNm = Number(p.maxNm);
          const q = (p.query || null);
          if (!STATE.libraryIndex) {
            return { type: TYPES.QUERY_LIBRARY_RESULT, requestId: requestId, payload: { ok: false, message: 'Library not initialized', hits: [] } };
          }
          let lo = Number.isFinite(minNm) ? minNm : 380;
          let hi = Number.isFinite(maxNm) ? maxNm : 780;
          if (hi < lo) { const tmp = lo; lo = hi; hi = tmp; }
          let hits = root.SPECTRA_PRO_libraryQuery.queryByRange(STATE.libraryIndex, lo, hi);
          if (q && typeof q === 'string' && q.trim()) {
            const qq = q.trim().toLowerCase();
            hits = hits.filter(l => String(l.speciesKey || l.species || '').toLowerCase().indexOf(qq) !== -1 || String(l.element || '').toLowerCase() === qq);
          }
          // Keep payload small
          const out = hits.slice(0, 200).map(function (l) {
            return { species: l.species, speciesKey: l.speciesKey, element: l.element, nm: l.nm, kind: l.kind || 'atom' };
          });
          return { type: TYPES.QUERY_LIBRARY_RESULT, requestId: requestId, payload: { ok: true, count: hits.length, shown: out.length, minNm: lo, maxNm: hi, hits: out } };
        }
        case TYPES.ANALYZE_FRAME: {
          const out = root.SPECTRA_PRO_analysisPipeline.analyzeFrame(
            (msg.payload && msg.payload.frame) || null,
            STATE,
            (msg.payload && msg.payload.options) || null
          );
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
