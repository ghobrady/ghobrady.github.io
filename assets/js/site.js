import { CAMERA_DISTANCE, projectionMatrix } from "./book-geometry.mjs?v=natural-6";
import { createBookVisual } from "./book-renderer.mjs?v=pages-2";

performance.mark("bookshelf:module");

const books = [...document.querySelectorAll(".book--movable")];
const rows = [...document.querySelectorAll(".book-row")];
const dialog = document.querySelector(".bookplate");
const closeButton = dialog.querySelector(".bookplate__close");
const status = document.querySelector("#shelf-status");
const scene = document.querySelector(".scene");
scene.setAttribute("aria-busy", "true");
let returnFocus = null;
const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");
let presentation;

try {
  const { createBookshelfPresentation } = await import("./bookshelf-scene.mjs?v=first-paint-1");
  performance.mark("bookshelf:dependencies");
  presentation = await createBookshelfPresentation(scene);
  performance.mark("bookshelf:rendered");
} catch (error) {
  // Keep the semantic HTML and existing projected view usable without WebGL.
  console.warn("Using the lightweight bookshelf fallback.", error.message);
  const visuals = new Map([...document.querySelectorAll(".book")].map((book,index) => [book,createBookVisual(book,index)]));
  const rebuild = () => {
    const unit = parseFloat(getComputedStyle(document.querySelector(".room")).fontSize)/16;
    const upper = document.querySelector(".shelf--top .shelf-board").getBoundingClientRect();
    const lower = document.querySelector(".shelf--bottom .shelf-board").getBoundingClientRect();
    const horizon = (upper.bottom+lower.top)/2;
    for (const row of rows) {
      const board = row.nextElementSibling;
      const r = board.getBoundingClientRect();
      board.style.setProperty("--depth-projection",projectionMatrix({vanishingX: innerWidth/2-r.left,horizon: horizon-r.top,distance: CAMERA_DISTANCE*unit}));
      for (const book of row.querySelectorAll(".book")) {
        const rect = book.getBoundingClientRect();
        visuals.get(book).configure({width: rect.width,height: rect.height,depth: 96*unit,coverThickness: 2.2*unit,cornerRadius: 4*unit,pageInset: 3*unit,left: 0,baseline: rect.height,frontInset: 18*unit}, {vanishingX: innerWidth/2-rect.left,horizon: horizon-rect.top,distance: CAMERA_DISTANCE*unit});
      }
    }
  };
  presentation = { rebuild,setActive: (book,active) => visuals.get(book).setActive(active),reset: () => visuals.forEach(visual => visual.setActive(false)) };
  presentation.rebuild();
}

let resizeFrame;
const scheduleRebuild = () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => presentation.rebuild());
};
const geometryObserver = new ResizeObserver(scheduleRebuild);
rows.forEach(row => geometryObserver.observe(row));
window.addEventListener("resize",scheduleRebuild);
document.fonts.ready.then(scheduleRebuild);

function announce(message) {
  status.textContent = "";
  window.requestAnimationFrame(() => {
    status.textContent = message;
  });
}

function openBook(book) {
  returnFocus = book;
  dialog.style.setProperty("--panel-accent", book.dataset.accent);
  dialog.querySelector(".bookplate__kicker").textContent = book.dataset.kicker;
  dialog.querySelector("#bookplate-title").textContent = book.dataset.title;
  dialog.querySelector(".bookplate__copy").textContent = book.dataset.copy;
  dialog.querySelector(".bookplate__folio span").textContent = book.dataset.title;
  presentation.reset();
  dialog.showModal();
  announce(`${book.dataset.title} opened.`);
}

books.forEach((book) => {
  book.addEventListener("click", () => openBook(book));
  const syncHinge = () => presentation.setActive(book,!dialog.open && ((hoverCapable.matches && book.matches(":hover")) || book.matches(":focus-visible")));
  for (const event of ["pointerenter", "pointerleave", "focus", "blur"]) {
    book.addEventListener(event, () => requestAnimationFrame(syncHinge));
  }
});

closeButton.addEventListener("click", () => dialog.close());

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("close", () => {
  if (returnFocus) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
});

// The fully shaded frame is submitted and controls are bound before reveal.
// Reveal synchronously so the browser can paint it at the next opportunity.
{
  performance.mark("bookshelf:ready");
  if (new URLSearchParams(location.search).has("profile")) {
    scene.dataset.startup = JSON.stringify({
      marks: performance.getEntriesByType("mark").filter(entry => entry.name.startsWith("bookshelf:")).map(({name,startTime}) => ({name,ms: +startTime.toFixed(1)})),
      resources: performance.getEntriesByType("resource").map(({name,startTime,duration,transferSize,decodedBodySize}) => ({name: new URL(name).pathname, start: +startTime.toFixed(1), ms: +duration.toFixed(1), transferSize, decodedBodySize})),
    });
  }
  scene.dataset.ready = "true";
  scene.setAttribute("aria-busy", "false");
  document.documentElement.classList.remove("bookshelf-loading");
}
