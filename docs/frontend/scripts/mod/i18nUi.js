(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = '3.0.8';
  const SWITCH_ID = 'spLanguageSwitch';
  const STYLE_ID = 'spLanguageSwitchStyle';
  const HIGH_FREQUENCY_SELECTOR = '#spStatusText,#spDataQualityText,#spDQDetailsBody,#spLabHits,#spLabQc,#spAstroContinuum,#spAstroFeatures,#spAstroMatches,#spAstroQuality,#spAstroVelocity,#spResponseStatus,#spResponseCatalogNote,#spSideConsolePre';

  // English remains the source language and is always the initial language after page load.
  let currentLanguage = 'en';
  let uiObserver = null;
  let bodyObserver = null;
  let applying = false;
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();

  const SV = {
    'Recording': 'Inspelning',
    'Source': 'Källa',
    'Dark': 'Mörk',
    'Ref': 'Ref',
    'Refresh': 'Uppdatera',
    'Pause': 'Pausa',
    'Play': 'Starta',
    'Load Image': 'Ladda bild',
    'Load Example': 'Ladda exempel',
    'Load a calibrated SPECTRA-1 line-spectrum example.': 'Ladda ett kalibrerat linjespektrumexempel från SPECTRA-1.',
    'SPECTRA-1 example (calibrated)': 'SPECTRA-1 exempel (kalibrerat)',
    'Compare images': 'Jämför bilder',
    'Stop comparison': 'Avsluta jämförelse',
    'Stripe Width': 'Remsbredd',
    'Stripe Place': 'Remsposition',
    'Adjust Exposure:': 'Justera exponering:',
    'Reference Graph': 'Referensgraf',
    'Add Reference': 'Lägg till referens',
    'Add Reference from File': 'Lägg till referens från fil',
    'Reset References': 'Återställ referenser',
    'Enter filename': 'Ange filnamn',
    'Export calibration settings': 'Exportera kalibreringsinställningar',
    'Add': 'Lägg till',
    'Reset': 'Återställ',
    'Sort': 'Sortera',
    'Record': 'Mät',
    'Number of Captures': 'Antal mätningar',
    'Pause in between captures': 'Paus mellan mätningar',
    '(in ms.)': '(i ms)',
    'Screenshot Graph': 'Skärmbild av graf',
    'Capture': 'Mät',
    'Graph Settings': 'Grafinställningar',
    'Show Reference Lines': 'Visa referenslinjer',
    'Compare Reference Lines': 'Jämför referenslinjer',
    'Add Reference Line': 'Lägg till referenslinje',
    'From file': 'Från fil',
    'Clear Lines': 'Rensa linjer',
    'Reset zoom': 'Återställ zoom',
    'Step back': 'Stega tillbaka',
    'Long exposure': 'Lång exponering',
    'Export': 'Exportera',
    'Diffraction': 'Diffraktion',
    'Show or hide possible higher-order diffraction markers.': 'Visa eller dölj möjliga markeringar för högre diffraktionsordning.',

    'CORE': 'CORE',
    'HARDWARE': 'HÅRDVARA',
    'CALIBRATE': 'KALIBRERA',
    'LAB': 'LAB',
    'ASTRO': 'ASTRO',
    'HELP': 'HJÄLP',
    'App mode': 'Appläge',
    'Worker': 'Worker',
    'X-axis': 'X-axel',
    'Y-axis': 'Y-axel',
    'Y max': 'Y max',
    'Fill mode': 'Fyllnadsläge',
    'Fill opacity': 'Fyllnadsopacitet',
    'Combined': 'Kombinerad',
    'Red': 'Röd',
    'Green': 'Grön',
    'Blue': 'Blå',
    'Dark graph': 'Mörkgraf',
    'Reference graph': 'Referensgraf',
    'Toggle peaks': 'Visa toppar',
    'Peak threshold': 'Topptröskel',
    'Peak distance': 'Toppavstånd',
    'Peak smoothing': 'Topputjämning',
    'Refresh UI': 'Uppdatera UI',
    'Probe camera': 'Kontrollera kamera',
    'Camera Zoom': 'Kamerazoom',
    'Camera Exposure': 'Kameraexponering',
    'AUTO': 'AUTO',
    'MANUAL': 'MANUELL',
    'NORMALIZE': 'NORMALISERA',
    'INHERIT': 'ÄRV',
    'OFF': 'AV',
    'SYNTHETIC': 'SYNTETISK',
    'SOURCE': 'KÄLLA',
    'NORMAL': 'NORMAL',
    'DIFFERENCE': 'DIFFERENS',
    'RATIO': 'KVOT',
    'TRANSMITTANCE': 'TRANSMITTANS',
    'ABSORBANCE': 'ABSORBANS',

    'Spectrometer': 'Spektrometer',
    'Range (min)': 'Omfång (min)',
    'Range (max)': 'Omfång (max)',
    'Resolution': 'Upplösning',
    'Pixel resolution': 'Pixelupplösning',
    'Grating density': 'Gittertäthet',
    'Apply': 'Tillämpa',
    'Clear': 'Rensa',
    'CUSTOM': 'ANPASSAD',
    'Instrument response': 'Instrumentrespons',
    'Response profile': 'Responsprofil',
    'None': 'Ingen',
    'Load custom JSON/CSV': 'Ladda egen JSON/CSV',
    'Loading bundled response profiles…': 'Laddar bundna responsprofiler…',
    'Uncorrected relative intensity.': 'Okorrigerad relativ intensitet.',
    'Uncorrected relative intensity. No response correction is applied.': 'Okorrigerad relativ intensitet. Ingen responskorrigering tillämpas.',

    'Calibration': 'Kalibrering',
    'Calibration fit graph': 'Kalibreringsgraf',
    'Fit formula': 'Anpassningsformel',
    'Apply points': 'Tillämpa punkter',
    'Save to file': 'Spara till fil',
    'Load from file': 'Ladda från fil',
    'Data Quality (details)': 'Datakvalitet (detaljer)',
    'Remove': 'Ta bort',
    'add': 'lägg till',
    'Not Calibrated. Load Calibrationfile now?': 'Inte kalibrerad. Ladda kalibreringsfil nu?',
    'Switch x-axis to wavelength?': 'Byt X-axel till våglängd?',
    'Yes': 'Ja',
    'No': 'Nej',

    'Analyze': 'Analysera',
    'Advanced analysis settings': 'Avancerade analysinställningar',
    'Advanced ASTRO details': 'Avancerade ASTRO-detaljer',
    'Absorption line labels': 'Etiketter för absorptionslinjer',
    'Show labels': 'Visa etiketter',
    'Minimum dip depth': 'Minsta dippdjup',
    'Minimum label spacing (px)': 'Minsta etikettavstånd (px)',
    'Only absorption features with an identified reference line are labelled.': 'Endast absorptionslinjer med en identifierad referenslinje får etikett.',
    'Advanced: reference spectrum comparison': 'Avancerat: jämförelse med referensspektrum',
    'Continuum diagnostics': 'Kontinuumdiagnostik',
    'Continuum': 'Kontinuum',
    'Measurement quality': 'Mätkvalitet',
    'Radial velocity': 'Radialhastighet',
    'Stellar class evidence': 'Evidens för stjärnklass',
    'ABSORPTION FEATURES': 'ABSORPTIONSDRAG',
    'REFERENCE MATCHES': 'REFERENSMATCHNINGAR',
    'Waiting for a calibrated spectrum.': 'Väntar på ett kalibrerat spektrum.',
    'Unavailable.': 'Ej tillgängligt.',
    'No absorption features yet.': 'Inga absorptionsdrag ännu.',
    'No reference matches yet.': 'Inga referensmatchningar ännu.',
    'No measurable absorption features.': 'Inga mätbara absorptionsdrag.',
    'No matches. A calibrated wavelength axis is required.': 'Inga matchningar. En kalibrerad våglängdsaxel krävs.',
    'Analysis is off.': 'Analysen är avstängd.',
    'Waiting for an ASTRO result.': 'Väntar på ett ASTRO-resultat.',
    'Educational low-resolution analysis. Broad O/B/A/F/G/K/M evidence is heuristic, not a probability, subclass or luminosity class. Radial velocity is not barycentric/heliocentric corrected.': 'Utbildningsanalys med låg upplösning. Bred O/B/A/F/G/K/M-evidens är heuristisk, inte en sannolikhet, underklass eller luminositetsklass. Radialhastigheten är inte barycentriskt/heliocentriskt korrigerad.',
    'Broad class only; no subclass or luminosity class.': 'Endast bred klass; ingen underklass eller luminositetsklass.',
    'Conflicting class evidence': 'Motstridig klassevidens',
    'No class is promoted as reliable.': 'Ingen klass anges som tillförlitlig.',
    'Insufficient class evidence': 'Otillräcklig klassevidens',
    'More calibrated, reliable diagnostic features are required.': 'Fler kalibrerade och tillförlitliga diagnostiska drag krävs.',
    'Insufficient reliable lines for a combined velocity.': 'Otillräckligt med tillförlitliga linjer för en kombinerad hastighet.',
    'Radial velocity unavailable.': 'Radialhastighet ej tillgänglig.',
    'Max Hz': 'Max Hz',
    'Preset': 'Förval',
    'Mode': 'Läge',
    'Show hits': 'Visa träffar',
    'Weak peaks': 'Svaga toppar',
    'Stable hits': 'Stabila träffar',
    'Smart find': 'Smart sökning',
    'Strong Peak': 'Stark topp',
    'Max distance (nm)': 'Maxavstånd (nm)',
    'Reload libraries': 'Ladda om bibliotek',
    'Init libraries': 'Initiera bibliotek',
    'Ping worker': 'Pinga worker',
    'Query library': 'Sök i bibliotek',
    'Library Search': 'Bibliotekssökning',
    'Narrow-line overlay': 'Smal linje-overlay',
    'AI Interpretation': 'AI-tolkning',
    'AI INTERPRETATION': 'AI-TOLKNING',
    'TOP HITS': 'TOPPTRÄFFAR',
    'Top hits': 'Toppträffar',
    'MATCH SCORE': 'MATCHNINGSPOÄNG',
    'STATUS': 'STATUS',
    'DATA QUALITY': 'DATAKVALITET',
    'BAND FEATURES': 'BANDEGENSKAPER',
    'FLUORESCENCE SUMMARY': 'FLUORESCENSSAMMANFATTNING',
    'Best match': 'Bästa matchning',
    'Primary': 'Primär',
    'Secondary': 'Sekundär',
    'Evidence': 'Evidens',
    'Broadband fluorescence detected': 'Bredbandsfluorescens detekterad',
    'Broad emission band': 'Brett emissionsband',
    'Band width': 'Bandbredd',
    'Asymmetry': 'Asymmetri',
    'Shoulder': 'Skuldra',
    'Integrated signal': 'Integrerad signal',
    'balanced': 'balanserad',
    'red-tailed': 'rödsvansad',
    'blue-tailed': 'blåsvansad',
    'No element ranking yet.': 'Ingen ämnesrankning ännu.',
    'No fluorescence summary yet.': 'Ingen fluorescenssammanfattning ännu.',

    'App': 'Läge',
    'Src': 'Källa',
    'Cam': 'Kamera',
    'Mods': 'Moduler',
    'Axis': 'Axel',
    'Norm': 'Norm',
    'Stripe': 'Remsa',
    'Cal': 'Kal',
    'Range': 'Omfång',
    'RefG': 'RefG',
    'Proc': 'Bearb',
    'HW': 'HW',
    'Signal': 'Signal',
    'Quality:': 'Kvalitet:',
    'Limit:': 'Begränsning:',
    'Avg/Dyn': 'Med/Dyn',
    'Base': 'Bas',
    'Headroom': 'Marginal',
    'Sat': 'Mättnad',
    'Peaks': 'Toppar',
    'Strong': 'Starka',
    'Hits/QC': 'Träffar/QC',
    'Peak Δ': 'Topp Δ',
    'Conf': 'Konf',
    'Noise σ': 'Brus σ',
    'SNR': 'SNR',
    'Res': 'Uppl',
    'Cov': 'Täckn',
    'Cal err': 'Kal-fel',
    'FWHM': 'FWHM',
    'Eff. R': 'Eff. R',
    'idle': 'väntar',
    'ready': 'klar',
    'camera': 'kamera',
    'image': 'bild',
    'on': 'på',
    'off': 'av',
    'yes': 'ja',
    'no': 'nej',
    'Raw': 'Rå',
    'Raw - Dark': 'Rå - mörk',
    'Difference': 'Differens',
    'Ratio': 'Kvot',
    'Transmittance %': 'Transmittans %',
    'Absorbance': 'Absorbans',

    'Describe what you have observed': 'Beskriv vad du har observerat',
    'Optional. Describe the light source, experiment, object, colour, pressure, gas, discharge or anything else that may help interpretation. You may write in any language; the AI response will use the same language when it can be identified, otherwise English.': 'Valfritt. Beskriv ljuskällan, experimentet, objektet, färgen, trycket, gasen, urladdningen eller annat som kan hjälpa tolkningen. Du kan skriva på valfritt språk; AI-svaret använder samma språk när det kan identifieras, annars engelska.',
    'Example: Low-pressure air plasma in a glass tube...': 'Exempel: Luftplasma vid lågt tryck i ett glasrör...',
    'Cancel': 'Avbryt',
    'New analysis': 'Ny analys',
    'Copy text': 'Kopiera text',
    'Text copied.': 'Text kopierad.',
    'Close': 'Stäng',
    'NEW': 'NYHET',
    'Open the SPECTRA PRO help guide.': 'Öppna SPECTRA PRO-hjälpen.',

    'CONTENTS': 'INNEHÅLL',
    'QUICK START': 'SNABBGUIDE',
    'WORKSPACE': 'ARBETSYTA',
    'CONTROLS': 'KONTROLLER',
    'STATUS & QUALITY': 'STATUS & KVALITET',
    'AI INTERPRETATION': 'AI-TOLKNING',
    'Q&A': 'FRÅGOR & SVAR',
    'SPECTRA PRO HELP': 'SPECTRA PRO HJÄLP',
    'Complete instrument and analysis guide': 'Komplett guide för instrument och analys',
    'Complete control, measurement, calibration and analysis reference': 'Komplett referens för kontroller, mätning, kalibrering och analys',
    'UI guide': 'UI-guide',
    'Recommended workflow:': 'Rekommenderat arbetsflöde:',
    'Quick Start': 'Snabbguide',
    'Workspace': 'Arbetsyta',
    'Controls': 'Kontroller',
    'Status & Quality': 'Status & kvalitet',
    'LAB & Presets': 'LAB & förval',
    'Q&A and troubleshooting': 'Frågor, svar och felsökning',
    'What SPECTRA PRO is designed to do': 'Vad SPECTRA PRO är utformat för',
    'The shortest reliable route from camera or image to an interpretable spectrum.': 'Den kortaste tillförlitliga vägen från kamera eller bild till ett tolkningsbart spektrum.',
    'What each region of the Recording page is for.': 'Vad varje del av mätsidan används till.',
    'Every main button, slider, checkbox and drop-down menu.': 'Varje viktig knapp, slider, kryssruta och flervalsmeny.',
    'Every field in the two right-hand diagnostic panels.': 'Varje fält i de två diagnostikpanelerna till höger.',
    'Pixel-to-wavelength calibration, shell points, files and fit diagnostics.': 'Kalibrering från pixel till våglängd, punkter, filer och anpassningsdiagnostik.',
    'Analysis settings, presets, Match Score columns and fluorescence output.': 'Analysinställningar, förval, Match Score-kolumner och fluorescensresultat.',
    'What is sent, what AI does, controls and limitations.': 'Vad som skickas, vad AI gör, kontroller och begränsningar.',
    'Common questions and troubleshooting.': 'Vanliga frågor och felsökning.',
    'Select the source': 'Välj källa',
    'Place the sampling stripe': 'Placera mätremsan',
    'Avoid clipping': 'Undvik klippning',
    'Calibrate': 'Kalibrera',
    'Choose the analysis physics': 'Välj rätt analysfysik',
    'Inspect evidence, not only the winner': 'Granska evidensen, inte bara vinnaren',
    'Use AI Interpretation last': 'Använd AI-tolkning sist',
    'Fast sanity check:': 'Snabb rimlighetskontroll:',
    'Source panel': 'Källpanel',
    'Spectrum graph': 'Spektrumgraf',
    'PRO dock': 'PRO-panel',
    'Diagnostics rail': 'Diagnostikpanel',
    'On-page console': 'Konsol på sidan',
    'Mode tabs': 'Lägesflikar',
    'Controls reference': 'Kontrollreferens',
    'Source-panel controls': 'Kontroller i källpanelen',
    'CORE graph and display controls': 'CORE-kontroller för graf och visning',
    'Long exposure popup': 'Popup för lång exponering',
    'Original calibration-side controls': 'Ursprungliga kalibreringskontroller',
    'Status & Data Quality': 'Status & datakvalitet',
    'STATUS describes application state and which supporting data are currently available.': 'STATUS beskriver applikationens tillstånd och vilka stöddata som finns tillgängliga.',
    'DATA QUALITY combines signal statistics, peak-detection information, LAB match diagnostics, calibration metrics and hardware metadata.': 'DATAKVALITET kombinerar signalstatistik, toppdetektion, LAB-matchningsdiagnostik, kalibreringsmått och hårdvarumetadata.',
    'Important:': 'Viktigt:',
    'Calibration terms': 'Kalibreringstermer',
    'Calibration points': 'Kalibreringspunkter',
    'Shell points': 'Shell-punkter',
    'Coefficients': 'Koefficienter',
    'Residual': 'Residual',
    'Cal err': 'Kal-fel',
    'Res (nm/px)': 'Uppl (nm/px)',
    'Recommended workflow': 'Rekommenderat arbetsflöde',
    'Preset guide': 'Guide till förval',
    'LAB controls': 'LAB-kontroller',
    'TOP HITS / MATCH SCORE': 'TOPPTRÄFFAR / MATCHNINGSPOÄNG',
    'MATCH SCORE columns': 'Kolumner i MATCH SCORE',
    'Fluorescent output': 'Fluorescensresultat',
    'Atomic / Gas Tube LAB': 'Atomic / Gas Tube LAB',
    'Fluorescent LAB': 'Fluorescent LAB',
    'AI dialog controls': 'Kontroller i AI-dialogen',
    'What is sent': 'Vad som skickas',
    'Interpretation rules': 'Tolkningsregler',
    'AI is not a second spectrometer.': 'AI är inte en andra spektrometer.',
    'Troubleshooting order': 'Felsökningsordning',
    'SCREENSHOT PLACEHOLDER': 'PLATS FÖR SKÄRMBILD',
    'Suggested file:': 'Föreslagen fil:',

    'Control': 'Kontroll',
    'Type': 'Typ',
    'What it does': 'Vad den gör',
    'How to interpret / use it': 'Hur den tolkas / används',
    'Field': 'Fält',
    'Meaning': 'Betydelse',
    'How to read it': 'Hur det ska läsas',
    'When it may be blank / not applicable': 'När det kan vara tomt / inte tillämpligt',
    'Button': 'Knapp',
    'Checkbox': 'Kryssruta',
    'Drop-down': 'Flervalsmeny',
    'Number input': 'Numeriskt fält',
    'Text input': 'Textfält',
    'Buttons + slider': 'Knappar + slider',
    'Optional slider': 'Valfri slider',
    'Read-only graph': 'Endast visning',
    'Read-only text': 'Endast visning',
    'Read-only panel': 'Endast visning',
    'Result column': 'Resultatkolumn',
    'View selector': 'Visningsval',
    'Collapse handle': 'Infällningshandtag',
    'Prompt buttons': 'Promptknappar',
    'Checkbox per row': 'Kryssruta per rad',
    'Button per row': 'Knapp per rad',
    'Number inputs': 'Numeriska fält',
    'File selector': 'Filväljare',
    'Text area': 'Textområde',
    'Button after result': 'Knapp efter resultat',
    'Fluorescent-only checkbox': 'Kryssruta endast för Fluorescent',

    'Why does the graph show pixels instead of nm?': 'Varför visar grafen pixlar i stället för nm?',
    'Why can the same peak match several elements?': 'Varför kan samma topp matcha flera grundämnen?',
    'Why does Score Share show 100% if the result is still uncertain?': 'Varför kan Score Share visa 100 % när resultatet fortfarande är osäkert?',
    'Why do I see many Peaks but few Hits?': 'Varför ser jag många toppar men få träffar?',
    'What does a high Peak Δ mean?': 'Vad betyder ett högt Topp Δ?',
    'Why is Headroom high but SNR poor?': 'Varför är marginalen stor men SNR dålig?',
    'Why can SNR look extremely high?': 'Varför kan SNR se extremt hög ut?',
    'Why did an old image identify the wrong gas?': 'Varför identifierade en gammal bild fel gas?',
    'What is the difference between Ref and RefG?': 'Vad är skillnaden mellan Ref och RefG?',
    'When should I use Weak peaks?': 'När ska jag använda Svaga toppar?',
    'Why does Fluorescent not show element Score Share?': 'Varför visar Fluorescent inte Score Share för grundämnen?',
    'Why is Narrow-line overlay off by default?': 'Varför är Smal linje-overlay avstängd som standard?',
    'Why is the LAB library button called Reload libraries?': 'Varför heter LAB-knappen Ladda om bibliotek?',
    'What does Ping worker do?': 'Vad gör Pinga worker?',
    'What should I do if LAB shows no result?': 'Vad gör jag om LAB inte visar något resultat?',
    'What should I do if the UI looks stale after an update?': 'Vad gör jag om UI:t verkar gammalt efter en uppdatering?'
  };

  const patterns = [
    [/^Best match:\s*/i, 'Bästa matchning: '],
    [/^Best class evidence:\s*/i, 'Bästa klassevidens: '],
    [/^Compatible range:\s*/i, 'Kompatibelt intervall: '],
    [/^Reasons:\s*/i, 'Skäl: '],
    [/^Conflicts:\s*/i, 'Konflikter: '],
    [/^Primary:\s*/i, 'Primär: '],
    [/^Secondary:\s*/i, 'Sekundär: '],
    [/^Preset:\s*/i, 'Förval: '],
    [/^Loading libraries(?:\.\.\.|…)?$/i, 'Laddar bibliotek…'],
    [/^Libraries ready\s*·\s*/i, 'Bibliotek klara · '],
    [/^Run\s+/i, 'Körning '],
    [/^No candidates/i, 'Inga kandidater'],
    [/^No hits/i, 'Inga träffar'],
    [/^Response-corrected relative intensity using[ ]*/i, 'Responskorrigerad relativ intensitet med '],
    [/^Selected response profile:[ ]*/i, 'Vald responsprofil: '],
    [/^Uncorrected relative intensity[.] Correction unavailable/i, 'Okorrigerad relativ intensitet. Korrigering ej tillgänglig'],
    [/^No measured bundled response profile is available[.]?$/i, 'Ingen uppmätt bunden responsprofil är tillgänglig.']
  ];

  function normalizeText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function translateValue(value) {
    const text = normalizeText(value);
    if (!text) return null;
    if (Object.prototype.hasOwnProperty.call(SV, text)) return SV[text];
    for (let i = 0; i < patterns.length; i += 1) {
      if (patterns[i][0].test(text)) return text.replace(patterns[i][0], patterns[i][1]);
    }
    return null;
  }

  function isSkipped(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !el.closest) return false;
    return !!el.closest('script,style,code,pre,#spAiResult,#spAiObservation,[data-i18n-skip="true"]');
  }

  function isHighFrequencyNode(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !el.closest) return false;
    try {
      return !!(el.matches && el.matches(HIGH_FREQUENCY_SELECTOR)) || !!el.closest(HIGH_FREQUENCY_SELECTOR);
    } catch (_) {
      return false;
    }
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3 || isSkipped(node)) return;
    const raw = node.nodeValue || '';
    const translated = translateValue(raw);
    if (!translated || normalizeText(raw) === translated) return;
    originalText.set(node, raw);
    const lead = (raw.match(/^\s*/) || [''])[0];
    const tail = (raw.match(/\s*$/) || [''])[0];
    node.nodeValue = lead + translated + tail;
  }

  function translateAttributes(el) {
    if (!el || el.nodeType !== 1 || isSkipped(el)) return;
    ['title', 'placeholder', 'aria-label'].forEach(function (attr) {
      if (!el.hasAttribute(attr)) return;
      const raw = el.getAttribute(attr) || '';
      const translated = translateValue(raw);
      if (!translated || normalizeText(raw) === translated) return;
      let saved = originalAttrs.get(el);
      if (!saved) { saved = {}; originalAttrs.set(el, saved); }
      saved[attr] = raw;
      el.setAttribute(attr, translated);
    });
  }

  function translateTree(root) {
    if (!root || currentLanguage !== 'sv') return;
    applying = true;
    try {
      if (root.nodeType === 1) translateAttributes(root);
      if (root.nodeType === 3) translateTextNode(root);
      const doc = root.ownerDocument || global.document;
      if (!doc || !doc.createTreeWalker) return;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.currentNode;
      while (node) {
        if (node.nodeType === 1) translateAttributes(node);
        else if (node.nodeType === 3) translateTextNode(node);
        node = walker.nextNode();
      }
    } finally {
      applying = false;
    }
  }

  function restoreTree(root) {
    if (!root) return;
    applying = true;
    try {
      const doc = root.ownerDocument || global.document;
      if (!doc || !doc.createTreeWalker) return;
      const restoreNode = function (node) {
        if (node.nodeType === 3 && originalText.has(node)) {
          node.nodeValue = originalText.get(node);
        } else if (node.nodeType === 1) {
          const saved = originalAttrs.get(node);
          if (saved) Object.keys(saved).forEach(function (attr) { node.setAttribute(attr, saved[attr]); });
        }
      };
      restoreNode(root);
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) { restoreNode(node); node = walker.nextNode(); }
    } finally {
      applying = false;
    }
  }

  function roots() {
    const list = [];
    const app = global.document && global.document.getElementById('appContainer');
    if (app) list.push(app);
    ['spHelpOverlay', 'spAiInterpretModal', 'spCalibrationPrompt'].forEach(function (id) {
      const el = global.document && global.document.getElementById(id);
      if (el) list.push(el);
    });
    return list;
  }

  function stopObservers() {
    if (uiObserver) uiObserver.disconnect();
    if (bodyObserver) bodyObserver.disconnect();
  }

  function startObservers() {
    stopObservers();
    if (typeof MutationObserver === 'undefined' || currentLanguage !== 'sv') return;

    uiObserver = new MutationObserver(function (mutations) {
      if (applying || currentLanguage !== 'sv') return;
      mutations.forEach(function (m) {
        // Status, Data Quality and LAB result panes are rebuilt frequently while a
        // live source is running. They are translated explicitly by their renderers
        // instead of recursively walking every mutation here.
        if (isHighFrequencyNode(m.target)) return;
        if (m.type === 'characterData') {
          if (!isHighFrequencyNode(m.target)) translateTextNode(m.target);
          return;
        }
        if (m.type === 'childList') {
          m.addedNodes.forEach(function (node) {
            if (!isHighFrequencyNode(node)) translateTree(node);
          });
          return;
        }
        if (m.type === 'attributes' && !isHighFrequencyNode(m.target)) translateAttributes(m.target);
      });
    });

    const app = global.document.getElementById('appContainer');
    if (app) uiObserver.observe(app, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
    ['spHelpOverlay', 'spAiInterpretModal', 'spCalibrationPrompt'].forEach(function (id) {
      const el = global.document.getElementById(id);
      if (el) uiObserver.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
    });

    bodyObserver = new MutationObserver(function (mutations) {
      if (applying || currentLanguage !== 'sv') return;
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (!node || node.nodeType !== 1) return;
          const id = node.id || '';
          if (id === 'spHelpOverlay' || id === 'spAiInterpretModal' || id === 'spCalibrationPrompt') {
            translateTree(node);
            uiObserver.observe(node, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
          }
        });
      });
    });
    if (global.document.body) bodyObserver.observe(global.document.body, { childList: true });
  }

  function updateSwitch() {
    const wrap = global.document && global.document.getElementById(SWITCH_ID);
    if (!wrap) return;
    wrap.querySelectorAll('button[data-lang]').forEach(function (btn) {
      const active = btn.dataset.lang === currentLanguage;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setLanguage(lang) {
    const next = String(lang || '').toLowerCase() === 'sv' ? 'sv' : 'en';
    if (next === currentLanguage) { updateSwitch(); return; }
    stopObservers();
    currentLanguage = next;
    if (global.document && global.document.documentElement) global.document.documentElement.lang = next;

    if (next === 'sv') {
      roots().forEach(translateTree);
      global.document.title = 'SpectraPRO - Spectroscopy';
      startObservers();
    } else {
      roots().forEach(restoreTree);
      global.document.title = 'SpectraPRO - Spectroscopy';
    }
    updateSwitch();
    try {
      if (sp.eventBus && typeof sp.eventBus.emit === 'function') sp.eventBus.emit('language:changed', { language: next });
    } catch (_) {}
  }

  function installStyle() {
    if (!global.document || global.document.getElementById(STYLE_ID)) return;
    const style = global.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#SpectraProDockHost #spTabs #spLanguageSwitch{margin-left:auto!important;display:inline-flex!important;align-items:stretch!important;border:1px solid rgba(16,185,129,.85)!important;border-bottom:0!important;border-radius:8px 8px 0 0!important;overflow:hidden!important;background:#071b36!important;height:auto!important;}',
      '#SpectraProDockHost #spTabs #spLanguageSwitch button{min-width:31px!important;border:0!important;border-right:1px solid rgba(16,185,129,.42)!important;border-radius:0!important;background:#071b36!important;color:#82cfc0!important;padding:6px 7px!important;font:700 10px/1.1 system-ui,-apple-system,Segoe UI,sans-serif!important;cursor:pointer!important;}',
      '#SpectraProDockHost #spTabs #spLanguageSwitch button:last-child{border-right:0!important;}',
      '#SpectraProDockHost #spTabs #spLanguageSwitch button.is-active{background:#0d2e5f!important;color:#b6fff3!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)!important;}',
      '#SpectraProDockHost #spTabs #spLanguageSwitch button:hover{background:#114064!important;color:#e9fffb!important;}',
      '#SpectraProDockHost #spTabs #spHelpLaunch{margin-left:5px!important;}',
      'html[lang="sv"] #SpectraProDockHost .sp-field,html[lang="sv"] #SpectraProDockHost button,html[lang="sv"] #SpectraProDockHost label{min-width:0;}',
      'html[lang="sv"] #SpectraProDockHost button{white-space:normal;}',
      '@media(max-width:760px){#SpectraProDockHost #spTabs #spLanguageSwitch button{min-width:28px!important;padding:5px 6px!important;}#SpectraProDockHost #spTabs #spHelpLaunch{margin-left:3px!important;}}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function ensureSwitch() {
    if (!global.document) return false;
    const tabs = global.document.getElementById('spTabs');
    if (!tabs) return false;
    let wrap = global.document.getElementById(SWITCH_ID);
    if (!wrap) {
      wrap = global.document.createElement('div');
      wrap.id = SWITCH_ID;
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Interface language');
      wrap.innerHTML = '<button type="button" data-lang="en" aria-pressed="true" title="English interface">EN</button><button type="button" data-lang="sv" aria-pressed="false" title="Swedish interface">SV</button>';
      wrap.addEventListener('click', function (event) {
        const btn = event.target && event.target.closest ? event.target.closest('button[data-lang]') : null;
        if (!btn) return;
        setLanguage(btn.dataset.lang);
      });
    }
    const help = global.document.getElementById('spHelpLaunch');
    if (help && help.parentElement === tabs) tabs.insertBefore(wrap, help);
    else if (wrap.parentElement !== tabs) tabs.appendChild(wrap);
    updateSwitch();
    return true;
  }

  function install() {
    if (!global.document) return;
    currentLanguage = 'en';
    global.document.documentElement.lang = 'en';
    installStyle();
    [0, 80, 180, 350, 700, 1200, 2000].forEach(function (delay) {
      global.setTimeout(ensureSwitch, delay);
    });
  }

  sp.i18n = {
    version: VERSION,
    getLanguage: function () { return currentLanguage; },
    setLanguage: setLanguage,
    translateValue: translateValue,
    translateSubtree: function (root) {
      if (currentLanguage === 'sv' && root) translateTree(root);
    },
    refresh: function () { if (currentLanguage === 'sv') roots().forEach(translateTree); },
    ensureSwitch: ensureSwitch
  };

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(window);
