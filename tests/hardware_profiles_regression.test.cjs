'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/data/hardware_profiles.json'), 'utf8'));
const bootstrap = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/proBootstrap.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const help = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/helpUi.js'), 'utf8');

assert.equal(catalog.schema, 'spectra-pro-hardware-profile-catalog/v1');
assert.ok(Array.isArray(catalog.profiles) && catalog.profiles.length >= 10, 'hardware catalog should expose a useful global starter set');

const ids = new Set();
for (const profile of catalog.profiles) {
  assert.ok(profile.profileId && profile.profileName, 'every hardware profile needs stable identity');
  assert.ok(!ids.has(profile.profileId), 'hardware profile IDs must be unique: ' + profile.profileId);
  ids.add(profile.profileId);
  assert.ok(Number.isFinite(Number(profile.spectralRangeMinNm)), profile.profileId + ' needs a finite range start');
  assert.ok(Number.isFinite(Number(profile.spectralRangeMaxNm)), profile.profileId + ' needs a finite range end');
  assert.ok(Number(profile.spectralRangeMaxNm) > Number(profile.spectralRangeMinNm), profile.profileId + ' needs an increasing wavelength range');
  if (profile.spectrometerResolutionFwhmNm != null) assert.ok(Number(profile.spectrometerResolutionFwhmNm) > 0, profile.profileId + ' FWHM must be positive');
  if (profile.pixelResolutionNm != null) assert.ok(Number(profile.pixelResolutionNm) > 0, profile.profileId + ' pixel scale must be positive');
  if (profile.gratingLinesPerMm != null) assert.ok(Number(profile.gratingLinesPerMm) > 0, profile.profileId + ' grating density must be positive');
}

for (const required of ['spectra-1','vernier-gdx-svispl','pasco-ps-2600a','pasco-uv-vis','ocean-st-uv-25','ocean-st-vis-25','ocean-st-nir-25','thorlabs-ccs100','thorlabs-ccs175','thorlabs-ccs200','avantes-uls2048cl-evo-custom','stellarnet-blue-wave-vis-25','hamamatsu-c12880ma','hamamatsu-c11708ma']) {
  assert.ok(ids.has(required), 'missing starter hardware profile: ' + required);
}

assert.ok(bootstrap.includes("window.fetch('../data/hardware_profiles.json')"), 'hardware UI must load the central catalog with the browser global');
assert.ok(!bootstrap.includes('global.fetch'), 'browser hardware loading must not depend on an undefined Node-style global');
assert.ok(bootstrap.includes('<option value="">CUSTOM</option>'), 'manual CUSTOM hardware must remain available');
assert.ok(!bootstrap.includes('<option value="spectra-1">KVANT - Spectra-1</option>'), 'known hardware options must not be hard-coded into the UI markup');
assert.ok(bootstrap.includes("store.update('hardware'"), 'hardware profiles must continue to use canonical state.hardware');
assert.ok(bootstrap.includes('Select Hardware'), 'startup must present a dedicated hardware selection popup');
assert.ok(bootstrap.includes('<option value="">None</option>'), 'startup hardware selection must default to None');
assert.ok(bootstrap.includes('Remember hardware'), 'startup hardware selection must expose a Remember hardware checkbox');
assert.ok(bootstrap.includes("const STARTUP_HARDWARE_STORAGE_KEY = 'spectraPro.startup.hardware';"), 'remembered hardware must use stable localStorage state');
assert.ok(bootstrap.includes("window.dispatchEvent(new CustomEvent('spectra:startup-hardware-ready'"), 'hardware startup must explicitly release the calibration step');
assert.ok(bootstrap.includes("'Company logo'") && bootstrap.includes("'Hardware image'"), 'startup hardware popup must reserve logo and hardware-image placeholders');
assert.ok(bootstrap.includes("hardwareStartupMetric('Manufacturer'") && bootstrap.includes("hardwareStartupMetric('Configured range'"), 'startup hardware selection must preview profile metadata');
assert.ok(bootstrap.includes("ids.fwhm && ids.fwhm.value !== '' ? Number(ids.fwhm.value) : null"), 'blank FWHM must remain null rather than becoming zero');
assert.ok(bootstrap.includes("profile.spectrometerResolutionFwhmNm != null ? String(profile.spectrometerResolutionFwhmNm) : ''"), 'unknown profile FWHM must render as a blank field');
assert.ok(bootstrap.includes("profile.pixelResolutionNm != null ? String(profile.pixelResolutionNm) : ''"), 'unknown profile pixel scale must render as a blank field');
assert.ok(bootstrap.includes("profile.gratingLinesPerMm != null ? String(profile.gratingLinesPerMm) : ''"), 'unknown profile grating density must render as a blank field');
assert.ok(bootstrap.includes("if (value === null || value === undefined || value === '') return null;"), 'nullable hardware values must remain null instead of coercing to zero');
assert.ok(!bootstrap.includes('Number.isFinite(Number(hw.spectrometerResolutionFwhmNm))'), 'summary/form rendering must not coerce null hardware values through Number(null)');
assert.ok(readme.includes('KVANT, Vernier, PASCO, Ocean Optics, Thorlabs, Avantes, StellarNet and Hamamatsu'), 'README must document the multi-spectrometer starter catalog');
assert.ok(readme.includes('CUSTOM'), 'README must document custom spectrometer support');
assert.ok(help.includes("const HELP_VERSION = '1.3.9';"), 'in-app HELP version must match v1.3.9 documentation');
assert.ok(help.includes('KVANT, Vernier, PASCO, Ocean Optics, Thorlabs, Avantes, StellarNet and Hamamatsu'), 'in-app HELP must document the multi-spectrometer starter catalog');
assert.ok(help.includes('instrument-response correction requires a separate compatible measured response profile'), 'HELP must keep hardware metadata separate from response correction');

console.log('Hardware profile catalog regression: PASS');
