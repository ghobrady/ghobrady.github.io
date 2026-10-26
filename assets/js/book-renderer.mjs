import { bookFaces, bookProjector, spineMatrix } from "./book-geometry.mjs?v=natural-6";
import { advanceHinge, bookMotion, hingeAngleForShelf } from "./book-motion.mjs?v=pages-2";

const SVG_NS = "http://www.w3.org/2000/svg";

export function createBookVisual(book, index) {
  const model = book.querySelector(".book-model");
  const spine = book.querySelector(".book-spine");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("book-mesh");
  svg.setAttribute("aria-hidden", "true");
  const prefix = `book-mesh-${index}`;
  const textureUrl = new URL("../materials/binding-grain.webp", import.meta.url).href;
  svg.innerHTML = `<defs>
    <linearGradient id="${prefix}-paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7f2e8"/>
      <stop offset="1" stop-color="#e9e0ce"/>
    </linearGradient>
    <pattern id="${prefix}-binding" patternUnits="userSpaceOnUse" width="320" height="320">
      <rect width="320" height="320" fill="var(--cover-edge)"/>
      <image href="${textureUrl}" width="320" height="320" opacity=".22" style="mix-blend-mode:soft-light"/>
    </pattern>
  </defs>`;
  const layer = document.createElementNS(SVG_NS, "g");
  svg.append(layer);
  model.prepend(svg);

  const polygons = new Map();
  let dimensions;
  let state = { position: 0, velocity: 0 };
  let camera;
  let lastTime;
  let target = 0;
  let frame;
  let order = "";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function draw() {
    if (!dimensions) return;
    const motion = bookMotion(state.position, hingeAngleForShelf(book.closest(".book-row").dataset.shelf));
    const angle = motion.angle;
    const faces = bookFaces(dimensions, camera, angle);
    const elements = [];
    for (const face of faces) {
      let polygon = polygons.get(face.key);
      if (!polygon) {
        polygon = document.createElementNS(SVG_NS, "polygon");
        polygon.dataset.face = face.key;
        polygon.dataset.part = face.part;
        polygon.classList.add("mesh-face", `mesh-${face.material}`, `mesh-${face.side}`);
        if (face.material === "paper") polygon.setAttribute("fill", `url(#${prefix}-paper)`);
        else if (face.side === "right") polygon.style.fill = `url(#${prefix}-binding)`;
        polygons.set(face.key, polygon);
      }
      polygon.setAttribute("points", face.points.map(p => `${p.x.toFixed(5)},${p.y.toFixed(5)}`).join(" "));
      elements.push(polygon);
    }
    const nextOrder = faces.map(face => face.key).join("|");
    if (nextOrder !== order) {
      layer.replaceChildren(...elements);
      order = nextOrder;
    }

    spine.style.transform = `matrix3d(${spineMatrix(dimensions, camera, angle).join(",")})`;
    const project = bookProjector(dimensions, camera, angle);
    const a = project(0, 0, 0);
    const c = project(0, dimensions.height, 0);
    book.dataset.renderedAngle = angle.toFixed(3);
    book.dataset.motionPhase = motion.phase;
    book.style.setProperty("--motion-shadow-x", `${dimensions.height * 0.07 + dimensions.height * Math.sin(angle * Math.PI / 180) * 0.13}px`);
    book.style.setProperty("--motion-shadow-opacity", `${0.5 - state.position * 0.04}`);
    book.style.setProperty("--motion-shadow-scale-y", `${(c.y - a.y) / dimensions.height}`);
    book.style.setProperty("--motion-shadow-blur", `${dimensions.height * 0.014 + state.position * 1.5}px`);
    book.style.setProperty("--motion-shade", `${state.position * 0.055}`);
  }

  function tick(now) {
    state = advanceHinge(state, target, lastTime === undefined ? 1 / 60 : (now - lastTime) / 1000);
    lastTime = now;
    draw();
    if (state.position !== target || state.velocity !== 0) frame = requestAnimationFrame(tick);
    else { frame = undefined; lastTime = undefined; }
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      cancelAnimationFrame(frame);
      frame = undefined;
      lastTime = undefined;
      state = { position: 0, velocity: 0 };
      draw();
    }
  });

  return {
    configure(nextDimensions, nextCamera) {
      dimensions = nextDimensions;
      camera = nextCamera;
      svg.setAttribute("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`);
      draw();
    },
    setActive(active) {
      target = active && !reducedMotion.matches ? 1 : 0;
      if (reducedMotion.matches) return;
      if (frame === undefined && (state.position !== target || state.velocity !== 0)) {
        lastTime = undefined;
        frame = requestAnimationFrame(tick);
      }
    },
  };
}
