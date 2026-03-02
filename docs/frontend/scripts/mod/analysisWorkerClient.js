
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

    // Optional stability filter: keep a short rolling memory of hits so the UI can
    // display "steady" identifications instead of frame-to-frame flicker.
    let stable = { byKey: Object.create(null), lastPruneAt: nowMs() };

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
      const st = store ? store.getState() : {};
      const requestId = send(types.MSG && types.MSG.ANALYZE_FRAME || 'ANALYZE_FRAME', {
        frame: frame || null,
        options: {
          includeWeakPeaks: !!(st.analysis && st.analysis.includeWeakPeaks),
          peakThresholdRel: Number(st.analysis && st.analysis.peakThresholdRel),
          peakDistancePx: Number(st.analysis && st.analysis.peakDistancePx),
          maxDistanceNm: Number(st.analysis && st.analysis.maxDistanceNm)
        }
      });
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



    function buildSmartFind(rawHits) {
      const hits = Array.isArray(rawHits) ? rawHits.filter(Boolean) : [];
      const result = { groups: [], hits: [] };
      if (!hits.length) return result;

      function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      function getElement(hit) {
        const direct = String((hit && (hit.element || '')) || '').trim();
        if (direct) return direct;
        const raw = String((hit && (hit.species || hit.speciesKey || hit.name || '')) || '').trim();
        const s = raw.replace(/^[0-9]+/, '');
        const m = s.match(/^([A-Z][a-z]?)/);
        return m ? m[1] : '';
      }

      const buckets = Object.create(null);
      for (let i = 0; i < hits.length; i += 1) {
        const hit = Object.assign({}, hits[i] || {});
        const element = getElement(hit);
        if (!element) continue;
        const observedNm = num(hit.observedNm);
        const referenceNm = num(hit.referenceNm);
        const nm = observedNm != null ? observedNm : referenceNm;
        if (nm == null) continue;
        const bucket = buckets[element] || {
          element: element,
          members: [],
          uniqueBins: Object.create(null),
          lineKeys: Object.create(null),
          best: null,
          totalConfidence: 0,
          totalRawScore: 0
        };
        const nearBin = Math.round(nm * 2) / 2; // 0.5 nm bins: merges near-duplicates, preserves patterns.
        bucket.uniqueBins[nearBin.toFixed(1)] = true;
        const refKey = referenceNm != null ? referenceNm.toFixed(1) : observedNm != null ? observedNm.toFixed(1) : '?';
        bucket.lineKeys[refKey] = true;
        bucket.members.push(hit);
        bucket.totalConfidence += Math.max(0, Number(hit.confidence) || 0);
        bucket.totalRawScore += Math.max(0, Number(hit.rawScore) || Number(hit.score) || 0);
        if (!bucket.best || (Number(hit.confidence) || 0) > (Number(bucket.best.confidence) || 0)) bucket.best = hit;
        buckets[element] = bucket;
      }

      const COMMONNESS = { He: 1.0, Hg: 0.82, Ne: 0.9, Ar: 0.86, H: 0.82, Na: 0.74, Kr: 0.55, Xe: 0.5, O: 0.55, N: 0.45 };
      const groups = Object.keys(buckets).map(function (element) {
        const bucket = buckets[element];
        const lineCount = Object.keys(bucket.uniqueBins).length;
        const memberCount = bucket.members.length;
        const avgConfidence = memberCount ? bucket.totalConfidence / memberCount : 0;
        const avgRawScore = memberCount ? bucket.totalRawScore / memberCount : 0;
        const bestConfidence = bucket.best ? (Number(bucket.best.confidence) || 0) : 0;
        const commonness = Object.prototype.hasOwnProperty.call(COMMONNESS, element) ? COMMONNESS[element] : 0.08;
        const rarityPenalty = Object.prototype.hasOwnProperty.call(COMMONNESS, element) ? 0 : 1.0;
        const score = lineCount * 4.2 + memberCount * 1.1 + avgConfidence * 5 + bestConfidence * 2.2 + avgRawScore * 0.01 + commonness * 3.5 - rarityPenalty;
        return {
          element: element,
          lineCount: lineCount,
          memberCount: memberCount,
          avgConfidence: +avgConfidence.toFixed(4),
          avgRawScore: +avgRawScore.toFixed(4),
          bestConfidence: +bestConfidence.toFixed(4),
          score: +score.toFixed(4),
          best: bucket.best,
          members: bucket.members.slice()
        };
      }).sort(function (a, b) {
        return (b.score - a.score) || (b.lineCount - a.lineCount) || (b.bestConfidence - a.bestConfidence) || a.element.localeCompare(b.element);
      });

      const smartHits = [];
      groups.forEach(function (group, groupIndex) {
        const seenBins = Object.create(null);
        group.members
          .slice()
          .sort(function (a, b) {
            return ((Number(b.confidence) || 0) - (Number(a.confidence) || 0)) || ((Number(a.observedNm) || Number(a.referenceNm) || 0) - (Number(b.observedNm) || Number(b.referenceNm) || 0));
          })
          .forEach(function (member) {
            const nm = num(member.observedNm) != null ? num(member.observedNm) : num(member.referenceNm);
            if (nm == null) return;
            const binKey = (Math.round(nm * 2) / 2).toFixed(1);
            if (seenBins[binKey]) return;
            seenBins[binKey] = true;
            smartHits.push(Object.assign({}, member, {
              element: group.element,
              smartFind: true,
              smartGroupRank: groupIndex,
              smartGroupScore: group.score,
              smartLineCount: group.lineCount,
              smartMemberCount: group.memberCount
            }));
          });
      });

      result.groups = groups;
      result.hits = smartHits.sort(function (a, b) {
        return ((a.smartGroupRank || 0) - (b.smartGroupRank || 0)) || ((Number(b.confidence) || 0) - (Number(a.confidence) || 0));
      });
      return result;
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
          if (Array.isArray(msg.payload.topHits)) {
            function normalizeHits(list) {
              return (Array.isArray(list) ? list : []).map(function (h) {
                const hit = Object.assign({}, h || {});
                if (!hit.element) {
                  const raw = String(hit.species || hit.speciesKey || hit.name || '').trim();
                  const s = raw.replace(/^[0-9]+/, '');
                  const m = s.match(/^([A-Z][a-z]?)/);
                  if (m) hit.element = m[1];
                }
                return hit;
              });
            }
            const rawHits = normalizeHits(msg.payload.topHits);
            const overlayHits = Array.isArray(msg.payload.overlayHits) && msg.payload.overlayHits.length
              ? normalizeHits(msg.payload.overlayHits)
              : rawHits.slice();
            store.update('analysis.rawTopHits', overlayHits);
            if (Array.isArray(msg.payload.elementScores)) {
              store.update('analysis.elementScores', msg.payload.elementScores.slice(0, 8));
            } else {
              store.update('analysis.elementScores', []);
            }
            let smart = { groups: [], hits: [] };
            try {
              if (Array.isArray(msg.payload.elementScores) && msg.payload.elementScores.length) {
                smart = {
                  groups: msg.payload.elementScores.map(function (g) {
                    return Object.assign({}, g, {
                      lineCount: Number(g && g.matchedPeaks) || Number(g && g.lineCount) || 0,
                      memberCount: Number(g && g.matchCount) || Number(g && g.memberCount) || 0,
                      bestConfidence: Number(g && g.explainedShare) || 0,
                      avgConfidence: Number(g && g.closenessScore) || 0
                    });
                  }),
                  hits: rawHits.slice()
                };
              } else {
                smart = buildSmartFind(rawHits);
              }
            } catch (err) {
              smart = { groups: [], hits: [] };
            }
            store.update('analysis.smartFindGroups', smart.groups.slice(0, 6));
            store.update('analysis.smartFindHits', smart.hits.slice(0, 36));

            // Optional stability filter.
            const st = store.getState();
            const useStable = !!(st.analysis && st.analysis.stableHits);
            if (!useStable) {
              store.update('analysis.topHits', rawHits.slice(0, 36));
            } else {
              const t = nowMs();
              const windowMs = 8000;
              const pruneEveryMs = 1000;
              const minCount = 2;

              // Update rolling counts.
              for (let i = 0; i < rawHits.length; i += 1) {
                const h = rawHits[i];
                const refNm = Number(h.referenceNm != null ? h.referenceNm : h.observedNm);
                const key = String(h.element || h.speciesKey || h.species || '').trim() + '|' + (Number.isFinite(refNm) ? refNm.toFixed(1) : '?');
                if (!key) continue;
                const rec = stable.byKey[key] || { count: 0, lastSeen: 0, best: null };
                rec.count += 1;
                rec.lastSeen = t;
                // Keep the best (highest confidence) representative.
                if (!rec.best || (+h.confidence || 0) > (+rec.best.confidence || 0)) rec.best = h;
                stable.byKey[key] = rec;
              }

              // Prune old entries.
              if (t - stable.lastPruneAt > pruneEveryMs) {
                stable.lastPruneAt = t;
                Object.keys(stable.byKey).forEach(function (k) {
                  const rec = stable.byKey[k];
                  if (!rec) return;
                  if (t - rec.lastSeen > windowMs) delete stable.byKey[k];
                });
              }

              // Build stable list: prefer high count, then confidence.
              const stableList = Object.keys(stable.byKey)
                .map(function (k) {
                  const rec = stable.byKey[k];
                  return rec && rec.best ? Object.assign({ stableCount: rec.count }, rec.best) : null;
                })
                .filter(Boolean)
                .filter(h => (h.stableCount || 0) >= minCount)
                .sort((a, b) => ((b.stableCount || 0) * 2 + (+b.confidence || 0)) - ((a.stableCount || 0) * 2 + (+a.confidence || 0)));

              store.update('analysis.topHits', stableList.slice(0, 36));
            }
          }
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
