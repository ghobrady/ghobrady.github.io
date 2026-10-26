# Bookshelf geometry, lighting and motion

## Live 3D model

`assets/js/bookshelf-model.mjs` generates the actual meshes used by the live WebGL scene and the exported `assets/models/bookshelf.glb`. Each shelf is a closed, softly beveled solid; each book has two rounded cover boards, a rounded spine and a recessed paper block. A supporting wall receives the scene's shadows.

Dimensions use responsive design pixels. At the reference size, shelf depth is 180, book depth is 96, front inset is 18, cover thickness is 2.2, and book corner radius is 4. Each board extends from z = 0 at its front to z = −180 at its back. The wall is at z = −180, so the rear surface meets the wall without a visual gap. Books extend to z = −114 and fit on the board. Their bottom edges share its top support plane.

Desktop and mobile share the compact mobile composition: equal-width ordinary spines, a wider/taller name book, uniform gaps with a small extra space after the name, centered About/Friends titles and the existing ornament colors. Desktop shelves are 43.5 responsive em wide (about 1.5 times the upper book group) and scale to the viewport height; mobile keeps its existing 92vw shelf and type scale. Runtime dimensions come from the semantic HTML layout; `assets/models/bookshelf-layout.json` captures the reference layout for export.

## Centered camera

The camera faces the wall directly, with no horizontal yaw. Its x position is centered between the shelf ends, hiding both outward-facing end caps through ordinary geometric visibility. Eye level is between the upper board's underside and the lower board's top. This exposes the upper underside and lower top surface.

The focal distance is 6500 design pixels. Near/far clipping planes tightly bracket the model at 5500/7500 design pixels to prevent the page block from fighting with the spine in the depth buffer, particularly on mobile. A perspective view offset puts the horizon at that eye level while preserving the existing page composition. Book mesh and live HTML labels use the same perspective projection; tests compare all four front corners at rest and at 4°/9°/12°.

## Real shadow casting

The key directional light casts a high-resolution PCF shadow map onto the wall, boards and books. The shelves' wall contact and actual thickness determine their shadow footprint; separate blurred CSS shelf shadows are disabled in the 3D view. The centered camera removes the previously exaggerated right end.

The key light sits above/left and in front of the scene. Soft ambient fill and a non-shadow-casting ceiling bounce keep matte cover colors and horizontal surfaces legible. A stable 5 × 5 PCF kernel filters the shadow edge with a short penumbra, avoiding the renderer’s default rotated five-tap edge speckle. The shadow edge is narrowly filtered, with the same 2048-pixel map scale on desktop and mobile to preserve the mobile lighting treatment at every size. Book and shelf shadows respond to actual mesh motion.

## Hinged movement

Each book's group origin is its front bottom contact edge. Hover on a fine pointer or keyboard focus rotates the upper-row meshes forward to 12° and lower-row meshes to 9°. The stronger upper hinge compensates for the camera looking upward toward those book tops. Rear bottom corners rise above the support plane; the front hinge remains stationary. There is no slide, separate text zoom or artificial mesh scale.

`book-motion.mjs` supplies a critically damped response with persistent position and velocity during reversals. The WebGL renderer and live labels advance from the same state. Rendering stops once the book settles; the page has no perpetual idle animation loop. Reduced-motion users keep still books and the existing focus/text cue.

## Semantics and fallback

HTML buttons, live labels and dialog panels remain available. The canvas is decorative and does not intercept clicks. If WebGL initialization fails, the existing lightweight projected HTML/SVG implementation remains usable. The old projection module and its tests are retained for that fallback and for exact HTML label projection.

## Export and verification

Regenerate the model with `node tools/generate-bookshelf-model.mjs`. The GLB contains the same geometry, materials, camera, lights and a sample hinge animation. Live lettering and grain are applied separately by the website. See `assets/models/README.md` for camera framing and ambient-light metadata in external viewers.

Run `node --test tests/*.test.mjs`. Tests cover wall contact, correct horizontal face visibility, hidden shelf ends, shelf support/depth, four-corner HTML/mesh projection agreement, hinge clearance, interrupted motion, and GLB structure, along with fallback geometry checks.

## Page reveal

The lighter ivory paper block has fine cut-page lines, a 3-design-pixel head/tail overhang, a 1.2-pixel gap inside each cover board, and a .75-pixel recess behind the binding. A slightly deeper 96-pixel book exposes more of the page head during the hinge. The cover, page block, lettering and shadows remain one rigid motion. Tests check visible projected paper area and all geometric clearances.
