(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.calibrationIO || (v15.calibrationIO = {});

  function toNum(v) {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }
  function normalizePoint(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const px = toNum(obj.px != null ? obj.px : (obj.pixel != null ? obj.pixel : obj.x));
    const nm = toNum(obj.nm != null ? obj.nm : (obj.wavelength != null ? obj.wavelength : obj.y));
    if (px == null || nm == null) return null;
    const out = { px, nm };
    if (obj.label != null && String(obj.label).trim()) out.label = String(obj.label).trim();
    if (obj.enabled === false) out.enabled = false;
    return out;
  }
  mod.parseCalibrationFile = function parseCalibrationFile(text, opts) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const options = opts || {};
    const points = [];
    if (!options.formatHint || options.formatHint === 'json') {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.points) ? parsed.points : null);
        if (arr) {
          arr.forEach(function (p) { const n = normalizePoint(p); if (n) points.push(n); });
          return points;
        }
      } catch (_) {}
    }
    raw.split(/\r?\n/).forEach(function (line) {
      const s = String(line || '').trim();
      if (!s || s.startsWith('#')) return;
      const parts = s.split(/[;,\t]/).map(function (x) { return String(x).trim(); });
      if (parts.length < 2) return;
      if (/^px$/i.test(parts[0]) || /^pixel$/i.test(parts[0])) return;
      const px = toNum(parts[0]);
      const nm = toNum(parts[1]);
      if (px == null || nm == null) return;
      const p = { px, nm };
      if (parts[2]) p.label = parts[2];
      // Optional 4th column: enabled (0/1/true/false)
      if (parts[3]) {
        const e = String(parts[3]).toLowerCase();
        if (e === '0' || e === 'false' || e === 'no' || e === 'off') p.enabled = false;
      }
      points.push(p);
    });
    return points;
  };
  mod.serializeCalibrationPoints = function serializeCalibrationPoints(points, opts) {
    const arr = Array.isArray(points) ? points.map(normalizePoint).filter(Boolean) : [];
    const format = String((opts && opts.format) || 'json').toLowerCase();
    if (format === 'csv') {
      const lines = ['px,nm,label,enabled'];
      arr.forEach(function (p) { lines.push([p.px, p.nm, p.label || '', (p.enabled === false ? 0 : 1)].join(',')); });
      return lines.join('\n');
    }
    return JSON.stringify({ points: arr, count: arr.length, exportedAt: Date.now() }, null, 2);
  };

  mod.normalizeAndValidatePoints = function normalizeAndValidatePoints(points, opts) {
    const options = Object.assign({ minPoints: 2, maxPoints: 15, sortBy: 'px', dedupe: true }, opts || {});
    const inputArr = Array.isArray(points) ? points : [];
    const rawCount = inputArr.length;
    const arr = inputArr.map(normalizePoint).filter(Boolean);
    const invalidDropped = Math.max(0, rawCount - arr.length);
    const seenExact = new Set();
    const seenPx = new Set();
    const seenNm = new Set();
    let duplicateExact = 0;
    let duplicatePxOnly = 0;
    let duplicateNmOnly = 0;
    const out = [];
    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i];
      const keyExact = String(p.px) + '|' + String(p.nm);
      const keyPx = String(p.px);
      const keyNm = String(p.nm);
      if (seenPx.has(keyPx)) duplicatePxOnly += 1;
      if (seenNm.has(keyNm)) duplicateNmOnly += 1;
      if (options.dedupe && seenExact.has(keyExact)) {
        duplicateExact += 1;
        continue;
      }
      seenExact.add(keyExact);
      seenPx.add(keyPx);
      seenNm.add(keyNm);
      out.push(p);
    }
    let sorted = false;
    if (String(options.sortBy || '').toLowerCase() === 'px') {
      const before = JSON.stringify(out.map(function (p) { return [p.px, p.nm]; }));
      out.sort(function (a, b) { return (a.px - b.px) || (a.nm - b.nm); });
      sorted = before !== JSON.stringify(out.map(function (p) { return [p.px, p.nm]; }));
    }
    const maxPoints = Math.max(1, Number(options.maxPoints) || 15);
    const limited = out.slice(0, maxPoints);
    const minPoints = Math.max(2, Number(options.minPoints) || 2);
    const valid = limited.length >= minPoints;
    const truncated = out.length > limited.length;
    const warnings = [];
    if (invalidDropped) warnings.push(invalidDropped + ' invalid row(s) dropped');
    if (duplicateExact) warnings.push(duplicateExact + ' exact duplicate(s) removed');
    if (duplicatePxOnly > duplicateExact) warnings.push((duplicatePxOnly - duplicateExact) + ' duplicate px value(s) remain');
    if (duplicateNmOnly > duplicateExact) warnings.push((duplicateNmOnly - duplicateExact) + ' duplicate nm value(s) remain');
    if (sorted) warnings.push('points sorted by px');
    if (truncated) warnings.push('trimmed to max ' + maxPoints + ' points');
    const message = valid
      ? ('OK (' + limited.length + ' point(s))')
      : ('Need at least ' + minPoints + ' valid point(s), got ' + limited.length);
    return {
      ok: valid,
      points: limited,
      count: limited.length,
      truncated: truncated,
      message: message,
      warnings: warnings,
      stats: {
        rawCount: rawCount,
        validCount: arr.length,
        invalidDropped: invalidDropped,
        duplicateExactRemoved: duplicateExact,
        duplicatePxSeen: duplicatePxOnly,
        duplicateNmSeen: duplicateNmOnly,
        sortedByPx: sorted,
        trimmedToMax: truncated
      }
    };
  };

  mod.version = 'step6-calibration-io-apply-ready';
})();

/* SPECTRA-PRO v2.0.2 startup calibration UX */
(function () {
  'use strict';

  const sp = window.SpectraPro || (window.SpectraPro = {});
  const UI_VERSION = 'v2.3.9';
  let wasCalibrated = false;
  let loadPromptDismissed = false;
  let axisPromptShown = false;
  let suppressAxisPromptUntil = 0;

  function isCalibratedNow() {
    try {
      if (window.SpectraCore && window.SpectraCore.calibration && typeof window.SpectraCore.calibration.getState === 'function') {
        const state = window.SpectraCore.calibration.getState() || {};
        if (state.calibrated != null) return !!state.calibrated;
        if (Array.isArray(state.coefficients)) return state.coefficients.length > 0;
      }
    } catch (_) {}
    try {
      if (typeof window.isCalibrated === 'function') return !!window.isCalibrated();
    } catch (_) {}
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const cal = state && state.calibration ? state.calibration : null;
      if (cal) {
        if (cal.isCalibrated != null) return !!cal.isCalibrated;
        if (cal.calibrated != null) return !!cal.calibrated;
        if (Array.isArray(cal.coefficients)) return cal.coefficients.length > 0;
      }
    } catch (_) {}
    return false;
  }

  function installPromptCss() {
    if (document.getElementById('spCalibrationPromptStyle')) return;
    const style = document.createElement('style');
    style.id = 'spCalibrationPromptStyle';
    style.textContent = [
      '#graphWindowContainer{position:relative;}',
      '.sp-calibration-prompt{',
      'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:2500;',
      'display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);',
      'padding:8px 12px;border-radius:8px;',
      'font:600 13px/1.25 system-ui,-apple-system,Segoe UI,sans-serif;',
      'color:#eefaff;background:rgba(7,18,34,.94);border:1px solid rgba(66,217,230,.62);',
      'box-shadow:0 4px 16px rgba(0,0,0,.38);backdrop-filter:blur(3px);',
      '}',
      '.sp-calibration-prompt__text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.sp-calibration-prompt__buttons{display:flex;gap:6px;flex:0 0 auto;}',
      '.sp-calibration-prompt__btn{',
      'border:1px solid rgba(105,215,229,.55);border-radius:6px;padding:3px 10px;',
      'font:600 12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;',
      'color:#ecfbff;background:#173356;',
      '}',
      '.sp-calibration-prompt__btn:hover{background:#224876;}',
      '.sp-calibration-prompt__btn--no{background:#17243a;border-color:rgba(255,255,255,.22);}',
      '@media (max-width:700px){.sp-calibration-prompt{top:5px;font-size:11px;padding:6px 8px;gap:6px}.sp-calibration-prompt__btn{padding:2px 7px;font-size:11px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function updateVersionBadge() {
    sp.version = UI_VERSION;
    const badge = document.getElementById('spVersionBadge');
    if (badge) {
      badge.textContent = UI_VERSION;
      badge.title = 'SPECTRA PRO ' + UI_VERSION;
    }
  }

  function hidePrompt() {
    const old = document.getElementById('spCalibrationPrompt');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function showPrompt(text, onYes, onNo) {
    installPromptCss();
    const host = document.getElementById('graphWindowContainer') || document.getElementById('graphWindow');
    if (!host) return false;
    hidePrompt();

    const box = document.createElement('div');
    box.id = 'spCalibrationPrompt';
    box.className = 'sp-calibration-prompt';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');

    const label = document.createElement('div');
    label.className = 'sp-calibration-prompt__text';
    label.textContent = text;

    const buttons = document.createElement('div');
    buttons.className = 'sp-calibration-prompt__buttons';

    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'sp-calibration-prompt__btn';
    yes.textContent = 'Yes';
    yes.addEventListener('click', function () {
      if (typeof onYes === 'function') onYes();
    });

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'sp-calibration-prompt__btn sp-calibration-prompt__btn--no';
    no.textContent = 'No';
    no.addEventListener('click', function () {
      if (typeof onNo === 'function') onNo();
      else hidePrompt();
    });

    buttons.appendChild(yes);
    buttons.appendChild(no);
    box.appendChild(label);
    box.appendChild(buttons);
    host.appendChild(box);
    return true;
  }

  function requestCalibrationFile() {
    const input = document.getElementById('my-file');
    if (!input) return;
    try { input.click(); } catch (_) {}
  }

  function switchXAxisToWavelength() {
    const nmRadio = document.getElementById('toggleXLabelsNm');
    const pxRadio = document.getElementById('toggleXLabelsPx');
    if (pxRadio) pxRadio.checked = false;
    if (nmRadio) {
      const alreadyChecked = !!nmRadio.checked;
      nmRadio.checked = true;
      try {
        if (!alreadyChecked) nmRadio.click();
        else nmRadio.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
      try { nmRadio.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }

    // Keep any PRO proxy/select in sync if present.
    ['spCoreXAxis', 'spXAxisMode', 'spCoreXAxisMode'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || !('value' in el)) return;
      try {
        el.value = 'nm';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    });

    try { if (typeof window.redrawGraphIfLoadedImage === 'function') window.redrawGraphIfLoadedImage(false); } catch (_) {}
    try { if (typeof window.drawGraph === 'function') window.drawGraph(); } catch (_) {}
    hidePrompt();
  }

  function axisPromptSuppressed() {
    return Date.now() < suppressAxisPromptUntil;
  }

  try {
    if (sp.v15 && sp.v15.calibrationIO) {
      sp.v15.calibrationIO.suppressAxisPromptFor = function (milliseconds) {
        suppressAxisPromptUntil = Date.now() + Math.max(100, Number(milliseconds) || 1000);
        hidePrompt();
        return true;
      };
    }
  } catch (_) {}

  function isWavelengthAxisSelected() {
    try {
      const nmRadio = document.getElementById('toggleXLabelsNm');
      if (nmRadio && nmRadio.checked) return true;
    } catch (_) {}

    try {
      const proxyIds = ['spCoreXAxis', 'spXAxisMode', 'spCoreXAxisMode'];
      for (let i = 0; i < proxyIds.length; i += 1) {
        const el = document.getElementById(proxyIds[i]);
        if (el && String(el.value || '').toLowerCase() === 'nm') return true;
      }
    } catch (_) {}

    return false;
  }

  function showAxisQuestion() {
    if (axisPromptShown || axisPromptSuppressed()) return;
    if (isWavelengthAxisSelected()) {
      axisPromptShown = true;
      hidePrompt();
      return;
    }
    axisPromptShown = true;
    showPrompt('Switch x-axis to wavelength?', function () {
      switchXAxisToWavelength();
    }, function () {
      hidePrompt();
    });
  }

  function onCalibrationChanged(payload) {
    let calibrated = null;
    const data = payload && typeof payload === 'object' ? payload : null;
    if (data) {
      if (data.calibrated != null) calibrated = !!data.calibrated;
      else if (data.isCalibrated != null) calibrated = !!data.isCalibrated;
      else if (Array.isArray(data.coefficients)) calibrated = data.coefficients.length > 0;
    }
    if (calibrated == null) calibrated = isCalibratedNow();

    if (calibrated && !wasCalibrated) {
      wasCalibrated = true;
      hidePrompt();
      if (axisPromptSuppressed()) {
        axisPromptShown = true;
        return;
      }
      window.setTimeout(function () {
        if (!axisPromptSuppressed()) showAxisQuestion();
      }, 70);
    } else if (!calibrated) {
      wasCalibrated = false;
      axisPromptShown = false;
    }
  }

  function showInitialCalibrationQuestion() {
    if (loadPromptDismissed || isCalibratedNow()) return;
    showPrompt('Not Calibrated. Load Calibrationfile now?', function () {
      requestCalibrationFile();
    }, function () {
      loadPromptDismissed = true;
      hidePrompt();
    });
  }

  function installCalibrationUx() {
    updateVersionBadge();
    installPromptCss();
    wasCalibrated = isCalibratedNow();

    try {
      if (sp.coreHooks && typeof sp.coreHooks.on === 'function') {
        sp.coreHooks.on('calibrationChanged', onCalibrationChanged);
      }
    } catch (_) {}

    const fileInput = document.getElementById('my-file');
    if (fileInput && !fileInput.__spectraPromptBound) {
      fileInput.__spectraPromptBound = true;
      fileInput.addEventListener('change', function () {
        window.setTimeout(function () {
          onCalibrationChanged({ calibrated: isCalibratedNow() });
        }, 120);
      });
    }

    // The logo badge is created by uiPanels at DOM ready. Run once more after it.
    window.setTimeout(updateVersionBadge, 0);
    window.setTimeout(updateVersionBadge, 250);
    window.setTimeout(showInitialCalibrationQuestion, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installCalibrationUx, { once: true });
  } else {
    installCalibrationUx();
  }
})();
