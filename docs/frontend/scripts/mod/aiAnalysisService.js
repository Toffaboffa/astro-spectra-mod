(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const DEFAULT_TIMEOUT_MS = 45000;

  function configuredEndpoint() {
    const config = sp.aiAnalysisConfig && typeof sp.aiAnalysisConfig === 'object' ? sp.aiAnalysisConfig : {};
    const direct = config.endpoint || global.SPECTRA_PRO_AI_ENDPOINT || '';
    if (String(direct || '').trim()) return String(direct).trim();
    try {
      const meta = global.document && global.document.querySelector('meta[name="spectra-pro-ai-endpoint"]');
      if (meta && String(meta.content || '').trim()) return String(meta.content).trim();
    } catch (_) {}
    return '';
  }

  function normalizeEndpoint(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, global.location && global.location.href ? global.location.href : undefined);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return '';
      url.pathname = url.pathname.replace(/\/+$/, '') || '/';
      if (url.pathname === '/') url.pathname = '/api/interpret';
      return url.toString();
    } catch (_) {
      return '';
    }
  }

  function endpoint() {
    return normalizeEndpoint(configuredEndpoint());
  }

  function timeoutMs() {
    const config = sp.aiAnalysisConfig && typeof sp.aiAnalysisConfig === 'object' ? sp.aiAnalysisConfig : {};
    const n = Number(config.timeoutMs);
    return Number.isFinite(n) ? Math.max(5000, Math.min(60000, Math.round(n))) : DEFAULT_TIMEOUT_MS;
  }

  function errorMessage(body, status) {
    if (body && typeof body.message === 'string' && body.message.trim()) return body.message.trim();
    if (body && body.error === 'RATE_LIMITED') return 'Too many AI interpretation requests. Try again shortly.';
    if (status === 403) return 'The AI backend rejected this site origin.';
    if (status === 404) return 'The AI backend endpoint was not found.';
    if (status >= 500) return 'The AI backend is temporarily unavailable.';
    return 'The AI backend rejected the request.';
  }

  async function interpret(payload) {
    const url = endpoint();
    if (!url) {
      throw new Error('AI backend endpoint is not configured yet. Deploy the SPECTRA PRO Worker and set SPECTRA_PRO_AI_ENDPOINT.');
    }

    const controller = new AbortController();
    const timer = global.setTimeout(function () { controller.abort(); }, timeoutMs());
    let response;
    try {
      response = await global.fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('AI interpretation timed out.');
      throw new Error('Could not reach the AI backend.');
    } finally {
      global.clearTimeout(timer);
    }

    let body = null;
    try { body = await response.json(); } catch (_) {}
    if (!response.ok || !body || body.ok !== true) {
      const err = new Error(errorMessage(body, response.status));
      err.code = body && body.error ? String(body.error) : 'AI_BACKEND_ERROR';
      err.status = response.status;
      throw err;
    }
    if (!body.result || typeof body.result !== 'object' || Array.isArray(body.result)) {
      throw new Error('AI backend returned an invalid structured result.');
    }
    return body;
  }

  sp.aiAnalysisService = {
    interpret: interpret,
    getEndpoint: endpoint,
    isConfigured: function () { return !!endpoint(); }
  };
})(window);
