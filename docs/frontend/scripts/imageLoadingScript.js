const maxLoadableImages = 5;
let loadedImageCounter = 0;
let comparisonColors = ['#d64d4d','#5b915b','#362cba',
    '#cabb6e', '#4cb199'];
let comparisonGraph = [];
let checkedComparisonId = null;

/**
 * Loads an image from the user's computer into the camera window
 */
function loadImageIntoCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const stream = videoElement.srcObject;
                if (stream) {
                    const tracks = stream.getTracks();
                    tracks.forEach(track => track.stop());
                    videoElement.srcObject = null;
                    console.log('Camera stream stopped');
                }

                switchLoadedImageSettings(file.name);

                videoElement.style.display = 'none';
                document.getElementById("pauseVideoButton").style.visibility = "hidden";
                document.getElementById("playVideoButton").style.visibility = "visible";
                videoElement = document.getElementById('cameraImage');
                videoElement.onload = () => {
                    console.log('Loaded image into camera window');
                    initializeZoomList();
                    redrawGraphIfLoadedImage(true);
                };
                videoElement.src = e.target.result;
                videoElement.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    input.click();
}

/**
 * Shows settings based on if they're needed with a loaded/unloaded image
 * @param filename - name of the loaded file, if none is set the function reverts settings to camera mode
 */
function switchLoadedImageSettings(filename = null) {
    const display = document.getElementById('loadedImageFilename');
    display.innerText = filename;
    display.style.display = filename === null ? 'none' : 'block';

    const select = document.getElementById('cameraSelect');
    select.style.display = filename === null ? 'block' : 'none';

    const exposureSettings = document.getElementById('cameraExposure');
    if (exposureSettings !== null) {
        exposureSettings.style.display = filename === null ? 'block' : 'none';
    }
}

/**
 * Loads multiple images, creates entries for each in the right sidebar
 */
function loadMultipleImages() {

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';

    input.addEventListener('change', function(event) {
        const files = Array.from(event.target.files);
        const index = Math.min(maxLoadableImages, files.length);

        const uniqueFiles = files.slice(0,index);

        for (const file of uniqueFiles) {
            const fileReader = new FileReader();

            fileReader.onload = function(e) {
                addImageElement(e.target.result, file.name);
            }

            fileReader.readAsDataURL(file);
        }

        document.getElementById("loadMultipleImagesButton").style.visibility = "hidden";
        document.getElementById("removeMultipleImagesButton").style.visibility = "visible";
    });

    input.click();
}

/**
 * Removes all loaded comparison images
 */
function removeLoadedImages() {
    for (let i = loadedImageCounter; i >= 1; i--) {
        removeImageElement(i);
    }

    document.getElementById("loadMultipleImagesButton").style.visibility = "visible";
    document.getElementById("removeMultipleImagesButton").style.visibility = "hidden";
    comparisonGraph = [];
    checkedComparisonId = null;
    needToRecalculateMaxima = true;
}

/**
 * Adds a new div for the choice of comparison between multiple spectrums
 */
function addImageElement(imageSrc, filename) {
    if (loadedImageCounter === maxLoadableImages) {
        return;
    }

    loadedImageCounter++;

    const parent = document.getElementById("sidebar-right");
    const id = loadedImageCounter;

    const wrapper = document.createElement("div");
    wrapper.classList.add("image-loaded-wrapper");
    wrapper.id = `loadedImageWrapper${id}`;
    wrapper.style.borderColor = comparisonColors[id-1];

    const controls = document.createElement("div");
    controls.classList.add("image-controls");

    const radioButton = document.createElement("input");
    radioButton.id = `imageRadio${id}`;
    radioButton.type = "radio";
    radioButton.dataset.translateTitle = "compare-loaded-image-tooltip";
    radioButton.onclick = function () {
        checkRadio(id);
    };


    const deleteButton = document.createElement("button");
    deleteButton.id = `imageDeleteButton${id}`;
    deleteButton.innerHTML = '&times;';
    deleteButton.classList.add("btn", "btn-sm", "btn-danger", "btn-secondary", "pb-0.5");
    deleteButton.dataset.translateTitle = "remove-loaded-image-tooltip";
    deleteButton.onclick = function () {
        removeImageElement(id);
    };

    controls.appendChild(radioButton);
    controls.appendChild(deleteButton);
    wrapper.appendChild(controls);

    const labelImageWrapper = document.createElement("div");
    labelImageWrapper.classList.add("outer-image-wrapper");

    const label = document.createElement("div");
    label.classList.add("camera-image-text");
    if (filename === undefined) {
        label.innerText = id;
    } else {
        label.innerText = filename;
    }
    labelImageWrapper.appendChild(label);

    const imageWrapper = document.createElement("div");
    imageWrapper.classList.add("inner-image-wrapper");

    const image = document.createElement("img");
    image.id = `loadedImage${id}`
    image.classList.add("loaded-image");
    image.src = imageSrc;
    image.onload = () => {
        updateLoadedImageStripeCanvases();
    };

    const stripeCanvas = document.createElement("canvas");
    stripeCanvas.id = `loadedImageStripeCanvas${id}`;
    stripeCanvas.classList.add("loaded-image-stripe-canvas")

    imageWrapper.appendChild(image);
    imageWrapper.appendChild(stripeCanvas);
    labelImageWrapper.appendChild(imageWrapper);
    wrapper.appendChild(labelImageWrapper);

    parent.appendChild(wrapper);

    updateLoadedImageStripeCanvases();
    updateTextContent();
}

/**
 * Checks the wanted radio button and selects its associated image for analysis, unchecks the rest
 */
function checkRadio(radioId) {
    if (radioId > maxLoadableImages || radioId < 0) {
        return;
    }

    for (let i = 0; i <= loadedImageCounter; i++) {
        const radioButton = document.getElementById(`imageRadio${i}`);
        if (radioButton) {
            radioButton.checked = i === radioId;
            if (radioButton.checked) {
                checkedComparisonId = i === 0 ? null : i - 1;
            }
        }
    }
    needToRecalculateMaxima = true;
    redrawGraphIfLoadedImage(true);
}

/**
 * Removes the wanted image selection element, adjusts ids/functions on the rest
 */
function removeImageElement(loadedImageId) {
    if (loadedImageId > maxLoadableImages || loadedImageId < 1) {
        return;
    }

    const parent = document.getElementById("sidebar-right");
    const element = document.getElementById(`loadedImageWrapper${loadedImageId}`);

    parent.removeChild(element);
    comparisonGraph.splice(loadedImageId-1, 1);

    adjustForRemovedId(loadedImageId);

    loadedImageCounter--;
    if (loadedImageCounter === 0) {
        checkedComparisonId = null;
        removeLoadedImages();
    }
}

/**
 * Adjusts ids/funcs for the removal of a specific selection image
 */
function adjustForRemovedId(removedId) {
    if (removedId < 1 || removedId > maxLoadableImages) {
        return;
    }

    const radioButton = document.getElementById(`imageRadio${removedId}`);
    if (radioButton === null || radioButton.checked) {
        checkRadio(0);
    }

    for (let i = removedId+1; i <= loadedImageCounter ; i++) {
        let wrapper = document.getElementById(`loadedImageWrapper${i}`);
        wrapper.id = `loadedImageWrapper${i-1}`;

        wrapper = document.getElementById(`loadedImageWrapper${i-1}`);
        wrapper.style.borderColor = comparisonColors[i-2];

        let deleteButton = document.getElementById(`imageDeleteButton${i}`);
        deleteButton.id = `imageDeleteButton${i-1}`;
        deleteButton.onclick = function () { removeImageElement(i-1); };

        let radioButton = document.getElementById(`imageRadio${i}`);
        radioButton.id = `imageRadio${i-1}`;
        radioButton.onclick = function () { checkRadio(i-1); };

        let image = document.getElementById(`loadedImage${i}`);
        image.id = `loadedImage${i-1}`;

        let stripeCanvas = document.getElementById(`loadedImageStripeCanvas${i}`);
        stripeCanvas.id = `loadedImageStripeCanvas${i-1}`;

    }
}

/**
 * Updates all the stripe canvases for the loaded images
 */
function updateLoadedImageStripeCanvases() {

    for (let i = 1; i <= loadedImageCounter ; i++) {
        const canvas = document.getElementById(`loadedImageStripeCanvas${i}`);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        updateLoadedImageStripeData(i);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
        ctx.lineWidth = getStripeWidth();
        var y = yPercentage * canvas.height;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    needToRecalculateMaxima = true;
    redrawGraphIfLoadedImage(true);
}

/**
 * Updates the RGBA data for a specific loaded image
 */
function updateLoadedImageStripeData(imageId) {
    const image = document.getElementById(`loadedImage${imageId}`);

    const tempCanvas = createLineCanvas();
    const tempCtx = tempCanvas.getContext('2d');

    const startY = getElementHeight(image) * yPercentage - stripeWidth / 2;
    tempCtx.drawImage(image, 0, startY, getElementWidth(image), stripeWidth, 0, 0, getElementWidth(image), stripeWidth);

    let pixels = tempCtx.getImageData(0, 0, getElementWidth(image), stripeWidth).data;
    let pixelWidth = getElementWidth(image);

    if (stripeWidth > 1) {
        pixels = averagePixels(pixels, pixelWidth);
    }

    comparisonGraph[imageId-1] = [pixels, pixelWidth, minValue, calculateMaxValue(pixels) - MAX_Y_VALUE_PADDING];
}

function getCheckedComparisonImageData() {
    console.log(comparisonGraph);
    if (checkedComparisonId === null) {
        return null;
    }
    return comparisonGraph[checkedComparisonId];
}

function getCheckedComparisonId() {
    return checkedComparisonId;
}