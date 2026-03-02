(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};

  const PRESET_GROUPS = [
    {
      id: 'base',
      label: 'Base Presets',
      presets: [
        {
          id: 'nearest',
          legacyIds: ['general'],
          label: 'Nearest',
          family: 'base',
          mode: 'atomic',
          discoveryStrategy: 'local-nearest',
          refineStrategy: 'none',
          description: 'Direkt peak→närmaste linje. Bra för snabb, manuell tolkning.'
        },
        {
          id: 'wide',
          legacyIds: ['general-wide'],
          label: 'Wide',
          family: 'base',
          mode: 'atomic',
          discoveryStrategy: 'local-wide',
          refineStrategy: 'none',
          description: 'Bredare lokal matchning med fler kandidater per peak.'
        },
        {
          id: 'tight',
          legacyIds: ['general-tight'],
          label: 'Tight',
          family: 'base',
          mode: 'atomic',
          discoveryStrategy: 'local-tight',
          refineStrategy: 'none',
          description: 'Snäv lokal matchning för renare peak→line-träffar.'
        },
        {
          id: 'fast',
          legacyIds: [],
          label: 'Fast',
          family: 'base',
          mode: 'atomic',
          discoveryStrategy: 'local-fast',
          refineStrategy: 'none',
          description: 'Färre kandidater och snabbare lokal analys.'
        },
        {
          id: 'lamp-hg',
          legacyIds: [],
          label: 'Lamp (Hg/Ar/Ne)',
          family: 'base',
          mode: 'atomic',
          discoveryStrategy: 'local-lamp',
          refineStrategy: 'none',
          description: 'Enklare preset för lamp-/urladdningslinjer kring Hg/Ar/Ne.'
        }
      ]
    },
    {
      id: 'smart',
      label: 'Smart Presets',
      presets: [
        {
          id: 'smart-atomic',
          legacyIds: ['smart'],
          label: 'Atomic',
          family: 'smart',
          mode: 'atomic',
          discoveryStrategy: 'global-discovery',
          refineStrategy: 'profile-refine-atomic',
          description: 'Global ämnesbedömning för atomära spektra som H, He, Ne, Ar, Kr och Xe.'
        },
        {
          id: 'smart-molecular',
          legacyIds: [],
          label: 'Molecular',
          family: 'smart',
          mode: 'molecular',
          discoveryStrategy: 'global-discovery',
          refineStrategy: 'profile-refine-molecular',
          description: 'Avsedd för banddominerade spektra som N2 och O2.'
        },
        {
          id: 'smart-gastube',
          legacyIds: [],
          label: 'Gas Tube',
          family: 'smart',
          mode: 'mixture',
          discoveryStrategy: 'global-discovery',
          refineStrategy: 'profile-refine-gas-tube',
          description: 'Blandad smart logik för urladdningsrör med atomära och molekylära kandidater.'
        },
        {
          id: 'smart-flame',
          legacyIds: [],
          label: 'Flame',
          family: 'smart',
          mode: 'mixture',
          discoveryStrategy: 'global-discovery',
          refineStrategy: 'profile-refine-flame',
          description: 'För kommande flam-/förbränningsläge med flera samtidiga emitters.'
        },
        {
          id: 'smart-fluorescent',
          legacyIds: [],
          label: 'Fluorescent',
          family: 'smart',
          mode: 'mixture',
          discoveryStrategy: 'global-discovery',
          refineStrategy: 'profile-refine-fluorescent',
          description: 'För lysrör/lampor där Hg och hjälpgaser måste vägas ihop.'
        }
      ]
    }
  ];

  const PRESET_MAP = Object.create(null);
  const LEGACY_MAP = Object.create(null);
  PRESET_GROUPS.forEach(function (group) {
    (group.presets || []).forEach(function (preset) {
      PRESET_MAP[preset.id] = Object.assign({ groupId: group.id, groupLabel: group.label }, preset);
      (preset.legacyIds || []).forEach(function (legacyId) {
        LEGACY_MAP[String(legacyId)] = preset.id;
      });
    });
  });

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getCanonicalPresetId(presetId) {
    const id = String(presetId || '').trim();
    if (!id) return '';
    if (PRESET_MAP[id]) return id;
    if (LEGACY_MAP[id]) return LEGACY_MAP[id];
    return id;
  }

  function getPresetMeta(presetId) {
    const canonical = getCanonicalPresetId(presetId);
    return canonical && PRESET_MAP[canonical] ? clone(PRESET_MAP[canonical]) : null;
  }

  function getPresetGroups() {
    return clone(PRESET_GROUPS);
  }

  sp.presets = {
    getPresetGroups: getPresetGroups,
    getPresetMeta: getPresetMeta,
    getCanonicalPresetId: getCanonicalPresetId
  };
})(typeof window !== 'undefined' ? window : this);
