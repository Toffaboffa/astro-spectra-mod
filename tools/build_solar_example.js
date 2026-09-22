/*
  Rebuild the bundled numeric solar example from the official LASP LISIRD
  TSIS-1 Hybrid Solar Reference Spectrum (HSRS) endpoint.

  The upstream wavelengths are vacuum wavelengths. This script converts them
  to standard-air wavelengths with the Edlen (1966) refractive-index formula,
  then averages the native samples into deterministic 0.2 nm bins.
*/

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT = path.resolve(
  __dirname,
  '..',
  'docs',
  'frontend',
  'data',
  'examples',
  'solar-tsis1-hsrs-visible-0p2nm.json'
);
const SOURCE_URL = 'https://lasp.colorado.edu/lisird/latis/dap/tsis1_hsrs.csv?wavelength%3E=387.8&wavelength%3C=670.4';
const START_NM = 388;
const END_NM = 670;
const STEP_NM = 0.2;

function vacuumToStandardAirNm(vacuumNm) {
  const sigmaSquared = Math.pow(1000 / vacuumNm, 2);
  const refractiveIndex = 1 + 1e-6 * (
    64.328 +
    29498.1 / (146 - sigmaSquared) +
    255.4 / (41 - sigmaSquared)
  );
  return vacuumNm / refractiveIndex;
}

function parseCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map(function (line) {
    const fields = line.split(',');
    return {
      vacuumNm: Number(fields[0]),
      irradiance: Number(fields[1])
    };
  }).filter(function (row) {
    return Number.isFinite(row.vacuumNm) && Number.isFinite(row.irradiance);
  });
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error('HSRS download failed with HTTP ' + response.status);
  const rows = parseCsv(await response.text());
  if (rows.length < 200000) throw new Error('HSRS response was unexpectedly short: ' + rows.length);

  const count = Math.round((END_NM - START_NM) / STEP_NM) + 1;
  const sums = new Array(count).fill(0);
  const samples = new Array(count).fill(0);
  rows.forEach(function (row) {
    const airNm = vacuumToStandardAirNm(row.vacuumNm);
    const index = Math.round((airNm - START_NM) / STEP_NM);
    if (index < 0 || index >= count) return;
    const center = START_NM + index * STEP_NM;
    if (Math.abs(airNm - center) > STEP_NM / 2 + 1e-9) return;
    sums[index] += row.irradiance;
    samples[index] += 1;
  });

  const missing = samples.map(function (n, index) { return n ? -1 : index; }).filter(function (index) { return index >= 0; });
  if (missing.length) throw new Error('Missing output bins: ' + missing.join(', '));

  const wavelengthNm = new Array(count);
  const irradianceWm2Nm = new Array(count);
  for (let index = 0; index < count; index += 1) {
    wavelengthNm[index] = round(START_NM + index * STEP_NM, 6);
    irradianceWm2Nm[index] = round(sums[index] / samples[index], 9);
  }

  const asset = {
    schema: 'spectra-pro-numeric-example/v1',
    id: 'solar-tsis1-hsrs-visible',
    title: 'Solar spectrum — TSIS-1 HSRS',
    scientificRole: 'measured-reference-spectrum',
    wavelengthMedium: 'standard-air',
    units: {
      wavelength: 'nm',
      irradiance: 'W m^-2 nm^-1'
    },
    grid: {
      startNm: START_NM,
      endNm: END_NM,
      stepNm: STEP_NM,
      count: count
    },
    calibration: {
      direction: 'nm-left-to-right',
      points: [
        { px: 1, nm: START_NM },
        { px: Math.floor((count + 1) / 2), nm: round(START_NM + Math.floor((count - 1) / 2) * STEP_NM, 6) },
        { px: count, nm: END_NM }
      ],
      source: 'Wavelength grid supplied by the TSIS-1 HSRS data product; vacuum wavelengths converted to standard air.'
    },
    provenance: {
      provider: 'Laboratory for Atmospheric and Space Physics (LASP), University of Colorado Boulder',
      dataset: 'TSIS-1 Hybrid Solar Reference Spectrum (HSRS)',
      sourceUrl: 'https://lasp.colorado.edu/lisird/data/tsis1_hsrs',
      dataApiUrl: SOURCE_URL,
      primaryReference: 'Coddington et al. (2021), The TSIS-1 Hybrid Solar Reference Spectrum',
      primaryReferenceDoi: '10.1029/2020GL091709',
      accessedDate: '2026-09-22',
      sourceWavelengthMedium: 'vacuum',
      conversion: {
        method: 'Edlen (1966) standard-air refractive-index formula',
        reference: 'B. Edlen, Metrologia 2 (1966) 71-80',
        doi: '10.1088/0026-1394/2/2/002'
      },
      resampling: 'Arithmetic mean of native HSRS irradiance samples in nearest 0.2 nm standard-air bins.',
      generatedBy: 'tools/build_solar_example.js'
    },
    wavelengthNm: wavelengthNm,
    irradianceWm2Nm: irradianceWm2Nm
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(asset, null, 2) + '\n', 'utf8');
  process.stdout.write('Wrote ' + OUTPUT + ' (' + count + ' bins; ' + rows.length + ' source rows)\n');
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
