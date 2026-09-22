(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const SOURCE_URL = 'https://physics.nist.gov/PhysRefData/Handbook/periodictable.htm';
  const catalog = {
    hydrogen: {
      id: 'hydrogen', label: 'Hydrogen (H I)', kind: 'line-list', wavelengthMedium: 'air', source: 'NIST Handbook', sourceUrl: SOURCE_URL,
      defaultFwhmNm: 0.8,
      lines: [[397.007, 0.30], [410.174, 0.45], [434.046, 0.62], [486.133, 0.82], [656.281, 1.00]]
    },
    helium: {
      id: 'helium', label: 'Helium (He I)', kind: 'line-list', wavelengthMedium: 'air', source: 'NIST Handbook', sourceUrl: SOURCE_URL,
      defaultFwhmNm: 0.8,
      lines: [[388.865, 0.55], [402.619, 0.40], [447.148, 0.72], [471.314, 0.38], [492.193, 0.35], [501.568, 0.62], [587.562, 1.00], [667.815, 0.70], [706.519, 0.82], [728.135, 0.45]]
    },
    neon: {
      id: 'neon', label: 'Neon (Ne I)', kind: 'line-list', wavelengthMedium: 'air', source: 'NIST Handbook', sourceUrl: SOURCE_URL,
      defaultFwhmNm: 0.8,
      lines: [[585.249, 0.72], [603.000, 0.58], [607.434, 0.58], [614.306, 0.58], [621.728, 0.58], [626.650, 0.58], [633.443, 0.58], [638.299, 0.58], [640.225, 0.78], [650.653, 0.70], [659.895, 0.58], [692.947, 1.00], [702.405, 0.76], [703.241, 0.96], [717.394, 0.96], [724.517, 0.96]]
    },
    mercury: {
      id: 'mercury', label: 'Mercury (Hg I)', kind: 'line-list', wavelengthMedium: 'air', source: 'NIST Handbook', sourceUrl: SOURCE_URL,
      defaultFwhmNm: 0.8,
      lines: [[404.656, 0.62], [435.833, 1.00], [546.074, 0.82], [576.960, 0.42], [579.066, 0.46]]
    },
    solar: {
      id: 'solar', label: 'Solar (TSIS-1 HSRS)', kind: 'spectrum', wavelengthMedium: 'air', source: 'TSIS-1 HSRS',
      assetPath: '../data/examples/solar-tsis1-hsrs-visible-0p2nm.json'
    },
    custom: { id: 'custom', label: 'Custom numeric reference', kind: 'custom' }
  };
  const cache = Object.create(null);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Object.keys(catalog).forEach(function (id) {
    const item = catalog[id];
    if (item.kind !== 'line-list') return;
    cache[id] = Object.assign({}, item, {
      lines: item.lines.map(function (line) { return { nm: line[0], weight: line[1] }; })
    });
  });

  function list() {
    return Object.keys(catalog).map(function (id) {
      const item = catalog[id];
      return { id: item.id, label: item.label, kind: item.kind, wavelengthMedium: item.wavelengthMedium || null, source: item.source || null };
    });
  }

  function getLoadedReference(id) {
    return cache[String(id || '')] || null;
  }

  function validateNumeric(reference) {
    if (!reference || !Array.isArray(reference.wavelengthNm) || !Array.isArray(reference.intensity)) throw new Error('Reference must contain wavelengthNm and intensity arrays.');
    if (reference.wavelengthNm.length < 3 || reference.wavelengthNm.length !== reference.intensity.length) throw new Error('Reference arrays must have the same length and at least three samples.');
    const pairs = reference.wavelengthNm.map(function (nm, index) {
      return { nm: Number(nm), intensity: Number(reference.intensity[index]) };
    });
    if (!pairs.every(function (item) { return Number.isFinite(item.nm) && Number.isFinite(item.intensity); })) throw new Error('Reference values must be finite numbers.');
    pairs.sort(function (a, b) { return a.nm - b.nm; });
    for (let index = 1; index < pairs.length; index += 1) {
      if (!(pairs[index].nm > pairs[index - 1].nm)) throw new Error('Reference wavelengths must be unique.');
    }
    return {
      id: String(reference.id || 'custom'),
      label: String(reference.label || 'Custom numeric reference'),
      kind: 'spectrum',
      wavelengthMedium: String(reference.wavelengthMedium || 'unspecified'),
      source: String(reference.source || 'user-supplied'),
      wavelengthNm: pairs.map(function (item) { return item.nm; }),
      intensity: pairs.map(function (item) { return item.intensity; })
    };
  }

  function parseCustomText(text, filename) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Reference file is empty.');
    if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return validateNumeric({
          id: 'custom', label: filename || 'Custom numeric reference',
          wavelengthNm: parsed.map(function (row) { return Array.isArray(row) ? row[0] : (row.nm != null ? row.nm : row.wavelengthNm); }),
          intensity: parsed.map(function (row) { return Array.isArray(row) ? row[1] : (row.intensity != null ? row.intensity : row.I); })
        });
      }
      return validateNumeric({
        id: parsed.id || 'custom', label: parsed.label || filename || 'Custom numeric reference',
        wavelengthMedium: parsed.wavelengthMedium, source: parsed.source,
        wavelengthNm: parsed.wavelengthNm || parsed.nm,
        intensity: parsed.intensity || parsed.I
      });
    }
    const rows = raw.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    const pairs = rows.map(function (line) { return line.split(/[;,\t ]+/).map(Number); }).filter(function (row) {
      return row.length >= 2 && Number.isFinite(row[0]) && Number.isFinite(row[1]);
    });
    return validateNumeric({
      id: 'custom', label: filename || 'Custom numeric reference',
      wavelengthNm: pairs.map(function (row) { return row[0]; }),
      intensity: pairs.map(function (row) { return row[1]; })
    });
  }

  function registerCustom(reference) {
    cache.custom = validateNumeric(reference);
    cache.custom.id = 'custom';
    return cache.custom;
  }

  function loadReference(id) {
    const key = String(id || '');
    if (cache[key]) return Promise.resolve(cache[key]);
    const item = catalog[key];
    if (!item) return Promise.reject(new Error('Unknown reference: ' + key));
    if (key === 'custom') return Promise.reject(new Error('Choose a custom JSON or CSV file first.'));
    if (item.kind !== 'spectrum' || !item.assetPath || typeof global.fetch !== 'function') return Promise.reject(new Error('Reference data is unavailable.'));
    return global.fetch(item.assetPath).then(function (response) {
      if (!response.ok) throw new Error('Could not load reference data (' + response.status + ').');
      return response.json();
    }).then(function (payload) {
      cache[key] = validateNumeric({
        id: item.id, label: item.label, wavelengthMedium: payload.wavelengthMedium,
        source: payload.provenance && payload.provenance.provider || item.source,
        wavelengthNm: payload.wavelengthNm,
        intensity: payload.irradianceWm2Nm || payload.intensity || payload.I
      });
      return cache[key];
    });
  }

  sp.referenceCatalog = {
    list: list,
    getLoadedReference: getLoadedReference,
    loadReference: loadReference,
    parseCustomText: parseCustomText,
    registerCustom: registerCustom,
    validateNumeric: validateNumeric,
    _catalog: clone(catalog)
  };
})(typeof window !== 'undefined' ? window : this);
