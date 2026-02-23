
(function (root) {
  'use strict';
  const MSG = {
    PING: 'PING',
    PONG: 'PONG',
    ERROR: 'ERROR',
    INIT_LIBRARIES: 'INIT_LIBRARIES',
    INIT_LIBRARIES_RESULT: 'INIT_LIBRARIES_RESULT',
    ANALYZE_FRAME: 'ANALYZE_FRAME',
    ANALYZE_RESULT: 'ANALYZE_RESULT',
    SET_PRESET: 'SET_PRESET',
    QUERY_LIBRARY: 'QUERY_LIBRARY'
  };
  root.SPECTRA_PRO_WORKER_TYPES = { MSG };
})(typeof self !== 'undefined' ? self : this);
