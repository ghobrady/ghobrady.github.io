# Brady's Bookshelf

A local Jekyll personal site built as a quiet, tactile wall-mounted bookshelf, rendered as a real 3D scene.

## Run locally

Jekyll 4 is required. From this directory:

```bash
jekyll serve --livereload
```

Open `http://127.0.0.1:4000`.

The books tilt gently on hover and open into focused bookplate panels. Desktop uses the same compact shelf and book proportions as mobile, centered and scaled to fit the available height.

## Editing the shelf

Book labels, colors, dimensions, and panel copy all live in `_data/books.yml`. The page shell is in `index.html`, styling is in `assets/css/site.css`, and interactions are in `assets/js/site.js`.

The live geometry, lights and camera are generated in `assets/js/bookshelf-model.mjs`; `assets/js/bookshelf-scene.mjs` renders the model and keeps live HTML labels aligned. A generated GLB export is available at `assets/models/bookshelf.glb`.

Regenerate the model with `node tools/generate-bookshelf-model.mjs`. Run the geometry and motion checks with `node --test tests/*.test.mjs`. Three.js is pinned and vendored locally; no npm install or JavaScript build is needed to run Jekyll.

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
