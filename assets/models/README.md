# Bookshelf model

`bookshelf.glb` is a generated glTF 2.0 model of the two wall-mounted shelves, eight hardcover books, supporting wall, centered camera and lights. It includes an About hinge preview animation. The spines are intentionally unlettered in the export: the website uses projected live HTML labels for crisp text and accessible controls. Generated binding grain is assigned at runtime.

The live website and this export construct geometry from the same source, `assets/js/bookshelf-model.mjs`. The GLB is an inspectable export of that model, not a separate approximation or a pre-rendered image used as a backdrop. Responsive dimensions are measured from the existing layout and passed to that model builder. `bookshelf-layout.json` stores the canonical desktop layout used for the export.

Regenerate from the project root:

```
node tools/generate-bookshelf-model.mjs
```

The exported camera's extras record the exact viewport, focal distance, horizon, and view offset. Standard glTF cameras do not encode asymmetric view offsets, so external viewers may frame the scene differently. The live site applies those parameters directly. Room ambient fill is recorded in scene extras because glTF punctual lights do not include ambient illumination.
