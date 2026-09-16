(function (root) {
  'use strict';

  // Curated low-resolution plasma fingerprints used as an evidence layer on top
  // of the generic molecular library. These are band heads, not atomic lines.
  // N2: second positive system (C3Pi_u -> B3Pi_g)
  // N2+: first negative system (B2Sigma_u+ -> X2Sigma_g+)
  // References:
  // - Cicala et al., Plasma Sources Sci. Technol. 18 (2009) 025032
  // - Degen, Synthetic spectra for auroral studies I: N2+ first negative system (1977)
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
    }
  };

  root.SPECTRA_PRO_plasmaProfiles = {
    version: '1.0.1',
    scoreLabel: 'Score share',
    scoreHelp: 'Relative share of the positive Smart candidate score. This is not a statistical probability or abundance estimate.',
    profiles: PROFILES
  };
})(typeof self !== 'undefined' ? self : this);
