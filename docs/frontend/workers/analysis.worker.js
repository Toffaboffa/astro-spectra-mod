importScripts(
  './workerTypes.js?v=3.0.1',
  './workerState.js?v=3.0.1',
  './libraryLoader.js?v=3.0.1',
  './libraryIndex.js?v=3.0.1',
  './libraryQuery.js?v=3.0.1',
  './peakDetect.js?v=3.0.1',
  './peakScoring.js?v=3.0.1',
  './lineMatcher.js?v=3.0.1',
  './qcRules.js?v=1.3.8-snr-1',
  './confidenceModel.js?v=3.0.1',
  './spectrumMath.js?v=1.3.8-offset-1',
  './presetResolver.js?v=3.0.1',
  './calibrationDiagnostics.js?v=1.3.8-fit-dof-1',
  './spectralFeatures.js?v=3.0.1',
  './diffractionArtifacts.js?v=3.0.1-diffraction-1',
  './measurementQuality.js?v=1.3.8-result-scope-1',
  './candidateAnalysis.js?v=1.3.8-offset-1',
  './astroReferences.js?v=3.0.1',
  './astroContinuum.js?v=3.0.1',
  './dopplerEstimate.js?v=3.0.1',
  './astroAnalysis.js?v=3.0.1',
  './stellarClassification.js?v=3.0.1',
  './referenceComparison.js?v=3.0.1',
  './analysisPipeline.js?v=3.0.1-diffraction-1',
  './plasmaProfiles.js?v=3.0.1',
  './molecularEvidencePatch.js?v=3.0.1-artifact-filter-1',
  './atomicProfiles.js?v=3.0.1',
  './atomicEvidence.js?v=1.3.8-hard-cap-1',
  './fluorescenceAnalysis.js?v=1.3.8-offset-1',
  './workerRouter.js?v=3.0.1-fluorescence-lines-1'
);

self.onmessage = async function (evt) {
  const response = await self.SPECTRA_PRO_workerRouter.handleMessage(evt.data || {});
  self.postMessage(response);
};
