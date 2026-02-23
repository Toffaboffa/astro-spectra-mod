const minInputBoxNumber = 2;
const maxInputBoxNumber = 15;

const rangeBeginX = 0;
const rangeEndX = 1280;
const rangeBeginY = 350;
const rangeEndY = 1000;

let inputBoxCounter = 0;
let polyFitCoefficientsArray = [];
let calibrationData = [];
let pixelCalPoints = [];
let nmCalPoints = [];
let nMAxis = []
let divergencePoints = [];

let calLineColor = '#0000ff';
let calPointsColor = '#ff0000';
let calPointsHoverColor = '#bc0000';
let calPointsPermanentColor = '#7c0000';

let graphCanvasCalibration;
let graphCtxCalibration;

let graphCanvasDivergence;
let graphCtxDivergence;

let hoveredCalPoint = null;
let permanentCalPoint = null;

/**
 * Creates the initial minimum number of calibration input pairs
 */
function initializeCalibration() {
    for (let i = 1; i <= minInputBoxNumber; i++) {
        addInputPair();
    }
    disablePairRemoveButtons();
}

/**
 * Adds event listeners to all number inputs in the input div, the event listeners
 * activate calibration upon a value being entered
 */
function addInputPairListener(div) {
    const inputs = div.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener("input", function() {
            const [inputPx, inputNm] = inputs;
            if (inputPx.value.trim() !== "" && inputNm.value.trim() !== "") {
                setCalibrationPoints();
            }
        });
    });
}

/**
 *Adds a pair of input boxes
 */
function addInputPair() {
    if (inputBoxCounter === maxInputBoxNumber) {
        callError("maxNumberOfCalibrationPointsError");
        return;
    }

    inputBoxCounter++;

    const container = document.getElementById("input-container");
    const div = document.createElement("div");
    div.classList.add("input-pair")

    const inputPx = document.createElement("input");
    inputPx.id = `point${inputBoxCounter}px`;
    inputPx.type = "number";
    inputPx.classList.add("form-control");
    inputPx.classList.add("form-control-sm");
    inputPx.dataset.translateTitle = "calPointPair-px-input-tooltip";

    const inputNm = document.createElement("input");
    inputNm.id = `point${inputBoxCounter}nm`;
    inputNm.type = "number";
    inputNm.classList.add("form-control");
    inputNm.classList.add("form-control-sm");
    inputNm.dataset.translateTitle = "calPointPair-nm-input-tooltip";

    const deleteButton = document.createElement("button");
    deleteButton.id = `deleteButton${inputBoxCounter}`;
    deleteButton.innerHTML = '&times;';
    deleteButton.classList.add("btn", "btn-sm", "btn-danger", "btn-secondary", "pb-0.5");
    deleteButton.dataset.translateTitle = "calPointPair-remove-tooltip";

    const id = inputBoxCounter;
    deleteButton.onclick = function () { removeInputPair(id); };

    div.appendChild(inputPx);
    div.appendChild(inputNm);
    div.appendChild(deleteButton);

    container.appendChild(div);

    addInputPairListener(div);

    updateTextContent();

    if (inputBoxCounter > minInputBoxNumber) {
        enablePairRemoveButtons();
    }
}

/**
 * Removes a specific input pair based on an id
 * @param inputBoxNumber - id of wanted input pair, indexing from 1
 */
function removeInputPair(inputBoxNumber) {
    if (inputBoxNumber > maxInputBoxNumber || inputBoxNumber < 1) {
        return;
    }

    if (inputBoxNumber > inputBoxCounter) {
        return;
    }

    if (inputBoxCounter <= minInputBoxNumber) {
        disablePairRemoveButtons();
        return;
    }

    let currPx = document.getElementById(`point${inputBoxNumber}px`);
    let currNm = document.getElementById(`point${inputBoxNumber}nm`);

    const currPxVal = parseFloat(currPx.value.trim());
    const currNmVal = parseFloat(currNm.value.trim());
    if (permanentCalPoint &&
        permanentCalPoint.px === currPxVal &&
        permanentCalPoint.nm === currNmVal) {
        removeHighlightInputPair(true);
    }

    for (let i = inputBoxNumber+1; i <= inputBoxCounter; i++) {
        let nextPx = document.getElementById(`point${i}px`);
        let nextNm = document.getElementById(`point${i}nm`);

        currPx.value = nextPx.value;
        currNm.value = nextNm.value;

        currPx = nextPx;
        currNm = nextNm;
    }

    removeLastInputPair();

    if (permanentCalPoint) {
        const perPx = permanentCalPoint.px, perNm = permanentCalPoint.nm;
        removeHighlightInputPair(true);
        permanentCalPoint = { px: perPx, nm: perNm };
        highlightInputPair(perPx, perNm, true);
    }
}

/**
 * Removes the last pair of input boxes
 */
function removeLastInputPair() {
    const inputContainer = document.getElementById("input-container");
    if (inputContainer.children.length > minInputBoxNumber) {
        const lastInputPair = inputContainer.lastElementChild;
        inputContainer.removeChild(lastInputPair);
        inputBoxCounter --;
    }

    if (inputBoxCounter === minInputBoxNumber) {
        disablePairRemoveButtons();
    }

    setCalibrationPoints();
}

/**
 * Clears the values from all currently displayed input boxes
 */
function clearInputBoxes() {
    for (let i = 1; i <= inputBoxCounter; i++) {
        const pxInput = document.getElementById(`point${i}px`);
        const nmInput = document.getElementById(`point${i}nm`);
        pxInput.value = "";
        nmInput.value = "";
    }
}

/**
 * Removes all the additional boxes that were already added by the user
 */
function deleteAllAdditionalInputPairs() {
    if (inputBoxCounter !== minInputBoxNumber) {
        for (let i = inputBoxCounter; i > minInputBoxNumber; i--) {
            removeLastInputPair();
        }
    }
}

/**
 * Disables the [X] removal buttons for all input pairs
 */
function disablePairRemoveButtons() {
    for (let i = 1; i <= inputBoxCounter; i++) {
        const button = document.getElementById(`deleteButton${i}`);
        button.disabled = true;
    }
}

/**
 * Enables the [X] removal buttons for all input pairs
 */
function enablePairRemoveButtons() {
    for (let i = 1; i <= inputBoxCounter; i++) {
        const button = document.getElementById(`deleteButton${i}`);
        button.disabled = false;
    }
}

/**
 * Sorts the input pair values by the px value in ascending order
 */
function sortCalibrationInputPairs() {
    const pairs = [];
    let permanentMatch = null;

    for (let i = 1; i <= inputBoxCounter; i++) {
        const pxInput = document.getElementById(`point${i}px`);
        const nmInput = document.getElementById(`point${i}nm`);

        if (pxInput && nmInput) {
            const px = parseFloat(pxInput.value.trim());
            const nm = parseFloat(nmInput.value.trim());

            if (!isNaN(px) && !isNaN(nm)) {
                const pair = { px, nm };
                pairs.push(pair);

                if (
                    permanentCalPoint &&
                    permanentCalPoint.px === px &&
                    permanentCalPoint.nm === nm
                ) {
                    permanentMatch = pair;
                }
            }
        }
    }

    pairs.sort((a, b) => a.px - b.px);

    for (let i = 0; i < pairs.length; i++) {
        const pxInput = document.getElementById(`point${i + 1}px`);
        const nmInput = document.getElementById(`point${i + 1}nm`);

        if (pxInput && nmInput) {
            pxInput.value = pairs[i].px;
            nmInput.value = pairs[i].nm;
        }
    }

    if (permanentMatch) {
        removeHighlightInputPair(true);
        permanentCalPoint = { px: permanentMatch.px, nm: permanentMatch.nm };
        highlightInputPair(permanentCalPoint.px, permanentCalPoint.nm, true);
    }

    redrawCalibrationGraphs();
}

/**
 * Saves the calibration points from the input boxes
 */
function setCalibrationPoints() {
    resetCalValues();
    removeHighlightInputPair(true);
    for (let i = 1; i < inputBoxCounter + 1; i++) {
        const pxInput = document.getElementById(`point${i}px`);
        const nmInput = document.getElementById(`point${i}nm`);

        if (pxInput && nmInput) {
            const rawPx = pxInput.value.trim();
            const rawNm = nmInput.value.trim();

            const pxValue = parseFloat(rawPx);
            const nmValue = parseFloat(rawNm);

            if (!isNaN(pxValue) &&
                !isNaN(nmValue)
            ) {
                calibrationData.push({ px: pxValue, nm: nmValue });
            }
        }
    }

    if (calibrationData.length >= minInputBoxNumber) {
        calibrate();
    }
    clearGraph(graphCtxCalibration, graphCanvasCalibration);

    redrawCalibrationGraphs();
}

/**
 * Creates an array of coefficients with the help of the Polynomial Regression located in polynomialReggressionScript.js
 */
function calibrate() {
    for (let i = 0; i < calibrationData.length; i++) {
        const point = calibrationData[i];
        if (pixelCalPoints.includes(point.px) && nmCalPoints.includes(point.nm)) {
            callError("duplicateCalPointsError");
            resetCalValues();
            return;
        }
        pixelCalPoints.push(point.px);
        nmCalPoints.push(point.nm);
    }
    const polyfit = new Polyfit(pixelCalPoints, nmCalPoints);

    const degree = Math.min(3, nmCalPoints.length-1);

    polyFitCoefficientsArray = polyfit.computeCoefficients(degree);
}

/**
 * Returns true if there is an active calibration, false otherwise
 */
function isCalibrated() {
    return nmCalPoints.length !== 0;
}

/**
 * Gets the wave Length from the pixel
 */
function getWaveLengthByPx(pixel) {
    let waveLength = 0;
    for (let i = 0; i < polyFitCoefficientsArray.length; i++) {
        let number = parseFloat(polyFitCoefficientsArray[i]);
        if (i === 0) {
            waveLength += number;
        }
        else {
            waveLength += number * Math.pow(pixel, i);
        }
    }
    return waveLength;
}

function getPxByWaveLengthBisection(targetNm) {
    if (polyFitCoefficientsArray.length === 0) return null;

    let left = rangeBeginX;
    let right = rangeEndX;
    let tol = 1e-4;
    let maxIter = 50;

    function f(px) {
        return getWaveLengthByPx(px) - targetNm;
    }

    if (f(left) * f(right) > 0) return null;

    for (let i = 0; i < maxIter; i++) {
        let mid = (left + right) / 2;
        let fMid = f(mid);

        if (Math.abs(fMid) < tol) return Math.round(mid);

        if (f(left) * fMid < 0) {
            right = mid;
        } else {
            left = mid;
        }
    }
    return Math.round((left + right) / 2);
}

/**
 * Deletes the content of polyFitCoefficientsArray, calibrationData, pixelCalPoints, nmCalPoints before saving new values
 */
function resetCalValues() {
    polyFitCoefficientsArray = [];
    calibrationData = [];
    pixelCalPoints = [];
    nmCalPoints = [];
    nMAxis = [];
    divergencePoints = [];
}

/**
 * Exports calibration settings into a .txt file
 */
function exportCalibrationFile() {
    if (calibrationData.length === 0) {
        callError("noCalPointsToExportError");
        return;
    }

    const filenameInput = document.getElementById("exportCalibrationNameInput").value.trim();
    const filename = filenameInput !== "" ? filenameInput : `calibration_points_${getTimestamp()}.txt`;

    const finalFilename = filename.endsWith(".txt") ? filename : filename + ".txt";

    const lines = calibrationData.map(point => `${point.px};${point.nm}`).join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();

    URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Lets the user choose a file and then automatically fill out input boxes with the calibration points from the file
 */
function importCalibrationFile() {

    const fileInput = document.getElementById("my-file");
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    resetInputBoxes();

    const reader = new FileReader();

    const validFormatRegex = /^(\d+(?:[.,]\d+)?);(\d+(?:[.,]\d+)?)(?:\n|$)/;

    reader.onload = function(event) {
        const fileContent = event.target.result;

        const lines = fileContent.trim().split("\n").map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length < minInputBoxNumber || lines.length > maxInputBoxNumber) {
            callError("wrongNumberOfCalPointsError");
            resetInputBoxes();
            return;
        }

        const extraLines = lines.length - inputBoxCounter;
        for (let i = 0; i < extraLines; i++) {
            addInputPair();
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            if (!validFormatRegex.test(line)) {
                callError("wrongCalPointsFormatError");
                resetInputBoxes()
                return;
            }

            const [px, nm] = lines[i].split(";");

            let pxValue = px.trim().replace(',', '.');
            let nmValue = nm.trim().replace(',', '.');

            const pxFloat = parseFloat(pxValue);
            const nmFloat = parseFloat(nmValue);

            const pxInput = document.querySelector(`#point${i+1}px`);
            const nmInput = document.querySelector(`#point${i+1}nm`);

            if (pxInput && nmInput) {
                pxInput.value = pxFloat;
                nmInput.value = nmFloat;
            }
        }
        setCalibrationPoints();
    };

    reader.readAsText(file);
}

/**
 * Converts the Px Axis into Nm using with the help of the calibration points
 */
function convertPxAxisIntoNm(){
    for (let i = 1; i <= rangeEndX; i++) {
        nMAxis.push(getWaveLengthByPx(i));
    }
    return nMAxis;
}
/**
 * Resets the input boxes, deletes all calibrated data
 */
function resetCalibrationPoints() {
    resetInputBoxes();
    resetCalValues();
    inputBoxCounter = minInputBoxNumber;
    drawGridCalibration();
    drawGridDivergence();
    removeHighlightInputPair(true);
    document.getElementById("my-file").value = null;
}

/**
 * Resets all input boxes, leaves only minInputBoxNumber of pairs
 */
function resetInputBoxes() {
    deleteAllAdditionalInputPairs();
    clearInputBoxes();
}

/**
 * Redraws both the calibration and divergence graphs
 */
function redrawCalibrationGraphs() {
    drawGridCalibration();
    drawCalibrationLine();
    drawCalibrationPoints();

    drawGridDivergence();
    drawDivergenceLine();
    drawDivergencePoints();
}

/**
 * Draws the grid of the graph
 */
function drawGridCalibration() {
    graphCanvasCalibration = document.getElementById('graphCalibration');
    graphCtxCalibration = graphCanvasCalibration.getContext('2d');
    clearGraph(graphCtxCalibration, graphCanvasCalibration);

    resizeCanvasToDisplaySize(graphCtxCalibration, graphCanvasCalibration, "None");

    const rect = graphCanvasCalibration.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    const yMin = rangeBeginY;
    const yMax = rangeEndY;
    const yStep = 50;

    graphCtxCalibration.beginPath();
    graphCtxCalibration.strokeStyle = '#e0e0e0';
    graphCtxCalibration.lineWidth = 0.5;
    graphCtxCalibration.font = '10px Arial';
    graphCtxCalibration.fillStyle = 'black';

    for (let yValue = yMin; yValue <= yMax; yValue += yStep) {
        const isMultiple200 = yValue % 200 === 0;
        const isEndpoint = (yValue === yMin || yValue === yMax);
        const y = padding + ((height - 2 * padding) / (yMax - yMin)) * (yMax - yValue);

        if (isMultiple200) {
            graphCtxCalibration.moveTo(padding, y);
            graphCtxCalibration.lineTo(width - padding, y);
            graphCtxCalibration.fillText(yValue.toFixed(0), 5, y + 3);
        } else if (isEndpoint) {
            graphCtxCalibration.fillText(yValue.toFixed(0), 5, y + 3);
        }
    }

    const xMin = rangeBeginX;
    const xMax = rangeEndX;
    const xStep = 40

    for (let xValue = xMin; xValue <= xMax; xValue += xStep) {
        const isMultiple200 = xValue % 200 === 0;
        const isEndpoint = (xValue === xMin || xValue === xMax);
        const x = padding + ((xValue - xMin) / xMax) * (width - 2 * padding);

        if (isMultiple200 || isEndpoint) {
            const label = xValue.toFixed(0);
            graphCtxCalibration.font = xValue >= 1000 ? '9px Arial' : '10px Arial';

            const textWidth = graphCtxCalibration.measureText(label).width;
            const textX = x - textWidth / 2;

            if (isMultiple200) {
                graphCtxCalibration.moveTo(x, padding);
                graphCtxCalibration.lineTo(x, height - padding);
            }

            graphCtxCalibration.fillText(label, textX, height - padding + 15);
        }
    }

    graphCtxCalibration.font = '11px Arial';
    graphCtxCalibration.fillStyle = 'black';

    graphCtxCalibration.fillText("nm", 10, padding - 10);
    graphCtxCalibration.fillText("px", width - padding + 14, height - padding + 15);

    graphCtxCalibration.stroke();
}

/**
 * Draws the function created from the pixelCalPoints and nmCalPoints arrays
 */
function drawCalibrationLine() {
    const rect = graphCanvasCalibration.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    nMAxis = convertPxAxisIntoNm();

    graphCtxCalibration.beginPath();

    let drawing = false;

    for (let i = 0; i < nMAxis.length; i++) {
        const px = i + 1;
        const nm = nMAxis[i];

        const inRange = px >= rangeBeginX && px <= rangeEndX;
        const xScaled = padding + ((px - rangeBeginX) / (rangeEndX - rangeBeginX)) * (width - 2 * padding);
        const yScaled = height - padding - ((nm - rangeBeginY) / (rangeEndY - rangeBeginY)) * (height - 2 * padding);

        if (inRange) {
            if (!drawing) {
                graphCtxCalibration.moveTo(xScaled, yScaled);
                drawing = true;
            } else {
                graphCtxCalibration.lineTo(xScaled, yScaled);
            }
        } else {
            drawing = false;
        }
    }

    graphCtxCalibration.strokeStyle = calLineColor;
    graphCtxCalibration.lineWidth = 1.5;
    graphCtxCalibration.stroke();
}

/**
 * Draws the points represented by nmCalPoints and pixelCalPoints
 */
function drawCalibrationPoints() {
    const rect = graphCanvasCalibration.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    for (let i = 0; i < nmCalPoints.length; i++) {
        const px = pixelCalPoints[i];
        const nm = nmCalPoints[i];

        const x = padding + ((px - rangeBeginX) / (rangeEndX - rangeBeginX)) * (width - 2 * padding);
        const y = height - padding - ((nm - rangeBeginY) / (rangeEndY - rangeBeginY)) * (height - 2 * padding);

        if (permanentCalPoint && px === permanentCalPoint.px && nm === permanentCalPoint.nm) {
            graphCtxCalibration.fillStyle = calPointsPermanentColor;
            graphCtxCalibration.strokeStyle = calPointsPermanentColor;
            graphCtxCalibration.beginPath();
            graphCtxCalibration.arc(x, y, 6, 0, 2 * Math.PI);
            graphCtxCalibration.fill();
            graphCtxCalibration.stroke();
        }

        if (hoveredCalPoint && px === hoveredCalPoint.px && nm === hoveredCalPoint.nm) {
            graphCtxCalibration.fillStyle = calPointsHoverColor;
            graphCtxCalibration.strokeStyle = calPointsHoverColor;
            graphCtxCalibration.beginPath();
            graphCtxCalibration.arc(x, y, 6, 0, 2 * Math.PI);
            graphCtxCalibration.fill();
            graphCtxCalibration.stroke();
        }

        graphCtxCalibration.fillStyle = calPointsColor;
        graphCtxCalibration.strokeStyle = calPointsColor;
        graphCtxCalibration.beginPath();
        graphCtxCalibration.arc(x, y, 4, 0, 2 * Math.PI);
        graphCtxCalibration.fill();
        graphCtxCalibration.stroke();
    }
}


/**
 * Draws up the graph representing the distance from calibration points to the created calibration function.
 * Creates the graph itself, then fills it using adjacent functions
 */
function drawGridDivergence() {
    graphCanvasDivergence = document.getElementById('graphDivergence');
    graphCtxDivergence = graphCanvasDivergence.getContext('2d');
    clearGraph(graphCtxDivergence, graphCanvasDivergence);

    resizeCanvasToDisplaySize(graphCtxDivergence, graphCanvasDivergence, "None");

    computeDivergence();

    const rect = graphCanvasDivergence.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    const xMin = rangeBeginX;
    const xMax = rangeEndX;
    const xStep = 40;

    const deltas = divergencePoints.map(p => p.delta);
    let maxAbs = Math.max(...deltas.map(Math.abs));

    if (maxAbs < 0.001) {
        maxAbs = 0.001;
    }

    const yMax = maxAbs * 1.25;
    const yMin = -yMax;
    const yStep = yMax / 3;

    graphCtxDivergence.beginPath();
    graphCtxDivergence.strokeStyle = '#e0e0e0';
    graphCtxDivergence.lineWidth = 0.5;
    graphCtxDivergence.font = '9px Arial';
    graphCtxDivergence.fillStyle = 'black';

    for (let yVal = yMin; yVal <= yMax + 1e-6; yVal += yStep) {
        const y = height - padding - ((yVal - yMin) / (yMax - yMin)) * (height - 2 * padding);

        graphCtxDivergence.moveTo(padding, y);
        graphCtxDivergence.lineTo(width - padding, y);

        const label = yVal.toFixed(3);
        graphCtxDivergence.fillText(label, 5, y + 3);
    }

    for (let xVal = xMin; xVal <= xMax; xVal += xStep) {
        const isMultiple200 = xVal % 200 === 0;
        const isEndpoint = (xVal === xMin || xVal === xMax);
        const x = padding + ((xVal - xMin) / (xMax - xMin)) * (width - 2 * padding);

        if (isMultiple200 || isEndpoint) {
            graphCtxDivergence.moveTo(x, padding);
            graphCtxDivergence.lineTo(x, height - padding);

            const label = xVal.toFixed(0);
            const textWidth = graphCtxDivergence.measureText(label).width;
            graphCtxDivergence.fillText(label, x - textWidth / 2, height - padding + 15);
        }
    }

    graphCtxDivergence.font = '11px Arial';
    graphCtxDivergence.fillText("nm", 10, padding - 10);
    graphCtxDivergence.fillText("px", width - padding + 14, height - padding + 15);

    graphCtxDivergence.stroke();

    drawZeroLineDivergence();
}

/**
 * Draws a line representing the created calibration function, the function is represented as Y=0 on the graph
 */
function drawZeroLineDivergence() {
    if (!graphCtxDivergence || !graphCanvasDivergence) return;

    const rect = graphCanvasDivergence.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    const deltas = divergencePoints.map(p => p.delta);
    let maxAbs = Math.max(...deltas.map(Math.abs));

    if (maxAbs < 0.001) {
        maxAbs = 0.001;
    }

    const yMax = maxAbs * 1.25;
    const yMin = -yMax;

    const yZero = height - padding - ((0 - yMin) / (yMax - yMin)) * (height - 2 * padding);

    const xStart = padding;
    const xEnd = width - padding;

    graphCtxDivergence.beginPath();
    graphCtxDivergence.strokeStyle = calLineColor;
    graphCtxDivergence.lineWidth = 1.5;
    graphCtxDivergence.moveTo(xStart, yZero);
    graphCtxDivergence.lineTo(xEnd, yZero);
    graphCtxDivergence.stroke();
}

/**
 * Draws dotted lines indicating the distance from calibration points to the created calibration function
 */
function drawDivergenceLine() {
    if (divergencePoints.length < 2) return;

    const rect = graphCanvasDivergence.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    const xMin = rangeBeginX;
    const xMax = rangeEndX;

    const deltas = divergencePoints.map(p => p.delta);
    let maxAbs = Math.max(...deltas.map(Math.abs));

    if (maxAbs < 0.001) {
        maxAbs = 0.001;
    }

    const yMax = maxAbs * 1.25;
    const yMin = -yMax;

    for (let i = 0; i < divergencePoints.length; i++) {
        const point = divergencePoints[i];
        const x = padding + ((point.px - xMin) / (xMax - xMin)) * (width - 2 * padding);
        const y = height - padding - ((point.delta - yMin) / (yMax - yMin)) * (height - 2 * padding);

        if (i === 0) {
            graphCtxDivergence.beginPath();
            graphCtxDivergence.moveTo(x, y);
        } else {
            graphCtxDivergence.lineTo(x, y);
        }

        graphCtxDivergence.beginPath();
        graphCtxDivergence.setLineDash([6, 4]);
        const yZero = height - padding - ((0 - yMin) / (yMax - yMin)) * (height - 2 * padding);
        graphCtxDivergence.moveTo(x, y);
        graphCtxDivergence.lineTo(x, yZero);
        graphCtxDivergence.strokeStyle = 'gray';
        graphCtxDivergence.lineWidth = 2;
        graphCtxDivergence.stroke();
        graphCtxDivergence.setLineDash([]);
    }


    graphCtxDivergence.stroke();
}

/**
 * Draws the input calibration points into the graph in positions informing their distance from
 * the created calibration function
 */
function drawDivergencePoints() {
    const rect = graphCanvasDivergence.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = 30;

    const xMin = rangeBeginX;
    const xMax = rangeEndX;

    const deltas = divergencePoints.map(p => p.delta);
    let maxAbs = Math.max(...deltas.map(Math.abs));

    if (maxAbs < 0.001) {
        maxAbs = 0.001;
    }

    const yMax = maxAbs * 1.25;
    const yMin = -yMax;

    for (let i = 0; i < divergencePoints.length; i++) {
        const point = divergencePoints[i];
        const x = padding + ((point.px - xMin) / (xMax - xMin)) * (width - 2 * padding);
        const y = height - padding - ((point.delta - yMin) / (yMax - yMin)) * (height - 2 * padding);

        if (permanentCalPoint && point.px === permanentCalPoint.px && point.realNm === permanentCalPoint.nm) {
            graphCtxDivergence.fillStyle = calPointsPermanentColor;
            graphCtxDivergence.strokeStyle = calPointsPermanentColor;
            graphCtxDivergence.beginPath();
            graphCtxDivergence.arc(x, y, 5, 0, 2 * Math.PI);
            graphCtxDivergence.fill();
            graphCtxDivergence.stroke();
        }

        if (hoveredCalPoint && point.px === hoveredCalPoint.px && point.realNm === hoveredCalPoint.nm) {
            graphCtxDivergence.fillStyle = calPointsHoverColor;
            graphCtxDivergence.strokeStyle = calPointsHoverColor;
            graphCtxDivergence.beginPath();
            graphCtxDivergence.arc(x, y, 5, 0, 2 * Math.PI);
            graphCtxDivergence.fill();
            graphCtxDivergence.stroke();
        }

        graphCtxDivergence.fillStyle = calPointsColor;
        graphCtxDivergence.beginPath();
        graphCtxDivergence.arc(x, y, 4, 0, 2 * Math.PI);
        graphCtxDivergence.fill();
    }
}

/**
 * Calculates the differences between the calibration points and the created calibration function
 */
function computeDivergence() {
    divergencePoints = [];

    for (let i = 0; i < calibrationData.length; i++) {
        const { px, nm } = calibrationData[i];
        const predictedNm = getWaveLengthByPx(px);
        const delta = predictedNm - nm;

        divergencePoints.push({
            px: px,
            realNm: nm,
            predictedNm: predictedNm,
            delta: -delta
        });
    }
    divergencePoints.sort((a, b) => a.px - b.px);
}

/**
 * Returns several parameters needed for the functionality of controlling calibration points using the mouse
 */
function getGraphParamsPointSelection(type) {
    let canvas, points, xMin, xMax, yMin, yMax;

    if (type === "calibration") {
        canvas = graphCanvasCalibration;
        points = pixelCalPoints.map((px, i) => ({ px, nm: nmCalPoints[i] }));
        xMin = rangeBeginX;
        xMax = rangeEndX;
        yMin = rangeBeginY;
        yMax = rangeEndY;
    } else if (type === "divergence") {
        canvas = graphCanvasDivergence;
        points = divergencePoints;
        xMin = rangeBeginX;
        xMax = rangeEndX;

        const deltas = divergencePoints.map(p => p.delta);
        let maxAbs = Math.max(...deltas.map(Math.abs));
        if (maxAbs < 0.001) maxAbs = 0.001;

        yMax = maxAbs * 1.25;
        yMin = -yMax;
    }

    return { canvas, points, xMin, xMax, yMin, yMax };
}

/**
 * Implements functionality for the selection of a calibration point within the calibration or divergence graph
 * by clicking it
 * @param type - "calibration" or "divergence", depending on which one we're working with
 */
function checkForPointSelectionClick(event, type) {
    if (!isCalibrated()) {
        return;
    }

    const { canvas, points, xMin, xMax, yMin, yMax } = getGraphParamsPointSelection(type);

    if (canvas === null) { return; }

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const padding = 30
    const radius = 6;
    const width = rect.width;
    const height = rect.height;

    let foundPoint = null;

    for (const point of points) {
        const px = point.px;
        const yVal = type === "calibration" ? point.nm : point.delta;

        const x = padding + ((px - xMin) / (xMax - xMin)) * (width - 2 * padding);
        const y = height - padding - ((yVal - yMin) / (yMax - yMin)) * (height - 2 * padding);

        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
        if (distance <= radius) {
            if (type === "calibration") {
                foundPoint = { px: px, nm: point.nm };
            } else {
                foundPoint = { px: px, nm: point.realNm };
            }
            break;
        }
    }

    if (!foundPoint) {
        removeHighlightInputPair(true);
        redrawCalibrationGraphs()
        return;
    }

    const isSamePoint = (
        permanentCalPoint &&
        foundPoint &&
        permanentCalPoint.px === foundPoint.px &&
        permanentCalPoint.nm === foundPoint.nm
    );

    if (isSamePoint) {
        removeHighlightInputPair(true);
        redrawCalibrationGraphs()
        return;
    }

    removeHighlightInputPair(true);
    permanentCalPoint = foundPoint;
    highlightInputPair(permanentCalPoint.px, permanentCalPoint.nm, true);
}

/**
 * Highlights a specific input pair based on its values
 */
function highlightInputPair(px, nm, isPermanent = false) {
    if (!isCalibrated()) { return; }

    const inputPairs = document.querySelectorAll(".input-pair");
    for (const pair of inputPairs) {
        const inputs = pair.querySelectorAll("input[type='number']");
        if (inputs.length < 2) { continue };

        const pxVal = parseFloat(inputs[0].value.trim());
        const nmVal = parseFloat(inputs[1].value.trim());

        if (pxVal === px && nmVal === nm) {
            pair.classList.add(isPermanent ? 'highlight-permanent' : 'highlight-hover');
            break;
        }
    }
}

function removeHighlightInputPair(removePermanent = false) {
    const inputPairs = document.querySelectorAll(".input-pair");
    for (const pair of inputPairs) {
        pair.classList.remove('highlight-hover');
        if (removePermanent) {
            pair.classList.remove('highlight-permanent');
        }
    }

    if (removePermanent) {
        permanentCalPoint = null;
    }
    hoveredCalPoint = null;
}

/**
 * Implements functionality for the highlighting of a calibration point within the calibration or divergence graph
 * by hovering over it
 * @param type - "calibration" or "divergence", depending on which one we're working with
 */
function checkForPointSelectionHover(event, type) {
    if (!isCalibrated()) { return; }

    const { canvas, points, xMin, xMax, yMin, yMax } = getGraphParamsPointSelection(type);

    if (canvas === null) { return; }

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const padding = 30
    const radius = 6;
    const width = rect.width;
    const height = rect.height;

    let foundPoint = null;

    for (const point of points) {
        const px = point.px;
        const yVal = type === "calibration" ? point.nm : point.delta;

        const x = padding + ((px - xMin) / (xMax - xMin)) * (width - 2 * padding);
        const y = height - padding - ((yVal - yMin) / (yMax - yMin)) * (height - 2 * padding);

        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
        if (distance <= radius) {
            if (type === "calibration") {
                foundPoint = { px: px, nm: point.nm };
                highlightInputPair(px, point.nm);
            } else {
                foundPoint = {px: px, nm: point.realNm };
                highlightInputPair(px, point.realNm);
            }
            break;
        }
    }

    if (!foundPoint) {
        removeHighlightInputPair();
    }

    const isSamePoint = (
        hoveredCalPoint &&
        foundPoint &&
        hoveredCalPoint.px === foundPoint.px &&
        hoveredCalPoint.nm === foundPoint.nm
    );

    if (!isSamePoint) {
        hoveredCalPoint = foundPoint;
        redrawCalibrationGraphs();
    }
}


initializeCalibration();
drawGridCalibration();
drawGridDivergence();

graphCanvasCalibration.addEventListener("click", (e) => {
    checkForPointSelectionClick(e, "calibration")
});
graphCanvasCalibration.addEventListener("mousemove", (e) => {
    checkForPointSelectionHover(e,"calibration");
});

graphCanvasDivergence.addEventListener("click", (e) => {
    checkForPointSelectionClick(e,"divergence");
})
graphCanvasDivergence.addEventListener("mousemove", (e) => {
    checkForPointSelectionHover(e,"divergence");
});


/* SPECTRA-PRO Phase 0 hook patch */

(function(){
  const sp = window.SpectraPro || (window.SpectraPro = {});
  function currentCalibrationState(){
    let coeffs = [];
    try { coeffs = (typeof polyFitCoefficientsArray !== 'undefined' && Array.isArray(polyFitCoefficientsArray)) ? polyFitCoefficientsArray.slice() : []; } catch(e){}
    let points = [];
    try {
      const px = (typeof pixelCalPoints !== 'undefined' && Array.isArray(pixelCalPoints)) ? pixelCalPoints : [];
      const nm = (typeof nmCalPoints !== 'undefined' && Array.isArray(nmCalPoints)) ? nmCalPoints : [];
      points = px.map((p,i)=>({ px:p, nm:nm[i] }));
    } catch(e){}
    return {
      coefficients: coeffs,
      pointCount: points.filter(p=>Number.isFinite(p.px)&&Number.isFinite(p.nm)).length,
      points,
      calibrated: coeffs.length > 0,
      residualStatus: coeffs.length ? 'available' : 'uncalibrated',
      timestamp: Date.now()
    };
  }
  function emit(){
    const data = currentCalibrationState();
    try {
      if (sp.coreHooks && sp.coreHooks.emit) sp.coreHooks.emit('calibrationChanged', data);
      sp.coreBridge = sp.coreBridge || {}; sp.coreBridge.calibration = data;
    } catch(e){}
    return data;
  }
  const origSet = window.setCalibrationPoints;
  if (typeof origSet === 'function' && !origSet.__spectraProWrapped){
    const wrapped = function(){ const r = origSet.apply(this, arguments); emit(); return r; };
    wrapped.__spectraProWrapped = true; window.setCalibrationPoints = wrapped;
  }
  const origCal = window.calibrateGraph;
  if (typeof origCal === 'function' && !origCal.__spectraProWrapped){
    const wrapped = function(){ const r = origCal.apply(this, arguments); emit(); return r; };
    wrapped.__spectraProWrapped = true; window.calibrateGraph = wrapped;
  }
  window.SpectraCore = window.SpectraCore || {};
  window.SpectraCore.calibration = Object.assign(window.SpectraCore.calibration || {}, {
    getState: currentCalibrationState,
    emitCalibrationState: emit
  });
  setTimeout(emit, 0);
})();


/* SPECTRA-PRO Phase 1 calibration bridge enrich patch */
(function(){
  const sp = window.SpectraPro || (window.SpectraPro = {});
  if (window.SpectraCore && window.SpectraCore.calibration && !window.SpectraCore.calibration.getDetailedState) {
    window.SpectraCore.calibration.getDetailedState = function(){
      const base = (window.SpectraCore.calibration.getState && window.SpectraCore.calibration.getState()) || {};
      let range = null;
      try {
        if (Array.isArray(base.points) && base.points.length) {
          const xs = base.points.map(p=>p.px).filter(Number.isFinite);
          if (xs.length) range = { minPx: Math.min.apply(null, xs), maxPx: Math.max.apply(null, xs) };
        }
      } catch(e){}
      return Object.assign({}, base, { range });
    };
  }
})();
