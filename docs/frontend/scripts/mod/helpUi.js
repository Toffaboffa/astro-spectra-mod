(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const HELP_VERSION = '2.2.1';
  let installed = false;
  let lastFocus = null;

  function $(id) { return global.document ? global.document.getElementById(id) : null; }

  function plannedShot(title, description, suggestedName) {
    return '<figure class="sp-help-shot">' +
      '<div class="sp-help-shot__frame">' +
        '<div class="sp-help-shot__badge">SCREENSHOT PLACEHOLDER</div>' +
        '<strong>' + title + '</strong>' +
        '<span>' + description + '</span>' +
        (suggestedName ? '<small>Suggested file: ' + suggestedName + '</small>' : '') +
      '</div>' +
    '</figure>';
  }

  const tabs = [
    { id: 'contents', label: 'CONTENTS' },
    { id: 'quick', label: 'QUICK START' },
    { id: 'workspace', label: 'WORKSPACE' },
    { id: 'calibration', label: 'CALIBRATION' },
    { id: 'lab', label: 'LAB & PRESETS' },
    { id: 'ai', label: 'AI INTERPRETATION' },
    { id: 'qa', label: 'Q&A' }
  ];

  function tocCard(tab, number, title, text) {
    return '<button type="button" class="sp-help-toc-card" data-help-go="' + tab + '">' +
      '<span class="sp-help-toc-card__n">' + number + '</span><span><b>' + title + '</b><small>' + text + '</small></span>' +
    '</button>';
  }

  function contentsHtml() {
    return '<div class="sp-help-hero">' +
      '<div><div class="sp-help-kicker">SPECTRA PRO HELP</div><h1>Instrument, analysis and interpretation guide</h1>' +
      '<p>Start here for the measurement workflow, calibration, LAB analysis, fluorescence, AI interpretation and common troubleshooting. The help system describes the current SPECTRA PRO interface rather than the historical project notes.</p></div>' +
      '<div class="sp-help-version">UI guide<br><b>v' + HELP_VERSION + '</b></div>' +
    '</div>' +
    '<div class="sp-help-callout"><b>Recommended workflow:</b> acquire a clean spectrum → calibrate → choose the analysis preset that matches the source type → inspect data quality and pattern evidence → use AI Interpretation as a final interpretation layer.</div>' +
    '<div class="sp-help-toc">' +
      tocCard('quick', '01', 'Quick Start', 'A short end-to-end workflow for camera or image measurements.') +
      tocCard('workspace', '02', 'Workspace', 'Source panel, graph, CORE/HARDWARE/CALIBRATE/LAB/ASTRO dock, Status and Data Quality.') +
      tocCard('calibration', '03', 'Calibration', 'Pixel-to-wavelength calibration, calibration files, axis switching and practical checks.') +
      tocCard('lab', '04', 'LAB & Presets', 'Atomic, Molecular, Gas Tube, Flame, Fluorescent, match scores and analysis controls.') +
      tocCard('ai', '05', 'AI Interpretation', 'What is sent, how to write observations, how to read the answer and what AI cannot prove.') +
      tocCard('qa', '06', 'Q&A', 'Answers to common questions and a compact troubleshooting checklist.') +
    '</div>' +
    '<section class="sp-help-section"><h2>What SPECTRA PRO is designed to do</h2>' +
      '<p>SPECTRA PRO combines the original camera/stripe spectrum workflow with calibration, data-quality diagnostics and optional LAB analysis. It can work with a live camera or a loaded image. LAB analysis is intended to help identify spectral patterns, not to turn every wavelength coincidence into a chemical conclusion.</p>' +
      '<p>The analysis path depends on the source. Narrow atomic line spectra are handled differently from molecular bands and broad fluorescence. This distinction matters: a broad fluorescent band should be characterized by its shape, while a gas discharge spectrum is better described by coherent groups of narrow lines.</p>' +
    '</section>' +
    plannedShot('Full application overview', 'Show the entire SPECTRA PRO window with the source panel on the left, spectrum graph at the top, PRO dock below the graph, and Status/Data Quality on the right. Use a calibrated spectrum so the wavelength axis is visible.', 'help-overview.png');
  }

  function step(n, title, text) {
    return '<div class="sp-help-step"><span>' + n + '</span><div><h3>' + title + '</h3><p>' + text + '</p></div></div>';
  }

  function quickHtml() {
    return '<section class="sp-help-section"><h2>Quick Start</h2><p>This is the shortest reliable route from a light source to an interpretable spectrum.</p></section>' +
    '<div class="sp-help-steps">' +
      step('1', 'Select a source', 'Use a live camera or press <b>Load Image</b>. For live work, confirm that the source is visible and the camera is not saturated.') +
      step('2', 'Place the sampling stripe', 'Move <b>Stripe Place</b> through the part of the image that contains the spectrum. Increase <b>Stripe Width</b> only when averaging more rows improves signal stability without mixing unwanted background.') +
      step('3', 'Calibrate the wavelength axis', 'Load a calibration file or create/apply calibration points in <b>CALIBRATE</b>. A wavelength-based analysis should not be trusted until the graph axis is in nm and the calibration is appropriate for the current optical geometry.') +
      step('4', 'Check the graph and data quality', 'Avoid clipping, confirm useful dynamic range, and inspect Status/Data Quality. A clean curve and stable calibration are more valuable than a large number of speculative matches.') +
      step('5', 'Choose the correct LAB preset', '<b>Atomic</b> for narrow atomic lines, <b>Gas Tube</b> for discharge tubes, <b>Molecular</b> for band patterns, <b>Flame</b> for flame-type spectra, and <b>Fluorescent</b> for broad fluorescence.') +
      step('6', 'Interpret pattern evidence', 'Use Top Hits / Match Score for line-oriented presets. In Fluorescent mode, use Band Features / Fluorescence Summary instead. Score Share is a relative ranking metric, not probability or concentration.') +
      step('7', 'Use AI Interpretation last', 'Add a short observation describing the source or experiment. AI receives the compact measurement and SPECTRA analysis, then explains the result. It should support interpretation, not replace calibration or measurement quality.') +
    '</div>' +
    '<section class="sp-help-section"><h3>Fast checks before trusting a result</h3><ul>' +
      '<li>The wavelength axis is calibrated for the current setup.</li><li>No important peak is clipped at the camera maximum.</li><li>The preset matches the type of source you are measuring.</li><li>The strongest conclusion is supported by a pattern, not one isolated coincidence.</li><li>If the source is broad fluorescence, do not interpret atomic Score Share as the main result.</li>' +
    '</ul></section>' +
    plannedShot('Quick-start measurement', 'Show a simple calibrated gas-tube measurement with the sampling stripe placed across the spectrum, the graph in nm, LAB open, and a clear Best match result.', 'help-quick-start.png');
  }

  function infoCard(title, html) {
    return '<article class="sp-help-card"><h3>' + title + '</h3>' + html + '</article>';
  }

  function workspaceHtml() {
    return '<section class="sp-help-section"><h2>Workspace</h2><p>The Recording page is divided into four practical areas: source acquisition, the spectrum graph, the PRO dock and diagnostics.</p></section>' +
    '<div class="sp-help-grid2">' +
      infoCard('Source panel', '<p>The left panel contains the live camera or loaded image, Source/Dark/Ref views, stripe controls, exposure controls where supported, image loading and reference/dark capture controls.</p><p><b>Source</b> is the spectrum currently being measured. <b>Dark</b> and <b>Ref</b> are supporting measurements used by processing modes and comparison workflows.</p>') +
      infoCard('Spectrum graph', '<p>The graph shows intensity against pixels or wavelength. Once calibrated, switching to nm makes spectral features physically interpretable. CORE contains graph scaling, fill, peak and reference-line controls.</p><p>Do not confuse a visually strong peak with a uniquely identified species. Identification depends on wavelength accuracy and pattern evidence.</p>') +
      infoCard('PRO dock', '<p><b>CORE</b> contains general graph and display controls. <b>HARDWARE</b> holds instrument metadata. <b>CALIBRATE</b> manages calibration information. <b>LAB</b> contains spectral analysis. <b>ASTRO</b> is the astronomy-oriented workspace and may expose staged functionality depending on build.</p>') +
      infoCard('Status & Data Quality', '<p>The right rail summarizes current app mode, worker state, source, calibration, processing mode and analysis settings. Data Quality reports signal range, headroom, saturation, peak counts, wavelength coverage and related QC information.</p>') +
    '</div>' +
    '<section class="sp-help-section"><h3>CORE</h3><p>CORE is the safe baseline instrument mode. Camera acquisition, stripe sampling and graph rendering remain usable even if worker-based LAB analysis is unavailable. Use CORE when you want to inspect or export the spectrum without automated identification.</p></section>' +
    '<section class="sp-help-section"><h3>HARDWARE</h3><p>Hardware metadata gives analysis and exports context about the spectrometer. Resolution, spectral range, pixel resolution and grating information can matter when judging whether nearby lines are physically distinguishable.</p></section>' +
    '<section class="sp-help-section"><h3>CALIBRATE</h3><p>Calibration maps detector pixels to wavelength. See the CALIBRATION help tab for the recommended workflow and common failure modes.</p></section>' +
    '<section class="sp-help-section"><h3>LAB</h3><p>LAB starts the analysis worker, loads the line libraries automatically on first entry, and exposes source-specific presets. The worker runs separately so the live interface remains responsive.</p></section>' +
    plannedShot('Workspace anatomy', 'Show a numbered full-window screenshot: 1 Source panel, 2 spectrum graph, 3 PRO mode tabs, 4 analysis/control area, 5 Status, 6 Data Quality, 7 HELP button.', 'help-workspace-anatomy.png');
  }

  function calibrationHtml() {
    return '<section class="sp-help-section"><h2>Calibration</h2><p>Calibration is the bridge between image pixels and physical wavelength. A convincing match score cannot rescue the wrong wavelength scale.</p></section>' +
    '<section class="sp-help-section"><h3>Recommended workflow</h3><ol>' +
      '<li>Use a calibration source with known spectral features and the same optical geometry used for the measurement.</li>' +
      '<li>Load an existing calibration file or enter/apply calibration points in <b>CALIBRATE</b>.</li>' +
      '<li>Confirm that SPECTRA reports a calibrated state and that the expected wavelength range looks plausible.</li>' +
      '<li>Switch the graph x-axis to wavelength (nm).</li>' +
      '<li>Check known lines across the range, not only at one wavelength. A calibration can look good near one anchor and drift elsewhere.</li>' +
    '</ol></section>' +
    '<div class="sp-help-callout sp-help-callout--warn"><b>Loaded images:</b> an old spectrum image may have been recorded with a different camera resolution, crop, grating position or optical geometry. Reusing a calibration from another setup can shift every apparent wavelength while leaving the graph visually convincing.</div>' +
    '<section class="sp-help-section"><h3>The startup calibration prompt</h3><p>If no calibration is active, SPECTRA can ask whether you want to load a calibration file. Choosing <b>Yes</b> opens the calibration-file workflow. After calibration, SPECTRA may offer to switch the x-axis to wavelength.</p></section>' +
    '<section class="sp-help-section"><h3>What to inspect</h3><dl class="sp-help-dl">' +
      '<dt>Calibration points</dt><dd>Known pixel ↔ wavelength anchors used by the fit.</dd>' +
      '<dt>Coefficients</dt><dd>The polynomial mapping used by the original SPECTRA calibration engine.</dd>' +
      '<dt>Residuals</dt><dd>Differences between fitted and known calibration wavelengths. Small residuals across the useful range are preferable to one perfect anchor.</dd>' +
      '<dt>Spectral range</dt><dd>The wavelength interval covered by the calibrated frame. Make sure it matches the physical instrument.</dd>' +
    '</dl></section>' +
    plannedShot('Calibration workflow', 'Show the CALIBRATE tab with a loaded multi-point calibration, the graph x-axis in nm, and the Status rail confirming calibration. If possible, include the calibration residual/quality information.', 'help-calibration.png');
  }

  function preset(name, bestFor, description) {
    return '<article class="sp-help-card sp-help-card--preset"><h3>' + name + '</h3><b>' + bestFor + '</b><p>' + description + '</p></article>';
  }

  function labHtml() {
    return '<section class="sp-help-section"><h2>LAB & Presets</h2><p>LAB adds automated matching and source-specific analysis on top of the measured spectrum. The spectral libraries load automatically the first time LAB is opened. The manual button becomes <b>Reload libraries</b> after a successful load.</p></section>' +
    '<section class="sp-help-section"><h3>Choose the preset by physics, not by the answer you hope to get</h3>' +
      '<div class="sp-help-preset-grid">' +
        preset('Atomic', 'Narrow atomic emission lines.', 'Uses curated multi-line atomic fingerprints for H, He, Ne, Ar, Kr, Xe, Hg and supporting library matches. Best for spectra dominated by discrete lines.') +
        preset('Gas Tube', 'Discharge tubes and mixed gas-like spectra.', 'Uses atomic fingerprint evidence with source-family restrictions appropriate to common discharge-tube work. Molecular contributions can still coexist.') +
        preset('Molecular', 'Band systems rather than isolated atomic lines.', 'Treats molecular evidence as patterns. Several consistent bands are stronger evidence than one coincident wavelength.') +
        preset('Flame', 'Flame and mixed-emitter spectra.', 'Allows common flame emitters plus relevant molecular/background contributors. Interpret with caution when the continuum is strong.') +
        preset('Fluorescent', 'Broad fluorescence.', 'Uses broadband shape metrics: λmax, centroid, FWHM, band width, asymmetry, shoulders and integrated signal. Atomic labels are hidden by default.') +
        preset('Base presets', 'Nearest / Wide / Tight / Fast / Lamp.', 'Simpler local line-matching tools. Useful for manual inspection and fast feedback, but they do not provide the same fingerprint refinement as Smart presets.') +
      '</div>' +
    '</section>' +
    '<section class="sp-help-section"><h3>Core LAB controls</h3><dl class="sp-help-dl">' +
      '<dt>Analyze</dt><dd>Turns live LAB processing on or off.</dd>' +
      '<dt>Max Hz</dt><dd>Limits analysis frequency so worker processing does not overwhelm the UI.</dd>' +
      '<dt>Peak threshold</dt><dd>Controls how strong a feature must be before it is treated as a peak. Lower values admit weaker features and more noise.</dd>' +
      '<dt>Peak distance</dt><dd>Minimum separation between detected peaks in the detector domain.</dd>' +
      '<dt>Max distance (nm)</dt><dd>Hard wavelength mismatch cap for line matching. Tight values reject more candidates; loose values create more coincidences.</dd>' +
      '<dt>Weak peaks</dt><dd>Allows weaker detected features into analysis. Useful when a real pattern contains weak support lines, but it can increase accidental matches.</dd>' +
      '<dt>Stable hits</dt><dd>Uses rolling stability to reduce frame-to-frame flicker in live measurements.</dd>' +
      '<dt>Smart find</dt><dd>Shows the refined analysis grouping rather than a flat list of raw line coincidences.</dd>' +
      '<dt>Strong Peak</dt><dd>Adjusts how much the Smart scorer rewards agreement with the strongest observed features.</dd>' +
    '</dl></section>' +
    '<section class="sp-help-section"><h3>How to read Match Score</h3><p><b>Score Share is a relative ranking inside the current candidate set.</b> It is not probability, concentration or abundance. A 100% Score Share can simply mean that only one candidate survived with a positive score.</p>' +
      '<p>For atomic fingerprints, look at the number of diagnostic lines found, missed profile lines, wavelength residuals and coverage of the measured peaks. Several coherent features are stronger than one extremely close line.</p></section>' +
    '<section class="sp-help-section"><h3>Fluorescent mode</h3><p>Fluorescent mode deliberately suppresses the normal atom-ranking view. The main output is <b>BAND FEATURES</b> and <b>FLUORESCENCE SUMMARY</b>. A broad molecular fluorescence band cannot be uniquely identified as a specific fluorophore from band shape alone unless an appropriate reference-spectrum system is available.</p>' +
      '<p><b>Narrow-line overlay</b> is off by default. Enable it only when you have a reason to inspect narrow contamination, lamp leakage or another line source superimposed on the broad fluorescence.</p></section>' +
    plannedShot('Atomic / Gas Tube analysis', 'Show LAB with a known gas spectrum, Smart find enabled, several labelled lines, and MATCH SCORE with the primary and secondary candidates visible.', 'help-lab-atomic.png') +
    plannedShot('Fluorescence analysis', 'Show a broad fluorescent spectrum with Fluorescent preset selected, BAND FEATURES and FLUORESCENCE SUMMARY visible, and Narrow-line overlay switched off.', 'help-lab-fluorescence.png');
  }

  function aiHtml() {
    return '<section class="sp-help-section"><h2>AI Interpretation</h2><p>AI Interpretation is the final explanation layer. SPECTRA performs the measurement, calibration and local analysis first. The AI receives a compact text/data package and explains that evidence in the language used in your observation when the language can be identified.</p></section>' +
    '<section class="sp-help-section"><h3>What is sent</h3><ul>' +
      '<li>Your optional observation text.</li><li>Relevant LAB settings and preset.</li><li>Calibration state, points/coefficient context and spectral range.</li><li>Data-quality information and QC flags.</li><li>Compact spectral trace data, preserving the measured curve shape.</li><li>Detected features and SPECTRA candidates for line/band modes.</li><li>Broadband fluorescence metrics in Fluorescent mode.</li>' +
    '</ul><p>SPECTRA does not need to send a screenshot of the graph for normal AI Interpretation. The model receives the measurement data and analysis context directly.</p></section>' +
    '<section class="sp-help-section"><h3>What to write in “Describe what you have observed”</h3><p>Keep it factual. Useful context includes the light source, gas or sample, colour, excitation method, pressure, discharge conditions, optical filters, whether the sample is known or unknown, and anything unusual during acquisition.</p>' +
      '<div class="sp-help-example"><b>Good:</b> “Unknown discharge tube viewed through the spectrometer. Stable orange-red emission. No filter.”</div>' +
      '<div class="sp-help-example"><b>Good:</b> “Fluorescein dissolved in water and illuminated with a UV lamp.”</div>' +
      '<div class="sp-help-example"><b>Less useful:</b> “Tell me what this is.”</div>' +
    '</section>' +
    '<section class="sp-help-section"><h3>How to read the answer</h3><p>The AI is instructed to distinguish measured features, SPECTRA rankings and physical interpretation. It should mention uncertainty when evidence is sparse, calibration is weak, candidates conflict, or important expected features are missing.</p>' +
      '<p>For atomic fingerprints it should prefer coherent multi-line evidence over isolated coincidences. For Fluorescent mode it should interpret the broad band shape and must not treat hidden narrow-line coincidences as proof of sample composition.</p></section>' +
    '<section class="sp-help-section"><h3>Controls after a response</h3><dl class="sp-help-dl">' +
      '<dt>Copy text</dt><dd>Copies the rendered AI interpretation. The confirmation toast appears over the popup and does not change the layout.</dd>' +
      '<dt>New analysis</dt><dd>Clears the displayed answer and prepares a genuinely new request.</dd>' +
      '<dt>Run information</dt><dd>The verification line can show run ID, OpenAI response ID, prompt contract and token usage. This makes it possible to confirm that a response came from a new request.</dd>' +
    '</dl></section>' +
    '<div class="sp-help-callout sp-help-callout--warn"><b>Important:</b> AI Interpretation cannot turn weak or wrongly calibrated data into a reliable identification. It can explain the evidence supplied to it, not create missing spectral information.</div>' +
    plannedShot('AI Interpretation workflow', 'Show the AI popup before analysis with an example observation, then a second screenshot after analysis showing the response, Copy text / New analysis controls and run/token verification line.', 'help-ai-interpretation.png');
  }

  function qa(question, answer) {
    return '<details class="sp-help-qa"><summary>' + question + '</summary><p>' + answer + '</p></details>';
  }

  function qaHtml() {
    return '<section class="sp-help-section"><h2>Q&A and Troubleshooting</h2><p>Common questions from normal measurement and analysis work.</p></section>' +
      qa('Why does SPECTRA find the “wrong” element?', 'First check calibration and preset choice. A large atomic library contains many nearby line coincidences. Smart Atomic and Gas Tube therefore use multi-line fingerprints, but a sparse or shifted spectrum can still be ambiguous. Inspect the complete pattern, not just the closest line.') +
      qa('Why can a candidate show 100% Score Share?', 'Score Share is normalized across the positive candidates that survived the current analysis. If only one candidate remains, it can receive 100% even when pattern coverage is incomplete. Read the evidence and missed-feature information as well.') +
      qa('Why are there no atomic labels in Fluorescent mode?', 'That is intentional. Fluorescent mode is broadband-first. Atomic coincidences are hidden because they can be misleading inside a broad molecular band. Enable Narrow-line overlay only when you specifically want to inspect possible narrow contamination or lamp leakage.') +
      qa('Why does the fluorescence result not identify my dye by name?', 'Band shape alone is usually not unique enough. SPECTRA reports λmax, centroid, FWHM, band width, asymmetry and shoulders. Unique fluorophore identification would require an appropriate reference-spectrum library and experimental context.') +
      qa('Why are libraries loading when I open LAB?', 'This is normal. SPECTRA automatically initializes its spectral libraries on first LAB entry. Once ready, the button changes to Reload libraries for manual recovery or refresh.') +
      qa('Why do I get no LAB hits?', 'Check that LAB analysis is on, libraries are ready, the graph is calibrated in nm, Source preview is active, and Max distance is not unrealistically tight. Then check Peak threshold and Peak distance.') +
      qa('Should I lower Max distance until the expected gas wins?', 'No. Use Max distance as an instrument/analysis tolerance, not as a way to force the desired answer. If a known sample fails under reasonable calibration and tolerance, investigate calibration, image geometry, signal quality or the fingerprint model.') +
      qa('Why can the same image give a different result with another preset?', 'Presets ask different physical questions. Atomic searches for coherent atomic line patterns; Gas Tube constrains the source family; Molecular uses band evidence; Fluorescent measures broad-band shape. Different results can therefore be legitimate.') +
      qa('Can intensity be used as concentration?', 'Not directly. Camera response, exposure, optical throughput, saturation, sample geometry and transition physics all affect measured intensity. Score Share is also not abundance. Quantitative concentration work requires a dedicated calibrated method.') +
      qa('Why does AI give almost the same answer twice?', 'If the measurement and analysis data are unchanged, a stable scientific interpretation should also remain similar. Use the run/response IDs to confirm whether a new API request actually occurred.') +
      qa('What should I do with an old spectrum image?', 'Treat its calibration as part of the original optical setup. If camera resolution, crop, grating position or geometry changed, current calibration may not apply. Recalibrate or use calibration information recorded with that image.') +
      qa('What does saturation mean?', 'A saturated detector value has hit the camera or processing ceiling, so the true peak intensity is unknown. Saturation can distort peak shape and relative intensity. Reduce exposure or light level when possible.') +
      '<section class="sp-help-section"><h3>Compact troubleshooting checklist</h3><ol>' +
        '<li>Confirm source and sampling stripe.</li><li>Confirm calibration and nm axis.</li><li>Check saturation, headroom and signal quality.</li><li>Choose a physically appropriate preset.</li><li>Confirm libraries are ready in LAB.</li><li>Inspect peak threshold, peak distance and Max distance.</li><li>Judge patterns, not isolated line labels.</li><li>Use AI Interpretation only after the above checks.</li>' +
      '</ol></section>' +
      plannedShot('Troubleshooting example', 'Show a LAB screen with Status and Data Quality visible and highlight the fields a user should inspect when analysis gives no result: calibration, libraries/worker, preset, peak threshold, Max distance, saturation and peak count.', 'help-troubleshooting.png');
  }

  function tabHtml(id) {
    if (id === 'contents') return contentsHtml();
    if (id === 'quick') return quickHtml();
    if (id === 'workspace') return workspaceHtml();
    if (id === 'calibration') return calibrationHtml();
    if (id === 'lab') return labHtml();
    if (id === 'ai') return aiHtml();
    return qaHtml();
  }

  function installStyle() {
    if (!global.document || $('spHelpStyle')) return;
    const style = global.document.createElement('style');
    style.id = 'spHelpStyle';
    style.textContent = [
      '.sp-help-launch{margin-left:auto;align-self:center;border:1px solid #18b9c6;background:#08243a;color:#9af3f7;border-radius:4px;padding:5px 12px;font-size:11px;font-weight:800;letter-spacing:.06em;cursor:pointer;line-height:1.1;box-shadow:inset 0 0 0 1px rgba(27,193,207,.08);}',
      '.sp-help-launch:hover,.sp-help-launch:focus-visible{background:#0d3651;color:#fff;outline:none;box-shadow:0 0 0 2px rgba(43,220,230,.18);}',
      '.sp-help-launch__q{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:50%;margin-right:6px;font-size:10px;}',
      'body.sp-help-open{overflow:hidden;}',
      '.sp-help-overlay{position:fixed;inset:0;z-index:65000;background:rgba(0,8,17,.78);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:3vh 3vw;}',
      '.sp-help-dialog{width:min(1480px,94vw);height:min(930px,90vh);background:#071a2b;border:1px solid #26b8c6;border-radius:10px;box-shadow:0 24px 80px rgba(0,0,0,.55),0 0 0 1px rgba(64,221,229,.08);display:flex;flex-direction:column;overflow:hidden;color:#d9eef3;font-family:inherit;}',
      '.sp-help-head{display:flex;align-items:center;gap:14px;padding:14px 18px;background:#082236;border-bottom:1px solid rgba(56,203,216,.34);}',
      '.sp-help-head__title{font-size:17px;font-weight:850;color:#a2f4f7;letter-spacing:.04em;}',
      '.sp-help-head__sub{font-size:11px;color:#81aab5;margin-top:2px;}',
      '.sp-help-close{margin-left:auto;border:0;background:transparent;color:#b9dce3;font-size:26px;line-height:1;cursor:pointer;padding:2px 8px;border-radius:5px;}',
      '.sp-help-close:hover,.sp-help-close:focus-visible{background:#10354a;color:#fff;outline:none;}',
      '.sp-help-tabs{display:flex;gap:3px;overflow-x:auto;padding:8px 12px 0;background:#071a2b;border-bottom:1px solid rgba(43,180,195,.22);scrollbar-width:thin;}',
      '.sp-help-tab{flex:0 0 auto;border:1px solid #168a9a;border-bottom:0;background:#09253a;color:#66ced6;padding:7px 12px;border-radius:5px 5px 0 0;font-size:10px;font-weight:800;letter-spacing:.035em;cursor:pointer;}',
      '.sp-help-tab:hover{color:#dfffff;background:#0c3149;}',
      '.sp-help-tab.is-active{background:#0d3b50;color:#91f3f2;border-color:#25bcc7;box-shadow:inset 0 -2px 0 #44d5dc;}',
      '.sp-help-body{flex:1;overflow:auto;padding:22px 26px 34px;scrollbar-color:#2c8290 #061522;}',
      '.sp-help-panel{max-width:1220px;margin:0 auto;}',
      '.sp-help-panel[hidden]{display:none!important;}',
      '.sp-help-hero{display:flex;gap:24px;justify-content:space-between;align-items:flex-start;padding:4px 0 16px;border-bottom:1px solid rgba(74,177,190,.18);}',
      '.sp-help-hero h1{margin:3px 0 8px;font-size:27px;line-height:1.15;color:#f0fdff;}',
      '.sp-help-hero p{max-width:850px;margin:0;color:#a8c8d0;line-height:1.6;font-size:13px;}',
      '.sp-help-kicker{font-size:10px;color:#53d9e0;font-weight:850;letter-spacing:.13em;}',
      '.sp-help-version{min-width:95px;text-align:center;border:1px solid #24566a;border-radius:7px;padding:10px;color:#86adb8;background:#071624;font-size:10px;}',
      '.sp-help-version b{display:block;color:#a9f5f6;font-size:15px;margin-top:2px;}',
      '.sp-help-callout{margin:18px 0;padding:11px 13px;border-left:3px solid #35c7d1;background:#0b2638;color:#b9d8df;font-size:12px;line-height:1.55;}',
      '.sp-help-callout--warn{border-left-color:#e7c44b;background:#292513;color:#e6ddb9;}',
      '.sp-help-toc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 24px;}',
      '.sp-help-toc-card{display:flex;text-align:left;gap:11px;border:1px solid #17485e;background:#081f31;color:#dff7f9;border-radius:7px;padding:13px;cursor:pointer;min-height:82px;}',
      '.sp-help-toc-card:hover{border-color:#28bac5;background:#0b2b40;transform:translateY(-1px);}',
      '.sp-help-toc-card__n{color:#45d1d8;font-size:10px;font-weight:850;padding-top:2px;}',
      '.sp-help-toc-card b{display:block;font-size:13px;margin-bottom:5px;}',
      '.sp-help-toc-card small{display:block;color:#8cb0ba;font-size:10.5px;line-height:1.4;font-weight:400;}',
      '.sp-help-section{margin:0 0 24px;}',
      '.sp-help-section h2{font-size:21px;color:#eafcff;margin:0 0 10px;}',
      '.sp-help-section h3{font-size:15px;color:#9deef0;margin:18px 0 8px;}',
      '.sp-help-section p,.sp-help-section li{font-size:12px;line-height:1.65;color:#b5d0d7;}',
      '.sp-help-section ul,.sp-help-section ol{padding-left:22px;}',
      '.sp-help-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:8px 0 24px;}',
      '.sp-help-card{border:1px solid #153f54;background:#081d2e;border-radius:7px;padding:14px;}',
      '.sp-help-card h3{font-size:14px;color:#97edf0;margin:0 0 8px;}',
      '.sp-help-card p{font-size:11.5px;line-height:1.58;color:#a9c9d1;margin:7px 0;}',
      '.sp-help-card--preset>b{font-size:10.5px;color:#d9eff2;}',
      '.sp-help-preset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}',
      '.sp-help-steps{display:grid;gap:8px;margin:8px 0 24px;}',
      '.sp-help-step{display:grid;grid-template-columns:34px 1fr;gap:10px;border:1px solid #143d50;background:#071c2c;border-radius:7px;padding:11px 13px;}',
      '.sp-help-step>span{width:27px;height:27px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#0c3f50;border:1px solid #27b7c1;color:#a5f6f5;font-size:11px;font-weight:850;}',
      '.sp-help-step h3{margin:1px 0 4px;color:#dbf9fa;font-size:13px;}',
      '.sp-help-step p{margin:0;color:#a7c8d0;font-size:11.5px;line-height:1.55;}',
      '.sp-help-dl{display:grid;grid-template-columns:minmax(130px,210px) 1fr;gap:5px 14px;font-size:11.5px;line-height:1.55;}',
      '.sp-help-dl dt{color:#8cecef;font-weight:800;padding:5px 0;border-bottom:1px solid rgba(55,164,179,.11);}',
      '.sp-help-dl dd{margin:0;color:#accbd2;padding:5px 0;border-bottom:1px solid rgba(55,164,179,.11);}',
      '.sp-help-shot{margin:26px 0;}',
      '.sp-help-shot__frame{min-height:190px;border:1px dashed #2b6877;border-radius:8px;background:linear-gradient(135deg,#071624,#0b2434);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px;color:#9ec3cb;}',
      '.sp-help-shot__frame strong{color:#c9f8fa;font-size:14px;margin:7px 0;}',
      '.sp-help-shot__frame span{max-width:720px;font-size:11px;line-height:1.55;}',
      '.sp-help-shot__frame small{margin-top:10px;color:#628e99;font-size:9.5px;}',
      '.sp-help-shot__badge{font-size:9px;font-weight:850;letter-spacing:.1em;color:#e7c956;border:1px solid #8f762b;border-radius:3px;padding:3px 6px;}',
      '.sp-help-example{padding:8px 10px;margin:7px 0;border:1px solid #16465a;background:#071c2c;border-radius:5px;color:#b9d7dd;font-size:11.5px;}',
      '.sp-help-qa{border:1px solid #153e52;background:#081d2d;border-radius:6px;margin:7px 0;}',
      '.sp-help-qa summary{cursor:pointer;color:#c9f8fa;font-size:12px;font-weight:750;padding:11px 13px;}',
      '.sp-help-qa[open] summary{border-bottom:1px solid rgba(51,177,190,.18);background:#0a2638;}',
      '.sp-help-qa p{margin:0;padding:11px 13px;color:#a9c8d0;font-size:11.5px;line-height:1.6;}',
      '@media(max-width:900px){.sp-help-overlay{padding:1.5vh 1.5vw}.sp-help-dialog{width:97vw;height:95vh}.sp-help-body{padding:16px}.sp-help-toc,.sp-help-preset-grid{grid-template-columns:1fr 1fr}.sp-help-grid2{grid-template-columns:1fr}.sp-help-hero{flex-direction:column}.sp-help-version{display:none}}',
      '@media(max-width:620px){.sp-help-toc,.sp-help-preset-grid{grid-template-columns:1fr}.sp-help-dl{grid-template-columns:1fr}.sp-help-dl dd{padding-top:0}.sp-help-launch{padding:5px 8px}.sp-help-launch__q{margin-right:3px}}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function setActiveTab(id) {
    const target = tabs.some(function (t) { return t.id === id; }) ? id : 'contents';
    const dialog = $('spHelpDialog');
    if (!dialog) return;
    dialog.querySelectorAll('.sp-help-tab').forEach(function (btn) {
      const active = btn.dataset.helpTab === target;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
    dialog.querySelectorAll('.sp-help-panel').forEach(function (panel) {
      panel.hidden = panel.dataset.helpPanel !== target;
    });
    const body = $('spHelpBody');
    if (body) body.scrollTop = 0;
  }

  function closeHelp() {
    const overlay = $('spHelpOverlay');
    if (!overlay) return;
    overlay.remove();
    if (global.document && global.document.body) global.document.body.classList.remove('sp-help-open');
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (_) {}
    }
  }

  function openHelp() {
    if (!global.document) return;
    if ($('spHelpOverlay')) { setActiveTab('contents'); return; }
    lastFocus = global.document.activeElement;
    const overlay = global.document.createElement('div');
    overlay.id = 'spHelpOverlay';
    overlay.className = 'sp-help-overlay';
    overlay.innerHTML = '<div id="spHelpDialog" class="sp-help-dialog" role="dialog" aria-modal="true" aria-labelledby="spHelpTitle">' +
      '<header class="sp-help-head"><div><div id="spHelpTitle" class="sp-help-head__title">SPECTRA PRO HELP</div><div class="sp-help-head__sub">Measurement, calibration, LAB analysis and AI interpretation</div></div>' +
      '<button id="spHelpClose" type="button" class="sp-help-close" aria-label="Close help">×</button></header>' +
      '<nav class="sp-help-tabs" role="tablist">' + tabs.map(function (tab) {
        return '<button type="button" class="sp-help-tab' + (tab.id === 'contents' ? ' is-active' : '') + '" data-help-tab="' + tab.id + '" role="tab" aria-selected="' + (tab.id === 'contents' ? 'true' : 'false') + '">' + tab.label + '</button>';
      }).join('') + '</nav>' +
      '<main id="spHelpBody" class="sp-help-body">' + tabs.map(function (tab) {
        return '<article class="sp-help-panel" data-help-panel="' + tab.id + '"' + (tab.id === 'contents' ? '' : ' hidden') + '>' + tabHtml(tab.id) + '</article>';
      }).join('') + '</main></div>';

    global.document.body.appendChild(overlay);
    global.document.body.classList.add('sp-help-open');

    const close = $('spHelpClose');
    if (close) close.addEventListener('click', closeHelp);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeHelp();
      const tabButton = event.target.closest && event.target.closest('[data-help-tab]');
      if (tabButton) setActiveTab(tabButton.dataset.helpTab);
      const goButton = event.target.closest && event.target.closest('[data-help-go]');
      if (goButton) setActiveTab(goButton.dataset.helpGo);
    });
    if (close) close.focus();
  }

  function ensureLaunchButton() {
    if (!global.document) return false;
    if ($('spHelpLaunch')) return true;
    const tabsHost = $('spTabs');
    if (!tabsHost) return false;
    const button = global.document.createElement('button');
    button.id = 'spHelpLaunch';
    button.type = 'button';
    button.className = 'sp-help-launch';
    button.title = 'Open the SPECTRA PRO help guide.';
    button.innerHTML = '<span class="sp-help-launch__q">?</span>HELP';
    button.addEventListener('click', openHelp);
    tabsHost.appendChild(button);
    return true;
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && $('spHelpOverlay')) {
      event.preventDefault();
      closeHelp();
    }
  }

  function install() {
    if (installed || !global.document) return;
    installed = true;
    installStyle();
    global.document.addEventListener('keydown', onKeyDown);
    [0, 100, 350, 800, 1600].forEach(function (delay) {
      global.setTimeout(ensureLaunchButton, delay);
    });
  }

  sp.helpUi = { install: install, open: openHelp, close: closeHelp, version: HELP_VERSION };

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(window);
