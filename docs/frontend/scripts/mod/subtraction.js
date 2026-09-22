(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function finiteArray(values, length) {
    if (!Array.isArray(values) || values.length !== length) return null;
    const output = values.map(Number);
    return output.every(Number.isFinite) ? output : null;
  }

  function safeDiv(a, b, diagnostics) {
    if (!Number.isFinite(b) || Math.abs(b) <= 1e-12) {
      diagnostics.invalidDivisionCount += 1;
      return 0;
    }
    return a / b;
  }

  function safeLog10(value, diagnostics) {
    if (!(value > 0)) {
      diagnostics.invalidLogCount += 1;
      return 0;
    }
    return Math.log(value) / Math.LN10;
  }

  function process(rawInput, referenceInput, darkInput, requestedMode) {
    const raw = Array.isArray(rawInput) ? rawInput.map(function (value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }) : [];
    const mode = String(requestedMode || 'raw').toLowerCase();
    const supported = ['raw', 'raw-dark', 'difference', 'ratio', 'transmittance', 'absorbance'];
    const effectiveMode = supported.indexOf(mode) !== -1 ? mode : 'raw';
    const reference = finiteArray(referenceInput, raw.length);
    const dark = finiteArray(darkInput, raw.length);
    const diagnostics = { invalidDivisionCount: 0, invalidLogCount: 0 };
    const warnings = [];
    if (effectiveMode !== mode) warnings.push('unsupported-subtraction-mode');

    const needsReference = ['difference', 'ratio', 'transmittance', 'absorbance'].indexOf(effectiveMode) !== -1;
    const needsDark = effectiveMode === 'raw-dark';
    if (needsReference && !reference) warnings.push('reference-unavailable-or-length-mismatch');
    if (needsDark && !dark) warnings.push('dark-unavailable-or-length-mismatch');

    const output = raw.slice();
    if (effectiveMode === 'raw-dark' && dark) {
      for (let index = 0; index < raw.length; index += 1) output[index] = raw[index] - dark[index];
    } else if (effectiveMode === 'difference' && reference) {
      for (let index = 0; index < raw.length; index += 1) output[index] = raw[index] - reference[index];
    } else if (effectiveMode === 'ratio' && reference) {
      for (let index = 0; index < raw.length; index += 1) output[index] = safeDiv(raw[index], reference[index], diagnostics);
    } else if ((effectiveMode === 'transmittance' || effectiveMode === 'absorbance') && reference) {
      for (let index = 0; index < raw.length; index += 1) {
        const numerator = raw[index] - (dark ? dark[index] : 0);
        const denominator = reference[index] - (dark ? dark[index] : 0);
        const ratio = safeDiv(numerator, denominator, diagnostics);
        output[index] = effectiveMode === 'transmittance' ? 100 * ratio : -safeLog10(ratio, diagnostics);
      }
    }
    if (diagnostics.invalidDivisionCount) warnings.push('zero-reference-denominator');
    if (diagnostics.invalidLogCount) warnings.push('non-positive-absorbance-ratio');

    return {
      values: output,
      requestedMode: mode,
      effectiveMode: effectiveMode,
      darkAvailable: !!dark,
      referenceAvailable: !!reference,
      darkApplied: !!dark && (effectiveMode === 'raw-dark' || effectiveMode === 'transmittance' || effectiveMode === 'absorbance'),
      referenceApplied: !!reference && needsReference,
      warnings: warnings,
      diagnostics: diagnostics
    };
  }

  function applyMode(raw, reference, dark, mode) {
    return process(raw, reference, dark, mode).values;
  }

  sp.subtraction = { process: process, applyMode: applyMode };
})(window);
