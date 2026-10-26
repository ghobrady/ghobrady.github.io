# Vendored rendering dependency

Three.js 0.186.1, obtained from the official `three` package on npm. Files are served locally; the website does not load scripts from a CDN.

- `three.module.js`: minified ES module bundle of that release's `build/three.module.js` using esbuild.
- `RoundedBoxGeometry.js`: official addon from the same package, with its import changed to the local bundle.
- `THREE-LICENSE.txt`: original MIT license, also covering the exporter used in `tools/vendor/`.

Source package: https://www.npmjs.com/package/three/v/0.186.1
