let zoomList = [];
let isDragging = false;
let dragStartX = 0;
let dragEndX = 0;
let animationId;
let minValue = 0;
let spectrumList = [];
let referenceColors = ['#ff7602' ,'#ffdd00' ,'#00ffd3',
    '#a6794b', '#77ba7b', '#f800ff',
    '#f89a8e', '#237c24', '#3109a5',
    '#ff6767', '#545a03', '#6a0345',
    '#a51104', '#ffbb28', '#470925',
    '#9f9f00', '#956f83', '#a53be4']
let referenceGraph = [];
let captureReferenceGraph = false;
let showReferenceGraph = false;
let needToRecalculateMaxima = true;
let maxima = [];
let maximaR = [];
let maximaG = [];
let maximaB = [];
let eventListeners = [];
let toggleCombined = false;
let toggleR = false;
let toggleG = false;
let toggleB = false;
let fillArea = false;
let lineCanvas;
let pixels;

let graphCanvas = document.getElementById('graphCanvas');
let graphCtx = graphCanvas.getContext('2d', { willReadFrequently: true });

const MAX_Y_VALUE_PADDING = 5;

let lineCtx;

let gradientOpacity = 0.7;

let lowerPeakBound = 1;

/**
 * Plots the RGB line graph from the camera or image element, deals with resizing, event listeners and drawing
 */
function plotRGBLineFromCamera() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    lineCanvas = createLineCanvas();
    lineCtx = lineCanvas.getContext('2d', { willReadFrequently: true });
    graphCanvas = document.getElementById('graphCanvas');

    graphCanvas.width = document.getElementById("graphWindowContainer").getBoundingClientRect().width;
    graphCanvas.height = document.getElementById("graphWindowContainer").getBoundingClientRect().height;

    graphCtx = graphCanvas.getContext('2d', { willReadFrequently: true });

    const resizeObserver = new ResizeObserver(() => {
        graphCanvas.width = document.getElementById("graphWindowContainer").getBoundingClientRect().width;
        graphCanvas.height = document.getElementById("graphWindowContainer").getBoundingClientRect().height;
        graphCtx = graphCanvas.getContext('2d', { willReadFrequently: true });
        matchGraphHeightWithDrawer();
        resizeCanvasToDisplaySize(graphCtx, graphCanvas, "None");
        redrawGraphIfLoadedImage();
    });

    initializeZoomList();
    resizeObserver.observe(graphCanvas);
    generateSpectrumList(getElementWidth(videoElement));
    setupEventListeners();
    draw();
}

function draw() {
    drawGraph();
    if (!(videoElement instanceof HTMLImageElement)) {
        animationId = requestAnimationFrame(draw);
        needToRecalculateMaxima = true;
    }
}

/**
 * Draws the graph line, graph grid and labels, deals with peaks, zooming and reference graph
 */
function drawGraph() {
    const stripeWidth = getStripeWidth();
    const toggleStates = getToggleStates();

    toggleCombined = toggleStates.toggleCombined;
    toggleR = toggleStates.toggleR;
    toggleG = toggleStates.toggleG;
    toggleB = toggleStates.toggleB;

    fillArea = document.getElementById("colorGraph").checked;
    const startY = getElementHeight(videoElement) * getYPercentage() - stripeWidth / 2;
    let pixelWidth = getElementWidth(videoElement);

    lineCanvas.width = pixelWidth;
    lineCanvas.height = stripeWidth;

    lineCtx.drawImage(videoElement, 0, startY, pixelWidth, stripeWidth, 0, 0, pixelWidth, stripeWidth);
    let imageData = lineCtx.getImageData(0, 0, pixelWidth, stripeWidth);
    pixels = imageData.data;

    if (stripeWidth > 1) {
        pixels = averagePixels(pixels, pixelWidth);
    }
    else {
    }

    if (captureReferenceGraph) {
        referenceGraph.push([pixels, pixelWidth, minValue, calculateMaxValue(pixels) - MAX_Y_VALUE_PADDING]);
        captureReferenceGraph = false;
    }


    if (needToRecalculateMaxima && document.getElementById('togglePeaksCheckbox').checked) {
        if (getCheckedComparisonId() !== null) {
            const [comparisonDataPixels, comparisonDataPixelWidth] = getCheckedComparisonImageData();
            maxima = findPeaks(comparisonDataPixels, comparisonDataPixelWidth, minValue);
        }
        else {
            maxima = findPeaks(pixels, pixelWidth, minValue);
            if (toggleR) {
                maximaR = findPeaks(pixels, pixelWidth, minValue, 0);
            }
            if (toggleG) {
                maximaG = findPeaks(pixels, pixelWidth, minValue, 1);
            }
            if (toggleB) {
                maximaB = findPeaks(pixels, pixelWidth, minValue, 2);
            }
        }
        needToRecalculateMaxima = false;
    }

    let [zoomStart, zoomEnd] = getZoomRange(pixelWidth);

    if (zoomList.length !== 0 && (zoomEnd - zoomStart) >= 2) {
        pixelWidth = zoomEnd - zoomStart;
    }

    clearGraph(graphCtx, graphCanvas);
    drawGrid(graphCtx, graphCanvas, zoomStart, zoomEnd, pixels);

    let maxValue = calculateMaxValue(pixels);

    if (showReferenceGraph) {
        for (let i = 0; i < referenceGraph.length; i++) {
            let [tempPixels, tempPixelWidth] = referenceGraph[i];
            if (zoomList.length !== 0) {
                tempPixelWidth = zoomEnd - zoomStart;
            }
            drawLine(graphCtx, tempPixels, tempPixelWidth, referenceColors[i % referenceColors.length], -1, maxValue, false, zoomStart, zoomEnd);
        }
    }

    if (comparisonGraph && comparisonGraph.length > 0) {
        for (let i = 0; i < comparisonGraph.length; i++) {
            if (comparisonGraph[i]) {
                let [tempPixels, tempPixelWidth] = comparisonGraph[i];
                if (zoomList.length !== 0) {
                    tempPixelWidth = zoomEnd - zoomStart;
                }
                drawLine(graphCtx, tempPixels, tempPixelWidth, comparisonColors[i % comparisonColors.length], -1, maxValue, i === getCheckedComparisonId(), zoomStart, zoomEnd);
            }
        }
        const comparisonGraphPeakColor = comparisonColors[getCheckedComparisonId()];
        drawPeaks(maxima, maxValue, comparisonGraphPeakColor);
    }
    const isComparisonChecked = getCheckedComparisonId() !== null;
    if (fillArea && (toggleCombined || toggleR || toggleG || toggleB || isComparisonChecked)) {
        if (isComparisonChecked) {
            const [tempPixels, tempPixelWidth] = getCheckedComparisonImageData();
            drawGradient(graphCtx, tempPixels, tempPixelWidth, maxValue);
        }
        else {
            drawGradient(graphCtx, pixels, pixelWidth, maxValue);
        }
    }
    let peaksToggled = document.getElementById('togglePeaksCheckbox').checked;
    const shouldHighlightCameraLine = getCheckedComparisonId() === null && comparisonGraph.length !== 0;

    if (toggleCombined) {
        drawLine(graphCtx, pixels, pixelWidth, 'black', -1, maxValue, shouldHighlightCameraLine, zoomStart, zoomEnd);
        if (peaksToggled && maxima.length > 0 && (shouldHighlightCameraLine || !isComparisonChecked)) {
            drawPeaks(maxima, maxValue, 'black');
        }
    }
    if (toggleR) {
        drawLine(graphCtx, pixels, pixelWidth, 'red', 0, maxValue, shouldHighlightCameraLine, zoomStart, zoomEnd);
        if (peaksToggled && maximaR.length > 0 && (shouldHighlightCameraLine || !isComparisonChecked)) {
            drawPeaks(maximaR, maxValue, 'red');
        }
    }
    if (toggleG) {
        drawLine(graphCtx, pixels, pixelWidth, 'green', 1, maxValue, shouldHighlightCameraLine, zoomStart, zoomEnd);
        if (peaksToggled && maximaG.length > 0 && (shouldHighlightCameraLine || !isComparisonChecked)) {
            drawPeaks(maximaG, maxValue, 'green');
        }
    }
    if (toggleB) {
        drawLine(graphCtx, pixels, pixelWidth, 'blue', 2, maxValue, shouldHighlightCameraLine, zoomStart, zoomEnd);
        if (peaksToggled && maximaB.length > 0 && (shouldHighlightCameraLine || !isComparisonChecked)) {
            drawPeaks(maximaB, maxValue, 'blue');
        }
    }

    if (isDragging) {
        const rectX = Math.min(dragStartX, dragEndX);
        const rectWidth = Math.abs(dragStartX - dragEndX);
        graphCtx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        graphCtx.fillRect(rectX, 30, rectWidth, graphCanvas.getBoundingClientRect().height - 60);
    }
}

/**
 * Calculates the maximum value of the graph and adds a small padding for dynamic Y axis
 */
function calculateMaxValue(pixels) {
    let maxValue = 0;
    if (referenceGraph.length > 0 && showReferenceGraph) {
        for (let i = 0; i < referenceGraph.length; i++) {
            const tempMaxValue = referenceGraph[i][3];
            if (tempMaxValue > maxValue) {
                maxValue = tempMaxValue;
            }
        }
    }
    if (comparisonGraph && comparisonGraph.length > 0) {
        for (let i = 0; i < comparisonGraph.length; i++) {
            if (comparisonGraph[i]) {
                const tempMaxValue = comparisonGraph[i][3];
                if (tempMaxValue > maxValue) {
                    maxValue = tempMaxValue;
                }
            }
        }
    }
    for (let i = 0; i < pixels.length; i += 4) {
        const value = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
        if (value > maxValue) {
            maxValue = value;
        }
    }
    return maxValue + MAX_Y_VALUE_PADDING;
}

/**
 * Averages the pixels in a stripe
 */
function averagePixels(pixels, pixelWidth) {
    let averagedPixels = new Uint8ClampedArray(pixelWidth * 4);
    for (let x = 0; x < pixelWidth; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let y = 0; y < stripeWidth; y++) {
            r += pixels[(y * pixelWidth + x) * 4];
            g += pixels[(y * pixelWidth + x) * 4 + 1];
            b += pixels[(y * pixelWidth + x) * 4 + 2];
            a += pixels[(y * pixelWidth + x) * 4 + 3];
        }
        averagedPixels[x * 4] = r / stripeWidth;
        averagedPixels[x * 4 + 1] = g / stripeWidth;
        averagedPixels[x * 4 + 2] = b / stripeWidth;
        averagedPixels[x * 4 + 3] = a / stripeWidth;
    }
    return averagedPixels;
}

/**
 * Finds the peaks of the graph
 */
function findPeaks(pixels, pixelWidth, minValue, colorOffset = -1, minDistance = 1) {
    function getValue(x) {
        return colorOffset === -1
            ? calculateMaxColor(pixels, x)
            : pixels[x * 4 + colorOffset];
    }

    let values = new Array(pixelWidth).fill(0).map((_, x) => getValue(x));
    let candidates = [];

    let x = 1;
    while (x < values.length - 1) {
        if (values[x] >= values[x - 1] && values[x] >= values[x + 1] && values[x] >= minValue) {
            let plateauStart = x;
            let plateauEnd = x;
            while (plateauEnd + 1 < values.length && values[plateauEnd + 1] === values[x]) {
                plateauEnd++;
            }

            let peakX = plateauStart;
            let peakVal = values[plateauStart];

            let leftMin = peakVal;
            let leftDropped = false;
            for (let j = peakX - 1; j >= 0; j--) {
                if (values[j] < leftMin) {
                    leftMin = values[j];
                    leftDropped = true;
                }
                if (values[j] > peakVal) break;
            }

            let rightMin = peakVal;
            let rightDropped = false;
            for (let j = plateauEnd + 1; j < values.length; j++) {
                if (values[j] < rightMin) {
                    rightMin = values[j];
                    rightDropped = true;
                }
                if (values[j] > peakVal) break;
            }

            if (leftDropped && rightDropped) {
                const prominence = peakVal - Math.min(leftMin, rightMin);
                if (prominence >= lowerPeakBound) {
                    candidates.push({ x: peakX, value: peakVal, prominence });
                }
            }

            x = plateauEnd + 1;
        } else {
            x++;
        }
    }

    candidates.sort((a, b) => b.value - a.value);
    let peaks = [];
    for (let c of candidates) {
        if (!peaks.some(p => Math.abs(p.x - c.x) < minDistance)) {
            peaks.push(c);
        }
    }

    return peaks.sort((a, b) => a.x - b.x);
}


function getLowerPeakBound() {
    return parseInt(document.getElementById('peakSizeLower').value, 10);
}

function setPeakBounds() {
    const lowerBound = document.getElementById('peakSizeLower').value;

    if (lowerBound === '') {
        resetPeakBounds()
        return;
    }

    const lowerBoundInt = getLowerPeakBound();

    if (lowerBoundInt < 0 || lowerBoundInt > 255) {
        resetPeakBounds();
        return;
    }
    lowerPeakBound = lowerBoundInt;
}

function resetPeakBounds() {
    document.getElementById('peakSizeLower').value = '1';
    lowerPeakBound = getLowerPeakBound();
}


/**
 * Draws dotted lines below the peaks on the graph canvas
 */
function drawDottedLine(x, yStart, yEnd, color) {
    graphCtx.beginPath();
    graphCtx.setLineDash([5, 5]);
    graphCtx.moveTo(x, yEnd);
    graphCtx.lineTo(x, yStart);
    graphCtx.strokeStyle = color;
    graphCtx.lineWidth = 1;
    graphCtx.stroke();
    graphCtx.setLineDash([]);
}

/**
 * Draws the peaks on the graph canvas
 */
function drawPeaks(maxima, maxValue, color) {
    const padding = 30;
    const height = graphCanvas.getBoundingClientRect().height;
    const [zoomStart, zoomEnd] = getZoomRange(getElementWidth(videoElement));
    maxima.forEach(max => {
        if (max.x >= zoomStart && max.x <= zoomEnd) {
            const x = calculateXPosition(max.x - zoomStart, zoomEnd - zoomStart, graphCanvas.getBoundingClientRect().width);
            const y = calculateYPosition(max.value, height, maxValue);
            drawDottedLine(x, height - padding, y, color);
            drawPeakLabel(x, y, max.x);
        }
    });
}

/**
 * Draws the peak label on the graph canvas
 */
function drawPeakLabel(x, y, peakX) {
    const toggleXLabelsPx = document.getElementById('toggleXLabelsPx').checked;
    let label;
    if (!toggleXLabelsPx) {
        label = `${getWaveLengthByPx(peakX).toFixed(1)}`;
    } else {
        label = `${peakX.toFixed(0)}`;
    }
    const textWidth = graphCtx.measureText(label).width;
    const textHeight = 20;

    graphCtx.fillStyle = 'black';
    graphCtx.font = '16px Arial';
    graphCtx.fillText(label, x - textWidth / 2, y - textHeight / 2);
}

/**
 * Creates a canvas element for the line graph
 */
function createLineCanvas() {
    const lineCanvas = document.createElement('canvas');
    lineCanvas.width = getElementWidth(videoElement);
    lineCanvas.height = getStripeWidth();
    return lineCanvas;
}

/**
 * Removes existing event listeners from the graph canvas
 */
function removeEventListeners() {
    eventListeners.forEach(({ element, type, listener }) => {
        element.removeEventListener(type, listener);
    });
    eventListeners = [];
}

/**
 * Sets up event listeners for the graph canvas
 */
function setupEventListeners() {
    removeEventListeners();

    function addEventListener(element, type, listener) {
        element.addEventListener(type, listener);
        eventListeners.push({ element, type, listener });
    }

    addEventListener(document.getElementById('togglePeaksCheckbox'), 'change', () => {
        if (!document.getElementById('togglePeaksCheckbox').checked) {
            maxima = [];
            maximaR = [];
            maximaG = [];
            maximaB = [];
        }
        redrawGraphIfLoadedImage(true);
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        addEventListener(checkbox, 'change', () => {
            needToRecalculateMaxima = true;
            redrawGraphIfLoadedImage();
        });
    });

    addEventListener(document.getElementById('resetZoomButton'), 'click', () => {
        resetZoom();
        redrawGraphIfLoadedImage()
    });

    document.getElementById('colorGraph').addEventListener('change', () => {
        redrawGraphIfLoadedImage();
    });

    document.getElementById('stepBackButton').addEventListener('click', stepBackZoom);

    document.getElementById('referenceGraphCheckbox').addEventListener( 'change', () => {
        const referenceGraphCheckbox = document.getElementById('referenceGraphCheckbox');
        if (referenceGraphCheckbox.checked) {
            document.getElementById("referenceGraphControl").style.display = "block";
            showReferenceGraph = true;
        } else {
            document.getElementById("referenceGraphControl").style.display = "none";
            showReferenceGraph = false;
        }
        redrawGraphIfLoadedImage()
    });

    addEventListener(graphCanvas, 'mousedown', (event) => {
        isDragging = true;
        const rect = graphCanvas.getBoundingClientRect();
        dragStartX = Math.max(30, Math.min(event.clientX - rect.left, graphCanvas.getBoundingClientRect().width - 30));
        dragEndX = dragStartX;
        redrawGraphIfLoadedImage()
    });

    addEventListener(graphCanvas, 'mousemove', (event) => {
        const rect = graphCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const padding = 30;
        const width = rect.width;
        const height = rect.height;

        if (isDragging) {
            dragEndX = Math.max(padding, Math.min(x, width - padding));
            redrawGraphIfLoadedImage(true);
        }

        let displayX = 'N/A';
        let displayY = 'N/A';
        if (x >= padding && x <= width - padding && y >= padding && y <= height - padding) {
            const [zoomStart, zoomEnd] = getZoomRange(getElementWidth(videoElement));
            const pixelCount = Math.max(1, zoomEnd - zoomStart);
            const denom = Math.max(1, pixelCount - 1);
            const usableWidth = width - 2 * padding;

            const pixelCanvasWidth = usableWidth / denom;

            const relX = Math.max(0, Math.min(usableWidth, x - padding));

            const pixelIndexFloat = relX / pixelCanvasWidth;

            const pixelIndex = Math.floor(pixelIndexFloat);

            const graphX = Math.min(zoomEnd - 1, Math.max(zoomStart, zoomStart + pixelIndex));

            const maxValue = calculateMaxValue(pixels);
            const graphY = Math.round(maxValue * (1 - (y - padding) / (height - 2 * padding)));

            const toggleXLabelsNm = document.getElementById("toggleXLabelsNm");
            if (toggleXLabelsNm.checked) {
                displayX = getWaveLengthByPx(graphX).toFixed(1);
            } else {
                displayX = graphX;
            }
            displayY = graphY;
        }
        document.getElementById('mouseCoordinates').textContent = `X: ${displayX}, Y: ${displayY}`;
    });

    addEventListener(graphCanvas, 'mouseleave', function() {
        document.getElementById('mouseCoordinates').textContent = 'X: N/A, Y: N/A';
    });

    addEventListener(graphCanvas, 'mouseup', () => {
        if (isDragging) {
            isDragging = false;
            addZoomRange(dragStartX, dragEndX);
            redrawGraphIfLoadedImage()
        }
    });

    document.querySelectorAll('input[name="toggleXLabels"]').forEach(radio => {
        addEventListener(radio, 'change', () => {
            redrawGraphIfLoadedImage()
        });
    });

    document.getElementById('colorGraph').addEventListener('change', function () {
        const sliderContainer = document.getElementById('gradientOpacitySliderContainer');
        sliderContainer.style.display = this.checked ? 'block' : 'none';
        redrawGraphIfLoadedImage();
    });

    document.getElementById('gradientOpacitySlider').addEventListener('input', function () {
        gradientOpacity = parseFloat(this.value);
        document.getElementById('gradientOpacityValue').textContent = gradientOpacity.toFixed(1);
        redrawGraphIfLoadedImage();
    });

    document.getElementById('peakSizeLower').addEventListener("input", () => {
        setPeakBounds();
        redrawGraphIfLoadedImage(true);
    });

    document.getElementById('stepLeftButton').addEventListener('click', () => moveZoom(-1));
    document.getElementById('stepRightButton').addEventListener('click', () => moveZoom(1));

    document.addEventListener('keydown', (event) => {
        if (zoomList.length === 0) return;

        const [zoomStart, zoomEnd] = zoomList[zoomList.length - 1];
        const zoomRange = zoomEnd - zoomStart;
        const step = Math.ceil(zoomRange / 25);

        if (event.key === 'ArrowLeft') {
            moveZoom(-step);
        } else if (event.key === 'ArrowRight') {
            moveZoom(step);
        }
    });

    document.getElementById('zoomScroller').addEventListener('input', (e) => {
        if (zoomList.length === 0) return;
        const zoomRange = zoomList[zoomList.length - 1][1] - zoomList[zoomList.length - 1][0];
        const newStart = Number(e.target.value);
        const newEnd = newStart + zoomRange;
        updateZoomRange(newStart, newEnd);
    });
}

/**
 * Returns the states of RGB toggle buttons
 */
function getToggleStates() {
    return {
        toggleCombined: document.getElementById('toggleCombined').checked,
        toggleR: document.getElementById('toggleR').checked,
        toggleG: document.getElementById('toggleG').checked,
        toggleB: document.getElementById('toggleB').checked
    };
}

/**
 * Returns the zoom range based on pixel width
 */
function getZoomRange(pixelWidth) {
    let zoomStart = 0;
    let zoomEnd = pixelWidth;
    if (zoomList.length !== 0) {
        [zoomStart, zoomEnd] = zoomList[zoomList.length - 1];
    }
    return [zoomStart, zoomEnd];
}

function redrawGraphIfLoadedImage(invalidatePeaks = false) {
    if (invalidatePeaks) {
        needToRecalculateMaxima = true;
    }
    if (videoElement instanceof HTMLImageElement) {
        generateSpectrumList(getElementWidth(videoElement));
        resizeCanvasToDisplaySize(graphCtx, graphCanvas, "Normal");
        stripeGraphCanvas.height = videoElement.naturalHeight;
        stripeGraphCanvas.width = videoElement.naturalWidth;
        drawSelectionLine();
    }
}

function moveZoom(step) {
    if (zoomList.length === 0) return;

    let [zoomStart, zoomEnd] = zoomList[zoomList.length - 1];
    const zoomRange = zoomEnd - zoomStart;
    const elementWidth = getElementWidth(videoElement);
    let newZoomStart = Math.max(0, zoomStart + step);
    let newZoomEnd = Math.min(elementWidth, zoomEnd + step);

    if (newZoomEnd - newZoomStart !== zoomRange) {
        newZoomEnd = newZoomStart + zoomRange;
        if (newZoomEnd > elementWidth) {
            newZoomEnd = elementWidth;
            newZoomStart = elementWidth - zoomRange;
        }
        if (newZoomStart < 0) {
            newZoomStart = 0;
            newZoomEnd = zoomRange;
        }
    }
    updateZoomRange(newZoomStart, newZoomEnd);
}

function updateArrowButtons() {
    const leftBtn = document.getElementById('stepLeftButton');
    const rightBtn = document.getElementById('stepRightButton');
    const elementWidth = getElementWidth(videoElement);

    if (zoomList.length === 0) {
        leftBtn.disabled = true;
        rightBtn.disabled = true;
        return;
    }

    const [zoomStart, zoomEnd] = zoomList[zoomList.length - 1];
    const zoomRange = zoomEnd - zoomStart;

    if (zoomRange === 0 || zoomRange === elementWidth) {
        leftBtn.disabled = true;
        rightBtn.disabled = true;
        return;
    }

    leftBtn.disabled = zoomStart <= 0;
    rightBtn.disabled = zoomEnd >= elementWidth;
}

function updateZoomScroller() {
    const scroller = document.getElementById('zoomScroller');
    if (zoomList.length === 0) {
        scroller.disabled = true;
        return;
    }
    const elementWidth = getElementWidth(videoElement);
    const [zoomStart, zoomEnd] = zoomList[zoomList.length - 1];
    const zoomRange = zoomEnd - zoomStart;
    if (zoomRange === 0 || zoomRange === elementWidth) {
        scroller.disabled = true;
        return;
    }
    scroller.min = 0;
    scroller.max = elementWidth - zoomRange;
    scroller.value = zoomStart;
    scroller.disabled = false;
}

/**
 * Updates the zoom range in the zoom list
 */
function updateZoomRange(newZoomStart, newZoomEnd) {
    zoomList[zoomList.length - 1] = [newZoomStart, newZoomEnd];
    redrawGraphIfLoadedImage();
    updateArrowButtons();
    updateZoomScroller();
    console.log(zoomList);
}

/**
 * Clears the graph canvas
 */
function clearGraph(graphCtx, graphCanvas) {
    graphCtx.clearRect(0, 0, graphCanvas.getBoundingClientRect().width, graphCanvas.getBoundingClientRect().height);
    graphCtx.fillStyle = 'white';
    graphCtx.fillRect(0, 0, graphCanvas.getBoundingClientRect().width, graphCanvas.getBoundingClientRect().height);
}

/**
 * Calculates the best step size for axis labels
 */
function niceStep(range, maxLabels) {
    const roughStep = range / maxLabels;
    const exponent = Math.floor(Math.log10(roughStep));
    const fraction = roughStep / Math.pow(10, exponent);
    let niceFraction;
    if (fraction <= 1) {
        niceFraction = 1;
    }
    else if (fraction <= 2) {
        niceFraction = 2;
    }
    else if (fraction <= 5) {
        niceFraction = 5;
    }
    else {
        niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
}

/**
 * Draws the grid on the graph canvas
 */
function drawGrid(graphCtx, graphCanvas, zoomStart, zoomEnd, pixels) {
    const width = graphCanvas.getBoundingClientRect().width;
    const height = graphCanvas.getBoundingClientRect().height;
    const padding = 30;

    let maxValue = calculateMaxValue(pixels);

    const numOfYLabels = Math.min(25, Math.floor(maxValue));
    const yStep = niceStep(maxValue, numOfYLabels);

    graphCtx.beginPath();
    graphCtx.strokeStyle = '#e0e0e0';
    graphCtx.lineWidth = 0.5;
    graphCtx.font = '12px Arial';
    graphCtx.fillStyle = 'black';

    for (let yValue = 0; yValue <= maxValue; yValue += yStep) {
        const y = padding + ((height - 2 * padding) * (1 - yValue / maxValue));
        const label = Math.round(yValue).toString();
        graphCtx.moveTo(padding, y);
        graphCtx.lineTo(width - padding, y);
        graphCtx.fillText(label, 5, y + 3);
    }

    const toggleXLabelsPx = document.getElementById('toggleXLabelsPx');
    const toggleXLabelsNm = document.getElementById("toggleXLabelsNm");
    const zoomRange = zoomEnd - zoomStart;
    const numOfXLabels = Math.min(20, zoomRange);
    const xStep = niceStep(zoomRange, numOfXLabels);

    let showNm;
    if (toggleXLabelsNm.checked) {
        if (!isCalibrated()) {
            showNm = false;
            toggleXLabelsPx.checked = true;
            toggleXLabelsNm.checked = false;
            showInfoPopup("noNmNeedToCalibrate", "acknowledge");
        } else {
            showNm = true;
        }
    } else {
        showNm = false;
    }

    if (showNm) {
        const minNm = Math.ceil(getWaveLengthByPx(zoomStart));
        const maxNm = Math.floor(getWaveLengthByPx(zoomEnd - 1));
        const nmRange = maxNm - minNm;
        const maxLabels = 15;
        const nmStep = Math.max(1, Math.round(niceStep(nmRange, maxLabels)));

        for (let nm = Math.ceil(minNm / nmStep) * nmStep; nm <= maxNm; nm += nmStep) {
            const px = getPxByWaveLengthBisection(nm);
            if (px !== null && px >= zoomStart && px < zoomEnd) {
                const x = calculateXPosition(px - zoomStart, zoomEnd - zoomStart, width);
                graphCtx.moveTo(x, padding);
                graphCtx.lineTo(x, height - padding);
                graphCtx.fillText(Math.round(nm).toString(), x - 10, height - 5);
            }
        }
    } else {
        for (let i = Math.ceil(zoomStart / xStep) * xStep; i <= zoomEnd; i += xStep) {
            const x = calculateXPosition(i - zoomStart, zoomRange, width);
            graphCtx.moveTo(x, padding);
            graphCtx.lineTo(x, height - padding);
            graphCtx.fillText(Math.round(i).toString(), x - 10, height - 5);
        }
    }

    graphCtx.stroke();
}

/**
 * Generates the spectrum list based on the number of pixels
 */
function generateSpectrumList(pixelWidth) {
    spectrumList = [];
    for (let i = 0; i < pixelWidth; i++) {
        const ratio = i / (pixelWidth - 1);
        const r = Math.round(255 * Math.max(1 - 2 * ratio, 0));
        const g = Math.round(255 * Math.max(1 - Math.abs(2 * ratio - 1), 0));
        const b = Math.round(255 * Math.max(2 * ratio - 1, 0));
        spectrumList.push(`rgb(${r}, ${g}, ${b})`);
    }
}

/**
 * Draws a line based on the spectrum list
 */
function drawLine(graphCtx, pixels, pixelWidth, color, colorOffset, maxValue, isSelectedComparison = false, zoomStart = 0, zoomEnd = pixelWidth) {
    const zoomRange = zoomEnd - zoomStart;
    const width = graphCanvas.getBoundingClientRect().width;
    const height = graphCanvas.getBoundingClientRect().height;

    graphCtx.beginPath();
    for (let x = zoomStart; x < zoomEnd; x++) {
        let value = colorOffset === -1 ? calculateMaxColor(pixels, x) : pixels[x * 4 + colorOffset];
        const y = calculateYPosition(value, height, maxValue);
        const scaledX = calculateXPosition(x - zoomStart, zoomRange, width);
        if (x === zoomStart) {
            graphCtx.moveTo(scaledX, y);
        } else {
            graphCtx.lineTo(scaledX, graphCtx.currentY || y);
            graphCtx.lineTo(scaledX, y);
        }
        graphCtx.currentY = y;
    }
    graphCtx.strokeStyle = color;
    graphCtx.lineWidth = isSelectedComparison ? 2 : 1;
    graphCtx.stroke();
}

/**
 * Fills the area under the line with a gradient based on the spectrum list
 */
function drawGradient(graphCtx, pixels, pixelWidth, maxValue) {
    const [zoomStart, zoomEnd] = getZoomRange(pixelWidth);
    const zoomRange = zoomEnd - zoomStart;
    const padding = 30;
    const width = graphCanvas.getBoundingClientRect().width;
    const height = graphCanvas.getBoundingClientRect().height;

    if (toggleCombined) {
        for (let x = 0; x < zoomRange; x++) {
            const pxIndex = (zoomStart + x) * 4;
            const r = pixels[pxIndex];
            const g = pixels[pxIndex + 1];
            const b = pixels[pxIndex + 2];
            const maxVal = Math.max(r, g, b);
            if (maxVal === 0) continue;

            const leftX = Math.round(calculateXPosition(x, zoomRange, width));
            const rightX = Math.round(
                x < zoomRange - 1
                    ? calculateXPosition(x + 1, zoomRange, width)
                    : width - padding
            );
            const rectWidth = rightX - leftX;

            const yLower = calculateYPosition(0, height, maxValue);
            const yUpper = calculateYPosition(maxVal, height, maxValue);

            graphCtx.fillStyle = `rgba(${255*r/maxValue},${255*g/maxValue},${255*b/maxValue},${gradientOpacity})`;
            graphCtx.fillRect(leftX, Math.floor(yUpper), rectWidth, Math.ceil(yLower - yUpper));
        }
        return;
    }

    for (let x = 0; x < zoomRange; x++) {
        const pxIndex = (zoomStart + x) * 4;
        const r = toggleR ? pixels[pxIndex] : 0;
        const g = toggleG ? pixels[pxIndex + 1] : 0;
        const b = toggleB ? pixels[pxIndex + 2] : 0;

        let maxVal = 0, fillColor = null;
        if (toggleR && r >= g && r >= b) {
            maxVal = r;
            fillColor = `rgba(${255*r/maxValue},0,0,${gradientOpacity})`;
        } else if (toggleG && g >= r && g >= b) {
            maxVal = g;
            fillColor = `rgba(0,${255*g/maxValue},0,${gradientOpacity})`;
        } else if (toggleB && b >= r && b >= g) {
            maxVal = b;
            fillColor = `rgba(0,0,${255*b/maxValue},${gradientOpacity})`;
        }

        if (maxVal === 0 || !fillColor) continue;

        const leftX = Math.round(calculateXPosition(x, zoomRange, width));
        const rightX = Math.round(
            x < zoomRange - 1
                ? calculateXPosition(x + 1, zoomRange, width)
                : width - padding
        );
        const rectWidth = rightX - leftX;

        const yLower = calculateYPosition(0, height, maxValue);
        const yUpper = calculateYPosition(maxVal, height, maxValue);

        graphCtx.fillStyle = fillColor;
        graphCtx.fillRect(leftX, Math.floor(yUpper), rectWidth, Math.ceil(yLower - yUpper));
    }
}

/**
 * Returns the maximum color value of a pixel
 */
function calculateMaxColor(pixels, x) {
    return Math.max(pixels[x * 4], pixels[x * 4 + 1], pixels[x * 4 + 2]);
}

/**
 * Calculates the Y position of a value on the canvas
 */
function calculateYPosition(value, canvasHeight, maxValue) {
    const padding = 30;
    return canvasHeight - padding - (value / maxValue) * (canvasHeight - 2 * padding);
}

/**
 * Calculates the X position of a value on the canvas
 */
function calculateXPosition(x, pixelWidth, canvasWidth) {
    const padding = 30;
    return padding + (x / (pixelWidth - 1)) * (canvasWidth - 2 * padding);
}

function initializeZoomList() {
    zoomList = [[0, getElementWidth(videoElement)]];
}

/**
 * Adds a zoom range to the zoom list and stores the previous zoom level in history
 */
function addZoomRange(startX, endX) {
    const rect = graphCanvas.getBoundingClientRect();
    const canvasWidth = rect.width - 60;

    let zoomStart;
    let zoomEnd;
    [zoomStart, zoomEnd] = zoomList[zoomList.length - 1];

    const startIndex = Math.floor(zoomStart + (startX - 30) / canvasWidth * (zoomEnd - zoomStart));
    const endIndex = Math.floor(zoomStart + (endX - 30) / canvasWidth * (zoomEnd - zoomStart));

    if (Math.abs(startIndex - endIndex) < 2) {
        console.log('Zoom range too small, zoom not applied.');
        return;
    }

    const newZoom = startIndex > endIndex ? [endIndex, startIndex] : [startIndex, endIndex];
    newZoom[0] = Math.max(0, newZoom[0]);
    newZoom[1] = Math.min(getElementWidth(videoElement), newZoom[1]);

    zoomList.push(newZoom);
    console.log(zoomList);
    updateArrowButtons();
    updateZoomScroller();
}

function resetZoom() {
    zoomList = [[0, getElementWidth(videoElement)]];
    updateArrowButtons();
    updateZoomScroller();
}

/**
 * Steps back to the previous zoom level
 */
function stepBackZoom() {
    if (zoomList.length > 1) {
        zoomList.pop();
        redrawGraphIfLoadedImage();
        updateArrowButtons();
        updateZoomScroller();
    } else {
        console.log('No previous zoom level to step back to.');
    }
}

document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (videoElement) {
            redrawGraphIfLoadedImage();
        }
    });
});

/**
 * Resizes the canvas to fit the current window size
 */
function resizeCanvasToDisplaySize(ctx, canvas, redraw) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    clearGraph(ctx, canvas);

    if (redraw === "Calibration") {
        drawGridCalibration();
        drawCalibrationLine();
        drawCalibrationPoints();
    } else if (redraw === "Divergence") {
        drawGridDivergence();
        drawDivergenceLine();
        drawDivergencePoints();
    } else if (redraw === "Normal") {
        draw();
    }
}

/* SPECTRA-PRO Phase 0 hook patch */

(function(){
  const sp = window.SpectraPro || (window.SpectraPro = {});
  function emitGraphFrame(payload){
    try {
      if (sp.coreHooks && sp.coreHooks.emit) sp.coreHooks.emit('graphFrame', payload);
      sp.coreBridge = sp.coreBridge || {};
      sp.coreBridge.frame = payload;
    } catch(e) {}
  }
  function buildFrameFromPixels(pixels, pixelWidth){
    if (!pixels || !pixelWidth) return null;
    const R=[], G=[], B=[], I=[], px=[];
    for (let i=0;i<pixelWidth;i++){
      const base=i*4;
      const r=Number(pixels[base] ?? 0), g=Number(pixels[base+1] ?? 0), b=Number(pixels[base+2] ?? 0);
      R.push(r); G.push(g); B.push(b); I.push(Math.max(r,g,b)); px.push(i);
    }
    return { px, R, G, B, I, pixelWidth, timestamp: Date.now(), source: (window.videoPaused ? 'image' : 'camera') };
  }
  const originalPlot = window.plotRGBLineFromCamera;
  if (typeof originalPlot === 'function' && !originalPlot.__spectraProWrapped) {
    const wrapped = function(){
      const result = originalPlot.apply(this, arguments);
      try {
        if (typeof pixels !== 'undefined' && typeof pixelWidth !== 'undefined') {
          const frame = buildFrameFromPixels(pixels, pixelWidth);
          if (frame) emitGraphFrame(frame);
        }
      } catch (e) {}
      return result;
    };
    wrapped.__spectraProWrapped = true;
    window.plotRGBLineFromCamera = wrapped;
  }
  window.SpectraCore = window.SpectraCore || {};
  window.SpectraCore.graph = Object.assign(window.SpectraCore.graph || {}, {
    getLatestFrame: function(){ return (sp.coreBridge && sp.coreBridge.frame) || null; },
    emitGraphFrame: emitGraphFrame
  });
})();


/* SPECTRA-PRO Phase 1 hook patch (robust frame hook on drawGraph) */
(function(){
  const sp = window.SpectraPro || (window.SpectraPro = {});
  function emitGraphFrame(payload){
    try {
      if (sp.coreHooks && sp.coreHooks.emit) sp.coreHooks.emit('graphFrame', payload);
      sp.coreBridge = sp.coreBridge || {};
      sp.coreBridge.frame = payload;
    } catch(e){}
  }
  function buildFrame(){
    try {
      if (typeof pixels === 'undefined' || !pixels || !pixels.length) return null;
      const pixelWidth = Math.floor(pixels.length / 4);
      if (!pixelWidth) return null;
      const R = new Array(pixelWidth), G = new Array(pixelWidth), B = new Array(pixelWidth), I = new Array(pixelWidth), px = new Array(pixelWidth);
      let nm = null;
      const canNm = (typeof isCalibrated === 'function' && isCalibrated()) && (typeof getWaveLengthByPx === 'function');
      if (canNm) nm = new Array(pixelWidth);
      for (let i = 0; i < pixelWidth; i++) {
        const base = i * 4;
        const r = Number(pixels[base] || 0), g = Number(pixels[base + 1] || 0), b = Number(pixels[base + 2] || 0);
        R[i] = r; G[i] = g; B[i] = b; I[i] = Math.max(r, g, b); px[i] = i;
        if (nm) nm[i] = Number(getWaveLengthByPx(i + 1));
      }
      return { px, nm, R, G, B, I, pixelWidth, timestamp: Date.now(), source: (window.videoPaused ? 'image' : 'camera') };
    } catch (e) { return null; }
  }
  const origDrawGraph = window.drawGraph;
  if (typeof origDrawGraph === 'function' && !origDrawGraph.__spectraProPhase1Wrapped) {
    const wrapped = function(){
      const result = origDrawGraph.apply(this, arguments);
      const frame = buildFrame();
      if (frame) emitGraphFrame(frame);
      if (sp.overlays && sp.overlays.drawOnGraph && typeof graphCtx !== 'undefined') {
        try { sp.overlays.drawOnGraph(graphCtx, { graphCanvas: (typeof graphCanvas !== 'undefined' ? graphCanvas : null) }); } catch(e){}
      }
      return result;
    };
    wrapped.__spectraProPhase1Wrapped = true;
    window.drawGraph = wrapped;
  }
})();
