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

  function bestSignatureAlignment(peaks, signatureNm, toleranceNm) {
    const tol = Math.max(0.5, Number(toleranceNm) || 1.8);
    const arr = Array.isArray(peaks) ? peaks : [];
    const sig = Array.isArray(signatureNm) ? signatureNm.map(Number).filter(Number.isFinite) : [];
    let best = { count: 0, offset: 0, matched: [] };
    if (!arr.length || !sig.length) return best;
    for (let i = 0; i < arr.length; i += 1) {
      const obs = Number(arr[i] && arr[i].nm);
      if (!Number.isFinite(obs)) continue;
      for (let j = 0; j < sig.length; j += 1) {
        const ref = sig[j];
        const offset = obs - ref;
        const matched = [];
        let count = 0;
        for (let k = 0; k < sig.length; k += 1) {
          const target = sig[k] + offset;
          let found = null;
          for (let m = 0; m < arr.length; m += 1) {
            const nm = Number(arr[m] && arr[m].nm);
            if (!Number.isFinite(nm)) continue;
            const d = Math.abs(nm - target);
            if (d <= tol && (!found || d < found.delta)) found = { peak: arr[m], delta: d, refNm: sig[k] };
          }
          if (found) {
            count += 1;
            matched.push(found);
          }
        }
        if (count > best.count || (count === best.count && matched.length && matched.reduce(function(a,b){return a + (b.delta || 0);},0) < best.matched.reduce(function(a,b){return a + (b.delta || 0);},0))) {
          best = { count: count, offset: +offset.toFixed(3), matched: matched };
        }
      }
    }
    return best;
  }

  function buildSeededMatches(peaks, atomLines, elementKey, signatureNm, toleranceNm, boost, offsetNm) {
    const out = [];
    const tol = Math.max(0.5, Number(toleranceNm) || 1.8);
    const shift = Number(offsetNm) || 0;
    const lines = Array.isArray(atomLines) ? atomLines : [];
    const seen = Object.create(null);
    for (let i = 0; i < signatureNm.length; i += 1) {
      const targetRef = Number(signatureNm[i]);
      if (!Number.isFinite(targetRef)) continue;
      const targetObs = targetRef + shift;
      let bestPeak = null;
      for (let j = 0; j < peaks.length; j += 1) {
        const p = peaks[j];
        const nm = Number(p && p.nm);
        if (!Number.isFinite(nm)) continue;
        const d = Math.abs(nm - targetObs);
        if (d > tol) continue;
        if (!bestPeak || d < bestPeak.d || (+p.prominence || 0) > (+bestPeak.p.prominence || 0)) bestPeak = { p: p, d: d };
      }
      if (!bestPeak) continue;
      let bestLine = null;
      for (let j = 0; j < lines.length; j += 1) {
        const l = lines[j];
        if (String(l.element || '') !== String(elementKey || '')) continue;
        const d = Math.abs((+l.nm || 0) - targetRef);
        if (d > 0.35) continue;
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
        rawScore: Math.max(0.9, 1 - (bestPeak.d / tol)) + boost,
        element: String(elementKey || '')
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
        preferredElements: ['He', 'Hg', 'Ne', 'Ar', 'H', 'Na', 'Kr', 'Xe', 'O'],
        elementBoost: { He: 0.06, Hg: 0.05, Ne: 0.04, Ar: 0.04, H: 0.035, Na: 0.03, Kr: 0.025, Xe: 0.025, O: 0.02 }
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
      const profiles = {
        He: [447.148, 492.193, 501.568, 587.562, 667.815, 706.519],
        Hg: [404.656, 435.833, 546.074, 576.960, 579.066],
        Ne: [540.056, 585.249, 614.306, 640.225, 703.241],
        H: [410.171, 434.047, 486.128, 656.281],
        Ar: [696.543, 706.722, 738.398, 750.387, 763.511, 772.376],
        Na: [588.995, 589.592]
      };
      const smartTol = presetId === 'smart' ? 2.4 : 2.2;
      const ranked = Object.keys(profiles).map(function (el) {
        const align = bestSignatureAlignment(peaks, profiles[el], smartTol);
        return {
          element: el,
          count: align.count,
          offset: align.offset,
          matched: align.matched,
          score: align.count * 10 - Math.min(6, Math.abs(align.offset || 0)) * 0.35 + (el === 'He' ? 1.2 : 0)
        };
      }).sort(function (a, b) {
        return (b.score - a.score) || (b.count - a.count) || (Math.abs(a.offset || 0) - Math.abs(b.offset || 0));
      });

      if (presetId === 'smart') {
        ranked.slice(0, 3).forEach(function (cand, idx) {
          if (!cand || cand.count < (idx === 0 ? 2 : 1)) return;
          const extra = cand.count >= 3 ? 0.22 : (cand.count >= 2 ? 0.14 : 0.06);
          effectiveBoost = Object.assign({}, effectiveBoost || {}, { [cand.element]: (Number((effectiveBoost || {})[cand.element]) || 0) + extra });
          if (cand.count >= 2) {
            seededMatches = seededMatches.concat(buildSeededMatches(peaks, state && state.atomLines || [], cand.element, profiles[cand.element], smartTol, extra, cand.offset));
          }
        });
      }

      const hgAlign = bestSignatureAlignment(peaks, profiles.Hg, presetId === 'smart' ? 1.8 : 2.2);
      if (presetId === 'smart' && hgAlign.count >= 3) {
        effectiveBoost = Object.assign({}, effectiveBoost || {}, { Hg: 0.38, Ar: 0.08, Ne: 0.07, Kr: 0.06, Xe: 0.06 });
      } else if (presetId === 'lamp-hg' && hgAlign.count >= 2) {
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
