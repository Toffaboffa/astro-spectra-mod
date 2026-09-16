(function (root) {
  'use strict';

  const catalog = root.SPECTRA_PRO_atomicProfiles;
  const MODEL = catalog && catalog.version ? catalog.version : 'atomic-fingerprint-v1';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function median(values) {
    const arr = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function getProminence(peak) {
    return Math.max(0, Number(peak && (peak.prominence != null ? peak.prominence : peak.value)) || 0);
  }

  function observedRange(frame, peaks) {
    const vals = [];
    if (frame && Array.isArray(frame.nm)) {
      frame.nm.forEach(function (v) { const n = Number(v); if (Number.isFinite(n)) vals.push(n); });
    }
    if (!vals.length) {
      (Array.isArray(peaks) ? peaks : []).forEach(function (p) { const n = Number(p && p.nm); if (Number.isFinite(n)) vals.push(n); });
    }
    return vals.length ? { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) } : { min: 380, max: 900 };
  }

  function activeLines(profile, range) {
    return (Array.isArray(profile && profile.lines) ? profile.lines : []).filter(function (ln) {
      const nm = Number(ln && ln.nm);
      return Number.isFinite(nm) && nm >= range.min - 1 && nm <= range.max + 1;
    });
  }

  function scoreProfile(profile, peaks, hardMaxDistanceNm, range) {
    const peakArr = (Array.isArray(peaks) ? peaks : []).filter(function (p) { return Number.isFinite(Number(p && p.nm)); });
    const lines = activeLines(profile, range);
    if (!profile || !peakArr.length || !lines.length) return null;

    const tolerance = clamp(Number(hardMaxDistanceNm) || 1, 0.2, 5.0);
    const maxProm = Math.max(1, peakArr.reduce(function (m, p) { return Math.max(m, getProminence(p)); }, 0));
    const totalProm = Math.max(1, peakArr.reduce(function (s, p) { return s + getProminence(p); }, 0));
    const totalWeight = Math.max(0.1, lines.reduce(function (s, ln) { return s + Math.max(0.1, Number(ln.weight) || 1); }, 0));
    const diagnosticExpected = lines.filter(function (ln) { return ln.diagnostic !== false; }).length;

    const pairs = [];
    lines.forEach(function (ln, lineIndex) {
      const refNm = Number(ln.nm);
      const weight = Math.max(0.1, Number(ln.weight) || 1);
      peakArr.forEach(function (peak, peakIndex) {
        const obsNm = Number(peak.nm);
        const delta = Math.abs(obsNm - refNm);
        if (delta > tolerance) return;
        const prom = getProminence(peak);
        const closeness = clamp(1 - delta / tolerance, 0, 1);
        const strength = clamp(prom / maxProm, 0, 1);
        const localScore = weight * (0.74 * closeness + 0.26 * strength);
        pairs.push({ line: ln, lineIndex: lineIndex, peak: peak, peakIndex: peakIndex, refNm: refNm, obsNm: obsNm, delta: delta, prom: prom, weight: weight, closeness: closeness, strength: strength, localScore: localScore });
      });
    });

    pairs.sort(function (a, b) {
      return (b.localScore - a.localScore) || (a.delta - b.delta) || (b.prom - a.prom);
    });

    const usedLines = Object.create(null);
    const usedPeaks = Object.create(null);
    const matches = [];
    pairs.forEach(function (pair) {
      const lk = String(pair.lineIndex);
      const pk = Number.isFinite(Number(pair.peak && pair.peak.index)) ? String(Number(pair.peak.index)) : String(pair.peakIndex);
      if (usedLines[lk] || usedPeaks[pk]) return;
      usedLines[lk] = true;
      usedPeaks[pk] = true;
      pair.peakKey = pk;
      matches.push(pair);
    });

    if (!matches.length) return null;

    const matchedWeight = matches.reduce(function (s, m) { return s + m.weight; }, 0);
    const weightedEvidence = matches.reduce(function (s, m) { return s + m.localScore; }, 0);
    const explainedProm = matches.reduce(function (s, m) { return s + m.prom; }, 0);
    const diagnosticFound = matches.filter(function (m) { return m.line.diagnostic !== false; }).length;
    const missingImportant = Math.max(0, diagnosticExpected - diagnosticFound);
    const coverage = clamp(matchedWeight / totalWeight, 0, 1);
    const diagnosticCoverage = diagnosticExpected ? clamp(diagnosticFound / diagnosticExpected, 0, 1) : coverage;
    const closeness = matches.reduce(function (s, m) { return s + m.closeness * m.weight; }, 0) / Math.max(0.1, matchedWeight);
    const strongSupport = matches.reduce(function (s, m) { return s + m.strength * m.weight; }, 0) / Math.max(0.1, matchedWeight);
    const peakCoverage = clamp(matches.length / Math.max(1, peakArr.length), 0, 1);

    let groupBonus = 0;
    (Array.isArray(profile.groups) ? profile.groups : []).forEach(function (group) {
      const active = (Array.isArray(group) ? group : []).filter(function (nm) { return nm >= range.min - 1 && nm <= range.max + 1; });
      if (active.length < 2) return;
      let found = 0;
      active.forEach(function (nm) {
        if (matches.some(function (m) { return Math.abs(m.refNm - Number(nm)) < 0.08; })) found += 1;
      });
      if (found >= 2) groupBonus += 0.6 + (found - 2) * 0.22;
    });

    const minimumEvidence = Math.max(2, Number(profile.minimumEvidence) || 2);
    let evidenceFactor = 1;
    if (matches.length === 1) evidenceFactor = 0.16;
    else if (matches.length === 2) evidenceFactor = 0.58;
    else if (matches.length === 3) evidenceFactor = 0.86;
    else if (matches.length >= 6) evidenceFactor = 1.10;
    if (matches.length < minimumEvidence) evidenceFactor *= 0.82;

    const missingWeight = Math.max(0, totalWeight - matchedWeight);
    const totalScore = evidenceFactor * (
      matchedWeight * 3.8 +
      weightedEvidence * 2.1 +
      diagnosticFound * 1.15 +
      coverage * 3.0 +
      diagnosticCoverage * 3.2 +
      closeness * 2.0 +
      strongSupport * 1.15 +
      groupBonus * 1.6
    ) - missingImportant * 0.34 - missingWeight * 0.10;

    if (!(totalScore > 0)) return null;

    const fingerprintScore = Math.round(100 * clamp(
      coverage * 0.34 + diagnosticCoverage * 0.30 + closeness * 0.20 + strongSupport * 0.10 + Math.min(1, groupBonus / 2) * 0.06,
      0, 1
    ));

    const deltas = matches.map(function (m) { return m.delta; });
    const row = {
      element: profile.element,
      totalScore: +totalScore.toFixed(3),
      matchedCount: matches.length,
      matchedExpected: matches.length,
      matchedPeaks: matches.length,
      matchCount: matches.length,
      missedStrong: missingImportant,
      medianDeltaNm: +median(deltas).toFixed(3),
      avgDeltaNm: +(deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length).toFixed(3),
      explainedProm: +explainedProm.toFixed(3),
      explainedIntensityPct: +clamp((explainedProm / totalProm) * 100, 0, 100).toFixed(1),
      explainedPeaks: matches.length,
      explainedPeaksPct: +clamp((matches.length / Math.max(1, peakArr.length)) * 100, 0, 100).toFixed(1),
      explainedShare: +clamp(explainedProm / totalProm, 0, 1).toFixed(4),
      closenessScore: +clamp(closeness, 0, 1).toFixed(4),
      supportLines: matches.slice().sort(function (a, b) { return a.refNm - b.refNm; }).map(function (m) { return +m.refNm.toFixed(3); }),
      family: profile.family || 'atomic',
      mode: 'atomic',
      rgbSupport: 0,
      evidenceModel: MODEL,
      diagnosticMatchedPeaks: diagnosticFound,
      diagnosticScore: fingerprintScore,
      profileMatched: true,
      profileExpected: lines.length,
      diagnosticExpected: diagnosticExpected,
      missingImportant: missingImportant,
      patternCoveragePct: +((coverage * 100).toFixed(1)),
      fingerprintScore: fingerprintScore
    };

    const hits = matches.map(function (m) {
      const confidence = clamp((0.32 + 0.68 * m.closeness) * (0.58 + 0.42 * m.strength), 0, 1);
      return {
        species: profile.label || (profile.element + ' I'),
        element: profile.element,
        referenceNm: +m.refNm.toFixed(3),
        observedNm: +m.obsNm.toFixed(3),
        peakIndex: Number.isFinite(Number(m.peak && m.peak.index)) ? Number(m.peak.index) : null,
        deltaNm: +(m.obsNm - m.refNm).toFixed(3),
        confidence: +confidence.toFixed(3),
        score: +(m.localScore * 100).toFixed(1),
        prominence: +m.prom.toFixed(3),
        kind: 'atom',
        evidenceModel: MODEL
      };
    });

    return { row: row, hits: hits };
  }

  function mergeRows(baseRows, profileRows) {
    const profiled = Object.create(null);
    (Array.isArray(profileRows) ? profileRows : []).forEach(function (row) { if (row && row.element) profiled[String(row.element)] = row; });

    const rows = (Array.isArray(baseRows) ? baseRows : []).filter(function (row) {
      return row && row.element && !profiled[String(row.element)];
    }).map(function (row) { return Object.assign({}, row); });

    Object.keys(profiled).forEach(function (key) { rows.push(Object.assign({}, profiled[key])); });
    rows.sort(function (a, b) {
      return (Number(b && b.totalScore || 0) - Number(a && a.totalScore || 0)) ||
        (Number(b && b.diagnosticMatchedPeaks || b && b.matchedPeaks || 0) - Number(a && a.diagnosticMatchedPeaks || a && a.matchedPeaks || 0)) ||
        (Number(a && a.medianDeltaNm || 99) - Number(b && b.medianDeltaNm || 99));
    });

    const top = rows.filter(function (row) { return Number(row && row.totalScore) > 0; }).slice(0, 8);
    const scoreSum = top.reduce(function (sum, row) { return sum + Math.max(0, Number(row && row.totalScore) || 0); }, 0) || 1;
    return top.map(function (row, index) {
      const share = Math.max(0, Math.round((Math.max(0, Number(row.totalScore) || 0) / scoreSum) * 100));
      return Object.assign({}, row, { rank: index + 1, likelyPct: share, scoreSharePct: share });
    });
  }

  function dedupeHits(hits) {
    const seen = Object.create(null);
    return (Array.isArray(hits) ? hits : []).filter(function (hit) {
      const ref = Number(hit && hit.referenceNm);
      const obs = Number(hit && hit.observedNm);
      const key = String(hit && hit.element || '') + '|' + (Number.isFinite(ref) ? ref.toFixed(2) : '?') + '|' + (Number.isFinite(obs) ? obs.toFixed(2) : '?');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function buildWinnerBreakdown(presetId, rows) {
    const winner = rows && rows[0];
    if (!winner) return null;
    const summary = {
      preset: presetId,
      primaryEmitter: String(winner.element || ''),
      primaryLikelyPct: Number(winner.scoreSharePct != null ? winner.scoreSharePct : winner.likelyPct) || 0,
      explainedPeaksPct: Number(winner.explainedPeaksPct) || 0,
      explainedIntensityPct: Number(winner.explainedIntensityPct) || 0,
      expectedFound: Array.isArray(winner.supportLines) ? winner.supportLines.slice(0, 12) : [],
      expectedMissed: Number(winner.missedStrong) || 0,
      secondaryContributors: [],
      backgroundComponents: [],
      possibleBands: [],
      scoreSemantics: 'relative-score-share',
      evidenceModel: winner.evidenceModel || null
    };
    (rows || []).slice(1, 5).forEach(function (row) {
      const item = {
        element: String(row.element || '?'),
        likelyPct: Number(row.scoreSharePct != null ? row.scoreSharePct : row.likelyPct) || 0,
        explainedIntensityPct: Number(row.explainedIntensityPct) || 0,
        explainedPeaksPct: Number(row.explainedPeaksPct) || 0
      };
      if (String(row.mode || '') === 'molecular') summary.possibleBands.push(item);
      else summary.secondaryContributors.push(item);
    });
    return summary;
  }

  function enhance(out, frame, state, options) {
    if (!catalog || !out || !out.ok || !out.calibrated) return out;
    const profiles = catalog.getForPreset(out.presetId);
    if (!profiles.length) return out;

    const peaks = Array.isArray(out.peaks) ? out.peaks : [];
    if (!peaks.length) return out;
    const range = observedRange(frame, peaks);
    const scoredRows = [];
    const profileHits = [];

    profiles.forEach(function (profile) {
      const scored = scoreProfile(profile, peaks, out.maxDistanceNm, range);
      if (!scored || !scored.row) return;
      scoredRows.push(scored.row);
      Array.prototype.push.apply(profileHits, scored.hits || []);
    });

    if (!scoredRows.length) return out;

    const merged = mergeRows(out.elementScores, scoredRows);
    out.elementScores = merged;
    out.winnerBreakdown = buildWinnerBreakdown(out.presetId, merged);
    out.scoreSemantics = 'relative-score-share';
    out.atomicEvidenceModel = MODEL;

    out.overlayHits = dedupeHits((out.overlayHits || []).concat(profileHits)).slice(0, 180);
    const topElements = Object.create(null);
    merged.slice(0, 3).forEach(function (row) { topElements[String(row.element || '')] = true; });
    out.topHits = dedupeHits((out.topHits || []).concat(profileHits)).filter(function (hit) {
      return topElements[String(hit && hit.element || '')];
    }).sort(function (a, b) {
      const ra = merged.findIndex(function (row) { return String(row.element || '') === String(a.element || ''); });
      const rb = merged.findIndex(function (row) { return String(row.element || '') === String(b.element || ''); });
      return (ra - rb) || (Number(b.confidence || 0) - Number(a.confidence || 0));
    }).slice(0, 96);

    return out;
  }

  root.SPECTRA_PRO_atomicEvidence = {
    version: MODEL,
    enhance: enhance,
    scoreProfile: scoreProfile
  };
})(typeof self !== 'undefined' ? self : this);
