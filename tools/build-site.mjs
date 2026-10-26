import { posterSourceFingerprint } from './poster-source.mjs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const previews = JSON.parse(await readFile('_data/bookshelf_poster.json','utf8'));
if (!process.argv.includes('--export-posters') && previews.sourceFingerprint !== await posterSourceFingerprint()) {
  throw new Error('Bookshelf previews need regenerating; see assets/previews/README.md.');
}

// Resolve the vendored runtime import to the same pinned release's source so
// esbuild can remove unused exports. Node geometry/export tools keep using the
// complete vendor module, while the browser gets a small entry and a deferred renderer.
for (const name of await readdir('assets/js')) {
  if (/^runtime-.*\.js$/.test(name)) await unlink('assets/js/'+name);
}
const result = await build({
  entryPoints: ['assets/js/site.js'],
  outdir: 'assets/js',
  entryNames: 'site.bundle',
  chunkNames: 'runtime-[name]-[hash]',
  splitting: true,
  metafile: true,
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022'],
  legalComments: 'eof',
  plugins: [{
    name: 'three-source',
    setup(builder) {
      builder.onResolve({ filter: /three\.module\.js$/ }, () => ({
        path: fileURLToPath(new URL('../node_modules/three/src/Three.js', import.meta.url)),
      }));
    },
  }],
});

const preloads = new Set();
function collectStaticImports(output) {
  for (const dependency of result.metafile.outputs[output].imports) {
    if (dependency.kind !== 'import-statement' || preloads.has('/'+dependency.path)) continue;
    preloads.add('/'+dependency.path);
    collectStaticImports(dependency.path);
  }
}
collectStaticImports('assets/js/site.bundle.js');
const initialBytes = ['assets/js/site.bundle.js',...[...preloads].map(path => path.slice(1))].reduce((sum,path) => sum+result.metafile.outputs[path].bytes,0);
if (initialBytes > 16000) throw new Error(`Initial JavaScript exceeds the 16 KB budget: ${initialBytes} bytes`);
const version = createHash('sha256').update(await readFile('assets/js/site.bundle.js')).digest('hex').slice(0,12);
await writeFile('_data/runtime.json',JSON.stringify({script: '/assets/js/site.bundle.js',version,preloads: [...preloads],initialBytes},null,2)+'\n');
