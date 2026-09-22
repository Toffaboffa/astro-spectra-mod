(function (root) {
  'use strict';

  // Compact low-resolution teaching set. Wavelengths are standard air values in
  // nm, rounded from the NIST Handbook of Basic Atomic Spectroscopic Data.
  // This is deliberately not a general-purpose stellar line database.
  const lines = [
    { id: 'ca-ii-k', label: 'Ca II K', element: 'Ca', species: 'Ca II', speciesKey: 'Ca II K', nm: 393.36614, family: 'calcium' },
    { id: 'ca-ii-h', label: 'Ca II H', element: 'Ca', species: 'Ca II', speciesKey: 'Ca II H', nm: 396.84673, family: 'calcium' },
    { id: 'h-delta', label: 'Hδ', element: 'H', species: 'H I', speciesKey: 'H I H-delta', nm: 410.174, family: 'balmer' },
    { id: 'h-gamma', label: 'Hγ', element: 'H', species: 'H I', speciesKey: 'H I H-gamma', nm: 434.047, family: 'balmer' },
    { id: 'he-i-4388', label: 'He I 438.8', element: 'He', species: 'He I', speciesKey: 'He I 438.8', nm: 438.793, family: 'helium' },
    { id: 'he-i-4471', label: 'He I 447.1', element: 'He', species: 'He I', speciesKey: 'He I 447.1', nm: 447.1479, family: 'helium' },
    { id: 'mg-ii-4481', label: 'Mg II 448.1', element: 'Mg', species: 'Mg II', speciesKey: 'Mg II 448.1', nm: 448.1126, family: 'magnesium' },
    { id: 'he-ii-4542', label: 'He II 454.2', element: 'He', species: 'He II', speciesKey: 'He II 454.2', nm: 454.159, family: 'helium' },
    { id: 'he-ii-4686', label: 'He II 468.6', element: 'He', species: 'He II', speciesKey: 'He II 468.6', nm: 468.568, family: 'helium' },
    { id: 'h-beta', label: 'Hβ', element: 'H', species: 'H I', speciesKey: 'H I H-beta', nm: 486.133, family: 'balmer' },
    { id: 'mg-i-b4', label: 'Mg I b4', element: 'Mg', species: 'Mg I', speciesKey: 'Mg I b4', nm: 516.7322, family: 'magnesium' },
    { id: 'mg-i-b2', label: 'Mg I b2', element: 'Mg', species: 'Mg I', speciesKey: 'Mg I b2', nm: 517.2684, family: 'magnesium' },
    { id: 'mg-i-b1', label: 'Mg I b1', element: 'Mg', species: 'Mg I', speciesKey: 'Mg I b1', nm: 518.3604, family: 'magnesium' },
    { id: 'he-i-5876', label: 'He I 587.6', element: 'He', species: 'He I', speciesKey: 'He I 587.6', nm: 587.56148, family: 'helium' },
    { id: 'na-i-d2', label: 'Na I D2', element: 'Na', species: 'Na I', speciesKey: 'Na I D2', nm: 588.9950, family: 'sodium' },
    { id: 'na-i-d1', label: 'Na I D1', element: 'Na', species: 'Na I', speciesKey: 'Na I D1', nm: 589.5924, family: 'sodium' },
    { id: 'h-alpha', label: 'Hα', element: 'H', species: 'H I', speciesKey: 'H I H-alpha', nm: 656.281, family: 'balmer' },
    { id: 'he-i-6678', label: 'He I 667.8', element: 'He', species: 'He I', speciesKey: 'He I 667.8', nm: 667.81517, family: 'helium' }
  ];

  root.SPECTRA_PRO_astroReferences = {
    id: 'astro-education-air-v1',
    wavelengthMedium: 'air',
    purpose: 'curated-low-resolution-educational-absorption-matching',
    source: 'NIST Handbook of Basic Atomic Spectroscopic Data',
    sourceUrl: 'https://physics.nist.gov/PhysRefData/Handbook/periodictable.htm',
    sourceUrls: [
      'https://physics.nist.gov/PhysRefData/Handbook/Tables/hydrogentable2.htm',
      'https://physics.nist.gov/PhysRefData/Handbook/Tables/heliumtable2.htm',
      'https://physics.nist.gov/PhysRefData/Handbook/Tables/sodiumtable2.htm',
      'https://physics.nist.gov/PhysRefData/Handbook/Tables/magnesiumtable2.htm',
      'https://physics.nist.gov/PhysRefData/Handbook/Tables/calciumtable2.htm'
    ],
    lines: lines
  };
})(typeof self !== 'undefined' ? self : this);
