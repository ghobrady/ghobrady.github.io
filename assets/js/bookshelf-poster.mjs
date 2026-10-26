import { MODEL } from './bookshelf-config.mjs';

// The resting 3D spine is parallel to the image plane. Its projective matrix
// needs only the camera/cover distance ratio; no renderer or texture is needed.
export function restingSpineMatrix(vanishingX,horizon) {
  const inset = MODEL.frontInset/MODEL.cameraDistance;
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, vanishingX*inset,horizon*inset,0,1+inset];
}

export function alignPosterLabels(scene) {
  const bounds = scene.getBoundingClientRect();
  const upper = scene.querySelector('.shelf--top .shelf-board').getBoundingClientRect();
  const lower = scene.querySelector('.shelf--bottom .shelf-board').getBoundingClientRect();
  const horizon = (upper.bottom+lower.top)/2;
  for (const book of scene.querySelectorAll('.book')) {
    const rect = book.getBoundingClientRect();
    book.querySelector('.book-spine').style.transform = `matrix3d(${restingSpineMatrix(bounds.left+bounds.width/2-rect.left,horizon-rect.top).join(',')})`;
  }
}

export function decodedImage(src) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image.decode().then(() => image);
}

// Two animation frames give the static view a paint opportunity before the
// renderer download, shader compilation and GPU uploads can occupy the thread.
export function afterPosterPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
