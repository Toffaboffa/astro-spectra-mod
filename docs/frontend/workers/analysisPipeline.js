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
        toleranceNm: 2.5,
        maxMatches: 10,
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        elementBoost: { Hg: 0.08, Ar: 0.05, Ne: 0.05, Kr: 0.04, Xe: 0.04 }
      }
    };
    const preset = presetMap[presetId] || presetMap['general'];

    const opt = (options && typeof options === 'object') ? options : {};
    const includeWeak = !!opt.includeWeakPeaks;

    const rawPeaks = peakDetect.detectPeaks(I);
    // Weak peaks matter for lamps (secondary Hg lines etc). When enabled, keep more peaks
    // and lower the relative height threshold.
    const peaks = inferPeaks(
      frame,
      peakScoring.scorePeaks(rawPeaks, { maxPeaks: includeWeak ? 64 : 32, minRelHeight: includeWeak ? 0.02 : 0.05 })
    );
    const nmAvailable = !!(frame && frame.calibrated && Array.isArray(frame.nm));
    const matches = nmAvailable
      ? lineMatcher.matchLines(peaks, state && state.atomLines || [], {
          toleranceNm: preset.toleranceNm,
          maxMatches: preset.maxMatches,
          preferredElements: preset.preferredElements || null,
          elementBoost: preset.elementBoost || null
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
