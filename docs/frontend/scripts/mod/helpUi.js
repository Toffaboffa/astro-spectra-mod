(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const HELP_VERSION = '2.3.4';
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

  function tocCard(tab, number, title, text) {
    return '<button type="button" class="sp-help-toc-card" data-help-go="' + tab + '">' +
      '<span class="sp-help-toc-card__n">' + number + '</span><span><b>' + title + '</b><small>' + text + '</small></span>' +
    '</button>';
  }

  function step(n, title, text) {
    return '<div class="sp-help-step"><span>' + n + '</span><div><h3>' + title + '</h3><p>' + text + '</p></div></div>';
  }

  function infoCard(title, html) {
    return '<article class="sp-help-card"><h3>' + title + '</h3>' + html + '</article>';
  }

  function preset(name, bestFor, description) {
    return '<article class="sp-help-card sp-help-card--preset"><h3>' + name + '</h3><b>' + bestFor + '</b><p>' + description + '</p></article>';
  }

  function controlTable(title, intro, rows) {
    return '<section class="sp-help-section"><h3>' + title + '</h3>' +
      (intro ? '<p>' + intro + '</p>' : '') +
      '<div class="sp-help-table-wrap"><table class="sp-help-ref"><thead><tr>' +
      '<th>Control</th><th>Type</th><th>What it does</th><th>How to interpret / use it</th>' +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function metricTable(title, intro, rows) {
    return '<section class="sp-help-section"><h3>' + title + '</h3>' +
      (intro ? '<p>' + intro + '</p>' : '') +
      '<div class="sp-help-table-wrap"><table class="sp-help-ref sp-help-ref--metrics"><thead><tr>' +
      '<th>Field</th><th>Meaning</th><th>How to read it</th><th>When it may be blank / not applicable</th>' +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  const tabs = [
    { id: 'contents', label: 'CONTENTS' },
    { id: 'quick', label: 'QUICK START' },
    { id: 'workspace', label: 'WORKSPACE' },
    { id: 'controls', label: 'CONTROLS' },
    { id: 'status', label: 'STATUS & QUALITY' },
    { id: 'calibration', label: 'CALIBRATION' },
    { id: 'lab', label: 'LAB & PRESETS' },
    { id: 'ai', label: 'AI INTERPRETATION' },
    { id: 'qa', label: 'Q&A' }
  ];

  function contentsHtml() {
    return '<div class="sp-help-hero">' +
      '<div><div class="sp-help-kicker">SPECTRA PRO HELP</div><h1>Complete instrument and analysis guide</h1>' +
      '<p>This guide documents the current SPECTRA PRO interface, including every main button, slider, checkbox, selector, status field and data-quality metric. It also explains calibration, LAB presets, fluorescence and AI Interpretation.</p></div>' +
      '<div class="sp-help-version">UI guide<br><b>v' + HELP_VERSION + '</b></div>' +
    '</div>' +
    '<div class="sp-help-callout"><b>Recommended workflow:</b> acquire a clean spectrum → place the sampling stripe → calibrate → inspect Status/Data Quality → choose the analysis preset that matches the source physics → inspect pattern evidence → use AI Interpretation as a final interpretation layer.</div>' +
    '<div class="sp-help-toc">' +
      tocCard('quick', '01', 'Quick Start', 'The shortest reliable route from camera or image to an interpretable spectrum.') +
      tocCard('workspace', '02', 'Workspace', 'What each region of the Recording page is for.') +
      tocCard('controls', '03', 'Controls', 'Every main button, slider, checkbox and drop-down menu.') +
      tocCard('status', '04', 'Status & Quality', 'Every field in the two right-hand diagnostic panels.') +
      tocCard('calibration', '05', 'Calibration', 'Pixel-to-wavelength calibration, shell points, files and fit diagnostics.') +
      tocCard('lab', '06', 'LAB & Presets', 'Analysis settings, presets, Match Score columns and fluorescence output.') +
      tocCard('ai', '07', 'AI Interpretation', 'What is sent, what AI does, controls and limitations.') +
      tocCard('qa', '08', 'Q&A', 'Common questions and troubleshooting.') +
    '</div>' +
    '<section class="sp-help-section"><h2>What SPECTRA PRO is designed to do</h2>' +
      '<p>SPECTRA PRO combines live or image-based stripe spectroscopy with calibration, graph tools, data-quality diagnostics and optional worker-based analysis. Different physical source types are intentionally analyzed differently: atomic line spectra use coherent line fingerprints, molecular spectra use band-pattern evidence, and broad fluorescence is characterized by its band shape.</p>' +
      '<p>The software is an interpretation aid. A match is only as trustworthy as the wavelength calibration, optical geometry, signal quality and physical suitability of the chosen preset.</p>' +
    '</section>' +
    plannedShot('Full application overview', 'Show the entire SPECTRA PRO window with the source panel on the left, spectrum graph at the top, PRO dock below the graph, Status/Data Quality on the right, and HELP visible. Use a calibrated spectrum so both pixel and wavelength concepts are easy to illustrate.', 'help-overview.png');
  }

  function quickHtml() {
    return '<section class="sp-help-section"><h2>Quick Start</h2><p>This is the shortest reliable workflow. The detailed control reference is in the CONTROLS tab.</p></section>' +
      '<div class="sp-help-steps">' +
        step('1', 'Select the source', 'Choose a camera from the source selector, press <b>Load Image</b>, or use <b>Load Example</b> for the bundled SPECTRA-1 line spectrum. Load Example also applies its matching three-point calibration, centers a 5 px stripe, switches the X-axis to nm and selects Gas Tube as the recommended preset. It does not turn Analyze on automatically.') +
        step('2', 'Place the sampling stripe', 'Move <b>Stripe Place</b> through the spectral image. Use <b>Stripe Width</b> to average additional image rows when that improves signal stability without mixing unwanted background.') +
        step('3', 'Avoid clipping', 'Watch <b>Headroom</b> and <b>Sat</b> in Data Quality. Reduce exposure when important peaks approach clipping. A clipped peak has lost quantitative shape information.') +
        step('4', 'Calibrate', 'Load a calibration file or add known px↔nm points in CALIBRATE. Confirm <b>Cal: yes</b>, inspect calibration error, and switch the X-axis to nm before trusting wavelength matches.') +
        step('5', 'Choose the analysis physics', '<b>Atomic</b> for narrow lines, <b>Gas Tube</b> for discharge tubes, <b>Molecular</b> for bands, <b>Flame</b> for mixed flame-type spectra, and <b>Fluorescent</b> for broad fluorescence.') +
        step('6', 'Inspect evidence, not only the winner', 'Check Score Share, matched evidence, missed signature features and Δ. In Fluorescent mode, inspect λmax, centroid, FWHM, band width and asymmetry instead of atomic Match Score.') +
        step('7', 'Use AI Interpretation last', 'Describe the source or experiment briefly. AI receives the compact measurement, calibration, quality data and SPECTRA analysis. It explains the supplied evidence but should not invent missing measurements.') +
      '</div>' +
      '<div class="sp-help-callout sp-help-callout--warn"><b>Fast sanity check:</b> if a result changes dramatically when Max distance is loosened, or if calibration is absent, treat the identification as provisional. More matches are not automatically better evidence.</div>' +
      plannedShot('Quick-start example', 'Show a calibrated gas-tube spectrum with the stripe centered on the spectrum, LAB open in Gas Tube or Atomic, Data Quality visible, and a clear Best match. Avoid a screenshot with clipped peaks.', 'help-quick-start.png');
  }

  function workspaceHtml() {
    return '<section class="sp-help-section"><h2>Workspace</h2><p>The Recording page has four functional regions plus the global HELP button.</p></section>' +
      '<div class="sp-help-grid2">' +
        infoCard('1 · Source panel', '<p>The left side contains the camera or loaded image, Source/Dark/Ref views, camera selector, image controls, stripe placement/width, exposure and dark/reference capture controls.</p>') +
        infoCard('2 · Spectrum graph', '<p>The upper-right graph plots the stripe signal against pixels or calibrated wavelength. The color strip above the graph is the sampled spectral image. Mouse coordinates show the current graph position.</p>') +
        infoCard('3 · PRO dock', '<p><b>CORE</b> controls display and graph behavior. <b>HARDWARE</b> stores instrument specifications. <b>CALIBRATE</b> manages wavelength calibration. <b>LAB</b> performs spectral analysis. <b>ASTRO</b> is currently a staged/placeholder workspace.</p>') +
        infoCard('4 · Diagnostics rail', '<p><b>STATUS</b> describes current application state. <b>DATA QUALITY</b> describes signal range, clipping, detected peaks, noise, calibration coverage and instrument resolution information.</p>') +
        infoCard('5 · On-page console', '<p>The black console at the lower-left reports LAB/library actions, setting changes and errors. It is useful when a button appears to do nothing or when a worker/library action fails.</p>') +
        infoCard('6 · HELP', '<p>HELP opens this modal without changing app mode or stopping the current measurement. Close it with ×, Escape or by clicking outside the dialog.</p>') +
      '</div>' +
      '<section class="sp-help-section"><h3>Mode tabs</h3><dl class="sp-help-dl">' +
        '<dt>CORE</dt><dd>Baseline instrument and graph controls. Camera, stripe and graph remain usable even without worker analysis.</dd>' +
        '<dt>HARDWARE</dt><dd>Instrument metadata used for context and some derived metrics such as FWHM and effective resolving power.</dd>' +
        '<dt>CALIBRATE</dt><dd>Pixel-to-wavelength fit, shell points, calibration file I/O and detailed data-quality breakdown.</dd>' +
        '<dt>LAB</dt><dd>Worker-based library matching, fingerprints, molecular analysis, fluorescence analysis and AI Interpretation.</dd>' +
        '<dt>ASTRO</dt><dd>Currently a placeholder/staged workspace in this build. Do not assume unavailable controls are hidden somewhere; they are not implemented in the visible panel yet.</dd>' +
      '</dl></section>' +
      plannedShot('Workspace anatomy', 'Provide one full-window screenshot with numbered callouts for Source panel, graph, PRO tabs, control area, Status, Data Quality, console and HELP button.', 'help-workspace-anatomy.png');
  }

  function controlsHtml() {
    const sourceRows = [
      ['Source / Dark / Ref', 'View selector', 'Switches the preview between the active source image and stored dark/reference images when those exist.', 'Use Source for normal measurement and capture. Dark/Ref are inspection views; LAB capture buttons are disabled unless Source and a live camera are active.'],
      ['Camera selector', 'Drop-down', 'Chooses the active video input device.', 'After changing camera, verify resolution, exposure behavior and stripe placement because optical geometry can change.'],
      ['Refresh', 'Button', 'Re-enumerates available cameras.', 'Use after connecting/disconnecting a camera or when the browser does not list the expected device.'],
      ['Pause / Play', 'Button pair', 'Pauses or resumes the live video stream.', 'Useful for inspecting a stable frame. A loaded still image does not need Play.'],
      ['Load Image', 'Button', 'Loads a still spectrum image into the camera/source area.', 'Still images are reanalyzed when relevant LAB settings change. Calibration must still match the geometry of the image.'],
      ['Load Example', 'Button', 'Loads the bundled calibrated SPECTRA-1 line-spectrum example.', 'The demo keeps the original 1280 px horizontal geometry, uses a vertically cropped source image, applies the reported SPECTRA-1 calibration points (32→388.86 nm, 515→587.57 nm, 1110→837.76 nm), centers a 5 px stripe and selects Gas Tube. Analyze remains under user control.'],
      ['Compare images / Stop comparison', 'Button', 'Loads multiple images for comparison, or exits that comparison state.', 'Use for qualitative comparison of repeated measurements. Do not confuse image comparison with reference-graph processing.'],
      ['Stripe Width − / slider / +', 'Buttons + slider', 'Sets how many image rows are averaged into the one-dimensional spectrum.', 'A wider stripe can improve stability/SNR but may mix background or vertically displaced spectra. Start narrow and increase only when useful.'],
      ['Stripe Place − / slider / +', 'Buttons + slider', 'Moves the sampling stripe vertically through the source image.', 'Place it through the brightest, cleanest section of the spectrum. Changing it changes the measured data.'],
      ['Adjust Exposure', 'Slider', 'Requests a camera exposure setting when supported by the browser/camera.', 'Reduce exposure if Sat rises or Headroom becomes small. Unsupported cameras may ignore this control.'],
      ['Capture Dark', 'Button', 'Captures the current live SOURCE frame as a dark/background reference.', 'Use with the light source blocked/off but otherwise identical camera conditions. Only available for live Source view.'],
      ['Load Dark', 'Button', 'Loads an image file as the dark frame.', 'The loaded image should match camera dimensions/geometry and exposure conditions as closely as possible.'],
      ['Clear Dark', 'Button', 'Removes the stored dark frame.', 'Processing modes that require Dark will no longer have a valid dark reference.'],
      ['Capture Ref', 'Button', 'Captures the current live SOURCE frame as a processing reference.', 'Useful for Difference, Ratio, Transmittance and Absorbance workflows.'],
      ['Load Ref', 'Button', 'Loads an image file as the processing reference.', 'Reference and measurement should share geometry and dimensions.'],
      ['Clear Ref', 'Button', 'Removes the processing reference.', 'Ratio/Transmittance/Absorbance cannot be interpreted normally without an appropriate reference.'],
      ['Left sidebar handle', 'Collapse handle', 'Collapses/expands the left source/settings area.', 'Pure layout control; it does not alter the measurement.']
    ];

    const coreRows = [
      ['App mode', 'Drop-down: CORE / LAB / ASTRO', 'Selects the application workspace.', 'CORE is baseline. LAB enables worker analysis. ASTRO is staged in the current visible build.'],
      ['Worker', 'Drop-down: Auto / On / Off', 'Controls whether the analysis Web Worker is automatically managed, forced on or disabled.', 'Auto is the normal choice. Off disables worker analysis without disabling basic camera/graph operation.'],
      ['X-axis', 'Drop-down: px / nm', 'Chooses raw detector pixels or calibrated wavelength for the horizontal axis.', 'nm requires valid calibration. px is always available and is the safer view when calibration is unknown.'],
      ['Y-axis', 'Drop-down: AUTO / MANUAL / NORMALIZE', 'Controls vertical scaling.', 'AUTO follows the data; MANUAL uses Y max; NORMALIZE scales to the strongest visible peak, useful for shape comparison but not absolute intensity comparison.'],
      ['Y max', 'Number input', 'Sets the manual upper Y-axis limit.', 'Only active in MANUAL. Increase if peaks are visually clipped by the plot scale; this does not change camera clipping.'],
      ['Fill mode', 'Drop-down: INHERIT / OFF / SYNTHETIC / SOURCE', 'Controls colored fill under/around the graph.', 'OFF is cleanest for quantitative inspection. SOURCE uses source-derived color. SYNTHETIC renders wavelength-based color. INHERIT follows legacy/default behavior.'],
      ['Fill opacity', 'Slider 0–1', 'Sets opacity of graph fill.', 'Visual only; it does not alter the measured spectrum.'],
      ['Combined', 'Checkbox', 'Shows/hides the combined intensity trace.', 'Combined is the main intensity curve used by most workflows.'],
      ['Red / Green / Blue', 'Checkboxes', 'Show/hide individual camera RGB channel traces.', 'Useful for diagnosing sensor/channel response. Channel amplitude is not chemical abundance.'],
      ['Dark graph / Reference graph', 'Checkboxes', 'Show/hide stored subtraction/reference traces when available.', 'These controls become useful after Dark/Ref data exists.'],
      ['Toggle peaks', 'Checkbox', 'Shows/hides detected peak markers on the graph.', 'Display control for the built-in graph peak detector; it does not by itself enable LAB identification.'],
      ['Peak threshold', 'Number input 0–255', 'Minimum intensity for the CORE graph peak detector.', 'Lower values find more weak/noisy peaks; higher values keep only stronger features.'],
      ['Peak distance', 'Number input', 'Minimum spacing between CORE-detected peaks.', 'Increase to avoid splitting one broad structure into many peaks; decrease to resolve nearby distinct peaks.'],
      ['Peak smoothing', 'Number input 0–8', 'Applies simple smoothing before CORE peak detection.', 'More smoothing suppresses noise but can merge nearby narrow lines.'],
      ['Reset zoom', 'Button', 'Returns the graph to its full available X-range.', 'Use when you have zoomed or panned away from the full spectrum.'],
      ['Step back', 'Button', 'Returns to the previous zoom state.', 'Useful after an accidental or temporary zoom.'],
      ['← / →', 'Buttons', 'Pans the current zoom window left or right.', 'Only changes the visible graph window.'],
      ['Zoom scroller', 'Slider', 'Moves through the available X-range while zoomed.', 'Disabled when the graph has no scrollable zoom span.'],
      ['Refresh UI', 'Button', 'Rebuilds/refreshes the PRO dock and visible status panels.', 'Use for UI recovery; it should not be needed during normal measurement.'],
      ['Probe camera', 'Button', 'Queries browser-reported camera capabilities and manual controls.', 'After probing, optional Zoom/Exposure controls may appear if supported.'],
      ['EXPORT', 'Large button in the left source panel', 'Opens the unified export dialog without changing the active workspace.', 'Placed beside the centered Dark/Ref controls so export is available from any workspace.'],
      ['Spectrum (source)', 'Export checkbox', 'Exports a centered crop of the current source spectrum/frame as PNG.', 'The crop removes unused dark image area and keeps the dispersed spectrum band prominent. In the PDF report this source image is placed beside the graph on the same page.'],
      ['Data points (.csv)', 'Export checkbox', 'Exports the current sampled spectrum as CSV with px, nm when calibrated, RGB and intensity columns.', 'Use for numerical work in spreadsheets, Python or other analysis tools.'],
      ['Graph', 'Export checkbox', 'Exports the graph canvas exactly as currently rendered.', 'Visible annotations, hit labels and overlays are retained because the current graph canvas is exported.'],
      ['Data analysis (.json)', 'Export checkbox', 'Exports one JSON snapshot containing application state, settings, calibration, Status, Data Quality, controls, full spectrum arrays, hits/results and AI data when available.', 'This is the main machine-readable reproducibility bundle. The spectrum arrays include px/nm/R/G/B/intensity and processed/normalized values when available.'],
      ['Report (.pdf)', 'Export checkbox', 'Generates the structured PDF report locally in the browser.', 'The cover uses the bundled SPECTRA PRO hero supplied for the project. The center-cropped source image and rotated graph share one print-efficient page, without orientation/crop notes in the headings. The report includes extended continuous method text, compact two-column matched features, side-by-side Quality/Status, and any completed AI interpretation is inserted verbatim into the Abstract. The automatic report body itself remains rule-generated.'],
      ['Export selected', 'Button', 'Creates all checked export formats and packages them into one ZIP file.', 'The selected PNG/CSV/JSON/PDF outputs are downloaded as one timestamped SPECTRA PRO ZIP archive.'],
      ['Cancel / ×', 'Buttons', 'Closes the export dialog without creating files.', 'The current measurement and analysis state are unchanged.'],
      ['Long exposure', 'Button', 'Opens the repeated-capture/long-exposure settings popup.', 'Intended for averaging/repeated capture workflows, not for increasing the physical exposure time of unsupported cameras.'],
      ['Show Reference Lines', 'Checkbox', 'Shows/hides stored reference graph overlays.', 'Reference graphs are visual/comparison traces, distinct from the processing Ref frame.'],
      ['Compare Reference Lines', 'Drop-down: NORMAL / DIFFERENCE / RATIO / TRANSMITTANCE / ABSORBANCE', 'Chooses the mathematical comparison display against stored reference lines.', 'NORMAL shows normal traces. Difference subtracts; Ratio divides; Transmittance expresses a ratio as transmission; Absorbance applies logarithmic absorbance semantics. Use only with a physically meaningful reference.'],
      ['Add Reference Line', 'Button', 'Stores the current graph as a reference line.', 'Useful for comparing later spectra to a baseline trace.'],
      ['From file', 'Button', 'Loads a reference trace from an XLSX file.', 'Use when the comparison reference was recorded previously.'],
      ['Clear Lines', 'Button', 'Removes stored reference graph lines.', 'Does not clear the processing Ref image.'],
      ['Camera Zoom', 'Optional slider', 'Applies browser-supported optical/digital zoom to the active camera.', 'Appears only after capability probing and only if the camera exposes this control. Changing zoom can invalidate calibration.'],
      ['Camera Exposure', 'Optional slider', 'Applies browser-supported exposureTime constraints.', 'Appears only when supported. Re-check saturation and calibration-related geometry after camera setting changes.']
    ];

    const longRows = [
      ['Number of Captures', 'Number input', 'Sets how many frames/images the long-exposure capture routine takes.', 'More captures increase acquisition time and may improve averaging/stability depending on the downstream workflow.'],
      ['Pause in between captures', 'Number input (ms)', 'Delay between consecutive captures.', 'Use enough delay for the source/camera to settle when necessary.'],
      ['Screenshot Graph', 'Checkbox', 'Requests graph screenshots during the capture workflow.', 'Enable when you need visual records as well as captured data.'],
      ['Capture', 'Button', 'Starts the configured repeated-capture sequence.', 'Check capture count and pause before starting.'],
      ['Record', 'Button', 'Returns to the normal Recording/graph view.', 'Navigation control; it does not start LAB analysis.']
    ];

    const hardwareRows = [
      ['Spectrometer', 'Drop-down: CUSTOM / known profile', 'Chooses a predefined hardware profile or manual values.', 'Selecting KVANT - Spectra-1 immediately fills/applies its known specifications. CUSTOM means manually entered metadata.'],
      ['Range (min)', 'Number input, nm', 'Configured lower wavelength limit of the spectrometer.', 'Used for hardware context and derived coverage/resolution information; it is not a replacement for calibration.'],
      ['Range (max)', 'Number input, nm', 'Configured upper wavelength limit.', 'Should reflect the instrument, not merely the current visible graph crop.'],
      ['Resolution', 'Number input, nm FWHM', 'Instrument spectral resolution expressed as full width at half maximum.', 'Smaller FWHM means finer spectral resolving ability. This is hardware metadata, not the width of every measured peak.'],
      ['Pixel resolution', 'Number input, nm/px', 'Manufacturer/nominal wavelength sampling per pixel.', 'Useful instrument metadata. The calibrated Res field may be derived independently from the active calibration.'],
      ['Grating density', 'Number input, lines/mm', 'Groove density of the diffraction grating.', 'Context for the optical configuration. Changing the real grating requires new calibration.'],
      ['Apply', 'Button', 'Stores the current hardware form values.', 'Use after entering CUSTOM values.'],
      ['Clear', 'Button', 'Clears the active hardware metadata.', 'Derived hardware fields such as FWHM/Eff. R may then become unavailable.']
    ];

    const calibrationSidebarRows = [
      ['Calibration export filename', 'Text input', 'Sets the filename used by the original calibration export workflow.', 'Choose a descriptive filename that identifies the optical setup.'],
      ['Export calibration settings', 'Button', 'Exports the original calibration settings.', 'Useful for reusing a calibration only when camera/optical geometry is unchanged.'],
      ['Calibration file input', 'File selector', 'Imports an original SPECTRA calibration text file.', 'After import, verify known lines across the wavelength range.'],
      ['px / nm point fields', 'Number inputs', 'Define calibration anchor pairs: detector pixel and known wavelength.', 'Use known spectral lines distributed across the useful range.'],
      ['Add', 'Button', 'Adds another px↔nm input pair.', 'At least two points are required; more well-distributed valid points can improve robustness.'],
      ['Reset', 'Button', 'Clears/reset calibration point inputs.', 'Use when starting a new calibration.'],
      ['Sort', 'Button', 'Sorts calibration point pairs.', 'Helps keep the point list ordered and easier to inspect.'],
      ['Record', 'Button', 'Returns from the calibration-side settings view to graph/recording.', 'Navigation only.'],
      ['Startup prompt Yes / No', 'Prompt buttons', 'When no calibration is active, Yes opens the calibration-file workflow; No dismisses the prompt.', 'Choose No when intentionally working in pixels. Wavelength-based matching should wait until calibration is valid.']
    ];

    return '<section class="sp-help-section"><h2>Controls reference</h2><p>This section documents the main interactive controls currently present in the Recording interface. Controls that appear only in specific states are marked as optional/context-dependent.</p></section>' +
      controlTable('Source panel', 'These controls determine what image is measured and which horizontal stripe is converted into the spectrum.', sourceRows) +
      plannedShot('Source-panel controls', 'Show the complete left panel with Source/Dark/Ref, camera selector, Refresh, Pause/Play, Load Image, Compare images, Stripe Width, Stripe Place, Exposure, Dark/Ref buttons and the console. Add numbered annotations corresponding to the help rows.', 'help-controls-source.png') +
      controlTable('CORE graph and display controls', 'CORE changes graph presentation, worker mode and reference-line display. Most of these controls do not modify the original camera pixels.', coreRows) +
      plannedShot('CORE controls', 'Show the entire CORE tab with all selectors, RGB/Combined toggles, peak controls, zoom controls, reference-line controls and the optional camera controls if available.', 'help-controls-core.png') +
      controlTable('Long exposure popup', 'Opened from CORE → Long exposure.', longRows) +
      controlTable('HARDWARE', 'Hardware values provide instrument context. They do not calibrate the wavelength axis by themselves.', hardwareRows) +
      controlTable('Original calibration-side controls', 'These are the original SPECTRA calibration controls in the left settings area. The CALIBRATE tab provides the newer PRO shell around the same calibration engine.', calibrationSidebarRows) +
      '<section class="sp-help-section"><h3>ASTRO</h3><p>The visible ASTRO panel is currently a placeholder in this build, so there are no user controls to document there yet. Future ASTRO controls should be added to this help reference at the same time they become visible.</p></section>';
  }

  function statusHtml() {
    const statusRows = [
      ['App', 'Current application mode/section.', 'CORE, LAB or ASTRO tells you which workspace owns the current analysis behavior.', 'Always available; defaults to CORE.'],
      ['Worker', 'Web Worker state and, when active, analysis refresh rate in Hz.', 'idle means no active analysis job. ready/active with a Hz value indicates worker processing.', 'Hz is absent when analysis is idle/off.'],
      ['Src', 'Current frame source and active signal width in pixels.', 'camera means live source; a still image may report an image/static source. Pixel width is the one-dimensional extracted frame width.', 'Width may be absent before a valid frame exists.'],
      ['Cam', 'Camera status, resolution and browser support for exposure/zoom controls.', 'Use it to verify the expected device/resolution and whether manual camera controls are available.', 'Meaningful mainly for live camera sources.'],
      ['Mods', 'Count of the eight legacy/v1.5 PRO frontend modules currently registered as loaded.', 'A full value indicates the optional frontend modules are present. It is a software-status field, not a measurement-quality score.', 'May be lower during startup or if optional modules fail to load.'],
      ['Preset', 'Selected LAB analysis preset.', 'Examples: Atomic, Gas Tube, Molecular, Flame, Fluorescent. The preset determines analysis physics and weighting.', '— outside LAB or before a preset is selected.'],
      ['Analyze', 'Whether continuous worker-based LAB analysis is enabled.', 'on means incoming frames can be analyzed when LAB, libraries and worker conditions are satisfied.', 'Normally off in CORE.'],
      ['Axis', 'Current horizontal graph axis.', 'px = raw detector position; nm = calibrated wavelength.', 'nm should not be trusted without valid calibration.'],
      ['Norm', 'Whether Y-axis normalization to the strongest peak is enabled.', 'on is useful for comparing shape; off preserves the displayed intensity scale.', 'Always defined.'],
      ['Stripe', 'Sampling stripe position and height: y… · h….', 'y is vertical image position; h is stripe height/width in image rows.', 'Unavailable only before stripe controls initialize.'],
      ['Cal', 'Calibration state plus point counts: yes/no · pts N · sh N.', 'pts = calibration points in the active calibration state. sh = PRO shell-point count.', 'If no calibration is active it reports no and counts may be zero.'],
      ['Range', 'Configured hardware wavelength range from HARDWARE.', 'This is instrument metadata, not measured/calibrated coverage.', '— when hardware range is not configured.'],
      ['Dark', 'Whether a dark/background image exists for processing.', 'yes means Raw-Dark processing has a dark frame available.', 'no until captured or loaded.'],
      ['Ref', 'Whether a processing reference image exists.', 'yes enables meaningful Difference/Ratio/Transmittance/Absorbance workflows when the reference is physically appropriate.', 'no until captured or loaded.'],
      ['RefG', 'Reference-graph overlay state and number of stored reference graphs.', 'This is separate from the processing Ref image. n is the count of stored graph traces.', 'no · n 0 when none are stored.'],
      ['Proc', 'Active processing/subtraction mode.', 'Raw, Raw-Dark, Difference, Ratio, Transmittance % or Absorbance describes the transform applied before/for analysis.', 'Always has a mode; Raw is default.'],
      ['HW', 'Active hardware profile label.', 'Shows profile name or CUSTOM when manual hardware values are applied.', '— if no hardware metadata has been applied.']
    ];

    const dqRows = [
      ['Signal', 'Minimum–maximum intensity in the active stripe.', 'Shows the numerical span of the current measured signal. Example 28–47 means no sample is below 28 or above 47 in that frame.', 'Requires a valid frame.'],
      ['Avg/Dyn', 'Average intensity / dynamic range, where dynamic range here is max − min.', 'A larger Dyn means more contrast across the measured spectrum. Average alone is not signal quality.', 'Requires a valid frame.'],
      ['Base', 'Estimated baseline floor from the lower 5% percentile of the signal.', 'Useful for seeing how elevated the background is. A high baseline can consume dynamic range.', 'Requires enough valid samples.'],
      ['Headroom', 'Remaining margin before clipping: clip maximum − strongest sample.', 'Large positive headroom means the signal is safely below clipping. Near zero means saturation risk. It is not SNR.', 'Requires a known/derived clipping level.'],
      ['Sat', 'Number and percentage of clipped or near-clipped samples.', '0% is desirable. Any important saturated peak has lost true peak height/shape information.', 'Requires a valid frame.'],
      ['Peaks', 'Number of local peaks detected using the current threshold and distance settings.', 'This is detector output, not number of chemical species. Very large counts may indicate noise or overly permissive settings.', '0 when no peaks pass the detector settings.'],
      ['Strong', 'Detected peaks that pass the current Strong Peak level weighting.', 'A subset of Peaks used to characterize the strongest evidence. Changing Strong Peak changes this count.', '0 when no peaks meet the strong threshold.'],
      ['Hits/QC', 'Current LAB top-hit count / QC-flag count.', 'Example 14/0 means 14 current hit entries and no QC warnings. A larger hit count is not automatically better.', '0/0 outside active LAB analysis or when no results exist.'],
      ['Peak Δ', 'Mean absolute wavelength mismatch between current LAB matched peaks and library/reference lines.', 'Lower is generally better when calibration is valid, but it must be interpreted relative to instrument resolution and Max distance.', '— outside LAB, without matches, or without usable wavelength matching.'],
      ['Conf', 'Highest confidence value among the active top-hit set.', 'Useful as an internal match-quality indicator, not a laboratory probability.', '— when no LAB hits expose confidence.'],
      ['Noise σ', 'Estimated noise sigma from residual fluctuations around a local five-point smooth.', 'Lower residual noise is generally better. The estimate can be misleading when the spectrum itself contains dense fine structure.', '— if too few valid samples exist.'],
      ['SNR', 'Estimated signal-to-noise ratio using the median smoothed signal divided by estimated noise sigma.', 'Higher is generally cleaner, but this is an internal estimate, not a calibrated detector SNR specification.', '— when noise sigma is zero/undefined or too few samples exist.'],
      ['Res', 'Estimated wavelength sampling in nm per pixel from the active calibration.', 'Smaller nm/px means finer wavelength sampling. Sampling is not identical to true optical resolving power.', '— without calibration.'],
      ['Cov', 'Calibrated wavelength coverage of the active spectrum.', 'The wavelength interval represented by the current frame/calibration.', '— without calibrated nm data or usable hardware-range fallback.'],
      ['Cal err', 'RMS residual error of the active calibration fit at its calibration points.', 'Smaller is better. Inspect distribution across the range too; a low RMS does not guarantee no local drift.', '— without coefficients and at least two calibration points.'],
      ['FWHM', 'Instrument spectral full width at half maximum from HARDWARE metadata.', 'Represents nominal instrument line width/resolution. Smaller is finer.', '— when hardware FWHM has not been entered.'],
      ['Eff. R', 'Approximate resolving power R ≈ λ/Δλ.', 'Higher R means better ability to separate close spectral features. It is derived from hardware FWHM when available, otherwise from nm/px as a rough fallback.', '— when neither hardware resolution nor calibration sampling is available.']
    ];

    return '<section class="sp-help-section"><h2>Status & Data Quality</h2><p>These panels are deliberately compact, so the abbreviations need a proper legend. Hovering rows in the live UI may show short tooltips; this section gives the fuller meaning.</p></section>' +
      metricTable('STATUS', 'STATUS describes application state and which supporting data are currently available.', statusRows) +
      metricTable('DATA QUALITY', 'DATA QUALITY combines signal statistics, peak-detection information, LAB match diagnostics, calibration metrics and hardware metadata.', dqRows) +
      '<div class="sp-help-callout"><b>Important:</b> not all numbers are independent quality scores. For example, Peaks depends strongly on threshold/distance settings, RefG is only a state count, and Eff. R may be an approximation. Read each field according to its definition rather than trying to maximize every number.</div>' +
      plannedShot('Status and Data Quality reference', 'Show both right-hand panels fully populated during a calibrated LAB measurement. Use a screenshot where App, Worker, Preset, Cal, Signal, Headroom, Sat, Hits/QC, Peak Δ, Noise σ, SNR, Res, Cov, Cal err, FWHM and Eff. R are visible. Add numbered callouts if desired.', 'help-status-quality.png');
  }

  function calibrationHtml() {
    const calRows = [
      ['Calibration fit graph', 'Read-only graph', 'Plots calibration points and the fitted pixel→wavelength curve.', 'Look for a sensible smooth mapping. A visually smooth curve is not enough; inspect Cal err/residuals too.'],
      ['Fit formula', 'Read-only text', 'Shows the active polynomial mapping in the form nm = f(px).', 'This is the mapping applied by the calibration engine.'],
      ['Apply points', 'Button', 'Normalizes enabled shell points, copies them into the original calibration inputs and solves/applies the fit.', 'Use after editing/enabling shell points. Invalid or insufficient points are rejected.'],
      ['Save to file', 'Button', 'Exports enabled shell points as px;nm text.', 'Use to preserve calibration anchors for the same optical geometry.'],
      ['Load from file', 'Button', 'Loads px;nm points and applies them immediately.', 'Verify the calibration against known lines after loading.'],
      ['Shell point enable', 'Checkbox per row', 'Includes/excludes that shell point from the active set.', 'Useful for testing a suspected bad point without deleting it.'],
      ['Remove', 'Button per row', 'Deletes the selected shell point.', 'Removing a point changes the fitted calibration after re-apply.'],
      ['px', 'Number input', 'Detector pixel coordinate for a new calibration anchor.', 'Use the pixel position of a known spectral feature.'],
      ['nm', 'Number input', 'Known wavelength for the same anchor.', 'Use a trusted reference wavelength, not the current unverified graph label.'],
      ['add', 'Button', 'Adds the entered px/nm pair and immediately attempts to apply the updated point set.', 'Distribute calibration points across the useful detector range.'],
      ['Data Quality (details)', 'Read-only panel', 'Repeats the Status and Data Quality metrics in the CALIBRATE workspace.', 'Useful when judging calibration without switching attention back to the side rail.']
    ];

    return '<section class="sp-help-section"><h2>Calibration</h2><p>Calibration maps detector pixels to physical wavelength. Automated line matching should not be treated as physical evidence until the calibration is appropriate for the current camera, crop, grating position and optical geometry.</p></section>' +
      '<section class="sp-help-section"><h3>Recommended workflow</h3><ol>' +
        '<li>Use a source with known reference wavelengths and the same optical geometry used for measurements.</li>' +
        '<li>Add or load px↔nm points distributed across the useful range.</li>' +
        '<li>Apply the points and verify <b>Cal: yes</b>.</li>' +
        '<li>Inspect <b>Cal err</b> and, where possible, known lines between the calibration anchors.</li>' +
        '<li>Switch X-axis to nm only after the fit is credible.</li>' +
      '</ol></section>' +
      controlTable('CALIBRATE controls', 'The PRO calibration shell drives the existing calibration engine rather than creating a second independent solver.', calRows) +
      '<div class="sp-help-callout sp-help-callout--warn"><b>Old images:</b> an image recorded with another camera resolution, crop or grating position may require a different calibration. A graph can look perfectly plausible while every wavelength is shifted.</div>' +
      '<section class="sp-help-section"><h3>Calibration terms</h3><dl class="sp-help-dl">' +
        '<dt>Calibration points</dt><dd>Known pixel ↔ wavelength anchors.</dd>' +
        '<dt>Shell points</dt><dd>The PRO-managed editable point set. Enabled shell points are applied into the original SPECTRA calibration engine.</dd>' +
        '<dt>Coefficients</dt><dd>Polynomial coefficients used to calculate wavelength from pixel position.</dd>' +
        '<dt>Residual</dt><dd>Difference between a calibration point’s known wavelength and the fitted wavelength at that pixel.</dd>' +
        '<dt>Cal err</dt><dd>RMS residual error across active calibration points.</dd>' +
        '<dt>Res (nm/px)</dt><dd>Sampling derived from the wavelength mapping across the detector. It is not identical to optical FWHM resolution.</dd>' +
      '</dl></section>' +
      plannedShot('Calibration workflow', 'Show CALIBRATE with several enabled shell points, the fit graph/formula, validation text, Data Quality details, and the main graph switched to nm. Ideally include points spanning most of the detector width.', 'help-calibration.png');
  }

  function labHtml() {
    const labRows = [
      ['Analyze', 'Checkbox', 'Turns continuous LAB worker analysis on/off.', 'When enabled, analysis runs only when LAB conditions are satisfied and libraries are available.'],
      ['Max Hz', 'Number input 1–30', 'Caps analysis updates per second.', 'Lower values reduce CPU load and visual churn. High values do not improve the underlying camera data.'],
      ['Preset', 'Drop-down', 'Chooses source-specific discovery/refinement rules.', 'Choose by physical source type, not by the species you hope to see.'],
      ['Mode', 'Drop-down', 'Transforms the incoming signal before matching.', '<b>Raw</b>: unchanged. <b>Raw - Dark</b>: subtract dark. <b>Difference</b>: Raw - Ref. <b>Ratio</b>: Raw/Ref. <b>Transmittance %</b>: ratio as transmission. <b>Absorbance</b>: logarithmic absorbance-style transform.'],
      ['Show hits', 'Checkbox', 'Shows/hides hit overlays for line-oriented LAB modes.', 'Display only; turning labels off should not change the underlying analysis. Fluorescent hides this in favor of Narrow-line overlay.'],
      ['Weak peaks', 'Checkbox', 'Allows weaker/more closely spaced peaks into detection.', 'Useful for weak support lines, but increases accidental matches/noise sensitivity.'],
      ['Stable hits', 'Checkbox', 'Uses rolling stability behavior to reduce flickering hit labels.', 'Most useful for live camera spectra.'],
      ['Smart find', 'Checkbox', 'Shows refined Smart grouping/evidence rather than only raw proximity hits.', 'Use for source identification; raw coincidences alone are weak evidence in dense libraries.'],
      ['Auto tune', 'Checkbox', 'Runs a multi-threshold / multi-tolerance fingerprint consensus.', 'Available for Gas Tube, Atomic, Molecular and Lamp presets. It disables the three manual peak/tolerance controls while active so identification is less dependent on hand-tuned settings.'],
      ['RGB', 'Checkbox', 'Adds RGB-channel support as an extra Smart weighting factor.', 'Use cautiously because camera spectral response and white balance can distort color-channel amplitudes.'],
      ['Strong Peak', 'Slider 1–5', 'Controls how strongly Smart rewards agreement with the strongest observed peaks.', 'Higher values focus ranking more strongly on dominant peaks; lower values give weaker features relatively more influence.'],
      ['Peak threshold', 'Number input, %', 'Relative LAB peak-detection threshold.', 'Starts at 1.5%. In supported presets with Auto tune enabled, this control is managed automatically; disable Auto tune for manual experiments.'],
      ['Peak distance', 'Number input, px', 'Minimum separation between LAB-detected peaks.', 'Small values resolve close peaks but may split noise/shoulders; large values merge nearby structures.'],
      ['Max distance (nm)', 'Number input', 'Hard wavelength mismatch cap for candidate line matching.', 'Tight values reduce coincidences but require good calibration. Loose values increase false coincidences. This is a hard cap, not a confidence score.'],
      ['Reload / Init libraries', 'Button', 'Loads or reloads spectral libraries in the worker.', 'Libraries now load automatically on first LAB entry. Use manually to recover/reload.'],
      ['Ping worker', 'Button', 'Checks whether the LAB Web Worker is alive/responding.', 'Diagnostic only; it does not analyze the spectrum.'],
      ['Query library', 'Button', 'Opens a library-line browser for the active wavelength range.', 'Use to inspect available reference lines independently of the ranking result.'],
      ['Library Search', 'Text input in popup', 'Filters query results by species/element text.', 'Examples include Fe, Na or isotope-like labels supported by the library.'],
      ['AI Interpretation', 'Button', 'Builds a compact package of the current measurement/analysis and opens the AI observation dialog.', 'Use after the measurement and LAB/fluorescence result are in a useful state.'],
      ['Narrow-line overlay', 'Fluorescent-only checkbox', 'Shows secondary narrow atomic-line coincidences over a broad fluorescence measurement.', 'Off by default because broad band shape is the primary evidence. Enable only when lamp leakage or a genuine narrow-line contribution is relevant.']
    ];

    const scoreRows = [
      ['El', 'Element or species label.', 'The candidate being scored.'],
      ['%', 'Score Share.', 'Relative share of positive candidate score. It is not probability, abundance or concentration.'],
      ['S', 'Total Smart score.', 'Internal combined score after matches, coverage/closeness bonuses and penalties. Compare within the same analysis, not across unrelated experiments.'],
      ['M', 'Matched evidence count.', 'Number of observed peaks or molecular band anchors supporting the candidate. More coherent evidence is generally stronger than one isolated match.'],
      ['X', 'Missed important signature features.', 'Expected profile features not found. A high missed count weakens the fingerprint, but “missing” does not mean every such feature must always be experimentally strong.'],
      ['Δ', 'Median wavelength mismatch in nm.', 'Lower is generally better when calibration is valid. Interpret relative to instrument resolution and the Max distance cap.']
    ];

    return '<section class="sp-help-section"><h2>LAB & Presets</h2><p>LAB loads its spectral libraries automatically on first entry and runs analysis in a Web Worker. Analysis settings affect detection and ranking; graph-display settings should not be confused with physical evidence.</p></section>' +
      '<section class="sp-help-section"><h3>Preset guide</h3><div class="sp-help-preset-grid">' +
        preset('Nearest / Wide / Tight / Fast', 'Simple local line matching.', 'Base presets emphasize direct wavelength proximity. Useful for manual inspection, but not as strong as a coherent fingerprint for source identification.') +
        preset('Lamp (Hg/Ar/Ne)', 'Simple lamp-oriented line matching.', 'A base lamp workflow with relevant species and atomic fingerprint refinement. Raw line count should not be interpreted as probability.') +
        preset('Atomic', 'Narrow atomic emission lines.', 'Uses curated multi-line fingerprints for H, He, Ne, Ar, Kr, Xe, Hg and O plus supporting library evidence.') +
        preset('Molecular', 'Band systems.', 'Uses multiple diagnostic bands and molecular-profile logic. One coincident band is weak evidence; coherent systems are stronger.') +
        preset('Gas Tube', 'Discharge tubes / mixed gas-like spectra.', 'Auto tune is enabled by default and evaluates several peak-threshold and wavelength-tolerance combinations, then ranks the stable fingerprint consensus. The same approach is available for Atomic, Molecular and Lamp presets; manual controls remain available for diagnostics. Combines atomic fingerprints with source-family restrictions and can coexist with molecular contributors.') +
        preset('Flame', 'Flame or mixed-emitter spectra.', 'Designed for flame-type conditions where atomic emitters and background/molecular contributions can coexist.') +
        preset('Fluorescent', 'Broad fluorescence.', 'Primary output is broadband shape: λmax, centroid, FWHM, band width, asymmetry, shoulders and integrated signal. Atomic labels are secondary and hidden by default.') +
      '</div></section>' +
      controlTable('LAB controls', 'These controls determine what the worker analyzes and how it finds evidence.', labRows) +
      '<section class="sp-help-section"><h3>TOP HITS / MATCH SCORE</h3><p>TOP HITS lists matched evidence and Smart groups. MATCH SCORE ranks candidates after refinement. A raw line coincidence and a coherent fingerprint are not the same thing.</p></section>' +
      controlTable('MATCH SCORE columns', 'The compact column labels are intentionally short in the live UI.', scoreRows.map(function (r) { return [r[0], 'Result column', r[1], r[2]]; })) +
      '<section class="sp-help-section"><h3>Fluorescent output</h3><dl class="sp-help-dl">' +
        '<dt>Broad emission band</dt><dd>Approximate band limits based on the corrected/smoothed broadband signal.</dd>' +
        '<dt>λmax</dt><dd>Wavelength of maximum broadband emission.</dd>' +
        '<dt>Centroid</dt><dd>Intensity-weighted center of the band. A red tail can shift centroid above λmax.</dd>' +
        '<dt>FWHM</dt><dd>Band width at half of the maximum intensity.</dd>' +
        '<dt>Band width</dt><dd>Broader approximate band span used by the fluorescence analyzer.</dd>' +
        '<dt>Asymmetry</dt><dd>balanced, red-tailed or blue-tailed according to relative band widths around λmax.</dd>' +
        '<dt>Shoulder</dt><dd>A secondary local structure sufficiently separated from the main maximum.</dd>' +
        '<dt>Integrated signal</dt><dd>Area under the baseline-corrected band in the analyzed range; useful for relative comparisons under consistent conditions, not concentration by itself.</dd>' +
      '</dl></section>' +
      plannedShot('Atomic / Gas Tube LAB', 'Show a calibrated gas-tube measurement with Smart find enabled, Top Hits visible and a populated Match Score table. Make sure El, %, S, M, X and Δ are readable.', 'help-lab-atomic.png') +
      plannedShot('Fluorescent LAB', 'Show a broad fluorescence spectrum with Narrow-line overlay OFF and the BAND FEATURES / FLUORESCENCE SUMMARY panels visible, including λmax, centroid, FWHM, band width and asymmetry.', 'help-lab-fluorescence.png');
  }

  function aiHtml() {
    const rows = [
      ['Observation text', 'Text area', 'Optional description of what was observed: source, experiment, color, gas, pressure, discharge, sample or other context.', 'Write naturally in any language. The AI normally answers in the same identifiable language; otherwise English. Context is evidence context, not an instruction to override the measured data.'],
      ['Analyze', 'Button', 'Sends the compact SPECTRA analysis package to the secure backend and requests interpretation.', 'A successful run receives a new Run ID / OpenAI response ID and token usage metadata.'],
      ['Cancel / ×', 'Buttons', 'Closes the AI dialog without starting another request.', 'Does not alter the current measurement.'],
      ['Copy text', 'Button after result', 'Copies the AI response text to the clipboard.', 'A “Text copied.” toast appears above the dialog without changing layout.'],
      ['Export', 'Button after result', 'Opens the unified export dialog after a completed AI interpretation.', 'The AI payload, response metadata and interpretation text are included in Data analysis JSON; the interpretation can also appear as a clearly marked appendix in the PDF report.'],
      ['New analysis', 'Button after result', 'Clears the previous AI result and returns the dialog to the observation/analyze state.', 'Use this before intentionally starting another OpenAI request.']
    ];

    return '<section class="sp-help-section"><h2>AI Interpretation</h2><p>AI Interpretation is the last layer in the workflow. SPECTRA measures and analyzes first; AI explains the supplied measurement, calibration, quality metrics and current SPECTRA result.</p></section>' +
      controlTable('AI dialog controls', '', rows) +
      '<section class="sp-help-section"><h3>What is sent</h3><ul>' +
        '<li>A compact normalized spectral trace plus exact detected/matched features.</li>' +
        '<li>Calibration state, points/coefficients and available range/quality information.</li>' +
        '<li>LAB settings and current preset.</li>' +
        '<li>Candidate scores/fingerprint evidence or fluorescence band metrics, depending on preset.</li>' +
        '<li>Data-quality/QC information.</li>' +
        '<li>Your optional observation text.</li>' +
      '</ul></section>' +
      '<section class="sp-help-section"><h3>Interpretation rules</h3><p>The AI should distinguish measured features, SPECTRA matches and physical interpretation. Score Share is relative ranking, not probability or abundance. For Fluorescent mode, broadband shape is primary evidence; narrow-line coincidences are secondary. The AI should state uncertainty when calibration, signal quality or pattern coverage is weak.</p></section>' +
      '<div class="sp-help-callout sp-help-callout--warn"><b>AI is not a second spectrometer.</b> It cannot recover clipped peaks, repair an inappropriate calibration, infer concentration from normalized intensity, or uniquely identify every fluorophore from a broad band without appropriate reference data.</div>' +
      plannedShot('AI Interpretation dialog', 'Show the AI dialog before analysis with a short observation, then a second screenshot after analysis showing the response, Copy text, Export, New analysis and the run/token metadata line.', 'help-ai-interpretation.png');
  }

  function qa(q, a) {
    return '<details class="sp-help-qa"><summary>' + q + '</summary><p>' + a + '</p></details>';
  }

  function qaHtml() {
    return '<section class="sp-help-section"><h2>Q&A and troubleshooting</h2></section>' +
      qa('Why does the graph show pixels instead of nm?', 'The X-axis is in px when calibration is not active or px is selected. Load/apply a valid calibration and switch X-axis to nm.') +
      qa('Why can the same peak match several elements?', 'The atomic library is dense and different species can have lines close together. Smart presets therefore use multi-line fingerprints and missed-feature penalties rather than treating one close wavelength as proof.') +
      qa('Why does Score Share show 100% if the result is still uncertain?', 'Score Share is normalized only across candidates with positive score. If only one candidate survives, its share is 100% even when evidence coverage is incomplete. It is not a probability.') +
      qa('Why do I see many Peaks but few Hits?', 'Peaks are local maxima detected from the measured signal. Hits are analysis matches that satisfy wavelength/preset rules. Noise or real unmatched features can increase Peaks without increasing valid Hits.') +
      qa('What does a high Peak Δ mean?', 'Matched observations are relatively far from their reference wavelengths. Check calibration, Max distance, image geometry and instrument resolution before trusting the species assignment.') +
      qa('Why is Headroom high but SNR poor?', 'Headroom only measures distance from clipping. A weak noisy signal can have enormous headroom and still have poor SNR.') +
      qa('Why can SNR look extremely high?', 'The internal SNR estimate uses median smoothed signal divided by robust residual noise. Very smooth/broad signals can produce a small noise estimate. Treat it as an internal diagnostic, not a calibrated detector specification.') +
      qa('Why did an old image identify the wrong gas?', 'A loaded image may come from a different camera resolution, crop or grating geometry. Reusing an incompatible calibration can shift every wavelength and change matching results.') +
      qa('What is the difference between Ref and RefG?', 'Ref is the processing reference image/trace used by Difference, Ratio, Transmittance and Absorbance. RefG is one or more graph-reference overlays used for visual/comparison display.') +
      qa('When should I use Weak peaks?', 'When a known physical pattern contains weak support features that are being missed. If enabling it produces many isolated coincidences, the result is becoming less selective.') +
      qa('Why does Fluorescent not show element Score Share?', 'Broad molecular fluorescence is characterized by band shape, not a forest of atomic line coincidences. Use Narrow-line overlay only for secondary lamp leakage or genuine narrow-line contributions.') +
      qa('Why is Narrow-line overlay off by default?', 'Because raw atomic coincidences inside a broad fluorescence band can look chemically meaningful when they are only wavelength proximity. The broadband shape should remain primary.') +
      qa('Why is the LAB library button called Reload libraries?', 'Libraries load automatically the first time LAB opens. The button remains as a manual reload/recovery action.') +
      qa('What does Ping worker do?', 'It checks communication with the analysis Web Worker. It is a diagnostic request and does not identify the spectrum.') +
      qa('What should I do if LAB shows no result?', 'Check: LAB active, Analyze on, libraries loaded, Worker not Off, calibrated nm axis for wavelength matching, useful peaks present, Max distance not unrealistically tight, and console/QC messages for errors.') +
      qa('What should I do if the UI looks stale after an update?', 'Use Ctrl+F5 on desktop or fully reload/reopen the page on mobile so versioned JavaScript assets are fetched again.') +
      '<section class="sp-help-section"><h3>Troubleshooting order</h3><ol><li>Verify source image and stripe.</li><li>Check saturation/headroom and signal quality.</li><li>Verify calibration and nm axis.</li><li>Confirm the preset matches the source physics.</li><li>Inspect peak threshold/distance and Max distance.</li><li>Check worker/library status and console messages.</li><li>Only then interpret Match Score or AI output.</li></ol></section>';
  }

  function tabHtml(id) {
    if (id === 'quick') return quickHtml();
    if (id === 'workspace') return workspaceHtml();
    if (id === 'controls') return controlsHtml();
    if (id === 'status') return statusHtml();
    if (id === 'calibration') return calibrationHtml();
    if (id === 'lab') return labHtml();
    if (id === 'ai') return aiHtml();
    if (id === 'qa') return qaHtml();
    return contentsHtml();
  }

  function installStyle() {
    if (!global.document || $('spHelpUiStyle')) return;
    const style = global.document.createElement('style');
    style.id = 'spHelpUiStyle';
    style.textContent = [
      'body.sp-help-open{overflow:hidden!important;}',
      '.sp-help-launch{margin-left:auto!important;display:inline-flex!important;align-items:center;gap:5px;border:1px solid #25b9c5!important;border-bottom:0!important;background:#092c40!important;color:#9ef4f5!important;padding:6px 10px!important;border-radius:5px 5px 0 0!important;font-size:10px!important;font-weight:850!important;letter-spacing:.035em!important;cursor:pointer!important;}',
      '.sp-help-launch:hover{background:#0e4057!important;color:#fff!important;}',
      '.sp-help-launch__q{width:15px;height:15px;border:1px solid currentColor;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;line-height:1;}',
      '.sp-help-overlay{position:fixed;inset:0;z-index:20000;background:rgba(0,7,13,.82);display:flex;align-items:center;justify-content:center;padding:4vh 3vw;backdrop-filter:blur(2px);}',
      '.sp-help-dialog{width:min(1540px,95vw);height:min(950px,92vh);background:#071a2b;border:1px solid #26b8c6;border-radius:10px;box-shadow:0 24px 80px rgba(0,0,0,.55),0 0 0 1px rgba(64,221,229,.08);display:flex;flex-direction:column;overflow:hidden;color:#d9eef3;font-family:inherit;}',
      '.sp-help-head{display:flex;align-items:center;gap:14px;padding:14px 18px;background:#082236;border-bottom:1px solid rgba(56,203,216,.34);}',
      '.sp-help-head__title{font-size:17px;font-weight:850;color:#a2f4f7;letter-spacing:.04em;}',
      '.sp-help-head__sub{font-size:11px;color:#81aab5;margin-top:2px;}',
      '.sp-help-close{margin-left:auto;border:0;background:transparent;color:#b9dce3;font-size:26px;line-height:1;cursor:pointer;padding:2px 8px;border-radius:5px;}',
      '.sp-help-close:hover,.sp-help-close:focus-visible{background:#10354a;color:#fff;outline:none;}',
      '.sp-help-tabs{display:flex;gap:3px;overflow-x:auto;padding:8px 12px 0;background:#071a2b;border-bottom:1px solid rgba(43,180,195,.22);scrollbar-width:thin;}',
      '.sp-help-tab{flex:0 0 auto;border:1px solid #168a9a;border-bottom:0;background:#09253a;color:#66ced6;padding:7px 11px;border-radius:5px 5px 0 0;font-size:9.5px;font-weight:800;letter-spacing:.035em;cursor:pointer;}',
      '.sp-help-tab:hover{color:#dfffff;background:#0c3149;}',
      '.sp-help-tab.is-active{background:#0d3b50;color:#91f3f2;border-color:#25bcc7;box-shadow:inset 0 -2px 0 #44d5dc;}',
      '.sp-help-body{flex:1;overflow:auto;padding:22px 26px 34px;scrollbar-color:#2c8290 #061522;}',
      '.sp-help-panel{max-width:1320px;margin:0 auto;}',
      '.sp-help-panel[hidden]{display:none!important;}',
      '.sp-help-hero{display:flex;gap:24px;justify-content:space-between;align-items:flex-start;padding:4px 0 16px;border-bottom:1px solid rgba(74,177,190,.18);}',
      '.sp-help-hero h1{margin:3px 0 8px;font-size:27px;line-height:1.15;color:#f0fdff;}',
      '.sp-help-hero p{max-width:900px;margin:0;color:#a8c8d0;line-height:1.6;font-size:13px;}',
      '.sp-help-kicker{font-size:10px;color:#53d9e0;font-weight:850;letter-spacing:.13em;}',
      '.sp-help-version{min-width:95px;text-align:center;border:1px solid #24566a;border-radius:7px;padding:10px;color:#86adb8;background:#071624;font-size:10px;}',
      '.sp-help-version b{display:block;color:#a9f5f6;font-size:15px;margin-top:2px;}',
      '.sp-help-callout{margin:18px 0;padding:11px 13px;border-left:3px solid #35c7d1;background:#0b2638;color:#b9d8df;font-size:12px;line-height:1.55;}',
      '.sp-help-callout--warn{border-left-color:#e7c44b;background:#292513;color:#e6ddb9;}',
      '.sp-help-toc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0 24px;}',
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
      '.sp-help-table-wrap{overflow:auto;border:1px solid #153f54;border-radius:7px;background:#071b2b;margin-top:10px;}',
      '.sp-help-ref{width:100%;border-collapse:collapse;min-width:920px;font-size:10.8px;line-height:1.5;}',
      '.sp-help-ref th{position:sticky;top:0;z-index:1;text-align:left;background:#0b3045;color:#9ef0f2;padding:8px 9px;border-bottom:1px solid #20546a;font-size:10px;letter-spacing:.025em;}',
      '.sp-help-ref td{vertical-align:top;padding:8px 9px;color:#abcbd2;border-bottom:1px solid rgba(52,151,166,.12);}',
      '.sp-help-ref tr:last-child td{border-bottom:0;}',
      '.sp-help-ref td:first-child{color:#d9f8fa;width:16%;}',
      '.sp-help-ref td:nth-child(2){color:#83aeb8;width:15%;}',
      '.sp-help-ref--metrics td:first-child{width:12%;}',
      '.sp-help-shot{margin:26px 0;}',
      '.sp-help-shot__frame{min-height:190px;border:1px dashed #2b6877;border-radius:8px;background:linear-gradient(135deg,#071624,#0b2434);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px;color:#9ec3cb;}',
      '.sp-help-shot__frame strong{color:#c9f8fa;font-size:14px;margin:7px 0;}',
      '.sp-help-shot__frame span{max-width:760px;font-size:11px;line-height:1.55;}',
      '.sp-help-shot__frame small{margin-top:10px;color:#628e99;font-size:9.5px;}',
      '.sp-help-shot__badge{font-size:9px;font-weight:850;letter-spacing:.1em;color:#e7c956;border:1px solid #8f762b;border-radius:3px;padding:3px 6px;}',
      '.sp-help-qa{border:1px solid #153e52;background:#081d2d;border-radius:6px;margin:7px 0;}',
      '.sp-help-qa summary{cursor:pointer;color:#c9f8fa;font-size:12px;font-weight:750;padding:11px 13px;}',
      '.sp-help-qa[open] summary{border-bottom:1px solid rgba(51,177,190,.18);background:#0a2638;}',
      '.sp-help-qa p{margin:0;padding:11px 13px;color:#a9c8d0;font-size:11.5px;line-height:1.6;}',
      '@media(max-width:1050px){.sp-help-toc{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '@media(max-width:900px){.sp-help-overlay{padding:1.5vh 1.5vw}.sp-help-dialog{width:97vw;height:95vh}.sp-help-body{padding:16px}.sp-help-preset-grid{grid-template-columns:1fr 1fr}.sp-help-grid2{grid-template-columns:1fr}.sp-help-hero{flex-direction:column}.sp-help-version{display:none}}',
      '@media(max-width:620px){.sp-help-toc,.sp-help-preset-grid{grid-template-columns:1fr}.sp-help-dl{grid-template-columns:1fr}.sp-help-dl dd{padding-top:0}.sp-help-launch{padding:5px 8px}.sp-help-launch__q{margin-right:3px}.sp-help-body{padding:12px}.sp-help-ref{min-width:760px}}'
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
      '<header class="sp-help-head"><div><div id="spHelpTitle" class="sp-help-head__title">SPECTRA PRO HELP</div><div class="sp-help-head__sub">Complete control, measurement, calibration and analysis reference</div></div>' +
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
