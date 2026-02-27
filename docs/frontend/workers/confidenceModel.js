(function (root) {
  'use strict';

  // Phase 2: simple but useful confidence model.
  // Goals:
  // - Return overall ~1.0 when QC is OK and the frame is calibrated.
  // - Penalize known QC flags.
  // - Never inflate confidence when uncalibrated.

  function clamp01(x) {
    x = +x;
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function qcFactor(qc) {
    const flags = qc && Array.isArray(qc.flags) ? qc.flags : [];
    let f = 1.0;
    for (let i = 0; i < flags.length; i += 1) {
      const k = String(flags[i] || '').toLowerCase();
      if (!k) continue;
      if (k === 'uncalibrated') return 0.0;
      if (k.includes('saturation') || k.includes('clipping')) f *= 0.35;
      else if (k.includes('low_snr') || k.includes('snr')) f *= 0.6;
      else if (k.includes('no_signal')) f *= 0.2;
      else if (k.includes('dark')) f *= 0.8;
      else f *= 0.85;
    }
    return clamp01(f);
  }

  function buildConfidence(matches, qc) {
    const qf = qcFactor(qc);
    // overall is primarily QC-driven in Phase 2.
    // Match-specific confidence is computed in analysisPipeline.
    return {
      ok: qf > 0,
      overall: qf,
      qcFactor: qf
    };
  }

  root.SPECTRA_PRO_confidenceModel = { buildConfidence };
})(typeof self !== 'undefined' ? self : this);
