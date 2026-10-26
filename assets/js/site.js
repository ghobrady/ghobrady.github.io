import { alignPosterLabels, decodedImage, afterPosterPaint } from './bookshelf-poster.mjs';

performance.mark('bookshelf:module');
const scene = document.querySelector('.scene');
const books = [...scene.querySelectorAll('.book--movable')];
const rows = [...scene.querySelectorAll('.book-row')];
const hoverCapable = matchMedia('(hover: hover) and (pointer: fine)');
const parameters = new URLSearchParams(location.search);
let presentation = {rebuild: () => alignPosterLabels(scene),setActive() {},reset() {}};
alignPosterLabels(scene);

function profile() {
  if (!parameters.has('profile')) return;
  scene.dataset.startup = JSON.stringify({
    marks: performance.getEntriesByType('mark').filter(entry => entry.name.startsWith('bookshelf:')).map(({name,startTime}) => ({name,ms: +startTime.toFixed(1)})),
    resources: performance.getEntriesByType('resource').map(({name,startTime,duration,transferSize,decodedBodySize}) => ({name: new URL(name).pathname,start: +startTime.toFixed(1),ms: +duration.toFixed(1),transferSize,decodedBodySize})),
  });
}

function syncHinge(book) {
  presentation.setActive(book,(hoverCapable.matches && book.matches(':hover')) || book.matches(':focus-visible'));
}
books.forEach(book => {
  for (const event of ['pointerenter','pointerleave','focus','blur']) book.addEventListener(event,() => requestAnimationFrame(() => syncHinge(book)));
});
scene.dataset.controlsReady = 'true';

let resizeFrame;
function scheduleRebuild() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => presentation.rebuild());
}
const geometryObserver = new ResizeObserver(scheduleRebuild);
rows.forEach(row => geometryObserver.observe(row));
window.addEventListener('resize',scheduleRebuild);
document.fonts.ready.then(scheduleRebuild);

async function start() {
  let posterReady = false;
  if (!parameters.has('export-poster')) {
    try {
      const poster = scene.querySelector('.bookshelf-poster');
      const pageLoaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => window.addEventListener('load',resolve,{once:true}));
      await Promise.all([...[...poster.querySelectorAll('img')].map(image => image.decode()),pageLoaded]);
      alignPosterLabels(scene);
      scene.dataset.posterReady = 'true';
      scene.dataset.renderer = 'poster';
      scene.dataset.ready = 'true';
      scene.setAttribute('aria-busy','false');
      performance.mark('bookshelf:poster-ready');
      posterReady = true;
      profile();
      // A static-only preview is useful for checking the handoff and resilience.
      if (parameters.has('poster-only')) return;
      await afterPosterPaint();
    } catch (error) {
      console.warn('Initial bookshelf preview unavailable; loading the live scene.',error.message);
      scene.classList.remove('scene--poster');
    }
  } else {
    scene.classList.remove('scene--poster');
  }

  // These requests intentionally start only after the complete initial view can
  // paint. Decoding and downloading the live renderer then happen together.
  window.bookshelfGrain = decodedImage(new URL('../materials/binding-grain.webp',import.meta.url));
  window.bookshelfGrain.catch(() => {});
  try {
    const { createBookshelfPresentation } = await import('./bookshelf-scene.mjs');
    performance.mark('bookshelf:dependencies');
    presentation = await createBookshelfPresentation(scene);
    scene.classList.remove('scene--poster');
    scene.dataset.webglReady = 'true';
    performance.mark('bookshelf:webgl-ready');
    books.forEach(syncHinge);
  } catch (error) {
    console.warn('Keeping the static bookshelf view.',error.message);
    if (!posterReady) {
      const { createFallbackPresentation } = await import('./bookshelf-fallback.mjs');
      presentation = createFallbackPresentation(scene);
      scene.dataset.renderer = 'fallback';
    }
  }
  scene.dataset.ready = 'true';
  scene.setAttribute('aria-busy','false');
  profile();
}
start().catch(error => {
  console.warn('Bookshelf enhancement unavailable.',error.message);
  // Keep navigation and semantic labels available even if enhancement fails.
  scene.dataset.posterReady = 'true';
  scene.setAttribute('aria-busy','false');
});
