
(function (global) {
  'use strict';

  const bus = (global.SpectraPro && global.SpectraPro.eventBus) || null;

  const defaultPresetCatalog = {
    groups: [
      {
        id: 'base',
        label: 'Base Presets',
        presets: [
          { id: 'nearest', label: 'Nearest', family: 'base', mode: 'atomic', discoveryStrategy: 'local-nearest', refineStrategy: 'none' },
          { id: 'wide', label: 'Wide', family: 'base', mode: 'atomic', discoveryStrategy: 'local-wide', refineStrategy: 'none' },
          { id: 'tight', label: 'Tight', family: 'base', mode: 'atomic', discoveryStrategy: 'local-tight', refineStrategy: 'none' },
          { id: 'fast', label: 'Fast', family: 'base', mode: 'atomic', discoveryStrategy: 'local-fast', refineStrategy: 'none' },
          { id: 'lamp-hg', label: 'Lamp (Hg/Ar/Ne)', family: 'base', mode: 'atomic', discoveryStrategy: 'local-lamp', refineStrategy: 'none' }
        ]
      },
      {
        id: 'smart',
        label: 'Smart Presets',
        presets: [
          { id: 'smart-atomic', label: 'Atomic', family: 'smart', mode: 'atomic', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-atomic' },
          { id: 'smart-molecular', label: 'Molecular', family: 'smart', mode: 'molecular', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-molecular' },
          { id: 'smart-gastube', label: 'Gas Tube', family: 'smart', mode: 'mixture', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-gas-tube' },
          { id: 'smart-flame', label: 'Flame', family: 'smart', mode: 'mixture', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-flame' },
          { id: 'smart-fluorescent', label: 'Fluorescent', family: 'smart', mode: 'mixture', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-fluorescent' }
        ]
      }
    ]
  };

  const defaultState = {
    appMode: 'CORE',
    worker: {
      enabled: false,
      status: 'idle', // idle|starting|ready|running|error
      mode: 'auto', // auto|on|off
      lastPingAt: null,
      lastResultAt: null,
      lastError: null,
      librariesLoaded: false,
      analysisHz: 0,
      droppedJobs: 0
    },
    frame: {
      latest: null,
      source: 'none'
    },
    calibration: {
      isCalibrated: false,
      coefficients: [],
      points: [],
      residualStatus: 'unknown',
      shellPointCount: 0
    },
    reference: {
      count: 0,
      hasReference: false,
      updatedAt: null
    },
    display: {
      mode: 'normal',
      yAxisMode: 'auto',
      yAxisMax: 255,
      fillMode: 'inherit',
      fillOpacity: null,
      overlaysEnabled: true
    },
    peaks: {
      threshold: null,
      distance: null,
      smoothing: null
    },
    analysis: {
      enabled: false,
      maxHz: 4,
      presetId: null,
      presetCatalog: defaultPresetCatalog,
      topHits: [],
      rawTopHits: [],
      smartFindEnabled: false,
      showHits: true,
      smartFindHits: [],
      smartFindGroups: [],
      elementScores: [],
      winnerBreakdown: null,
      offsetNm: null,
      maxDistanceNm: 5,
      qcFlags: []
    },
    camera: {
      status: 'unknown',
      source: 'none',
      supported: {},
      values: {},
      summary: {},
      lastProbeAt: null,
      error: null
    },
    subtraction: {
      mode: 'raw',
      hasDark: false,
      hasReference: false,
      hasFlat: false,
      // Stored intensity arrays captured from the live frame (or the core reference graph).
      // Kept small: only combined intensity (I) is stored.
      darkI: null,
      referenceI: null,
      darkCapturedAt: null,
      referenceCapturedAt: null
    }
,
    ui: {
      inlineFeedback: false,
      disableInfoPopups: true, console: { lines: [], maxLines: 200 } }
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isSameValue(a, b) {
    if (a === b) return true;
    if ((a == null) || (b == null)) return false;
    const ta = typeof a, tb = typeof b;
    if (ta !== 'object' || tb !== 'object') return false;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  function createStore(seed) {
    let state = Object.assign({}, deepClone(defaultState), seed || {});

    function getState() {
      return state;
    }

    function setState(patch, meta) {
      state = Object.assign({}, state, patch || {});
      if (bus) bus.emit('state:changed', { state: state, patch: patch || {}, meta: meta || null });
      return state;
    }

    function update(path, value, meta) {
      const parts = String(path || '').split('.').filter(Boolean);
      if (!parts.length) return state;
      const next = deepClone(state);
      let target = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null) target[parts[i]] = {};
        target = target[parts[i]];
      }
      const leaf = parts[parts.length - 1];
      const prevValue = target[leaf];
      if (isSameValue(prevValue, value)) return state;
      target[leaf] = value;
      state = next;
      if (bus) bus.emit('state:changed', { state: state, patch: { [path]: value }, meta: meta || null });
      return state;
    }

    return { getState, setState, update };
  }

  global.SpectraPro = global.SpectraPro || {};
  global.SpectraPro.createStateStore = createStore;
  global.SpectraPro.store = global.SpectraPro.store || createStore();
})(window);
