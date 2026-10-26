# Initial bookshelf previews

These transparent WebP images are exported from the same live Three.js scene,
materials, lights and camera. They contain geometry and shadows only; lettering,
dots, rules, focus outlines and click targets remain live HTML.

The initial view selects the viewport and display-density variant through `<picture>`, with five slices
sharing the same URL. The books and typography keep their size and placement;
transparent gutters stay fixed and only the empty shelf ends stretch. The wall
texture stays in CSS. No fade is used. If WebGL cannot load, this view remains
available with native navigation links.

## Regeneration

Use a local production preview after `npm ci && npm run build -- --export-posters`.
The export flag permits rebuilding after visual changes so updated images can
be captured; the normal build and CI still reject stale previews. At each viewport
below, open `/?export-poster` and wait for `.scene[data-poster-export]`:

| Name | CSS viewport | Pixels per em | Fixed central strip |
| --- | --- | --- | --- |
| desktop | 1200 × 1125 | 36 | 32 em |
| mobile | 600 × 1000 | 27 | 32 em |
| narrow | 360 × 800 | 18 | 30 em |

This export mode renders at device pixel ratio 2. Save each `.scene` element's
`data-poster-export` PNG data URL as `PREFIX-NAME.png`; combine the JSON from
`data-poster-metadata` under the three names in `PREFIX-metadata.json`.
Then run `python3 tools/encode-bookshelf-posters.py PREFIX` (requires Pillow).
It writes the 1×/2× WebP files and `_data/bookshelf_poster.json`, including dimensions,
content hashes and the visual source fingerprint. Run `npm run build` again.

The build rejects outdated previews when camera, mesh, binding, lighting or
layout inputs change. Recheck `/?poster-only` against the live view at desktop,
phone and narrow-phone widths, including a resize while the renderer loads.

`?poster-only&profile` freezes the initial view for QA. `?profile` records separate
`bookshelf:poster-ready` and `bookshelf:webgl-ready` timings in `data-startup`.
These are readiness markers, not a promise of actual screen-paint latency.
