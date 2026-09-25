(function (root) {
  'use strict';

  const MODEL = 'broadband-fluorescence-v1';
  const spectrumMath = root.SPECTRA_PRO_spectrumMath;
  if (!spectrumMath) return;
  const clamp = spectrumMath.clamp;
  const matchOffsetNm = spectrumMath.matchOffsetNm;

  function finitePairs(frame) {
    if (!frame || !Array.isArray(frame.nm)) return [];
    const source = Array.isArray(frame.processedI) && frame.processedI.length === frame.nm.length
      ? frame.processedI
      : (Array.isArray(frame.I) ? frame.I : []);
    const n = Math.min(frame.nm.length, source.length);
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const x = Number(frame.nm[i]);
      const y = Number(source[i]);
      if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x: x, y: y });
    }
    return out;
  }

  function smooth(values, radius) {
    const arr = Array.isArray(values) ? values : [];
    const r = Math.max(1, Math.floor(Number(radius) || 1));
    if (!arr.length) return [];
    const prefix = [0];
    for (let i = 0; i < arr.length; i += 1) prefix.push(prefix[prefix.length - 1] + arr[i]);
    return arr.map(function (_, i) {
      const lo = Math.max(0, i - r);
      const hi = Math.min(arr.length - 1, i + r);
      return (prefix[hi + 1] - prefix[lo]) / Math.max(1, hi - lo + 1);
    });
  }

  function percentile(values, p) {
    const arr = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!arr.length) return 0;
    const idx = clamp((Number(p) || 0) / 100, 0, 1) * (arr.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx), t = idx - lo;
    return arr[lo] * (1 - t) + arr[hi] * t;
  }

  function crossing(xs, ys, start, dir, level) {
    let i = start;
    while (i + dir >= 0 && i + dir < ys.length) {
      const j = i + dir;
      const a = ys[i] - level;
      const b = ys[j] - level;
      if ((a >= 0 && b <= 0) || (a <= 0 && b >= 0)) {
        const denom = ys[j] - ys[i];
        const t = Math.abs(denom) > 1e-12 ? (level - ys[i]) / denom : 0;
        return xs[i] + (xs[j] - xs[i]) * clamp(t, 0, 1);
      }
      i = j;
    }
    return null;
  }

  function trapezoid(xs, ys, lo, hi) {
    let sum = 0;
    for (let i = 1; i < xs.length; i += 1) {
      if (xs[i] < lo || xs[i - 1] > hi) continue;
      const x0 = Math.max(lo, xs[i - 1]);
      const x1 = Math.min(hi, xs[i]);
      if (!(x1 > x0)) continue;
      sum += (x1 - x0) * (ys[i - 1] + ys[i]) * 0.5;
    }
    return sum;
  }

  function findShoulders(xs, ys, mainIndex, bandLo, bandHi, peak, fwhm) {
    const minSep = Math.max(10, Number(fwhm) > 0 ? Number(fwhm) * 0.22 : 10);
    const minHeight = Math.max(peak * 0.12, 1e-9);
    const candidates = [];
    for (let i = 2; i < ys.length - 2; i += 1) {
      if (i === mainIndex || xs[i] < bandLo || xs[i] > bandHi) continue;
      if (ys[i] < minHeight) continue;
      if (!(ys[i] >= ys[i - 1] && ys[i] >= ys[i + 1] && ys[i] > ys[i - 2] && ys[i] > ys[i + 2])) continue;
      const sep = Math.abs(xs[i] - xs[mainIndex]);
      if (sep < minSep) continue;
      const localFloor = Math.max(Math.min(ys[i - 2], ys[i + 2]), 0);
      const prominence = ys[i] - localFloor;
      if (prominence < peak * 0.035) continue;
      candidates.push({ nm: xs[i], relativeHeight: ys[i] / peak, prominence: prominence / peak });
    }
    candidates.sort(function (a, b) { return (b.relativeHeight - a.relativeHeight) || (a.nm - b.nm); });
    const selected = [];
    candidates.forEach(function (c) {
      if (selected.length >= 3) return;
      if (selected.some(function (s) { return Math.abs(s.nm - c.nm) < minSep * 0.65; })) return;
      selected.push({ nm: +c.nm.toFixed(2), relativeHeight: +c.relativeHeight.toFixed(3) });
    });
    return selected;
  }

  function summarize(frame) {
    const pairs = finitePairs(frame);
    if (pairs.length < 8) return null;
    const xs = pairs.map(function (p) { return p.x; });
    const raw = pairs.map(function (p) { return p.y; });

    let step = 0;
    for (let i = 1; i < xs.length; i += 1) {
      const d = xs[i] - xs[i - 1];
      if (Number.isFinite(d) && d > 0) step += d;
    }
    step = step / Math.max(1, xs.length - 1);
    const radius = clamp(Math.round(2.5 / Math.max(0.05, step)), 2, 12);
    const smoothed = smooth(raw, radius);
    const baseline = percentile(smoothed, 8);
    const corrected = smoothed.map(function (v) { return Math.max(0, v - baseline); });
    const peak = Math.max.apply(null, corrected);
    if (!(peak > 0)) return null;

    let mainIndex = 0;
    corrected.forEach(function (v, i) { if (v > corrected[mainIndex]) mainIndex = i; });
    const lambdaMax = xs[mainIndex];

    const ten = peak * 0.10;
    const half = peak * 0.50;
    const bandLeft = crossing(xs, corrected, mainIndex, -1, ten);
    const bandRight = crossing(xs, corrected, mainIndex, 1, ten);
    const halfLeft = crossing(xs, corrected, mainIndex, -1, half);
    const halfRight = crossing(xs, corrected, mainIndex, 1, half);
    const lo = Number.isFinite(bandLeft) ? bandLeft : xs[0];
    const hi = Number.isFinite(bandRight) ? bandRight : xs[xs.length - 1];

    let weighted = 0, weight = 0;
    for (let i = 0; i < xs.length; i += 1) {
      if (xs[i] < lo || xs[i] > hi) continue;
      const w = corrected[i];
      weighted += xs[i] * w;
      weight += w;
    }
    const centroid = weight > 0 ? weighted / weight : lambdaMax;
    const fwhm = Number.isFinite(halfLeft) && Number.isFinite(halfRight) ? Math.max(0, halfRight - halfLeft) : null;
    const leftWidth = lambdaMax - lo;
    const rightWidth = hi - lambdaMax;
    const asymmetryRatio = leftWidth > 0 ? rightWidth / leftWidth : null;
    let asymmetry = 'balanced';
    if (Number.isFinite(asymmetryRatio)) {
      if (asymmetryRatio > 1.22) asymmetry = 'red-tailed';
      else if (asymmetryRatio < 0.82) asymmetry = 'blue-tailed';
    }

    const shoulders = findShoulders(xs, corrected, mainIndex, lo, hi, peak, fwhm);
    const integrated = trapezoid(xs, corrected, lo, hi);
    const broad = Number.isFinite(fwhm) ? fwhm >= 12 : (hi - lo) >= 20;

    return {
      model: MODEL,
      spectrumType: broad ? 'broadband-fluorescence' : 'mixed-or-narrow-emission',
      broadbandDetected: broad,
      lambdaMaxNm: +lambdaMax.toFixed(2),
      centroidNm: +centroid.toFixed(2),
      fwhmNm: Number.isFinite(fwhm) ? +fwhm.toFixed(2) : null,
      bandMinNm: +lo.toFixed(2),
      bandMaxNm: +hi.toFixed(2),
      bandWidthNm: +(hi - lo).toFixed(2),
      asymmetry: asymmetry,
      asymmetryRatio: Number.isFinite(asymmetryRatio) ? +asymmetryRatio.toFixed(3) : null,
      shoulders: shoulders,
      integratedIntensity: +integrated.toFixed(2),
      peakIntensity: +peak.toFixed(3),
      baselineIntensity: +baseline.toFixed(3),
      smoothingWindowNm: +(radius * 2 * step + step).toFixed(2)
    };
  }

  function compactHit(hit) {
    return {
      species: hit && (hit.species || hit.speciesKey || hit.element || ''),
      speciesKey: hit && (hit.speciesKey || hit.species || hit.element || ''),
      element: hit && hit.element || null,
      observedNm: Number.isFinite(Number(hit && (hit.observedNm != null ? hit.observedNm : hit.obsNm))) ? +(Number(hit.observedNm != null ? hit.observedNm : hit.obsNm).toFixed(3)) : null,
      referenceNm: Number.isFinite(Number(hit && (hit.referenceNm != null ? hit.referenceNm : hit.refNm))) ? +(Number(hit.referenceNm != null ? hit.referenceNm : hit.refNm).toFixed(3)) : null,
      deltaNm: Number.isFinite(Number(hit && hit.deltaNm)) ? +(Number(hit.deltaNm).toFixed(3)) : null,
      peakIndex: Number.isFinite(Number(hit && hit.peakIndex)) ? Number(hit.peakIndex) : null,
      confidence: Number.isFinite(Number(hit && hit.confidence)) ? +(Number(hit.confidence).toFixed(3)) : null,
      score: Number.isFinite(Number(hit && hit.score)) ? +(Number(hit.score).toFixed(1)) : null,
      prominence: Number.isFinite(Number(hit && hit.prominence)) ? +(Number(hit.prominence).toFixed(3)) : null,
      kind: hit && hit.kind || 'atom',
      evidenceModel: hit && hit.evidenceModel || null,
      excludedByDiffraction: !!(hit && hit.excludedByDiffraction)
    };
  }

  function compactNarrowHits(out) {
    const source = Array.isArray(out && out.overlayHits) && out.overlayHits.length
      ? out.overlayHits
      : (Array.isArray(out && out.topHits) ? out.topHits : []);
    return source.slice(0, 80).map(compactHit);
  }

  function buildClearNarrowEvidence(out) {
    const rows = Array.isArray(out && out.elementScores) ? out.elementScores : [];
    const eligible = Object.create(null);
    const groups = [];

    rows.forEach(function (row) {
      const element = String(row && row.element || '').trim();
      const matched = Math.max(
        Number(row && row.matchedCount) || 0,
        Number(row && row.matchedPeaks) || 0,
        Number(row && row.matchCount) || 0
      );
      const diagnosticMatched = Number(row && row.diagnosticMatchedPeaks) || 0;
      const fingerprintScore = Number(row && row.fingerprintScore) || 0;
      if (!element || matched < 2 || diagnosticMatched < 2 || fingerprintScore < 35) return;
      eligible[element] = groups.length;
      groups.push({
        element: element,
        matchedCount: matched,
        diagnosticMatchedPeaks: diagnosticMatched,
        diagnosticExpected: Number(row && row.diagnosticExpected) || 0,
        fingerprintScore: +fingerprintScore.toFixed(1),
        patternCoveragePct: Number.isFinite(Number(row && row.patternCoveragePct)) ? +(Number(row.patternCoveragePct).toFixed(1)) : null,
        supportLines: Array.isArray(row && row.supportLines) ? row.supportLines.slice(0, 12) : []
      });
    });

    const source = [];
    if (Array.isArray(out && out.topHits)) Array.prototype.push.apply(source, out.topHits);
    if (Array.isArray(out && out.overlayHits)) Array.prototype.push.apply(source, out.overlayHits);

    const seen = Object.create(null);
    const hits = [];
    source.forEach(function (hit) {
      if (!hit || hit.excludedByDiffraction) return;
      if (String(hit.kind || 'atom') !== 'atom') return;
      const element = String(hit.element || '').trim();
      if (!Object.prototype.hasOwnProperty.call(eligible, element)) return;
      // Only atomic-profile evidence is promoted automatically in Fluorescent mode.
      // Raw nearest-line coincidences remain available through the optional overlay.
      if (!hit.evidenceModel) return;
      const compact = compactHit(hit);
      if (!Number.isFinite(Number(compact.observedNm)) || !Number.isFinite(Number(compact.referenceNm))) return;
      const key = element + '|' + Number(compact.referenceNm).toFixed(3) + '|' + Number(compact.observedNm).toFixed(3);
      if (seen[key]) return;
      seen[key] = true;
      hits.push(compact);
    });

    hits.sort(function (a, b) {
      const ra = Object.prototype.hasOwnProperty.call(eligible, String(a.element || '')) ? eligible[String(a.element || '')] : 999;
      const rb = Object.prototype.hasOwnProperty.call(eligible, String(b.element || '')) ? eligible[String(b.element || '')] : 999;
      return (ra - rb) ||
        (Number(b.confidence || 0) - Number(a.confidence || 0)) ||
        (Number(a.observedNm || 0) - Number(b.observedNm || 0));
    });

    return {
      model: out && out.atomicEvidenceModel || null,
      groups: groups.slice(0, 3),
      hits: hits.slice(0, 24)
    };
  }

  function enhance(out, frame) {
    if (!out || !out.ok || String(out.presetId || '') !== 'smart-fluorescent') return out;
    const summary = summarize(frame);
    if (!summary) {
      out.narrowLineCandidates = [];
      out.clearNarrowLineHits = [];
      out.fluorescenceLineEvidence = null;
      out.fluorescenceSummary = null;
      out.elementScores = [];
      out.winnerBreakdown = null;
      out.topHits = [];
      out.overlayHits = [];
      out.offsetNm = null;
      out.offsetBasis = 'clear-narrow-line-hits';
      out.atomicEvidenceModel = null;
      return out;
    }

    const narrowCandidates = compactNarrowHits(out);
    const lineEvidence = buildClearNarrowEvidence(out);

    out.narrowLineCandidates = narrowCandidates;
    out.clearNarrowLineHits = lineEvidence.hits.slice();
    out.fluorescenceLineEvidence = {
      model: lineEvidence.model,
      hitCount: lineEvidence.hits.length,
      groups: lineEvidence.groups.slice()
    };
    out.fluorescenceSummary = summary;
    out.spectrumType = summary.spectrumType;
    out.scoreSemantics = 'broadband-fluorescence-shape';
    out.elementScores = [];
    out.winnerBreakdown = null;
    // Coherent narrow-line matches remain visible/clickable as secondary evidence.
    // The broader raw coincidence set stays in narrowLineCandidates and is opt-in.
    out.topHits = lineEvidence.hits.slice();
    out.overlayHits = lineEvidence.hits.slice();
    out.offsetNm = typeof matchOffsetNm === 'function' ? matchOffsetNm(lineEvidence.hits) : null;
    out.offsetBasis = 'clear-narrow-line-hits';
    out.atomicEvidenceModel = lineEvidence.model;
    return out;
  }

  root.SPECTRA_PRO_fluorescenceAnalysis = {
    model: MODEL,
    summarize: summarize,
    enhance: enhance
  };
})(typeof self !== 'undefined' ? self : this);
