'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/data/hardware_profiles.json'), 'utf8'));
const bootstrap = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/proBootstrap.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const help = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/helpUi.js'), 'utf8');
const hardwareSources = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/assets/hardware/sources.json'), 'utf8'));

assert.equal(catalog.schema, 'spectra-pro-hardware-profile-catalog/v1');
assert.ok(Array.isArray(catalog.profiles) && catalog.profiles.length >= 10, 'hardware catalog should expose a useful global starter set');
assert.equal(catalog.profiles.length, 16, 'startup hardware catalog must contain exactly the 16 reviewed profiles');

const ids = new Set();
for (const profile of catalog.profiles) {
  assert.ok(profile.profileId && profile.profileName, 'every hardware profile needs stable identity');
  assert.ok(profile.imageUrl, profile.profileId + ' needs a startup product image');
  assert.ok(profile.imageUrl.startsWith('../assets/hardware/'), profile.profileId + ' product image must use the bundled hardware asset directory');
  const imagePath = path.resolve(root, 'docs/frontend/data', profile.imageUrl);
  assert.ok(fs.existsSync(imagePath), profile.profileId + ' product image must exist: ' + profile.imageUrl);
  const imageBytes = fs.readFileSync(imagePath);
  assert.ok(imageBytes.length > 4 && imageBytes[0] === 0xff && imageBytes[1] === 0xd8, profile.profileId + ' product image must be a readable JPEG asset');
  assert.ok(profile.logoUrl && profile.logoUrl.startsWith('../assets/hardware/logos/'), profile.profileId + ' needs a bundled manufacturer logo');
  const logoPath = path.resolve(root, 'docs/frontend/data', profile.logoUrl);
  assert.ok(fs.existsSync(logoPath), profile.profileId + ' manufacturer logo must exist: ' + profile.logoUrl);
  const logoBytes = fs.readFileSync(logoPath);
  assert.ok(logoBytes.length > 8 && logoBytes[0] === 0x89 && logoBytes[1] === 0x50 && logoBytes[2] === 0x4e && logoBytes[3] === 0x47, profile.profileId + ' manufacturer logo must be a readable PNG asset');
  assert.ok(!ids.has(profile.profileId), 'hardware profile IDs must be unique: ' + profile.profileId);
  ids.add(profile.profileId);
  assert.ok(Number.isFinite(Number(profile.spectralRangeMinNm)), profile.profileId + ' needs a finite range start');
  assert.ok(Number.isFinite(Number(profile.spectralRangeMaxNm)), profile.profileId + ' needs a finite range end');
  assert.ok(Number(profile.spectralRangeMaxNm) > Number(profile.spectralRangeMinNm), profile.profileId + ' needs an increasing wavelength range');
  if (profile.spectrometerResolutionFwhmNm != null) assert.ok(Number(profile.spectrometerResolutionFwhmNm) > 0, profile.profileId + ' FWHM must be positive');
  if (profile.pixelResolutionNm != null) assert.ok(Number(profile.pixelResolutionNm) > 0, profile.profileId + ' pixel scale must be positive');
  if (profile.gratingLinesPerMm != null) assert.ok(Number(profile.gratingLinesPerMm) > 0, profile.profileId + ' grating density must be positive');
}

const expectedHardwareContract = {
  'spectra-1': ['KVANT', 'Spectra-1', 360, 930, 1.8, 0.5, 500],
  'vernier-gdx-svispl': ['Vernier', 'Go Direct SpectroVis Plus', 380, 950, 5, 1, null],
  'vernier-gdx-spec-vis': ['Vernier', 'Go Direct Visible Spectrophotometer', 380, 950, 3, 1, null],
  'vernier-gdx-spec-fuv': ['Vernier', 'Go Direct Fluorescence/UV-VIS Spectrophotometer', 220, 850, 3, 1, null],
  'pasco-ps-2600a': ['PASCO', 'PS-2600A', 390, 950, 3, 0.4, null],
  'pasco-uv-vis': ['PASCO', 'UV-Vis Spectrometer', 180, 1050, 1.5, 0.3, 500],
  'ocean-st-uv-25': ['Ocean Optics', 'ST-UV', 185, 650, 2.2, null, 600],
  'ocean-st-vis-25': ['Ocean Optics', 'ST-VIS', 350, 810, 2.2, null, 600],
  'ocean-st-nir-25': ['Ocean Optics', 'ST-NIR', 645, 1085, 2.2, null, 600],
  'thorlabs-ccs100': ['Thorlabs', 'CCS100', 350, 700, 0.5, null, 1200],
  'thorlabs-ccs175': ['Thorlabs', 'CCS175', 500, 1000, 0.6, null, 830],
  'thorlabs-ccs200': ['Thorlabs', 'CCS200', 200, 1000, 2, null, 600],
  'avantes-uls2048cl-evo-custom': ['Avantes', 'AvaSpec-ULS2048CL-EVO', 200, 1100, null, null, null],
  'stellarnet-blue-wave-vis-25': ['StellarNet', 'BLUE-Wave VIS', 350, 1150, 1, null, 600],
  'hamamatsu-c12880ma': ['Hamamatsu Photonics', 'C12880MA', 340, 850, 12, null, null],
  'hamamatsu-c11708ma': ['Hamamatsu Photonics', 'C11708MA', 640, 1050, 15, null, null]
};

for (const profile of catalog.profiles) {
  const expected = expectedHardwareContract[profile.profileId];
  assert.ok(expected, 'unexpected startup hardware profile: ' + profile.profileId);
  assert.deepEqual(
    [
      profile.manufacturer,
      profile.model,
      profile.spectralRangeMinNm,
      profile.spectralRangeMaxNm,
      profile.spectrometerResolutionFwhmNm,
      profile.pixelResolutionNm,
      profile.gratingLinesPerMm
    ],
    expected,
    profile.profileId + ' startup metadata changed from the reviewed contract'
  );
}
assert.equal(Object.keys(expectedHardwareContract).length, catalog.profiles.length, 'every reviewed startup profile must be represented exactly once');

const uniqueLogoUrls = new Set(catalog.profiles.map((profile) => profile.logoUrl));
assert.equal(uniqueLogoUrls.size, 8, 'hardware catalog must reuse exactly one normalized logo per supported manufacturer');

const uniqueImageUrls = new Set(catalog.profiles.map((profile) => profile.imageUrl));
assert.equal(uniqueImageUrls.size, 12, 'hardware catalog must use the 12 verified product/family image assets');

const verifiedAssets = hardwareSources.assets || [];
assert.equal(verifiedAssets.length, 12, 'product-image provenance must cover every unique hardware image asset');
for (const asset of verifiedAssets) {
  assert.equal(asset.verifiedAgainstOfficialProductMaterial, true, asset.file + ' must be explicitly verified against official product material');
  assert.equal(asset.verifiedDate, '2026-09-28', asset.file + ' must record the product-image verification date');
  assert.ok(asset.verificationNote, asset.file + ' must document what was verified');
}
const stellarProductSource = verifiedAssets.find((asset) => asset.file === 'stellarnet-blue-wave.jpg');
assert.ok(stellarProductSource, 'StellarNet BLUE-Wave product image provenance is required');
assert.equal(stellarProductSource.sourceKind, 'manufacturer-product-image', 'StellarNet BLUE-Wave must use a direct manufacturer product image');
assert.equal(stellarProductSource.sourcePage, 'https://www.stellarnet.us/spectrometers/uv-vis-spectrometers/blue-wave/', 'StellarNet BLUE-Wave verification must point to the manufacturer product page');
assert.equal(stellarProductSource.sourceUrl, 'https://www.stellarnet.us/wp-content/uploads/BLUE-Wave-Spectrometer-side.jpg', 'StellarNet BLUE-Wave must use the clean official side product photo');
assert.ok(String(stellarProductSource.processingNote || '').includes('no product geometry altered'), 'StellarNet product-image processing must explicitly preserve hardware geometry');


for (const required of ['spectra-1','vernier-gdx-svispl','pasco-ps-2600a','pasco-uv-vis','ocean-st-uv-25','ocean-st-vis-25','ocean-st-nir-25','thorlabs-ccs100','thorlabs-ccs175','thorlabs-ccs200','avantes-uls2048cl-evo-custom','stellarnet-blue-wave-vis-25','hamamatsu-c12880ma','hamamatsu-c11708ma']) {
  assert.ok(ids.has(required), 'missing starter hardware profile: ' + required);
}

assert.ok(bootstrap.includes("window.fetch('../data/hardware_profiles.json?v=1.4.0-startup-2')"), 'hardware UI must load a cache-busted central catalog with the browser global');
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
assert.ok(bootstrap.includes('<b title="' + "' + safeValue + '" + '">' + "' + safeValue + '" + '</b>'), 'startup hardware metadata must preserve the full value in a hover title while keeping layout stable');
assert.ok(bootstrap.includes("renderStartupHardwareAsset(image, profile.imageUrl || ''"), 'startup hardware popup must render each selected profile imageUrl');
assert.ok(bootstrap.includes("renderStartupHardwareAsset(logo, profile.logoUrl || ''"), 'startup hardware popup must render each selected manufacturer logoUrl');
assert.ok(bootstrap.includes("return manufacturer !== 'PASCO' && manufacturer !== 'StellarNet';"), 'startup logo renderer must preserve PASCO and StellarNet native branding while whitening darker wordmarks');
assert.ok(bootstrap.includes("logo.classList.toggle('sp-startup-hardware__logo--white'"), 'startup logo renderer must apply the white-wordmark class per profile');
assert.ok(bootstrap.includes("new URL(String(url), document.baseURI).href"), 'startup hardware images must resolve relative asset URLs against the published page');
assert.ok(bootstrap.includes("img.addEventListener('error', showPlaceholder"), 'startup hardware images must fall back to a placeholder if an asset cannot load');
assert.ok(bootstrap.includes("img.loading = 'eager'"), 'visible startup hardware images must load eagerly');
assert.ok(bootstrap.includes("ids.fwhm && ids.fwhm.value !== '' ? Number(ids.fwhm.value) : null"), 'blank FWHM must remain null rather than becoming zero');
assert.ok(bootstrap.includes("profile.spectrometerResolutionFwhmNm != null ? String(profile.spectrometerResolutionFwhmNm) : ''"), 'unknown profile FWHM must render as a blank field');
assert.ok(bootstrap.includes("profile.pixelResolutionNm != null ? String(profile.pixelResolutionNm) : ''"), 'unknown profile pixel scale must render as a blank field');
assert.ok(bootstrap.includes("profile.gratingLinesPerMm != null ? String(profile.gratingLinesPerMm) : ''"), 'unknown profile grating density must render as a blank field');
assert.ok(bootstrap.includes("if (value === null || value === undefined || value === '') return null;"), 'nullable hardware values must remain null instead of coercing to zero');
assert.ok(!bootstrap.includes('Number.isFinite(Number(hw.spectrometerResolutionFwhmNm))'), 'summary/form rendering must not coerce null hardware values through Number(null)');
assert.ok(readme.includes('KVANT, Vernier, PASCO, Ocean Optics, Thorlabs, Avantes, StellarNet and Hamamatsu'), 'README must document the multi-spectrometer starter catalog');
assert.ok(readme.includes('CUSTOM'), 'README must document custom spectrometer support');
assert.ok(help.includes("const HELP_VERSION = '1.4.0';"), 'in-app HELP version must match canonical v1.4.0 documentation');
assert.ok(help.includes('KVANT, Vernier, PASCO, Ocean Optics, Thorlabs, Avantes, StellarNet and Hamamatsu'), 'in-app HELP must document the multi-spectrometer starter catalog');
assert.ok(help.includes('instrument-response correction requires a separate compatible measured response profile'), 'HELP must keep hardware metadata separate from response correction');
const thorlabsLogoSource = (hardwareSources.logos || []).find((item) => item.manufacturer === 'Thorlabs');
assert.ok(thorlabsLogoSource && thorlabsLogoSource.sourcePage === 'https://commons.wikimedia.org/wiki/File:Thorlabs_logo.png', 'Thorlabs UI logo must use the clean wordmark source rather than a brochure/photo crop');
assert.ok(String(thorlabsLogoSource.processingNote || '').includes('Clean transparent THORLABS wordmark'), 'Thorlabs logo provenance must document the repaired transparent wordmark');

console.log('Hardware profile catalog regression: PASS');
