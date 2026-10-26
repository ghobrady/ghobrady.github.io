export const TILT_DEGREES = 8;
export const REST_TILT_DEGREES = 0;
export const CAMERA_DISTANCE = 11000;

// One shallow perspective camera for books and shelves. Camera coordinates
// are relative to the object being drawn; the front shelf lip is z = 0.
export function projectionMatrix({ vanishingX, horizon, distance }) {
  return `matrix3d(1,0,0,0,0,1,0,0,${-vanishingX / distance},${-horizon / distance},1,${-1 / distance},0,0,0,1)`;
}

export function bookProjector({ width, height, left = 0, baseline = height, frontInset = 0 }, camera, degrees) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return function vertex(x, y, z) {
    const dy = y - height;
    const world = {
      x: left + x,
      y: baseline + dy * cos + z * sin,
      z: -dy * sin + z * cos - frontInset,
    };
    const perspective = 1 / (1 - world.z / camera.distance);
    return {
      world,
      x: camera.vanishingX + (world.x - camera.vanishingX) * perspective,
      y: camera.horizon + (world.y - camera.horizon) * perspective,
    };
  };
}

// Exact projective transform of the HTML spine, including its lettering.
// Unlike an affine approximation, its four corners follow the solid mesh.
export function spineMatrix({ height, frontInset = 0 }, camera, degrees) {
  const angle = degrees * Math.PI / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const z0 = height * sin - frontInset;
  const f = camera.distance;
  return [1, 0, 0, 0,
    camera.vanishingX * sin / f, cos + camera.horizon * sin / f, 0, sin / f,
    0, 0, 1, 0,
    -camera.vanishingX * z0 / f, height - height * cos - camera.horizon * z0 / f, 0, 1 - z0 / f];
}

export function projectBook(dimensions, camera, degrees) {
  const { width, height, depth } = dimensions;
  const vertex = bookProjector(dimensions, camera, degrees);

  const corners = {
    frontTopLeft: vertex(0, 0, 0),
    frontTopRight: vertex(width, 0, 0),
    frontBottomLeft: vertex(0, height, 0),
    frontBottomRight: vertex(width, height, 0),
    backTopLeft: vertex(0, 0, -depth),
    backTopRight: vertex(width, 0, -depth),
    backBottomLeft: vertex(0, height, -depth),
    backBottomRight: vertex(width, height, -depth),
  };
  const points = Object.values(corners);
  const front = [corners.frontTopLeft, corners.frontTopRight, corners.frontBottomLeft, corners.frontBottomRight];
  const top = [corners.frontTopLeft, corners.frontTopRight, corners.backTopLeft, corners.backTopRight];
  return {
    corners,
    spineHeight: Math.max(...front.map(p => p.y)) - Math.min(...front.map(p => p.y)),
    silhouetteHeight: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)),
    pageReveal: Math.max(...top.map(p => p.y)) - Math.min(...top.map(p => p.y)),
    forwardTravel: height * Math.sin(degrees * Math.PI / 180),
  };
}

// The hardcover is two solid side boards and a solid binding. The paper
// is recessed below the boards and inset from their back edges.
export function bookComponents({ width, height, depth, coverThickness = 2.6, cornerRadius = 4.5, pageInset = 3 }) {
  const t = coverThickness;
  const binding = t * 1.25;
  const overhang = pageInset;
  return [
    { name: "left-cover", material: "cover", radius: cornerRadius, min: [0, 0, -depth], max: [t, height, 0] },
    { name: "right-cover", material: "cover", radius: cornerRadius, min: [width - t, 0, -depth], max: [width, height, 0] },
    { name: "binding", material: "cover", min: [t, 0, -binding], max: [width - t, height, 0] },
    { name: "paper", material: "paper", radius: 1.2, min: [t + 1.1, overhang, -depth + pageInset], max: [width - t - 1.1, height - overhang, -binding - 0.5] },
  ];
}

function roundedSurfaces(part) {
  const [x0, y0, z0] = part.min;
  const [x1, y1, z1] = part.max;
  const r = Math.min(part.radius, (y1 - y0) / 2, (z1 - z0) / 2);
  const centers = [[z1-r,y0+r,-90], [z1-r,y1-r,0], [z0+r,y1-r,90], [z0+r,y0+r,180]];
  const profile = [];
  for (const [z, y, start] of centers) {
    for (let step = 0; step <= 4; step++) {
      const a = (start + step * 22.5) * Math.PI / 180;
      profile.push([y + Math.sin(a) * r, z + Math.cos(a) * r]);
    }
  }
  const surfaces = [
    { side: "right", normal: [1,0,0], corners: profile.map(([y,z]) => [x1,y,z]) },
    { side: "left", normal: [-1,0,0], corners: profile.map(([y,z]) => [x0,y,z]) },
  ];
  profile.forEach(([ya,za], i) => {
    const [yb,zb] = profile[(i + 1) % profile.length];
    const length = Math.hypot(yb - ya, zb - za);
    if (length < 0.00001) return;
    const ny = -(zb - za) / length;
    const nz = (yb - ya) / length;
    const side = ny < -0.25 ? "top" : ny > 0.25 ? "bottom" : nz < 0 ? "back" : "front";
    surfaces.push({ side, edge: i, normal: [0,ny,nz], corners: [[x0,ya,za], [x0,yb,zb], [x1,yb,zb], [x1,ya,za]] });
  });
  return surfaces;
}

export function bookFaces(dimensions, camera, degrees) {
  const vertex = bookProjector(dimensions, camera, degrees);
  const radians = degrees * Math.PI / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const faces = [];

  for (const part of bookComponents(dimensions)) {
    const [x0, y0, z0] = part.min;
    const [x1, y1, z1] = part.max;
    const surfaces = part.radius ? roundedSurfaces(part) : [
      { side: "top", normal: [0, -1, 0], corners: [[x0,y0,z1], [x0,y0,z0], [x1,y0,z0], [x1,y0,z1]] },
      { side: "right", normal: [1, 0, 0], corners: [[x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1]] },
      { side: "left", normal: [-1, 0, 0], corners: [[x0,y0,z1], [x0,y0,z0], [x0,y1,z0], [x0,y1,z1]] },
      { side: "back", normal: [0, 0, -1], corners: [[x0,y0,z0], [x1,y0,z0], [x1,y1,z0], [x0,y1,z0]] },
      { side: "bottom", normal: [0, 1, 0], corners: [[x0,y1,z1], [x0,y1,z0], [x1,y1,z0], [x1,y1,z1]] },
    ];
    for (const face of surfaces) {
      const [nx, ny, nz] = face.normal;
      const points = face.corners.map(p => vertex(...p));
      const center = points.reduce((v, p) => ({ x: v.x + p.world.x / points.length, y: v.y + p.world.y / points.length, z: v.z + p.world.z / points.length }), { x: 0, y: 0, z: 0 });
      const view = { x: camera.vanishingX - center.x, y: camera.horizon - center.y, z: camera.distance - center.z };
      const facing = nx * view.x + (ny * cos + nz * sin) * view.y + (-ny * sin + nz * cos) * view.z;
      if (facing <= 0) continue;
      const sortDepth = -Math.hypot(view.x, view.y, view.z);
      faces.push({ key: `${part.name}-${face.side}-${face.edge ?? "plane"}`, part: part.name, material: part.material, side: face.side, points, sortDepth });
    }
  }
  return faces.sort((a, b) => a.sortDepth - b.sortDepth);
}
