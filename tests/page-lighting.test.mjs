import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../assets/vendor/three.module.js';
import { createBookMesh, MODEL } from '../assets/js/bookshelf-model.mjs';
import { createPageSeams, pageOccluders } from '../assets/js/page-lighting.mjs';

test('each book has stable independent page seams with varied gaps and tones', () => {
  const ids = ['brady', 'about', 'friends', 'writing', 'projects', 'ringworld', 'clocktower', 'mediashelf'];
  const patterns = ids.map(id => createPageSeams(id, 87));
  assert.equal(new Set(patterns.map(pattern => JSON.stringify(pattern))).size, ids.length);
  ids.forEach((id, i) => {
    assert.deepEqual(createPageSeams(id, 87), patterns[i], 'redraws must not reshuffle the pages');
    const seams = patterns[i];
    assert.ok(seams.length >= 5 && seams.length <= 20, `${id}: keep the detail sparse`);
    assert.ok(seams.every(([x, width]) => x > 0 && x < 87 && width > 0));
    const gaps = seams.slice(1).map((seam, index) => seam[0] - seams[index][0]);
    assert.ok(Math.max(...gaps) / Math.min(...gaps) > 1.8, `${id}: avoid even spacing`);
    assert.ok(new Set(seams.map(seam => seam[2])).size > 4, `${id}: vary the cut darkness`);
    // Growing the block preserves the existing cuts rather than rescaling them.
    const wider = createPageSeams(id, 100);
    assert.deepEqual(wider.slice(0, seams.length), seams);
  });
});

test('page shadow bounds follow the physical covers and binding at both responsive scales', () => {
  for (const unit of [1, .5625]) {
    const book = createBookMesh({ id: 'test', width: 92 * unit, height: 368 * unit, cover: '#cd8f7a', edge: '#845344' }, unit);
    const paper = book.getObjectByName('recessed-page-block');
    const boxes = pageOccluders(92, 368).map(b => new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)));
    const half = new THREE.Vector3(paper.geometry.parameters.width, paper.geometry.parameters.height, paper.geometry.parameters.depth).multiplyScalar(.5 / unit);
    for (const angle of [0, 6, 9, 12]) {
      book.rotation.x = THREE.MathUtils.degToRad(angle);
      book.updateMatrixWorld(true);
      const inverse = paper.matrixWorld.clone().invert();
      for (const point of [[-half.x + .2, half.y, 0], [0, half.y, 0], [0, half.y, half.z - .2]]) {
        const localOrigin = new THREE.Vector3(...point);
        const worldOrigin = localOrigin.clone().multiplyScalar(unit).applyMatrix4(paper.matrixWorld);
        for (const worldDirection of [new THREE.Vector3(-300, 300, 3590).normalize(), new THREE.Vector3(0, 2400, 1000).normalize()]) {
          const localDirection = worldDirection.clone().transformDirection(inverse);
          const ray = new THREE.Ray(localOrigin, localDirection);
          const predicted = boxes.some(box => ray.intersectBox(box, new THREE.Vector3()) !== null);
          const raycaster = new THREE.Raycaster(worldOrigin, worldDirection);
          const actual = raycaster.intersectObjects(book.children.filter(mesh => mesh !== paper)).length > 0;
          assert.equal(predicted, actual, `unit=${unit}, tilt=${angle}, point=${point}`);
        }
      }
    }
  }
});

test('tilted page edges are shaded by the binding while the exposed center sees the light', () => {
  const book = createBookMesh({ id: 'test', width: 92, height: 368, cover: '#cd8f7a', edge: '#845344' });
  book.rotation.x = THREE.MathUtils.degToRad(12);
  book.updateMatrixWorld(true);
  const paper = book.getObjectByName('recessed-page-block');
  const { height, depth } = paper.geometry.parameters;
  const blockers = book.children.filter(mesh => mesh !== paper);
  const direction = new THREE.Vector3(-300, 300, 3590).normalize();
  const blocked = z => new THREE.Raycaster(new THREE.Vector3(0, height / 2, z).applyMatrix4(paper.matrixWorld), direction).intersectObjects(blockers).length > 0;
  assert.equal(blocked(depth / 2 - .2), true);
  assert.equal(blocked(0), false);
  const leftEdge = new THREE.Vector3(-paper.geometry.parameters.width / 2 + .1, height / 2, 0).applyMatrix4(paper.matrixWorld);
  const coverHits = new THREE.Raycaster(leftEdge, direction).intersectObjects(blockers);
  assert.ok(coverHits.some(hit => hit.object.name === 'cover-board'), 'the left cover must cast onto the exposed paper');
  assert.equal(paper.castShadow, true);
  assert.equal(paper.receiveShadow, true);
  assert.equal(paper.material.userData.pageLighting, true);
  assert.ok(MODEL.pageInset > 0);
});
