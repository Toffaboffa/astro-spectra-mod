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
    const tol = Math.max(0.4, Number(toleranceNm) || 1.5);
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
    // Prefer processedI when the UI runs subtraction/ratio/absorbance pipelines.
    const I = frame && Array.isArray(frame.processedI)
      ? frame.processedI
      : (frame && Array.isArray(frame.I) ? frame.I : []);

    // Preset plumbing (Phase 2): simple preset ids (plus UI options) adjust
    // tolerance/maxMatches/element weighting without requiring external files yet.
    const presetId = (state && state.activePreset) ? String(state.activePreset) : '';
    const presetMap = {
      'general': { toleranceNm: 3.0, maxMatches: 8 },
      'general-tight': { toleranceNm: 1.5, maxMatches: 8 },
      'general-wide': { toleranceNm: 5.0, maxMatches: 10 },
      'fast': { toleranceNm: 3.0, maxMatches: 6 },
      // Fluorescent / typical discharge lamp weighting: prefer common gases/metals.
      'lamp-hg': {
        toleranceNm: 2.8,
        maxMatches: 14,
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        elementBoost: { Hg: 0.12, Ar: 0.07, Ne: 0.07, Kr: 0.06, Xe: 0.06 }
      },
      'smart': {
        toleranceNm: 2.2,
        maxMatches: 14,
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        elementBoost: { Hg: 0.16, Ar: 0.08, Ne: 0.08, Kr: 0.06, Xe: 0.06 }
      }
    };
    const preset = presetMap[presetId] || presetMap['general'];

    const opt = (options && typeof options === 'object') ? options : {};
    const includeWeak = !!opt.includeWeakPeaks;
    const peakThresholdRel = Number.isFinite(Number(opt.peakThresholdRel)) ? Number(opt.peakThresholdRel) : (includeWeak ? 0.02 : 0.05);
    const peakDistancePx = Number.isFinite(Number(opt.peakDistancePx)) ? Number(opt.peakDistancePx) : (includeWeak ? 3 : 5);

    const rawPeaks = peakDetect.detectPeaks(I);
    const peaks = inferPeaks(
      frame,
      peakScoring.scorePeaks(rawPeaks, {
        maxPeaks: includeWeak ? 80 : 40,
        minRelHeight: Math.max(0.005, Math.min(0.95, peakThresholdRel)),
        minPeakDistancePx: Math.max(1, Math.min(64, Math.round(peakDistancePx)))
      })
    );
    const nmAvailable = !!(frame && frame.calibrated && Array.isArray(frame.nm));
    let effectiveBoost = Object.assign({}, preset.elementBoost || null);
    if ((presetId === 'smart' || presetId === 'lamp-hg') && nmAvailable) {
      const hgSignatures = [404.656, 435.833, 546.074, 576.960, 579.066];
      const hgCount = countSignatureHits(peaks, hgSignatures, presetId === 'smart' ? 1.8 : 2.2);
      if (hgCount >= 3) {
        effectiveBoost = Object.assign({}, effectiveBoost || {}, { Hg: 0.35, Ar: 0.12, Ne: 0.10, Kr: 0.10, Xe: 0.10 });
      }
    }
    const matches = nmAvailable
      ? lineMatcher.matchLines(peaks, state && state.atomLines || [], {
          toleranceNm: preset.toleranceNm,
          maxMatches: preset.maxMatches,
          preferredElements: preset.preferredElements || null,
          elementBoost: effectiveBoost || null
        })
      : [];
    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    if (!nmAvailable) qc.flags = (qc.flags || []).concat(['uncalibrated']);
    const confidence = confidenceModel.buildConfidence(matches, qc);

    // Peak strength normalization for per-hit confidence.
    let maxPeak = 0;
    for (let i = 0; i < peaks.length; i += 1) {
      const v = +peaks[i].value || 0;
      if (v > maxPeak) maxPeak = v;
    }
    if (!Number.isFinite(maxPeak) || maxPeak <= 0) maxPeak = 1;

    const topHits = matches.map(function(m){
      // Combine distance-based score with peak strength, then apply QC factor.
      const closeness = Math.max(0, Math.min(1, +m.rawScore || 0));
      const strength = Math.max(0, Math.min(1, (+m.peakValue || 0) / maxPeak));
      // Give closeness more weight, but let strength break ties and push strong true lines upward.
      const base = (0.75 * closeness) + (0.25 * strength);
      // Small floor so good matches don't collapse to 1σ.
      const conf = Math.max(0, Math.min(1, (0.15 + 0.85 * base) * (+confidence.qcFactor || +confidence.overall || 0)));
      return {
        species: m.species,
        element: (m.speciesKey || m.species || '').replace(/[^A-Za-z]/g,'').slice(0,2),
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
      peaks: peaks.slice(0, 24),
      offsetNm: estimateOffset(matches),
      qcFlags: qc.flags || [],
      confidence: confidence.overall || 0,
      librariesLoaded: !!(state && state.librariesLoaded),
      calibrated: !!nmAvailable
    };
  }
  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame };
})(typeof self !== 'undefined' ? self : this);
