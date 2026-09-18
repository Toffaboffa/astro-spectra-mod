importScripts(
  './workerTypes.js?v=2.2.10',
  './workerState.js?v=2.2.10',
  './libraryLoader.js?v=2.2.10',
  './libraryIndex.js?v=2.2.10',
  './libraryQuery.js?v=2.2.10',
  './peakDetect.js?v=2.2.10',
  './peakScoring.js?v=2.2.10',
  './lineMatcher.js?v=2.2.10',
  './qcRules.js?v=2.2.10',
  './confidenceModel.js?v=2.2.10',
  './analysisPipeline.js?v=2.2.10',
  './plasmaProfiles.js?v=2.2.10',
  './molecularEvidencePatch.js?v=2.2.10',
  './atomicProfiles.js?v=2.2.10',
  './atomicEvidence.js?v=2.2.10',
  './fluorescenceAnalysis.js?v=2.2.10',
  './workerRouter.js?v=2.2.10'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
