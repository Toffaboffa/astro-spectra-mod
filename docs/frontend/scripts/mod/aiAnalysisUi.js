(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const BUTTON_ID = 'spAiInterpretBtn';
  const MODAL_ID = 'spAiInterpretModal';
  const STYLE_ID = 'spAiInterpretStyle';
  let lastPayload = null;
  let lastResultText = '';
  let lastFocused = null;
  let eventHooksInstalled = false;
  let keyHookInstalled = false;
  let toastTimer = null;

  function $(id) { return global.document ? global.document.getElementById(id) : null; }

  function installStyles() {
    if (!global.document || $(STYLE_ID)) return;
    const style = global.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.sp-ai-modal{position:fixed;inset:0;z-index:4200;display:none;align-items:center;justify-content:center;padding:18px;}',
      '.sp-ai-modal.is-open{display:flex;}',
      '.sp-ai-modal__backdrop{position:absolute;inset:0;background:rgba(2,8,18,.72);backdrop-filter:blur(2px);}',
      '.sp-ai-modal__panel{position:relative;width:min(820px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(71,221,230,.58);border-radius:12px;background:linear-gradient(180deg,rgba(9,28,46,.985),rgba(5,18,32,.99));box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 0 1px rgba(38,184,201,.08) inset;color:#e8f7fb;}',
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
      '.sp-ai-modal__toast{position:fixed;left:50%;top:22px;z-index:4300;max-width:min(520px,calc(100vw - 32px));padding:9px 12px;border-radius:8px;border:1px solid rgba(92,222,190,.48);background:rgba(7,46,40,.96);box-shadow:0 10px 30px rgba(0,0,0,.38);color:#d6fff4;font:600 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;opacity:0;visibility:hidden;transform:translate(-50%,-8px);transition:opacity .16s ease,transform .16s ease,visibility .16s;pointer-events:none;}',
      '.sp-ai-modal__toast.is-visible{opacity:1;visibility:visible;transform:translate(-50%,0);}',
      '.sp-ai-modal__toast[data-tone="error"]{border-color:rgba(239,118,118,.55);background:rgba(62,16,20,.96);color:#ffdada;}',
      '.sp-ai-modal__result{display:none;margin-top:12px;padding:12px;border-radius:8px;border:1px solid rgba(86,217,225,.28);background:rgba(3,15,27,.58);font-size:13px;line-height:1.55;color:#e4f6f9;white-space:pre-wrap;}',
      '.sp-ai-modal__result.is-visible{display:block;}',
      '.sp-ai-modal__meta{display:none;margin-top:7px;font:500 10px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#7fa8b4;overflow-wrap:anywhere;}',
      '.sp-ai-modal__meta.is-visible{display:block;}',
      '.sp-ai-modal__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}',
      '.sp-ai-modal__actions button,.sp-ai-action{border:1px solid rgba(78,211,221,.38);border-radius:7px;background:rgba(20,53,69,.9);color:#e9fbff;padding:7px 12px;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;}',
      '.sp-ai-modal__actions button:hover,.sp-ai-action:hover{border-color:rgba(92,235,241,.74);background:rgba(23,72,88,.95);}',
      '.sp-ai-modal__actions .sp-ai-primary,.sp-ai-action{background:linear-gradient(180deg,rgba(19,137,151,.95),rgba(10,104,121,.95));border-color:rgba(85,235,240,.62);}',
      '.sp-ai-modal__actions button:disabled{opacity:.48;cursor:default;}',
      '.sp-ai-launch{position:relative;display:inline-flex;padding:3px;border:1px solid rgba(255,215,72,.95);border-radius:10px;box-shadow:0 0 0 1px rgba(255,215,72,.12),0 0 12px rgba(255,215,72,.10);}',
      '.sp-ai-launch__badge{position:absolute;right:7px;top:-9px;z-index:2;padding:1px 6px;border-radius:999px;background:#ffd748;color:#2d2500;border:1px solid rgba(255,242,162,.9);font:800 9px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.08em;pointer-events:none;}',
      '.sp-ai-launch .sp-ai-action{margin:0;}',
      '.sp-ai-spinner{display:inline-block;width:12px;height:12px;margin-right:7px;border:2px solid rgba(212,249,252,.28);border-top-color:#d4f9fc;border-radius:50%;vertical-align:-2px;animation:spAiSpin .75s linear infinite;}',
      '@keyframes spAiSpin{to{transform:rotate(360deg);}}',
      '@media(max-width:640px){.sp-ai-modal{padding:8px}.sp-ai-modal__panel{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}.sp-ai-modal__body{padding:13px}.sp-ai-modal__actions{flex-wrap:wrap}.sp-ai-modal__actions button{flex:1 1 120px}.sp-ai-modal__toast{top:12px}}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function setPrimaryActionMode(mode) {
    const button = $('spAiAnalyzeBtn');
    if (!button) return;
    const isCopy = mode === 'copy';
    button.dataset.mode = isCopy ? 'copy' : 'analyze';
    button.textContent = isCopy ? 'Copy text' : 'Analyze';
    button.title = isCopy ? 'Copy the AI interpretation to the clipboard.' : 'Analyze the current spectrum with AI Interpretation.';
  }

  function setNewRunVisible(visible) {
    const button = $('spAiNewRunBtn');
    if (button) button.style.display = visible ? '' : 'none';
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
      '<div id="spAiToast" class="sp-ai-modal__toast" role="status" aria-live="polite"></div>',
      '<div class="sp-ai-modal__panel">',
      '  <div class="sp-ai-modal__head">',
      '    <div class="sp-ai-modal__title" id="spAiInterpretTitle">AI INTERPRETATION</div>',
      '    <button type="button" class="sp-ai-modal__close" id="spAiInterpretClose" aria-label="Close">×</button>',
      '  </div>',
      '  <div class="sp-ai-modal__body">',
      '    <div class="sp-ai-modal__question">Describe what you have observed</div>',
      '    <div class="sp-ai-modal__hint">Optional. Describe the light source, experiment, object, colour, pressure, gas, discharge or anything else that may help interpretation. You may write in any language; the AI response will use the same language when it can be identified, otherwise English.</div>',
      '    <textarea id="spAiObservation" maxlength="1200" spellcheck="true" placeholder="Example: Low-pressure air plasma in a glass tube..."></textarea>',
      '    <div id="spAiStatus" class="sp-ai-modal__status" aria-live="polite"></div>',
      '    <div id="spAiResult" class="sp-ai-modal__result" aria-live="polite"></div>',
      '    <div id="spAiMeta" class="sp-ai-modal__meta" aria-live="polite"></div>',
      '    <div class="sp-ai-modal__actions">',
      '      <button type="button" id="spAiCancelBtn">Cancel</button>',
      '      <button type="button" id="spAiNewRunBtn" style="display:none">New analysis</button>',
      '      <button type="button" id="spAiAnalyzeBtn" class="sp-ai-primary" data-mode="analyze">Analyze</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    (global.document.body || global.document.documentElement).appendChild(modal);

    modal.addEventListener('click', function (event) {
      const target = event.target;
      if (!target) return;
      if (target.id === 'spAiInterpretClose' || target.id === 'spAiCancelBtn' || target.getAttribute('data-ai-close') === '1') close();
      if (target.id === 'spAiNewRunBtn') prepareNewRun();
      if (target.id === 'spAiAnalyzeBtn') {
        if (target.dataset.mode === 'copy') copyResultText();
        else submit();
      }
    });

    const textarea = $('spAiObservation');
    if (textarea) {
      textarea.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          const action = $('spAiAnalyzeBtn');
          if (action && action.dataset.mode === 'copy') copyResultText();
          else submit();
        }
      });
    }
    return modal;
  }

  function setStatus(text, tone, loading) {
    const status = $('spAiStatus');
    const action = $('spAiAnalyzeBtn');
    if (!status) return;
    const message = String(text == null ? '' : text);
    status.innerHTML = loading ? '<span class="sp-ai-spinner" aria-hidden="true"></span>' + message : '';
    if (!loading) status.textContent = message;
    status.classList.toggle('is-visible', !!message);
    status.dataset.tone = tone || 'info';
    if (action) action.disabled = !!loading;
  }

  function clearToast() {
    const toast = $('spAiToast');
    if (toastTimer) {
      global.clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (!toast) return;
    toast.classList.remove('is-visible');
    toast.textContent = '';
  }

  function showToast(text, tone) {
    const toast = $('spAiToast');
    if (!toast) return;
    if (toastTimer) global.clearTimeout(toastTimer);
    toast.textContent = String(text == null ? '' : text);
    toast.dataset.tone = tone || 'ok';
    toast.classList.toggle('is-visible', !!toast.textContent);
    toastTimer = global.setTimeout(function () {
      toast.classList.remove('is-visible');
      toastTimer = null;
    }, 1800);
  }

  function setMeta(text) {
    const meta = $('spAiMeta');
    if (!meta) return;
    const value = String(text == null ? '' : text).trim();
    meta.textContent = value;
    meta.classList.toggle('is-visible', !!value);
  }

  function shortContract(value) {
    const text = String(value || '');
    const slash = text.lastIndexOf('/');
    return slash >= 0 ? text.slice(slash + 1) : text;
  }

  function formatTime(value) {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function setRunMeta(response) {
    if (!response || typeof response !== 'object') {
      setMeta('');
      return;
    }
    const parts = [];
    const when = formatTime(response.completedAt || response.startedAt);
    if (when) parts.push('Run ' + when);
    if (response.promptContract) parts.push('prompt ' + shortContract(response.promptContract));
    const usage = response.usage && typeof response.usage === 'object' ? response.usage : {};
    if (Number.isFinite(Number(usage.inputTokens))) parts.push(Number(usage.inputTokens).toLocaleString() + ' in');
    if (Number.isFinite(Number(usage.outputTokens))) parts.push(Number(usage.outputTokens).toLocaleString() + ' out');
    if (response.runId) parts.push('run ' + String(response.runId).slice(0, 8));
    if (response.openaiResponseId) parts.push('OpenAI ' + String(response.openaiResponseId).slice(0, 18));
    setMeta(parts.join(' · '));
  }

  function formatStructuredResult(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value !== 'object' || Array.isArray(value)) return String(value).trim();

    const data = value.result && typeof value.result === 'object' && !Array.isArray(value.result)
      ? value.result
      : value;
    const parts = ['summary', 'interpretation', 'dataQuality', 'caveats', 'conclusion']
      .map(function (key) { return typeof data[key] === 'string' ? data[key].trim() : ''; })
      .filter(Boolean);
    if (parts.length) return parts.join('\n\n');
    if (typeof data.text === 'string') return data.text.trim();
    return '';
  }

  function setResult(value) {
    const result = $('spAiResult');
    if (!result) return;
    const text = formatStructuredResult(value);
    lastResultText = text;
    result.textContent = text;
    result.classList.toggle('is-visible', !!text);
    setPrimaryActionMode(text ? 'copy' : 'analyze');
    setNewRunVisible(!!text);
  }

  function fallbackCopy(text) {
    try {
      const temp = global.document.createElement('textarea');
      temp.value = text;
      temp.setAttribute('readonly', '');
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      temp.style.opacity = '0';
      (global.document.body || global.document.documentElement).appendChild(temp);
      temp.select();
      temp.setSelectionRange(0, temp.value.length);
      const ok = global.document.execCommand && global.document.execCommand('copy');
      temp.remove();
      if (ok) {
        showToast('Text copied.', 'ok');
        return true;
      }
    } catch (_) {}
    showToast('Could not copy the text automatically.', 'error');
    return false;
  }

  function copyResultText() {
    const text = String(lastResultText || (($('spAiResult') && $('spAiResult').textContent) || '')).trim();
    if (!text) {
      showToast('There is no AI text to copy yet.', 'error');
      return;
    }
    try {
      if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function' && global.isSecureContext) {
        global.navigator.clipboard.writeText(text).then(function () {
          showToast('Text copied.', 'ok');
        }).catch(function () {
          fallbackCopy(text);
        });
        return;
      }
    } catch (_) {}
    fallbackCopy(text);
  }

  function prepareNewRun() {
    lastResultText = '';
    clearToast();
    setMeta('');
    setStatus('', 'info', false);
    setResult('');
    setPrimaryActionMode('analyze');
    setNewRunVisible(false);
    const textarea = $('spAiObservation');
    if (textarea) global.setTimeout(function () { textarea.focus(); }, 0);
  }

  function open() {
    installStyles();
    const modal = ensureModal();
    if (!modal) return false;
    lastFocused = global.document.activeElement || null;
    prepareNewRun();
    modal.classList.add('is-open');
    return true;
  }

  function close() {
    clearToast();
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
    clearToast();
    setPrimaryActionMode('analyze');
    setNewRunVisible(false);
    setMeta('');
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
          const value = response && typeof response === 'object' && response.result != null ? response.result : response;
          setStatus('', 'info', false);
          setResult(value);
          setRunMeta(response);
        }).catch(function (error) {
          setMeta('');
          setStatus('AI interpretation failed: ' + String(error && error.message || error || 'Unknown error'), 'error', false);
        });
        return;
      }

      setStatus(payloadSummary(payload) + '\nStructured response handling is ready. Secure OpenAI transport is enabled in Step 6; no data has left the browser.', 'ok', false);
      try {
        if (sp.eventBus && typeof sp.eventBus.emit === 'function') sp.eventBus.emit('ai:payloadPrepared', { payload: payload });
      } catch (_) {}
    } catch (error) {
      setMeta('');
      setStatus('Could not prepare AI analysis data: ' + String(error && error.message || error), 'error', false);
    }
  }

  function attachButton() {
    if (!global.document) return false;
    if ($(BUTTON_ID)) return true;
    const actions = global.document.querySelector('#spLabCard .sp-actions--lab');
    if (!actions) return false;

    const launch = global.document.createElement('div');
    launch.className = 'sp-ai-launch';

    const badge = global.document.createElement('span');
    badge.className = 'sp-ai-launch__badge';
    badge.textContent = 'NEW';
    badge.setAttribute('aria-hidden', 'true');

    const button = global.document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'sp-ai-action';
    button.textContent = 'AI Interpretation';
    button.title = 'Prepare the current LAB spectrum and analysis for a concise AI-assisted scientific interpretation.';
    button.addEventListener('click', open);

    launch.appendChild(button);
    launch.appendChild(badge);
    actions.appendChild(launch);
    return true;
  }

  function installEventHooks() {
    if (!eventHooksInstalled && sp.eventBus && typeof sp.eventBus.on === 'function') {
      eventHooksInstalled = true;
      sp.eventBus.on('state:changed', attachButton);
      sp.eventBus.on('ui:refresh', attachButton);
      sp.eventBus.on('mode:changed', attachButton);
    }
    if (!keyHookInstalled && global.document) {
      keyHookInstalled = true;
      global.document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          const modal = $(MODAL_ID);
          if (modal && modal.classList.contains('is-open')) close();
        }
      });
    }
  }

  function install() {
    installStyles();
    ensureModal();
    installEventHooks();
    attachButton();
  }

  function showResult(value) {
    setStatus('', 'info', false);
    setResult(value);
  }

  function showError(text) {
    setMeta('');
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
    copyResultText: copyResultText,
    prepareNewRun: prepareNewRun,
    setLoading: setLoading,
    showResult: showResult,
    showError: showError,
    formatStructuredResult: formatStructuredResult,
    getLastPayload: function () { return lastPayload; }
  };

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(window);