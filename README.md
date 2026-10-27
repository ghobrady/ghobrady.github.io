# Brady's Bookshelf

A local Jekyll personal site built as a quiet, tactile wall-mounted bookshelf, rendered as a real 3D scene.

## Run locally

Jekyll 4 is required. From this directory:

```bash
jekyll serve --livereload
```

Open `http://127.0.0.1:4000`.

For the optimized browser bundle, run `npm ci && npm run build` before starting Jekyll. Re-run `npm run build` after editing JavaScript. Without the generated bundle, local Jekyll previews use the source modules. GitHub Actions always builds the optimized bundle before publishing.

The books tilt gently on hover and link directly to their destinations. Friends lists personal websites; Projects and Mediashelf have under-construction placeholders. Ringworld and Clocktower link to their external sites. Desktop uses the same compact shelf and book proportions as mobile, centered and scaled to fit the available height.

## About and writing

`about.html` contains the placeholder introduction and bullet points, with a temporary portrait at `assets/images/portrait-placeholder.webp`. Replace that image with your photo when ready. The normal pages use their own base layout (`_layouts/content.html`) and stylesheet (`assets/css/pages.css`), with a back-to-bookshelf link and no navbar. They do not load the homepage styles or 3D runtime, so homepage work can proceed independently.

`writing.html` lists published posts with full dates, such as “Oct 24, 2026”. It shows an empty state until a post is published. The RSS feed at `/feed.xml` updates from published posts automatically. Article styling lives in `_layouts/post.html`.

The first post, “My first year in college,” is imported from Brady's Substack with its original May 7, 2026 publication date. The article layout shows the title, date, and a reading-time estimate at 200 words per minute. Original headings, links, emphasis, list and footnote are retained; Substack subscription widgets and comments are excluded. The old sample entries are archived under the ignored local `output/sample-posts-archive/` directory, so they no longer appear in the site, including draft previews.

The article’s back-to-writing link hides while scrolling down, reappears at the end and while scrolling up, and stays visible when keyboard-focused. This behavior lives in the independent `assets/js/article-navigation.mjs` module; without JavaScript the regular top link still works. Reduced-motion preferences disable the small transition.

To add a post, create `_posts/YYYY-MM-DD-title.md` (or `.html`) with `title`, `date` and `description` in its YAML front matter. Posts automatically use the article layout and `/writing/title/` URL.

## Editing the shelf

Book labels, colors, dimensions, and panel copy all live in `_data/books.yml`. The page shell is in `index.html`, styling is in `assets/css/site.css`, and interactions are in `assets/js/site.js`.

The live geometry, lights and camera are generated in `assets/js/bookshelf-model.mjs`; `assets/js/bookshelf-scene.mjs` renders the model and keeps live HTML labels aligned. A generated GLB export is available at `assets/models/bookshelf.glb`.

`assets/js/page-lighting.mjs` adds local cover/binding shadows on the recessed paper. Light rays are transformed into the book's rotating frame and tested against three cover bounds, with deterministic area-light samples for soft edges. A distance-based view factor shades both ambient and broad ceiling bounce in the narrow recesses, with extra contact contrast for the small display size. Sparse antialiased page seams have irregular spacing, widths and light/dark values. They depend only on the sheet axis, so no depth-varying pattern forms diagonal bands. The local bounds approximate the rounded covers; the full scene still uses its mesh shadow map for cast shadows.

Each book ID seeds an independent seam pattern with successive random gaps, occasional close pairs and longer blank stretches. The cuts stay stable across redraws and resizing. Both shelf hinges rotate only around the horizontal bottom-front edge; slight outward movement on screen comes from the shared perspective camera. Tests check the rightmost books against mirrored positions and confirm that their physical sideways travel is zero.

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

The first view uses transparent previews exported from the same 3D scene, with live HTML lettering and controls. The small startup controller aligns the lettering and shows the complete preview once the images are ready. Only after a paint opportunity does it request Three.js and the source binding scan. The live renderer replaces the preview directly when its first frame is ready, without a fade. If WebGL fails, the preview and native navigation links remain usable.

Three image variants cover desktop, mobile and narrow phones. Fixed central strips preserve book proportions while empty shelf ends adapt to the current width. The existing wall, real 3D materials, geometry and shadow settings remain in use. The initial JavaScript graph has a 16 KB build budget; the initial entry stays below that limit.

See `assets/previews/README.md` for preview regeneration. The build checks the preview source fingerprint so changed visual inputs cannot silently ship with an outdated initial image. Appending `?poster-only` freezes the initial view for QA. `?profile` records separate `bookshelf:poster-ready` and `bookshelf:webgl-ready` timing markers in `.scene`'s `data-startup`. These measure readiness, not guaranteed screen-paint time; network and device performance still apply. Measurements stay in the browser, and no persistent material cache is used.
