
(function (root) {
  'use strict';
  const state = {
    librariesLoaded: false,
    manifest: null,
    atomLines: [],
    libraryIndex: null,
    activePreset: null,
    lastAnalysis: null
  };
  root.SPECTRA_PRO_WORKER_STATE = state;
})(typeof self !== 'undefined' ? self : this);
