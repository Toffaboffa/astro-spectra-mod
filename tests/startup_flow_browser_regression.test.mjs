import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrap = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/proBootstrap.js'), 'utf8');
const calibrationIo = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/calibrationIO.js'), 'utf8');
const calibrationScript = fs.readFileSync(path.join(root, 'docs/frontend/scripts/calibrationScript.js'), 'utf8');
const panelCss = fs.readFileSync(path.join(root, 'docs/frontend/styles/mod-panels.css'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/data/hardware_profiles.json'), 'utf8'));

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

const calibrationImportFunction = extractFunction(calibrationScript, 'importCalibrationFile');

const hardwareFunctions = [
  'readRememberedStartupHardware',
  'writeRememberedStartupHardware',
  'announceStartupHardwareReady',
  'renderStartupHardwareAsset',
  'hardwareStartupMetric',
  'startupHardwareLogoUsesWhite',
  'renderStartupHardwareDetails',
  'populateStartupHardwareSelect',
  'ensureStartupHardwarePrompt',
  'beginStartupHardwareSelection'
].map((name) => extractFunction(bootstrap, name)).join('\n\n');

function findChrome() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    const probe = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error('Chrome/Chromium not found on runner.');
}

function scriptSafe(value) { return String(value).replace(/<\/script/gi, '<\\/script'); }
function styleSafe(value) { return String(value).replace(/<\/style/gi, '<\\/style'); }

function buildHarness(phase, port) {
  const profileMap = Object.fromEntries(catalog.profiles.map((profile) => [profile.profileId, profile]));
  const seed = phase === 'clean'
    ? `localStorage.clear();`
    : phase === 'remembered-none'
      ? `localStorage.clear(); localStorage.setItem('spectraPro.startup.hardware', JSON.stringify({remember:true, profileId:''}));`
      : phase === 'calibration-only'
        ? `localStorage.clear(); localStorage.setItem('spectraPro.startup.calibration', JSON.stringify({schema:'spectra-pro-startup-calibration/v1',remember:true,points:[{px:32,nm:388.86},{px:515,nm:587.57},{px:1110,nm:837.76}],savedAt:123456}));`
        : '';

  const phases = {
    clean: `
      beginStartupHardwareSelection();
      await wait(140);
      const hardwarePrompt = must(document.getElementById('spStartupHardwarePrompt'), 'hardware popup missing on clean startup');
      equal(promptText(), null, 'calibration reminder raced ahead of hardware popup');
      const graphRect = document.getElementById('graphWindowContainer').getBoundingClientRect();
      const initialRect = hardwarePrompt.getBoundingClientRect();
      near(initialRect.left + initialRect.width / 2, graphRect.left + graphRect.width / 2, 1.0, 'hardware popup not horizontally centered');
      near(initialRect.top + initialRect.height / 2, graphRect.top + graphRect.height / 2, 1.0, 'hardware popup not vertically centered');
      const select = must(document.getElementById('spStartupHardwareSelect'), 'hardware select missing');
      equal(select.options.length, profilesArray.length + 1, 'hardware select must contain None plus all profiles');
      equal(select.options[0].value, '', 'None must be first hardware option');
      for (const profile of profilesArray) {
        select.value = profile.profileId;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await waitForImage('spStartupHardwareLogo');
        await waitForImage('spStartupHardwareImage');
        const values = [...document.querySelectorAll('#spStartupHardwareDetails .sp-startup-hardware__metric b')].map((el) => el.textContent);
        const expected = [
          profile.manufacturer || 'Not specified',
          profile.model || profile.profileName || 'Not specified',
          profile.spectralRangeMinNm != null && profile.spectralRangeMaxNm != null ? profile.spectralRangeMinNm + '–' + profile.spectralRangeMaxNm + ' nm' : 'Not specified',
          profile.spectrometerResolutionFwhmNm != null ? profile.spectrometerResolutionFwhmNm + ' nm' : 'Not specified',
          profile.pixelResolutionNm != null ? profile.pixelResolutionNm + ' nm/px' : 'Not specified',
          profile.gratingLinesPerMm != null ? profile.gratingLinesPerMm + ' lines/mm' : 'Not specified'
        ];
        equal(JSON.stringify(values), JSON.stringify(expected), profile.profileId + ' rendered metadata mismatch');
        const titles = [...document.querySelectorAll('#spStartupHardwareDetails .sp-startup-hardware__metric b')].map((el) => el.title);
        equal(JSON.stringify(titles), JSON.stringify(expected), profile.profileId + ' metadata title mismatch');
        const logoHost = document.getElementById('spStartupHardwareLogo');
        equal(logoHost.classList.contains('sp-startup-hardware__logo--white'), profile.manufacturer !== 'PASCO' && profile.manufacturer !== 'StellarNet', profile.profileId + ' logo contrast mismatch');
        const rect = hardwarePrompt.getBoundingClientRect();
        near(rect.width, initialRect.width, 1.0, profile.profileId + ' changed popup width');
        near(rect.height, initialRect.height, 1.0, profile.profileId + ' caused popup layout jump');
      }
      select.value = 'spectra-1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('spStartupRememberHardware').checked = true;
      document.getElementById('spStartupHardwareContinue').click();
      await wait(140);
      equal(document.getElementById('spStartupHardwarePrompt'), null, 'hardware popup did not close');
      equal(promptText(), 'Not Calibrated. Load Calibrationfile now?', 'calibration reminder did not follow hardware-ready');
      const remember = must(document.getElementById('spCalibrationRemember'), 'Remember calibration checkbox missing');
      remember.checked = true;
      const yes = must(document.querySelector('#spCalibrationPrompt .sp-calibration-prompt__btn:not(.sp-calibration-prompt__btn--no)'), 'calibration Yes button missing');
      yes.click();
      equal(calibrationFileRequestCount, 1, 'startup popup Yes did not request the calibration file input');
      const calibrationInput = must(document.getElementById('my-file'), 'startup calibration file input missing');
      const transfer = new DataTransfer();
      transfer.items.add(new File(['10,5;401,2\n640;612,3\n1200;823,4\n'], 'startup-calibration.txt', { type: 'text/plain' }));
      calibrationInput.files = transfer.files;
      calibrationInput.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(180);
      equal(restoredCalibrationCalls.length, 1, 'startup popup file selection did not reach canonical applyPoints');
      equal(restoredCalibrationCalls[0].meta.source, 'file-import', 'startup popup file import provenance mismatch');
      equal(JSON.stringify(restoredCalibrationCalls[0].points), JSON.stringify([{px:10.5,nm:401.2},{px:640,nm:612.3},{px:1200,nm:823.4}]), 'startup popup parser did not preserve decimal-comma calibration points');
      const savedHardware = JSON.parse(localStorage.getItem('spectraPro.startup.hardware'));
      equal(savedHardware.profileId, 'spectra-1', 'remembered hardware profile not persisted');
      const savedCalibration = JSON.parse(localStorage.getItem('spectraPro.startup.calibration'));
      equal(savedCalibration.schema, 'spectra-pro-startup-calibration/v1', 'remembered calibration schema mismatch');
      equal(savedCalibration.points.length, 3, 'remembered calibration points not persisted');
      equal(promptText(), 'Switch x-axis to wavelength?', 'wavelength follow-up missing after user calibration');
    `,
    restore: `
      beginStartupHardwareSelection();
      await wait(220);
      equal(document.getElementById('spStartupHardwarePrompt'), null, 'remembered hardware did not skip popup');
      equal(appliedHardware.length, 1, 'remembered hardware was not applied');
      equal(appliedHardware[0].payload.profileId, 'spectra-1', 'wrong remembered hardware restored');
      equal(restoredCalibrationCalls.length, 1, 'remembered calibration did not restore through applyPoints');
      equal(restoredCalibrationCalls[0].meta.source, 'startup-remembered-calibration', 'restore provenance mismatch');
      equal(calibrationState.calibrated, true, 'remembered calibration inactive after reload');
      notEqual(promptText(), 'Not Calibrated. Load Calibrationfile now?', 'restored calibration showed Not Calibrated');
      equal(promptText(), 'Switch x-axis to wavelength?', 'restored calibration missing wavelength follow-up');
      emitCalibration({isCalibrated:false,calibrated:false,points:[],coefficients:[],origin:'none',source:'reset'});
      await wait(40);
      equal(localStorage.getItem('spectraPro.startup.calibration'), null, 'explicit reset did not forget calibration');
      equal(promptText(), null, 'explicit reset left stale wavelength prompt');
    `,
    'after-reset': `
      beginStartupHardwareSelection();
      await wait(180);
      equal(document.getElementById('spStartupHardwarePrompt'), null, 'remembered hardware should still skip after calibration reset');
      equal(promptText(), 'Not Calibrated. Load Calibrationfile now?', 'ordinary calibration reminder did not return after reset/restart');
    `,
    'remembered-none': `
      beginStartupHardwareSelection();
      await wait(180);
      equal(document.getElementById('spStartupHardwarePrompt'), null, 'remembered None did not skip hardware popup');
      equal(appliedHardware.length, 1, 'remembered None did not apply empty hardware');
      equal(Object.keys(appliedHardware[0].payload || {}).length, 0, 'remembered None payload not empty');
      equal(appliedHardware[0].source, 'proBootstrap.hardware.startup.remembered-none', 'remembered None source mismatch');
      equal(promptText(), 'Not Calibrated. Load Calibrationfile now?', 'calibration reminder did not follow remembered None');
    `,
    'calibration-only': `
      beginStartupHardwareSelection();
      await wait(100);
      equal(document.getElementById('spStartupHardwarePrompt') != null, true, 'calibration-only startup must show hardware popup');
      equal(promptText(), null, 'remembered calibration raced ahead of hardware popup');
      document.getElementById('spStartupHardwareContinue').click();
      await wait(180);
      equal(restoredCalibrationCalls.length, 1, 'calibration-only startup did not restore after hardware-ready');
      equal(calibrationState.calibrated, true, 'calibration-only startup did not activate calibration');
      notEqual(promptText(), 'Not Calibrated. Load Calibrationfile now?', 'calibration-only startup showed stale Not Calibrated');
      equal(promptText(), 'Switch x-axis to wavelength?', 'calibration-only startup missing wavelength follow-up');
    `
  };
  const phaseScript = phases[phase];
  if (!phaseScript) throw new Error('Unknown phase: ' + phase);

  return `<!doctype html><html><head><meta charset="utf-8"><base href="http://127.0.0.1:${port}/docs/frontend/pages/spectrapro.html"><style>
html,body{margin:0;padding:0;background:#071222;color:#eefaff;font-family:system-ui,sans-serif}
#graphWindowContainer{width:1000px;height:620px;position:relative;margin:20px;background:#0d1c31;overflow:visible}
${styleSafe(panelCss)}</style></head><body data-test-result="RUNNING">
<div id="graphWindowContainer"></div>
<input id="toggleXLabelsPx" type="radio" name="xaxis" checked><input id="toggleXLabelsNm" type="radio" name="xaxis">
<input id="spHardwarePreset"><input id="spHardwareRangeMin"><input id="spHardwareRangeMax"><input id="spHardwareFwhm"><input id="spHardwarePixelResolution"><input id="spHardwareGrating">
<input id="my-file" type="file" hidden><div id="spVersionBadge"></div>
<script>
${seed}
window.__spectraStartupHardwareFlowInstalled=true; window.__spectraStartupHardwareReady=false;
let calibrationFileRequestCount=0;
const nativeInputClick=HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click=function(){
  if(this && this.id==='my-file'){calibrationFileRequestCount+=1;return;}
  return nativeInputClick.call(this);
};
const profilesArray=${JSON.stringify(catalog.profiles)}; const profiles=${JSON.stringify(profileMap)};
const appliedHardware=[]; const restoredCalibrationCalls=[]; const hookHandlers=Object.create(null);
let calibrationState={isCalibrated:false,calibrated:false,points:[],coefficients:[],origin:'none',sampleId:''};
function emitCalibration(payload){ calibrationState=Object.assign({},payload||{}); for(const handler of hookHandlers.calibrationChanged||[]) handler(calibrationState); }
window.emitCalibration=emitCalibration;
window.SpectraCore={calibration:{getState(){return calibrationState;},applyPoints(points,meta={}){const normalized=Array.from(points||[],p=>({px:Number(p.px),nm:Number(p.nm)}));restoredCalibrationCalls.push({points:normalized,meta:Object.assign({},meta)});const payload={ok:normalized.length>=2,isCalibrated:normalized.length>=2,calibrated:normalized.length>=2,points:normalized,pointCount:normalized.length,coefficients:normalized.length>=2?[normalized[0].nm,0.4]:[],origin:String(meta.origin||'user'),sampleId:'',source:String(meta.source||'browser-test')};emitCalibration(payload);return payload;}}};
window.SpectraPro={v15:{calibrationIO:{}},store:{getState(){return {calibration:calibrationState};}},coreHooks:{on(name,handler){(hookHandlers[name]||=[]).push(handler);}}};
function $(id){return document.getElementById(id);} function el(tag,cls){const node=document.createElement(tag);if(cls)node.className=cls;return node;}
function escapeHtml(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function finiteHardwareValue(value){if(value===null||value===undefined||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;}
const STARTUP_HARDWARE_STORAGE_KEY='spectraPro.startup.hardware';
const ids={preset:$('spHardwarePreset'),rangeMin:$('spHardwareRangeMin'),rangeMax:$('spHardwareRangeMax'),fwhm:$('spHardwareFwhm'),pixelRes:$('spHardwarePixelResolution'),grating:$('spHardwareGrating')};
function applyHardware(payload,source){appliedHardware.push({payload,source});return payload;} function fillFormFromState(){}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));} function must(value,message){if(!value)throw new Error(message);return value;}
function equal(actual,expected,message){if(actual!==expected)throw new Error(message+' | expected='+expected+' actual='+actual);} function notEqual(actual,unexpected,message){if(actual===unexpected)throw new Error(message+' | unexpected='+unexpected);} function near(actual,expected,tolerance,message){if(Math.abs(actual-expected)>tolerance)throw new Error(message+' | expected~='+expected+' actual='+actual);}
function promptText(){const prompt=document.getElementById('spCalibrationPrompt');const node=prompt&&prompt.querySelector('.sp-calibration-prompt__text');return node?node.textContent:null;}
async function waitForImage(hostId){const host=must(document.getElementById(hostId),hostId+' missing');const img=must(host.querySelector('img'),hostId+' image element missing');if(!img.complete){await Promise.race([new Promise(resolve=>img.addEventListener('load',resolve,{once:true})),new Promise(resolve=>img.addEventListener('error',resolve,{once:true})),wait(1200)]);}if(!img.complete||img.naturalWidth<=0||img.naturalHeight<=0)throw new Error(hostId+' asset failed to load: '+img.src);}
</script><script>${scriptSafe(calibrationIo)}</script><script>
const minInputBoxNumber=2; const maxInputBoxNumber=15;
function callError(code){throw new Error('calibration import error: '+code);}
function applyCalibrationPoints(points,meta){return window.SpectraCore.calibration.applyPoints(points,meta);}
${scriptSafe(calibrationImportFunction)}
document.getElementById('my-file').addEventListener('change', importCalibrationFile);
</script><script>${scriptSafe(hardwareFunctions)}</script><script>
window.addEventListener('load',async function(){try{${phaseScript}\ndocument.body.dataset.testResult='PASS';}catch(error){document.body.dataset.testResult='FAIL';document.body.dataset.testError=String(error&&error.stack||error).slice(0,1800);}});
</script></body></html>`;
}

function mimeFor(filePath){if(/\.png$/i.test(filePath))return'image/png';if(/\.jpe?g$/i.test(filePath))return'image/jpeg';if(/\.css$/i.test(filePath))return'text/css; charset=utf-8';if(/\.m?js$/i.test(filePath))return'text/javascript; charset=utf-8';if(/\.json$/i.test(filePath))return'application/json; charset=utf-8';return'application/octet-stream';}

async function runChrome(chrome,url,userDataDir){
  const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--window-size=1200,900','--virtual-time-budget=2500','--dump-dom','--user-data-dir='+userDataDir,url];
  return await new Promise((resolve,reject)=>{const child=spawn(chrome,args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Chromium timeout for '+url+'\n'+stderr.slice(-4000)));},15000);child.stdout.on('data',c=>{stdout+=c;});child.stderr.on('data',c=>{stderr+=c;});child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code!==0){reject(new Error('Chromium exited '+code+' for '+url+'\n'+stderr.slice(-5000)));return;}if(!stdout.includes('data-test-result="PASS"')){const marker=stdout.match(/data-test-error="([^"]*)"/);reject(new Error('Browser startup phase failed: '+url+'\n'+(marker?marker[1]:stdout.slice(-6000))+'\n'+stderr.slice(-2500)));return;}resolve(stdout);});});
}

const chrome=findChrome(); let port=0;
const server=http.createServer((req,res)=>{try{const url=new URL(req.url||'/','http://127.0.0.1');if(url.pathname==='/harness'){const html=buildHarness(url.searchParams.get('phase')||'clean',port);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;}const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');const filePath=path.resolve(root,relative);if(!filePath.startsWith(root+path.sep)||!fs.existsSync(filePath)||!fs.statSync(filePath).isFile()){res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');return;}res.writeHead(200,{'content-type':mimeFor(filePath),'cache-control':'no-store'});fs.createReadStream(filePath).pipe(res);}catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end(String(error&&error.stack||error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); port=server.address().port;

const persistentProfile=fs.mkdtempSync(path.join(os.tmpdir(),'spectra-browser-persist-'));
const noneProfile=fs.mkdtempSync(path.join(os.tmpdir(),'spectra-browser-none-'));
const calibrationOnlyProfile=fs.mkdtempSync(path.join(os.tmpdir(),'spectra-browser-calonly-'));
try{
  await runChrome(chrome,`http://127.0.0.1:${port}/harness?phase=clean`,persistentProfile);
  await runChrome(chrome,`http://127.0.0.1:${port}/harness?phase=restore`,persistentProfile);
  await runChrome(chrome,`http://127.0.0.1:${port}/harness?phase=after-reset`,persistentProfile);
  await runChrome(chrome,`http://127.0.0.1:${port}/harness?phase=remembered-none`,noneProfile);
  await runChrome(chrome,`http://127.0.0.1:${port}/harness?phase=calibration-only`,calibrationOnlyProfile);
}finally{await new Promise(resolve=>server.close(resolve));for(const dir of[persistentProfile,noneProfile,calibrationOnlyProfile]){try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}}

console.log('STARTUP FLOW BROWSER: 16-profile UI/assets, centering/layout stability, restart persistence, reset semantics and four startup combinations passed.');
