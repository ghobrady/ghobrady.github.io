# Brady's Bookshelf

A local Jekyll personal site built as a quiet, tactile wall-mounted bookshelf, rendered as a real 3D scene.

## Run locally

Jekyll 4 is required. From this directory:

```bash
jekyll serve --livereload
```

Open `http://127.0.0.1:4000`.

For the optimized browser bundle, run `npm ci && npm run build` before starting Jekyll. Re-run `npm run build` after editing JavaScript. Without the generated bundle, local Jekyll previews use the source modules. GitHub Actions always builds the optimized bundle before publishing.

The books tilt gently on hover and open into focused bookplate panels. Desktop uses the same compact shelf and book proportions as mobile, centered and scaled to fit the available height.

## Editing the shelf

Book labels, colors, dimensions, and panel copy all live in `_data/books.yml`. The page shell is in `index.html`, styling is in `assets/css/site.css`, and interactions are in `assets/js/site.js`.

The live geometry, lights and camera are generated in `assets/js/bookshelf-model.mjs`; `assets/js/bookshelf-scene.mjs` renders the model and keeps live HTML labels aligned. A generated GLB export is available at `assets/models/bookshelf.glb`.

Regenerate the model with `node tools/generate-bookshelf-model.mjs`. Run the geometry and motion checks with `node --test tests/*.test.mjs`. Three.js is pinned and vendored locally; Node build tools are pinned separately in `package-lock.json`.

## Publishing

The site is configured for https://ghobrady.github.io/ from the `ghobrady/ghobrady.github.io` repository.

GitHub repository settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Push changes to `main` to run the geometry/motion checks, build Jekyll in production mode, and deploy automatically. The workflow is `.github/workflows/pages.yml`; no personal access token or deploy key is required by the workflow. GitHub supplies its scoped deployment token.

```bash
git add .
git commit -m "Update bookshelf"
git push origin main
```

For a local root-path preview, run `bundle exec jekyll serve --livereload`. Generated `_site/` files and local `output/` design explorations are excluded from Git and the published build.

## Startup performance

The browser loads one minified, tree-shaken ES module rather than following the original module waterfall. The grain preload uses the same request mode as the CSS fallback, avoiding a second 635 KB scan download. Image decoding starts in the head and overlaps scene geometry preparation. The shaded scene appears directly after the first render, with no fade or extra reveal frame. Original images, material resolution, geometry and shadow settings are retained.

Append `?profile` to the bookshelf URL to expose local timing marks and resource sizes in `.scene`'s `data-startup` attribute. `bookshelf:ready` measures navigation-to-ready; it is not a guarantee of screen paint or a particular network/device speed. Measurements do not leave the browser. No persistent material cache is used. A cold first visit still includes network and WebGL setup costs; 75 ms is a target, not a promised result.
