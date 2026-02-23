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

let cameraOutputHeight;
let cameraOutputWidth;

/**
 * Start streaming video from the specified deviceId
 * @param deviceId
 */
async function startStream(deviceId) {
    const constraints = {
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();

        if ('exposureMode' in capabilities) {
            await videoTrack.applyConstraints({
                advanced: [{ exposureMode: 'manual' }]
            });

            if ('exposureTime' in capabilities) {
                const { min, max, step } = capabilities.exposureTime;

                updateExposureSlider(min, max, step);

                await videoTrack.applyConstraints({
                    advanced: [{ exposureTime: exposureValues[exposureSlider.value] }]
                });
            }
            exposureSlider.addEventListener('change', () => {
                videoTrack.applyConstraints({
                    advanced: [{ exposureTime: parseFloat(exposureValues[exposureSlider.value]) }]
                });
            });
        } else {
            const exposureElement = document.getElementById('cameraExposure');
            if (exposureElement) { exposureElement.remove(); }

            showInfoPopup("exposureUnsupportedBrowser", "acknowledge");
        }

        videoElement.onloadedmetadata = () => {
            cameraOutputWidth = videoElement.videoWidth;
            cameraOutputHeight = videoElement.videoHeight;
            document.getElementById("stripeWidthRange").max = cameraOutputHeight;
            document.getElementById("stripePlacementRange").max = cameraOutputHeight;
            document.getElementById("stripePlacementRange").value = cameraOutputHeight * yPercentage;
            document.getElementById("stripePlacementValue").textContent = getStripePositionRangeText();

            if (videoElement.videoWidth === 1280) {
                document.getElementById("videoMainWindow").style.height = "214px";
            }
            plotRGBLineFromCamera();
        };
    } catch (error) {
        callError("cameraNotFoundError");
    }
}

/**
 * Get the available video devices (cameras)
 */
async function getCameras() {
    try {
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
            await startStream(videoDevices[0].deviceId);
            cameraUsed = videoDevices[0].deviceId;
        }
    } catch (error) {
        console.error('Error fetching devices: ', error);
    }
    resetCamera();
    getBackToCameraStream();
}

/**
 * Request camera access first to ensure permissions are granted
 */
async function requestCameraAccess() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } });
        await getCameras();
    } catch (error) {
        callError("cameraAccessDeniedError");
    }
}

/**
 * Resets the camera stream with the current camera
 */
async function resetCamera() {
    document.getElementById("pauseVideoButton").style.visibility = "visible";
    document.getElementById("playVideoButton").style.visibility = "hidden";
    await startStream(cameraUsed);
}

/**
 * Event listener to switch between cameras
 */
if (cameraSelect != null) {
    cameraSelect.addEventListener('change', () => {
        startStream(cameraSelect.value);
        cameraUsed = cameraSelect.value;
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
async function pauseVideo(){
    videoElement.pause();
    document.getElementById("pauseVideoButton").style.visibility = "hidden";
    document.getElementById("playVideoButton").style.visibility = "visible";

}

/**
 * Plays the video stream, also accounts for loaded image
 */
async function playVideo(){
    if (videoElement instanceof HTMLImageElement) {
        switchLoadedImageSettings();
        getBackToCameraStream();
    } else {
        videoElement.play();
        document.getElementById("pauseVideoButton").style.visibility = "visible";
        document.getElementById("playVideoButton").style.visibility = "hidden";
    }
}

/**
 * Changes the videoElement from img to video, so the camera can be used
 */
function getBackToCameraStream(){
    videoElement.style.display = 'none';
    videoElement = document.getElementById('videoMain');
    videoElement.style.display = 'block';
    document.getElementById("pauseVideoButton").style.visibility = "visible";
    document.getElementById("playVideoButton").style.visibility = "hidden";
    resetCamera();
    syncCanvasToVideo();
}

/**
 * Returns the width of the element (video or image)
 * @param element
 * @returns {number}
 */
function getElementWidth(element) {
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

/* SPECTRA-PRO Phase 0 hook patch */

(function(){
  window.SpectraCore = window.SpectraCore || {};
  window.SpectraCore.camera = Object.assign(window.SpectraCore.camera || {}, {
    startCamera: window.getCameras || window.startCamera || function(){},
    resetCamera: window.resetCamera || function(){},
    pause: window.pauseVideo || function(){},
    play: window.playVideo || function(){}
  });
})();
