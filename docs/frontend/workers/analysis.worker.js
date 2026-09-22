importScripts(
  './workerTypes.js?v=3.0.0',
  './workerState.js?v=3.0.0',
  './libraryLoader.js?v=3.0.0',
  './libraryIndex.js?v=3.0.0',
  './libraryQuery.js?v=3.0.0',
  './peakDetect.js?v=3.0.0',
  './peakScoring.js?v=3.0.0',
  './lineMatcher.js?v=3.0.0',
  './qcRules.js?v=3.0.0',
  './confidenceModel.js?v=3.0.0',
  './spectrumMath.js?v=3.0.0',
  './presetResolver.js?v=3.0.0',
  './calibrationDiagnostics.js?v=3.0.0',
  './spectralFeatures.js?v=3.0.0',
  './measurementQuality.js?v=3.0.0',
  './candidateAnalysis.js?v=3.0.0',
  './astroReferences.js?v=3.0.0',
  './astroContinuum.js?v=3.0.0',
  './dopplerEstimate.js?v=3.0.0',
  './astroAnalysis.js?v=3.0.0',
  './stellarClassification.js?v=3.0.0',
  './referenceComparison.js?v=3.0.0',
  './analysisPipeline.js?v=3.0.0',
  './plasmaProfiles.js?v=3.0.0',
  './molecularEvidencePatch.js?v=3.0.0',
  './atomicProfiles.js?v=3.0.0',
  './atomicEvidence.js?v=3.0.0',
  './fluorescenceAnalysis.js?v=3.0.0',
  './workerRouter.js?v=3.0.0'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
