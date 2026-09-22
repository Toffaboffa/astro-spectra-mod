(function (root) {
  'use strict';

  // SPECTRA PRO atomic fingerprint catalog.
  // Wavelengths are curated from NIST Handbook strong/persistent neutral-atom lines.
  // `weight` is a diagnostic ranking aid for low-resolution discharge spectra. It is
  // NOT an abundance, transition probability, or quantitative intensity prediction.
  const VERSION = 'atomic-fingerprint-v2';

  function line(nm, weight, diagnostic) {
    return { nm: nm, weight: weight, diagnostic: diagnostic !== false };
  }

  const profiles = {
    H: {
      element: 'H', label: 'H I', family: 'hydrogen', minimumEvidence: 2,
      lines: [
        line(397.007, 0.30, false), line(410.174, 0.45), line(434.046, 0.62),
        line(486.133, 0.82), line(656.281, 1.00)
      ],
      groups: [[410.174, 434.046, 486.133, 656.281]]
    },
    He: {
      element: 'He', label: 'He I', family: 'noble', minimumEvidence: 3,
      lines: [
        line(388.865, 0.55), line(402.619, 0.40), line(447.148, 0.72),
        line(471.314, 0.38, false), line(492.193, 0.35, false), line(501.568, 0.62),
        line(587.562, 1.00), line(667.815, 0.70), line(706.519, 0.82), line(728.135, 0.45)
      ],
      groups: [[447.148, 501.568, 587.562], [587.562, 667.815, 706.519]]
    },
    Ne: {
      element: 'Ne', label: 'Ne I', family: 'noble', minimumEvidence: 4,
      lines: [
        line(585.249, 0.72), line(594.483, 0.42, false), line(603.000, 0.58),
        line(607.434, 0.58), line(609.616, 0.34, false), line(614.306, 0.58),
        line(616.359, 0.58), line(621.728, 0.58), line(626.650, 0.58),
        line(633.443, 0.58), line(638.299, 0.58), line(640.225, 0.78),
        line(650.653, 0.70), line(659.895, 0.58), line(667.828, 0.45),
        line(692.947, 1.00), line(702.405, 0.76), line(703.241, 0.96),
        line(717.394, 0.96), line(724.517, 0.96), line(748.887, 0.66), line(753.577, 0.66)
      ],
      groups: [
        [585.249, 594.483, 603.000, 607.434, 614.306, 616.359, 621.728, 626.650, 633.443, 638.299, 640.225, 650.653, 659.895, 667.828],
        [692.947, 702.405, 703.241, 717.394, 724.517],
        [748.887, 753.577]
      ]
    },
    Ar: {
      element: 'Ar', label: 'Ar I', family: 'noble', minimumEvidence: 3,
      lines: [
        line(696.543, 0.58), line(706.722, 0.55), line(738.398, 0.42, false),
        line(750.387, 0.72), line(751.465, 0.52), line(763.511, 0.82),
        line(772.376, 0.58), line(772.421, 0.45, false), line(794.818, 0.72),
        line(800.616, 0.72), line(801.479, 0.82), line(810.369, 0.72),
        line(811.531, 1.00), line(826.452, 0.48), line(840.821, 0.58),
        line(842.465, 0.72), line(852.144, 0.58), line(866.794, 0.34, false), line(912.297, 1.00)
      ],
      groups: [[696.543, 706.722], [750.387, 751.465, 763.511, 772.376], [794.818, 800.616, 801.479, 810.369, 811.531], [826.452, 840.821, 842.465, 852.144]]
    },
    Kr: {
      element: 'Kr', label: 'Kr I', family: 'noble', minimumEvidence: 3,
      lines: [
        line(557.029, 0.42), line(587.092, 0.58), line(758.741, 0.30, false),
        line(760.155, 0.48), line(768.525, 0.30, false), line(769.454, 0.36),
        line(785.482, 0.28, false), line(805.950, 0.42), line(810.437, 0.82),
        line(811.290, 1.00), line(819.006, 0.62), line(826.324, 0.62),
        line(828.105, 0.44), line(829.811, 0.92), line(850.887, 0.62),
        line(877.675, 1.00), line(892.869, 0.42)
      ],
      groups: [[758.741, 760.155, 768.525, 769.454, 785.482], [805.950, 810.437, 811.290, 819.006, 826.324, 828.105, 829.811], [850.887, 877.675, 892.869]]
    },
    Xe: {
      element: 'Xe', label: 'Xe I', family: 'noble', minimumEvidence: 3,
      lines: [
        line(473.415, 0.32, false), line(479.262, 0.26, false), line(480.702, 0.28, false),
        line(482.971, 0.26, false), line(491.651, 0.30, false), line(492.315, 0.30, false),
        line(823.164, 1.00), line(828.012, 0.82), line(834.682, 0.48),
        line(840.919, 0.48), line(881.941, 0.66), line(895.225, 0.36)
      ],
      groups: [[473.415, 479.262, 480.702, 482.971, 491.651, 492.315], [823.164, 828.012, 834.682, 840.919], [881.941, 895.225]]
    },
    Hg: {
      element: 'Hg', label: 'Hg I', family: 'lamp', minimumEvidence: 2,
      lines: [
        line(404.656, 0.62), line(435.833, 1.00), line(546.074, 0.82),
        line(576.960, 0.42), line(579.066, 0.46), line(708.190, 0.18, false)
      ],
      groups: [[404.656, 435.833, 546.074], [576.960, 579.066]]
    },
    O: {
      element: 'O', label: 'O I', family: 'oxygen', minimumEvidence: 2,
      // Low-resolution discharge-tube fingerprint. The 777 nm and 844.6 nm
      // multiplets are represented by one anchor each so an unresolved triplet
      // is not penalized as three missing lines.
      lines: [
        line(615.818, 0.30, false),
        line(645.598, 0.28, false),
        line(700.223, 0.34, false),
        line(725.415, 0.34, false),
        line(777.350, 1.00, true),
        line(822.182, 0.28, false),
        line(844.650, 1.00, true)
      ],
      groups: [[700.223, 725.415, 777.350], [777.350, 844.650]]
    }
  };

  const presetMap = {
    'smart-atomic': ['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'Hg', 'O'],
    'smart-gastube': ['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'Hg', 'O'],
    'smart-fluorescent': ['Hg', 'Ne', 'Ar', 'Kr', 'Xe']
  };

  function getForPreset(presetId) {
    const ids = presetMap[String(presetId || '').toLowerCase()] || [];
    return ids.map(function (id) { return profiles[id]; }).filter(Boolean);
  }

  root.SPECTRA_PRO_atomicProfiles = {
    version: VERSION,
    profiles: profiles,
    getForPreset: getForPreset
  };
})(typeof self !== 'undefined' ? self : this);
