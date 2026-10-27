import * as THREE from '../vendor/three.module.js';
import { MODEL } from './bookshelf-config.mjs';

const MAX_PAGE_SEAMS = 32;

// A repeatable, independent cut-edge pattern for each physical book. Generate
// successive random gaps instead of jittering marks on a regular grid.
export function createPageSeams(bookId, paperWidth) {
  let seed = 2166136261;
  for (const character of bookId) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const seams = [];
  let x = 1.5 + random() * 6;
  while (x < paperWidth - 1.5 && seams.length < MAX_PAGE_SEAMS) {
    const width = .1 + random() * .3;
    const strength = random() < .15 ? -.03 - random() * .04 : .06 + random() ** 2 * .22;
    seams.push([x, width, strength]);
    // Occasional close pairs, and broad empty stretches between other cuts.
    x += random() < .2 ? 1.6 + random() * 2 : 4 + random() ** .7 * 11;
  }
  return seams;
}

// Dimensions in design pixels, in the page block's centered local frame.
// The hinge rotates this frame along with the actual hardcover meshes.
export function pageOccluders(width, height) {
  const t = MODEL.coverThickness;
  const bindingDepth = t * 1.4 + 3;
  const center = [width / 2, height / 2, -(MODEL.bookDepth + bindingDepth + MODEL.bindingGap - MODEL.pageInset) / 2];
  return [
    { min: [0, 0, -MODEL.bookDepth], max: [t, height, -t * .9] },
    { min: [width - t, 0, -MODEL.bookDepth], max: [width, height, -t * .9] },
    // The spine's rear bevel is 1.5px below the outer top edge. Using its
    // inner bounds avoids an oversized shadow from the rounded shoulder.
    { min: [1.5, 1.5, -bindingDepth], max: [width - 1.5, height - 1.5, 0] },
  ].map(box => ({ min: box.min.map((v, i) => v - center[i]), max: box.max.map((v, i) => v - center[i]) }));
}

const declarations = /* glsl */`
varying vec3 vPaperPosition;
varying vec3 vPaperViewX;
varying vec3 vPaperViewY;
varying vec3 vPaperViewZ;
uniform float paperUnit;
`;

const lighting = /* glsl */`
uniform vec3 paperBlockerMin[3];
uniform vec3 paperBlockerMax[3];
uniform vec3 paperHalfSize;
uniform vec3 paperSeams[${MAX_PAGE_SEAMS}];
uniform int paperSeamCount;

vec3 paperLocalDirection(vec3 viewDirection) {
  return normalize(vec3(dot(viewDirection, vPaperViewX), dot(viewDirection, vPaperViewY), dot(viewDirection, vPaperViewZ)));
}

// Slab ray/box intersection: trace toward each light, not toward the camera.
// Screen derivatives antialias the boundary without a shadow-map texel limit.
float paperRayBlocked(vec3 origin, vec3 direction) {
  vec3 inverseDirection = sign(direction + vec3(0.000001)) / max(abs(direction), vec3(0.000001));
  float blocked = 0.0;
  for (int b = 0; b < 3; b++) {
    vec3 a = (paperBlockerMin[b] - origin) * inverseDirection;
    vec3 c = (paperBlockerMax[b] - origin) * inverseDirection;
    vec3 entry = min(a, c);
    vec3 exit = max(a, c);
    float nearHit = max(max(entry.x, entry.y), max(entry.z, 0.02));
    float farHit = min(min(exit.x, exit.y), exit.z);
    float gap = farHit - nearHit;
    float aa = max(fwidth(gap), 0.015);
    blocked = max(blocked, smoothstep(-aa, aa, gap));
  }
  return blocked;
}

float paperLightVisibility(vec3 viewDirection) {
  vec3 direction = paperLocalDirection(viewDirection);
  vec3 tangent = normalize(cross(direction, abs(direction.y) < 0.95 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 bitangent = cross(direction, tangent);
  // The high ceiling bounce spans a much larger source than the frontal key.
  float sourceRadius = mix(0.12, 0.7, smoothstep(0.5, 0.9, abs(viewDirection.y)));
  // Nine deterministic area-light samples keep the contact shadow stable.
  vec3 origin = vPaperPosition;
  float blocked = 4.0 * paperRayBlocked(origin, direction);
  for (int s = 0; s < 8; s++) {
    float angle = float(s) * 0.785398163;
    vec3 sampleDirection = normalize(direction + sourceRadius * (cos(angle) * tangent + sin(angle) * bitangent));
    blocked += paperRayBlocked(origin, sampleDirection);
  }
  return 1.0 - blocked / 12.0;
}

// Cosine-weighted view factor of a raised edge. It falls off with the actual
// distance/recess rather than painting a dark stripe onto the page texture.
float paperEdgeOcclusion(float distanceToEdge, float rise) {
  float d = max(distanceToEdge, 0.01);
  return 0.5 * (1.0 - d / sqrt(d*d + rise*rise));
}

float paperAmbientVisibility(vec3 viewNormal) {
  float top = max(paperLocalDirection(viewNormal).y, 0.0);
  float rise = ${MODEL.pageInset.toFixed(2)};
  float left = paperEdgeOcclusion(vPaperPosition.x - paperBlockerMax[0].x, rise);
  float right = paperEdgeOcclusion(paperBlockerMin[1].x - vPaperPosition.x, rise);
  float bindingRise = max(paperBlockerMax[2].y - paperHalfSize.y, 0.0);
  float binding = paperEdgeOcclusion(paperBlockerMin[2].z - vPaperPosition.z, bindingRise);
  // Room bounce loses light on the way into and back out of the narrow
  // recess. Preserve that contact contrast at the shelf's small display size.
  float visibility = 1.0 - top * min(left + right + binding, 0.75);
  return visibility * visibility;
}

float paperEdgeTone() {
  // A few unevenly spaced cut seams, all parallel to the individual sheets.
  // Depend only on X: no depth modulation that can form diagonal bands.
  float x = vPaperPosition.x + paperHalfSize.x;
  float tone = 1.0;
  float aa = max(fwidth(x), 0.05);
  for (int i = 0; i < ${MAX_PAGE_SEAMS}; i++) {
    if (i >= paperSeamCount) break;
    vec3 cut = paperSeams[i];
    float seam = 1.0 - smoothstep(max(cut.y - aa * 0.5, 0.0), cut.y + aa * 0.5, abs(x - cut.x));
    tone -= seam * cut.z;
  }
  return tone;
}
`;

export function configurePageMaterial(material, width, height, unit, bookId = 'book') {
  const boxes = pageOccluders(width / unit, height / unit);
  const bindingDepth = MODEL.coverThickness * 1.4 + 3;
  const paperWidth = width / unit - 2 * (MODEL.coverThickness + MODEL.pageSideGap);
  const seams = createPageSeams(bookId, paperWidth);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      paperUnit: { value: unit },
      paperSeamCount: { value: seams.length },
      paperSeams: { value: Array.from({ length: MAX_PAGE_SEAMS }, (_, i) => new THREE.Vector3(...(seams[i] ?? [0, 0, 0]))) },
      paperBlockerMin: { value: boxes.map(b => new THREE.Vector3(...b.min)) },
      paperBlockerMax: { value: boxes.map(b => new THREE.Vector3(...b.max)) },
      paperHalfSize: { value: new THREE.Vector3(
        width / unit / 2 - MODEL.coverThickness - MODEL.pageSideGap,
        height / unit / 2 - MODEL.pageInset,
        (MODEL.bookDepth - bindingDepth - MODEL.bindingGap - MODEL.pageInset) / 2,
      ) },
    });
    shader.vertexShader = declarations + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vPaperPosition = position / paperUnit;
      vPaperViewX = modelViewMatrix[0].xyz;
      vPaperViewY = modelViewMatrix[1].xyz;
      vPaperViewZ = modelViewMatrix[2].xyz;
    `);
    const directLighting = THREE.ShaderChunk.lights_fragment_begin.replaceAll(
      'RE_Direct( directLight,',
      `// The ceiling represents diffuse room bounce. Its broad illumination
       // must lose energy in the cover recess as well as the ambient fill.
       directLight.color *= mix(paperLightVisibility(directLight.direction), paperAmbientVisibility(geometryNormal), smoothstep(0.5, 0.9, abs(directLight.direction.y)));
       RE_Direct( directLight,`,
    );
    shader.fragmentShader = declarations + lighting + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= paperEdgeTone();')
      .replace('#include <lights_fragment_begin>', directLighting)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n reflectedLight.indirectDiffuse *= paperAmbientVisibility(geometryNormal);');
  };
  material.customProgramCacheKey = () => 'paper-contact-shadows-3';
  material.userData.pageLighting = true;
  return material;
}
