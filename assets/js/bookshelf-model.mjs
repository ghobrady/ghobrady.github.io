import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { hingeAngleForShelf } from './book-motion.mjs?v=pages-2';

import { MODEL } from './bookshelf-config.mjs';
export { MODEL };

function roundedRectangle(width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(r, 0);
  shape.lineTo(width-r, 0);
  shape.quadraticCurveTo(width, 0, width, r);
  shape.lineTo(width, height-r);
  shape.quadraticCurveTo(width, height, width-r, height);
  shape.lineTo(r, height);
  shape.quadraticCurveTo(0, height, 0, height-r);
  shape.lineTo(0, r);
  shape.quadraticCurveTo(0, 0, r, 0);
  return shape;
}

function extrusion(width, height, radius, depth) {
  return new THREE.ExtrudeGeometry(roundedRectangle(width, height, radius), {
    depth, bevelEnabled: false, curveSegments: 6,
  });
}

export function createBookMesh(book, unit = 1, frontMaterial, paperMaterial) {
  const { width: w, height: h } = book;
  const depth = MODEL.bookDepth * unit;
  const thickness = MODEL.coverThickness * unit;
  const radius = MODEL.cornerRadius * unit;
  const group = new THREE.Group();
  group.name = `book-${book.id}`;
  group.userData = { role: 'book', id: book.id, width: w, height: h, depth, hinge: 'front-bottom-edge' };
  const cover = new THREE.MeshStandardMaterial({ color: book.cover, roughness: .94 });
  const edgeColor = new THREE.Color(book.cover).lerp(new THREE.Color(book.edge), .42);
  const edge = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: .98 });
  const face = frontMaterial || cover;

  // Real rounded hardcover boards, extruded across the spine width.
  for (const x of [0, w-thickness]) {
    const coverInset = thickness * .9;
    const geometry = extrusion(depth-coverInset, h, radius, thickness);
    geometry.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, edge);
    mesh.position.set(x,0,-thickness*.9);
    mesh.name = 'cover-board';
    group.add(mesh);
  }
  const bevel = 1.5*unit;
  const bindingDepth = thickness*1.4+bevel*2;
  const spineGeometry = new THREE.ExtrudeGeometry(roundedRectangle(w-bevel*2,h-bevel*2,radius-bevel), {
    depth: thickness*1.4, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 6,
  });
  spineGeometry.translate(bevel,bevel,-thickness*1.4-bevel);
  const positions = spineGeometry.getAttribute('position');
  const uv = spineGeometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / w, positions.getY(i) / h);
  const spine = new THREE.Mesh(spineGeometry, [face, face]);
  spine.name = 'rounded-spine';
  group.add(spine);

  const inset = MODEL.pageInset * unit;
  const pageFront = bindingDepth + MODEL.bindingGap*unit;
  const paper = new THREE.Mesh(
    new RoundedBoxGeometry(w-thickness*2-MODEL.pageSideGap*2*unit, h-inset*2, depth-pageFront-inset, 3, .65*unit),
    paperMaterial || new THREE.MeshStandardMaterial({ color: '#f5efe2', roughness: 1 }),
  );
  paper.name = 'recessed-page-block';
  paper.position.set(w/2, h/2, -(depth+pageFront-inset)/2);
  group.add(paper);
  group.traverse(object => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  return group;
}

export function createBookshelfScene(layout, { frontMaterials = new Map(), paperMaterial, shadowOnlyWall = false } = {}) {
  const unit = layout.unit;
  const shelfDepth = MODEL.shelfDepth * unit;
  const scene = new THREE.Scene();
  scene.name = 'Brady bookshelf';
  const model = new THREE.Group();
  model.name = 'Wall-mounted bookshelf';
  model.userData = { generator: 'bookshelf-model.mjs', unit: 'responsive design pixel', wallContact: true };
  scene.add(model);
  const books = new Map();
  const boards = [];
  const paint = new THREE.MeshStandardMaterial({ color: '#e8e4db', roughness: .88 });
  for (const shelf of layout.shelves) {
    const board = new THREE.Mesh(new RoundedBoxGeometry(shelf.width, shelf.height, shelfDepth, 4, 2*unit), paint);
    board.name = `shelf-${shelf.id}`;
    board.position.set(shelf.x+shelf.width/2-layout.width/2, layout.horizon-shelf.y-shelf.height/2, -shelfDepth/2);
    board.castShadow = true;
    board.receiveShadow = true;
    board.userData = { role: 'shelf', supportY: layout.horizon-shelf.y, rearZ: -shelfDepth };
    boards.push(board);
    model.add(board);
  }
  for (const data of layout.books) {
    const book = createBookMesh(data, unit, frontMaterials.get(data.id), paperMaterial);
    const shelfId = data.shelfId || layout.shelves.find(shelf => Math.abs(shelf.y-data.y-data.height)<.1)?.id;
    book.userData.shelfId = shelfId;
    book.userData.tiltAngle = hingeAngleForShelf(shelfId);
    book.position.set(data.x-layout.width/2, layout.horizon-data.y-data.height, -MODEL.frontInset*unit);
    books.set(data.id, book);
    model.add(book);
  }
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(layout.width*3, 4000*unit), Math.max(layout.height*3, 3000*unit)),
    shadowOnlyWall ? new THREE.ShadowMaterial({ color: '#242b23', opacity: .37 }) : new THREE.MeshStandardMaterial({ color: '#e2e5e4', roughness: 1 }),
  );
  wall.name = 'Supporting wall';
  wall.position.z = -shelfDepth;
  wall.receiveShadow = true;
  wall.userData = { role: 'wall', boardRearIsFlush: true };
  model.add(wall);

  const distance = MODEL.cameraDistance * unit;
  const fov = THREE.MathUtils.radToDeg(2*Math.atan(layout.height/(2*distance)));
  const camera = new THREE.PerspectiveCamera(fov, layout.width/layout.height, distance-1000*unit, distance+1000*unit);
  camera.name = 'Centered bookshelf camera';
  camera.userData = { viewportWidth: layout.width, viewportHeight: layout.height, horizon: layout.horizon, distance, viewOffsetY: layout.height/2-layout.horizon };
  camera.position.set(0, 0, distance);
  camera.setViewOffset(layout.width, layout.height, 0, layout.height/2-layout.horizon, layout.width, layout.height);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const key = new THREE.DirectionalLight('#fffdf8', 1.8);
  key.name = 'Upper-left key light';
  key.position.set(-300*unit, 450*unit, 3500*unit);
  key.target.position.set(0, 150*unit, -shelfDepth/2);
  key.castShadow = true;
  // Share the mobile shadow scale so the compact layout looks the same on desktop.
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1100*unit, right: 1100*unit, top: 1000*unit, bottom: -1000*unit, near: 100*unit, far: 6000*unit });
  key.shadow.bias = -.00004;
  key.shadow.normalBias = .3*unit;
  key.shadow.radius = 6;
  scene.add(key, key.target);
  const fill = new THREE.AmbientLight('#eef1f5', 1.0);
  fill.name = 'Soft room fill';
  scene.add(fill);
  const ceiling = new THREE.DirectionalLight('#f5f7ff', 1.6);
  ceiling.name = 'Broad ceiling bounce';
  ceiling.position.set(0, 2400*unit, 1000*unit);
  // Broad bounced illumination fills horizontal faces without a second shadow.
  scene.add(ceiling);
  scene.updateMatrixWorld(true);
  return { scene, model, camera, books, boards, wall, key };
}
