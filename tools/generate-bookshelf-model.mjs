import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from '../assets/vendor/three.module.js';
import { GLTFExporter } from './vendor/GLTFExporter.mjs';
import { createBookshelfScene } from '../assets/js/bookshelf-model.mjs';

// GLTFExporter's binary Blob path only needs these FileReader operations.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const layoutUrl = new URL('../assets/models/bookshelf-layout.json', import.meta.url);
const layout = JSON.parse(await readFile(layoutUrl, 'utf8'));
const { scene, books } = createBookshelfScene(layout);
scene.userData = { ambientFill: {color: '#eef1f5', intensity: 1.0}, geometrySource: 'assets/js/bookshelf-model.mjs' };
for (const light of [...scene.children]) {
  if (light.isAmbientLight) { scene.remove(light); continue; }
  if (!light.isDirectionalLight) continue;
  light.lookAt(light.target.getWorldPosition(new THREE.Vector3()));
  light.target.removeFromParent();
  light.add(light.target);
  light.target.position.set(0,0,-1);
}
scene.updateMatrixWorld(true);
const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(books.get('about').userData.tiltAngle));
const values = [0,0,0,1,...tilt.toArray(),...tilt.toArray(),0,0,0,1];
const preview = new THREE.AnimationClip('About hinge preview',1.1,[new THREE.QuaternionKeyframeTrack('book-about.quaternion',[0,.3,.7,1.1],values)]);
const bytes = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, trs: true, animations: [preview] });
const output = new URL('../assets/models/bookshelf.glb',import.meta.url);
await writeFile(output, Buffer.from(bytes));
console.log(`Generated ${output.pathname} (${bytes.byteLength} bytes)`);
