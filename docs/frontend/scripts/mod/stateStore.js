(function (global) {
  'use strict';

  const bus = (global.SpectraPro && global.SpectraPro.eventBus) || null;
  const AI_ASSET_VERSION = '3.1.5-fluorescent-example-1';

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
          { id: 'lamp-hg', label: 'Lamp (Hg/Ar/Ne)', family: 'base', mode: 'atomic', discoveryStrategy: 'local-lamp', refineStrategy: 'atomic-fingerprint-v1' }
        ]
      },
      {
        id: 'smart',
        label: 'Smart Presets',
        presets: [
          { id: 'smart-atomic', label: 'Atomic', family: 'smart', mode: 'atomic', discoveryStrategy: 'global-discovery', refineStrategy: 'atomic-fingerprint-v1' },
          { id: 'smart-molecular', label: 'Molecular', family: 'smart', mode: 'molecular', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-molecular' },
          { id: 'smart-gastube', label: 'Gas Tube', family: 'smart', mode: 'mixture', discoveryStrategy: 'global-discovery', refineStrategy: 'atomic-fingerprint-v1+profile-refine-gas-tube' },
          { id: 'smart-flame', label: 'Flame', family: 'smart', mode: 'mixture', discoveryStrategy: 'global-discovery', refineStrategy: 'profile-refine-flame' },
          { id: 'smart-fluorescent', label: 'Fluorescent', family: 'smart', mode: 'fluorescence', discoveryStrategy: 'broadband-shape', refineStrategy: 'broadband-fluorescence-v1' }
        ]
      }
    ]
  };

  const defaultState = {
    appMode: 'CORE',
    worker: {
      enabled: false,
      status: 'idle',
      mode: 'auto',
      lastPingAt: null,
      lastResultAt: null,
      lastError: null,
      librariesLoaded: false,
      analysisHz: 0,
      droppedJobs: 0
    },
    frame: { latest: null, source: 'none' },
    calibration: {
      isCalibrated: false,
      coefficients: [],
      points: [],
      residualStatus: 'unknown',
      shellPointCount: 0,
      origin: 'none',
      sampleId: ''
    },
    hardware: {
      profileId: '',
      profileName: '',
      appliedAt: null,
      spectralRangeMinNm: null,
      spectralRangeMaxNm: null,
      spectrometerResolutionFwhmNm: null,
      pixelResolutionNm: null,
      gratingLinesPerMm: null
    },
    reference: { count: 0, hasReference: false, updatedAt: null },
    referenceComparison: {
      enabled: false,
      referenceId: '',
      normalization: 'min-max',
      alignmentMode: 'none',
      manualShiftNm: 0,
      maxAutoShiftNm: 2,
      status: 'idle',
      error: null
    },
    display: {
      mode: 'normal',
      yAxisMode: 'manual',
      yAxisMax: 255,
      fillMode: 'off',
      fillOpacity: 0.8,
      saturationOverlay: false,
      diffractionOverlay: true,
      calibrationExtrapolationOverlay: true,
      calibrationExtrapolationOpacity: 0.12,
      overlaysEnabled: true
    },
    peaks: { threshold: 20, distance: 7, smoothing: null },
    preprocessing: {
      responseCorrection: { enabled: false, profileId: null, profile: null, maxCorrectionFactor: 5 },
      baselineMode: 'none',
      normalizationMode: 'none'
    },
    analysis: {
      enabled: false,
      maxHz: 4,
      presetId: null,
      presetCatalog: defaultPresetCatalog,
      topHits: [],
      rawTopHits: [],
      features: [],
      diffractionModel: null,
      diffractionCandidates: [],
      smartFindEnabled: true,
      autoTune: true,
      useRgbScore: false,
      showHits: true,
      astroLabels: {
        enabled: true,
        minDepth: 0.08,
        minSpacingPx: 48
      },
      smartFindHits: [],
      smartFindGroups: [],
      elementScores: [],
      winnerBreakdown: null,
      calibrationDiagnostics: null,
      matchUncertaintyModel: null,
      hardMatchCapNm: null,
      measurementQuality: null,
      preprocessing: null,
      referenceComparison: null,
      astro: null,
      resultContext: null,
      fluorescenceSummary: null,
      narrowLineCandidates: [],
      clearNarrowLineHits: [],
      fluorescenceLineEvidence: null,
      narrowLineOverlay: false,
      offsetNm: null,
      includeWeakPeaks: false,
      maxDistanceNm: 1.8,
      strongPeakLevel: 3,
      peakThresholdRel: 0.015,
      peakDistancePx: 2,
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
      darkI: null,
      referenceI: null,
      darkCapturedAt: null,
      referenceCapturedAt: null
    },
    ui: {
      inlineFeedback: false,
      disableInfoPopups: true,
      console: { lines: [], maxLines: 200 }
    }
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isSameValue(a, b) {
    if (a === b) return true;
    if ((a == null) || (b == null)) return false;
    const ta = typeof a, tb = typeof b;
    if (ta !== 'object' || tb !== 'object') return false;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
  }

  function createStore(seed) {
    let state = Object.assign({}, deepClone(defaultState), (seed && typeof seed === 'object') ? deepClone(seed) : {});

    function getState() { return state; }

    function setState(patch, meta) {
      const nextPatch = (patch && typeof patch === 'object') ? deepClone(patch) : {};
      state = Object.assign({}, state, nextPatch);
      if (bus) bus.emit('state:changed', { state: state, patch: nextPatch, meta: meta || null });
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
      if (isSameValue(target[leaf], value)) return state;
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
  global.SpectraPro.aiAnalysisConfig = global.SpectraPro.aiAnalysisConfig || {};
  if (!global.SpectraPro.aiAnalysisConfig.endpoint) {
    global.SpectraPro.aiAnalysisConfig.endpoint = 'https://spectra-pro-ai.kristoffer-aberg81.workers.dev';
  }

  if (global.document && !global.document.getElementById('spUiTweaksV203Loader')) {
    const script = global.document.createElement('script');
    script.id = 'spUiTweaksV203Loader';
    script.src = '../scripts/mod/uiTweaksV203.js?v=' + AI_ASSET_VERSION;
    script.defer = true;
    (global.document.head || global.document.documentElement).appendChild(script);
  }

  if (global.document && !global.document.getElementById('spFluorescenceUiLoader')) {
    const script = global.document.createElement('script');
    script.id = 'spFluorescenceUiLoader';
    script.src = '../scripts/mod/fluorescenceUi.js?v=' + AI_ASSET_VERSION;
    script.defer = true;
    (global.document.head || global.document.documentElement).appendChild(script);
  }

  if (global.document && !global.document.getElementById('spHelpUiLoader')) {
    const script = global.document.createElement('script');
    script.id = 'spHelpUiLoader';
    script.src = '../scripts/mod/helpUi.js?v=' + AI_ASSET_VERSION;
    script.defer = true;
    (global.document.head || global.document.documentElement).appendChild(script);
  }

  if (global.document && !global.document.getElementById('spExportUiLoader')) {
    const script = global.document.createElement('script');
    script.id = 'spExportUiLoader';
    script.src = '../scripts/mod/exportUi.js?v=' + AI_ASSET_VERSION;
    script.defer = true;
    (global.document.head || global.document.documentElement).appendChild(script);
  }

  if (global.document && !global.document.getElementById('spI18nUiLoader')) {
    const script = global.document.createElement('script');
    script.id = 'spI18nUiLoader';
    script.src = '../scripts/mod/i18nUi.js?v=' + AI_ASSET_VERSION;
    script.defer = true;
    (global.document.head || global.document.documentElement).appendChild(script);
  }

  if (global.document && !global.document.getElementById('spExampleSpectrumUiLoader')) {
    const script = global.document.createElement('script');
    script.id = 'spExampleSpectrumUiLoader';
    script.src = '../scripts/mod/exampleSpectrumUi.js?v=' + AI_ASSET_VERSION;
    script.defer = true;
    (global.document.head || global.document.documentElement).appendChild(script);
  }

  // AI Interpretation load order: payload builder -> secure transport service -> UI.
  if (global.document) {
    const loadAiUi = function () {
      if (global.document.getElementById('spAiAnalysisUiLoader')) return;
      const uiScript = global.document.createElement('script');
      uiScript.id = 'spAiAnalysisUiLoader';
      uiScript.src = '../scripts/mod/aiAnalysisUi.js?v=' + AI_ASSET_VERSION;
      uiScript.defer = true;
      (global.document.head || global.document.documentElement).appendChild(uiScript);
    };

    const loadAiService = function () {
      if (global.SpectraPro.aiAnalysisService) {
        loadAiUi();
        return;
      }
      if (global.document.getElementById('spAiAnalysisServiceLoader')) return;
      const serviceScript = global.document.createElement('script');
      serviceScript.id = 'spAiAnalysisServiceLoader';
      serviceScript.src = '../scripts/mod/aiAnalysisService.js?v=' + AI_ASSET_VERSION;
      serviceScript.defer = true;
      serviceScript.addEventListener('load', loadAiUi, { once: true });
      (global.document.head || global.document.documentElement).appendChild(serviceScript);
    };

    if (global.SpectraPro.aiAnalysisPayload) {
      loadAiService();
    } else if (!global.document.getElementById('spAiAnalysisPayloadLoader')) {
      const payloadScript = global.document.createElement('script');
      payloadScript.id = 'spAiAnalysisPayloadLoader';
      payloadScript.src = '../scripts/mod/aiAnalysisPayload.js?v=' + AI_ASSET_VERSION;
      payloadScript.defer = true;
      payloadScript.addEventListener('load', loadAiService, { once: true });
      (global.document.head || global.document.documentElement).appendChild(payloadScript);
    }
  }
})(window);
