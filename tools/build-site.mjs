import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Resolve the vendored runtime import to the same pinned release's source so
// esbuild can remove unused exports. Node geometry/export tools keep using the
// complete vendor module, while the browser gets one self-contained download.
await build({
  entryPoints: ['assets/js/site.js'],
  outfile: 'assets/js/site.bundle.js',
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

const version = createHash('sha256').update(await readFile('assets/js/site.bundle.js')).digest('hex').slice(0,12);
await writeFile('_data/runtime.json',JSON.stringify({ script: '/assets/js/site.bundle.js', version },null,2)+'\n');
