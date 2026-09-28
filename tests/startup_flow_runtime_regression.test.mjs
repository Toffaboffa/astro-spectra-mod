import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrap = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/proBootstrap.js'), 'utf8');
const calibrationIo = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/calibrationIO.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'Missing function ' + name);
  let brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escape = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('Unbalanced function ' + name);
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = String(type || '');
    this.detail = options.detail;
    this.bubbles = !!options.bubbles;
  }
}

class FakeEventTarget {
  constructor(){ this.listeners = Object.create(null); }
  addEventListener(type, handler, options){
    (this.listeners[type] ||= []).push({ handler, once: !!(options && options.once) });
  }
  dispatchEvent(event){
    const list = (this.listeners[event.type] || []).slice();
    for (const item of list) {
      item.handler.call(this, event);
      if (item.once) {
        const live = this.listeners[event.type] || [];
        const i = live.indexOf(item);
        if (i >= 0) live.splice(i, 1);
      }
    }
    return true;
  }
}

function createStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key){ return map.has(key) ? map.get(key) : null; },
    setItem(key, value){ map.set(String(key), String(value)); },
    removeItem(key){ map.delete(String(key)); },
    dump(){ return Object.fromEntries(map); }
  };
}

function createDom() {
  const elements = new Map();

  class FakeElement extends FakeEventTarget {
    constructor(tag = 'div') {
      super();
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this._id = '';
      this.className = '';
      this.textContent = '';
      this.innerHTML = '';
      this.type = '';
      this.value = '';
      this.checked = false;
      this.style = {};
      this.dataset = {};
    }
    set id(value){
      this._id = String(value || '');
      if (this._id) elements.set(this._id, this);
    }
    get id(){ return this._id; }
    appendChild(child){ child.parentNode = this; this.children.push(child); return child; }
    removeChild(child){
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child.id) elements.delete(child.id);
      child.parentNode = null;
      return child;
    }
    setAttribute(){}
    click(){ this.dispatchEvent(new FakeEvent('click')); }
  }

  const documentTarget = new FakeEventTarget();
  const document = Object.assign(documentTarget, {
    readyState: 'complete',
    baseURI: 'https://example.test/docs/frontend/pages/spectrapro.html',
    getElementById(id){ return elements.get(id) || null; },
    createElement(tag){ return new FakeElement(tag); },
    createTextNode(text){ const el = new FakeElement('#text'); el.textContent = String(text || ''); return el; },
    head: new FakeElement('head'),
    body: new FakeElement('body')
  });

  const graph = new FakeElement('div');
  graph.id = 'graphWindowContainer';
  const nm = new FakeElement('input');
  nm.id = 'toggleXLabelsNm';
  const px = new FakeElement('input');
  px.id = 'toggleXLabelsPx';
  px.checked = true;

  return { document, elements, FakeElement, graph, nm, px };
}

function createRuntime({
  rememberHardware = null,
  rememberCalibration = false,
  rawCalibrationStorage = null,
  hardwareFlowInstalled = true
} = {}) {
  const dom = createDom();
  const storageSeed = {};
  if (rememberHardware !== null) {
    storageSeed['spectraPro.startup.hardware'] = JSON.stringify({ remember: true, profileId: rememberHardware });
  }
  const defaultRememberedPoints = [
    { px: 32, nm: 388.86 },
    { px: 515, nm: 587.57 },
    { px: 1110, nm: 837.76 }
  ];
  if (rawCalibrationStorage != null) {
    storageSeed['spectraPro.startup.calibration'] = String(rawCalibrationStorage);
  } else if (rememberCalibration) {
    storageSeed['spectraPro.startup.calibration'] = JSON.stringify({
      schema: 'spectra-pro-startup-calibration/v1',
      remember: true,
      points: defaultRememberedPoints,
      savedAt: 123456
    });
  }

  const windowTarget = new FakeEventTarget();
  const timers = [];
  const coreHookHandlers = Object.create(null);
  const appliedHardware = [];
  const restoredCalibrationCalls = [];
  let hardwarePromptCount = 0;
  let calibrationState = {
    calibrated: false,
    isCalibrated: false,
    points: [],
    coefficients: [],
    origin: 'none',
    sampleId: ''
  };

  function emitCoreCalibration(payload) {
    calibrationState = Object.assign({}, payload);
    for (const fn of coreHookHandlers.calibrationChanged || []) fn(payload);
  }

  const context = {
    console,
    document: dom.document,
    localStorage: createStorage(storageSeed),
    Date,
    JSON,
    Number,
    String,
    Object,
    Array,
    Promise,
    URL,
    Event: FakeEvent,
    CustomEvent: FakeEvent,
    setTimeout(fn){ timers.push(fn); return timers.length; },
    clearTimeout(){},
    SpectraCore: {
      calibration: {
        getState(){ return calibrationState; },
        applyPoints(points, meta = {}) {
          const normalized = Array.from(points || [], (point) => ({ px: Number(point.px), nm: Number(point.nm) }));
          restoredCalibrationCalls.push({ points: normalized, meta: Object.assign({}, meta) });
          const payload = {
            ok: normalized.length >= 2,
            calibrated: normalized.length >= 2,
            isCalibrated: normalized.length >= 2,
            points: normalized,
            pointCount: normalized.length,
            coefficients: normalized.length >= 2 ? [normalized[0].nm, 0.4] : [],
            origin: String(meta.origin || 'user'),
            sampleId: '',
            source: String(meta.source || 'test')
          };
          emitCoreCalibration(payload);
          return payload;
        }
      }
    },
    SpectraPro: {
      v15: { calibrationIO: {} },
      store: { getState(){ return { calibration: calibrationState }; } },
      coreHooks: {
        on(name, handler){ (coreHookHandlers[name] ||= []).push(handler); }
      }
    }
  };

  Object.assign(context, windowTarget);
  context.addEventListener = windowTarget.addEventListener.bind(windowTarget);
  context.dispatchEvent = windowTarget.dispatchEvent.bind(windowTarget);
  context.window = context;
  context.self = context;
  context.__spectraStartupHardwareFlowInstalled = hardwareFlowInstalled;
  vm.createContext(context);

  vm.runInContext(calibrationIo, context, { filename: 'calibrationIO.js' });

  const hardwareFns = [
    extractFunction(bootstrap, 'readRememberedStartupHardware'),
    extractFunction(bootstrap, 'writeRememberedStartupHardware'),
    extractFunction(bootstrap, 'announceStartupHardwareReady'),
    extractFunction(bootstrap, 'beginStartupHardwareSelection')
  ].join('\n');

  context.STARTUP_HARDWARE_STORAGE_KEY = 'spectraPro.startup.hardware';
  context.profiles = {
    'spectra-1': {
      profileId: 'spectra-1',
      profileName: 'KVANT - Spectra-1',
      spectralRangeMinNm: 360,
      spectralRangeMaxNm: 930
    }
  };
  context.ids = { preset: { value: '' } };
  context.applyHardware = function(payload, source){ appliedHardware.push({ payload, source }); return payload; };
  context.fillFormFromState = function(){};
  context.ensureStartupHardwarePrompt = function(){ hardwarePromptCount += 1; return {}; };
  vm.runInContext(hardwareFns, context, { filename: 'startup-hardware-extract.js' });

  function runTimers(limit = 50) {
    let n = 0;
    while (timers.length) {
      assert.ok(n++ < limit, 'timer loop did not settle');
      const fn = timers.shift();
      fn();
    }
  }

  function emitCalibration(payload) {
    emitCoreCalibration(payload);
  }

  function promptText() {
    const prompt = dom.document.getElementById('spCalibrationPrompt');
    if (!prompt) return null;
    const textNode = prompt.children.find((child) => child.className === 'sp-calibration-prompt__text');
    return textNode ? textNode.textContent : null;
  }

  return {
    context, dom, runTimers, emitCalibration, promptText,
    beginHardware(){ context.beginStartupHardwareSelection(); },
    get hardwarePromptCount(){ return hardwarePromptCount; },
    get calibrationState(){ return calibrationState; },
    restoredCalibrationCalls,
    appliedHardware
  };
}

// 1) Nothing remembered: hardware prompt first, calibration prompt only after hardware-ready.
{
  const rt = createRuntime();
  rt.runTimers();
  assert.equal(rt.promptText(), null, 'calibration prompt must not appear before hardware startup completes');
  rt.beginHardware();
  assert.equal(rt.hardwarePromptCount, 1, 'hardware popup must appear when hardware is not remembered');
  assert.equal(rt.promptText(), null, 'calibration prompt must still wait while hardware popup is open');
  rt.context.announceStartupHardwareReady('');
  rt.runTimers();
  assert.equal(rt.promptText(), 'Not Calibrated. Load Calibrationfile now?', 'calibration prompt must follow the hardware popup');
}

// 2) Only hardware remembered: remembered profile is applied, hardware popup is skipped, calibration appears.
{
  const rt = createRuntime({ rememberHardware: 'spectra-1' });
  rt.beginHardware();
  rt.runTimers();
  assert.equal(rt.hardwarePromptCount, 0, 'remembered hardware must skip the hardware popup');
  assert.equal(rt.appliedHardware.length, 1, 'remembered hardware must be applied');
  assert.equal(rt.appliedHardware[0].payload.profileId, 'spectra-1');
  assert.equal(rt.context.__spectraStartupHardwareReady, true, 'remembered hardware must release the startup gate');
  assert.equal(rt.promptText(), 'Not Calibrated. Load Calibrationfile now?', 'calibration prompt must appear after remembered hardware is applied');
}

// 2b) Remembered None is a real remembered hardware choice: skip the popup,
// apply an empty hardware state, then continue to calibration.
{
  const rt = createRuntime({ rememberHardware: '' });
  rt.beginHardware();
  rt.runTimers();
  assert.equal(rt.hardwarePromptCount, 0, 'remembered None must skip the hardware popup');
  assert.equal(rt.appliedHardware.length, 1, 'remembered None must apply an empty hardware state');
  assert.equal(Object.keys(rt.appliedHardware[0].payload || {}).length, 0, 'remembered None payload must be empty');
  assert.equal(rt.appliedHardware[0].source, 'proBootstrap.hardware.startup.remembered-none');
  assert.equal(rt.context.__spectraStartupHardwareReady, true, 'remembered None must release the startup gate');
  assert.equal(rt.promptText(), 'Not Calibrated. Load Calibrationfile now?', 'calibration must follow remembered None');
}

// 3) Only calibration remembered: hardware popup still appears; after hardware-ready the
// canonical calibration API restores the points and the Not Calibrated prompt stays suppressed.
{
  const rt = createRuntime({ rememberCalibration: true });
  rt.runTimers();
  rt.beginHardware();
  assert.equal(rt.hardwarePromptCount, 1, 'remembered calibration must not suppress hardware selection');
  rt.context.announceStartupHardwareReady('');
  rt.runTimers();
  assert.equal(rt.restoredCalibrationCalls.length, 1, 'remembered calibration must be restored through the canonical applyPoints API');
  assert.deepEqual(rt.restoredCalibrationCalls[0].points, [
    { px: 32, nm: 388.86 },
    { px: 515, nm: 587.57 },
    { px: 1110, nm: 837.76 }
  ]);
  assert.equal(rt.restoredCalibrationCalls[0].meta.source, 'startup-remembered-calibration');
  assert.equal(rt.calibrationState.calibrated, true, 'remembered calibration must become active after hardware startup');
  assert.notEqual(rt.promptText(), 'Not Calibrated. Load Calibrationfile now?', 'restored calibration must suppress only the uncalibrated reminder');
}

// 4) Both remembered: remembered hardware applies, calibration restores, and neither startup
// selection/reminder popup is required. The wavelength follow-up may still appear.
{
  const rt = createRuntime({ rememberHardware: 'spectra-1', rememberCalibration: true });
  rt.beginHardware();
  rt.runTimers();
  assert.equal(rt.hardwarePromptCount, 0, 'remembered hardware must suppress hardware popup');
  assert.equal(rt.restoredCalibrationCalls.length, 1, 'remembered calibration must restore when hardware is also remembered');
  assert.notEqual(rt.promptText(), 'Not Calibrated. Load Calibrationfile now?', 'restored calibration must suppress the Not Calibrated popup');
  assert.equal(rt.appliedHardware.length, 1, 'remembered hardware must still be applied when calibration is restored');
}

// Wavelength follow-up: a valid calibration event before hardware-ready must not race the hardware popup.
{
  const rt = createRuntime();
  rt.runTimers();
  rt.emitCalibration({
    isCalibrated: true,
    calibrated: true,
    points: [{ px: 0, nm: 400 }, { px: 1000, nm: 800 }],
    coefficients: [400, 0.4]
  });
  rt.runTimers();
  assert.equal(rt.promptText(), null, 'wavelength-axis prompt must wait until hardware-ready');
  rt.context.announceStartupHardwareReady('');
  rt.runTimers();
  assert.equal(rt.promptText(), 'Switch x-axis to wavelength?', 'wavelength-axis prompt must appear only after hardware-ready');
}

// If wavelength is already selected, a calibration event must not create a redundant axis popup.
{
  const rt = createRuntime({ rememberHardware: 'spectra-1', rememberCalibration: true });
  rt.dom.nm.checked = true;
  rt.dom.px.checked = false;
  rt.beginHardware();
  rt.runTimers();
  rt.emitCalibration({
    isCalibrated: true,
    calibrated: true,
    points: [{ px: 0, nm: 400 }, { px: 1000, nm: 800 }],
    coefficients: [400, 0.4]
  });
  rt.runTimers();
  assert.equal(rt.promptText(), null, 'already-selected wavelength axis must suppress redundant follow-up');
}

// Checking Remember calibration and then loading a user calibration must persist the
// actual point set, not a boolean suppression flag.
{
  const rt = createRuntime();
  rt.runTimers();
  rt.beginHardware();
  rt.context.announceStartupHardwareReady('');
  rt.runTimers();

  const checkbox = rt.dom.document.getElementById('spCalibrationRemember');
  const prompt = rt.dom.document.getElementById('spCalibrationPrompt');
  assert.ok(checkbox && prompt, 'calibration startup prompt must expose its remember checkbox');
  checkbox.checked = true;
  const buttons = prompt.children.find((child) => child.className === 'sp-calibration-prompt__buttons');
  assert.ok(buttons && buttons.children[0], 'calibration startup prompt must expose a Yes button');
  buttons.children[0].click();

  rt.emitCalibration({
    isCalibrated: true,
    calibrated: true,
    points: [{ px: 10, nm: 401.2 }, { px: 640, nm: 612.3 }, { px: 1200, nm: 823.4 }],
    coefficients: [398.1, 0.35, 0.00001],
    origin: 'user',
    source: 'file-import'
  });
  const stored = JSON.parse(rt.context.localStorage.getItem('spectraPro.startup.calibration'));
  assert.equal(stored.schema, 'spectra-pro-startup-calibration/v1');
  assert.equal(stored.remember, true);
  assert.deepEqual(stored.points, [
    { px: 10, nm: 401.2 },
    { px: 640, nm: 612.3 },
    { px: 1200, nm: 823.4 }
  ]);
  assert.ok(Number.isFinite(Number(stored.savedAt)), 'remembered calibration must record when its points were saved');
}

// Legacy v1.3.9 boolean storage and corrupt payloads must not falsely suppress the calibration reminder.
for (const raw of [
  '1',
  '{"schema":"spectra-pro-startup-calibration/v1","remember":true,"points":[{"px":"bad","nm":400}]}',
  '{"schema":"spectra-pro-startup-calibration/v1","remember":true,"points":[{"px":10,"nm":400}]}',
  '{"schema":"spectra-pro-startup-calibration/v1","remember":true,"points":[{"px":10,"nm":400},{"px":10,"nm":500}]}',
  '{not-json'
]) {
  const rt = createRuntime({ rawCalibrationStorage: raw });
  rt.runTimers();
  rt.beginHardware();
  rt.context.announceStartupHardwareReady('');
  rt.runTimers();
  assert.equal(rt.context.localStorage.getItem('spectraPro.startup.calibration'), null, 'invalid remembered calibration must be cleared');
  assert.equal(rt.promptText(), 'Not Calibrated. Load Calibrationfile now?', 'invalid remembered calibration must fall back to the ordinary startup reminder');
}

// Explicit calibration reset must also forget the startup calibration. Otherwise a
// reload would silently resurrect a calibration the user deliberately reset.
{
  const rt = createRuntime({ rememberHardware: 'spectra-1', rememberCalibration: true });
  rt.beginHardware();
  rt.runTimers();
  assert.ok(rt.context.localStorage.getItem('spectraPro.startup.calibration'), 'precondition: remembered calibration must exist');
  assert.equal(rt.promptText(), 'Switch x-axis to wavelength?', 'restored calibration should reach the wavelength follow-up before reset');

  rt.emitCalibration({
    isCalibrated: false,
    calibrated: false,
    points: [],
    coefficients: [],
    origin: 'none',
    source: 'reset'
  });

  assert.equal(rt.context.localStorage.getItem('spectraPro.startup.calibration'), null, 'explicit reset must clear remembered calibration');
  assert.equal(rt.promptText(), null, 'reset must dismiss a stale wavelength-axis follow-up');
}

// A remembered user calibration must not be overwritten by temporary sample calibration.
{
  const rt = createRuntime({ rememberHardware: 'spectra-1', rememberCalibration: true });
  rt.beginHardware();
  rt.runTimers();
  const before = JSON.parse(rt.context.localStorage.getItem('spectraPro.startup.calibration'));
  rt.emitCalibration({
    isCalibrated: true,
    calibrated: true,
    points: [{ px: 0, nm: 390 }, { px: 1000, nm: 810 }],
    coefficients: [390, 0.42],
    origin: 'sample',
    sampleId: 'temporary-example',
    source: 'sample-test'
  });
  const after = JSON.parse(rt.context.localStorage.getItem('spectraPro.startup.calibration'));
  assert.deepEqual(after.points, before.points, 'sample calibration must not overwrite remembered user calibration');
}

console.log('STARTUP FLOW RUNTIME: startup matrix, remembered None, invalid payloads, reset semantics and wavelength handoff passed.');
