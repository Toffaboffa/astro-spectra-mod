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
          STATE.molecularBands = result.molecularBands || [];
          STATE.libraryIndex = root.SPECTRA_PRO_libraryIndex.buildIndex(STATE.atomLines);
          return { type: TYPES.INIT_LIBRARIES_RESULT, requestId: requestId, payload: { ok: true, count: STATE.atomLines.length, molecularCount: STATE.molecularBands.length, manifest: STATE.manifest || null, warnings: result.warnings || [] } };
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
          const q = p.query || null;
          if (!STATE.libraryIndex) {
            return { type: TYPES.QUERY_LIBRARY_RESULT, requestId: requestId, payload: { ok: false, message: 'Library not initialized', hits: [] } };
          }
          let lo = Number.isFinite(minNm) ? minNm : 380;
          let hi = Number.isFinite(maxNm) ? maxNm : 780;
          if (hi < lo) { const tmp = lo; lo = hi; hi = tmp; }
          let hits = root.SPECTRA_PRO_libraryQuery.queryByRange(STATE.libraryIndex, lo, hi);
          if (q && typeof q === 'string' && q.trim()) {
            const qq = q.trim().toLowerCase();
            hits = hits.filter(function (l) {
              return String(l.speciesKey || l.species || '').toLowerCase().indexOf(qq) !== -1 ||
                String(l.element || '').toLowerCase() === qq;
            });
          }
          const shown = hits.slice(0, 200).map(function (l) {
            return { species: l.species, speciesKey: l.speciesKey, element: l.element, nm: l.nm, kind: l.kind || 'atom' };
          });
          return { type: TYPES.QUERY_LIBRARY_RESULT, requestId: requestId, payload: { ok: true, count: hits.length, shown: shown.length, minNm: lo, maxNm: hi, hits: shown } };
        }
        case TYPES.ANALYZE_FRAME: {
          const frame = (msg.payload && msg.payload.frame) || null;
          const options = (msg.payload && msg.payload.options) || null;
          let out = root.SPECTRA_PRO_analysisPipeline.analyzeFrame(frame, STATE, options);
          if (out && String(out.presetId || '') === 'smart-fluorescent' &&
              root.SPECTRA_PRO_fluorescenceAnalysis && typeof root.SPECTRA_PRO_fluorescenceAnalysis.enhance === 'function') {
            out = root.SPECTRA_PRO_fluorescenceAnalysis.enhance(out, frame, STATE, options);
          } else if (root.SPECTRA_PRO_atomicEvidence && typeof root.SPECTRA_PRO_atomicEvidence.enhance === 'function') {
            out = root.SPECTRA_PRO_atomicEvidence.enhance(out, frame, STATE, options);
          }
          if (out && out.ok) out.analysisVersion = '2.2.7';
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

  root.SPECTRA_PRO_workerRouter = { handleMessage: handleMessage };
})(typeof self !== 'undefined' ? self : this);
