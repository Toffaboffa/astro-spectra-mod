(function () {
  'use strict';

  function patchScoreLabels(root) {
    if (!root) return;
    const summaries = root.querySelectorAll('.sp-es-summary');
    summaries.forEach(function (el) {
      if (!el || !el.innerHTML) return;
      let html = el.innerHTML;
      html = html.replace(/Winner:\s*<b>/g, 'Best match: <b>');
      html = html.replace(/<\/b>\s*•\s*([0-9]+)%/g, '</b> · Score share $1%');
      el.innerHTML = html;
      el.title = 'Best current Smart-match. Score share is the relative share of positive candidate score, not statistical probability or abundance.';
    });
  }

  function patchHeader(root) {
    if (!root) return;
    const headers = root.querySelectorAll('.sp-lab-th');
    headers.forEach(function (el) {
      if (String(el.textContent || '').trim() === 'ELEMENT SCORE') {
        el.textContent = 'MATCH SCORE';
        el.title = 'Relative Smart-match scoring. Percentages are score shares, not statistical probabilities.';
      }
    });
  }

  function patchAll() {
    const lab = document.getElementById('spPanel-lab') || document;
    patchHeader(lab);
    patchScoreLabels(lab);
  }

  function start() {
    patchAll();
    const target = document.getElementById('SpectraProDockHost') || document.body;
    if (!target || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(function () { patchAll(); });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
