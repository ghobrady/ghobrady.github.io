import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { restingSpineMatrix } from '../assets/js/bookshelf-poster.mjs';
import { spineMatrix } from '../assets/js/book-geometry.mjs';
import { MODEL } from '../assets/js/bookshelf-config.mjs';
import { posterSourceFingerprint } from '../tools/poster-source.mjs';

test('initial live lettering uses exactly the same projection as the resting 3D books',() => {
  for (const unit of [.45,.75,1,1.125]) for (const x of [-300,0,250]) for (const y of [-140,180,600]) {
    const actual = restingSpineMatrix(x,y);
    const expected = spineMatrix({height:400*unit,frontInset:MODEL.frontInset*unit},{vanishingX:x,horizon:y,distance:MODEL.cameraDistance*unit},0);
    actual.forEach((value,index) => assert.ok(Math.abs(value-expected[index])<1e-12));
  }
});

test('committed previews match the current geometry, binding materials and layout inputs',async () => {
  const metadata = JSON.parse(await readFile('_data/bookshelf_poster.json','utf8'));
  assert.equal(metadata.sourceFingerprint,await posterSourceFingerprint());
  for (const name of ['desktop','mobile','narrow']) {
    for (const density of ['','1x']) {
      const image = await readFile('.'+metadata[name][density ? 'src1x' : 'src']);
      assert.equal(metadata[name][density ? 'version1x' : 'version'],createHash('sha256').update(image).digest('hex').slice(0,12));
      assert.equal(image.toString('ascii',8,12),'WEBP');
      assert.equal(image.toString('ascii',12,16),'VP8X');
      assert.ok(image[20]&0x10,'preview must preserve transparency over the live wall');
      assert.equal(image.readUIntLE(24,3)+1,Math.round(metadata[name].pixelWidth/(density ? 2 : 1)));
      assert.ok(image.length<(density ? 100000 : 250000),`${name} preview exceeds its first-load size budget`);
    }
  }
});

test('the initial JavaScript graph stays small and defers the WebGL renderer',async () => {
  const runtime = JSON.parse(await readFile('_data/runtime.json','utf8'));
  let total = 0;
  for (const path of [runtime.script,...runtime.preloads]) {
    assert.ok(!path.includes('bookshelf-scene'),'the renderer must not be preloaded before the poster');
    total += (await readFile('.'+path)).length;
  }
  assert.ok(total<16000,`initial JavaScript is ${total} bytes; budget is 16 KB`);
});
