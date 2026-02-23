// ##################
//    Canvas/Pasik
// ##################

/**
 * Returns the width of the stripe
 * @returns {number}
 */
function getStripeWidth(){
    return stripeWidth;
}

/**
 * Returns the Y position of the stripe as a percentage. yPercentage represents the middle point of the stripe.
 * @returns {number}
 */
function getYPercentage() {
    return yPercentage;
}

/**
 * Checks whether the threshold for stripe increase has been reached
 * @param change 1 to increment, -1 to decrement or 0 to set to current slider value
 */
function changeStripeWidth(change) {
    if (![-1,0,1].includes(change)) { return; }

    const rangeInput = document.getElementById("stripeWidthRange");
    const rangeText = document.getElementById("stripeWidthValue");

    let cameraStripeWidth = parseInt(rangeInput.value) + change;

    if (!checkValueWithinCameraHeight(cameraStripeWidth)) {
        return;
    }

    rangeInput.value = cameraStripeWidth;
    rangeText.textContent = cameraStripeWidth;

    stripeWidth = convertActualToCanvasValue(cameraStripeWidth);
    changeStripePlacement(0);
    updateStripeWidth();
}

/**
 * Function checks whether the newValue stripe width is within the camera range
 * @param newValue stripe width scaled to camera capabilities
 */
function checkValueWithinCameraHeight(newValue) {
    const checkUpperLimit = parseInt(newValue, 10) <= parseInt(cameraOutputHeight, 10);
    const checkBottomLimit = parseInt(newValue, 10) >= parseInt(1, 10);

    return checkUpperLimit && checkBottomLimit
}

/**
 * Converts the input value from camera resolution scale to stripeCanvas scale.
 * The returned number is rounded to a whole number.
 */
function convertActualToCanvasValue(value) {
    return Math.round(((value - 1) / (cameraOutputHeight - 1)) * (stripeGraphCanvas.height - 1) + 1);
}

/**
 * Converts the input value from stripeCanvas scale to camera resolution scale.
 * The returned number is rounded to a whole number.
 */
function convertCanvasToActualValue(value) {
    return Math.round(((value - 1) / (stripeGraphCanvas.height - 1)) * (cameraOutputHeight - 1) + 1);
}

/**
 * Updates the width of the stripe based on the value
 */
function updateStripeWidth() {

    const rect = stripeGraphCanvas.getBoundingClientRect();

    let y = yPercentage * rect.height;
    if (y < stripeWidth/2){
        y = stripeWidth/2;
        yPercentage = y / rect.height;
    }
    else if (y + stripeWidth/2 > rect.height){
        y = rect.height - stripeWidth/2;
        yPercentage = y / rect.height;
    }
    drawSelectionLine();
    updateLoadedImageStripeCanvases();
    if (videoElement) {
        redrawGraphIfLoadedImage(true);
    }
}

/**
 * Moves the placement of the stripe up or down
 * @param change 1 to increment, -1 to decrement or 0 to set to current slider value
 */
function changeStripePlacement(change) {
    if (![-1,0,1].includes(change)) { return; }

    const rangeInput = document.getElementById("stripePlacementRange");
    const rangeText = document.getElementById("stripePlacementValue");

    let newHeight = parseInt(rangeInput.value) + change;

    if (!checkValueWithinCameraHeight(newHeight)) {
        return;
    }

    rangeInput.value = newHeight;
    rangeText.textContent = getStripePositionRangeText();

    yPercentage = newHeight / cameraOutputHeight;
    updateStripeWidth();
}

/**
 * Returns the vertical range of the stripe in string form
 */
function getStripePositionRangeText() {
    const rangeInput = document.getElementById("stripePlacementRange");
    const rangeInputWidth = document.getElementById("stripeWidthRange");
    let middleHeight = parseInt(rangeInput.value);
    let actualStripeWidth = rangeInputWidth.value;

    if (parseInt(actualStripeWidth) === 1) {
        return `<${middleHeight},${middleHeight}>`;
    }

    let half = parseInt(actualStripeWidth / 2);

    let final;
    if (middleHeight-half < 1) {
        final = `<1,${actualStripeWidth}>`;
    } else if (middleHeight+half > cameraOutputHeight) {
        final = `<${cameraOutputHeight-actualStripeWidth+1},${cameraOutputHeight}>`;
    } else {
        final = `<${middleHeight-half+1},${middleHeight+half}>`;
    }
    return final;
}

/**
 * Changes the label of the stripe placement range in real time
 */
function changeStripePlacementLabel(currentValue) {
    let middleHeight = parseInt(currentValue);
    const rangeInputWidth = document.getElementById("stripeWidthRange");
    let actualStripeWidth = rangeInputWidth.value;

    if (parseInt(actualStripeWidth) === 1) {
        document.getElementById('stripePlacementValue').textContent = `<${middleHeight},${middleHeight}>`;
        return
    }

    let half = parseInt(actualStripeWidth / 2);

    let final;
    if (middleHeight-half < 1) {
        final = `<1,${actualStripeWidth}>`;
    } else if (middleHeight+half > cameraOutputHeight) {
        final = `<${cameraOutputHeight-actualStripeWidth+1},${cameraOutputHeight}>`;
    } else {
        final = `<${middleHeight-half+1},${middleHeight+half}>`;
    }
    document.getElementById('stripePlacementValue').textContent = final;
}

/**
 * Changes both width and placement labels based on the width value in real time
 */
function changeStripeLabels(value) {
    document.getElementById('stripeWidthValue').textContent = value;
    changeStripePlacementLabel(document.getElementById('stripePlacementRange').value);
}

/**
 * Draws the yellow selection line knows as Stripe
 */
function drawSelectionLine() {
    stripeGraphCtx.clearRect(0, 0, stripeGraphCanvas.width, stripeGraphCanvas.height);
    stripeGraphCtx.beginPath();
    stripeGraphCtx.strokeStyle = "rgba(255, 255, 0, 0.5)";
    stripeGraphCtx.lineWidth = getStripeWidth();
    var y = yPercentage * stripeGraphCanvas.height;
    stripeGraphCtx.moveTo(0, y);
    stripeGraphCtx.lineTo(stripeGraphCanvas.width, y);
    stripeGraphCtx.stroke();
}

/**
 * Makes the canvas the same size as video element
 */
function syncCanvasToVideo() {
    const width = videoWindow.clientWidth;
    const height = videoWindow.clientHeight;

    stripeGraphCanvas.width = width;
    stripeGraphCanvas.height = height;
    stripeGraphCanvas.style.width = width + "px";
    stripeGraphCanvas.style.height = height + "px";

    drawSelectionLine();
}


var stripeGraphCanvas = document.getElementById("cameraWindowCanvasRecording");

var stripeGraphCtx = stripeGraphCanvas.getContext("2d", { willReadFrequently: true });
var yPercentage = 0.5; // Global variable representing Y position as a percentage (default to 50%)
var stripeWidth = 1;
var videoWindow = document.getElementById("videoMainWindow");

stripeGraphCanvas.addEventListener("click", function (event) {
    var rect = stripeGraphCanvas.getBoundingClientRect();

    const scaleY = stripeGraphCanvas.height / rect.height;
    var y = (event.clientY - rect.top) * scaleY;

    if (y < getStripeWidth()/2){
        y = getStripeWidth()/2;
    }
    else if (y + getStripeWidth()/2 > stripeGraphCanvas.height){
        y = stripeGraphCanvas.height - getStripeWidth()/2;
    }

    yPercentage = y / stripeGraphCanvas.height;

    const stripePlacementSlider = document.getElementById("stripePlacementRange");
    const stripePlacementValue = document.getElementById("stripePlacementValue");

    stripePlacementSlider.value = convertCanvasToActualValue(y);
    stripePlacementValue.textContent = getStripePositionRangeText();

    drawSelectionLine();
    updateLoadedImageStripeCanvases();
    if (videoElement) {
        redrawGraphIfLoadedImage(true);
    }
});

window.addEventListener("load", syncCanvasToVideo);
window.addEventListener("resize", syncCanvasToVideo);
videoElement.addEventListener("loadedmetadata", syncCanvasToVideo);

drawSelectionLine();

/* SPECTRA-PRO Phase 0 hook patch */

(function(){
  function trySetRange(id, value){ const el=document.getElementById(id); if (el){ el.value = value; } }
  window.SpectraCore = window.SpectraCore || {};
  window.SpectraCore.stripe = Object.assign(window.SpectraCore.stripe || {}, {
    setStripeWidth: function(v){ trySetRange('stripeWidthRange', v); if (window.changeStripeLabels) window.changeStripeLabels(v); if (window.changeStripeWidth) window.changeStripeWidth(0); },
    setStripeY: function(norm){
      const el=document.getElementById('stripePlacementRange');
      if (!el) return;
      const min=Number(el.min||0), max=Number(el.max||100);
      const v=Math.round(min + Math.max(0,Math.min(1,Number(norm)||0))*(max-min));
      el.value=v; if (window.changeStripePlacementLabel) window.changeStripePlacementLabel(v); if (window.changeStripePlacement) window.changeStripePlacement(0);
    }
  });
})();
