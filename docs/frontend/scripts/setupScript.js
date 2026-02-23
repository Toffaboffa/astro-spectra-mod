/**
 * Changes the active settings screen on the left sidebar
 */
function changeSettingsScreen(changeTo) {
    const show = (id, display = 'block') => document.getElementById(id).style.display = display;
    const hide = (id) => show(id, 'none');

    const hideAll = () => {
        hide('cameraMainWindow');

        hide('cameraSettings')
        hide('graphWindowContainer');

        hide('calibrationSettings');
        hide('calibrationWindowContainer');

        hide('cameraExposureWindow');
    };

    hideAll();

    if (changeTo === "Graph") {
        show('cameraMainWindow');
        show('cameraSettings', 'flex')
        show('graphWindowContainer');

        changeDisplayScreen('main');
        changeDisplayScreen('settings');
        changeDisplayScreen('graph');
    } else if (changeTo === "Calibration") {
        show('calibrationSettings', 'flex');
        show('calibrationWindowContainer');

        changeDisplayScreen('main');
        changeDisplayScreen('settings');
    } else if (changeTo === "LongExpo") {
        show('cameraMainWindow');
        show('cameraExposureWindow', 'flex');
        show('graphWindowContainer');

        changeDisplayScreen('main');
        changeDisplayScreen('settings');
        changeDisplayScreen('graph');
    }

    setTimeout(() => {
        resizeCanvasToDisplaySize(graphCtx, graphCanvas, "Normal");
        resizeCanvasToDisplaySize(graphCtxCalibration, graphCanvasCalibration, "Calibration");
        resizeCanvasToDisplaySize(graphCtxDivergence, graphCanvasDivergence, "Divergence");
    }, 300);
}

/**
 * Changes which sections are displayed on the main screen
 */
function changeDisplayScreen(action) {
    const bottomDrawer = document.getElementById('graphSettingsDrawer');
    const drawerDetectionArea = document.getElementById('drawerHoverZone');
    const drawerHandle = document.getElementById('drawerExpandButton');

    const settings = document.getElementById('sidebar-left');
    const leftHandle = document.getElementById('sidebarToggleHandleLeft');
    const leftDetectionArea = document.getElementById('sidebarHoverZoneLeft');

    const imageSelection = document.getElementById('sidebar-right')
    const rightHandle = document.getElementById('sidebarToggleHandleRight');
    const rightDetectionArea = document.getElementById('sidebarHoverZoneRight');

    const graphCanvas = document.getElementById("graphCanvas");

    if (action === "main") {
        imageSelection.classList.add('hidden');
        settings.classList.add('hidden');
        bottomDrawer.classList.add('hidden');

        leftHandle.classList.remove('moved');
        leftDetectionArea.classList.remove('moved');

        rightHandle.classList.remove('moved');
        rightDetectionArea.classList.remove('moved');

        graphCanvas.classList.remove("withDrawer");
    } else if (action === "settings") {
        const isHidden = settings.classList.toggle('hidden');
        leftHandle.innerHTML = isHidden ? '▷' : '◁';

        leftHandle.classList.toggle('moved');
        leftDetectionArea.classList.toggle('moved');

        const playButton = document.getElementById("playVideoButton");
        if (window.getComputedStyle(playButton).visibility === 'hidden') {
            playVideo();
        }
    } else if (action === "imgSelect") {
        const isHidden = imageSelection.classList.toggle('hidden');
        rightHandle.innerHTML = isHidden ? '◁' : '▷';

        rightHandle.classList.toggle('moved');
        rightDetectionArea.classList.toggle('moved');
    } else if (action === "drawer") {
        bottomDrawer.classList.toggle('hidden')
        graphCanvas.classList.toggle("withDrawer");
        drawerDetectionArea.classList.toggle('disabled');
        drawerHandle.classList.toggle('disabled');
    } else if (action === "graph") {
        bottomDrawer.classList.remove('hidden');
        graphCanvas.classList.add("withDrawer");
        drawerDetectionArea.classList.add('disabled');
        drawerHandle.classList.add('disabled');
    }

    setTimeout(matchGraphHeightWithDrawer, 100);
    document.activeElement.blur();
}

/**
 * Sets the maximum height for the canvas based on the height of the drawer
 */
function matchGraphHeightWithDrawer() {
    const canvas = document.getElementById("graphCanvas");
    const drawer = document.getElementById('graphSettingsDrawer');

    const sidebarHoverZoneLeft = document.getElementById('sidebarHoverZoneLeft');
    const sidebarHoverZoneRight = document.getElementById('sidebarHoverZoneRight');

    const fixedOffset = 50 + 16; // pixels (16px ~= 1rem)
    const fixedHoverOffset = 30; // drawerHoverZone

    if (canvas.classList.contains('withDrawer')) {
        const drawerHeight = drawer.getBoundingClientRect().height;
        const adjustedHeight = document.body.getBoundingClientRect().height - drawerHeight - fixedOffset;
        canvas.style.height = `${adjustedHeight}px`;

        const hoverZoneHeight = document.body.getBoundingClientRect().height - drawerHeight;
        sidebarHoverZoneLeft.style.maxHeight = `${hoverZoneHeight}px`;
        sidebarHoverZoneRight.style.maxHeight = `${hoverZoneHeight}px`;
    } else {
        canvas.style.height = `calc(100vh - ${fixedOffset}px)`;
        sidebarHoverZoneLeft.style.maxHeight = `calc(100vh - ${fixedHoverOffset}px`;
        sidebarHoverZoneRight.style.maxHeight = `calc(100vh - ${fixedHoverOffset}px`;
    }
}

window.addEventListener('resize', () => {
    matchGraphHeightWithDrawer();
});
document.addEventListener('DOMContentLoaded', matchGraphHeightWithDrawer);

function callError(errorMessageTranslate) {
    document.activeElement.blur()
    const errorMessageSpan = document.getElementById('errorMessage');
    errorMessageSpan.dataset.translate = errorMessageTranslate;
    updateTextContent();

    const box = document.getElementById("errorBox");
    box.classList.add('show');

    const blocker = document.getElementById("errorBlock");
    blocker.classList.add('show');
}

function uncallError() {
    const box = document.getElementById("errorBox");
    box.classList.remove('show');

    const blocker = document.getElementById("errorBlock");
    blocker.classList.remove('show');
}

document.getElementById("errorBlock").addEventListener("click", () => {
    uncallError();
})

/**
 * Opens a message window
 */
function showInfoPopup(messageTranslate, buttonTranslate){
    document.activeElement.blur()
    const messageSpan = document.getElementById('infoPopupMessage');
    messageSpan.dataset.translate = messageTranslate;

    const button = document.getElementById("infoPopupButton");
    button.dataset.translate = buttonTranslate;
    updateTextContent();

    const popupWindow = document.getElementById("infoPopup");
    popupWindow.classList.add('show');

    const blocker = document.getElementById("infoPopupBlock");
    blocker.classList.add('show');
}

/**
 * Closes the message window
 */
function closeInfoPopup(){
    const popupWindow = document.getElementById("infoPopup");
    popupWindow.classList.remove('show');

    const blocker = document.getElementById("infoPopupBlock");
    blocker.classList.remove('show');
    const buttonContainer = document.getElementById('infoPopupButtonContainer');
    buttonContainer.innerHTML = '<button id="infoPopupButton" class="btn btn-sm btn-light ms-3" data-translate="" onclick="closeInfoPopup()">Cancel</button>';
}

function openRedirectionModal() {
    document.activeElement.blur();
    const messageSpan = document.getElementById('infoPopupMessage');
    messageSpan.dataset.translate = "redirect-message";

    const popupWindow = document.getElementById("infoPopup");
    popupWindow.classList.add('show');

    const blocker = document.getElementById("infoPopupBlock");
    blocker.classList.add('show');

    const okButton = document.createElement("button");
    okButton.dataset.translate = 'ok-button';
    okButton.className = 'btn btn-sm btn-light ms-3';
    okButton.onclick = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const selectedLang = urlParams.get('lang') || 'en';
        window.location.href = `index.html?lang=${selectedLang}`;
    };

    const closeButton = document.createElement("button");
    closeButton.dataset.translate = "cancel-button";
    closeButton.className = 'btn btn-sm btn-light ms-3';
    closeButton.onclick = closeInfoPopup;

    updateTextContent();

    const buttonContainer = document.getElementById('infoPopupButtonContainer');
    buttonContainer.innerHTML = '';
    buttonContainer.appendChild(okButton);
    buttonContainer.appendChild(closeButton);
}

document.getElementById("infoPopupBlock").addEventListener("click", () => {
    if (!isRecording) {
        closeInfoPopup();
    }
})

/**
 * Opens the waiting window while the graph is being recorded
 */
function showCameraRecordingWindow(){
    const exposureWindow = document.getElementById("cameraRecordingIsOn");
    exposureWindow.classList.add('show');

    const blocker = document.getElementById("infoPopupBlock");
    blocker.classList.add('show');
}

/**
 * Closes the waiting window while the graph is being recorded
 */
function  closeCameraRecordingWindow(){
    const exposureWindow = document.getElementById("cameraRecordingIsOn");
    exposureWindow.classList.remove('show');

    const blocker = document.getElementById("infoPopupBlock");
    blocker.classList.remove('show');
}

const handleLeft = document.getElementById('sidebarToggleHandleLeft');
const hoverZoneLeft = document.getElementById('sidebarHoverZoneLeft');

hoverZoneLeft.addEventListener('mouseenter', () => {
    handleLeft.style.opacity = '1';
    handleLeft.style.pointerEvents = 'auto';
});

handleLeft.addEventListener('mouseenter', () => {
    handleLeft.style.opacity = '1';
    handleLeft.style.pointerEvents = 'auto';
});

hoverZoneLeft.addEventListener('mouseleave', () => {
    handleLeft.style.opacity = '0';
    handleLeft.style.pointerEvents = 'none';
});

handleLeft.addEventListener('mouseleave', () => {
    handleLeft.style.opacity = '0';
    handleLeft.style.pointerEvents = 'none';
});

const handleRight = document.getElementById('sidebarToggleHandleRight');
const hoverZoneRight = document.getElementById('sidebarHoverZoneRight');

hoverZoneRight.addEventListener('mouseenter', () => {
    handleRight.style.opacity = '1';
    handleRight.style.pointerEvents = 'auto';
});

handleRight.addEventListener('mouseenter', () => {
    handleRight.style.opacity = '1';
    handleRight.style.pointerEvents = 'auto';
});

hoverZoneRight.addEventListener('mouseleave', () => {
    handleRight.style.opacity = '0';
    handleRight.style.pointerEvents = 'none';
});

handleRight.addEventListener('mouseleave', () => {
    handleRight.style.opacity = '0';
    handleRight.style.pointerEvents = 'none';
});

const hoverZoneDrawer = document.getElementById("drawerHoverZone");
const handleDrawer = document.getElementById('drawerExpandButton');

hoverZoneDrawer.addEventListener('mouseenter', () => {
    handleDrawer.style.opacity = '1';
    handleDrawer.style.pointerEvents = 'auto';
});

handleDrawer.addEventListener('mouseenter', () => {
    handleDrawer.style.opacity = '1';
    handleDrawer.style.pointerEvents = 'auto';
});

hoverZoneDrawer.addEventListener('mouseleave', () => {
    handleDrawer.style.opacity = '0';
    handleDrawer.style.pointerEvents = 'none';
});

handleDrawer.addEventListener('mouseleave', () => {
    handleDrawer.style.opacity = '0';
    handleDrawer.style.pointerEvents = 'none';
});

window.addEventListener("resize", () => {
    setTimeout(() => {
        resizeCanvasToDisplaySize(graphCtx, graphCanvas, "Normal");
        resizeCanvasToDisplaySize(graphCtxCalibration, graphCanvasCalibration, "Calibration");
        resizeCanvasToDisplaySize(graphCtxDivergence, graphCanvasDivergence, "Divergence");
        changeStripeWidth(0);
        matchGraphHeightWithDrawer();
    }, 300);
});
