
importScripts(
  './workerTypes.js',
  './workerState.js',
  './libraryLoader.js',
  './libraryIndex.js',
  './libraryQuery.js',
  './peakDetect.js',
  './peakScoring.js',
  './lineMatcher.js',
  './qcRules.js',
  './confidenceModel.js',
  './analysisPipeline.js',
  './workerRouter.js'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
