(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};
  const CATALOG_SCHEMA = 'spectra-pro-response-profile-catalog/v1';
  const PROFILE_SCHEMA = 'spectra-pro-response-profile/v1';
  const bundled = Object.create(null);

  function validator(profile) {
    return sp.instrumentResponse && typeof sp.instrumentResponse.validateProfile === 'function'
      ? sp.instrumentResponse.validateProfile(profile)
      : { valid: false, reason: 'response-validator-unavailable' };
  }

  function normalizeProfile(profile) {
    const validation = validator(profile);
    if (!validation.valid) throw new Error(validation.reason);
    return {
      schema: PROFILE_SCHEMA,
      id: String(profile.id || 'custom-response'),
      label: String(profile.label || profile.id || 'Custom response profile'),
      source: String(profile.source || 'user-supplied'),
      wavelengthMedium: String(profile.wavelengthMedium || 'unspecified'),
      applicableHardwareProfileIds: Array.isArray(profile.applicableHardwareProfileIds) ? profile.applicableHardwareProfileIds.map(String).filter(Boolean) : [],
      wavelengthsNm: profile.wavelengthsNm.map(Number),
      relativeResponse: profile.relativeResponse.map(Number),
      provenance: profile.provenance && typeof profile.provenance === 'object' ? profile.provenance : null
    };
  }

  function parseCustomText(text, filename) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('response-profile-file-empty');
    if (raw.charAt(0) === '{') {
      const parsed = JSON.parse(raw);
      return normalizeProfile(Object.assign({}, parsed, {
        schema: parsed.schema || PROFILE_SCHEMA,
        id: parsed.id || 'custom-response',
        label: parsed.label || filename || 'Custom response profile'
      }));
    }
    const rows = raw.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
      return line.split(/[;,\t ]+/).map(Number);
    }).filter(function (row) { return row.length >= 2 && Number.isFinite(row[0]) && Number.isFinite(row[1]); });
    return normalizeProfile({
      schema: PROFILE_SCHEMA, id: 'custom-response', label: filename || 'Custom response profile', source: 'user-supplied',
      wavelengthsNm: rows.map(function (row) { return row[0]; }), relativeResponse: rows.map(function (row) { return row[1]; })
    });
  }

  function loadBundled(path) {
    if (typeof global.fetch !== 'function') return Promise.reject(new Error('fetch-unavailable'));
    return global.fetch(path || '../data/instrument_response_profiles.json').then(function (response) {
      if (!response.ok) throw new Error('response-profile-catalog-load-failed-' + response.status);
      return response.json();
    }).then(function (catalog) {
      if (!catalog || catalog.schema !== CATALOG_SCHEMA || !Array.isArray(catalog.profiles)) throw new Error('invalid-response-profile-catalog');
      const warnings = [];
      catalog.profiles.forEach(function (profile) {
        try {
          const normalized = normalizeProfile(profile);
          bundled[normalized.id] = normalized;
        } catch (error) {
          warnings.push(String(profile && profile.id || 'unknown') + ':' + String(error && error.message || error));
        }
      });
      return { profiles: listBundled(), warnings: warnings, note: String(catalog.note || '') };
    });
  }

  function listBundled() {
    return Object.keys(bundled).sort().map(function (id) { return bundled[id]; });
  }

  function getBundled(id) {
    return bundled[String(id || '')] || null;
  }

  sp.responseProfileStore = {
    catalogSchema: CATALOG_SCHEMA,
    profileSchema: PROFILE_SCHEMA,
    loadBundled: loadBundled,
    listBundled: listBundled,
    getBundled: getBundled,
    parseCustomText: parseCustomText,
    normalizeProfile: normalizeProfile
  };
})(typeof window !== 'undefined' ? window : this);
