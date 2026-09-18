importScripts(
  './workerTypes.js?v=2.2.9',
  './workerState.js?v=2.2.9',
  './libraryLoader.js?v=2.2.9',
  './libraryIndex.js?v=2.2.9',
  './libraryQuery.js?v=2.2.9',
  './peakDetect.js?v=2.2.9',
  './peakScoring.js?v=2.2.9',
  './lineMatcher.js?v=2.2.9',
  './qcRules.js?v=2.2.9',
  './confidenceModel.js?v=2.2.9',
  './analysisPipeline.js?v=2.2.9',
  './plasmaProfiles.js?v=2.2.9',
  './molecularEvidencePatch.js?v=2.2.9',
  './atomicProfiles.js?v=2.2.9',
  './atomicEvidence.js?v=2.2.9',
  './fluorescenceAnalysis.js?v=2.2.9',
  './workerRouter.js?v=2.2.9'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
