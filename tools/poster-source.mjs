import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Copy, URLs and live lettering do not affect the transparent geometry preview.
// Camera, layout, bindings, lighting and source grain do, so catch stale exports
// when these inputs change instead of silently publishing a mismatched handoff.
export async function posterSourceFingerprint() {
  const hash = createHash('sha256');
  for (const path of ['assets/js/bookshelf-model.mjs','assets/js/bookshelf-config.mjs','assets/js/page-lighting.mjs','assets/materials/binding-grain.webp']) hash.update(await readFile(path));
  const books = await readFile('_data/books.yml','utf8');
  hash.update(books.split('\n').filter(line => /^\s+(?:-\s+)?(?:id|cover|edge|width|height|gap_before|gap_after|texture_position):/.test(line)).join('\n'));
  const css = await readFile('assets/css/site.css','utf8');
  hash.update(css.slice(css.indexOf('.room {'),css.indexOf('.shelf-board::before,')));
  const source = await readFile('assets/js/bookshelf-scene.mjs','utf8');
  for (const [start,end] of [
    ['  renderer.outputColorSpace','  const grainReady'],
    ['function filteredShadowChunk()','export async function createBookshelfPresentation'],
    ['  function surfaceMaterial(book)','  function disposeWorld('],
    ['  function pageMaterial()','  function draw()'],
  ]) hash.update(source.slice(source.indexOf(start),source.indexOf(end)));
  return hash.digest('hex');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.stdout.write(await posterSourceFingerprint());
