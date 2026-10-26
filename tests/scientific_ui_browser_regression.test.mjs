import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Small real-Chromium UI smoke for the scientific evidence labels.
// This is NOT a substitute for validating the entire instrument UI on a phone.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/uiPanels.js'), 'utf8');
const css = [
  'html,body{margin:0;padding:0;background:#071222;color:#eefaff}',
  '#spPanel-lab{box-sizing:border-box;width:min(660px,calc(100vw - 32px));max-width:100%;margin:16px;padding:12px;border:1px solid #334455;}',
  fs.readFileSync(path.join(root, 'docs/frontend/styles/mod-panels.css'), 'utf8'),
  fs.readFileSync(path.join(root, 'docs/frontend/styles/mobile-tweaks.css'), 'utf8')
].join('\n');

function chromeBinary() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    const check = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (check.status === 0 && check.stdout.trim()) return check.stdout.trim();
  }
  throw Error('Chrome/Chromium is required for UI smoke testing');
}
function escapeEndScript(text) { return text.replace(/<\/script/gi, '<\\/script'); }
function page(scenario, lang) {
  const gate = scenario === 'none' ? null : {
    applicable: true, candidate: 'CO2', reportable: scenario !== 'insufficient' && scenario !== 'conflict',
    status: scenario === 'strong' ? 'strong-evidence'
      : scenario === 'possible' ? 'possible-identification' : 'insufficient-evidence',
    reason: scenario === 'conflict' ? 'parent-gas-profile-not-identified' : 'insufficient-molecular-band-evidence'
  };
  const source = scenario === 'conflict'
    ? { model: 'catalog-driven-discharge-evidence-v2',
        reportable: false, reason: 'emission-products-do-not-prove-parent-gas',
        parentGasStatus: 'unresolved-indirect-emission',
        emittingSpecies: [{ emitter: 'CO', independentCount: 4 },
          { emitter: 'O I', independentCount: 1, calibrationExtrapolatedCount: 1 }],
        sourceCandidates: [{ species: 'CO2', status: 'fragment-or-indirect-pattern',
          independentDirectCount: 0 }] } : null;
  const data = {
    lang, analysis: {
      elementScores: [{ element: 'CO2', mode: 'molecular', scoreSharePct: 63, matchedPeaks: 4, medianDeltaNm: 0.42 }],
      winnerBreakdown: { primaryEvidence: gate },
      gasTubeSourceAssessment: source, tentativeLineMatches: []
    }
  };
  const setup = 'var testConfig=' + JSON.stringify(data) + ';' +
    'window.SpectraPro={store:{getState:function(){return {analysis:testConfig.analysis};}},' +
    'i18n:{getLanguage:function(){return testConfig.lang;}},eventBus:{on:function(){}}};';
  const expected = scenario === 'none' ? 'Best match:'
    : scenario === 'strong' ? 'Strong evidence:'
      : scenario === 'possible' ? 'Möjlig identifiering:'
        : scenario === 'insufficient' ? 'Top candidate:' : 'Högst rankad kandidat:';
  const verify = 'window.addEventListener("load",function(){setTimeout(function(){try{' +
    'var header=document.querySelector(".sp-lab-th");' +
    'var summary=document.querySelector(".sp-es-summary");' +
    'var text=summary.textContent;' +
    'if(header.textContent.trim()!=="MATCH SCORE")throw Error("header not updated");' +
    'if(!text.includes(' + JSON.stringify(expected) + '))throw Error("missing evidence label: "+text);' +
    'if(!text.includes("Score share 63%"))throw Error("score share label missing");' +
    'if(' + JSON.stringify(scenario === 'none') + ' && text.includes("Strong evidence"))throw Error("unsupported strong label");' +
    'if(' + JSON.stringify(scenario === 'conflict') + ' && !text.includes("CO (4)"))throw Error("missing measured emitter candidates");' +
    'if(' + JSON.stringify(scenario === 'conflict') + ' && !text.includes("extrapolerade: 1"))throw Error("missing extrapolated evidence warning");' +
    'if(' + JSON.stringify(scenario === 'conflict') + ' && !text.includes("Linjer från emissionsprodukter räcker inte"))throw Error("missing generic parent-gas warning");' +
    'var r=document.getElementById("spPanel-lab").getBoundingClientRect();' +
    'if(r.left<-1||r.right>window.innerWidth+1)throw Error("LAB panel outside viewport: "+r.right+"/"+window.innerWidth);' +
    'document.body.dataset.browserResult="PASS";' +
    '}catch(e){document.body.dataset.browserResult="FAIL";document.body.dataset.browserError=String(e.stack||e).slice(0,900);}},120);});';
  return [
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>SPECTRA PRO scientific UI smoke</title><style>', css, '</style></head>',
    '<body data-browser-result="RUNNING"><div id="sidebarLogo"></div><div id="spPanel-lab">',
    '<div class="sp-lab-th">ELEMENT SCORE</div><div class="sp-es-summary"></div>',
    '</div><script>', escapeEndScript(setup), '</script><script>', escapeEndScript(ui),
    '</script><script>', escapeEndScript(verify), '</script></body></html>'
  ].join('');
}
function runChrome(chrome, url, profile, width) {
  return new Promise((resolve, reject) => {
    const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--window-size=' + width + ',850', '--virtual-time-budget=1400', '--dump-dom',
      '--user-data-dir=' + profile, url];
    const child = spawn(chrome, args, { stdio: ['ignore','pipe','pipe'] });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Chromium timeout')); }, 20000);
    child.stdout.on('data', c => { stdout += c; });
    child.stderr.on('data', c => { stderr += c; });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0 || !stdout.includes('data-browser-result="PASS"')) {
        const error = stdout.match(/data-browser-error="([^"]+)"/);
        reject(Error('Scientific browser UI failed: ' + url + ' (exit ' + code + ') ' +
          (error ? error[1] : stdout.slice(-1200)) + stderr.slice(-700)));
      } else resolve();
    });
  });
}
const cases = [
  ['strong', 'en', 1180],
  ['possible', 'sv', 390],
  ['insufficient', 'en', 390],
  ['conflict', 'sv', 390],
  ['none', 'en', 1180]
];
const chrome = chromeBinary();
const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1');
  if (u.pathname !== '/harness') { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(page(u.searchParams.get('scenario'), u.searchParams.get('lang')));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
try {
  for (const [scenario, lang, width] of cases) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-science-ui-'));
    try {
      await runChrome(chrome, 'http://127.0.0.1:' + port + '/harness?scenario=' + scenario + '&lang=' + lang,
        profile, width);
    } finally { fs.rmSync(profile, { recursive: true, force: true }); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
assert.equal(cases.length, 5);
console.log('SCIENTIFIC UI CHROMIUM: 5 evidence/ambiguity scenarios across narrow and wide layouts passed.');
