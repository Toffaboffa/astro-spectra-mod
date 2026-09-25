/*
  Compact scientific regression suite for the worker analysis path.

  Run:
    node tests/analysis_regression.test.js

  The suite executes production worker modules in a VM context. It deliberately
  avoids browser automation, image decoding, screenshots, and network access.
*/

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const fixtureDir = path.join(__dirname, 'fixtures');
const workerDir = path.join(repoRoot, 'docs', 'frontend', 'workers');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));
}

function within(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected a finite value, got ${actual}`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
  );
}

function loadWorkerContext() {
  const context = vm.createContext({ console });
  context.self = context;
  [
    'peakDetect.js',
    'peakScoring.js',
    'lineMatcher.js',
    'qcRules.js',
    'confidenceModel.js',
    'spectrumMath.js',
    'presetResolver.js',
    'calibrationDiagnostics.js',
    'spectralFeatures.js',
    'diffractionArtifacts.js',
    'measurementQuality.js',
    'candidateAnalysis.js',
    'astroReferences.js',
    'astroContinuum.js',
    'dopplerEstimate.js',
    'astroAnalysis.js',
    'stellarClassification.js',
    'referenceComparison.js',
    'analysisPipeline.js',
    'plasmaProfiles.js',
    'molecularEvidencePatch.js',
    'atomicProfiles.js',
    'atomicEvidence.js',
    'fluorescenceAnalysis.js'
  ].forEach(function (name) {
    const source = fs.readFileSync(path.join(workerDir, name), 'utf8');
    new vm.Script(source, { filename: name }).runInContext(context);
  });
  context.window = context;
  [
    'subtraction.js',
    'quickPeaks.js',
    'instrumentResponse.js',
    'responseProfileStore.js',
    'processingPipeline.js',
    'stateStore.js',
    'referenceCatalog.js',
    'presets.js'
  ].forEach(function (name) {
    const source = fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', name), 'utf8');
    new vm.Script(source, { filename: name }).runInContext(context);
  });
  return context;
}

const worker = loadWorkerContext();

function analyze(frame, options, libraries) {
  const state = {
    librariesLoaded: true,
    atomLines: (libraries && libraries.atomLines) || [],
    molecularBands: (libraries && libraries.molecularBands) || [],
    activePreset: options && options.preset
  };
  let result = worker.SPECTRA_PRO_analysisPipeline.analyzeFrame(frame, state, options || {});
  if (result && result.ok && result.mode === 'astro') {
    // ASTRO is already finalized by its own interpretation layer.
  } else if (result && result.ok && result.presetId === 'smart-fluorescent') {
    result = worker.SPECTRA_PRO_atomicEvidence.enhance(result, frame, state, options || {});
    result = worker.SPECTRA_PRO_fluorescenceAnalysis.enhance(result, frame, state, options || {});
  } else if (result && result.ok) {
    result = worker.SPECTRA_PRO_atomicEvidence.enhance(result, frame, state, options || {});
  }
  if (result && result.ok) result = worker.SPECTRA_PRO_analysisPipeline.finalizeResult(result, frame, options || {});
  return result;
}

function testAstroContinuumAndAbsorption() {
  const fixture = readJson('sample_astro_absorption_spectrum.json');
  assert.equal(fixture.synthetic, true, 'ASTRO fixture must identify itself as synthetic');
  const nm = [];
  const intensity = [];
  const expectedContinuum = [];
  const count = Math.round((fixture.grid.endNm - fixture.grid.startNm) / fixture.grid.stepNm);
  for (let index = 0; index <= count; index += 1) {
    const wavelength = fixture.grid.startNm + index * fixture.grid.stepNm;
    const baseline = fixture.continuum.intercept + fixture.continuum.slopePerNm * (wavelength - fixture.continuum.pivotNm);
    let absorption = 0;
    fixture.features.forEach(function (feature) {
      absorption += feature.depth * Math.exp(-0.5 * Math.pow((wavelength - feature.centerNm) / feature.sigmaNm, 2));
    });
    const noise = fixture.noise.amplitude * Math.sin((2 * Math.PI * index) / fixture.noise.periodSamples);
    nm.push(+wavelength.toFixed(6));
    expectedContinuum.push(baseline);
    intensity.push(baseline * (1 - absorption) + noise);
  }
  const frame = { calibrated: true, nm: nm, px: nm.map(function (_, index) { return index; }), I: intensity };
  const result = analyze(frame, {
    analysisContext: 'astro',
    maxDistanceNm: 1.8,
    calibration: fixture.calibration,
    hardware: fixture.hardware
  });

  assert.equal(result.ok, true, 'ASTRO analysis should succeed');
  assert.equal(result.mode, 'astro', 'ASTRO should use the shared worker API with an explicit context');
  assert.equal(result.astro.continuum.state, 'available', 'Continuum should be available for valid data');
  assert.equal(result.astro.continuum.rawIntensity.length, intensity.length, 'Raw samples should remain available');
  assert.equal(result.astro.continuum.continuum.length, intensity.length, 'Continuum samples should align with input');
  assert.equal(result.astro.continuum.normalized.length, intensity.length, 'Normalized samples should align with input');
  const errors = result.astro.continuum.continuum.map(function (value, index) { return Math.abs(value - expectedContinuum[index]); });
  assert.ok(worker.SPECTRA_PRO_spectrumMath.median(errors) <= fixture.expected.continuumMedianAbsErrorMax, 'Continuum should tolerate absorption dips without fitting through them');

  fixture.expected.featureCentersNm.forEach(function (expectedNm) {
    const nearest = result.features.slice().sort(function (a, b) { return Math.abs(a.centerNm - expectedNm) - Math.abs(b.centerNm - expectedNm); })[0];
    assert.ok(nearest, `Expected an absorption feature near ${expectedNm} nm`);
    within(nearest.centerNm, expectedNm, fixture.expected.centerToleranceNm, `ASTRO absorption center ${expectedNm}`);
    assert.equal(nearest.polarity, 'absorption', 'ASTRO features must preserve absorption polarity');
    assert.ok(nearest.depth > 0, 'Absorption depth must be positive');
    assert.ok(Number.isFinite(nearest.fwhmNm), 'Resolved synthetic feature should expose FWHM');
    assert.ok(nearest.equivalentWidthNm < 0, 'Absorption equivalent width should follow the negative sign convention');
  });

  const labels = result.topHits.map(function (hit) { return hit.label; });
  fixture.expected.requiredReferenceLabels.forEach(function (label) {
    assert.ok(labels.includes(label), `Expected curated ASTRO reference match ${label}`);
  });
  assert.equal(result.astro.referenceSet.wavelengthMedium, 'air', 'Reference wavelength medium must be explicit');
  assert.equal(result.measurementQuality.dimensions.calibration.status, 'good', 'Consistent calibration should remain visible to ASTRO quality assessment');
  assert.ok(result.astro.limitations.includes('reference-match-is-not-a-stellar-classification'), 'Reference matches must not be promoted to a stellar classification');
  assert.ok(result.astro.limitations.includes('radial-velocity-is-not-barycentric-or-heliocentric-corrected'), 'Missing observer-motion correction must be explicit');
  assert.ok(result.astro.limitations.includes('continuum-shape-requires-instrument-response-context'), 'Uncorrected continuum shape must retain its instrument-response limitation');

  const uncalibrated = analyze({ calibrated: false, I: intensity }, { analysisContext: 'astro' });
  assert.equal(uncalibrated.ok, true, 'Uncalibrated spectra may still be continuum-normalized');
  assert.ok(uncalibrated.features.length > 0, 'Uncalibrated spectra should retain sample-space absorption measurements');
  assert.equal(uncalibrated.topHits.length, 0, 'Uncalibrated samples must not be matched as wavelengths');
  assert.ok(uncalibrated.qcFlags.includes('uncalibrated'), 'Uncalibrated ASTRO matching limitation must be explicit');
}

function testBundledSolarExample() {
  const fixture = readJson('sample_solar_spectrum.json');
  assert.equal(fixture.synthetic, false, 'Solar fixture must identify the bundled data as non-synthetic');
  const assetFile = path.join(repoRoot, fixture.assetPath);
  const normalizedAssetText = fs.readFileSync(assetFile, 'utf8').replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalizedAssetText, 'utf8');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.sha256, 'Bundled solar asset checksum should be stable');
  const asset = JSON.parse(bytes.toString('utf8'));
  const expected = fixture.expected;
  assert.equal(asset.schema, expected.schema, 'Solar asset schema should remain versioned');
  assert.equal(asset.id, expected.assetId, 'Solar asset ID should remain stable');
  assert.equal(asset.scientificRole, 'measured-reference-spectrum', 'Solar data must not be represented as synthetic');
  assert.equal(asset.wavelengthMedium, expected.wavelengthMedium, 'Solar wavelengths must explicitly use the ASTRO air-wavelength convention');
  assert.deepEqual(asset.grid, expected.grid, 'Solar grid metadata should match the bundled arrays');
  assert.equal(asset.wavelengthNm.length, expected.grid.count, 'Solar wavelength sample count should be stable');
  assert.equal(asset.irradianceWm2Nm.length, expected.grid.count, 'Solar irradiance sample count should be stable');
  assert.equal(asset.provenance.provider.includes('Laboratory for Atmospheric and Space Physics'), true, 'Solar provider should be documented');
  assert.equal(asset.provenance.primaryReferenceDoi, '10.1029/2020GL091709', 'Solar primary reference should be documented');
  assert.equal(asset.provenance.sourceWavelengthMedium, 'vacuum', 'Source wavelength medium should be documented before conversion');
  assert.equal(asset.provenance.conversion.doi, '10.1088/0026-1394/2/2/002', 'Vacuum-to-air conversion should be traceable');

  const exampleContext = vm.createContext({ console: console, setTimeout: function () {} });
  exampleContext.window = exampleContext;
  exampleContext.SpectraPro = {};
  new vm.Script(
    fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', 'exampleSpectrumUi.js'), 'utf8'),
    { filename: 'exampleSpectrumUi.js' }
  ).runInContext(exampleContext);
  const catalog = exampleContext.SpectraPro.exampleSpectrumUi;
  assert.ok(catalog.getCatalog().includes('solar-tsis1-hsrs'), 'Load Example catalog should expose the Solar sample');
  const solarConfig = catalog.getConfig('solar-tsis1-hsrs');
  assert.equal(solarConfig.kind, 'numeric', 'Solar example should use the numeric source path');
  assert.equal(solarConfig.numeric.path.endsWith('solar-tsis1-hsrs-visible-0p2nm.json'), true, 'Solar catalog should reference the bundled asset');
  assert.equal(solarConfig.recommendedMode, 'ASTRO', 'Solar example should recommend ASTRO mode');

  asset.wavelengthNm.forEach(function (wavelength, index) {
    assert.ok(Number.isFinite(wavelength), 'Solar wavelengths must be finite');
    assert.ok(Number.isFinite(asset.irradianceWm2Nm[index]) && asset.irradianceWm2Nm[index] >= 0, 'Solar irradiance must be finite and non-negative');
    if (index > 0) within(wavelength - asset.wavelengthNm[index - 1], expected.grid.stepNm, 1e-9, 'Solar wavelength step');
  });

  expected.absorptionFeatures.forEach(function (feature) {
    let nearest = 0;
    for (let index = 1; index < asset.wavelengthNm.length; index += 1) {
      if (Math.abs(asset.wavelengthNm[index] - feature.centerNm) < Math.abs(asset.wavelengthNm[nearest] - feature.centerNm)) nearest = index;
    }
    const shoulderSamples = 4;
    const shoulder = (asset.irradianceWm2Nm[nearest - shoulderSamples] + asset.irradianceWm2Nm[nearest + shoulderSamples]) / 2;
    assert.ok(
      asset.irradianceWm2Nm[nearest] / shoulder <= feature.maxCenterToShoulderRatio,
      `${feature.label} should remain a measurable absorption feature in the compact asset`
    );
  });

  const frame = {
    calibrated: true,
    nm: asset.wavelengthNm,
    px: asset.wavelengthNm.map(function (_, index) { return index; }),
    I: asset.irradianceWm2Nm,
    calibration: asset.calibration,
    hardware: { spectrometerResolutionFwhmNm: 0.4, pixelResolutionNm: 0.2 }
  };
  const result = analyze(frame, {
    analysisContext: 'astro',
    maxDistanceNm: 1.8,
    calibration: asset.calibration,
    hardware: frame.hardware
  });
  assert.equal(result.ok, true, 'Bundled solar spectrum should run through production ASTRO analysis');
  assert.equal(result.astro.continuum.state, 'available', 'Bundled solar spectrum should produce a continuum estimate');
  const labels = result.topHits.map(function (hit) { return hit.label; });
  expected.requiredReferenceLabels.forEach(function (label) {
    assert.ok(labels.includes(label), `Bundled solar spectrum should match ${label}; got ${labels.join(', ')}`);
  });
  assert.equal(result.astro.stellarClassification.state, 'available', 'Solar example should produce broad stellar-class evidence');
  assert.equal(result.astro.stellarClassification.bestClass, 'G', 'Solar line pattern should rank G-class evidence first');
  assert.ok(result.astro.stellarClassification.reasons.length >= 2, 'Solar classification should expose multiple visible reasons');
  assert.equal(result.astro.stellarClassification.diagnostics.continuumUsed, false, 'Uncorrected continuum shape must not affect classification');
}

function testBundledFluorescentExample() {
  const imageFile = path.join(repoRoot, 'docs', 'frontend', 'assets', 'examples', 'fluorescent-tube', 'fluorescent-tube.png');
  const image = fs.readFileSync(imageFile);
  assert.deepEqual(Array.from(image.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], 'Fluorescent example must remain a PNG');
  assert.equal(image.readUInt32BE(16), 1280, 'Fluorescent example width should remain 1280 px');
  assert.equal(image.readUInt32BE(20), 720, 'Fluorescent example height should remain 720 px');
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'), 'ecd5cc32f7eceb11778e69ba568b56ba6f8261b929b91e880d80a0507e2c38c3', 'Fluorescent example pixels/source canvas must remain exact');

  const iconFile = path.join(repoRoot, 'docs', 'frontend', 'assets', 'examples', 'icons', 'fluorescent-tube-white-256.png');
  const icon = fs.readFileSync(iconFile);
  assert.equal(icon.readUInt32BE(16), 256, 'Fluorescent chooser icon width should remain 256 px');
  assert.equal(icon.readUInt32BE(20), 144, 'Fluorescent chooser icon height should remain 144 px');
  assert.equal(crypto.createHash('sha256').update(icon).digest('hex'), '8916ead095c2767e255028dcfba0d13468417b31017e0d16d767a362b3a6761d', 'Fluorescent chooser icon should remain exact');

  const exampleContext = vm.createContext({ console: console, setTimeout: function () {} });
  exampleContext.window = exampleContext;
  exampleContext.SpectraPro = {};
  new vm.Script(
    fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', 'exampleSpectrumUi.js'), 'utf8'),
    { filename: 'exampleSpectrumUi.js' }
  ).runInContext(exampleContext);
  const catalog = exampleContext.SpectraPro.exampleSpectrumUi;
  assert.ok(catalog.getCatalog().includes('fluorescent-tube'), 'Load Example catalog should expose the fluorescent-tube sample');
  const config = catalog.getConfig('fluorescent-tube');
  assert.equal(config.kind, 'image', 'Fluorescent example should use the normal still-image path');
  assert.equal(config.recommendedMode, 'LAB', 'Fluorescent example should remain a LAB sample');
  assert.equal(config.recommendedPreset, 'smart-fluorescent', 'Fluorescent example should recommend Fluorescent analysis');
  assert.equal(config.stripe.widthPx, 5, 'Fluorescent example should use a 5 px stripe');
  assert.equal(config.stripe.yNormalized, 0.543, 'Fluorescent example should use the measured band stripe position');
  assert.deepEqual(Array.from(config.calibration.points, function (point) { return { px: point.px, nm: point.nm }; }), [
    { px: 32, nm: 388.86 },
    { px: 515, nm: 587.57 },
    { px: 1110, nm: 837.76 }
  ], 'Fluorescent example should use the SPECTRA-1 three-point calibration');
  assert.equal(config.image.width, 1280);
  assert.equal(config.image.height, 720);
  assert.equal(config.image.sha256, 'ecd5cc32f7eceb11778e69ba568b56ba6f8261b929b91e880d80a0507e2c38c3');
}

function testBundledArgonExample() {
  const assetFile = path.join(repoRoot, 'docs', 'frontend', 'data', 'examples', 'ar-spectral-tube.json');
  const asset = JSON.parse(fs.readFileSync(assetFile, 'utf8'));
  assert.equal(asset.schema, 'spectra-pro-rgb-spectrum-example/v1', 'Argon example schema should remain versioned');
  assert.equal(asset.id, 'ar-spectral-tube', 'Argon asset ID should remain stable');
  assert.equal(asset.scientificRole, 'measured-example-spectrum', 'Argon example must remain identified as measured data');
  assert.equal(asset.sampleCount, 1280, 'Argon example should preserve the measured 1280 samples');
  for (const key of ['px', 'nm', 'R', 'G', 'B', 'I']) {
    assert.equal(asset[key].length, 1280, 'Argon ' + key + ' sample count should remain stable');
  }
  assert.deepEqual(asset.calibration.points, [
    { px: 32, nm: 388.86 },
    { px: 515, nm: 587.57 },
    { px: 1110, nm: 837.76 }
  ], 'Argon example should use the SPECTRA-1 three-point calibration');

  const exampleContext = vm.createContext({ console: console, setTimeout: function () {} });
  exampleContext.window = exampleContext;
  exampleContext.SpectraPro = {};
  new vm.Script(
    fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', 'exampleSpectrumUi.js'), 'utf8'),
    { filename: 'exampleSpectrumUi.js' }
  ).runInContext(exampleContext);
  const catalog = exampleContext.SpectraPro.exampleSpectrumUi;
  assert.ok(catalog.getCatalog().includes('ar-spectral-tube'), 'Load Example catalog should expose the Argon sample');
  const config = catalog.getConfig('ar-spectral-tube');
  assert.equal(config.kind, 'rgb-spectrum', 'Argon example should use the measured RGB spectrum path');
  assert.equal(config.recommendedMode, 'LAB', 'Argon example should recommend LAB mode');
  assert.equal(config.recommendedPreset, 'smart-gastube', 'Argon example should recommend Gas Tube analysis');

  const frame = {
    calibrated: true,
    px: asset.px,
    nm: asset.nm,
    R: asset.R,
    G: asset.G,
    B: asset.B,
    I: asset.I,
    calibration: asset.calibration,
    hardware: asset.hardware
  };
  const result = analyze(frame, {
    analysisContext: 'lab',
    preset: 'smart-gastube',
    autoTune: true,
    smartFindEnabled: true,
    includeWeakPeaks: false,
    maxDistanceNm: 1.8,
    calibration: asset.calibration,
    hardware: asset.hardware
  });
  assert.equal(result.ok, true, 'Bundled Argon spectrum should run through production LAB analysis');
  assert.ok(result.elementScores.length > 0, 'Bundled Argon spectrum should produce ranked atomic evidence');
  assert.equal(result.elementScores[0].element, 'Ar', 'Bundled Argon spectrum should rank Ar first');
  assert.ok(result.elementScores[0].matchedPeaks >= 8, 'Bundled Argon spectrum should retain broad multi-line Ar evidence');
}

function testStellarClassEvidence() {
  const fixture = readJson('sample_stellar_class_evidence.json');
  assert.equal(fixture.synthetic, true, 'Stellar-class fixture must identify itself as synthetic');
  const classifier = worker.SPECTRA_PRO_stellarClassification;
  const astroUiSource = fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', 'proBootstrap.js'), 'utf8');
  const workerEntrySource = fs.readFileSync(path.join(workerDir, 'analysis.worker.js'), 'utf8');
  assert.ok(workerEntrySource.includes("'./stellarClassification.js?v=3.0.1'"), 'Browser worker should load the stellar-class module');
  assert.ok(astroUiSource.includes('spAstroClassification'), 'ASTRO panel should expose stellar-class evidence');
  assert.ok(astroUiSource.includes('Compatible range:'), 'ASTRO panel should render a compatible class range');
  assert.ok(astroUiSource.includes('Insufficient class evidence'), 'ASTRO panel should render a cautious insufficient-data state');
  assert.deepEqual(Array.from(classifier.classes), ['O', 'B', 'A', 'F', 'G', 'K', 'M'], 'Classifier should expose only broad temperature classes');
  const frame = { calibrated: true, nm: [388, 670], I: [1, 1] };

  fixture.scenarios.forEach(function (scenario) {
    const result = classifier.assess({
      calibrated: true,
      topHits: scenario.hits,
      features: scenario.features || [],
      preprocessing: null
    }, frame, {});
    assert.equal(result.state, 'available', `${scenario.id} should produce usable broad-class evidence`);
    assert.equal(result.bestClass, scenario.expectedClass, `${scenario.id} should rank ${scenario.expectedClass} first`);
    assert.equal(result.evidenceStrength, scenario.expectedStrength, `${scenario.id} evidence strength`);
    assert.ok(result.reasons.length > 0, `${scenario.id} should expose its reasons`);
    assert.equal(result.diagnostics.continuumUsed, false, 'Line-evidence classifier must not silently use continuum shape');
    assert.equal(result.referenceBasis.method, 'broad low-resolution line-pattern evidence', 'Classification must remain explicitly broad and low-resolution');
    assert.ok(result.limitations.includes('no-subclass-or-luminosity-class'), 'Subclass and luminosity limitations must remain explicit');
    assert.ok(result.limitations.includes('heuristic-evidence-points-are-not-probabilities'), 'Heuristic rankings must not be presented as probabilities');
  });

  const insufficient = classifier.assess({
    calibrated: true, topHits: fixture.insufficient.hits, features: []
  }, frame, {});
  assert.equal(insufficient.state, fixture.insufficient.expectedState, 'One isolated feature must not become a stellar class');
  assert.equal(insufficient.bestClass, null, 'Insufficient evidence must not expose a best class');

  const conflicting = classifier.assess({
    calibrated: true, topHits: fixture.conflicting.hits, features: fixture.conflicting.features
  }, frame, {});
  assert.equal(conflicting.state, fixture.conflicting.expectedState, 'Mutually incompatible hot/cool evidence must remain conflicting');
  assert.equal(conflicting.evidenceStrength, 'conflicting', 'Conflicting evidence must not receive a confidence-like strength');

  const uncalibrated = classifier.assess({ calibrated: false, topHits: fixture.scenarios[2].hits, features: [] }, { I: [1, 1] }, {});
  assert.equal(uncalibrated.state, 'insufficient-data', 'Uncalibrated data must not produce a stellar class');
  assert.ok(uncalibrated.limitations.includes('calibrated-wavelengths-required'), 'Missing calibration must be explicit');
}

function testReferenceSpectrumComparison() {
  const fixture = readJson('sample_reference_comparison.json');
  assert.equal(fixture.synthetic, true, 'Reference comparison fixture must be explicitly synthetic');
  const nm = [];
  const referenceI = [];
  const measuredI = [];
  const sampleCount = Math.round((fixture.grid.endNm - fixture.grid.startNm) / fixture.grid.stepNm);
  for (let index = 0; index <= sampleCount; index += 1) {
    const wavelength = fixture.grid.startNm + index * fixture.grid.stepNm;
    const referenceValue = Math.exp(-0.5 * Math.pow((wavelength - fixture.reference.centerNm) / fixture.reference.sigmaNm, 2));
    const shiftedValue = Math.exp(-0.5 * Math.pow((wavelength - fixture.reference.centerNm - fixture.measured.shiftNm) / fixture.reference.sigmaNm, 2));
    nm.push(+wavelength.toFixed(6));
    referenceI.push(referenceValue);
    measuredI.push(fixture.measured.offset + fixture.measured.scale * shiftedValue);
  }
  const reference = {
    id: fixture.reference.id,
    label: fixture.reference.label,
    kind: 'spectrum',
    wavelengthNm: nm,
    intensity: referenceI
  };
  const comparison = worker.SPECTRA_PRO_referenceComparison;
  const automatic = comparison.compare({ calibrated: true, nm: nm, I: measuredI }, reference, {
    normalization: 'min-max', alignmentMode: 'auto', maxAutoShiftNm: 0.8, autoStepNm: 0.05
  });
  assert.equal(automatic.state, 'available', 'Automatic reference alignment should produce a comparison');
  within(automatic.alignment.shiftNm, fixture.measured.shiftNm, fixture.expected.autoShiftToleranceNm, 'automatic comparison shift');
  assert.equal(automatic.alignment.source, 'comparison-cross-correlation', 'Automatic alignment must identify itself as comparison-only');
  assert.equal(automatic.alignment.radialVelocityMeasurement, false, 'Comparison alignment must not be represented as radial velocity');

  const manual = comparison.compare({ calibrated: true, nm: nm, I: measuredI }, reference, {
    normalization: 'min-max', alignmentMode: 'manual', manualShiftNm: fixture.measured.shiftNm
  });
  assert.equal(manual.schema, 'spectra-pro-reference-comparison/v1', 'Reference comparison output should be versioned');
  assert.ok(manual.metrics.rmse <= fixture.expected.manualRmseMax, 'Manual alignment residual should recover an affinely scaled identical profile');
  assert.ok(manual.metrics.correlation >= fixture.expected.manualCorrelationMin, 'Manual alignment correlation should recover the shifted profile');
  assert.equal(manual.residualI.length, nm.length, 'Residual samples should remain aligned with the measured wavelength grid');

  const noOverlap = comparison.compare({ calibrated: true, nm: nm, I: measuredI }, {
    id: 'outside', kind: 'spectrum', wavelengthNm: [600, 601, 602], intensity: [0, 1, 0]
  }, { normalization: 'min-max' });
  assert.equal(noOverlap.state, 'unavailable', 'Non-overlapping spectra should fail safely');
  assert.equal(noOverlap.reason, 'insufficient-overlap', 'Missing overlap should have an explicit reason');

  const outOfRangeLines = comparison.compare({ calibrated: true, nm: nm, I: measuredI }, {
    id: 'outside-lines', kind: 'line-list', lines: [{ nm: 700, weight: 1 }]
  }, { normalization: 'min-max' });
  assert.equal(outOfRangeLines.state, 'unavailable', 'An out-of-range line pattern must not produce a misleading comparison');
  assert.equal(outOfRangeLines.reason, 'insufficient-variation', 'A flat in-range reference should expose its limitation');

  const linePattern = comparison.compare({ calibrated: true, nm: nm, I: referenceI }, {
    id: 'line-pattern', kind: 'line-list', defaultFwhmNm: fixture.reference.sigmaNm * 2.354820045,
    lines: [{ nm: fixture.reference.centerNm, weight: 1 }]
  }, { normalization: 'min-max', resolutionFwhmNm: fixture.reference.sigmaNm * 2.354820045 });
  assert.ok(linePattern.metrics.correlation > 0.999999, 'Sparse curated line references should reuse the same comparison path');

  const integrated = analyze({ calibrated: true, nm: nm, px: nm.map(function (_, index) { return index; }), I: measuredI }, {
    preset: 'nearest', autoTune: false,
    referenceComparison: {
      enabled: true, reference: reference, normalization: 'min-max',
      alignmentMode: 'manual', manualShiftNm: fixture.measured.shiftNm
    }
  }, { atomLines: [] });
  assert.equal(integrated.referenceComparison.state, 'available', 'The shared analysis pipeline should attach the comparison result');
  assert.equal(integrated.referenceComparison.alignment.radialVelocityMeasurement, false, 'Pipeline integration must preserve the alignment/RV boundary');

  const catalog = worker.SpectraPro.referenceCatalog;
  const ids = Array.from(catalog.list(), function (item) { return item.id; });
  ['hydrogen', 'helium', 'neon', 'mercury', 'solar', 'custom'].forEach(function (id) {
    assert.ok(ids.includes(id), `Reference catalog should expose ${id}`);
  });
  const custom = catalog.parseCustomText('500,1\n501,3\n502,2', 'fixture.csv');
  assert.deepEqual(Array.from(custom.wavelengthNm), [500, 501, 502], 'Custom CSV wavelengths should parse deterministically');
  assert.deepEqual(Array.from(custom.intensity), [1, 3, 2], 'Custom CSV intensities should parse deterministically');

  const workerEntrySource = fs.readFileSync(path.join(workerDir, 'analysis.worker.js'), 'utf8');
  const uiSource = fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', 'proBootstrap.js'), 'utf8');
  const graphSource = fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'graphScript.js'), 'utf8');
  assert.ok(workerEntrySource.includes("'./referenceComparison.js?v=3.0.1'"), 'Browser worker should load reference comparison');
  assert.ok(uiSource.toLowerCase().includes('reference spectrum comparison'), 'LAB/ASTRO UI should expose reference comparison controls');
  assert.ok(uiSource.includes("ensureReferenceComparisonCard(referenceMount, 'Lab')"), 'LAB should expose the shared comparison card in its Advanced popup');
  assert.ok(uiSource.includes("ensureReferenceComparisonCard($('spAstroReferenceMount'), 'Astro')"), 'ASTRO should expose the shared comparison card in its Advanced popup');
  assert.ok(graphSource.includes('drawReferenceComparisonOverlay'), 'The existing graph should render the numeric reference overlay');
}

function relativisticShift(referenceNm, velocityKmS) {
  const beta = velocityKmS / worker.SPECTRA_PRO_dopplerEstimate.speedOfLightKmS;
  return referenceNm * Math.sqrt((1 + beta) / (1 - beta));
}

function testRadialVelocity() {
  const doppler = worker.SPECTRA_PRO_dopplerEstimate;
  within(doppler.velocityFromWavelengths(relativisticShift(500, 300), 500), 300, 1e-6, 'relativistic redshift velocity');
  within(doppler.velocityFromWavelengths(relativisticShift(600, -250), 600), -250, 1e-6, 'relativistic blueshift velocity');

  const directMatches = [400, 500, 600].map(function (referenceNm, index) {
    return {
      label: 'line-' + index,
      peakIndex: index,
      referenceNm: referenceNm,
      observedNm: relativisticShift(referenceNm, 120 + index * 2),
      matchUncertaintyNm: 0.02,
      featureQuality: 'good',
      featureQualityFlags: []
    };
  });
  directMatches.push({
    label: 'outlier', peakIndex: 9, referenceNm: 550,
    observedNm: relativisticShift(550, 1400), matchUncertaintyNm: 0.02,
    featureQuality: 'good', featureQualityFlags: []
  });
  const robust = doppler.estimate(directMatches, {});
  assert.equal(robust.state, 'available', 'Multiple compatible lines should produce a combined radial velocity');
  within(robust.velocityKmS, 122, 3, 'uncertainty-weighted robust velocity');
  assert.equal(robust.lines.find(function (line) { return line.label === 'outlier'; }).exclusionReason, 'velocity-outlier', 'Grossly inconsistent velocity should be excluded deterministically');
  assert.equal(doppler.estimate(directMatches.slice(0, 1), {}).state, 'insufficient-lines', 'One line must not become the primary combined result');

  const fixture = readJson('sample_astro_radial_velocity.json');
  assert.equal(fixture.synthetic, true, 'Radial-velocity fixture must identify itself as synthetic');
  const beta = fixture.velocityKmS / doppler.speedOfLightKmS;
  const shiftFactor = Math.sqrt((1 + beta) / (1 - beta));
  const nm = [];
  const intensity = [];
  const count = Math.round((fixture.grid.endNm - fixture.grid.startNm) / fixture.grid.stepNm);
  for (let index = 0; index <= count; index += 1) {
    const wavelength = fixture.grid.startNm + index * fixture.grid.stepNm;
    const baseline = fixture.continuum.intercept + fixture.continuum.slopePerNm * (wavelength - fixture.continuum.pivotNm);
    let absorption = 0;
    fixture.features.forEach(function (feature) {
      const shiftedCenter = feature.referenceNm * shiftFactor;
      absorption += feature.depth * Math.exp(-0.5 * Math.pow((wavelength - shiftedCenter) / feature.sigmaNm, 2));
    });
    const noise = fixture.noise.amplitude * Math.sin((2 * Math.PI * index) / fixture.noise.periodSamples);
    nm.push(+wavelength.toFixed(6));
    intensity.push(baseline * (1 - absorption) + noise);
  }
  const frame = { calibrated: true, nm: nm, px: nm.map(function (_, index) { return index; }), I: intensity };
  const result = analyze(frame, {
    analysisContext: 'astro', maxDistanceNm: 1.8,
    calibration: fixture.calibration, hardware: fixture.hardware
  });
  const velocity = result.astro.radialVelocity;
  assert.equal(velocity.state, 'available', 'Shifted calibrated absorption spectrum should produce radial velocity');
  assert.ok(velocity.lineCountUsed >= fixture.expected.minimumLinesUsed, 'Combined velocity should use multiple reliable lines');
  within(velocity.velocityKmS, fixture.velocityKmS, fixture.expected.velocityToleranceKmS, 'synthetic shifted-spectrum velocity');
  assert.ok(Number.isFinite(velocity.uncertaintyKmS) && velocity.uncertaintyKmS > 0, 'Combined velocity uncertainty must be explicit and finite');
  assert.equal(velocity.signConvention, 'positive-redshift-receding; negative-blueshift-approaching', 'Velocity sign convention must be explicit');
  assert.equal(velocity.corrections.barycentric, false, 'Unapplied barycentric correction must be explicit');
  assert.equal(velocity.corrections.heliocentric, false, 'Unapplied heliocentric correction must be explicit');
  assert.ok(velocity.limitations.includes('result-is-limited-by-wavelength-calibration-and-instrument-resolution'), 'Velocity precision must remain bounded by calibration and resolution');
}

function testAtomicEmission() {
  const fixture = readJson('sample_lab_spectrum.json');
  assert.equal(fixture.synthetic, true, 'LAB fixture must identify itself as synthetic');
  assert.deepEqual(
    fixture.cases.map(function (item) { return item.expectedElement; }).sort(),
    ['H', 'Hg', 'Ne'],
    'Atomic fixture must cover hydrogen, neon, and mercury'
  );

  fixture.cases.forEach(function (item) {
    assert.equal(item.frame.nm.length, item.frame.I.length, `${item.id}: wavelength/intensity length mismatch`);
    const result = analyze(item.frame, { preset: item.preset }, { atomLines: item.atomLines });
    assert.equal(result.ok, true, `${item.id}: analysis should succeed`);
    assert.equal(result.calibrated, true, `${item.id}: fixture should use calibrated wavelengths`);
    assert.ok(result.elementScores.length > 0, `${item.id}: expected atomic candidate evidence`);
    assert.equal(result.elementScores[0].element, item.expectedElement, `${item.id}: coherent fingerprint should rank first`);
    assert.ok(
      result.elementScores[0].matchedPeaks >= item.minimumMatchedPeaks,
      `${item.id}: expected at least ${item.minimumMatchedPeaks} matched peaks`
    );
    const unrelated = result.elementScores.find(function (row) { return row.element !== item.expectedElement; });
    if (unrelated) {
      assert.ok(
        result.elementScores[0].totalScore > unrelated.totalScore,
        `${item.id}: coherent fingerprint should outrank an unrelated coincidence`
      );
    }
  });
}

function testMolecularEmission() {
  const fixture = readJson('sample_molecular_band_spectrum.json');
  assert.equal(fixture.synthetic, true, 'Molecular fixture must identify itself as synthetic');
  assert.equal(fixture.frame.nm.length, fixture.frame.I.length, 'N2 wavelength/intensity length mismatch');
  const result = analyze(
    fixture.frame,
    { preset: fixture.preset },
    { molecularBands: fixture.molecularBands }
  );
  assert.equal(result.ok, true, 'N2 analysis should succeed');
  assert.ok(result.elementScores.length > 0, 'N2 analysis should produce molecular evidence');
  assert.equal(result.elementScores[0].element, fixture.expectedSpecies, 'N2 fingerprint should rank first');
  assert.ok(
    result.elementScores[0].matchedPeaks >= fixture.minimumMatchedPeaks,
    `N2 should match at least ${fixture.minimumMatchedPeaks} band heads`
  );
  assert.match(result.molecularEvidenceModel, /plasma-diagnostic/, 'N2 result should use molecular fingerprint evidence');
}

function testFluorescence() {
  const fixture = readJson('sample_fluorescence_spectrum.json');
  assert.equal(fixture.synthetic, true, 'Fluorescence fixture must identify itself as synthetic');
  assert.equal(fixture.frame.nm.length, fixture.frame.I.length, 'Fluorescence wavelength/intensity length mismatch');
  const result = analyze(fixture.frame, { preset: fixture.preset }, {});
  const summary = result.fluorescenceSummary;
  assert.ok(summary, 'Fluorescence analysis should return a shape summary');
  assert.equal(summary.broadbandDetected, true, 'Controlled broad profile should be classified as broadband');
  within(summary.lambdaMaxNm, fixture.expected.lambdaMaxNm, fixture.expected.lambdaMaxToleranceNm, 'lambda max');
  within(summary.centroidNm, fixture.expected.centroidNm, fixture.expected.centroidToleranceNm, 'centroid');
  within(summary.fwhmNm, fixture.expected.fwhmNm, fixture.expected.fwhmToleranceNm, 'FWHM');
  assert.equal(summary.asymmetry, fixture.expected.asymmetry, 'Symmetric profile should remain balanced');
  assert.equal(result.clearNarrowLineHits.length, 0, 'Broad fluorescence without a coherent atomic fingerprint should not invent clear line labels');
}

function testFluorescenceClearNarrowLines() {
  const nm = [];
  const intensity = [];
  const lines = [
    { nm: 404.656, amplitude: 92 },
    { nm: 435.833, amplitude: 105 },
    { nm: 546.074, amplitude: 88 },
    { nm: 576.960, amplitude: 72 },
    { nm: 579.066, amplitude: 68 }
  ];
  for (let i = 0; i <= 620; i += 1) {
    const wavelength = 390 + i * 0.5;
    const broad = 8 + 160 * Math.exp(-0.5 * Math.pow((wavelength - 595) / 45, 2));
    let narrow = 0;
    lines.forEach(function (line) {
      narrow += line.amplitude * Math.exp(-0.5 * Math.pow((wavelength - line.nm) / 0.34, 2));
    });
    nm.push(+wavelength.toFixed(3));
    intensity.push(broad + narrow);
  }

  const frame = {
    calibrated: true,
    nm: nm,
    px: nm.map(function (_, index) { return index; }),
    I: intensity
  };
  const result = analyze(frame, {
    preset: 'smart-fluorescent',
    maxDistanceNm: 1.8,
    peakThresholdRel: 0.01,
    peakDistancePx: 2
  }, {});

  assert.equal(result.ok, true, 'Fluorescent tube analysis should succeed');
  assert.ok(result.fluorescenceSummary && result.fluorescenceSummary.broadbandDetected, 'Broad phosphor-like background should remain the primary fluorescence result');
  assert.ok(result.fluorescenceLineEvidence, 'Fluorescent analysis should expose secondary coherent line evidence');
  assert.ok(result.fluorescenceLineEvidence.groups.length >= 1, 'A coherent Hg fingerprint should create a secondary line group');
  assert.equal(result.fluorescenceLineEvidence.groups[0].element, 'Hg', 'Mercury should be the coherent secondary line signature');
  assert.ok(result.fluorescenceLineEvidence.groups[0].matchedCount >= 3, 'Mercury should require several matched lines before automatic display');
  assert.ok(result.clearNarrowLineHits.length >= 3, 'Several clear Hg lines should be promoted to graph labels');
  assert.ok(result.clearNarrowLineHits.every(function (hit) { return hit.element === 'Hg'; }), 'Automatically promoted fluorescence line labels should belong to the coherent Hg fingerprint');
  assert.equal(result.offsetBasis, 'clear-narrow-line-hits', 'Fluorescent offset must state that it uses the accepted coherent narrow-line set');
  within(
    result.offsetNm,
    worker.SPECTRA_PRO_spectrumMath.matchOffsetNm(result.clearNarrowLineHits),
    1e-12,
    'Fluorescent reported offset should be the median residual of accepted coherent narrow-line hits'
  );
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'rawMatchOffsetNm'), 'Fluorescent analysis should preserve the broader pre-filter matcher offset field separately, even when the synthetic fixture has no raw library matches');
  assert.deepEqual(
    Array.from(result.overlayHits, function (hit) { return [hit.element, hit.referenceNm, hit.observedNm]; }),
    Array.from(result.clearNarrowLineHits, function (hit) { return [hit.element, hit.referenceNm, hit.observedNm]; }),
    'The default Fluorescent graph overlay should contain exactly the clear coherent line hits'
  );
  assert.equal(result.elementScores.length, 0, 'Fluorescent should keep broadband shape primary instead of exposing atomic Score Share');
}

function testQualityControlAndSafeFailure() {
  const fixture = readJson('sample_quality_control_spectra.json');
  assert.equal(fixture.synthetic, true, 'QC fixture must identify itself as synthetic');
  fixture.cases.forEach(function (item) {
    const qc = worker.SPECTRA_PRO_qcRules.evaluateQC({ frame: item.frame });
    assert.ok(qc.flags.includes(item.expectedFlag), `${item.id}: expected ${item.expectedFlag}`);
  });

  const invalid = worker.SPECTRA_PRO_analysisPipeline.analyzeFrame(null, {}, {});
  assert.equal(invalid.ok, false, 'Missing spectrum should fail safely');
  assert.equal(invalid.error, 'analysis-missing-deps', 'Missing spectrum should return a stable error code');

  const uncalibrated = analyze(
    fixture.uncalibrated.frame,
    { preset: 'smart-atomic' },
    { atomLines: [{ element: 'H', species: 'H I', speciesKey: 'H I', nm: 3 }] }
  );
  assert.equal(uncalibrated.calibrated, false, 'Uncalibrated frame must remain uncalibrated');
  assert.ok(uncalibrated.qcFlags.includes('uncalibrated'), 'Uncalibrated frame should expose a QC flag');
  assert.equal(uncalibrated.topHits.length, 0, 'Pixel coordinates must not be treated as wavelengths');

  const ambiguous = fixture.ambiguousMatch;
  const matches = worker.SPECTRA_PRO_lineMatcher.matchLines(
    ambiguous.observedPeaks,
    ambiguous.atomLines,
    ambiguous.options
  );
  assert.equal(matches.length, ambiguous.expectedCandidateCount, 'Ambiguous peak should retain both plausible candidates');
  assert.deepEqual(
    Array.from(matches, function (match) { return match.element; }).sort(),
    ['X', 'Y'],
    'Ambiguous candidates should not be collapsed into a false unique identification'
  );
}

function gaussianFrame(item, calibrated) {
  const nm = [];
  const intensity = [];
  const grid = item.grid;
  const profile = item.profile;
  const direction = item.polarity === 'absorption' ? -1 : 1;
  const count = Math.round((grid.endNm - grid.startNm) / grid.stepNm);
  for (let index = 0; index <= count; index += 1) {
    const wavelength = grid.startNm + index * grid.stepNm;
    const exponent = -0.5 * Math.pow((wavelength - profile.centerNm) / profile.sigmaNm, 2);
    nm.push(+wavelength.toFixed(6));
    intensity.push(profile.baseline + direction * profile.amplitude * Math.exp(exponent));
  }
  return { calibrated: calibrated !== false, nm: nm, I: intensity };
}

function closestFeature(features, polarity, centerNm) {
  return features.filter(function (feature) { return feature.polarity === polarity; }).sort(function (a, b) {
    return Math.abs(a.centerNm - centerNm) - Math.abs(b.centerNm - centerNm);
  })[0] || null;
}

function testSpectralFeatures() {
  const fixture = readJson('sample_spectral_features.json');
  assert.equal(fixture.synthetic, true, 'Feature fixture must identify itself as synthetic');
  const engine = worker.SPECTRA_PRO_spectralFeatures;
  assert.equal(engine.equivalentWidthConvention, 'positive-emission-negative-absorption', 'Equivalent-width sign convention must be explicit');

  fixture.cases.slice(0, 2).forEach(function (item) {
    const frame = gaussianFrame(item, true);
    const features = engine.detectFeatures(frame, {
      polarity: item.polarity,
      smoothingRadiusPx: 0,
      windowRadiusPx: 12,
      minProminenceRel: 0.05,
      minDistancePx: 3
    });
    const feature = closestFeature(features, item.polarity, item.profile.centerNm);
    assert.ok(feature, `${item.id}: expected a ${item.polarity} feature`);
    within(feature.centerNm, item.profile.centerNm, item.expected.centerToleranceNm, `${item.id} center`);
    within(feature.fwhmNm, item.expected.fwhmNm, item.expected.fwhmToleranceNm, `${item.id} FWHM`);
    within(feature.amplitude, item.profile.amplitude, item.expected.amplitudeTolerance, `${item.id} amplitude/depth`);
    assert.equal(feature.polarity, item.polarity, `${item.id}: polarity should be preserved`);
    assert.ok(Number.isFinite(feature.centerUncertaintyNm), `${item.id}: calibrated center uncertainty should be explicit`);
    assert.ok(Number.isFinite(feature.localContinuum), `${item.id}: local continuum should be measured`);
    assert.equal(Math.sign(feature.equivalentWidthNm), item.expected.equivalentWidthSign, `${item.id}: equivalent-width sign should follow the documented convention`);
    if (item.polarity === 'absorption') assert.ok(feature.depth > 0, `${item.id}: absorption depth should be positive`);
  });

  const edgeCase = fixture.cases[2];
  const edgeFeatures = engine.detectFeatures(gaussianFrame(edgeCase, true), {
    polarity: edgeCase.polarity,
    smoothingRadiusPx: 0,
    windowRadiusPx: 10,
    minProminenceRel: 0.03
  });
  assert.ok(edgeFeatures.length > 0, 'Truncated profile should still be reported when evidence exists');
  assert.ok(edgeFeatures[0].qualityFlags.includes(edgeCase.expectedFlag), 'Truncated profile should carry an edge-quality flag');

  const uncalibratedFrame = gaussianFrame(fixture.cases[0], false);
  const uncalibrated = engine.detectFeatures(uncalibratedFrame, {
    polarity: 'emission', smoothingRadiusPx: 0, windowRadiusPx: 12
  })[0];
  assert.ok(uncalibrated, 'Uncalibrated feature should still be measurable in sample coordinates');
  assert.equal(uncalibrated.centerNm, null, 'Pixel/sample coordinates must not be reported as calibrated wavelength');
  assert.equal(uncalibrated.fwhmNm, null, 'Uncalibrated width must not be reported in nm');
  assert.ok(Number.isFinite(uncalibrated.centerIndex), 'Uncalibrated feature should retain a sample-space center');
  assert.ok(Number.isFinite(uncalibrated.fwhmSamples), 'Uncalibrated feature should retain a sample-space width');

  const labFixture = readJson('sample_lab_spectrum.json').cases[0];
  const labResult = analyze(labFixture.frame, { preset: labFixture.preset }, { atomLines: labFixture.atomLines });
  assert.ok(labResult.features.length >= labFixture.minimumMatchedPeaks, 'LAB result should expose measured emission features');
  assert.ok(labResult.peaks.some(function (peak) { return Number.isFinite(peak.fwhmNm); }), 'LAB peaks should consume feature-width measurements');
  assert.equal(labResult.detectedPeakCount, labResult.peaks.length, 'LAB worker result should publish a canonical detected peak count matching its peak list');
}

function testCalibrationAwareMatching() {
  const fixture = readJson('sample_calibration_matching.json');
  assert.equal(fixture.synthetic, true, 'Calibration fixture must identify itself as synthetic');
  const frame = gaussianFrame(fixture, true);
  frame.px = frame.I.map(function (_, index) { return index; });
  const diagnostics = worker.SPECTRA_PRO_calibrationDiagnostics;
  const good = diagnostics.evaluate(fixture.goodCalibration, frame);
  const poor = diagnostics.evaluate(fixture.poorCalibration, frame);

  assert.equal(good.pointCount, 3, 'Calibration diagnostics should expose point count');
  assert.equal(good.polynomialOrder, 1, 'Calibration diagnostics should expose polynomial order');
  within(good.points[1].fittedNm, 500, 1e-9, 'fitted calibration wavelength');
  within(good.points[1].residualNm, 0, 1e-9, 'good calibration point residual');
  within(good.rmsResidualNm, 0, 1e-9, 'good calibration RMS');
  within(good.maxAbsResidualNm, 0, 1e-9, 'good calibration maximum residual');
  assert.deepEqual(Object.assign({}, good.wavelengthCoverageNm), { min: 496, max: 504 }, 'Calibrated coverage should be explicit');
  assert.deepEqual(Object.assign({}, good.extrapolation), { any: false, left: false, right: false }, 'Covered frame should not be marked extrapolated');
  within(poor.rmsResidualNm, 1.5, 1e-9, 'poor calibration RMS');
  within(poor.maxAbsResidualNm, 1.5, 1e-9, 'poor calibration maximum residual');

  const extrapolatedCalibration = {
    coefficients: fixture.goodCalibration.coefficients,
    points: fixture.goodCalibration.points.slice(1)
  };
  assert.equal(diagnostics.evaluate(extrapolatedCalibration, frame).extrapolation.left, true, 'Samples beyond calibration anchors should be marked extrapolated');

  function run(calibration, referenceNm, maxDistanceNm) {
    return analyze(frame, {
      preset: 'nearest',
      autoTune: false,
      peakThresholdRel: 0.05,
      peakDistancePx: 2,
      maxDistanceNm: maxDistanceNm == null ? 5 : maxDistanceNm,
      calibration: calibration,
      hardware: fixture.hardware
    }, {
      atomLines: [{ element: 'X', species: 'X I', speciesKey: 'X I', nm: referenceNm }]
    });
  }

  const goodNearby = run(fixture.goodCalibration, fixture.references.nearbyNm);
  const poorNearby = run(fixture.poorCalibration, fixture.references.nearbyNm);
  assert.equal(goodNearby.topHits.length, 1, 'Good calibration should retain a nearby reference');
  const hit = goodNearby.topHits[0];
  assert.ok(Number.isFinite(hit.observedNm), 'Match should report observed wavelength');
  assert.equal(hit.referenceNm, fixture.references.nearbyNm, 'Match should report reference wavelength');
  assert.ok(Number.isFinite(hit.deltaNm), 'Match should report wavelength residual');
  assert.ok(Number.isFinite(hit.effectiveToleranceNm), 'Match should report effective tolerance');
  assert.ok(Number.isFinite(hit.matchUncertaintyNm), 'Match should report combined uncertainty');
  assert.ok(['good', 'moderate', 'poor'].includes(hit.matchQuality), 'Match should report a quality class');
  assert.ok(poorNearby.matchUncertaintyModel.effectiveToleranceNm > goodNearby.matchUncertaintyModel.effectiveToleranceNm, 'Poor calibration should widen the uncertainty-informed tolerance');
  assert.ok(poorNearby.topHits[0].confidence < goodNearby.topHits[0].confidence, 'Poor calibration should reduce match confidence');

  const goodSensitive = run(fixture.goodCalibration, fixture.references.uncertaintySensitiveNm);
  const poorSensitive = run(fixture.poorCalibration, fixture.references.uncertaintySensitiveNm);
  assert.equal(goodSensitive.topHits.length, 0, 'Good calibration should reject a reference outside its effective uncertainty');
  assert.equal(poorSensitive.topHits.length, 1, 'Poor calibration should admit a plausible reference within its wider uncertainty');

  const gross = run(fixture.poorCalibration, fixture.references.grosslyInconsistentNm);
  assert.equal(gross.topHits.length, 0, 'Grossly inconsistent matches should remain rejected by the preset limit');
}

function testMeasurementQualityModel() {
  const qualityFixture = readJson('sample_quality_control_spectra.json');
  const calibrationFixture = readJson('sample_calibration_matching.json');
  const qualityEngine = worker.SPECTRA_PRO_measurementQuality;

  function qcCase(id) {
    return qualityFixture.cases.find(function (item) { return item.id === id; });
  }

  const baseResult = {
    ok: true,
    calibrated: false,
    features: [],
    calibrationDiagnostics: { available: false, pointCount: 0, extrapolation: { any: false } },
    matchUncertaintyModel: { effectiveToleranceNm: 1 }
  };
  const noSignal = qualityEngine.build(baseResult, qcCase('no_signal').frame, {});
  assert.equal(noSignal.overallStatus, 'poor', 'No-signal measurement should be poor');
  assert.equal(noSignal.mainLimitation.code, 'signal', 'Signal should be the dominant no-signal limitation');
  assert.equal(noSignal.dimensions.signal.status, 'poor', 'Signal dimension should expose poor state');

  const lowSnr = qualityEngine.build(baseResult, qcCase('low_snr').frame, {});
  assert.equal(lowSnr.dimensions.noise.status, 'poor', 'LOW_SNR should map to poor noise quality');
  assert.equal(lowSnr.mainLimitation.code, 'noise', 'Noise should be the dominant low-SNR limitation');

  const saturated = qualityEngine.build(baseResult, qcCase('saturated_normalized').frame, {});
  assert.equal(saturated.dimensions.saturation.status, 'poor', 'Material clipping should map to poor saturation quality');
  assert.equal(saturated.mainLimitation.code, 'saturation', 'Saturation should be selected as the dominant clipping limitation');

  const frame = gaussianFrame(calibrationFixture, true);
  frame.px = frame.I.map(function (_, index) { return index; });
  const good = analyze(frame, {
    preset: 'nearest', autoTune: false, maxDistanceNm: 5,
    calibration: calibrationFixture.goodCalibration,
    hardware: calibrationFixture.hardware
  }, { atomLines: [{ element: 'X', species: 'X I', speciesKey: 'X I', nm: calibrationFixture.references.nearbyNm }] });
  assert.ok(good.measurementQuality, 'Analysis result should expose the shared measurement-quality object');
  assert.equal(good.measurementQuality.model, 'measurement-quality-v1', 'Measurement quality should expose a stable model identifier');
  assert.equal(good.measurementQuality.dimensions.calibration.status, 'good', 'Low calibration residual should be classified as good');
  assert.equal(good.measurementQuality.dimensions.sampling.status, 'good', 'Two samples per instrument FWHM should be classified as adequate');
  assert.equal(good.measurementQuality.dimensions.coverage.status, 'good', 'Covered calibrated wavelengths should be good');

  const poorCalibration = analyze(frame, {
    preset: 'nearest', autoTune: false, maxDistanceNm: 5,
    calibration: calibrationFixture.poorCalibration,
    hardware: calibrationFixture.hardware
  }, { atomLines: [{ element: 'X', species: 'X I', speciesKey: 'X I', nm: calibrationFixture.references.nearbyNm }] });
  assert.equal(poorCalibration.measurementQuality.dimensions.calibration.status, 'poor', 'Large fit residual should produce poor calibration quality');
  assert.equal(poorCalibration.measurementQuality.mainLimitation.code, 'calibration', 'Calibration should be the dominant poor-fit limitation');

  const resolutionLimitedResult = Object.assign({}, good, {
    matchUncertaintyModel: Object.assign({}, good.matchUncertaintyModel, { effectiveToleranceNm: 0.5 })
  });
  const resolutionLimited = qualityEngine.build(resolutionLimitedResult, frame, {
    hardware: { spectrometerResolutionFwhmNm: 5 }
  });
  assert.equal(resolutionLimited.dimensions.resolution.status, 'poor', 'Instrument width much broader than the match window should limit resolution');
  assert.equal(typeof resolutionLimited.overallStatus, 'string', 'Quality output should remain categorical rather than a percentage');
}

function testFormalPreprocessingPipeline() {
  const pipeline = worker.SpectraPro.processingPipeline;
  const raw = [11, 21, 31, 41, 51];
  const dark = [1, 1, 1, 1, 1];
  const reference = [21, 41, 61, 81, 101];
  const transmittance = pipeline.run({ I: raw }, {
    subtractionMode: 'transmittance',
    darkI: dark,
    referenceI: reference,
    normalizationMode: 'none'
  });
  assert.deepEqual(Array.from(transmittance.processedI), [50, 50, 50, 50, 50], 'Transmittance should preserve the existing dark/reference formula');
  assert.deepEqual(Array.from(transmittance.meta.order), [
    'raw-input', 'dark-subtraction', 'reference-correction', 'instrument-response',
    'smoothing', 'baseline-continuum', 'normalization'
  ], 'Preprocessing order should be explicit and stable');
  assert.deepEqual(Array.from(transmittance.meta.activeOperations), ['dark-subtraction', 'reference-correction'], 'Only actually applied operations should be recorded as active');
  assert.equal(transmittance.meta.schema, 'spectra-pro-preprocessing/v1', 'Preprocessing metadata should expose a versioned schema');

  const missingReference = pipeline.run({ I: raw }, { subtractionMode: 'ratio', referenceI: [1, 2] });
  assert.deepEqual(Array.from(missingReference.processedI), raw, 'Unavailable reference correction should preserve the input instead of fabricating values');
  assert.equal(missingReference.meta.stages[2].status, 'unavailable', 'Missing reference should be explicit');
  assert.ok(missingReference.meta.warnings.includes('reference-unavailable-or-length-mismatch'), 'Reference length mismatch should be recorded');

  const smoothed = pipeline.run({ I: [0, 0, 9, 0, 0] }, { smoothingPasses: 1 });
  assert.deepEqual(Array.from(smoothed.processedI), [0, 3, 3, 3, 0], 'Enabled smoothing should use the documented three-point pass');
  assert.ok(smoothed.meta.activeOperations.includes('smoothing'), 'Applied smoothing should be recorded');

  const normalized = pipeline.run({ I: [2, 4, 6] }, { normalizationMode: 'min-max' });
  assert.deepEqual(Array.from(normalized.processedI), [0, 0.5, 1], 'Explicit min-max normalization should feed the analysis signal');
  assert.equal(normalized.meta.analysisSignal, 'normalizedI', 'Metadata should identify the signal used for analysis');
  assert.ok(normalized.meta.activeOperations.includes('normalization'), 'Applied normalization should be recorded');

  const rawFrame = gaussianFrame({
    grid: { startNm: 496, endNm: 504, stepNm: 0.5 },
    profile: { baseline: 0.01, amplitude: 1, centerNm: 497, sigmaNm: 0.25 }
  }, true);
  const processedFrame = gaussianFrame({
    grid: { startNm: 496, endNm: 504, stepNm: 0.5 },
    profile: { baseline: 0.01, amplitude: 1, centerNm: 503, sigmaNm: 0.25 }
  }, true);
  rawFrame.processedI = processedFrame.I;
  rawFrame.preprocessing = smoothed.meta;
  const result = analyze(rawFrame, {
    preset: 'nearest', autoTune: false, maxDistanceNm: 1,
    hardware: { spectrometerResolutionFwhmNm: 1 }
  }, { atomLines: [{ element: 'X', species: 'X I', speciesKey: 'X I', nm: 503 }] });
  assert.equal(result.topHits.length, 1, 'Worker matching should consume the processed signal');
  within(result.topHits[0].observedNm, 503, 0.3, 'processed-signal peak center');
  assert.equal(result.preprocessing.schema, 'spectra-pro-preprocessing/v1', 'Analysis result should preserve preprocessing metadata');
}

function testAtomicAutoTuneDiagnosticAnchor() {
  const profiles = worker.SPECTRA_PRO_atomicProfiles.profiles;
  const evidence = worker.SPECTRA_PRO_atomicEvidence;
  const helium = profiles.He;
  const range = { min: 376, max: 900 };
  const peaks = [
    { index: 100, nm: 587.330, prominence: 180, value: 180 },
    { index: 200, nm: 666.001, prominence: 250, value: 250 },
    { index: 300, nm: 704.149, prominence: 100, value: 100 }
  ];

  assert.equal(
    evidence.scoreProfile(helium, peaks, 1.8, range),
    null,
    'A single narrow-pass helium hit should remain insufficient for a positive full-profile score'
  );

  const auto = evidence.scoreProfileAuto(helium, peaks, range);
  assert.ok(auto && auto.row, 'A strong diagnostic helium anchor should unlock the confirmation pass');
  const confirm = auto.passes.find(function (pass) { return pass.id === 'confirm'; });
  assert.ok(confirm, 'Auto tune should run the 3 nm confirmation pass after a strong diagnostic anchor');
  assert.equal(confirm.matched, 3, 'Confirmation should recover the three helium lines in the regression case');
  assert.equal(auto.row.autoTuneBestPass, 'confirm', 'Recovered multi-line helium evidence should become the best pass');
  assert.ok(
    auto.hits.some(function (hit) { return hit.element === 'He' && Math.abs(hit.referenceNm - 706.519) < 0.01; }),
    'Confirmation should recover He I 706.519 nm even though it lies outside the narrow 1.8 nm gate'
  );
}

function testSharedAnalysisInfrastructure() {
  const math = worker.SPECTRA_PRO_spectrumMath;
  const presets = worker.SPECTRA_PRO_presetResolver;
  assert.equal(math.median([9, 1, 5, 3]), 4, 'Shared median should interpolate an even sample count');
  assert.equal(math.matchOffsetNm([{ deltaNm: -0.4 }, { deltaNm: 0.2 }, { deltaNm: 0.1 }]), 0.1, 'Shared offset should preserve the odd-count median rule');
  within(math.matchOffsetNm([{ deltaNm: -0.4 }, { deltaNm: 0.2 }, { deltaNm: 0.1 }, { deltaNm: 0.8 }]), 0.15, 1e-12, 'Shared offset should interpolate the two middle residuals for an even match count');
  assert.deepEqual(
    Object.assign({}, math.observedRange({ nm: [510, 490, 500] }, [])),
    { min: 490, max: 510 },
    'Shared range helper should use calibrated wavelength values'
  );

  const alias = presets.resolve('general-tight');
  assert.equal(alias.id, 'tight', 'Legacy preset aliases should remain compatible');
  assert.equal(alias.toleranceNm, 1.5, 'Resolved preset controls should remain unchanged');
  const fallback = presets.resolve('unknown-preset');
  assert.equal(fallback.id, 'unknown-preset', 'Unknown preset IDs should remain visible for compatibility');
  assert.equal(fallback.toleranceNm, 3, 'Unknown presets should retain the nearest-match fallback settings');
  const lamp = presets.resolve('lamp-hg');
  assert.equal(lamp.id, 'lamp-hg', 'The main-compatible Lamp preset must retain its stable ID');
  assert.equal(lamp.type, 'base', 'Lamp must retain its local base-matching behavior');
  assert.equal(lamp.toleranceNm, 2.8, 'Lamp must retain its main wavelength tolerance');
  assert.deepEqual(Array.from(lamp.allowedElements), ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'], 'Lamp must retain its source-family restriction');

  const lampFrame = gaussianFrame({
    grid: { startNm: 540, endNm: 552, stepNm: 0.2 },
    profile: { baseline: 0.01, amplitude: 1, centerNm: 546.074, sigmaNm: 0.35 }
  }, true);
  const lampResult = analyze(lampFrame, {
    preset: 'lamp-hg', autoTune: true, smartFindEnabled: true, maxDistanceNm: 3
  }, {
    atomLines: [
      { element: 'Hg', species: 'Hg I', speciesKey: 'Hg I', nm: 546.074 },
      { element: 'Na', species: 'Na I', speciesKey: 'Na I', nm: 546.074 }
    ]
  });
  assert.equal(lampResult.ok, true, 'Lamp must run through the production worker pipeline');
  assert.equal(lampResult.presetId, 'lamp-hg', 'Lamp worker result must retain its main preset ID');
  assert.equal(lampResult.autoTune, true, 'Lamp must retain main-compatible Auto tune behavior');
  assert.ok(lampResult.overlayHits.some(function (hit) { return hit.element === 'Hg'; }), 'Lamp must match an allowed Hg line');
  assert.equal(lampResult.overlayHits.some(function (hit) { return hit.element === 'Na'; }), false, 'Lamp must exclude non-lamp Na lines');

  const filtered = presets.filterAtomicLines(
    [{ element: 'H', nm: 486.133 }, { element: 'Na', nm: 589 }, { element: 'H', nm: 900 }],
    presets.resolve('smart-atomic'),
    { min: 480, max: 600 }
  );
  assert.deepEqual(
    Array.from(filtered, function (line) { return line.element; }),
    ['H', 'Na'],
    'Preset filtering should preserve allowed in-range atomic lines'
  );

  const frontendPresets = worker.SpectraPro.presets;
  const visiblePresets = frontendPresets.getPresetGroups().flatMap(function (group) { return group.presets; });
  assert.equal(visiblePresets.some(function (preset) { return preset.id === 'lamp-hg'; }), true, 'The main-compatible Lamp preset must remain visible');
  assert.equal(frontendPresets.getCanonicalPresetId('lamp-hg'), 'lamp-hg', 'Frontend must preserve the Lamp preset ID');

  const migratedStore = worker.SpectraPro.createStateStore({ analysis: { presetId: 'lamp-hg' } });
  assert.equal(migratedStore.getState().analysis.presetId, 'lamp-hg', 'Seeded main-compatible Lamp state should be preserved');
  migratedStore.update('analysis.presetId', 'lamp-hg');
  assert.equal(migratedStore.getState().analysis.presetId, 'lamp-hg', 'Runtime Lamp state updates should be preserved');
}

function testInstrumentResponseCorrection() {
  const fixture = readJson('sample_instrument_response.json');
  assert.equal(fixture.synthetic, true, 'Response fixture must be explicitly synthetic');
  const module = worker.SpectraPro.instrumentResponse;
  const validation = module.validateProfile(fixture.profile);
  assert.equal(validation.valid, true, 'Compact response profile should validate');
  assert.deepEqual(Object.assign({}, validation.coverageNm), { min: 400, max: 600 }, 'Profile coverage should be explicit');
  assert.equal(module.validateProfile(Object.assign({}, fixture.profile, { relativeResponse: [0.5, 0, 1, 0.8, 0.4] })).reason, 'invalid-profile-values', 'Zero response must be rejected before division');
  assert.equal(module.validateProfile(Object.assign({}, fixture.profile, { wavelengthsNm: [400, 500, 450, 550, 600] })).reason, 'non-monotonic-profile-axis', 'Non-monotonic response axes must be rejected');

  const corrected = module.prepare(fixture.observedIntensity, fixture.wavelengthNm, {
    enabled: true, profile: fixture.profile, maxCorrectionFactor: 5
  });
  assert.equal(corrected.applied, true, 'Valid calibrated response correction should apply');
  assert.equal(corrected.intensityBasis, 'response-corrected-relative-intensity', 'Corrected data must remain explicitly relative');
  fixture.expected.correctedRelativeIntensity.forEach(function (expected, index) {
    within(corrected.values[index], expected, fixture.expected.maxAbsError, `response-corrected sample ${index}`);
  });
  within(corrected.normalizationResponse, fixture.expected.normalizationResponse, fixture.expected.maxAbsError, 'response normalization');
  assert.equal(corrected.clampedSampleCount, 0, 'Well-conditioned profile should not require amplification limiting');

  const pipeline = worker.SpectraPro.processingPipeline;
  const integrated = pipeline.run({ I: fixture.observedIntensity, nm: fixture.wavelengthNm }, {
    responseCorrection: { enabled: true, profile: fixture.profile, maxCorrectionFactor: 5 }
  });
  assert.deepEqual(Array.from(integrated.processedI), fixture.expected.correctedRelativeIntensity, 'Shared preprocessing should apply response correction before later stages');
  assert.ok(integrated.meta.activeOperations.includes('instrument-response'), 'Applied response correction should be recorded as active');
  assert.equal(integrated.meta.intensityBasis, 'response-corrected-relative-intensity', 'Preprocessing metadata should identify corrected relative intensity');
  assert.equal(integrated.meta.responseCorrection.profileId, fixture.profile.id, 'Preprocessing provenance should retain profile ID');

  const disabled = pipeline.run({ I: fixture.observedIntensity, nm: fixture.wavelengthNm }, { responseCorrection: { enabled: false } });
  assert.deepEqual(Array.from(disabled.processedI), fixture.observedIntensity, 'None must preserve uncorrected intensity');
  assert.equal(disabled.meta.intensityBasis, 'uncorrected-relative-intensity', 'Disabled correction must be explicit');

  const uncalibrated = module.prepare(fixture.observedIntensity, null, { enabled: true, profile: fixture.profile });
  assert.equal(uncalibrated.applied, false, 'Response correction must require calibrated wavelengths');
  assert.equal(uncalibrated.reason, 'calibrated-wavelength-axis-required', 'Missing wavelength axis should have an explicit reason');
  assert.deepEqual(Array.from(uncalibrated.values), fixture.observedIntensity, 'Unavailable correction must preserve source values');

  const derivedReferenceMode = pipeline.run({ I: fixture.observedIntensity, nm: fixture.wavelengthNm }, {
    subtractionMode: 'ratio', referenceI: [1, 1, 1, 1, 1],
    responseCorrection: { enabled: true, profile: fixture.profile }
  });
  const derivedResponseStage = derivedReferenceMode.meta.stages.find(function (stage) { return stage.id === 'instrument-response'; });
  assert.equal(derivedResponseStage.applied, false, 'Dimensionless ratio/transmittance/absorbance data must not be multiplied by an intensity response curve');
  assert.equal(derivedResponseStage.reason, 'response-correction-incompatible-with-reference-transform', 'Incompatible derived reference modes should be explicit');

  const uncovered = module.prepare([10, 10, 10], [350, 400, 450], { enabled: true, profile: fixture.profile });
  assert.equal(uncovered.reason, 'response-profile-does-not-cover-frame', 'Correction must refuse extrapolation');
  assert.equal(uncovered.extrapolatedSampleCount, 1, 'Unsupported samples should be counted');

  const restrictedProfile = Object.assign({}, fixture.profile, { applicableHardwareProfileIds: ['spectra-1'] });
  const mismatch = module.prepare(fixture.observedIntensity, fixture.wavelengthNm, {
    enabled: true, profile: restrictedProfile, hardwareProfileId: 'other'
  });
  assert.equal(mismatch.reason, 'response-profile-hardware-mismatch', 'Known profiles must respect declared hardware applicability');

  const lowResponseProfile = Object.assign({}, fixture.profile, {
    id: 'low-response-test', wavelengthsNm: [400, 500, 600], relativeResponse: [0.01, 1, 1]
  });
  const limited = module.prepare([1, 1, 1], [400, 500, 600], {
    enabled: true, profile: lowResponseProfile, maxCorrectionFactor: 5
  });
  assert.equal(limited.applied, true, 'Low response may be corrected with an explicit safety limit');
  assert.equal(limited.correctionFactorRange.max, 5, 'Noise amplification must be capped');
  assert.equal(limited.clampedSampleCount, 1, 'Capped samples should be counted');
  assert.ok(limited.warnings.includes('response-amplification-limited'), 'Amplification limiting should be visible');

  const profileStore = worker.SpectraPro.responseProfileStore;
  const custom = profileStore.parseCustomText('400,0.5\n500,1\n600,0.8', 'custom.csv');
  assert.deepEqual(Array.from(custom.wavelengthsNm), [400, 500, 600], 'Custom response wavelengths should parse deterministically');
  assert.deepEqual(Array.from(custom.relativeResponse), [0.5, 1, 0.8], 'Custom relative response should parse deterministically');
  const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'data', 'instrument_response_profiles.json'), 'utf8'));
  assert.equal(catalog.schema, 'spectra-pro-response-profile-catalog/v1', 'Bundled response catalog should be versioned');
  assert.deepEqual(catalog.profiles, [], 'No fabricated measured SPECTRA response profile should be bundled');
  assert.ok(/No measured SPECTRA/.test(catalog.note), 'Empty catalog should explain the missing measured profile');

  const uiSource = fs.readFileSync(path.join(repoRoot, 'docs', 'frontend', 'scripts', 'mod', 'proBootstrap.js'), 'utf8');
  assert.ok(uiSource.includes('spResponseProfile'), 'Hardware UI should expose None/bundled response selection');
  assert.ok(uiSource.includes('Load custom JSON/CSV'), 'Hardware UI should expose custom response loading');
  assert.ok(uiSource.includes('Response-corrected relative intensity'), 'UI must distinguish corrected relative intensity');
  assert.ok(uiSource.includes('not absolute irradiance'), 'ASTRO UI must not imply absolute radiometry');
}


function testDiffractionPeaksExcludedFromScoring() {
  const nm = [];
  const intensity = [];
  for (let wavelength = 390; wavelength <= 810; wavelength += 1) {
    nm.push(wavelength);
    const parent = 120 * Math.exp(-0.5 * Math.pow((wavelength - 400) / 1.1, 2));
    const child = 28 * Math.exp(-0.5 * Math.pow((wavelength - 800) / 1.1, 2));
    intensity.push(1 + parent + child);
  }
  const frame = {
    calibrated: true,
    nm: nm,
    px: nm.map(function (_, index) { return index; }),
    I: intensity
  };
  const result = analyze(frame, {
    preset: 'nearest',
    autoTune: false,
    peakThresholdRel: 0.01,
    peakDistancePx: 3,
    maxDistanceNm: 1.8,
    hardware: { spectrometerResolutionFwhmNm: 1.8 }
  }, {
    atomLines: [
      { element: 'P', species: 'P I', speciesKey: 'P I', nm: 400 },
      { element: 'Q', species: 'Q I', speciesKey: 'Q I', nm: 800 }
    ]
  });

  assert.ok(result.diffractionCandidates.some(function (candidate) {
    return candidate.order === 2 && Math.abs(candidate.parentNm - 400) < 1 && Math.abs(candidate.observedNm - 800) < 1;
  }), 'Synthetic 800 nm child should be detected as possible second-order diffraction');
  assert.equal(result.topHits.some(function (hit) { return hit.element === 'Q'; }), false, 'Diffraction child must not contribute to scored top hits');
  assert.ok(result.overlayHits.some(function (hit) {
    return hit.element === 'Q' && hit.excludedByDiffraction === true && hit.excludedFromScoring === true;
  }), 'Excluded diffraction match should remain available for crossed-out graph annotation');
}

function testHigherOrderDiffractionArtifacts() {
  const engine = worker.SPECTRA_PRO_diffractionArtifacts;
  assert.ok(engine && typeof engine.analyze === 'function', 'Diffraction artifact detector should be available');

  const result = {
    ok: true,
    calibrated: true,
    features: [
      { sampleIndex: 10, centerNm: 404.136, polarity: 'emission', amplitude: 125.0, prominence: 125.0, fwhmNm: 2.37, centerUncertaintyNm: 0.12, qualityFlags: [], quality: 'good' },
      { sampleIndex: 20, centerNm: 436.262, polarity: 'emission', amplitude: 136.7, prominence: 136.7, fwhmNm: 2.76, centerUncertaintyNm: 0.12, qualityFlags: [], quality: 'good' },
      { sampleIndex: 30, centerNm: 808.876, polarity: 'emission', amplitude: 23.7, prominence: 23.7, fwhmNm: 2.78, centerUncertaintyNm: 0.15, qualityFlags: [], quality: 'good' },
      { sampleIndex: 40, centerNm: 872.059, polarity: 'emission', amplitude: 50.6, prominence: 50.6, fwhmNm: 2.46, centerUncertaintyNm: 0.15, qualityFlags: [], quality: 'good' }
    ],
    qcFlags: [],
    matchUncertaintyModel: { effectiveToleranceNm: 1.8 }
  };

  const analyzed = engine.analyze(result, { calibrated: true }, {
    analysisContext: 'lab',
    hardware: { spectrometerResolutionFwhmNm: 1.8 }
  });
  assert.equal(analyzed.diffractionCandidates.length, 2, 'Expected both visible 2x diffraction candidates');
  assert.ok(analyzed.diffractionCandidates.every(function (candidate) { return candidate.order === 2; }), 'Visible fluorescent-tube artifacts should be order 2');
  assert.ok(analyzed.features[2].qualityFlags.includes('POSSIBLE_DIFFRACTION_ORDER_2'), '808.9 nm child should carry an order-2 artifact flag');
  assert.ok(analyzed.features[3].qualityFlags.includes('POSSIBLE_DIFFRACTION_ORDER_2'), '872.1 nm child should carry an order-2 artifact flag');
  assert.ok(analyzed.qcFlags.includes('POSSIBLE_HIGHER_ORDER_DIFFRACTION'), 'Result should expose an artifact QC flag');

  const strongerChild = engine.analyze({
    ok: true,
    calibrated: true,
    features: [
      { sampleIndex: 1, centerNm: 400, polarity: 'emission', amplitude: 20, prominence: 20, fwhmNm: 2, qualityFlags: [] },
      { sampleIndex: 2, centerNm: 800, polarity: 'emission', amplitude: 30, prominence: 30, fwhmNm: 2, qualityFlags: [] }
    ],
    qcFlags: [],
    matchUncertaintyModel: { effectiveToleranceNm: 1.8 }
  }, { calibrated: true }, { analysisContext: 'lab', hardware: { spectrometerResolutionFwhmNm: 1.8 } });
  assert.equal(strongerChild.diffractionCandidates.length, 0, 'A stronger child should not be auto-labelled as higher-order diffraction');
}

const groups = [
  ['atomic emission', testAtomicEmission],
  ['molecular emission', testMolecularEmission],
  ['fluorescence', testFluorescence],
  ['fluorescence clear narrow lines', testFluorescenceClearNarrowLines],
  ['quality control', testQualityControlAndSafeFailure],
  ['spectral features', testSpectralFeatures],
  ['higher-order diffraction artifacts', testHigherOrderDiffractionArtifacts],
  ['diffraction peaks excluded from scoring', testDiffractionPeaksExcludedFromScoring],
  ['calibration-aware matching', testCalibrationAwareMatching],
  ['measurement quality', testMeasurementQualityModel],
  ['formal preprocessing', testFormalPreprocessingPipeline],
  ['ASTRO continuum and absorption', testAstroContinuumAndAbsorption],
  ['bundled solar ASTRO example', testBundledSolarExample],
  ['bundled fluorescent LAB example', testBundledFluorescentExample],
  ['bundled Argon LAB example', testBundledArgonExample],
  ['stellar spectral-class evidence', testStellarClassEvidence],
  ['reference spectrum comparison', testReferenceSpectrumComparison],
  ['instrument-response correction', testInstrumentResponseCorrection],
  ['ASTRO radial velocity', testRadialVelocity],
  ['shared analysis infrastructure', testSharedAnalysisInfrastructure],
  ['atomic auto-tune diagnostic anchor', testAtomicAutoTuneDiagnosticAnchor]
];

groups.forEach(function (entry) {
  entry[1]();
  console.log(`ok - ${entry[0]}`);
});
console.log(`ANALYSIS REGRESSION: OK (${groups.length} groups)`);
