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
  function analyzeFrame(frame, state) {
    const peakDetect = root.SPECTRA_PRO_peakDetect;
    const peakScoring = root.SPECTRA_PRO_peakScoring;
    const qcRules = root.SPECTRA_PRO_qcRules;
    const confidenceModel = root.SPECTRA_PRO_confidenceModel;
    const lineMatcher = root.SPECTRA_PRO_lineMatcher;
    // Prefer processedI when the UI runs subtraction/ratio/absorbance pipelines.
    const I = frame && Array.isArray(frame.processedI)
      ? frame.processedI
      : (frame && Array.isArray(frame.I) ? frame.I : []);

    // Preset plumbing (Phase 2): worker accepts simple preset ids that adjust
    // tolerance/maxMatches without requiring external preset files yet.
    const presetId = (state && state.activePreset) ? String(state.activePreset) : '';
    const presetMap = {
      'general': { toleranceNm: 3.0, maxMatches: 8 },
      'general-tight': { toleranceNm: 1.5, maxMatches: 8 },
      'general-wide': { toleranceNm: 5.0, maxMatches: 10 },
      'fast': { toleranceNm: 3.0, maxMatches: 6 }
    };
    const preset = presetMap[presetId] || presetMap['general'];

    const peaks = inferPeaks(frame, peakScoring.scorePeaks(peakDetect.detectPeaks(I)));
    const nmAvailable = !!(frame && frame.calibrated && Array.isArray(frame.nm));
    const matches = nmAvailable
      ? lineMatcher.matchLines(peaks, state && state.atomLines || [], { toleranceNm: preset.toleranceNm, maxMatches: preset.maxMatches })
      : [];
    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    if (!nmAvailable) qc.flags = (qc.flags || []).concat(['uncalibrated']);
    const confidence = confidenceModel.buildConfidence(matches, qc);
    const topHits = matches.map(function(m){
      const conf = Math.max(0, Math.min(1, (m.rawScore || 0) * (confidence.overall || 0)));
      return {
        species: m.species,
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
