(function (root) {
  'use strict';

  // Curated low-resolution discharge fingerprints used as an evidence layer on
  // top of the generic molecular library. A profile may contain molecular band
  // heads and/or atomic dissociation products. The latter identify a coherent
  // discharge signature, not the parent molecule by a single fragment line.
  // N2: second positive system (C3Pi_u -> B3Pi_g)
  // N2+: first negative system (B2Sigma_u+ -> X2Sigma_g+)
  // O2: O I dissociation emission plus the O2 atmospheric-system emission band
  // CO2: CO Angstrom-system discharge bands, with O I only as supporting evidence
  // H2O: Balmer + O I dissociation products; OH(A-X) 309 nm is retained for UV-capable instruments
  // References:
  // - Cicala et al., Plasma Sources Sci. Technol. 18 (2009) 025032
  // - Degen, Synthetic spectra for auroral studies I: N2+ first negative system (1977)
  // - Cvelbar et al., Vacuum 82 (2007) 224-227, doi:10.1016/j.vacuum.2007.07.016
  // - NIST NSRDS-NBS 5, The Band Spectrum of Carbon Monoxide (1966)
  // - water-vapor plasma OES literature: OH(A-X) ~309 nm, H-alpha/H-beta and O I ~777 nm
  const PROFILES = {
    N2: {
      species: 'N2',
      label: 'N2 second positive',
      minimumStrongEvidence: 3,
      anchors: [
        { nm: 389.46, weight: 0.90 },
        { nm: 394.30, weight: 0.85 },
        { nm: 399.84, weight: 1.05 },
        { nm: 405.94, weight: 1.10 },
        { nm: 409.48, weight: 0.65 },
        { nm: 414.18, weight: 0.85 },
        { nm: 420.05, weight: 0.95 },
        { nm: 426.97, weight: 1.05 },
        { nm: 434.36, weight: 0.95 }
      ]
    },
    'N2+': {
      species: 'N2+',
      label: 'N2+ first negative',
      minimumStrongEvidence: 2,
      anchors: [
        // 388/420/428 nm overlap or blend with neutral-N2 structure at
        // modest resolution, so they carry less standalone diagnostic weight.
        { nm: 388.43, weight: 0.35 },
        { nm: 391.44, weight: 1.50 },
        { nm: 419.91, weight: 0.30 },
        { nm: 423.65, weight: 0.45 },
        { nm: 427.81, weight: 0.55 },
        { nm: 470.90, weight: 0.90 }
      ]
    },
    O2: {
      species: 'O2',
      label: 'O2 discharge signature',
      presets: ['smart-gastube'],
      strictAcceptance: true,
      minimumStrongEvidence: 2,
      minimumEvidenceGroups: 2,
      anchors: [
        { nm: 762.0, weight: 0.80, group: 'molecular-o2', emitter: 'O2' },
        { nm: 777.4, weight: 1.35, group: 'atomic-o', emitter: 'O I' },
        { nm: 844.6, weight: 1.20, group: 'atomic-o', emitter: 'O I' }
      ]
    },
    CO2: {
      species: 'CO2',
      label: 'CO2 discharge signature (CO + O products)',
      presets: ['smart-gastube'],
      strictAcceptance: true,
      minimumStrongEvidence: 3,
      minimumEvidenceGroups: 1,
      requiredGroups: ['co-band'],
      anchors: [
        { nm: 451.1, weight: 1.10, group: 'co-band', emitter: 'CO Angstrom' },
        { nm: 483.5, weight: 1.20, group: 'co-band', emitter: 'CO Angstrom' },
        { nm: 519.8, weight: 1.25, group: 'co-band', emitter: 'CO Angstrom' },
        { nm: 561.0, weight: 1.30, group: 'co-band', emitter: 'CO Angstrom' },
        { nm: 777.4, weight: 0.45, group: 'atomic-o', emitter: 'O I' },
        { nm: 844.6, weight: 0.40, group: 'atomic-o', emitter: 'O I' }
      ]
    },
    H2O: {
      species: 'H2O',
      label: 'H2O discharge signature (OH + H + O products)',
      presets: ['smart-gastube'],
      strictAcceptance: true,
      minimumStrongEvidence: 3,
      minimumEvidenceGroups: 2,
      requiredGroups: ['hydrogen'],
      anchors: [
        { nm: 308.9, weight: 1.40, group: 'oh', emitter: 'OH A-X' },
        { nm: 486.13, weight: 1.05, group: 'hydrogen', emitter: 'H-beta' },
        { nm: 656.28, weight: 1.20, group: 'hydrogen', emitter: 'H-alpha' },
        { nm: 777.4, weight: 0.75, group: 'atomic-o', emitter: 'O I' },
        { nm: 844.6, weight: 0.60, group: 'atomic-o', emitter: 'O I' }
      ]
    }
  };

  root.SPECTRA_PRO_plasmaProfiles = {
    version: '1.1.0',
    scoreLabel: 'Score share',
    scoreHelp: 'Relative share of the positive Smart candidate score. This is not a statistical probability or abundance estimate.',
    profiles: PROFILES
  };
})(typeof self !== 'undefined' ? self : this);
