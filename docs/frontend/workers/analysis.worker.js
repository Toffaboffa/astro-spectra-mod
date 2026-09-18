importScripts(
  './workerTypes.js?v=2.2.8',
  './workerState.js?v=2.2.8',
  './libraryLoader.js?v=2.2.8',
  './libraryIndex.js?v=2.2.8',
  './libraryQuery.js?v=2.2.8',
  './peakDetect.js?v=2.2.8',
  './peakScoring.js?v=2.2.8',
  './lineMatcher.js?v=2.2.8',
  './qcRules.js?v=2.2.8',
  './confidenceModel.js?v=2.2.8',
  './analysisPipeline.js?v=2.2.8',
  './plasmaProfiles.js?v=2.2.8',
  './molecularEvidencePatch.js?v=2.2.8',
  './atomicProfiles.js?v=2.2.8',
  './atomicEvidence.js?v=2.2.8',
  './fluorescenceAnalysis.js?v=2.2.8',
  './workerRouter.js?v=2.2.8'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
