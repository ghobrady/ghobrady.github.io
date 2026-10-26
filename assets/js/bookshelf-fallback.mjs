import { CAMERA_DISTANCE, projectionMatrix } from './book-geometry.mjs?v=natural-6';
import { createBookVisual } from './book-renderer.mjs?v=pages-2';

export function createFallbackPresentation(scene) {
  const rows = [...scene.querySelectorAll('.book-row')];
  const visuals = new Map([...scene.querySelectorAll('.book')].map((book,index) => [book,createBookVisual(book,index)]));
  const rebuild = () => {
    const unit = parseFloat(getComputedStyle(scene.querySelector('.room')).fontSize)/16;
    const upper = scene.querySelector('.shelf--top .shelf-board').getBoundingClientRect();
    const lower = scene.querySelector('.shelf--bottom .shelf-board').getBoundingClientRect();
    const horizon = (upper.bottom+lower.top)/2;
    for (const row of rows) {
      const board = row.nextElementSibling;
      const r = board.getBoundingClientRect();
      board.style.setProperty('--depth-projection',projectionMatrix({vanishingX: innerWidth/2-r.left,horizon: horizon-r.top,distance: CAMERA_DISTANCE*unit}));
      for (const book of row.querySelectorAll('.book')) {
        const rect = book.getBoundingClientRect();
        visuals.get(book).configure({width: rect.width,height: rect.height,depth: 96*unit,coverThickness: 2.2*unit,cornerRadius: 4*unit,pageInset: 3*unit,left: 0,baseline: rect.height,frontInset: 18*unit}, {vanishingX: innerWidth/2-rect.left,horizon: horizon-rect.top,distance: CAMERA_DISTANCE*unit});
      }
    }
  };
  rebuild();
  return {rebuild,setActive: (book,active) => visuals.get(book).setActive(active),reset: () => visuals.forEach(visual => visual.setActive(false))};
}
