# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OriSim3D is a browser-based origami (paper-folding) simulator: a 2D crease-pattern editor paired with a live 3D fold preview, driven by a small text-based command/scripting language. Runtime is plain ES modules with no build step or framework — `index.html` loads `js/*.js` directly via `<script type="module">`.

## Commands

Run tests (Deno):
```bash
deno test --allow-read --allow-write --coverage=cov_profile test
```

Run a single test file:
```bash
deno test --allow-read --allow-write test/Model.test.ts
```

Coverage report:
```bash
deno coverage cov_profile
open cov_profile/html/index.html
```

Serve the app locally:
```bash
deno run --allow-net --allow-read jsr:@std/http/file-server
open http://localhost:8000
```

Tests are `.ts` files under `test/` using `@std/assert` (mapped in `deno.json`), even though the app source is plain `.js`. Each test file exercises the same-named module in `js/`.

## Architecture

**Data model** (`js/Model.js` + `js/Point.js`, `js/Segment.js`, `js/Face.js`, `js/Plane.js`, `js/Vector3.js`):
- `Point` holds both the 3D folded position (`x,y,z`) and the flat 2D crease-pattern position (`xf,yf`) — every point exists simultaneously in both spaces.
- `Segment` is just a pair of point references (`p1,p2`); `Face` is an ordered list of point references. Nothing is duplicated — segments/faces always reference the shared `Model.points` array.
- `Model` owns `points`/`segments`/`faces` arrays plus mutation methods (add/split/rotate/offset/adjust) and serialize/deserialize for save/load and undo snapshots.

**Command language** (`js/Command.js` + `js/CommandArea.js`):
- `Command.command(text)` tokenizes and interprets a whitespace-separated text script (see command list in README) and applies it to a `Model`, driving animated transitions via `js/Interpolator.js` (linear / accelerate-decelerate easing).
- Scripts are embedded in `index.html` as `<template>` tags (`#cocotte`, `#boat`, `#test`, etc.) and executed by `command.command(text)`; `CommandArea` is an optional on-screen console for typing commands live.
- `done`/`instructions` on `Command` track state history to support undo.

**Input handling** (`js/Helper.js`):
- Translates raw mouse/touch events on the 2D canvas into `Command` calls: click to select/mark points, segments, faces; drag point→point adds a crease (or a perpendicular crease if one exists); drag segment→segment adds a bisector; drag on a point rotates around the currently selected segment; swipes undo/turn the model. This is the only layer that knows about pointer gestures — it never touches rendering or the model directly, it emits commands.

**Rendering** (`js/View2d.js`, `js/View3d.js`, `js/lib/`):
- `View2d` draws the flat crease pattern (the `xf,yf` coordinates) on `#canvas2d`.
- `View3d` renders the folded 3D paper via raw WebGL on `#canvas3d`/`#overlay`, using `js/lib/mat4.js`/`vec3.js` (a trimmed local copy of gl-matrix, not an npm dependency) for matrix/vector math.
- The `index.html` `loop()` function is the single render/animation loop: it calls `command.anim()` each frame to advance any in-flight command animation, then redraws both views.

**Persistence** (`js/ReadWrite.js`):
- Reads/writes models as either the native line-based command-script text format or FOLD-spec JSON (`vertices_coords`/`edges_vertices`/`faces_vertices`). `models/*.txt` are saved command scripts; `models/*.fold` is FOLD JSON.
- Crease type lives on `Segment.assignment` (`M`/`V`/`B`), set by commands `mountain`/`valley` or FOLD `edges_assignment`.

## Coordinate convention

Throughout the model, 2D crease-pattern coordinates are always named `xf,yf` and 3D folded coordinates are `x,y,z`. When adding geometry logic, keep operations on the correct pair — e.g. crease/split logic generally works in `xf,yf`, while folding/rotation works in `x,y,z`, and `adjust` is the operation that reconciles the two (moves 3D points so their distances match the 2D pattern).
