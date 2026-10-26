import * as THREE from '../vendor/three.module.js';
import { MODEL, createBookshelfScene } from './bookshelf-model.mjs?v=pages-2';
import { advanceHinge, bookMotion } from './book-motion.mjs?v=pages-2';
import { spineMatrix } from './book-geometry.mjs?v=natural-6';

// Replace r186's five rotated PCF taps with a stable 5×5 hardware-filtered
// kernel. This keeps a short, smooth penumbra without stochastic edge speckle.
function filteredShadowChunk() {
  const source = THREE.ShaderChunk.shadowmap_pars_fragment;
  const start = source.indexOf('// Hardware PCF with LinearFilter');
  const closing = ') * 0.2;';
  const end = source.indexOf(closing,start)+closing.length;
  if (start < 0 || end < closing.length) return source;
  return source.slice(0,start)+`
    vec2 texelSize = vec2(1.0) / shadowMapSize;
    float radius = min(shadowRadius * 0.5, 1.5) * texelSize.x;
    shadow = 0.0;
    for (int y=0; y<5; y++) {
      for (int x=0; x<5; x++) {
        vec2 offset = (vec2(float(x),float(y))-vec2(2.0));
        shadow += texture(shadowMap,vec3(shadowCoord.xy+offset*radius,shadowCoord.z));
      }
    }
    shadow *= 0.04;
  `+source.slice(end);
}

export async function createBookshelfPresentation(sceneElement) {
  performance.mark('bookshelf:scene-start');
  const canvas = document.createElement('canvas');
  canvas.className = 'bookshelf-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: new URLSearchParams(location.search).has('export-poster') });
  renderer.setPixelRatio(new URLSearchParams(location.search).has('export-poster') ? 2 : Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);
  performance.mark('bookshelf:renderer');
  const grainReady = window.bookshelfGrain
    ? window.bookshelfGrain.then(image => new THREE.Texture(image))
    : new THREE.TextureLoader().loadAsync(new URL('../materials/binding-grain.webp', import.meta.url).href);
  let grain;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const elements = [...sceneElement.querySelectorAll('.book')];
  const shadowChunk = filteredShadowChunk();
  const states = new Map(elements.map(el => [el, { position: 0, velocity: 0, target: 0 }]));
  const identities = new Map(elements.map(el => [el, el.dataset.book || 'brady']));
  let world;
  let layout;
  let frame;
  let lastTime;
  let lastLayoutSignature;
  let preparedWorld;
  let preparedSignature;

  function readLayout() {
    const rect = sceneElement.getBoundingClientRect();
    const unit = parseFloat(getComputedStyle(sceneElement.querySelector('.room')).fontSize)/16;
    const shelves = [...sceneElement.querySelectorAll('.shelf')].map(el => {
      const board = el.querySelector('.shelf-board').getBoundingClientRect();
      return { id: el.querySelector('.book-row').dataset.shelf, x: board.left-rect.left, y: board.top-rect.top, width: board.width, height: board.height };
    });
    const horizon = (shelves[0].y+shelves[0].height+shelves[1].y)/2;
    const books = elements.map(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { id: identities.get(el), shelfId: el.closest('.book-row').dataset.shelf, x: r.left-rect.left, y: r.top-rect.top, width: r.width, height: r.height, cover: style.getPropertyValue('--cover').trim(), edge: style.getPropertyValue('--cover-edge').trim(), texturePosition: parseFloat(style.getPropertyValue('--texture-position'))/100 };
    });
    return { width: rect.width, height: rect.height, unit, horizon, shelves, books };
  }

  function surfaceMaterial(book) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 256;
    textureCanvas.height = Math.round(256*book.height/book.width);
    const ctx = textureCanvas.getContext('2d');
    ctx.fillStyle = book.cover;
    ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    const image = grain.image;
    const cropHeight = image.height*.65;
    const cropWidth = cropHeight*book.width/book.height;
    const sourceX = (image.width-cropWidth)*(Number.isFinite(book.texturePosition) ? book.texturePosition : .5);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = book.id === 'brady' ? .72 : .56;
    const sourceY = (image.height-cropHeight)*.5;
    ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, textureCanvas.width, textureCanvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const binding = ctx.createLinearGradient(0,0,256,0);
    binding.addColorStop(0, '#ffffff05');
    binding.addColorStop(.05, '#fff8e71c');
    binding.addColorStop(.22, '#fff8e706');
    binding.addColorStop(.65, '#00000000');
    binding.addColorStop(1, '#10140820');
    ctx.fillStyle = binding;
    ctx.fillRect(0,0,textureCanvas.width,textureCanvas.height);
    const map = new THREE.CanvasTexture(textureCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    const reliefCanvas = document.createElement('canvas');
    reliefCanvas.width = textureCanvas.width;
    reliefCanvas.height = textureCanvas.height;
    reliefCanvas.getContext('2d').drawImage(image,sourceX,sourceY,cropWidth,cropHeight,0,0,reliefCanvas.width,reliefCanvas.height);
    const relief = new THREE.CanvasTexture(reliefCanvas);
    relief.colorSpace = THREE.NoColorSpace;
    const material = new THREE.MeshStandardMaterial({ map, bumpMap: relief, bumpScale: .5*layout.unit, roughness: .95 });
    material.userData.ownedBump = true;
    material.userData.ownedMap = true;
    return material;
  }

  function disposeWorld(target = world) {
    if (!target) return;
    const geometries = new Set();
    const materials = new Set();
    target.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : object.material ? [object.material] : [])) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => { if (material.userData.ownedMap) material.map.dispose(); if (material.userData.ownedBump) material.bumpMap.dispose(); material.dispose(); });
    target.key.shadow.map?.dispose();
  }

  function pageMaterial() {
    const paper = document.createElement('canvas');
    paper.width = 512;
    paper.height = 256;
    const ctx = paper.getContext('2d');
    ctx.fillStyle = '#fbf8ef';
    ctx.fillRect(0,0,paper.width,paper.height);
    // Fine parallel cut edges run through the depth of the page stack.
    let seed = 37;
    for (let x=1; x<paper.width; x+=2) {
      seed = (seed*16807)%2147483647;
      ctx.strokeStyle = `rgba(108,94,68,${.025+(seed%60)/1000})`;
      ctx.lineWidth = .65;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,paper.height); ctx.stroke();
    }
    const map = new THREE.CanvasTexture(paper);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(),4);
    const material = new THREE.MeshStandardMaterial({ color: '#fffdf7', map, roughness: 1 });
    material.userData.ownedMap = true;
    return material;
  }

  function draw() {
    if (!world) return;
    for (let i=0; i<elements.length; i++) {
      const el = elements[i];
      const book = layout.books[i];
      const state = states.get(el);
      const mesh = world.books.get(book.id);
      const motion = bookMotion(state.position, mesh.userData.tiltAngle);
      const angle = motion.angle;
      mesh.rotation.x = THREE.MathUtils.degToRad(angle);
      const dimensions = { height: book.height, frontInset: MODEL.frontInset*layout.unit };
      const camera = { vanishingX: layout.width/2-book.x, horizon: layout.horizon-book.y, distance: MODEL.cameraDistance*layout.unit };
      el.querySelector('.book-spine').style.transform = `matrix3d(${spineMatrix(dimensions,camera,angle).join(',')})`;
      el.dataset.renderedAngle = angle.toFixed(3);
      el.dataset.motionPhase = motion.phase;
    }
    renderer.shadowMap.needsUpdate = true;
    renderer.render(world.scene, world.camera);
  }

  function rebuild() {
    const nextLayout = readLayout();
    const signature = JSON.stringify(nextLayout);
    if (signature === lastLayoutSignature) return;
    lastLayoutSignature = signature;
    layout = nextLayout;
    const frontMaterials = new Map(layout.books.map(book => [book.id,surfaceMaterial(book)]));
    performance.mark('bookshelf:materials');
    disposeWorld();
    if (preparedWorld && preparedSignature === signature) {
      world = preparedWorld;
      for (const [id,book] of world.books) {
        const spine = book.getObjectByName('rounded-spine');
        new Set(spine.material).forEach(material => material.dispose());
        spine.material = [frontMaterials.get(id),frontMaterials.get(id)];
      }
    } else {
      if (preparedWorld) disposeWorld(preparedWorld);
      world = createBookshelfScene(layout, { frontMaterials, paperMaterial: pageMaterial(), shadowOnlyWall: true });
    }
    preparedWorld = undefined;
    world.scene.traverse(object => {
      if (!object.isMesh) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',shadowChunk);
        };
        material.customProgramCacheKey = () => 'bookshelf-pcf-grid-2';
      }
    });
    performance.mark('bookshelf:geometry');
    renderer.setSize(layout.width, layout.height, false);
    draw();
    sceneElement.classList.add('scene--3d');
    sceneElement.dataset.renderer = 'webgl';
    if (new URLSearchParams(location.search).has('export-poster')) {
      const room = sceneElement.querySelector('.room');
      const bounds = room.getBoundingClientRect();
      const sceneBounds = sceneElement.getBoundingClientRect();
      const em = parseFloat(getComputedStyle(room).fontSize);
      const width = layout.shelves[0].width + 2*em;
      const height = bounds.height + 2*em;
      const ratio = renderer.getPixelRatio();
      const poster = document.createElement('canvas');
      poster.width = Math.round(width*ratio);
      poster.height = Math.round(height*ratio);
      poster.getContext('2d').drawImage(canvas,
        (layout.width-width)/2*ratio,(bounds.top-sceneBounds.top-em)*ratio,width*ratio,height*ratio,
        0,0,poster.width,poster.height);
      sceneElement.dataset.posterExport = poster.toDataURL('image/png');
      sceneElement.dataset.posterMetadata = JSON.stringify({widthEm:width/em,heightEm:height/em,centerEm:innerWidth < 400 ? 30 : 32,pixelsPerEm:ratio*em});
    }
  }

  function tick(time) {
    const seconds = lastTime === undefined ? 1/60 : (time-lastTime)/1000;
    lastTime = time;
    let moving = false;
    states.forEach(state => {
      const next = advanceHinge(state,state.target,seconds);
      Object.assign(state,next);
      moving ||= state.position !== state.target || state.velocity !== 0;
    });
    draw();
    if (moving) frame = requestAnimationFrame(tick);
    else { frame = undefined; lastTime = undefined; }
  }

  function setActive(el, active) {
    const state = states.get(el);
    state.target = active && !reducedMotion.matches ? 1 : 0;
    if (frame === undefined && (state.position !== state.target || state.velocity !== 0)) frame = requestAnimationFrame(tick);
  }
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    cancelAnimationFrame(frame);
    frame = undefined;
    lastTime = undefined;
    states.forEach(state => Object.assign(state, {position: 0, velocity: 0, target: 0}));
    draw();
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frame); frame = undefined; lastTime = undefined; });
  canvas.addEventListener('webglcontextrestored', () => { lastLayoutSignature = undefined; rebuild(); });
  sceneElement.prepend(canvas);
  try {
    // Geometry preparation overlaps the image's asynchronous decode.
    const initialLayout = readLayout();
    preparedSignature = JSON.stringify(initialLayout);
    preparedWorld = createBookshelfScene(initialLayout, { paperMaterial: pageMaterial(), shadowOnlyWall: true });
    grain = await grainReady;
    grain.colorSpace = THREE.NoColorSpace;
    performance.mark('bookshelf:grain');
    rebuild();
  }
  catch (error) { disposeWorld(); if (preparedWorld) disposeWorld(preparedWorld); renderer.dispose(); canvas.remove(); throw error; }
  return { rebuild, setActive, reset: () => elements.forEach(el => setActive(el,false)) };
}
