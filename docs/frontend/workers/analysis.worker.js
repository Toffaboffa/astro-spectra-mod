const WORKER_ASSET_VERSION = '1.4.1-analysis-1';

importScripts(
  './workerTypes.js?v=' + WORKER_ASSET_VERSION,
  './workerState.js?v=' + WORKER_ASSET_VERSION,
  './libraryLoader.js?v=' + WORKER_ASSET_VERSION,
  './libraryIndex.js?v=' + WORKER_ASSET_VERSION,
  './libraryQuery.js?v=' + WORKER_ASSET_VERSION,
  './peakDetect.js?v=' + WORKER_ASSET_VERSION,
  './peakScoring.js?v=' + WORKER_ASSET_VERSION,
  './lineMatcher.js?v=' + WORKER_ASSET_VERSION,
  './qcRules.js?v=' + WORKER_ASSET_VERSION,
  './confidenceModel.js?v=' + WORKER_ASSET_VERSION,
  './spectrumMath.js?v=' + WORKER_ASSET_VERSION,
  './presetResolver.js?v=' + WORKER_ASSET_VERSION,
  './calibrationDiagnostics.js?v=' + WORKER_ASSET_VERSION,
  './instrumentResolution.js?v=' + WORKER_ASSET_VERSION,
  './spectralFeatures.js?v=' + WORKER_ASSET_VERSION,
  './diffractionArtifacts.js?v=' + WORKER_ASSET_VERSION,
  './measurementQuality.js?v=' + WORKER_ASSET_VERSION,
  './candidateAnalysis.js?v=' + WORKER_ASSET_VERSION,
  './astroReferences.js?v=' + WORKER_ASSET_VERSION,
  './astroContinuum.js?v=' + WORKER_ASSET_VERSION,
  './dopplerEstimate.js?v=' + WORKER_ASSET_VERSION,
  './astroAnalysis.js?v=' + WORKER_ASSET_VERSION,
  './stellarClassification.js?v=' + WORKER_ASSET_VERSION,
  './referenceComparison.js?v=' + WORKER_ASSET_VERSION,
  './analysisPipeline.js?v=' + WORKER_ASSET_VERSION,
  './plasmaProfiles.js?v=' + WORKER_ASSET_VERSION,
  './molecularEvidencePatch.js?v=' + WORKER_ASSET_VERSION,
  './atomicProfiles.js?v=' + WORKER_ASSET_VERSION,
  './atomicEvidence.js?v=' + WORKER_ASSET_VERSION,
  './fluorescenceAnalysis.js?v=' + WORKER_ASSET_VERSION,
  './workerRouter.js?v=' + WORKER_ASSET_VERSION
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
