(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = '2.3.1';
  const MODAL_ID = 'spExportModal';
  const STYLE_ID = 'spExportUiStyle';
  const MAIN_BUTTON_ID = 'spExportMainBtn';
  const REPORT_HERO_PAGE_URL = 'https://www.k-aberg.se/';
  let projectHeroPromise = null;

  const I18N = {
    en: {
      button: 'EXPORT',
      buttonTitle: 'Export source image, data points, graph, analysis data or a PDF report.',
      title: 'EXPORT',
      intro: 'Choose the files to generate from the current SPECTRA PRO measurement.',
      source: 'Spectrum (source)',
      sourceDesc: 'PNG image of the current source spectrum/frame.',
      csv: 'Data points (.csv)',
      csvDesc: 'Current spectrum samples: px, nm when calibrated, RGB and intensity values.',
      graph: 'Graph',
      graphDesc: 'PNG of the graph exactly as currently rendered, including visible annotations and overlays.',
      json: 'Data analysis (.json)',
      jsonDesc: 'One complete JSON snapshot with settings, Status, Data Quality, calibration, hits, analysis and AI result when available.',
      pdf: 'Report (.pdf)',
      pdfDesc: 'Deterministic SPECTRA PRO report generated locally without AI-written report text.',
      aiIncluded: 'AI interpretation is available and will be included in the JSON and as a clearly marked appendix in the PDF report.',
      noAi: 'No completed AI interpretation is currently available.',
      cancel: 'Cancel',
      exportSelected: 'Export selected',
      noneSelected: 'Select at least one export format.',
      working: 'Preparing export…',
      done: 'ZIP export prepared.',
      sourceMissing: 'Source image is not available yet.',
      dataMissing: 'Spectrum data points are not available yet.',
      graphMissing: 'Graph image is not available yet.',
      pdfError: 'PDF report could not be generated.',
      close: 'Close export dialog'
    },
    sv: {
      button: 'EXPORTERA',
      buttonTitle: 'Exportera källbild, datapunkter, diagram, analysdata eller en PDF-rapport.',
      title: 'EXPORTERA',
      intro: 'Välj vilka filer som ska skapas från den aktuella SPECTRA PRO-mätningen.',
      source: 'Spektrum (källa)',
      sourceDesc: 'PNG-bild av den aktuella spektrumkällan/bildrutan.',
      csv: 'Datapunkter (.csv)',
      csvDesc: 'Aktuella spektrumpunkter: px, nm när kalibrering finns, RGB och intensitetsvärden.',
      graph: 'Diagram',
      graphDesc: 'PNG av diagrammet exakt som det visas, inklusive synliga annoteringar och overlays.',
      json: 'Dataanalys (.json)',
      jsonDesc: 'En komplett JSON-snapshot med inställningar, Status, Data Quality, kalibrering, träffar, analys och AI-resultat när det finns.',
      pdf: 'Rapport (.pdf)',
      pdfDesc: 'Deterministisk SPECTRA PRO-rapport som genereras lokalt utan AI-skriven rapporttext.',
      aiIncluded: 'En AI-tolkning finns och inkluderas i JSON samt som tydligt markerad bilaga i PDF-rapporten.',
      noAi: 'Ingen slutförd AI-tolkning finns just nu.',
      cancel: 'Avbryt',
      exportSelected: 'Exportera valda',
      noneSelected: 'Välj minst ett exportformat.',
      working: 'Förbereder export…',
      done: 'ZIP-exporten är förberedd.',
      sourceMissing: 'Källbilden är inte tillgänglig ännu.',
      dataMissing: 'Spektrumets datapunkter är inte tillgängliga ännu.',
      graphMissing: 'Diagrammet är inte tillgängligt ännu.',
      pdfError: 'PDF-rapporten kunde inte skapas.',
      close: 'Stäng exportdialogen'
    }
  };

  function language() {
    try {
      return sp.i18n && typeof sp.i18n.getLanguage === 'function' && sp.i18n.getLanguage() === 'sv' ? 'sv' : 'en';
    } catch (_) { return 'en'; }
  }

  function t(key) {
    const lang = language();
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function $(id) { return global.document ? global.document.getElementById(id) : null; }

  function installStyles() {
    if (!global.document || $(STYLE_ID)) return;
    const style = global.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#spSubtractionControls{display:grid!important;grid-template-columns:minmax(0,1fr) 78px!important;gap:6px!important;align-items:stretch!important;width:100%!important;padding:0 6px!important;box-sizing:border-box!important;}',
      '#spSubtractionControls .sp-sub-rows{display:grid!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:4px!important;min-width:0!important;}',
      '#spSubtractionControls .sp-sub-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;align-items:stretch!important;justify-items:stretch!important;}',
      '#spSubtractionControls .sp-sub-row>button{width:100%!important;min-width:0!important;margin:0!important;padding:4px 3px!important;white-space:nowrap!important;font-size:10px!important;}',
      '#spExportMainBtn{display:flex!important;align-items:center!important;justify-content:center!important;width:78px!important;min-width:78px!important;margin:0!important;padding:6px 4px!important;border:1px solid rgba(86,217,225,.72)!important;border-radius:6px!important;background:linear-gradient(180deg,#16748a,#0d5368)!important;color:#f1fdff!important;font:800 11px/1.15 system-ui,-apple-system,Segoe UI,sans-serif!important;letter-spacing:.045em!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),0 2px 8px rgba(0,0,0,.2)!important;cursor:pointer!important;}',
      '#spExportMainBtn:hover,#spExportMainBtn:focus-visible{background:linear-gradient(180deg,#1a8ca4,#11647a)!important;border-color:#7ef2f5!important;outline:none!important;}',
      '#spExportBtn{display:none!important;}',
      '.sp-export-modal{position:fixed;inset:0;z-index:4700;display:none;align-items:center;justify-content:center;padding:16px;}',
      '.sp-export-modal.is-open{display:flex;}',
      '.sp-export-modal__backdrop{position:absolute;inset:0;background:rgba(2,8,18,.76);}',
      '.sp-export-modal__panel{position:relative;width:min(760px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 28px));overflow:auto;border:1px solid rgba(71,221,230,.58);border-radius:11px;background:linear-gradient(180deg,rgba(9,28,46,.99),rgba(5,18,32,.995));box-shadow:0 18px 60px rgba(0,0,0,.58);color:#e8f7fb;}',
      '.sp-export-modal__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 15px 10px;border-bottom:1px solid rgba(80,202,215,.18);}',
      '.sp-export-modal__title{font-size:15px;font-weight:800;letter-spacing:.055em;color:#8cebf0;}',
      '.sp-export-modal__intro{margin-top:3px;color:#9abac4;font-size:12px;line-height:1.4;}',
      '.sp-export-modal__close{border:0;background:transparent;color:#bfdce4;font-size:23px;line-height:1;padding:0 3px;cursor:pointer;}',
      '.sp-export-modal__body{padding:12px 15px 14px;}',
      '.sp-export-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}',
      '.sp-export-option{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;padding:9px 10px;border:1px solid rgba(86,217,225,.19);border-radius:8px;background:rgba(3,16,29,.58);cursor:pointer;}',
      '.sp-export-option:hover{border-color:rgba(86,217,225,.45);background:rgba(7,28,43,.7);}',
      '.sp-export-option input{margin-top:3px;accent-color:#2cc6d5;}',
      '.sp-export-option b{display:block;font-size:12px;color:#eefcff;margin-bottom:2px;}',
      '.sp-export-option small{display:block;font-size:11px;line-height:1.38;color:#90b2bd;}',
      '.sp-export-option.is-disabled{opacity:.46;cursor:not-allowed;}',
      '.sp-export-ai-note{margin-top:9px;padding:8px 10px;border:1px solid rgba(255,215,72,.25);border-radius:7px;background:rgba(58,47,9,.24);color:#d9c986;font-size:11px;line-height:1.4;}',
      '.sp-export-status{min-height:18px;margin-top:8px;color:#9fc3cc;font-size:11px;line-height:1.4;}',
      '.sp-export-status[data-tone="error"]{color:#ffbcbc;}',
      '.sp-export-modal__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}',
      '.sp-export-modal__actions button{border:1px solid rgba(78,211,221,.38);border-radius:7px;background:rgba(20,53,69,.9);color:#e9fbff;padding:7px 12px;font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;}',
      '.sp-export-modal__actions button:hover{border-color:rgba(92,235,241,.74);background:rgba(23,72,88,.95);}',
      '.sp-export-modal__actions .sp-export-primary{background:linear-gradient(180deg,rgba(19,137,151,.96),rgba(10,104,121,.96));border-color:rgba(85,235,240,.62);}',
      '.sp-export-modal__actions button:disabled{opacity:.48;cursor:default;}',
      '@media(max-width:700px){.sp-export-grid{grid-template-columns:1fr}.sp-export-modal{padding:8px}.sp-export-modal__panel{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}#spSubtractionControls{grid-template-columns:minmax(0,1fr) 72px!important}#spExportMainBtn{width:72px!important;min-width:72px!important;font-size:10px!important}}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function hasAiResult() {
    try {
      return !!(sp.aiAnalysisUi && typeof sp.aiAnalysisUi.getLastResultText === 'function' && String(sp.aiAnalysisUi.getLastResultText() || '').trim());
    } catch (_) { return false; }
  }

  function ensureSidebarButton() {
    const host = $('spSubtractionControls');
    if (!host) return false;
    let button = $(MAIN_BUTTON_ID);
    if (!button) {
      button = global.document.createElement('button');
      button.type = 'button';
      button.id = MAIN_BUTTON_ID;
      button.addEventListener('click', function () { open(); });
      host.appendChild(button);
    } else if (button.parentElement !== host) {
      host.appendChild(button);
    }
    button.textContent = t('button');
    button.title = t('buttonTitle');
    return true;
  }

  function currentFrame() {
    try {
      const state = sp.store && sp.store.getState ? sp.store.getState() : {};
      const f = state && state.frame && state.frame.latest;
      if (f && (Array.isArray(f.I) || Array.isArray(f.R) || Array.isArray(f.px))) return f;
    } catch (_) {}
    try {
      if (global.SpectraCore && global.SpectraCore.graph && typeof global.SpectraCore.graph.getLatestFrame === 'function') {
        return global.SpectraCore.graph.getLatestFrame();
      }
    } catch (_) {}
    return null;
  }

  function sourceElement() {
    try {
      const rt = sp.runtime || {};
      if (typeof rt.getVideoElement === 'function') {
        const e = rt.getVideoElement();
        if (e) return e;
      }
    } catch (_) {}
    const img = $('cameraImage');
    if (img && img.src && global.getComputedStyle(img).display !== 'none') return img;
    return $('videoMain');
  }

  function captureElementDataUrl(el) {
    if (!el) return '';
    try {
      const tag = String(el.tagName || '').toUpperCase();
      if (tag === 'IMG') {
        const w = Number(el.naturalWidth || el.width || 0);
        const h = Number(el.naturalHeight || el.height || 0);
        if (!w || !h) return '';
        const c = global.document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(el, 0, 0, w, h);
        return c.toDataURL('image/png');
      }
      if (tag === 'VIDEO') {
        const w = Number(el.videoWidth || 0);
        const h = Number(el.videoHeight || 0);
        if (!w || !h) return '';
        const c = global.document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(el, 0, 0, w, h);
        return c.toDataURL('image/png');
      }
    } catch (_) {}
    return '';
  }

  function captureSourceDataUrl() {
    let url = captureElementDataUrl(sourceElement());
    if (url) return url;
    const img = $('cameraImage');
    url = captureElementDataUrl(img);
    if (url) return url;
    return captureElementDataUrl($('videoMain'));
  }

  function transformDataUrl(url, drawFn) {
    return new Promise(function (resolve) {
      if (!url) return resolve('');
      const img = new Image();
      img.onload = function () {
        try {
          const out = drawFn(img);
          resolve(out || '');
        } catch (_) { resolve(''); }
      };
      img.onerror = function () { resolve(''); };
      img.src = url;
    });
  }

  function cropCenterBandDataUrl(url, fraction) {
    const frac = Math.max(0.05, Math.min(1, Number(fraction) || 0.25));
    return transformDataUrl(url, function (img) {
      const w = Number(img.naturalWidth || img.width || 0);
      const h = Number(img.naturalHeight || img.height || 0);
      if (!w || !h) return '';
      const cropH = Math.max(1, Math.round(h * frac));
      const sy = Math.max(0, Math.round((h - cropH) / 2));
      const canvas = global.document.createElement('canvas');
      canvas.width = w;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(img, 0, sy, w, cropH, 0, 0, w, cropH);
      return canvas.toDataURL('image/png');
    });
  }

  function rotateDataUrl90(url) {
    return transformDataUrl(url, function (img) {
      const w = Number(img.naturalWidth || img.width || 0);
      const h = Number(img.naturalHeight || img.height || 0);
      if (!w || !h) return '';
      const canvas = global.document.createElement('canvas');
      canvas.width = h;
      canvas.height = w;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.translate(h, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/png');
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function fetchDataUrl(url, timeoutMs) {
    if (!url) return '';
    if (String(url).indexOf('data:') === 0) return String(url);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = global.setTimeout(function () { try { if (controller) controller.abort(); } catch (_) {} }, Math.max(500, Number(timeoutMs) || 3000));
    try {
      const response = await global.fetch(url, { mode: 'cors', credentials: 'omit', signal: controller ? controller.signal : undefined });
      if (!response.ok) return '';
      return await blobToDataUrl(await response.blob());
    } catch (_) {
      return '';
    } finally {
      global.clearTimeout(timer);
    }
  }

  async function discoverProjectHeroUrl() {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = global.setTimeout(function () { try { if (controller) controller.abort(); } catch (_) {} }, 3000);
    try {
      const response = await global.fetch(REPORT_HERO_PAGE_URL, { mode: 'cors', credentials: 'omit', signal: controller ? controller.signal : undefined });
      if (!response.ok) return '';
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const candidates = [];
      const push = function (src, score) {
        if (!src) return;
        try {
          const absolute = new URL(src, REPORT_HERO_PAGE_URL).href;
          if (!/^https?:/i.test(absolute)) return;
          candidates.push({ url: absolute, score: score || 0 });
        } catch (_) {}
      };
      push((doc.querySelector('meta[property="og:image"]') || {}).content, 100);
      push((doc.querySelector('meta[name="twitter:image"]') || {}).content, 95);
      Array.from(doc.querySelectorAll('img')).forEach(function (img) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        const text = [img.getAttribute('alt'), img.getAttribute('class'), img.getAttribute('id'), src].filter(Boolean).join(' ').toLowerCase();
        let score = 5;
        if (/spectra|spectrometer|spectroscopy/.test(text)) score += 70;
        if (/hero|project|portfolio/.test(text)) score += 35;
        const width = Number(img.getAttribute('width') || 0);
        if (width >= 800) score += 10;
        push(src, score);
      });
      candidates.sort(function (a, b) { return b.score - a.score; });
      return candidates.length ? candidates[0].url : '';
    } catch (_) {
      return '';
    } finally {
      global.clearTimeout(timer);
    }
  }

  async function resolveProjectHeroDataUrl(fallbackUrl) {
    if (!projectHeroPromise) {
      projectHeroPromise = (async function () {
        try {
          let override = '';
          try { override = String(global.localStorage && global.localStorage.getItem('spectraPro.reportHeroUrl') || '').trim(); } catch (_) {}
          const heroUrl = override || await discoverProjectHeroUrl();
          if (!heroUrl) return '';
          const raw = await fetchDataUrl(heroUrl, 3500);
          if (!raw) return '';
          return await transformDataUrl(raw, function (img) {
            const w = Number(img.naturalWidth || img.width || 0);
            const h = Number(img.naturalHeight || img.height || 0);
            if (!w || !h) return '';
            const canvas = global.document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            ctx.drawImage(img, 0, 0, w, h);
            return canvas.toDataURL('image/png');
          });
        } catch (_) { return ''; }
      })();
    }
    const remote = await projectHeroPromise;
    return remote || fallbackUrl || '';
  }

  async function loadLocalLogoDataUrl() {
    return await fetchDataUrl('../assets/logo.png', 2500);
  }

  function captureGraphDataUrl() {
    try {
      const canvas = $('graphCanvas');
      return canvas && canvas.width && canvas.height ? canvas.toDataURL('image/png') : '';
    } catch (_) { return ''; }
  }

  function escapeCsv(value) {
    if (value == null || Number.isNaN(value)) return '';
    const s = String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv(frame) {
    if (!frame) return '';
    const arrays = {
      px: Array.isArray(frame.px) ? frame.px : null,
      nm: Array.isArray(frame.nm) ? frame.nm : null,
      R: Array.isArray(frame.R) ? frame.R : null,
      G: Array.isArray(frame.G) ? frame.G : null,
      B: Array.isArray(frame.B) ? frame.B : null,
      I: Array.isArray(frame.I) ? frame.I : null,
      processedI: Array.isArray(frame.processedI) ? frame.processedI : null,
      normalizedI: Array.isArray(frame.normalizedI) ? frame.normalizedI : null
    };
    const n = Math.max.apply(null, Object.keys(arrays).map(function (k) { return arrays[k] ? arrays[k].length : 0; }));
    if (!Number.isFinite(n) || n <= 0) return '';
    const headers = ['px','nm','R','G','B','Intensity','ProcessedIntensity','NormalizedIntensity'];
    const rows = [headers.join(',')];
    for (let i = 0; i < n; i += 1) {
      rows.push([
        arrays.px ? arrays.px[i] : i,
        arrays.nm ? arrays.nm[i] : '',
        arrays.R ? arrays.R[i] : '',
        arrays.G ? arrays.G[i] : '',
        arrays.B ? arrays.B[i] : '',
        arrays.I ? arrays.I[i] : '',
        arrays.processedI ? arrays.processedI[i] : '',
        arrays.normalizedI ? arrays.normalizedI[i] : ''
      ].map(escapeCsv).join(','));
    }
    return rows.join('\n');
  }

  function cloneJson(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
  }

  function collectInfoLines(id) {
    const root = $(id);
    if (!root) return [];
    return Array.from(root.querySelectorAll('.sp-info-line')).map(function (row) {
      const label = row.querySelector('.sp-info-label');
      const value = row.querySelector('.sp-info-value');
      return {
        label: label ? String(label.textContent || '').trim() : '',
        value: value ? String(value.textContent || '').trim() : String(row.textContent || '').trim(),
        text: String(row.textContent || '').replace(/\s+/g, ' ').trim(),
        title: row.getAttribute('title') || ''
      };
    });
  }

  function collectControls() {
    const roots = [global.document.getElementById('sidebar-left'), global.document.getElementById('SpectraProDockHost')].filter(Boolean);
    const seen = new Set();
    const out = [];
    roots.forEach(function (root) {
      root.querySelectorAll('input,select,textarea').forEach(function (el) {
        const type = String(el.type || el.tagName || '').toLowerCase();
        if (type === 'file' || type === 'hidden') return;
        const id = el.id || el.name || '';
        const key = id || (type + ':' + out.length);
        if (seen.has(key)) return;
        seen.add(key);
        let value = el.value;
        if (type === 'checkbox' || type === 'radio') value = !!el.checked;
        out.push({
          id: id || null,
          name: el.name || null,
          type: type,
          value: value,
          disabled: !!el.disabled,
          min: el.min || null,
          max: el.max || null,
          step: el.step || null,
          selectedText: el.tagName === 'SELECT' && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : null
        });
      });
    });
    return out;
  }

  function aiSnapshot() {
    try {
      if (!sp.aiAnalysisUi) return { available: false };
      const text = typeof sp.aiAnalysisUi.getLastResultText === 'function' ? String(sp.aiAnalysisUi.getLastResultText() || '') : '';
      const payload = typeof sp.aiAnalysisUi.getLastPayload === 'function' ? cloneJson(sp.aiAnalysisUi.getLastPayload()) : null;
      const response = typeof sp.aiAnalysisUi.getLastResponse === 'function' ? cloneJson(sp.aiAnalysisUi.getLastResponse()) : null;
      return { available: !!text, resultText: text || null, payload: payload, response: response };
    } catch (_) { return { available: false }; }
  }

  function buildAnalysisBundle() {
    const state = (sp.store && sp.store.getState) ? sp.store.getState() : {};
    const frame = currentFrame();
    return {
      schema: 'spectra-pro-export/v1',
      generatedAt: new Date().toISOString(),
      appVersion: sp.version || ('v' + VERSION),
      interfaceLanguage: language(),
      state: cloneJson(state),
      visibleDiagnostics: {
        status: collectInfoLines('spStatusText'),
        dataQuality: collectInfoLines('spDataQualityText')
      },
      uiControls: collectControls(),
      frameSummary: frame ? {
        source: frame.source || (state.frame && state.frame.source) || null,
        timestamp: frame.timestamp || null,
        sampleCount: Array.isArray(frame.I) ? frame.I.length : (Array.isArray(frame.px) ? frame.px.length : 0),
        hasWavelengthAxis: Array.isArray(frame.nm) && frame.nm.length > 0,
        pixelWidth: frame.pixelWidth || null
      } : null,
      spectrumData: frame ? {
        px: Array.isArray(frame.px) ? frame.px.slice() : null,
        nm: Array.isArray(frame.nm) ? frame.nm.slice() : null,
        R: Array.isArray(frame.R) ? frame.R.slice() : null,
        G: Array.isArray(frame.G) ? frame.G.slice() : null,
        B: Array.isArray(frame.B) ? frame.B.slice() : null,
        I: Array.isArray(frame.I) ? frame.I.slice() : null,
        processedI: Array.isArray(frame.processedI) ? frame.processedI.slice() : null,
        normalizedI: Array.isArray(frame.normalizedI) ? frame.normalizedI.slice() : null
      } : null,
      ai: aiSnapshot()
    };
  }

  function timestamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = global.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    global.document.body.appendChild(a);
    a.click();
    global.setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function downloadDataUrl(url, filename) {
    if (!url) return false;
    const a = global.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    global.document.body.appendChild(a);
    a.click();
    global.setTimeout(function () { a.remove(); }, 0);
    return true;
  }

  function loadScript(id, src) {
    return new Promise(function (resolve, reject) {
      const existing = $(id);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const s = global.document.createElement('script');
      s.id = id;
      s.src = src;
      s.async = true;
      s.addEventListener('load', function () { s.dataset.loaded = '1'; resolve(); }, { once: true });
      s.addEventListener('error', reject, { once: true });
      (global.document.head || global.document.documentElement).appendChild(s);
    });
  }

  async function ensurePdfLibraries() {
    if (!(global.jspdf && global.jspdf.jsPDF)) {
      await loadScript('spJsPdfLib', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
    }
    if (!(global.jspdf && global.jspdf.jsPDF)) throw new Error('jsPDF unavailable');
    if (!(global.jspdf.jsPDF.API && global.jspdf.jsPDF.API.autoTable)) {
      await loadScript('spJsPdfAutoTable', 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');
    }
    return global.jspdf.jsPDF;
  }

  function pdfText(value) {
    return String(value == null ? '' : value)
      .replace(/[₂]/g, '2').replace(/[₃]/g, '3').replace(/[₄]/g, '4')
      .replace(/[⁺]/g, '+').replace(/[⁻]/g, '-').replace(/λ/g, 'lambda').replace(/Δ/g, 'Delta');
  }

  function nfmt(value, digits) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits == null ? 2 : digits) : '—';
  }

  function candidateName(h) {
    return String((h && (h.element || h.species || h.speciesKey || h.name || h.label)) || '—');
  }

  function candidateRows(analysis) {
    const a = analysis || {};
    const src = Array.isArray(a.elementScores) && a.elementScores.length ? a.elementScores : (Array.isArray(a.topHits) ? a.topHits : []);
    return src.slice(0, 20).map(function (h) {
      const share = h.scoreSharePct != null ? h.scoreSharePct : (h.scoreShare != null ? h.scoreShare : (h.percent != null ? h.percent : null));
      const score = h.score != null ? h.score : (h.smartScore != null ? h.smartScore : null);
      const rawMatches = h.diagnosticMatchedPeaks != null ? h.diagnosticMatchedPeaks : (h.matchedCount != null ? h.matchedCount : (h.matches != null ? h.matches : ''));
      const matches = Array.isArray(rawMatches) ? rawMatches.length : rawMatches;
      const delta = h.medianDeltaNm != null ? h.medianDeltaNm : (h.deltaNm != null ? h.deltaNm : (h.delta_nm != null ? h.delta_nm : ''));
      return [candidateName(h), share != null ? nfmt(share, 1) + '%' : (score != null ? nfmt(score, 1) : '—'), String(matches == null ? '' : matches), delta === '' ? '—' : nfmt(delta, 3)];
    });
  }

  function matchedFeatureRows(analysis) {
    const a = analysis || {};
    let src = [];
    if (Array.isArray(a.rawTopHits) && a.rawTopHits.length) src = a.rawTopHits;
    else if (Array.isArray(a.topHits) && a.topHits.length) src = a.topHits;
    else if (Array.isArray(a.smartFindHits) && a.smartFindHits.length) src = a.smartFindHits;
    return src.slice(0, 80).map(function (h) {
      const species = candidateName(h);
      const obs = h.observedNm != null ? h.observedNm : (h.obsNm != null ? h.obsNm : (h.nm_meas != null ? h.nm_meas : h.nm));
      const ref = h.referenceNm != null ? h.referenceNm : (h.refNm != null ? h.refNm : (h.ref_nm != null ? h.ref_nm : null));
      const delta = h.deltaNm != null ? h.deltaNm : (h.delta_nm != null ? h.delta_nm : ((Number.isFinite(Number(obs)) && Number.isFinite(Number(ref))) ? Number(ref) - Number(obs) : null));
      const score = h.score != null ? h.score : (h.confidence != null ? h.confidence : '');
      return [
        species,
        Number.isFinite(Number(obs)) ? nfmt(obs, 3) : '—',
        Number.isFinite(Number(ref)) ? nfmt(ref, 3) : '—',
        Number.isFinite(Number(delta)) ? nfmt(delta, 3) : '—',
        score === '' ? '—' : nfmt(score, 3)
      ];
    });
  }

  function pairedFeatureRows(rows) {
    const src = Array.isArray(rows) ? rows : [];
    const half = Math.ceil(src.length / 2);
    const out = [];
    for (let i = 0; i < half; i += 1) {
      const left = src[i] || ['', '', '', '', ''];
      const right = src[i + half] || ['', '', '', '', ''];
      out.push(left.concat(right));
    }
    return out;
  }

  function buildAnalysisLogLines(bundle) {
    const state = bundle && bundle.state ? bundle.state : {};
    const analysis = state.analysis || {};
    const cal = state.calibration || {};
    const worker = state.worker || {};
    const lines = [];
    lines.push('Workspace=' + String(state.appMode || '—') + '; preset=' + String(analysis.presetId || '—') + '; processing=' + String((state.subtraction && state.subtraction.mode) || 'raw') + '.');
    lines.push('Calibration=' + (cal.isCalibrated ? 'active' : 'inactive') + '; points=' + String(Array.isArray(cal.points) ? cal.points.length : 0) + '; worker=' + String(worker.status || '—') + '; analysis rate=' + String(worker.analysisHz != null ? worker.analysisHz : '—') + ' Hz.');
    lines.push('Detected peaks=' + String(analysis.detectedPeakCount != null ? analysis.detectedPeakCount : '—') + '; top hits=' + String(Array.isArray(analysis.topHits) ? analysis.topHits.length : 0) + '; raw hits=' + String(Array.isArray(analysis.rawTopHits) ? analysis.rawTopHits.length : 0) + '; QC flags=' + String(Array.isArray(analysis.qcFlags) ? analysis.qcFlags.length : 0) + '.');
    if (analysis.offsetNm != null) lines.push('Estimated wavelength offset=' + nfmt(analysis.offsetNm, 4) + ' nm.');
    if (analysis.fluorescenceSummary) {
      const fl = analysis.fluorescenceSummary;
      lines.push('Fluorescence model=' + String(fl.model || '—') + '; type=' + String(fl.spectrumType || '—') + '; lambdaMax=' + nfmt(fl.lambdaMaxNm, 2) + ' nm; FWHM=' + nfmt(fl.fwhmNm, 2) + ' nm; asymmetry=' + String(fl.asymmetry || '—') + '.');
    } else {
      const rows = candidateRows(analysis).slice(0, 8);
      if (rows.length) lines.push('Ranked candidates: ' + rows.map(function (r) { return r[0] + ' ' + r[1]; }).join('; ') + '.');
    }
    if (Array.isArray(analysis.qcFlags) && analysis.qcFlags.length) lines.push('QC: ' + analysis.qcFlags.join('; ') + '.');
    return lines;
  }

  function lookupDiagnostic(rows, keyStart) {
    const key = String(keyStart || '').toLowerCase();
    const found = (rows || []).find(function (r) {
      const label = String(r.label || r.text || '').replace(/:$/, '').toLowerCase();
      return label.indexOf(key) === 0;
    });
    return found ? (found.value || found.text || '—') : '—';
  }

  function buildAutomaticAbstract(bundle) {
    const sv = language() === 'sv';
    const state = bundle.state || {};
    const analysis = state.analysis || {};
    const cal = state.calibration || {};
    const frame = bundle.frameSummary || {};
    const dq = bundle.visibleDiagnostics ? bundle.visibleDiagnostics.dataQuality : [];
    const parts = [];
    const preset = analysis.presetId || '—';
    const count = frame.sampleCount || 0;
    const calibrated = !!cal.isCalibrated;
    const snr = lookupDiagnostic(dq, 'snr');
    const sat = lookupDiagnostic(dq, 'sat');

    if (sv) {
      parts.push('Denna rapport sammanfattar den aktuella SPECTRA PRO-mätningen. Mätningen innehåller ' + count + ' provpunkter och analyserades med preset ' + preset + '. Våglängdskalibrering var ' + (calibrated ? 'aktiv' : 'inte aktiv') + ' vid exporttillfället.');
    } else {
      parts.push('This report summarizes the current SPECTRA PRO measurement. The measurement contains ' + count + ' sampled points and was analyzed with preset ' + preset + '. Wavelength calibration was ' + (calibrated ? 'active' : 'not active') + ' at export time.');
    }

    const fl = analysis.fluorescenceSummary;
    if (fl && typeof fl === 'object') {
      if (sv) {
        parts.push('Fluorescensanalysen beskriver ett ' + (fl.spectrumType || 'fluorescens') + ' med emissionsmaximum vid ' + nfmt(fl.lambdaMaxNm, 2) + ' nm, centroid ' + nfmt(fl.centroidNm, 2) + ' nm, FWHM ' + nfmt(fl.fwhmNm, 2) + ' nm och bandbredd ' + nfmt(fl.bandWidthNm, 2) + ' nm. Asymmetrin klassades som ' + (fl.asymmetry || '—') + '.');
      } else {
        parts.push('The fluorescence analysis describes ' + (fl.spectrumType || 'fluorescence') + ' with an emission maximum at ' + nfmt(fl.lambdaMaxNm, 2) + ' nm, centroid ' + nfmt(fl.centroidNm, 2) + ' nm, FWHM ' + nfmt(fl.fwhmNm, 2) + ' nm and band width ' + nfmt(fl.bandWidthNm, 2) + ' nm. The asymmetry was classified as ' + (fl.asymmetry || '—') + '.');
      }
    } else {
      const rows = candidateRows(analysis);
      if (rows.length) {
        const top = rows.slice(0, 3).map(function (r) { return r[0] + ' (' + r[1] + ')'; }).join(', ');
        parts.push(sv ? ('De högst rankade kandidaterna i den aktuella analysen är ' + top + '. Score Share är en relativ ranking inom den aktuella körningen och ska inte tolkas som sannolikhet, koncentration eller abundans.') : ('The highest-ranked candidates in the current analysis are ' + top + '. Score Share is a relative ranking within the current run and must not be interpreted as probability, concentration or abundance.'));
      }
    }

    if (sv) parts.push('Data Quality visar SNR ' + snr + ' och mättnad ' + sat + '. Resultatet bör tolkas tillsammans med kalibrering, instrumentupplösning, signalnivå, QC-flaggor och den fysikaliska lämpligheten hos valt preset.');
    else parts.push('Data Quality reports SNR ' + snr + ' and saturation ' + sat + '. Results should be interpreted together with calibration, instrument resolution, signal level, QC flags and the physical suitability of the selected preset.');

    if (bundle.ai && bundle.ai.available && bundle.ai.resultText) {
      parts.push((sv ? 'AI-tolkning: "' : 'AI interpretation: "') + String(bundle.ai.resultText).trim() + '"');
    }
    return parts.join(' ');
  }

  function signatureSummary(analysis, sv) {
    const rows = Array.isArray(analysis && analysis.elementScores) ? analysis.elementScores.slice(0, 5) : [];
    if (!rows.length) return sv ? 'inga tydliga rankade signaturer' : 'no clearly ranked signatures';
    return rows.map(function (row) {
      const name = candidateName(row);
      const lines = Array.isArray(row.supportLines) ? row.supportLines.map(Number).filter(Number.isFinite).sort(function (a,b){return a-b;}) : [];
      if (lines.length >= 2) return name + ' ' + nfmt(lines[0], 1) + '–' + nfmt(lines[lines.length - 1], 1) + ' nm';
      return name;
    }).join(', ');
  }

  function buildDetailedNarrative(bundle) {
    const sv = language() === 'sv';
    const state = bundle.state || {};
    const analysis = state.analysis || {};
    const cal = state.calibration || {};
    const hw = state.hardware || {};
    const dq = bundle.visibleDiagnostics ? bundle.visibleDiagnostics.dataQuality : [];
    const preset = String(analysis.presetId || '—');
    const offset = Number.isFinite(Number(analysis.offsetNm)) ? nfmt(analysis.offsetNm, 3) + ' nm' : (sv ? 'inte tillgänglig' : 'not available');
    const signatures = signatureSummary(analysis, sv);
    const maxDist = Number.isFinite(Number(analysis.maxDistanceNm)) ? nfmt(analysis.maxDistanceNm, 2) + ' nm' : (sv ? 'aktuell presetgräns' : 'the active preset limit');
    const snr = lookupDiagnostic(dq, 'snr');
    const sat = lookupDiagnostic(dq, 'sat');
    const res = lookupDiagnostic(dq, 'res');
    const calState = cal.isCalibrated ? (sv ? 'aktiv' : 'active') : (sv ? 'inte aktiv' : 'not active');
    const resolution = hw.spectrometerResolutionFwhmNm != null ? nfmt(hw.spectrometerResolutionFwhmNm, 2) + ' nm FWHM' : res;

    if (sv) {
      return [
        'Analysen bygger på den spektralprofil som extraherats ur den valda strimman i källbilden. Intensitetsdata och, när kalibrering finns, motsvarande våglängdsaxel skickas till SPECTRA PRO:s analysworker. Peak-detektionen bedömer lokala maxima med hänsyn till relativ höjd, prominens och minsta tillåtna separation. I de Smart-presets som stöder Auto tune startar analysen från ett relativt tillåtande peak-urval och omprövar sedan evidensen med stramare trösklar och våglängdstoleranser. Därmed blir identifieringen mindre beroende av ett enda manuellt valt tröskelvärde.',
        'Matchning mot linje- och banddata sker bara inom den aktuella våglängdstäckningen. För linjebaserad analys används en hård maximal våglängdsavvikelse, här ' + maxDist + ', så att avlägsna bibliotekslinjer inte kan få stöd enbart genom att biblioteket är tätt. Den rapporterade offseten är ' + offset + ' och bygger i den aktuella browsermotorn på medianen av residualerna för de matchningar som finns tillgängliga. Den fungerar som ett diagnostiskt mått på systematisk förskjutning mellan observerade och refererade våglängder; den ersätter inte en korrekt multipunktskalibrering.',
        'För atomära Smart-lägen bedöms inte en kandidat efter en ensam närliggande linje. Fingerprint-lagret väger samman flera diagnostiska linjer, våglängdsnärhet, hur stor del av de observerade starka topparna som förklaras, grupper av samverkande linjer och täckning av en kuraterad profil. Förväntade diagnostiska profilinslag som saknas ger en försiktig negativ viktning, och arter med täta eller tvetydiga kataloglinjer får inte automatiskt fördel av att biblioteket innehåller många möjliga sammanträffanden. Score Share normaliserar den positiva kandidatscoren inom just den aktuella körningen och är därför varken sannolikhet, koncentration eller abundans.',
        'Molekylära lägen använder motsvarande flerbandslogik. Diagnostiska ankare och band bedöms tillsammans, och stöd från flera koherenta band väger tyngre än en isolerad överlappning. I Gas Tube kan atomära och molekylära bidrag förekomma samtidigt. Fluorescent avviker medvetet från linjematchningen: där beskriver SPECTRA PRO i första hand den breda bandformen genom lambda-max, centroid, FWHM, bandområde, asymmetri, shoulders och integrerad baslinjekorrigerad signal. Smala linjekandidater behandlas då endast som sekundär diagnostik.',
        'Relevanta signaturer eller kluster i den aktuella körningen är: ' + signatures + '. Kalibreringen är ' + calState + ', uppskattad instrument-/samplingupplösning i rapportens diagnostik är ' + resolution + ', SNR anges som ' + snr + ' och mättnadsfältet som ' + sat + '. Dessa värden används tillsammans för att bedöma om en numeriskt bra match också är experimentellt trovärdig. Mättnad kan förstöra peakform och relativa intensiteter, medan låg SNR kan skapa extra lokala maxima eller dölja svaga diagnostiska drag.',
        'Efter matchningen sammanställs kandidatpoäng, observerade träffar, QC-flaggor och förklarad signalandel till det resultat som visas i LAB. Rapportens spektralbild visar den centrala 25 procenten av bildhöjden för att fokusera på själva dispersionsbandet, medan diagrammet återger den graf som faktiskt visades vid exporten med aktiva annoteringar och overlays. Den detaljerade feature-tabellen redovisar observerad våglängd, referensvåglängd, residual och score/confidence för de träffar som finns i den aktuella analysen. Resultaten bör ses som reproducerbara förslag givet den uppmätta signalen, valt preset och aktuell kalibrering; ändrad optik, fokus, zoom, gittergeometri eller kamerainställningar kan kräva ny kalibrering innan våglängdsmatchningen åter är tillförlitlig.'
      ];
    }

    return [
      'The analysis starts from the spectral profile extracted from the selected stripe in the source image. Intensity data and, when calibration is available, the corresponding wavelength axis are passed to the SPECTRA PRO analysis worker. Peak detection evaluates local maxima using relative height, prominence and minimum separation. In Smart presets that support Auto tune, the analysis begins with a relatively permissive master peak set and then re-evaluates the evidence with stricter peak thresholds and wavelength tolerances. This reduces dependence on one manually chosen threshold.',
      'Matching against line and band data is limited to the wavelength coverage of the current measurement. Line-based analysis uses a hard maximum wavelength mismatch, here ' + maxDist + ', so distant catalog lines cannot gain support merely because the library is dense. The reported offset is ' + offset + ' and, in the current browser engine, is estimated from the median residual of the available matches. It is a diagnostic measure of systematic displacement between observed and reference wavelengths; it is not a substitute for valid multipoint calibration.',
      'For atomic Smart modes, a candidate is not accepted because of one nearby catalog line. The fingerprint layer combines multiple diagnostic lines, wavelength closeness, coverage of strong observed peaks, coherent line groups and coverage of a curated profile. Missing diagnostic profile features apply a cautious penalty, while dense or ambiguous catalog regions are prevented from gaining automatic advantage simply because many unrelated lines exist nearby. Score Share normalizes positive candidate score only within the current run and therefore is not a probability, concentration or abundance estimate.',
      'Molecular modes apply the corresponding multi-band logic. Diagnostic anchors and bands are evaluated together, and support from several coherent bands carries more weight than an isolated overlap. Gas Tube can retain both atomic and molecular contributors. Fluorescent deliberately follows a different path: SPECTRA PRO primarily characterizes the broadband shape using lambda max, centroid, FWHM, band range, asymmetry, shoulders and integrated baseline-corrected signal. Narrow-line candidates are secondary diagnostics in that mode.',
      'Relevant signatures or clusters in the current run are: ' + signatures + '. Calibration is ' + calState + ', the instrument/sampling resolution reported by the diagnostics is ' + resolution + ', SNR is ' + snr + ' and the saturation field is ' + sat + '. These values are considered together when deciding whether a numerically attractive match is also experimentally credible. Saturation can destroy peak shape and relative intensity information, whereas low SNR can introduce additional local maxima or hide weak diagnostic features.',
      'After matching, candidate scores, observed hits, QC flags and explained-signal metrics are assembled into the LAB result. The report source image retains the central 25 percent of image height to focus on the dispersed spectrum, while the graph reproduces the canvas that was actually visible at export time with active annotations and overlays. The detailed feature table reports observed wavelength, reference wavelength, residual and score/confidence for the current hits. Results should be treated as reproducible best proposals given the measured signal, selected preset and active calibration; changes in optics, focus, zoom, grating geometry or camera settings can require recalibration before wavelength matching is trustworthy again.'
    ];
  }

  function imageSize(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      const img = new Image();
      img.onload = function () { resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function addImageFit(doc, url, y, maxHeight) {
    return imageSize(url).then(function (sz) {
      if (!sz || !sz.width || !sz.height) return y;
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 17;
      const maxW = pageW - margin * 2;
      let w = maxW;
      let h = w * sz.height / sz.width;
      if (maxHeight && h > maxHeight) { h = maxHeight; w = h * sz.width / sz.height; }
      const x = (pageW - w) / 2;
      doc.addImage(url, 'PNG', x, y, w, h, undefined, 'FAST');
      return y + h;
    });
  }

  function addWrapped(doc, text, x, y, width, options) {
    const opts = options || {};
    const size = opts.size || 9;
    const line = opts.line || (size * 0.45);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(pdfText(text), width);
    doc.text(lines, x, y, { align: opts.align || 'left' });
    return y + lines.length * line;
  }

  function addWrappedPaged(doc, text, x, y, width, options) {
    const opts = options || {};
    const size = opts.size || 9;
    const line = opts.line || (size * 0.45);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(pdfText(text), width);
    const bottom = Number(opts.bottom || 278);
    for (let i = 0; i < lines.length; i += 1) {
      if (y > bottom) {
        doc.addPage();
        y = 18;
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
      }
      doc.text(String(lines[i]), x, y);
      y += line;
    }
    return y;
  }

  function sectionTitle(doc, title, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(pdfText(title), 17, y);
    return y + 6;
  }

  function autoTable(doc, head, body, startY, widths) {
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [head.map(pdfText)],
        body: body.map(function (r) { return r.map(pdfText); }),
        startY: startY,
        margin: { left: 17, right: 17 },
        styles: { font: 'helvetica', fontSize: 7.7, cellPadding: 1.4, overflow: 'linebreak' },
        headStyles: { fillColor: [34,34,34], textColor: [255,255,255], fontStyle: 'bold' },
        columnStyles: widths || {}
      });
      return doc.lastAutoTable.finalY + 5;
    }
    let y = startY;
    const rows = [head].concat(body);
    rows.forEach(function (r, idx) {
      doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.text(pdfText(r.join(' | ')), 17, y);
      y += 4;
    });
    return y;
  }

  function matchedFeatureTable(doc, rows, startY, sv) {
    const paired = pairedFeatureRows(rows);
    if (!paired.length) return startY;
    const head = [
      sv ? 'Art' : 'Species', sv ? 'Mätt nm' : 'Measured', 'Ref', 'Delta', 'Score',
      sv ? 'Art' : 'Species', sv ? 'Mätt nm' : 'Measured', 'Ref', 'Delta', 'Score'
    ];
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [head],
        body: paired,
        startY: startY,
        margin: { left: 12, right: 12 },
        styles: { font: 'helvetica', fontSize: 6.1, cellPadding: 0.9, overflow: 'linebreak', halign: 'center' },
        headStyles: { fillColor: [34,34,34], textColor: [255,255,255], fontStyle: 'bold' },
        columnStyles: {
          0:{cellWidth:20,halign:'left'},1:{cellWidth:14},2:{cellWidth:14},3:{cellWidth:12},4:{cellWidth:14},
          5:{cellWidth:20,halign:'left'},6:{cellWidth:14},7:{cellWidth:14},8:{cellWidth:12},9:{cellWidth:14}
        }
      });
      return doc.lastAutoTable.finalY + 5;
    }
    return autoTable(doc, head, paired, startY);
  }

  function qualityStatusTable(doc, dq, status, startY, sv) {
    const n = Math.max(dq.length, status.length);
    const rows = [];
    for (let i = 0; i < n; i += 1) {
      const q = dq[i] || {};
      const s = status[i] || {};
      rows.push([q.label || q.text || '', q.value || '', s.label || s.text || '', s.value || '']);
    }
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [[sv ? 'QUALITY REPORT – fält' : 'QUALITY REPORT – field', sv ? 'Värde' : 'Value', sv ? 'STATUS – fält' : 'STATUS – field', sv ? 'Värde' : 'Value']],
        body: rows,
        startY: startY,
        margin: { left: 17, right: 17 },
        styles: { font: 'helvetica', fontSize: 7.3, cellPadding: 1.25, overflow: 'linebreak' },
        headStyles: { fillColor: [34,34,34], textColor: [255,255,255], fontStyle: 'bold' },
        columnStyles: { 0:{cellWidth:44},1:{cellWidth:38},2:{cellWidth:44},3:{cellWidth:38} }
      });
      return doc.lastAutoTable.finalY + 5;
    }
    return autoTable(doc, ['Quality','Value','Status','Value'], rows, startY);
  }

  function calibrationRows(cal) {
    const pts = Array.isArray(cal && cal.points) ? cal.points : [];
    return pts.slice(0, 30).map(function (p) {
      if (Array.isArray(p)) return [String(p[0]), String(p[1])];
      return [String(p.px != null ? p.px : (p.pixel != null ? p.pixel : '')), String(p.nm != null ? p.nm : (p.wavelength != null ? p.wavelength : ''))];
    });
  }

  async function generatePdf(bundle, sourceUrl, graphUrl, filename) {
    const JsPDF = await ensurePdfLibraries();
    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const sv = language() === 'sv';
    const state = bundle.state || {};
    const analysis = state.analysis || {};
    const hardware = state.hardware || {};
    const cal = state.calibration || {};
    const dq = bundle.visibleDiagnostics ? bundle.visibleDiagnostics.dataQuality : [];
    const status = bundle.visibleDiagnostics ? bundle.visibleDiagnostics.status : [];
    const pageW = doc.internal.pageSize.getWidth();

    const croppedSourceUrl = sourceUrl ? (await cropCenterBandDataUrl(sourceUrl, 0.25) || sourceUrl) : '';
    const rotatedGraphUrl = graphUrl ? (await rotateDataUrl90(graphUrl) || graphUrl) : '';
    const logoUrl = await loadLocalLogoDataUrl();
    const heroUrl = await resolveProjectHeroDataUrl(croppedSourceUrl);

    // Cover page
    let y = 20;
    if (logoUrl) {
      const logoSz = await imageSize(logoUrl);
      if (logoSz) {
        const lw = 118;
        const lh = lw * logoSz.height / logoSz.width;
        doc.addImage(logoUrl, 'PNG', (pageW - lw) / 2, y, lw, Math.min(42, lh), undefined, 'FAST');
        y += Math.min(42, lh) + 10;
      }
    }
    doc.setFont('helvetica','bold');
    doc.setFontSize(23);
    doc.text('SPECTRA PRO', pageW / 2, y, { align:'center' });
    y += 10;
    doc.setFontSize(14);
    doc.text(sv ? 'Spektralanalysrapport' : 'Spectral Analysis Report', pageW / 2, y, { align:'center' });
    y += 10;
    if (heroUrl) {
      const heroSz = await imageSize(heroUrl);
      if (heroSz) {
        let hw = pageW - 30;
        let hh = hw * heroSz.height / heroSz.width;
        const maxH = 132;
        if (hh > maxH) { hh = maxH; hw = hh * heroSz.width / heroSz.height; }
        doc.addImage(heroUrl, 'PNG', (pageW - hw) / 2, y, hw, hh, undefined, 'FAST');
        y += hh + 9;
      }
    }
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text(pdfText(bundle.generatedAt), pageW / 2, Math.min(282, y + 3), { align:'center' });
    doc.setFontSize(8);
    doc.text('www.k-aberg.se', pageW / 2, Math.min(288, y + 9), { align:'center' });

    // Abstract
    doc.addPage();
    y = 18;
    y = sectionTitle(doc, sv ? 'ABSTRAKT' : 'ABSTRACT', y);
    y = addWrappedPaged(doc, buildAutomaticAbstract(bundle), 17, y, pageW - 34, { size: 9.1, line: 4.15, bottom: 276 });

    // Cropped spectrum source
    doc.addPage();
    y = 18;
    y = sectionTitle(doc, sv ? 'Spektrumkälla – centrala 25 % av bildhöjden' : 'Spectrum source – central 25% of image height', y);
    if (croppedSourceUrl) {
      y = await addImageFit(doc, croppedSourceUrl, y + 3, 100);
    } else {
      y = addWrapped(doc, sv ? 'Ingen källbild tillgänglig.' : 'No source image available.', 17, y, pageW - 34, { size:9 });
    }

    // Graph rotated 90 degrees and filling a portrait page
    doc.addPage();
    y = 12;
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text(sv ? 'SPEKTRUMPROFIL / DIAGRAM – ROTERAD 90°' : 'SPECTRUM PROFILE / GRAPH – ROTATED 90°', pageW / 2, y, { align:'center' });
    if (rotatedGraphUrl) {
      await addImageFit(doc, rotatedGraphUrl, 17, 263);
    }

    // Method, workflow, calibration
    doc.addPage();
    y = 18;
    y = sectionTitle(doc, sv ? 'Metodtabell' : 'Method table', y);
    const methodRows = [
      [sv ? 'Arbetsläge' : 'Workspace', state.appMode || '—', sv ? 'Aktivt SPECTRA PRO-läge' : 'Active SPECTRA PRO mode', '—'],
      ['Preset', analysis.presetId || '—', sv ? 'Aktiv analysprofil' : 'Active analysis profile', '—'],
      [sv ? 'Bearbetning' : 'Processing', (state.subtraction && state.subtraction.mode) || 'raw', sv ? 'Aktivt signalflöde' : 'Active signal processing', '—'],
      [sv ? 'Topptröskel' : 'Peak threshold', analysis.peakThresholdRel != null ? nfmt(Number(analysis.peakThresholdRel) * 100, 2) : '—', sv ? 'Relativ LAB-tröskel' : 'Relative LAB threshold', '%'],
      [sv ? 'Toppavstånd' : 'Peak distance', analysis.peakDistancePx != null ? String(analysis.peakDistancePx) : '—', sv ? 'Minsta separation' : 'Minimum separation', 'px'],
      [sv ? 'Max avstånd' : 'Max distance', analysis.maxDistanceNm != null ? nfmt(analysis.maxDistanceNm, 3) : '—', sv ? 'Hård matchningsgräns' : 'Hard matching gate', 'nm'],
      [sv ? 'Svaga toppar' : 'Weak peaks', analysis.includeWeakPeaks ? 'on' : 'off', sv ? 'Analysinställning' : 'Analysis setting', '—']
    ];
    y = autoTable(doc, [sv ? 'Parameter' : 'Parameter', sv ? 'Värde' : 'Value', sv ? 'Kommentar' : 'Comment', sv ? 'Enhet' : 'Unit'], methodRows, y);

    y = sectionTitle(doc, sv ? 'Workflow (pipeline)' : 'Workflow (pipeline)', y);
    const workflow = sv ? [
      'Kamera eller bild läses som aktuell spektrumkälla.',
      'Vald stripe extraherar RGB- och intensitetsdata.',
      'Aktiv kalibrering mappar px till nm när kalibrering finns.',
      'Förbehandling och peak/band-detektion körs enligt aktuellt preset.',
      'Linje-, fingerprint-, molekyl- eller fluorescenslogik används beroende på källtyp.',
      'QC, Status och Data Quality sammanställs.',
      'Aktuella overlays ritas i diagrammet och exporteras tillsammans med visningen.',
      'CSV, JSON och denna rapport skapas direkt från aktuellt apptillstånd.'
    ] : [
      'Camera or image is read as the current spectrum source.',
      'The selected stripe extracts RGB and intensity data.',
      'Active calibration maps px to nm when calibration is available.',
      'Preprocessing and peak/band detection run according to the active preset.',
      'Line, fingerprint, molecular or fluorescence logic is applied according to source type.',
      'QC, Status and Data Quality are summarized.',
      'Current overlays are rendered into the graph and retained in graph export.',
      'CSV, JSON and this report are generated directly from current application state.'
    ];
    workflow.forEach(function (line) { y = addWrapped(doc, '• ' + line, 20, y, pageW - 38, { size: 8.7, line: 4.0 }); });

    if (y > 230) { doc.addPage(); y = 18; }
    y += 3;
    y = sectionTitle(doc, sv ? 'Instrument / kalibrering' : 'Instrument / calibration', y);
    const instRows = [
      [sv ? 'Spektrometer' : 'Spectrometer', hardware.profileName || hardware.profileId || 'CUSTOM'],
      [sv ? 'Omfång' : 'Range', (hardware.spectralRangeMinNm != null || hardware.spectralRangeMaxNm != null) ? String(hardware.spectralRangeMinNm || '—') + '–' + String(hardware.spectralRangeMaxNm || '—') + ' nm' : '—'],
      ['FWHM', hardware.spectrometerResolutionFwhmNm != null ? nfmt(hardware.spectrometerResolutionFwhmNm, 3) + ' nm' : '—'],
      [sv ? 'Pixelupplösning' : 'Pixel resolution', hardware.pixelResolutionNm != null ? nfmt(hardware.pixelResolutionNm, 4) + ' nm/px' : '—'],
      [sv ? 'Gittertäthet' : 'Grating density', hardware.gratingLinesPerMm != null ? String(hardware.gratingLinesPerMm) + ' lines/mm' : '—'],
      [sv ? 'Kalibrerad' : 'Calibrated', cal.isCalibrated ? (sv ? 'Ja' : 'Yes') : (sv ? 'Nej' : 'No')],
      [sv ? 'Kalibreringskoefficienter' : 'Calibration coefficients', Array.isArray(cal.coefficients) ? cal.coefficients.join(', ') : '—']
    ];
    y = autoTable(doc, [sv ? 'Fält' : 'Field', sv ? 'Värde' : 'Value'], instRows, y);
    const cRows = calibrationRows(cal);
    if (cRows.length) {
      y = sectionTitle(doc, sv ? 'Kalibreringspunkter' : 'Calibration points', y);
      y = autoTable(doc, ['Pixel (px)', sv ? 'Våglängd (nm)' : 'Wavelength (nm)'], cRows, y);
    }

    // Detailed continuous method text before indicators
    doc.addPage();
    y = 18;
    y = sectionTitle(doc, sv ? 'Analysmetod och tolkningskontext' : 'Analysis method and interpretation context', y);
    const narrative = buildDetailedNarrative(bundle);
    for (let i = 0; i < narrative.length; i += 1) {
      y = addWrappedPaged(doc, narrative[i], 17, y, pageW - 34, { size: 9, line: 4.15, bottom: 276 });
      y += 4;
    }

    if (y > 225) { doc.addPage(); y = 18; }
    y = sectionTitle(doc, sv ? 'Primära indikatorer' : 'Primary indicators', y);
    const fl = analysis.fluorescenceSummary;
    if (fl && typeof fl === 'object') {
      y = autoTable(doc, [sv ? 'Mått' : 'Metric', sv ? 'Värde' : 'Value'], [
        ['lambda max', nfmt(fl.lambdaMaxNm, 2) + ' nm'],
        ['Centroid', nfmt(fl.centroidNm, 2) + ' nm'],
        ['FWHM', nfmt(fl.fwhmNm, 2) + ' nm'],
        [sv ? 'Bandbredd' : 'Band width', nfmt(fl.bandWidthNm, 2) + ' nm'],
        [sv ? 'Bandområde' : 'Band range', nfmt(fl.bandMinNm, 2) + '–' + nfmt(fl.bandMaxNm, 2) + ' nm'],
        [sv ? 'Asymmetri' : 'Asymmetry', fl.asymmetry || '—'],
        [sv ? 'Integrerad signal' : 'Integrated signal', nfmt(fl.integratedIntensity, 2)]
      ], y);
    } else {
      const rows = candidateRows(analysis);
      if (rows.length) y = autoTable(doc, [sv ? 'Kandidat' : 'Candidate', sv ? 'Andel / score' : 'Share / score', sv ? 'Matchningar' : 'Matches', 'Delta nm'], rows, y);
      else y = addWrapped(doc, sv ? 'Inga rankade träffar finns i den aktuella analysen.' : 'No ranked hits are available in the current analysis.', 17, y, pageW - 34, { size: 9 });
    }

    const featureRows = matchedFeatureRows(analysis);
    if (featureRows.length) {
      if (y > 205) { doc.addPage(); y = 18; }
      y += 3;
      y = sectionTitle(doc, sv ? 'Matchade spektrala egenskaper' : 'Matched spectral features', y);
      y = matchedFeatureTable(doc, featureRows, y, sv);
    }

    // Quality and Status side-by-side
    if (y > 205) { doc.addPage(); y = 18; }
    y += 3;
    y = sectionTitle(doc, sv ? 'Kvalitet och status' : 'Quality and status', y);
    y = qualityStatusTable(doc, dq, status, y, sv);
    const qc = Array.isArray(analysis.qcFlags) ? analysis.qcFlags : [];
    if (qc.length) {
      y = addWrapped(doc, (sv ? 'QC-flaggor: ' : 'QC flags: ') + qc.join(', '), 17, y, pageW - 34, { size: 8.5 });
    }

    // Detailed log and reproducibility
    doc.addPage();
    y = 18;
    y = sectionTitle(doc, sv ? 'Analyslogg (detaljerad)' : 'Analysis log (detailed)', y);
    const analysisLog = buildAnalysisLogLines(bundle);
    analysisLog.forEach(function (line) {
      y = addWrapped(doc, '• ' + line, 17, y, pageW - 34, { size: 8.5, line: 4.0 });
    });

    y += 5;
    y = sectionTitle(doc, sv ? 'Reproducerbarhet' : 'Reproducibility', y);
    const repro = [
      [sv ? 'Tidsstämpel' : 'Timestamp', bundle.generatedAt],
      ['SPECTRA PRO', bundle.appVersion],
      [sv ? 'Språk' : 'Language', bundle.interfaceLanguage],
      [sv ? 'Källa' : 'Source', bundle.frameSummary ? (bundle.frameSummary.source || '—') : '—'],
      [sv ? 'Provpunkter' : 'Samples', bundle.frameSummary ? String(bundle.frameSummary.sampleCount || 0) : '0'],
      [sv ? 'Arbetsläge' : 'Workspace', state.appMode || '—'],
      ['Preset', analysis.presetId || '—']
    ];
    autoTable(doc, [sv ? 'Fält' : 'Field', sv ? 'Värde' : 'Value'], repro, y);

    return doc.output('blob');
  }

  function optionAvailability(modal) {
    if (!modal) return;
    const frame = currentFrame();
    const sourceOk = !!captureSourceDataUrl();
    const graphOk = !!captureGraphDataUrl();
    const map = {
      source: sourceOk,
      csv: !!(frame && (Array.isArray(frame.I) || Array.isArray(frame.px))),
      graph: graphOk,
      json: true,
      pdf: true
    };
    Object.keys(map).forEach(function (key) {
      const input = modal.querySelector('input[data-export-kind="' + key + '"]');
      const label = input && input.closest('.sp-export-option');
      if (!input) return;
      input.disabled = !map[key];
      if (!map[key]) input.checked = false;
      if (label) label.classList.toggle('is-disabled', !map[key]);
    });
  }

  function updateModalLanguage() {
    const modal = $(MODAL_ID);
    if (!modal) return;
    const map = {
      '[data-export-title]': 'title', '[data-export-intro]': 'intro',
      '[data-export-label="source"] b': 'source', '[data-export-label="source"] small': 'sourceDesc',
      '[data-export-label="csv"] b': 'csv', '[data-export-label="csv"] small': 'csvDesc',
      '[data-export-label="graph"] b': 'graph', '[data-export-label="graph"] small': 'graphDesc',
      '[data-export-label="json"] b': 'json', '[data-export-label="json"] small': 'jsonDesc',
      '[data-export-label="pdf"] b': 'pdf', '[data-export-label="pdf"] small': 'pdfDesc',
      '#spExportCancelBtn': 'cancel', '#spExportRunBtn': 'exportSelected'
    };
    Object.keys(map).forEach(function (selector) {
      const el = modal.querySelector(selector);
      if (el) el.textContent = t(map[selector]);
    });
    const close = modal.querySelector('.sp-export-modal__close');
    if (close) close.setAttribute('aria-label', t('close'));
    const ai = modal.querySelector('.sp-export-ai-note');
    if (ai) ai.textContent = hasAiResult() ? t('aiIncluded') : t('noAi');
    ensureSidebarButton();
  }

  function ensureModal() {
    let modal = $(MODAL_ID);
    if (modal) return modal;
    modal = global.document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'sp-export-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = [
      '<div class="sp-export-modal__backdrop" data-export-close="1"></div>',
      '<div class="sp-export-modal__panel">',
      '  <div class="sp-export-modal__head"><div><div class="sp-export-modal__title" data-export-title>EXPORT</div><div class="sp-export-modal__intro" data-export-intro></div></div><button type="button" class="sp-export-modal__close" data-export-close="1">×</button></div>',
      '  <div class="sp-export-modal__body">',
      '    <div class="sp-export-grid">',
      '      <label class="sp-export-option" data-export-label="source"><input type="checkbox" data-export-kind="source" checked><span><b></b><small></small></span></label>',
      '      <label class="sp-export-option" data-export-label="csv"><input type="checkbox" data-export-kind="csv" checked><span><b></b><small></small></span></label>',
      '      <label class="sp-export-option" data-export-label="graph"><input type="checkbox" data-export-kind="graph" checked><span><b></b><small></small></span></label>',
      '      <label class="sp-export-option" data-export-label="json"><input type="checkbox" data-export-kind="json" checked><span><b></b><small></small></span></label>',
      '      <label class="sp-export-option" data-export-label="pdf"><input type="checkbox" data-export-kind="pdf" checked><span><b></b><small></small></span></label>',
      '    </div>',
      '    <div class="sp-export-ai-note"></div>',
      '    <div id="spExportStatus" class="sp-export-status" aria-live="polite"></div>',
      '    <div class="sp-export-modal__actions"><button type="button" id="spExportCancelBtn" data-export-close="1"></button><button type="button" id="spExportRunBtn" class="sp-export-primary"></button></div>',
      '  </div>',
      '</div>'
    ].join('');
    global.document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      const target = event.target;
      if (!target) return;
      if (target.getAttribute && target.getAttribute('data-export-close') === '1') close();
      if (target.id === 'spExportRunBtn') runExport();
    });
    updateModalLanguage();
    return modal;
  }

  function setStatus(text, tone) {
    const el = $('spExportStatus');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || 'info';
  }

  function setBusy(busy) {
    const btn = $('spExportRunBtn');
    if (btn) btn.disabled = !!busy;
  }

  function open() {
    installStyles();
    ensureSidebarButton();
    const modal = ensureModal();
    updateModalLanguage();
    optionAvailability(modal);
    setStatus('', 'info');
    modal.classList.add('is-open');
    return true;
  }

  function close() {
    const modal = $(MODAL_ID);
    if (modal) modal.classList.remove('is-open');
    setBusy(false);
  }

  function addDataUrlToZip(zip, name, url) {
    if (!zip || !url) return false;
    const comma = String(url).indexOf(',');
    if (comma < 0) return false;
    const meta = String(url).slice(0, comma);
    const data = String(url).slice(comma + 1);
    if (/;base64/i.test(meta)) zip.file(name, data, { base64: true });
    else zip.file(name, decodeURIComponent(data));
    return true;
  }

  async function runExport() {
    const modal = $(MODAL_ID);
    if (!modal) return;
    const selected = Array.from(modal.querySelectorAll('input[data-export-kind]:checked:not(:disabled)')).map(function (el) { return el.dataset.exportKind; });
    if (!selected.length) { setStatus(t('noneSelected'), 'error'); return; }
    setBusy(true);
    setStatus(t('working'), 'info');

    const ts = timestamp();
    const frame = currentFrame();
    const bundle = buildAnalysisBundle();
    const needSource = selected.indexOf('source') >= 0 || selected.indexOf('pdf') >= 0;
    const needGraph = selected.indexOf('graph') >= 0 || selected.indexOf('pdf') >= 0;
    const rawSourceUrl = needSource ? captureSourceDataUrl() : '';
    const sourceUrl = rawSourceUrl ? (await cropCenterBandDataUrl(rawSourceUrl, 0.25) || rawSourceUrl) : '';
    const graphUrl = needGraph ? captureGraphDataUrl() : '';
    const errors = [];
    let fileCount = 0;

    try {
      if (!global.JSZip) throw new Error('JSZip is unavailable');
      const zip = new global.JSZip();
      const prefix = 'SPECTRA_PRO_' + ts;

      if (selected.indexOf('source') >= 0) {
        if (addDataUrlToZip(zip, prefix + '_source.png', sourceUrl)) fileCount += 1;
        else errors.push(t('sourceMissing'));
      }

      if (selected.indexOf('csv') >= 0) {
        const csv = buildCsv(frame);
        if (csv) { zip.file(prefix + '_data.csv', csv); fileCount += 1; }
        else errors.push(t('dataMissing'));
      }

      if (selected.indexOf('graph') >= 0) {
        if (addDataUrlToZip(zip, prefix + '_graph.png', graphUrl)) fileCount += 1;
        else errors.push(t('graphMissing'));
      }

      if (selected.indexOf('json') >= 0) {
        zip.file(prefix + '_analysis.json', JSON.stringify(bundle, null, 2));
        fileCount += 1;
      }

      if (selected.indexOf('pdf') >= 0) {
        try {
          const pdfBlob = await generatePdf(bundle, rawSourceUrl, graphUrl, prefix + '_report.pdf');
          if (pdfBlob) { zip.file(prefix + '_report.pdf', pdfBlob); fileCount += 1; }
          else errors.push(t('pdfError'));
        } catch (error) {
          errors.push(t('pdfError') + ' ' + String(error && error.message || error || ''));
        }
      }

      if (fileCount > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        downloadBlob(zipBlob, prefix + '_export.zip');
      }
    } catch (error) {
      errors.push(String(error && error.message || error || 'Export failed'));
    } finally {
      setBusy(false);
    }

    if (errors.length) setStatus(errors.join(' '), 'error');
    else {
      setStatus(t('done'), 'info');
      global.setTimeout(close, 550);
    }
  }

  function installHooks() {
    if (sp.eventBus && typeof sp.eventBus.on === 'function') {
      sp.eventBus.on('ui:refresh', ensureSidebarButton);
      sp.eventBus.on('state:changed', ensureSidebarButton);
      sp.eventBus.on('language:changed', function () { ensureSidebarButton(); updateModalLanguage(); });
    }
    if (global.document && !global.document.__spExportKeyHook) {
      global.document.__spExportKeyHook = true;
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
    installHooks();
    [0, 80, 180, 350, 700, 1200, 2000].forEach(function (delay) { global.setTimeout(ensureSidebarButton, delay); });
  }

  sp.exportUi = {
    version: VERSION,
    open: open,
    close: close,
    buildAnalysisBundle: buildAnalysisBundle,
    buildCsv: buildCsv,
    captureSourceDataUrl: captureSourceDataUrl,
    captureGraphDataUrl: captureGraphDataUrl,
    cropCenterBandDataUrl: cropCenterBandDataUrl,
    rotateDataUrl90: rotateDataUrl90,
    generatePdf: generatePdf,
    refreshLanguage: updateModalLanguage
  };

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(window);
