importScripts(
  './workerTypes.js?v=2.2.7',
  './workerState.js?v=2.2.7',
  './libraryLoader.js?v=2.2.7',
  './libraryIndex.js?v=2.2.7',
  './libraryQuery.js?v=2.2.7',
  './peakDetect.js?v=2.2.7',
  './peakScoring.js?v=2.2.7',
  './lineMatcher.js?v=2.2.7',
  './qcRules.js?v=2.2.7',
  './confidenceModel.js?v=2.2.7',
  './analysisPipeline.js?v=2.2.7',
  './plasmaProfiles.js?v=2.2.7',
  './molecularEvidencePatch.js?v=2.2.7',
  './atomicProfiles.js?v=2.2.7',
  './atomicEvidence.js?v=2.2.7',
  './fluorescenceAnalysis.js?v=2.2.7',
  './workerRouter.js?v=2.2.7'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
