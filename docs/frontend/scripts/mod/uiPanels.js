
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

  function patchSmartScoreSemantics(root) {
    const scope = root || document;
    const headers = scope.querySelectorAll ? scope.querySelectorAll('.sp-lab-th') : [];
    headers.forEach(function (el) {
      if (String(el.textContent || '').trim() === 'ELEMENT SCORE') {
        el.textContent = 'MATCH SCORE';
        el.title = 'Smart-match ranking. Percentages are relative score shares, not statistical probabilities or abundance estimates.';
      }
    });

    const summaries = scope.querySelectorAll ? scope.querySelectorAll('.sp-es-summary') : [];
    summaries.forEach(function (el) {
      if (!el || !el.innerHTML) return;
      const originalHtml = el.innerHTML;
      let html = originalHtml;
      html = html.replace(/Winner:\s*<b>/g, 'Best match: <b>');
      html = html.replace(/<\/b>\s*•\s*([0-9]+)%/g, '</b> · Score share $1%');
      if (html !== originalHtml) el.innerHTML = html;
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
