
(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function createModeTabs(container) {
    if (!container) return null;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'sp-mode-tabs';
    (sp.appMode ? sp.appMode.MODES : ['CORE', 'LAB', 'ASTRO']).forEach(function(mode) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = mode;
      btn.dataset.mode = mode;
      btn.addEventListener('click', function () { if (sp.appMode) sp.appMode.setMode(mode, { source: 'ui' }); updateActive(); });
      wrap.appendChild(btn);
    });
    container.appendChild(wrap);

    function updateActive() {
      const current = sp.appMode ? sp.appMode.getMode() : 'CORE';
      wrap.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === current); });
    }
    updateActive();
    if (sp.eventBus) sp.eventBus.on('mode:changed', updateActive);
    return wrap;
  }

  function renderStatus(container) {
    if (!container || !sp.store) return;
    const s = sp.store.getState();
    container.innerHTML = [
      '<strong>SPECTRA-PRO status</strong>',
      'Mode: ' + s.appMode,
      'Worker: ' + s.worker.status,
      'Top hits: ' + (s.analysis.topHits || []).length,
      'Display mode: ' + s.display.mode
    ].join('<br>');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatSpecies(value) {
    try {
      if (sp.utils && typeof sp.utils.formatChemicalLabel === 'function') {
        return sp.utils.formatChemicalLabel(String(value == null ? '' : value));
      }
    } catch (_) {}
    return String(value == null ? '' : value);
  }

  function getBestSmartRow() {
    try {
      const state = sp.store && typeof sp.store.getState === 'function' ? sp.store.getState() : null;
      const rows = state && state.analysis && Array.isArray(state.analysis.elementScores) ? state.analysis.elementScores : [];
      return rows.length ? rows[0] : null;
    } catch (_) {
      return null;
    }
  }

  function patchSmartScoreSemantics(root) {
    const scope = root || document;
    const headers = scope.querySelectorAll ? scope.querySelectorAll('.sp-lab-th') : [];
    headers.forEach(function (el) {
      if (String(el.textContent || '').trim() === 'ELEMENT SCORE') {
        el.textContent = 'MATCH SCORE';
        el.title = 'Smart-match ranking. Percentages are relative score shares, not statistical probabilities or abundance estimates.';
      }
    });

    const winner = getBestSmartRow();
    const summaries = scope.querySelectorAll ? scope.querySelectorAll('.sp-es-summary') : [];
    summaries.forEach(function (el) {
      if (!el) return;

      if (winner) {
        const species = escapeHtml(formatSpecies(winner.element || '?'));
        const shareRaw = winner.scoreSharePct != null ? winner.scoreSharePct : winner.likelyPct;
        const share = Number.isFinite(Number(shareRaw)) ? Math.max(0, Math.min(100, Math.round(Number(shareRaw)))) : 0;
        const matchedRaw = winner.plasmaMatchedBands != null
          ? winner.plasmaMatchedBands
          : (winner.matchedPeaks != null ? winner.matchedPeaks : winner.matchedCount);
        const matched = Number.isFinite(Number(matchedRaw)) ? Math.max(0, Math.round(Number(matchedRaw))) : 0;
        const delta = Number.isFinite(Number(winner.medianDeltaNm)) ? Number(winner.medianDeltaNm).toFixed(2) : null;
        const unit = matched === 1 ? 'band/line' : 'bands/lines';
        let html = 'Best match: <b>' + species + '</b> · Score share ' + share + '%';
        if (matched > 0) html += ' · Evidence ' + matched + ' ' + unit;
        if (delta != null) html += ' · Δmed ' + escapeHtml(delta) + ' nm';
        if (el.innerHTML !== html) el.innerHTML = html;
      } else if (el.innerHTML) {
        const originalHtml = el.innerHTML;
        let html = originalHtml;
        html = html.replace(/Winner:\s*<b>/g, 'Best match: <b>');
        html = html.replace(/<\/b>\s*•\s*([0-9]+)%/g, '</b> · Score share $1%');
        if (html !== originalHtml) el.innerHTML = html;
      }

      el.title = 'Best current Smart-match. Score share is the relative share of positive candidate score, not a statistical probability or abundance estimate.';
    });
  }

  function installSmartScoreSemanticsPatch() {
    function apply() {
      patchSmartScoreSemantics(document.getElementById('spPanel-lab') || document);
    }
    apply();
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(function () { apply(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  sp.uiPanels = { createModeTabs, renderStatus, patchSmartScoreSemantics };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installSmartScoreSemanticsPatch, { once: true });
  } else {
    installSmartScoreSemanticsPatch();
  }
})(window);
