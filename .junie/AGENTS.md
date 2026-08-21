# OriSim3D — Development Notes

Browser-based origami simulator: 2D crease-pattern editor + live 3D fold preview, driven by a small text command language.

## Build / Configuration

- **No build step, no npm, no framework.** The app is plain ES modules: `index.html` loads `js/*.js` directly via `<script type="module">`.
- The only tool is **Deno** (used for tests and a local file server). On this machine it lives at `/opt/homebrew/bin/deno` and may not be on the shell PATH — use the full path if `deno` is not found.
- `deno.json` only maps `@std/assert` (jsr) for tests; there are no other dependencies. `js/lib/mat4.js` is a trimmed local copy of gl-matrix, not an npm package.
- Serve the app locally:
  ```bash
  deno run --allow-net --allow-read jsr:@std/http/file-server
  open http://localhost:8000
  ```

## Testing

- Tests are **TypeScript** files in `test/*.test.ts` (Deno test runner + `@std/assert`), even though the app source is plain `.js`. Each test file exercises the same-named module in `js/`.
- Run all tests / a single file / coverage:
  ```bash
  deno test --allow-read --allow-write --coverage=cov_profile test
  deno test --allow-read --allow-write test/Model.test.ts
  deno coverage cov_profile   # then open cov_profile/html/index.html
  ```
  `--allow-read --allow-write` are required because some tests (e.g. `ReadWrite.test.ts`) read/write fixture files in `test/` (`model.txt`, `test.svg`, `json.txt`, …).
- Adding a test: create `test/<Module>.test.ts`, import assertions from `@std/assert` and the module under test with an explicit `.js` extension:
  ```ts
  import { assertEquals } from "@std/assert";
  import { Model } from "../js/Model.js";

  Deno.test("model init creates 4 points and 1 face", () => {
    const model = new Model();
    model.init(200, 200);
    assertEquals(model.points.length, 4);
    assertEquals(model.faces.length, 1);
  });
  ```
  (This exact test was verified to pass.)
- DOM-dependent tests (`View2d.test.ts`, `Helper.test.ts`) stub canvas/document objects manually — there is no jsdom; follow their pattern when testing UI code.

## Architecture Essentials

- **Dual coordinate spaces**: every `Point` carries both 3D folded coords `x,y,z` and flat 2D crease-pattern coords `xf,yf`. Crease/split logic works in `xf,yf`; folding/rotation works in `x,y,z`; `adjust` reconciles them (moves 3D points so segment lengths match the 2D pattern). Never mix the two spaces.
- **Shared references**: `Segment` (p1,p2) and `Face` (ordered point list) hold references into `Model.points` — never clone points when manipulating geometry.
- **Command layer** (`js/Command.js`): `Command.command(text)` interprets whitespace-separated scripts (`d`, `by`, `across`, `perpendicular`, `bisector`, `split`, `rotate`, `move`, `adjust`, `offset`, …) and drives animation via `Interpolator.js`. `done`/`instructions` arrays support undo via model serialize/deserialize snapshots.
- **Input** (`js/Helper.js`): translates mouse/touch gestures into commands only — it never touches rendering or the model directly.
- **Rendering**: `View2d` draws `xf,yf` on `#canvas2d`; `View3d` renders 3D with raw WebGL on `#canvas3d`/`#overlay`. The `loop()` in `index.html` is the single render/animation loop.
- **Persistence** (`js/ReadWrite.js`): native line-based command-script text (`models/*.txt`) or FOLD-spec JSON (`models/*.fold`), plus SVG export.

## Development Tips

- Demo models are embedded in `index.html` as `<template>` tags (`#cocotte`, `#boat`, `#test`, …) executed with `command.command(text)`; `CommandArea` is an on-screen console for typing commands live.
- `Memo.txt` is the maintainer's live TODO list (in French) — check it for current work-in-progress and intent.
- Code style: plain ES2015+ classes, no semicolon-free style, JSDoc-style comments sparsely used; keep new code framework-free and dependency-free. Comments in code and docs are partly in French — match the surrounding file.
- No linter/formatter config is committed; `deno fmt`/`deno lint` are available but not enforced — avoid mass-reformatting existing files.
