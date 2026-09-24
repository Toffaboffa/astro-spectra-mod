import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const elements = new Map();

class FakeClassList {
  constructor(){ this.values = new Set(); }
  add(...values){ values.forEach((value) => this.values.add(value)); }
  remove(...values){ values.forEach((value) => this.values.delete(value)); }
  contains(value){ return this.values.has(value); }
  toggle(value, force){
    const next = force == null ? !this.values.has(value) : !!force;
    if (next) this.values.add(value); else this.values.delete(value);
    return next;
  }
}

const fakeContext = {
  clearRect(){}, fillRect(){}, setTransform(){}, scale(){}, beginPath(){}, moveTo(){},
  lineTo(){}, stroke(){}, fillText(){}, arc(){}, fill(){}, setLineDash(){},
  measureText(value){ return { width: String(value || '').length * 6 }; },
  save(){}, restore(){}, translate(){}, rotate(){},
  strokeStyle:'', fillStyle:'', lineWidth:1, font:''
};

class FakeElement {
  constructor(tagName='div') {
    this.tagName = String(tagName).toUpperCase();
    this.type = '';
    this.value = '';
    this.files = [];
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.disabled = false;
    this.classList = new FakeClassList();
    this.listeners = Object.create(null);
    this._id = '';
  }
  set id(value){ this._id = String(value || ''); if (this._id) elements.set(this._id, this); }
  get id(){ return this._id; }
  appendChild(child){ child.parentNode = this; this.children.push(child); return child; }
  removeChild(child){ const i=this.children.indexOf(child); if(i>=0)this.children.splice(i,1); child.parentNode=null; return child; }
  get lastElementChild(){ return this.children.length ? this.children[this.children.length-1] : null; }
  querySelectorAll(selector){
    if (selector === 'input[type="number"]') return this.children.filter((child) => child.tagName === 'INPUT' && child.type === 'number');
    return [];
  }
  addEventListener(name, handler){ (this.listeners[name] ||= []).push(handler); }
  dispatchEvent(event){ (this.listeners[event && event.type] || []).forEach((handler) => handler.call(this,event)); }
  getContext(){ return fakeContext; }
  getBoundingClientRect(){ return { width: 640, height: 320, left: 0, top: 0, right: 640, bottom: 320 }; }
}

function mount(id, tag='div') { const el=new FakeElement(tag); el.id=id; return el; }
mount('input-container');
mount('graphCalibration','canvas');
mount('graphDivergence','canvas');
const fileInput = mount('my-file','input');
mount('exportCalibrationNameInput','input');

const errors = [];
const events = [];
let failRedraw = false;

const context = {
  console,
  Date,
  Math,
  JSON,
  Number,
  Array,
  Object,
  String,
  Set,
  Blob,
  URL: { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} },
  document: {
    getElementById(id){ return elements.get(id) || null; },
    createElement(tag){ return new FakeElement(tag); },
    activeElement: { blur(){} },
    body: { appendChild(){}, removeChild(){} }
  },
  updateTextContent(){},
  callError(code){ errors.push(code); },
  getTimestamp(){ return 'test'; },
  clearGraph(){},
  resizeCanvasToDisplaySize(){ if (failRedraw) throw new Error('hidden canvas'); },
  setTimeout(fn){ fn(); return 1; },
  clearTimeout(){},
  FileReader: class {
    readAsText(file){ if (typeof this.onload === 'function') this.onload({ target: { result: String(file && file.text || '') } }); }
  },
  SpectraPro: {
    coreBridge: {},
    coreHooks: { emit(name,payload){ events.push({name,payload}); } }
  }
};
context.window = context;
context.self = context;
vm.createContext(context);

vm.runInContext(read('docs/frontend/scripts/polynomialRegressionScript.js'), context, { filename: 'polynomialRegressionScript.js' });
vm.runInContext(read('docs/frontend/scripts/calibrationScript.js'), context, { filename: 'calibrationScript.js' });

assert.ok(context.SpectraCore && context.SpectraCore.calibration, 'canonical calibration API must be exposed');
assert.equal(typeof context.SpectraCore.calibration.applyPoints, 'function');
assert.equal(typeof context.SpectraCore.calibration.reset, 'function');

fileInput.files = [{ text: '32;388.86\n515;587.57\n1110;837.76\n' }];
context.importCalibrationFile();

let state = context.SpectraCore.calibration.getState();
assert.equal(state.calibrated, true, 'legacy file import must activate canonical calibration');
assert.equal(state.origin, 'user', 'file import must be user-owned');
assert.equal(state.pointCount, 3);
assert.deepEqual(Array.from(state.points, (p) => [p.px,p.nm]), [[32,388.86],[515,587.57],[1110,837.76]]);
assert.ok(state.coefficients.length >= 2, 'file import must expose fit coefficients');
assert.ok(events.some((evt) => evt.name === 'calibrationChanged' && evt.payload && evt.payload.pointCount === 3), 'file import must publish calibrationChanged');

failRedraw = true;
const redrawSafe = context.SpectraCore.calibration.applyPoints(
  [{px:10,nm:400},{px:500,nm:600},{px:1000,nm:800}],
  { origin:'user', source:'redraw-failure-test' }
);
assert.equal(redrawSafe.calibrated, true, 'canvas redraw failure must not prevent state commit');
assert.equal(context.SpectraCore.calibration.getState().pointCount, 3);
failRedraw = false;

const sample = context.SpectraCore.calibration.applyPoints(
  [{px:32,nm:388.86},{px:515,nm:587.57},{px:1110,nm:837.76}],
  { origin:'sample', sampleId:'n2-spectral-tube', source:'sample-test' }
);
assert.equal(sample.calibrated, true);
assert.equal(sample.origin, 'sample');
assert.equal(sample.sampleId, 'n2-spectral-tube');

const reset = context.SpectraCore.calibration.reset({ source:'sample-exit' });
assert.equal(reset.calibrated, false);
assert.equal(reset.pointCount, 0);
assert.equal(reset.origin, 'none');
assert.equal(reset.sampleId, '');

const manual = context.SpectraCore.calibration.applyPoints(
  [{px:0,nm:400},{px:640,nm:600},{px:1279,nm:800}],
  { origin:'user', source:'manual-test' }
);
assert.equal(manual.calibrated, true);
assert.equal(manual.origin, 'user');
assert.equal(context.SpectraCore.calibration.getState().origin, 'user', 'ordinary source changes must not implicitly clear manual calibration');

assert.deepEqual(errors, [], 'valid calibration flows must not raise legacy calibration errors');
console.log('CALIBRATION RUNTIME: file import, canonical publication, redraw safety and sample ownership passed.');
