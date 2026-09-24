// ###########
//    Video
// ###########

// Video element
let videoElement = document.getElementById('videoMain');
// Camera selection dropdown
const cameraSelect = document.getElementById('cameraSelect');
//current camera used
let cameraUsed = "";
// Exposure slider
const exposureSlider = document.getElementById('exposure');
let exposureValues = [];

const AUTO_PAUSE_TARGET_INTENSITY = 240;
const AUTO_PAUSE_MIN_INTENSITY = 238;
const AUTO_PAUSE_MAX_INTENSITY = 248;
const AUTO_PAUSE_REQUIRED_FRAMES = 2;
let autoPauseArmed = false;
let autoPauseStableFrames = 0;
let autoPauseLastPeak = null;

function appendCameraConsole(message) {
    const text = String(message || '');
    try {
        const sp = window.SpectraPro || {};
        if (sp.consoleLog && typeof sp.consoleLog.append === 'function') {
            sp.consoleLog.append(text);
            return;
        }
    } catch (_) {}
    try { console.log(text); } catch (_) {}
}

function setCameraPlaybackUi(isLivePlaying) {
    const pause = document.getElementById('pauseVideoButton');
    const live = document.getElementById('liveVideoButton');
    const legacyPlay = document.getElementById('playVideoButton');
    if (pause) {
        pause.style.visibility = 'visible';
        pause.disabled = !isLivePlaying;
    }
    if (live) live.setAttribute('aria-pressed', isLivePlaying ? 'true' : 'false');
    if (legacyPlay) {
        legacyPlay.style.display = 'none';
        legacyPlay.style.visibility = 'hidden';
    }
}

function updateAutoPauseUi() {
    const button = document.getElementById('autoPauseButton');
    if (!button) return;
    button.setAttribute('aria-pressed', autoPauseArmed ? 'true' : 'false');
    button.textContent = autoPauseArmed ? 'Auto Pause ●' : 'Auto Pause';
    button.title = autoPauseArmed
        ? 'Armed: pauses after a stable live peak reaches 238–248.'
        : 'Arm one-shot auto pause near peak intensity 240, before clipping.';
}

function disarmAutoPause(reason) {
    const wasArmed = autoPauseArmed;
    autoPauseArmed = false;
    autoPauseStableFrames = 0;
    autoPauseLastPeak = null;
    updateAutoPauseUi();
    if (wasArmed && reason) appendCameraConsole('[AUTO PAUSE] ' + reason);
}

function isLiveCameraPlaying() {
    try {
        const live = document.getElementById('videoMain');
        return !!(live && videoElement === live && live.srcObject && !live.paused && !live.ended);
    } catch (_) {
        return false;
    }
}

function handleAutoPauseFrame(frame) {
    if (!autoPauseArmed || !isLiveCameraPlaying()) return;
    const values = frame && Array.isArray(frame.I) ? frame.I : [];
    if (!values.length) return;

    let peak = 0;
    for (let i = 0; i < values.length; i += 1) {
        const value = Number(values[i]);
        if (Number.isFinite(value) && value > peak) peak = value;
    }
    autoPauseLastPeak = peak;

    if (peak >= AUTO_PAUSE_MIN_INTENSITY && peak <= AUTO_PAUSE_MAX_INTENSITY) {
        autoPauseStableFrames += 1;
    } else {
        autoPauseStableFrames = 0;
    }

    if (autoPauseStableFrames >= AUTO_PAUSE_REQUIRED_FRAMES) {
        const capturedPeak = Math.round(peak);
        autoPauseArmed = false;
        autoPauseStableFrames = 0;
        updateAutoPauseUi();
        appendCameraConsole('[AUTO PAUSE] Captured · peak ' + capturedPeak + ' / 255');
        pauseVideo({ autoPause: true });
    }
}

async function toggleAutoPause() {
    if (autoPauseArmed) {
        disarmAutoPause('Disarmed.');
        return;
    }
    if (!isLiveCameraPlaying()) {
        await goLiveCamera();
    }
    if (!isLiveCameraPlaying()) {
        appendCameraConsole('[AUTO PAUSE] Could not arm: live camera is unavailable.');
        return;
    }
    autoPauseArmed = true;
    autoPauseStableFrames = 0;
    autoPauseLastPeak = null;
    updateAutoPauseUi();
    appendCameraConsole('[AUTO PAUSE] Armed · target ' + AUTO_PAUSE_TARGET_INTENSITY + ' / 255');
}

let cameraOutputHeight;
let cameraOutputWidth;

function refreshActiveSourceMetrics() {
    try {
        if (!videoElement) return;
        const isImg = videoElement instanceof HTMLImageElement;
        const w = isImg ? Number(videoElement.naturalWidth || videoElement.width || 0) : Number(videoElement.videoWidth || videoElement.clientWidth || 0);
        const h = isImg ? Number(videoElement.naturalHeight || videoElement.height || 0) : Number(videoElement.videoHeight || videoElement.clientHeight || 0);
        if (Number.isFinite(w) && w > 0) cameraOutputWidth = w;
        if (Number.isFinite(h) && h > 0) cameraOutputHeight = h;
        const widthRange = document.getElementById("stripeWidthRange");
        const placeRange = document.getElementById("stripePlacementRange");
        if (widthRange && cameraOutputHeight) widthRange.max = cameraOutputHeight;
        if (placeRange && cameraOutputHeight) placeRange.max = cameraOutputHeight;
    } catch (_) {}
}

(function exposeSpectraRuntime(){
    const sp = window.SpectraPro || (window.SpectraPro = {});
    sp.runtime = sp.runtime || {};
    sp.runtime.getVideoElement = function(){ return videoElement; };
    sp.runtime.setVideoElement = function(el){
        if (!el) return videoElement;
        try {
            if (window.SpectraCore && window.SpectraCore.graph && typeof window.SpectraCore.graph.clearNumericFrame === 'function') {
                window.SpectraCore.graph.clearNumericFrame({ redraw: false });
            }
        } catch (_) {}
        videoElement = el;
        refreshActiveSourceMetrics();
        return videoElement;
    };
    sp.runtime.refreshActiveSourceMetrics = refreshActiveSourceMetrics;
    sp.runtime.setSourceMetrics = function(width, height){
        const w = Number(width);
        const h = Number(height);
        if (Number.isFinite(w) && w > 0) cameraOutputWidth = w;
        if (Number.isFinite(h) && h > 0) cameraOutputHeight = h;
        const widthRange = document.getElementById("stripeWidthRange");
        const placeRange = document.getElementById("stripePlacementRange");
        if (widthRange && Number.isFinite(cameraOutputHeight) && cameraOutputHeight > 0) {
            widthRange.max = String(Math.max(1, Math.round(cameraOutputHeight)));
        }
        if (placeRange && Number.isFinite(cameraOutputHeight) && cameraOutputHeight > 0) {
            placeRange.max = String(Math.max(1, Math.round(cameraOutputHeight)));
        }
        return { width: cameraOutputWidth, height: cameraOutputHeight };
    };
    sp.runtime.isSourceLive = function(){
        try { return !!(videoElement && videoElement.id === 'videoMain' && videoElement.srcObject); } catch(_) { return false; }
    };
})();


/**
 * Start streaming video from the specified deviceId
 * @param deviceId
 */
async function startStream(deviceId) {
    const sourceWindow = document.getElementById('videoMainWindow');
    const liveVideo = document.getElementById('videoMain');
    if (!liveVideo) return false;
    if (sourceWindow) sourceWindow.classList.remove('sp-numeric-source');

    const constraints = {
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        try {
            const previous = liveVideo.srcObject;
            if (previous && previous !== stream && typeof previous.getTracks === 'function') {
                previous.getTracks().forEach(track => track.stop());
            }
        } catch (_) {}

        liveVideo.srcObject = stream;
        if (deviceId) cameraUsed = deviceId;

        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack && typeof videoTrack.getCapabilities === 'function'
            ? videoTrack.getCapabilities()
            : {};

        if (videoTrack && 'exposureMode' in capabilities) {
            await videoTrack.applyConstraints({ advanced: [{ exposureMode: 'manual' }] });

            if ('exposureTime' in capabilities) {
                const { min, max, step } = capabilities.exposureTime;
                updateExposureSlider(min, max, step);
                await videoTrack.applyConstraints({
                    advanced: [{ exposureTime: exposureValues[exposureSlider.value] }]
                });
            }
            exposureSlider.onchange = () => {
                if ('exposureTime' in capabilities) {
                    videoTrack.applyConstraints({
                        advanced: [{ exposureTime: parseFloat(exposureValues[exposureSlider.value]) }]
                    });
                }
            };
        } else {
            const exposureElement = document.getElementById('cameraExposure');
            if (exposureElement) exposureElement.remove();
            showInfoPopup("exposureUnsupportedBrowser", "acknowledge");
        }

        liveVideo.onloadedmetadata = () => {
            cameraOutputWidth = liveVideo.videoWidth;
            cameraOutputHeight = liveVideo.videoHeight;
            document.getElementById("stripeWidthRange").max = cameraOutputHeight;
            document.getElementById("stripePlacementRange").max = cameraOutputHeight;
            document.getElementById("stripePlacementRange").value = cameraOutputHeight * yPercentage;
            document.getElementById("stripePlacementValue").textContent = getStripePositionRangeText();

            if (liveVideo.videoWidth === 1280) {
                document.getElementById("videoMainWindow").style.height = "214px";
            }
            if (videoElement === liveVideo) plotRGBLineFromCamera();
        };

        return true;
    } catch (error) {
        callError("cameraNotFoundError");
        return false;
    }
}

/**
 * Get the available video devices (cameras)
 */
async function getCameras() {
    try {
        const previousDevice = (cameraSelect && cameraSelect.value) || cameraUsed || '';
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (cameraSelect != null) {
            cameraSelect.innerHTML = '';
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(option);
            });
        }

        if (videoDevices.length > 0) {
            const preferred = videoDevices.find(device => device.deviceId === previousDevice) || videoDevices[0];
            cameraUsed = preferred.deviceId;
            if (cameraSelect) cameraSelect.value = cameraUsed;
            await goLiveCamera({ restartStream: true, keepAutoPause: true });
        }
    } catch (error) {
        console.error('Error fetching devices: ', error);
    }
}

/**
 * Request camera access first to ensure permissions are granted
 */
async function requestCameraAccess() {
    try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } });
        try {
            if (permissionStream && typeof permissionStream.getTracks === 'function') {
                permissionStream.getTracks().forEach(track => track.stop());
            }
        } catch (_) {}
        await getCameras();
    } catch (error) {
        callError("cameraAccessDeniedError");
    }
}

/**
 * Resets the camera stream with the currently selected camera.
 */
async function resetCamera() {
    const selected = cameraSelect && cameraSelect.value ? cameraSelect.value : cameraUsed;
    if (selected) cameraUsed = selected;

    const liveVideo = document.getElementById('videoMain');
    if (liveVideo) videoElement = liveVideo;

    const started = await startStream(cameraUsed);
    if (started && liveVideo) {
        try { await liveVideo.play(); } catch (_) {}
    }
    setCameraPlaybackUi(!!started);
    return !!started;
}

/**
 * Event listener to switch between cameras. Selecting a camera also returns
 * from images/examples to a live source, which keeps the source model explicit.
 */
if (cameraSelect != null) {
    cameraSelect.addEventListener('change', () => {
        cameraUsed = cameraSelect.value;
        goLiveCamera({ restartStream: true });
    });
}

/**
 * @returns the width and height from the camera resolution
 */
function getCameraResolutionHeight() {
    return cameraOutputHeight;
}

/**
 * @returns the width and height from the camera resolution
 */
function getCameraResolutionWidth() {
    return cameraOutputWidth;
}

/**
 * Updates the exposureSlider to the given values
 * @param max
 * @param min
 * @param step
 */
function updateExposureSlider(min, max, step) {

    exposureValues = generateStepValues(min, max, step);

    exposureSlider.min = 0;
    exposureSlider.max = exposureValues.length-1;
    exposureSlider.step = 1;

    if (exposureSlider.max > 3) {
        exposureSlider.value = 3;
    } else {
        exposureSlider.value = 0;
    }

    updateExposureValue(exposureSlider.value);
}

/**
 * Returns an array of generated steps for the exposure slider
 */
function generateStepValues(min, max, step) {
    const values = [];
    let current = min;
    let i = 0;

    while (current <= max) {
        values.push(current);
        current += step * 2 ** i;
        i++;
    }

    return values;
}

/**
 * Sets the text for the exposureSlider to the value
 * @param value
 */
function updateExposureValue(value) {
    document.getElementById('exposureValue').textContent = (value - exposureSlider.max).toString();
}

/**
 * Pauses the video stream
 */
async function pauseVideo(options = {}) {
    const liveVideo = document.getElementById('videoMain');
    if (!liveVideo || videoElement !== liveVideo || !liveVideo.srcObject) {
        setCameraPlaybackUi(false);
        return false;
    }
    if (!options.autoPause && autoPauseArmed) disarmAutoPause('Disarmed by manual pause.');
    try { liveVideo.pause(); } catch (_) {}
    setCameraPlaybackUi(false);
    return true;
}

/**
 * Explicitly returns to the selected live camera from Pause, images or bundled
 * examples. Manual calibration is preserved; sample-owned calibration is reset
 * by getBackToCameraStream().
 */
async function goLiveCamera(options = {}) {
    if (!options.keepAutoPause && autoPauseArmed) disarmAutoPause('Disarmed by Live.');

    const selected = cameraSelect && cameraSelect.value ? cameraSelect.value : cameraUsed;
    if (selected) cameraUsed = selected;

    try {
        if (typeof switchLoadedImageSettings === 'function') switchLoadedImageSettings();
    } catch (_) {}

    let numericFrame = null;
    try {
        numericFrame = window.SpectraCore && window.SpectraCore.graph && typeof window.SpectraCore.graph.getNumericFrame === 'function'
            ? window.SpectraCore.graph.getNumericFrame()
            : null;
    } catch (_) {}

    const liveVideo = document.getElementById('videoMain');
    const needsSourceTransition = !!numericFrame || videoElement !== liveVideo ||
        (typeof HTMLImageElement !== 'undefined' && videoElement instanceof HTMLImageElement);

    if (needsSourceTransition) return await getBackToCameraStream();

    if (options.restartStream || !liveVideo || !liveVideo.srcObject) {
        return await resetCamera();
    }

    try {
        await liveVideo.play();
        setCameraPlaybackUi(true);
        return true;
    } catch (_) {
        return await resetCamera();
    }
}

/**
 * Legacy play API now maps to the explicit Live action.
 */
async function playVideo(){
    return await goLiveCamera();
}

function resetBundledExampleStateForCamera() {
    const sourceWindow = document.getElementById('videoMainWindow');
    const exampleId = sourceWindow && sourceWindow.dataset
        ? String(sourceWindow.dataset.spectraExampleId || '')
        : '';
    if (!exampleId) return false;

    try {
        const calibration = window.SpectraCore && window.SpectraCore.calibration;
        if (calibration && typeof calibration.reset === 'function') {
            calibration.reset({ source: 'sample-exit' });
        } else if (typeof resetCalibrationPoints === 'function') {
            resetCalibrationPoints({ source: 'sample-exit' });
        }
    } catch (_) {}

    try {
        const px = document.getElementById('toggleXLabelsPx');
        const nm = document.getElementById('toggleXLabelsNm');
        if (px) px.checked = true;
        if (nm) nm.checked = false;
        if (px) px.dispatchEvent(new Event('change', { bubbles: true }));
        const proxy = document.getElementById('spXAxisMode');
        if (proxy) proxy.value = 'px';
    } catch (_) {}

    try {
        if (sourceWindow) sourceWindow.classList.remove('sp-numeric-source');
        if (sourceWindow && sourceWindow.dataset) delete sourceWindow.dataset.spectraExampleId;
        const preview = document.getElementById('spFramePreviewCanvas');
        if (preview) preview.style.display = 'none';
        const sp = window.SpectraPro || {};
        if (sp.exampleSpectrumUi && typeof sp.exampleSpectrumUi.clearActiveMarker === 'function') {
            sp.exampleSpectrumUi.clearActiveMarker();
        }
    } catch (_) {}

    try {
        const sp = window.SpectraPro || {};
        if (sp.store && typeof sp.store.update === 'function') {
            sp.store.update('display.xAxisMode', 'px', { source: 'camera.returnFromExample' });
        }
    } catch (_) {}

    return true;
}

/**
 * Changes the videoElement from img to video, so the camera can be used
 */
async function getBackToCameraStream(){
    const returnedFromBundledExample = resetBundledExampleStateForCamera();
    try {
        if (window.SpectraCore && window.SpectraCore.graph && typeof window.SpectraCore.graph.clearNumericFrame === 'function') {
            window.SpectraCore.graph.clearNumericFrame({ redraw: false });
        }
    } catch (_) {}

    if (videoElement) videoElement.style.display = 'none';
    videoElement = document.getElementById('videoMain');
    if (!videoElement) return false;
    videoElement.style.display = 'block';

    const selected = cameraSelect && cameraSelect.value ? cameraSelect.value : cameraUsed;
    if (selected) cameraUsed = selected;

    const started = await resetCamera();
    try { syncCanvasToVideo(); } catch (_) {}

    if (returnedFromBundledExample) {
        try {
            needToRecalculateMaxima = true;
            if (typeof redrawGraphIfLoadedImage === 'function') redrawGraphIfLoadedImage(true);
        } catch (_) {}
    }
    return started;
}

/**
 * Returns the width of the element (video or image)
 * @param element
 * @returns {number}
 */
function getElementWidth(element) {
    try {
        const numericFrame = window.SpectraPro && window.SpectraPro.coreBridge && window.SpectraPro.coreBridge.numericFrame;
        if (numericFrame && Array.isArray(numericFrame.I) && numericFrame.I.length) return numericFrame.I.length;
    } catch (_) {}
    if (element instanceof HTMLVideoElement) {
        return element.videoWidth;
    } else if (element instanceof HTMLImageElement) {
        return element.naturalWidth;
    } else {
        throw new Error('Unsupported element type');
    }
}

/**
 * Returns the height of the element (video or image)
 * @param element
 * @returns {number}
 */
function getElementHeight(element) {
    try {
        const numericFrame = window.SpectraPro && window.SpectraPro.coreBridge && window.SpectraPro.coreBridge.numericFrame;
        if (numericFrame && Array.isArray(numericFrame.I) && numericFrame.I.length) {
            const previewHeight = Number(numericFrame.previewHeight || numericFrame.sourceHeight);
            return Number.isFinite(previewHeight) && previewHeight > 0 ? previewHeight : 1;
        }
    } catch (_) {}
    if (element instanceof HTMLVideoElement) {
        return element.videoHeight;
    } else if (element instanceof HTMLImageElement) {
        return element.naturalHeight;
    } else {
        throw new Error('Unsupported element type');
    }
}

// Request access and populate the camera list when the page loads
requestCameraAccess();

// #####################
//    Camera Exposure
// #####################

let isRecording = false;


/**
 * Closes the camera exposure window
 */
function closeCameraExposure(){
    changeSettingsScreen("Graph");
}

/**
 * Terminates the ongoing recording
 */
function stopOngoingRecording(){
    if (isRecording) {
        isRecording = false;
        playVideo();
        closeCameraRecordingWindow();
    }
}

/**
 * Starts the recording of the graph
 */
function startCameraCapture(){
    if (videoElement.paused){
        playVideo();
    }

    const inputRange = document.getElementById("NumOfSamples").value;
    const inputTime = document.getElementById("timeOfPause").value;
    const checkboxGraph = document.getElementById("screenshotOfGraph");

    if (isNaN(inputRange) || inputRange <= 0) {
        callError("tooLowNumOfCapturesError")
        document.getElementById("NumOfSamples").focus();
        return;
    }
    if (isNaN(inputTime) || inputTime < 200) {
        callError("lowGapBetweenCapturesError");
        document.getElementById("timeOfPause").focus();
        return;
    }
    if (checkboxGraph.checked && noGraphShown()) {
        callError("noGraphSelectedError");
        return;
    }

    let imageIndex = 0;

    /**
     * Creates one shot during the recording
     */
    async function captureGraph() {
        if(!isRecording){
            return;
        }

        await videoElement.play();
        await new Promise(resolve => setTimeout(resolve, 200));
        await videoElement.pause();

        saveCameraImage();

        if (checkboxGraph.checked) {
            saveGraphImage();
            saveGraphValues();
        }

        imageIndex++;
        if(!isRecording){
            return;
        }

        if (imageIndex < inputRange) {
            setTimeout(captureGraph, inputTime-200);
        } else {
            videoElement.play();
            isRecording = false;
            closeCameraRecordingWindow();
        }
    }

    isRecording = true;
    closeCameraExposure();
    showCameraRecordingWindow();
    captureGraph();
}

function noGraphShown() {
    const checkboxCombined = document.getElementById("toggleCombined");
    const checkboxRed = document.getElementById("toggleR");
    const checkboxGreen = document.getElementById("toggleG");
    const checkboxBlue = document.getElementById("toggleB");

    return !checkboxCombined.checked && !checkboxRed.checked && !checkboxGreen.checked && !checkboxBlue.checked
}

/* SPECTRA PRO camera bridge */

(function(){
  const sp = window.SpectraPro || (window.SpectraPro = {});
  sp.runtime = sp.runtime || {};

  if (sp.coreHooks && typeof sp.coreHooks.on === 'function' && !sp.runtime.autoPauseFrameHookInstalled) {
    sp.runtime.autoPauseFrameHookInstalled = true;
    sp.coreHooks.on('graphFrame', handleAutoPauseFrame);
  }

  window.SpectraCore = window.SpectraCore || {};
  window.SpectraCore.camera = Object.assign(window.SpectraCore.camera || {}, {
    startCamera: window.getCameras || window.startCamera || function(){},
    live: window.goLiveCamera || function(){},
    resetCamera: window.resetCamera || function(){},
    pause: window.pauseVideo || function(){},
    play: window.playVideo || function(){},
    autoPause: {
      toggle: window.toggleAutoPause || function(){},
      disarm: disarmAutoPause,
      target: AUTO_PAUSE_TARGET_INTENSITY,
      min: AUTO_PAUSE_MIN_INTENSITY,
      max: AUTO_PAUSE_MAX_INTENSITY
    }
  });

  setCameraPlaybackUi(isLiveCameraPlaying());
  updateAutoPauseUi();
})();
