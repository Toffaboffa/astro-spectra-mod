(function (root) {
  'use strict';
  function inferPeaks(frame, peaks){
    const nm = frame && Array.isArray(frame.nm) ? frame.nm : null;
    return (Array.isArray(peaks)?peaks:[]).map(function(p){
      const idx = Number(p.index);
      const out = Object.assign({}, p);
      if (nm && Number.isInteger(idx) && idx >= 0 && idx < nm.length && Number.isFinite(nm[idx])) out.nm = nm[idx];
      return out;
    });
  }

  function countSignatureHits(peaks, signatureNm, toleranceNm) {
    const tol = Math.max(0.35, Number(toleranceNm) || 1.5);
    const arr = Array.isArray(peaks) ? peaks : [];
    let count = 0;
    for (let i = 0; i < signatureNm.length; i += 1) {
      const target = Number(signatureNm[i]);
      if (!Number.isFinite(target)) continue;
      let found = false;
      for (let j = 0; j < arr.length; j += 1) {
        const nm = Number(arr[j] && arr[j].nm);
        if (Number.isFinite(nm) && Math.abs(nm - target) <= tol) { found = true; break; }
      }
      if (found) count += 1;
    }
    return count;
  }

  function buildSeededMatches(peaks, atomLines, signatureNm, toleranceNm, boost) {
    const out = [];
    const tol = Math.max(0.35, Number(toleranceNm) || 1.5);
    const lines = Array.isArray(atomLines) ? atomLines : [];
    const seen = Object.create(null);
    for (let i = 0; i < signatureNm.length; i += 1) {
      const target = Number(signatureNm[i]);
      if (!Number.isFinite(target)) continue;
      let bestPeak = null;
      for (let j = 0; j < peaks.length; j += 1) {
        const p = peaks[j];
        const nm = Number(p && p.nm);
        if (!Number.isFinite(nm)) continue;
        const d = Math.abs(nm - target);
        if (d > tol) continue;
        if (!bestPeak || d < bestPeak.d || (+p.prominence || 0) > (+bestPeak.p.prominence || 0)) bestPeak = { p: p, d: d };
      }
      if (!bestPeak) continue;
      let bestLine = null;
      for (let j = 0; j < lines.length; j += 1) {
        const l = lines[j];
        if (String(l.element || '') !== 'Hg') continue;
        const d = Math.abs((+l.nm || 0) - target);
        if (d > 0.25) continue;
        if (!bestLine || d < bestLine.d) bestLine = { l: l, d: d };
      }
      if (!bestLine) continue;
      const key = String(bestLine.l.speciesKey || bestLine.l.species || '') + '|' + Number(bestLine.l.nm).toFixed(3);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        species: bestLine.l.species,
        speciesKey: bestLine.l.speciesKey || bestLine.l.species,
        refNm: bestLine.l.nm,
        obsNm: bestPeak.p.nm,
        deltaNm: +(bestPeak.p.nm - bestLine.l.nm).toFixed(3),
        peakIndex: bestPeak.p.index,
        peakValue: bestPeak.p.value,
        prominence: bestPeak.p.prominence || 0,
        rawScore: Math.max(0.92, 1 - (bestPeak.d / tol)) + boost,
        element: 'Hg'
      });
    }
    return out;
  }

  function estimateOffset(matches){
    if (!Array.isArray(matches) || !matches.length) return null;
    const vals = matches.map(m => Number(m.deltaNm)).filter(Number.isFinite);
    if (!vals.length) return null;
    vals.sort((a,b)=>a-b);
    return vals[Math.floor(vals.length/2)];
  }
  function analyzeFrame(frame, state, options) {
    const peakDetect = root.SPECTRA_PRO_peakDetect;
    const peakScoring = root.SPECTRA_PRO_peakScoring;
    const qcRules = root.SPECTRA_PRO_qcRules;
    const confidenceModel = root.SPECTRA_PRO_confidenceModel;
    const lineMatcher = root.SPECTRA_PRO_lineMatcher;
    const I = frame && Array.isArray(frame.processedI)
      ? frame.processedI
      : (frame && Array.isArray(frame.I) ? frame.I : []);

    const presetId = (state && state.activePreset) ? String(state.activePreset) : '';
    const presetMap = {
      'general': { toleranceNm: 3.0, maxMatches: 10, maxPerPeak: 2 },
      'general-tight': { toleranceNm: 1.5, maxMatches: 10, maxPerPeak: 2 },
      'general-wide': { toleranceNm: 5.0, maxMatches: 12, maxPerPeak: 3 },
      'fast': { toleranceNm: 3.0, maxMatches: 8, maxPerPeak: 1 },
      'lamp-hg': {
        toleranceNm: 2.8,
        maxMatches: 18,
        maxPerPeak: 3,
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        elementBoost: { Hg: 0.12, Ar: 0.06, Ne: 0.06, Kr: 0.05, Xe: 0.05 }
      },
      'smart': {
        toleranceNm: 2.2,
        maxMatches: 18,
        maxPerPeak: 3,
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        elementBoost: { Hg: 0.05, Ar: 0.04, Ne: 0.04, Kr: 0.03, Xe: 0.03 }
      }
    };
    const preset = presetMap[presetId] || presetMap['general'];

    const opt = (options && typeof options === 'object') ? options : {};
    const includeWeak = !!opt.includeWeakPeaks;
    const peakThresholdRel = Number.isFinite(Number(opt.peakThresholdRel)) ? Number(opt.peakThresholdRel) : (includeWeak ? 0.02 : 0.05);
    const peakDistancePx = Number.isFinite(Number(opt.peakDistancePx)) ? Number(opt.peakDistancePx) : (includeWeak ? 3 : 5);

    const rawPeaks = peakDetect.detectPeaks(I, { prominenceWindowPx: Math.max(4, peakDistancePx * 2) });
    const peaks = inferPeaks(
      frame,
      peakScoring.scorePeaks(rawPeaks, {
        maxPeaks: includeWeak ? 96 : 56,
        minRelHeight: Math.max(0.003, Math.min(0.95, peakThresholdRel)),
        minPeakDistancePx: Math.max(1, Math.min(64, Math.round(peakDistancePx)))
      })
    );
    const nmAvailable = !!(frame && frame.calibrated && Array.isArray(frame.nm));
    let effectiveBoost = Object.assign({}, preset.elementBoost || null);
    let seededMatches = [];
    if ((presetId === 'smart' || presetId === 'lamp-hg') && nmAvailable) {
      const hgSignatures = [404.656, 435.833, 546.074, 576.960, 579.066];
      const hgCount = countSignatureHits(peaks, hgSignatures, presetId === 'smart' ? 1.6 : 2.2);
      if (presetId === 'smart' && hgCount >= 3) {
        effectiveBoost = Object.assign({}, effectiveBoost || {}, { Hg: 0.38, Ar: 0.08, Ne: 0.07, Kr: 0.06, Xe: 0.06 });
        seededMatches = buildSeededMatches(peaks, state && state.atomLines || [], hgSignatures, 1.6, 0.18);
      } else if (presetId === 'lamp-hg' && hgCount >= 2) {
        effectiveBoost = Object.assign({}, effectiveBoost || {}, { Hg: 0.18, Ar: 0.08, Ne: 0.08, Kr: 0.06, Xe: 0.06 });
      }
    }
    const matches = nmAvailable
      ? lineMatcher.matchLines(peaks, state && state.atomLines || [], {
          toleranceNm: preset.toleranceNm,
          maxMatches: preset.maxMatches,
          preferredElements: preset.preferredElements || null,
          elementBoost: effectiveBoost || null,
          maxPerPeak: preset.maxPerPeak || 2,
          seededMatches: seededMatches
        })
      : [];
    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    if (!nmAvailable) qc.flags = (qc.flags || []).concat(['uncalibrated']);
    const confidence = confidenceModel.buildConfidence(matches, qc);

    let maxPeak = 0;
    for (let i = 0; i < peaks.length; i += 1) {
      const v = +peaks[i].prominence || +peaks[i].value || 0;
      if (v > maxPeak) maxPeak = v;
    }
    if (!Number.isFinite(maxPeak) || maxPeak <= 0) maxPeak = 1;

    const topHits = matches.map(function(m){
      const closeness = Math.max(0, Math.min(1.2, +m.rawScore || 0));
      const strength = Math.max(0, Math.min(1, ((+m.prominence || +m.peakValue || 0) / maxPeak)));
      const base = (0.7 * Math.min(1, closeness)) + (0.3 * strength);
      const conf = Math.max(0, Math.min(1, (0.14 + 0.86 * base) * (+confidence.qcFactor || +confidence.overall || 0)));
      return {
        species: m.species,
        element: (m.element || (m.speciesKey || m.species || '').replace(/[^A-Za-z]/g,'').slice(0,2)),
        referenceNm: m.refNm,
        observedNm: m.obsNm,
        deltaNm: m.deltaNm,
        confidence: +conf.toFixed(3),
        score: +((m.rawScore || 0) * 100).toFixed(1)
      };
    });
    return {
      ok: true,
      topHits: topHits,
      peaks: peaks.slice(0, 32),
      offsetNm: estimateOffset(matches),
      qcFlags: qc.flags || [],
      confidence: confidence.overall || 0,
      librariesLoaded: !!(state && state.librariesLoaded),
      calibrated: !!nmAvailable
    };
  }
  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame };
})(typeof self !== 'undefined' ? self : this);
