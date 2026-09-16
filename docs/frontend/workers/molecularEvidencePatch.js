(function (root) {
  'use strict';

  const pipeline = root.SPECTRA_PRO_analysisPipeline;
  const catalog = root.SPECTRA_PRO_plasmaProfiles;
  if (!pipeline || typeof pipeline.analyzeFrame !== 'function' || !catalog || !catalog.profiles) return;

  const originalAnalyzeFrame = pipeline.analyzeFrame;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function median(values) {
    const arr = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function isMolecularSmartPreset(presetId) {
    const id = String(presetId || '').toLowerCase();
    return id === 'smart-molecular' || id === 'smart-gastube';
  }

  function getPeakProminence(p) {
    return Math.max(0, Number(p && (p.prominence != null ? p.prominence : p.value)) || 0);
  }

  function scoreDiagnosticProfile(species, profile, peaks, hardMaxDistanceNm) {
    const peakArr = (Array.isArray(peaks) ? peaks : []).filter(function (p) { return Number.isFinite(Number(p && p.nm)); });
    const anchors = Array.isArray(profile && profile.anchors) ? profile.anchors : [];
    if (!peakArr.length || !anchors.length) return null;

    const tolerance = clamp(Number(hardMaxDistanceNm) || 1, 0.2, 5.0);
    const maxProm = Math.max(1, peakArr.reduce(function (m, p) { return Math.max(m, getPeakProminence(p)); }, 0));
    const totalProm = Math.max(1, peakArr.reduce(function (s, p) { return s + getPeakProminence(p); }, 0));
    const usedPeak = Object.create(null);
    const matches = [];

    anchors.forEach(function (anchor) {
      const refNm = Number(anchor && anchor.nm);
      const weight = Math.max(0.1, Number(anchor && anchor.weight) || 1);
      if (!Number.isFinite(refNm)) return;
      let best = null;
      for (let i = 0; i < peakArr.length; i += 1) {
        const p = peakArr[i] || {};
        const idxKey = Number.isFinite(Number(p.index)) ? String(Number(p.index)) : String(i);
        if (usedPeak[idxKey]) continue;
        const obsNm = Number(p.nm);
        const delta = Math.abs(obsNm - refNm);
        if (delta > tolerance) continue;
        const prom = getPeakProminence(p);
        const closeness = clamp(1 - (delta / tolerance), 0, 1);
        const strength = clamp(prom / maxProm, 0, 1);
        const localScore = weight * (0.72 * closeness + 0.28 * strength);
        if (!best || localScore > best.localScore) {
          best = { peak: p, peakKey: idxKey, obsNm: obsNm, refNm: refNm, delta: delta, prom: prom, weight: weight, closeness: closeness, strength: strength, localScore: localScore };
        }
      }
      if (best) {
        usedPeak[best.peakKey] = true;
        matches.push(best);
      }
    });

    if (!matches.length) return null;

    const matchedCount = matches.length;
    const weightedEvidence = matches.reduce(function (s, m) { return s + m.localScore; }, 0);
    const matchedWeight = matches.reduce(function (s, m) { return s + m.weight; }, 0);
    const allWeight = Math.max(1, anchors.reduce(function (s, a) { return s + Math.max(0.1, Number(a && a.weight) || 1); }, 0));
    const coverage = clamp(matchedWeight / allWeight, 0, 1);
    const explainedProm = matches.reduce(function (s, m) { return s + m.prom; }, 0);
    const strongSupport = matches.reduce(function (s, m) { return s + m.weight * m.strength; }, 0);
    const deltas = matches.map(function (m) { return m.delta; });

    let evidenceFactor = 1;
    if (matchedCount === 1) evidenceFactor = 0.22;
    else if (matchedCount === 2) evidenceFactor = 0.78;
    else if (matchedCount >= 4) evidenceFactor = 1.08;

    const minStrong = Math.max(2, Number(profile.minimumStrongEvidence) || 2);
    if (matchedCount < minStrong) evidenceFactor *= 0.88;

    const totalScore = evidenceFactor * (
      matchedCount * 3.4 +
      weightedEvidence * 2.4 +
      coverage * 3.0 +
      strongSupport * 0.9
    );

    return {
      row: {
        element: species,
        totalScore: +totalScore.toFixed(3),
        matchedCount: matchedCount,
        matchedExpected: matchedCount,
        matchedPeaks: matchedCount,
        matchCount: matchedCount,
        missedStrong: Math.max(0, minStrong - matchedCount),
        medianDeltaNm: +median(deltas).toFixed(3),
        avgDeltaNm: +(deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length).toFixed(3),
        explainedProm: +explainedProm.toFixed(3),
        explainedIntensityPct: +clamp((explainedProm / totalProm) * 100, 0, 100).toFixed(1),
        explainedPeaks: matchedCount,
        explainedPeaksPct: +clamp((matchedCount / Math.max(1, peakArr.length)) * 100, 0, 100).toFixed(1),
        explainedShare: +clamp(explainedProm / totalProm, 0, 1).toFixed(4),
        closenessScore: +clamp(1 - (median(deltas) / Math.max(0.2, tolerance)), 0, 1).toFixed(4),
        supportLines: matches.map(function (m) { return m.refNm; }),
        family: 'molecular',
        mode: 'molecular',
        rgbSupport: 0,
        evidenceModel: 'plasma-diagnostic-v1',
        evidenceFactor: +evidenceFactor.toFixed(3)
      },
      hits: matches.map(function (m) {
        const conf = clamp((0.35 + 0.65 * m.closeness) * (0.55 + 0.45 * m.strength), 0, 1);
        return {
          species: species + ' ' + String(profile.label || 'molecular band'),
          element: species,
          referenceNm: +m.refNm.toFixed(3),
          observedNm: +m.obsNm.toFixed(3),
          peakIndex: Number.isFinite(Number(m.peak && m.peak.index)) ? Number(m.peak.index) : null,
          deltaNm: +(m.obsNm - m.refNm).toFixed(3),
          confidence: +conf.toFixed(3),
          score: +(m.localScore * 100).toFixed(1),
          kind: 'molecular-band',
          evidenceModel: 'plasma-diagnostic-v1'
        };
      })
    };
  }

  function weakEvidenceFactor(row) {
    if (String(row && row.mode || '') !== 'molecular') return 1;
    const count = Number(row && (row.matchedPeaks != null ? row.matchedPeaks : row.matchCount)) || 0;
    if (count >= 3) return 1;
    if (count === 2) return 0.78;
    if (count === 1) return 0.22;
    return 0.08;
  }

  function mergeRows(baseRows, diagnosticRows) {
    const rows = (Array.isArray(baseRows) ? baseRows : []).map(function (row) {
      const out = Object.assign({}, row || {});
      const factor = weakEvidenceFactor(out);
      if (factor < 1 && Number.isFinite(Number(out.totalScore))) {
        out.totalScore = +(Number(out.totalScore) * factor).toFixed(3);
        out.evidenceFactor = factor;
        out.evidenceModel = out.evidenceModel || 'generic-molecular-multihit-v1';
      }
      return out;
    });

    (Array.isArray(diagnosticRows) ? diagnosticRows : []).forEach(function (diag) {
      if (!diag || !diag.element) return;
      const idx = rows.findIndex(function (row) { return String(row && row.element || '') === String(diag.element); });
      if (idx < 0) {
        rows.push(Object.assign({}, diag));
        return;
      }
      const current = rows[idx] || {};
      if (Number(diag.totalScore || 0) >= Number(current.totalScore || 0)) {
        rows[idx] = Object.assign({}, current, diag);
      } else {
        rows[idx] = Object.assign({}, current, {
          diagnosticMatchedPeaks: diag.matchedPeaks,
          diagnosticSupportLines: diag.supportLines,
          diagnosticScore: diag.totalScore,
          evidenceModel: current.evidenceModel || diag.evidenceModel
        });
      }
    });

    rows.sort(function (a, b) {
      return (Number(b && b.totalScore || 0) - Number(a && a.totalScore || 0)) ||
        (Number(b && b.matchedPeaks || 0) - Number(a && a.matchedPeaks || 0)) ||
        (Number(a && a.medianDeltaNm || 99) - Number(b && b.medianDeltaNm || 99));
    });

    const top = rows.slice(0, 8);
    const scoreSum = top.reduce(function (sum, row) { return sum + Math.max(0, Number(row && row.totalScore) || 0); }, 0) || 1;
    return top.map(function (row, idx) {
      const share = Math.max(0, Math.round((Math.max(0, Number(row.totalScore) || 0) / scoreSum) * 100));
      return Object.assign({}, row, {
        rank: idx + 1,
        likelyPct: share,
        scoreSharePct: share
      });
    });
  }

  function dedupeHits(hits) {
    const seen = Object.create(null);
    return (Array.isArray(hits) ? hits : []).filter(function (h) {
      const key = String(h && h.element || '') + '|' + String(Number(h && h.referenceNm).toFixed(2)) + '|' + String(h && h.peakIndex);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function buildWinnerBreakdown(presetId, rows) {
    const winner = rows && rows[0];
    if (!winner) return null;
    return {
      preset: presetId,
      primaryEmitter: String(winner.element || ''),
      primaryLikelyPct: Number(winner.scoreSharePct != null ? winner.scoreSharePct : winner.likelyPct) || 0,
      explainedPeaksPct: Number(winner.explainedPeaksPct) || 0,
      explainedIntensityPct: Number(winner.explainedIntensityPct) || 0,
      expectedFound: Array.isArray(winner.supportLines) ? winner.supportLines.slice(0, 8) : [],
      expectedMissed: Number(winner.missedStrong) || 0,
      secondaryContributors: (rows || []).slice(1, 4).map(function (row) {
        return {
          element: String(row.element || '?'),
          likelyPct: Number(row.scoreSharePct != null ? row.scoreSharePct : row.likelyPct) || 0,
          explainedIntensityPct: Number(row.explainedIntensityPct) || 0,
          explainedPeaksPct: Number(row.explainedPeaksPct) || 0
        };
      }),
      backgroundComponents: [],
      possibleBands: [],
      scoreSemantics: 'relative-score-share'
    };
  }

  pipeline.analyzeFrame = function (frame, state, options) {
    const out = originalAnalyzeFrame.call(pipeline, frame, state, options);
    if (!out || !out.ok || !out.calibrated || !isMolecularSmartPreset(out.presetId)) return out;

    const peaks = Array.isArray(out.peaks) ? out.peaks : [];
    const diagnostics = [];
    const diagnosticHits = [];
    Object.keys(catalog.profiles).forEach(function (species) {
      const scored = scoreDiagnosticProfile(species, catalog.profiles[species], peaks, out.maxDistanceNm);
      if (!scored || !scored.row || !(scored.row.totalScore > 0)) return;
      diagnostics.push(scored.row);
      Array.prototype.push.apply(diagnosticHits, scored.hits || []);
    });

    if (!diagnostics.length) return out;

    const mergedRows = mergeRows(out.elementScores, diagnostics);
    out.elementScores = mergedRows;
    out.winnerBreakdown = buildWinnerBreakdown(out.presetId, mergedRows);
    out.scoreSemantics = 'relative-score-share';
    out.molecularEvidenceModel = 'multihit-plus-plasma-diagnostic-v1';

    const mergedOverlay = dedupeHits((out.overlayHits || []).concat(diagnosticHits));
    out.overlayHits = mergedOverlay.slice(0, 160);

    const topSpecies = Object.create(null);
    mergedRows.slice(0, 3).forEach(function (row) { topSpecies[String(row.element || '')] = true; });
    const mergedTop = dedupeHits((out.topHits || []).concat(diagnosticHits)).filter(function (hit) {
      return topSpecies[String(hit && hit.element || '')];
    }).sort(function (a, b) {
      const ra = mergedRows.findIndex(function (row) { return String(row.element) === String(a.element); });
      const rb = mergedRows.findIndex(function (row) { return String(row.element) === String(b.element); });
      return (ra - rb) || (Number(b.confidence || 0) - Number(a.confidence || 0));
    });
    out.topHits = mergedTop.slice(0, 80);

    return out;
  };
})(typeof self !== 'undefined' ? self : this);
