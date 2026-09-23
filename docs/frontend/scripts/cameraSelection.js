/**
 * Display the camera selection above the graph
 * NOTE: This is the original version of the func, possibly may be needed for revert
 */
function showSelectedStripe() {
    const stripeCanvas = document.getElementById('stripeCanvas');
    const graphCanvas = document.getElementById('graphCanvas');
    if (!stripeCanvas || !graphCanvas) {
        return;
    }

    const stripeCtx = stripeCanvas.getContext('2d');
    if (!stripeCtx) return;

    let numericFrame = null;
    try {
        numericFrame = window.SpectraPro && window.SpectraPro.coreBridge && window.SpectraPro.coreBridge.numericFrame;
    } catch (_) {}

    if (numericFrame && Array.isArray(numericFrame.I) && numericFrame.I.length > 1) {
        const rect = stripeCanvas.getBoundingClientRect();
        const targetWidth = Math.max(1, Math.round(rect.width || graphCanvas.getBoundingClientRect().width || 1));
        const targetHeight = Math.max(1, Math.round(rect.height || 50));
        if (stripeCanvas.width !== targetWidth) stripeCanvas.width = targetWidth;
        if (stripeCanvas.height !== targetHeight) stripeCanvas.height = targetHeight;

        const count = numericFrame.I.length;
        let zoomStart = 0;
        let zoomEnd = count;
        if (typeof zoomList !== 'undefined' && zoomList.length !== 0) {
            zoomStart = Math.max(0, Number(zoomList[zoomList.length - 1][0]) || 0);
            zoomEnd = Math.min(count, Number(zoomList[zoomList.length - 1][1]) || count);
        }
        if (!(zoomEnd > zoomStart)) {
            zoomStart = 0;
            zoomEnd = count;
        }

        const sourceRgb = numericFrame.sourceRgb;
        const hasSourceRgb = sourceRgb &&
            Array.isArray(sourceRgb.R) && Array.isArray(sourceRgb.G) && Array.isArray(sourceRgb.B) &&
            sourceRgb.R.length === count && sourceRgb.G.length === count && sourceRgb.B.length === count;
        const hasRgb = Array.isArray(numericFrame.R) && Array.isArray(numericFrame.G) && Array.isArray(numericFrame.B) &&
            numericFrame.R.length === count && numericFrame.G.length === count && numericFrame.B.length === count;

        let maxI = 0;
        if (!hasSourceRgb && !hasRgb) {
            for (let i = 0; i < count; i += 1) maxI = Math.max(maxI, Number(numericFrame.I[i]) || 0);
        }
        if (!(maxI > 0)) maxI = 1;

        stripeCtx.clearRect(0, 0, stripeCanvas.width, stripeCanvas.height);
        stripeCtx.fillStyle = '#000';
        stripeCtx.fillRect(0, 0, stripeCanvas.width, stripeCanvas.height);

        for (let x = 0; x < stripeCanvas.width; x += 1) {
            const t = stripeCanvas.width > 1 ? x / (stripeCanvas.width - 1) : 0;
            const index = Math.max(0, Math.min(count - 1, Math.round(zoomStart + t * Math.max(0, zoomEnd - zoomStart - 1))));
            let r, g, b;
            if (hasSourceRgb) {
                r = Number(sourceRgb.R[index]) || 0;
                g = Number(sourceRgb.G[index]) || 0;
                b = Number(sourceRgb.B[index]) || 0;
            } else if (hasRgb) {
                r = Number(numericFrame.R[index]) || 0;
                g = Number(numericFrame.G[index]) || 0;
                b = Number(numericFrame.B[index]) || 0;
            } else {
                const v = Math.max(0, Math.min(255, Math.round(255 * (Number(numericFrame.I[index]) || 0) / maxI)));
                r = v; g = v; b = v;
            }
            stripeCtx.fillStyle = 'rgb(' +
                Math.max(0, Math.min(255, Math.round(r))) + ',' +
                Math.max(0, Math.min(255, Math.round(g))) + ',' +
                Math.max(0, Math.min(255, Math.round(b))) + ')';
            stripeCtx.fillRect(x, 0, 1, stripeCanvas.height);
        }
        return;
    }

    const stripeWidth = getStripeWidth();
    if (typeof stripeWidth !== 'number' || stripeWidth <= 0) return;
    if (!videoElement || getElementWidth(videoElement) <= 0 || getElementHeight(videoElement) <= 0) return;

    const videoWidth = getElementWidth(videoElement);
    const stripePosition = getYPercentage() * getElementHeight(videoElement) - stripeWidth;

    let zoomStart = 0;
    let zoomEnd = videoWidth;

    if (zoomList.length !== 0) {
        zoomStart = zoomList[zoomList.length - 1][0];
        zoomEnd = zoomList[zoomList.length - 1][1];
    }

    stripeCtx.clearRect(0, 0, stripeCanvas.width, stripeCanvas.height);
    stripeCtx.drawImage(videoElement, zoomStart, stripePosition, zoomEnd - zoomStart, stripeWidth*2, 0, 0, stripeCanvas.width, stripeCanvas.height);
}

/**
 * Updates the stripe continuously
 */
function updateStripeContinuously() {
    showSelectedStripe();
    requestAnimationFrame(updateStripeContinuously);
}

updateStripeContinuously();