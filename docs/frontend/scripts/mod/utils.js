// utils.js
// Shared frontend helpers.
(function (global) {
  const sp = global.SpectraPro = global.SpectraPro || {};
  const utils = sp.utils = sp.utils || {};
  const SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };

  function toSubscriptDigits(text) {
    return String(text || '').replace(/[0-9]/g, function (d) { return SUB[d] || d; });
  }

  function formatChemicalLabel(label) {
    const raw = String(label == null ? '' : label);
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return raw;

    const match = trimmed.match(/^([^+-]+?)([+-]+)?$/);
    const base = match ? match[1] : trimmed;
    const charge = match ? (match[2] || '') : '';

    if (base.indexOf('_') !== -1 || /\s/.test(base)) return raw;
    if (!/^(?:\([A-Za-z0-9]+\)\d*|[A-Z][a-z]?\d*)+$/.test(base)) return raw;

    const tokens = base.match(/[A-Z][a-z]?/g) || [];
    const hasStoichDigits = /\d/.test(base);
    const looksMolecular = tokens.length >= 2 || (tokens.length === 1 && hasStoichDigits);
    if (!looksMolecular) return raw;

    return base.replace(/(\d+)/g, function (_, digits) { return toSubscriptDigits(digits); }) + charge;
  }

  utils.toSubscriptDigits = toSubscriptDigits;
  utils.formatChemicalLabel = formatChemicalLabel;
})(window);
