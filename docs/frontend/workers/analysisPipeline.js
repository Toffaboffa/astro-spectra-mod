
(function (root) {
  'use strict';
  function analyzeFrame(frame, state) {
    const peakDetect = root.SPECTRA_PRO_peakDetect;
    const peakScoring = root.SPECTRA_PRO_peakScoring;
    const qcRules = root.SPECTRA_PRO_qcRules;
    const confidenceModel = root.SPECTRA_PRO_confidenceModel;
    const peaks = peakDetect.detectPeaks(frame && frame.I || []);
    const scoredPeaks = peakScoring.scorePeaks(peaks);
    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    const confidence = confidenceModel.buildConfidence([], qc);
    return {
      ok: true,
      topHits: [],
      peaks: scoredPeaks.slice(0, 20),
      offsetNm: 0,
      qcFlags: qc.flags,
      confidence: confidence.overall
    };
  }
  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame };
})(typeof self !== 'undefined' ? self : this);
