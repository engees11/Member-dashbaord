// Profile photo helpers. Everything here runs in the browser, except cropSquare which is plain maths.
export const PHOTO_SIZE = 480; // the photo is kept as a small square, at most 480 x 480

// the biggest centred square of a w x h picture
export function cropSquare(w, h) {
    const side = Math.min(w, h);
    return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side };
}

async function toBitmap(file) {
    if (typeof createImageBitmap === 'function') {
        try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* an older browser: below */ }
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this photo')); };
        img.src = url;
    });
}

function drawSquare(src, w, h) {
    const { sx, sy, side } = cropSquare(w, h);
    const size = Math.min(PHOTO_SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').drawImage(src, sx, sy, side, side, 0, 0, size, size);
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(new File([b], 'photo.jpg', { type: 'image/jpeg' })) : reject(new Error('Could not read this photo'))), 'image/jpeg', 0.85);
    });
}

// a chosen picture (any size) -> a small square JPG file
export async function squareJpeg(file) {
    const bmp = await toBitmap(file);
    return drawSquare(bmp, bmp.width, bmp.height);
}
// one frame of the camera -> a small square JPG file
export const videoToJpeg = (video) => drawSquare(video, video.videoWidth, video.videoHeight);

export const isPhone = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
export const canUseCamera = () => typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
