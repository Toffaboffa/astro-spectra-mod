/**
 * Display the camera selection above the graph
 * NOTE: This is the original version of the func, possibly may be needed for revert
 */
function showSelectedStripe() {
    const stripeCanvas = document.getElementById('stripeCanvas');
    const graphCanvas = document.getElementById('graphCanvas');
    if (!stripeCanvas || !graphCanvas) {
        console.error('stripeCanvas or graphCanvas element not found');
        return;
    }

    const stripeCtx = stripeCanvas.getContext('2d');
    if (!stripeCtx) {
        console.error('Unable to get 2D context for stripeCanvas');
        return;
    }

    const stripeWidth = getStripeWidth();
    if (typeof stripeWidth !== 'number' || stripeWidth <= 0) {
        return;
    }

    if (!videoElement || getElementWidth(videoElement) <= 0 || getElementHeight(videoElement) <= 0) {
        return;
    }

    const videoWidth = getElementWidth(videoElement);
    const stripePosition = getYPercentage() * getElementHeight(videoElement) - stripeWidth;

    let zoomStart = 0;
    let zoomEnd = videoWidth;

    if (zoomList.length !== 0) {
        zoomStart = zoomList[zoomList.length - 1][0];
        zoomEnd = zoomList[zoomList.length - 1][1];
    }

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