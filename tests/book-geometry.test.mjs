import assert from 'node:assert/strict';
import test from 'node:test';
import { bookComponents, bookFaces, bookProjector, projectBook, projectionMatrix, spineMatrix, TILT_DEGREES } from '../assets/js/book-geometry.mjs';

const dimensions = { width: 86, height: 338, depth: 88, left: 0, baseline: 338, frontInset: 18 };
const camera = { vanishingX: 745, horizon: 338, distance: 11000 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);

test('every component remains rigid and the complete bottom-front hinge stays fixed', () => {
  const rest = projectBook(dimensions, camera, 0).corners;
  for (const angle of [0, 1, 4, TILT_DEGREES]) {
    const { corners: c } = projectBook(dimensions, camera, angle);
    near(distance(c.frontTopLeft.world, c.frontBottomLeft.world), dimensions.height);
    near(distance(c.frontTopLeft.world, c.frontTopRight.world), dimensions.width);
    near(distance(c.frontTopLeft.world, c.backTopLeft.world), dimensions.depth);
    for (const key of ['frontBottomLeft', 'frontBottomRight']) {
      near(c[key].x, rest[key].x);
      near(c[key].y, rest[key].y);
      near(c[key].world.z, -dimensions.frontInset);
    }
    assert.ok(c.backBottomLeft.world.y <= dimensions.baseline);
    assert.ok(c.backBottomRight.world.y <= dimensions.baseline);
  }
});

test('upper resting edges recede downward and broad top paper faces are culled', () => {
  const { corners: c } = projectBook(dimensions, camera, 0);
  assert.ok(c.backTopRight.x > c.frontTopRight.x);
  assert.ok(c.backTopRight.y > c.frontTopRight.y);
  for (const face of bookFaces(dimensions, camera, 0).filter(f => f.material === 'paper' && f.side === 'top')) {
    // Tiny rounded front bevels may face us; the broad page plane cannot.
    assert.ok(Math.max(...face.points.map(p => p.world.z)) - Math.min(...face.points.map(p => p.world.z)) < 1);
  }
});

test('HTML lettering and all four spine corners follow the same projective mesh', () => {
  for (const angle of [0, 2, 5, 8]) {
    for (const horizon of [338, -72]) {
      const view = { ...camera, horizon };
      const m = spineMatrix(dimensions, view, angle);
      const project = bookProjector(dimensions, view, angle);
      for (const [x, y] of [[0,0], [86,0], [0,338], [86,338]]) {
        const w = m[3]*x + m[7]*y + m[15];
        const p = project(x,y,0);
        near((m[0]*x + m[4]*y + m[12])/w, p.x);
        near((m[1]*x + m[5]*y + m[13])/w, p.y);
      }
    }
  }
});

test('shelf projection agrees with every resting book contact corner', () => {
  const view = { ...camera, horizon: -72 };
  const matrix = projectionMatrix(view).slice(9,-1).split(',').map(Number);
  for (const point of Object.values(projectBook(dimensions, view, 0).corners).filter(p => p.world.y === dimensions.baseline)) {
    const {x,y,z} = point.world;
    const w = 1 + matrix[11]*z;
    near((x + matrix[8]*z)/w, point.x);
    near((y + matrix[9]*z)/w, point.y);
  }
});

test('cover boards enclose recessed paper and are painted in front of its side', () => {
  const parts = bookComponents(dimensions);
  const left = parts.find(p => p.name === 'left-cover');
  const right = parts.find(p => p.name === 'right-cover');
  const paper = parts.find(p => p.name === 'paper');
  assert.ok(paper.min[0] > left.max[0]);
  assert.ok(paper.max[0] < right.min[0]);
  assert.ok(paper.min[1] > left.min[1]);
  for (const angle of [0,4,8]) {
    const faces = bookFaces(dimensions, camera, angle);
    const coverIndex = faces.findIndex(f => f.part === 'right-cover' && f.side === 'right');
    const paperIndex = faces.findIndex(f => f.part === 'paper' && f.side === 'right');
    assert.ok(coverIndex > paperIndex);
  }
});
