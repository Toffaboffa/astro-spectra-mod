(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const BUTTON_ID = 'spAiInterpretBtn';
  const MODAL_ID = 'spAiInterpretModal';
  const STYLE_ID = 'spAiInterpretStyle';
  let lastPayload = null;
  let lastFocused = null;

  function $(id) { return global.document ? global.document.getElementById(id) : null; }

  function installStyles() {
    if (!global.document || $(STYLE_ID)) return;
    const style = global.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.sp-ai-modal{position:fixed;inset:0;z-index:4200;display:none;align-items:center;justify-content:center;padding:18px;}',
      '.sp-ai-modal.is-open{display:flex;}',
      '.sp-ai-modal__backdrop{position:absolute;inset:0;background:rgba(2,8,18,.72);backdrop-filter:blur(2px);}',
      '.sp-ai-modal__panel{position:relative;width:min(620px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(71,221,230,.58);border-radius:12px;background:linear-gradient(180deg,rgba(9,28,46,.985),rgba(5,18,32,.99));box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 0 1px rgba(38,184,201,.08) inset;color:#e8f7fb;}',
      '.sp-ai-modal__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 11px;border-bottom:1px solid rgba(80,202,215,.18);}',
      '.sp-ai-modal__title{font-size:14px;font-weight:700;letter-spacing:.06em;color:#8cebf0;}',
      '.sp-ai-modal__close{border:0;background:transparent;color:#bfdce4;font-size:23px;line-height:1;padding:0 3px;cursor:pointer;}',
      '.sp-ai-modal__body{padding:15px 16px 16px;}',
      '.sp-ai-modal__question{font-size:16px;font-weight:650;margin-bottom:6px;color:#f1fbfd;}',
      '.sp-ai-modal__hint{font-size:12px;line-height:1.45;color:#98b9c3;margin-bottom:10px;}',
      '.sp-ai-modal textarea{width:100%;min-height:116px;resize:vertical;padding:10px 11px;border-radius:8px;border:1px solid rgba(102,197,210,.38);outline:none;background:rgba(2,13,25,.72);color:#ecfbff;font:400 13px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;box-sizing:border-box;}',
      '.sp-ai-modal textarea:focus{border-color:rgba(88,231,238,.82);box-shadow:0 0 0 2px rgba(54,206,219,.13);}',
      '.sp-ai-modal__status{display:none;margin-top:12px;padding:10px 11px;border-radius:8px;font-size:12px;line-height:1.45;border:1px solid rgba(100,184,198,.22);background:rgba(8,24,38,.68);color:#bdd5dc;white-space:pre-wrap;}',
      '.sp-ai-modal__status.is-visible{display:block;}',
      '.sp-ai-modal__status[data-tone="error"]{border-color:rgba(239,118,118,.48);color:#ffd0d0;background:rgba(62,16,20,.42);}',
      '.sp-ai-modal__status[data-tone="ok"]{border-color:rgba(92,222,190,.42);color:#c7fff0;background:rgba(10,54,46,.34);}',
      '.sp-ai-modal__result{display:none;margin-top:12px;padding:12px;border-radius:8px;border:1px solid rgba(86,217,225,.28);background:rgba(3,15,27,.58);font-size:13px;line-height:1.55;color:#e4f6f9;white-space:pre-wrap;}',
      '.sp-ai-modal__result.is-visible{display:block;}',
      '.sp-ai-modal__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}',
      '.sp-ai-modal__actions button,.sp-ai-action{border:1px solid rgba(78,211,221,.38);border-radius:7px;background:rgba(20,53,69,.9);color:#e9fbff;padding:7px 12px;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;}',
      '.sp-ai-modal__actions button:hover,.sp-ai-action:hover{border-color:rgba(92,235,241,.74);background:rgba(23,72,88,.95);}',
      '.sp-ai-modal__actions .sp-ai-primary,.sp-ai-action{background:linear-gradient(180deg,rgba(19,137,151,.95),rgba(10,104,121,.95));border-color:rgba(85,235,240,.62);}',
      '.sp-ai-modal__actions button:disabled{opacity:.48;cursor:default;}',
      '.sp-ai-spinner{display:inline-block;width:12px;height:12px;margin-right:7px;border:2px solid rgba(212,249,252,.28);border-top-color:#d4f9fc;border-radius:50%;vertical-align:-2px;animation:spAiSpin .75s linear infinite;}',
      '@keyframes spAiSpin{to{transform:rotate(360deg);}}',
      '@media(max-width:640px){.sp-ai-modal{padding:8px}.sp-ai-modal__panel{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}.sp-ai-modal__body{padding:13px}.sp-ai-modal__actions{flex-wrap:wrap}.sp-ai-modal__actions button{flex:1 1 120px}}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function ensureModal() {
    if (!global.document) return null;
    let modal = $(MODAL_ID);
    if (modal) return modal;

    modal = global.document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'sp-ai-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'spAiInterpretTitle');
    modal.innerHTML = [
      '<div class="sp-ai-modal__backdrop" data-ai-close="1"></div>',
      '<div class="sp-ai-modal__panel">',
      '  <div class="sp-ai-modal__head">',
      '    <div class="sp-ai-modal__title" id="spAiInterpretTitle">AI INTERPRETATION</div>',
      '    <button type="button" class="sp-ai-modal__close" id="spAiInterpretClose" aria-label="Close">×</button>',
      '  </div>',
      '  <div class="sp-ai-modal__body">',
      '    <div class="sp-ai-modal__question">Describe what you have observed</div>',
      '    <div class="sp-ai-modal__hint">Optional. Describe the light source, experiment, object, colour, pressure, gas, discharge or anything else that may help interpretation. You may write in any language; the future AI response will use the same language when it can be identified, otherwise English.</div>',
      '    <textarea id="spAiObservation" maxlength="1200" spellcheck="true" placeholder="Example: Low-pressure air plasma in a glass tube..."></textarea>',
      '    <div id="spAiStatus" class="sp-ai-modal__status" aria-live="polite"></div>',
      '    <div id="spAiResult" class="sp-ai-modal__result" aria-live="polite"></div>',
      '    <div class="sp-ai-modal__actions">',
      '      <button type="button" id="spAiCancelBtn">Cancel</button>',
      '      <button type="button" id="spAiAnalyzeBtn" class="sp-ai-primary">Analyze</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    (global.document.body || global.document.documentElement).appendChild(modal);

    modal.addEventListener('click', function (event) {
      const target = event.target;
      if (!target) return;
      if (target.id === 'spAiInterpretClose' || target.id === 'spAiCancelBtn' || target.getAttribute('data-ai-close') === '1') close();
      if (target.id === 'spAiAnalyzeBtn') submit();
    });

    const textarea = $('spAiObservation');
    if (textarea) {
      textarea.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
    }
    return modal;
  }

  function setStatus(text, tone, loading) {
    const status = $('spAiStatus');
    const analyze = $('spAiAnalyzeBtn');
    if (!status) return;
    const message = String(text == null ? '' : text);
    status.innerHTML = loading ? '<span class="sp-ai-spinner" aria-hidden="true"></span>' + message : '';
    if (!loading) status.textContent = message;
    status.classList.toggle('is-visible', !!message);
    status.dataset.tone = tone || 'info';
    if (analyze) analyze.disabled = !!loading;
  }

  function setResult(text) {
    const result = $('spAiResult');
    if (!result) return;
    const value = String(text == null ? '' : text).trim();
    result.textContent = value;
    result.classList.toggle('is-visible', !!value);
  }

  function open() {
    installStyles();
    const modal = ensureModal();
    if (!modal) return false;
    lastFocused = global.document.activeElement || null;
    setStatus('', 'info', false);
    setResult('');
    modal.classList.add('is-open');
    const textarea = $('spAiObservation');
    if (textarea) global.setTimeout(function () { textarea.focus(); }, 0);
    return true;
  }

  function close() {
    const modal = $(MODAL_ID);
    if (modal) modal.classList.remove('is-open');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (_) {}
    }
    lastFocused = null;
  }

  function payloadSummary(payload) {
    const analysis = payload && payload.analysis ? payload.analysis : {};
    const candidates = Array.isArray(analysis.candidates) ? analysis.candidates.length : 0;
    const hits = Array.isArray(analysis.hits) ? analysis.hits.length : 0;
    const trace = payload && payload.trace;
    const tracePoints = trace && Array.isArray(trace.points) ? trace.points.length : 0;
    const calibrated = !!(payload && payload.readiness && payload.readiness.calibrated);
    return 'Payload prepared locally: ' + candidates + ' candidate(s), ' + hits + ' hit(s), ' + tracePoints + ' compact trace point(s), calibration ' + (calibrated ? 'available' : 'not available') + '.';
  }

  function submit() {
    setResult('');
    setStatus('Preparing current SPECTRA PRO analysis…', 'info', true);
    try {
      const builder = sp.aiAnalysisPayload;
      if (!builder || typeof builder.build !== 'function') {
        setStatus('AI payload builder is unavailable. Reload SPECTRA PRO and try again.', 'error', false);
        return;
      }
      const textarea = $('spAiObservation');
      const observation = textarea ? String(textarea.value || '') : '';
      const payload = builder.build({ observation: observation });
      lastPayload = payload;

      const readiness = payload && payload.readiness ? payload.readiness : {};
      if (!readiness.hasFrame) {
        setStatus('No spectrum frame is available yet. Load an image or start the camera before requesting an interpretation.', 'error', false);
        return;
      }
      if (!readiness.hasAnalysisResult) {
        setStatus('No LAB analysis result is available yet. Run LAB analysis first, then request AI interpretation.', 'error', false);
        return;
      }

      if (sp.aiAnalysisService && typeof sp.aiAnalysisService.interpret === 'function') {
        Promise.resolve(sp.aiAnalysisService.interpret(payload)).then(function (response) {
          const text = response && typeof response === 'object' && response.text != null ? response.text : response;
          setStatus('', 'info', false);
          setResult(String(text == null ? '' : text));
        }).catch(function (error) {
          setStatus('AI interpretation failed: ' + String(error && error.message || error || 'Unknown error'), 'error', false);
        });
        return;
      }

      setStatus(payloadSummary(payload) + '\nSecure AI backend is not connected yet. This is expected in Step 2; no data has left the browser.', 'ok', false);
      try {
        if (sp.eventBus && typeof sp.eventBus.emit === 'function') sp.eventBus.emit('ai:payloadPrepared', { payload: payload });
      } catch (_) {}
    } catch (error) {
      setStatus('Could not prepare AI analysis data: ' + String(error && error.message || error), 'error', false);
    }
  }

  function attachButton() {
    if (!global.document) return false;
    if ($(BUTTON_ID)) return true;
    const actions = global.document.querySelector('#spLabCard .sp-actions--lab');
    if (!actions) return false;
    const button = global.document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'sp-ai-action';
    button.textContent = 'AI Interpretation';
    button.title = 'Prepare the current LAB spectrum and analysis for a concise AI-assisted scientific interpretation.';
    button.addEventListener('click', open);
    actions.appendChild(button);
    return true;
  }

  function install() {
    installStyles();
    ensureModal();
    attachButton();
  }

  function showResult(text) {
    setStatus('', 'info', false);
    setResult(text);
  }

  function showError(text) {
    setResult('');
    setStatus(text || 'AI interpretation failed.', 'error', false);
  }

  function setLoading(isLoading, text) {
    if (isLoading) setStatus(text || 'Analyzing spectrum…', 'info', true);
    else setStatus('', 'info', false);
  }

  sp.aiAnalysisUi = {
    install: install,
    attachButton: attachButton,
    open: open,
    close: close,
    submit: submit,
    setLoading: setLoading,
    showResult: showResult,
    showError: showError,
    getLastPayload: function () { return lastPayload; }
  };

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(window);
