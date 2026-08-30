// NOSONAR - SonarQube's S2187 test-detection doesn't recognize Deno's Deno.test()/t.step()
// API as test cases; this file contains 38 t.step() sub-tests (127 assertions) for Helper.js.
import { Model } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Helper } from "../js/Helper.js";
import { Point } from "../js/Point.js";
import { Segment } from "../js/Segment.js";
import { Face } from "../js/Face.js";

import { assertEquals } from "@std/assert";

class MockView3d {
  indexMap = new Map();
  scale = 10;
  constructor(model: Model) {
    model.points.forEach((point, index) => {
      this.indexMap.set(point, index);
    });
    model.points[0].xCanvas = -200;
    model.points[0].yCanvas = -200;
    model.points[1].xCanvas = 200;
    model.points[1].yCanvas = -200;
    model.points[2].xCanvas = 200;
    model.points[2].yCanvas = 200;
    model.points[3].xCanvas = -200;
    model.points[3].yCanvas = 200;
  }
  faceDepth(face: { points: { zEye?: number; z?: number }[] }) {
    let z = 0;
    for (const p of face.points) z += p.zEye ?? 0;
    return z / face.points.length;
  }
}

function captureCmds(command: Command) {
  const cmds: string[] = [];
  const original = command.command.bind(command);
  command.command = (cde) => {
    cmds.push(cde);
    return original(cde);
  };
  return cmds;
}

function setup() {
  const model = new Model().init(200, 200);
  const command = new Command(model);
  const helper = new Helper(model, command, null);
  new MockView3d(model);
  return { model, command, helper };
}

Deno.test("Helper Tests", async (t) => {
  await t.step("id() returns correct identifier strings", () => {
    const { model, helper } = setup();
    assertEquals(helper.id(model.points[0]), "p0");
    assertEquals(helper.id(model.segments[0]), "s0");
    assertEquals(helper.id(model.faces[0]), "f0");
    assertEquals(helper.id(null), "");
  });

  await t.step("down() sets point, segment, or face", () => {
    const { model, helper } = setup();

    helper.down([model.points[0]], [], [], 10, 20);
    assertEquals(helper.downPoint, model.points[0]);
    assertEquals(helper.downSegment, undefined);
    assertEquals(helper.downFace, undefined);

    helper.down([], [model.segments[0]], [], 10, 20);
    assertEquals(helper.downPoint, undefined);
    assertEquals(helper.downSegment, model.segments[0]);
    assertEquals(helper.downFace, undefined);

    helper.down([], [], [model.faces[0]], 10, 20);
    assertEquals(helper.downPoint, undefined);
    assertEquals(helper.downSegment, undefined);
    assertEquals(helper.downFace, model.faces[0]);
    assertEquals(helper.downFaces[0], model.faces[0]);
  });

  await t.step("mark P→P toggle, across, by", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const [p0, p1, p2] = model.points;

    helper.down([p0], [], [], 0, 0);
    helper.up([p0], [], []);
    assertEquals(p0.select, true);

    cmds.length = 0;
    helper.down([p0], [], [], 0, 0);
    helper.currentX = 50;
    helper.currentY = 0;
    helper.up([p1], [], []);
    assertEquals(cmds[0], "c3d p0 p1");

    cmds.length = 0;
    helper.down([p0], [], [], 0, 0);
    helper.currentX = 50;
    helper.currentY = 50;
    helper.up([p2], [], []);
    assertEquals(cmds[0], "by3d p0 p2");
  });

  await t.step("click on stacked points selects all of them", () => {
    const { model, helper } = setup();
    const p0 = model.points[0];
    // Same canvas projection, distinct model point (folded stack)
    const pExtra = new Point(1, 1, p0.x, p0.y, p0.z);
    pExtra.xCanvas = p0.xCanvas;
    pExtra.yCanvas = p0.yCanvas;
    model.points.push(pExtra);
    const stack = [p0, pExtra];

    helper.down(stack, [], [], 0, 0);
    helper.up(stack, [], []);
    assertEquals(p0.select, true);
    assertEquals(pExtra.select, true);

    // Not a double-click: clear the timer before toggling off
    helper.touchTime = 0;
    helper.lastClickPoints = [];
    helper.down(stack, [], [], 0, 0);
    helper.up(stack, [], []);
    assertEquals(p0.select, false);
    assertEquals(pExtra.select, false);
  });

  await t.step("double-click on a point sends adjust", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];

    helper.down([p0], [], [], 0, 0);
    helper.up([p0], [], []);
    assertEquals(p0.select, true);

    cmds.length = 0;
    helper.touchTime = Date.now();
    helper.lastClickPoints = [p0];
    helper.down([p0], [], [], 0, 0);
    helper.up([p0], [], []);
    assertEquals(cmds[0], "adjust p0");
  });

  await t.step("mark P→S sends p3d; S→P sends parallel3d", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];
    const s0 = model.segments[0];

    helper.down([p0], [], [], 0, 0);
    helper.currentX = 40;
    helper.currentY = 0;
    helper.up([], [s0], []);
    assertEquals(cmds[0], "p3d s0 p0");

    cmds.length = 0;
    helper.down([], [s0], [], 0, 0);
    helper.currentX = 40;
    helper.currentY = 0;
    helper.up([p0], [], []);
    assertEquals(cmds[0], "parallel3d s0 p0");
  });

  await t.step("mark S→P on 2d canvas sends parallel2d", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];
    const s0 = model.segments[0];
    helper.currentCanvas = "2d";

    helper.down([], [s0], [], 0, 0);
    helper.currentX = 40;
    helper.currentY = 0;
    helper.up([p0], [], []);
    assertEquals(cmds[0], "parallel2d s0 p0");
  });

  await t.step("rotationLabel on 2d uses xf/-yf even when xCanvas is stale", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    const s0 = model.segments[0]; // bottom edge yf=-200 → drawing y=200
    f0.select = true; // folding requires the face to already be selected
    // Poison 3d projection so a bug that still reads xCanvas would give a wrong angle
    model.points.forEach((p) => {
      p.xCanvas = 999;
      p.yCanvas = 999;
    });
    helper.currentCanvas = "2d";
    helper.down([], [], [f0], 0, 0);
    // Move toward the bottom edge in drawing space (y increases downward in -yf)
    helper.move([], [], [f0], 0, 150);
    const label = helper.label as number;
    assertEquals(typeof label, "number");
    assertEquals(label !== 0 && label !== undefined, true);
    assertEquals(s0.hover, true);
  });

  await t.step("mark S→S toggle and bisector", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const [s0, s1] = model.segments;

    helper.down([], [s0], [], 0, 0);
    helper.up([], [s0], []);
    assertEquals(s0.select, true);
    assertEquals(cmds[0], `// selectSegments s0(${Math.round(Segment.length2d(s0))},${Math.round(Segment.length3d(s0))})`);

    cmds.length = 0;
    helper.down([], [s0], [], 0, 0);
    helper.currentX = 40;
    helper.currentY = 40;
    helper.up([], [s1], []);
    assertEquals(cmds[0], "b3d s0 s1");
  });

  await t.step("click on stacked segments selects all and logs ids", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const s0 = model.segments[0];
    const sExtra = new Segment(s0.p1, s0.p2);
    model.segments.push(sExtra);
    const stack = [s0, sExtra];

    helper.down([], stack, [], 0, 0);
    helper.up([], stack, []);
    assertEquals(s0.select, true);
    assertEquals(sExtra.select, true);
    assertEquals(cmds[0], `// selectSegments ${helper.id(s0)}(${Math.round(Segment.length2d(s0))},${Math.round(Segment.length3d(s0))}) ${helper.id(sExtra)}(${Math.round(Segment.length2d(sExtra))},${Math.round(Segment.length3d(sExtra))})`);
  });

  await t.step("click on stacked faces selects all of them, toggles off, and logs ids", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    // Two overlapping faces in one pile (depth order)
    model.splitBy2d(model.points[0], model.points[2]);
    const f0 = model.faces[0];
    const f1 = model.faces[1];
    const stack = [f0, f1];

    helper.down([], [], stack, 0, 0);
    helper.up([], [], stack);
    assertEquals(f0.select, true);
    assertEquals(f1.select, true);
    assertEquals(cmds[0], `// selectFaces ${helper.id(f0)}(${f0.offset}) ${helper.id(f1)}(${f1.offset})`);

    cmds.length = 0;
    helper.down([], [], stack, 0, 0);
    helper.up([], [], stack);
    assertEquals(f0.select, false);
    assertEquals(f1.select, false);
    assertEquals(cmds.length, 0);

    // Points/segments untouched by the face-stack toggle
    model.points[0].select = true;
    model.segments[0].select = true;
    helper.toggleFaceStack(stack);
    assertEquals(f0.select, true);
    assertEquals(f1.select, true);
    helper.toggleFaceStack(stack);
    assertEquals(f0.select, false);
    assertEquals(f1.select, false);
    assertEquals(model.points[0].select, true);
    assertEquals(model.segments[0].select, true);
  });

  await t.step("mark F→F different faces selects Up front only", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    model.splitBy2d(model.points[0], model.points[2]);
    const f0 = model.faces[0];
    const f1 = model.faces[1];
    model.points[0].select = true;
    model.segments[0].select = true;

    helper.down([], [], [f0], 0, 0);
    helper.up([], [], [f1]);
    assertEquals(f1.select, true);
    assertEquals(f0.select, false);
    assertEquals(model.points[0].select, true);
    assertEquals(model.segments[0].select, true);
    assertEquals(cmds[0], `// selectFaces f1(${f1.offset})`);
  });

  await t.step("empty click clears selection", () => {
    const { model, helper } = setup();
    model.points[0].select = true;
    model.segments[0].select = true;
    model.faces[0].select = true;

    helper.down([], [], [], 0, 0);
    helper.up([], [], []);
    assertEquals(model.points[0].select, false);
    assertEquals(model.segments[0].select, false);
    assertEquals(model.faces[0].select, false);
  });

  await t.step("fold blocks crease gestures; allows P/S toggle", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    model.faces[0].select = true;
    const [p0, p1] = model.points;
    const [s0, s1] = model.segments;

    helper.down([p0], [], [], 0, 0);
    helper.currentX = 50;
    helper.currentY = 50;
    helper.up([p1], [], []);
    assertEquals(cmds.length, 0);

    helper.down([p0], [], [], 0, 0);
    helper.up([p0], [], []);
    assertEquals(p0.select, true);

    cmds.length = 0;
    helper.down([], [s0], [], 0, 0);
    helper.currentX = 40;
    helper.currentY = 40;
    helper.up([], [s1], []);
    assertEquals(cmds.length, 0);

    helper.down([], [s0], [], 0, 0);
    helper.up([], [s0], []);
    assertEquals(s0.select, true);
  });

  await t.step("screenRatioToSegmentT is perspective-correct", () => {
    // Equal depth → screen ratio equals segment parameter
    assertEquals(Helper.screenRatioToSegmentT(0.5, 1, 1), 0.5);
    // Farther endpoint (larger w) → screen midpoint maps before geometric midpoint
    assertEquals(Helper.screenRatioToSegmentT(0.5, 1, 3), 0.25);
    assertEquals(Helper.screenRatioToSegmentT(0, 2, 5), 0);
    assertEquals(Helper.screenRatioToSegmentT(1, 2, 5), 1);
  });

  await t.step("splitSegments uses clip w not model z for the ratio", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const s1 = model.segments[1]; // vertical at xCanvas=200
    // Fake a perspective projection: screen from y=-200..200, unequal clip w
    s1.p1.xCanvas = 200;
    s1.p1.yCanvas = -200;
    s1.p2.xCanvas = 200;
    s1.p2.yCanvas = 200;
    s1.p1.z = 0;
    s1.p2.z = 0;
    // clipW from a stub canvasView: w = 1 at p1, w = 3 at p2
    // Row3 of mat4 column-major: m[3],m[7],m[11],m[15] → w = m[15] + m[11]*z
    // Use identity-like with constant w via m[15], but we need different w per point.
    // Easier: set zEye so clipW uses -zEye
    s1.p1.zEye = -1;
    s1.p2.zEye = -3;

    // Drag crosses the segment at its screen midpoint (y=0)
    helper.firstX = 100;
    helper.firstY = 0;
    helper.currentX = 300;
    helper.currentY = 0;
    helper.splitSegments();

    // r=0.5, w1=1, w2=3 → t=0.25
    assertEquals(cmds.some((c) => c === "split s1 0.25"), true);
  });

  await t.step("splitSegments in 3d ignores a segment occluded behind the dragged face", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    const s1 = model.segments[1]; // right edge, xCanvas=200, y from -200..200
    // deno-lint-ignore no-explicit-any
    (f0.points as any[]).forEach((p) => { p.zEye = -10; }); // close to the camera

    // A second face, far behind, whose own edge happens to project onto the
    // same screen line as s1 — a real thing once paper is actually folded.
    // deno-lint-ignore no-explicit-any
    const back1: any = new Point(0, 0, 200, -200, 500);
    // deno-lint-ignore no-explicit-any
    const back2: any = new Point(0, 0, 200, 200, 500);
    // deno-lint-ignore no-explicit-any
    const back3: any = new Point(0, 0, 260, 0, 500);
    back1.xCanvas = 200; back1.yCanvas = -200; back1.zEye = 500;
    back2.xCanvas = 200; back2.yCanvas = 200; back2.zEye = 500;
    back3.xCanvas = 260; back3.yCanvas = 0; back3.zEye = 500;
    model.points.push(back1, back2, back3);
    const backSegment = new Segment(back1, back2);
    model.segments.push(backSegment);
    model.faces.push(new Face([back1, back2, back3]));

    helper.view3d = {
      // deno-lint-ignore no-explicit-any
      faceDepth: (face: any) => {
        let z = 0;
        for (const p of face.points) z += p.zEye ?? 0;
        return z / face.points.length;
      },
    };
    helper.currentCanvas = '3d';
    helper.downFace = f0;

    // Drag straight across both overlapping screen-space lines
    helper.firstX = 100;
    helper.firstY = 0;
    helper.currentX = 300;
    helper.currentY = 0;
    helper.splitSegments();

    const s1Index = model.segments.indexOf(s1);
    const backIndex = model.segments.indexOf(backSegment);
    assertEquals(cmds.some((c) => c.startsWith(`split s${s1Index} `)), true);
    assertEquals(cmds.some((c) => c.startsWith(`split s${backIndex} `)), false);
  });

  await t.step("drag across a segment scores it, no prior selection needed", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];

    helper.down([], [], [f0], -100, 0);
    helper.currentX = 250;
    helper.currentY = 0;
    // Dragging from inside the face straight out past its own border ("to
    // nothing") previews as filled, not hollow: it will score, not fold.
    assertEquals(helper.willFold(), false);
    helper.up([], [], []);
    assertEquals(cmds.some((c) => c.startsWith("split ")), true);
    assertEquals(f0.select, false);
  });

  await t.step("drag on an unselected face arms it instead of folding (select-first step)", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    assertEquals(f0.select, false);

    // Drag toward the top edge s0, staying inside the face (no crossing).
    // Folding is gated on selection, so this can't be a fold yet.
    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    assertEquals(helper.label, undefined);
    // Previews as filled: nothing will fold until the face is selected
    assertEquals(helper.willFold(), false);

    helper.up([], [], [f0]);
    assertEquals(cmds.some((c) => c.startsWith("t 1000 r")), false);
    assertEquals(f0.select, true);
    assertEquals(cmds[cmds.length - 1], "// selectFaces f0(0)");
  });

  await t.step("a second drag on the now-selected face folds it", () => {
    const { model, command, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true; // as left by the arming drag above

    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    const label = helper.label as number;
    assertEquals(label !== 0, true);
    assertEquals(helper.willFold(), true);

    const cmds = captureCmds(command);
    helper.up([], [], [f0]);
    assertEquals(cmds[0].startsWith(`t 1000 r s0 ${label}`), true);
    assertEquals(f0.select, false);
  });

  await t.step("fold mode move highlights only the hover axis segment", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    model.segments.forEach(s => { s.hover = true; }); // noise

    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    const hovered = model.segments.filter(s => s.hover);
    assertEquals(hovered.length, 1);
    assertEquals(hovered[0], model.segments[0]);
  });

  await t.step("fold F→F with axis rotates then clears all", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    const s0 = model.segments[0];
    f0.select = true;
    s0.select = true;
    model.points[2].select = true;

    // Drag far enough for a non-zero angle (centroid at ~0,0; move toward s0)
    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    const label = helper.label;
    assertEquals(typeof label, "number");
    assertEquals(label !== 0 && label !== undefined, true);

    cmds.length = 0;
    helper.up([], [], [f0]);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].startsWith(`t 1000 r s0 ${label}`), true);
    assertEquals(cmds[0].includes("// f0"), true);
    assertEquals(f0.select, false);
    assertEquals(s0.select, false);
    assertEquals(model.points[2].select, false);
  });

  await t.step("fold F→F without axis: angle uses hover border segment", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    f0.select = true;

    helper.down([], [], [f0], 0, 0);
    // Move near top edge s0 (y=-200) to hover it, with enough angle
    helper.move([], [], [f0], 0, -150);
    assertEquals(model.segments[0].hover, true);
    const label = helper.label as number;
    assertEquals(label !== 0, true);

    cmds.length = 0;
    helper.up([], [], [f0]);
    assertEquals(cmds[0].startsWith(`t 1000 r s0 ${label}`), true);
    assertEquals(f0.select, false);
  });

  await t.step("on an already-selected face, a crossing drag folds instead of scoring", () => {
    const { model, command, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;

    // Nothing is pinned and nothing borders the cursor, but the face is
    // already armed: whatever this crosses is ignored, and it folds around
    // the nearest border edge (s1, the right edge, closest to x=250).
    helper.down([], [], [f0], -100, 0);
    helper.move([], [], [f0], 250, 0);
    const label = helper.label as number;
    assertEquals(label !== 0, true);
    assertEquals(helper.willFold(), true);

    const cmds = captureCmds(command);
    helper.up([], [], []);
    assertEquals(cmds.some((c) => c.startsWith("split ")), false);
    assertEquals(cmds[0].startsWith(`t 1000 r s1 ${label}`), true);
  });

  await t.step("dragging onto a bordering segment folds along that segment specifically", () => {
    const { model, command, helper } = setup();
    const f0 = model.faces[0];
    const s1 = model.segments[1]; // right edge, xCanvas=200, y from -200..200
    f0.select = true;

    // Aiming at a specific bordering edge (as a real drag landing near it
    // would set upSegment/currentSegment) picks that edge over the generic
    // nearest-border fallback.
    helper.down([], [], [f0], -100, 0);
    helper.currentX = 250;
    helper.currentY = 0;
    helper.currentSegment = s1;
    assertEquals(helper.willFold(), true);

    const cmds = captureCmds(command);
    helper.up([], [s1], []);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].startsWith(`t 1000 r s1`), true);
  });

  await t.step("fold F→F up on point does nothing, and previews as filled (not fold)", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    const s0 = model.segments[0];
    const p2 = model.points[2];
    f0.select = true;
    s0.select = true;

    helper.down([], [], [f0], 0, 0);
    helper.currentX = 40;
    helper.currentY = 40;
    helper.upPoint = p2; // as move()/up() would set it while hovering p2
    assertEquals(helper.willFold(), false);
    helper.up([p2], [], []);
    assertEquals(cmds.length, 0);
  });

  await t.step("segment selected in mark remains when entering fold", () => {
    const { model, helper } = setup();
    model.segments[0].select = true;
    helper.down([], [], [model.faces[0]], 0, 0);
    helper.up([], [], [model.faces[0]]);
    assertEquals(model.faces[0].select, true);
    assertEquals(model.segments[0].select, true);
  });

  await t.step("clickThreshold is larger for touch", () => {
    const { helper } = setup();
    helper.pointerType = "mouse";
    assertEquals(helper.clickThreshold(), 12);
    helper.pointerType = "touch";
    assertEquals(helper.clickThreshold(), 24);
  });

  await t.step("search3d() points, segments, faces near x,y", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const mockView3d = new MockView3d(model);
    const helper = new Helper(model, command, mockView3d);

    const result = helper.search3d(200, 200);
    assertEquals(result.points.length, 1);
    assertEquals(result.segments.length, 2);
    assertEquals(result.faces.length, 1);
  });

  await t.step("pickFaces3d(contextFace) narrows to faces adjacent to it, via Model.sharedSegments", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    // deno-lint-ignore no-explicit-any
    const pt = (x: number, y: number): any => {
      const p = new Point(0, 0, 0, 0, 0);
      Object.assign(p, { xCanvas: x, yCanvas: y });
      return p;
    };

    // Two rectangles sharing edge a-b, both overlapping screen point (0,0) —
    // as happens once paper is actually folded into overlapping layers.
    const a = pt(-10, -10), b = pt(10, -10), c = pt(10, 10), h = pt(-10, 10);
    model.points.push(a, b, c, h);
    const faceA = new Face([a, b, c, h]); // y: -10..10
    const i = pt(10, 5), j = pt(-10, 5);
    model.points.push(i, j);
    const faceB = new Face([a, b, i, j]); // shares edge a-b; y: -10..5
    model.segments.push(new Segment(a, b));
    model.faces.push(faceA, faceB);

    // An unrelated rectangle, same footprint but distinct points/no shared segment
    const e = pt(-10, -10), f = pt(10, -10), g = pt(10, 10), k = pt(-10, 10);
    model.points.push(e, f, g, k);
    const unrelated = new Face([e, f, g, k]);
    model.faces.push(unrelated);

    const indexMap = new Map();
    model.points.forEach((p, i2) => indexMap.set(p, i2));
    const view3d = { indexMap, faceDepth: () => 0 };
    const helper = new Helper(model, command, view3d);

    // deno-lint-ignore no-explicit-any
    const picked = helper.pickFaces3d(0, 0, faceA as any);
    assertEquals(picked.includes(faceB), true);
    assertEquals(picked.includes(faceA), false);
    assertEquals(picked.includes(unrelated), false);
  });

  // deno-lint-ignore no-explicit-any
  function mockOverlayCanvas(onStroke: (ctx: any) => void) {
    return {
      getContext: () => ({
        lineWidth: 0,
        lineCap: "",
        lineJoin: "",
        strokeStyle: "",
        fillStyle: "",
        font: "",
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        stroke() { onStroke(this); },
        fill() {},
        arc() {},
        fillText() {},
      }),
    };
  }

  await t.step("draw() uses a green filled arrow when creasing (downPoint)", () => {
    const { model, command } = setup();
    let strokeStyle = "";
    const overlay = mockOverlayCanvas((ctx) => { strokeStyle = ctx.strokeStyle; });
    const helper = new Helper(model, command, null);
    helper.view3d = { overlay };
    helper.downPoint = model.points[0];
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 10;
    helper.currentY = 10;
    helper.draw();
    assertEquals(strokeStyle, "green");
  });

  await t.step("draw() uses an amber hollow arrow when folding (downFace)", () => {
    const { model, command } = setup();
    let strokeStyle = "";
    let fillStyle = "";
    const overlay = mockOverlayCanvas((ctx) => { strokeStyle = ctx.strokeStyle; fillStyle = ctx.fillStyle; });
    const helper = new Helper(model, command, null);
    helper.view3d = { overlay };
    helper.downFace = model.faces[0];
    helper.downFace.select = true; // folding requires the face to already be selected
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 10;
    helper.currentY = 10;
    helper.draw();
    assertEquals(strokeStyle, Helper.FOLD_AMBER);
    assertEquals(fillStyle, "#fff");
  });

  await t.step("down on selected point in 3d sets moving; 2d does not", () => {
    const { model, helper } = setup();
    const p0 = model.points[0];
    helper.currentCanvas = "3d";
    helper.down([p0], [], [], 10, 20);
    assertEquals(helper.moving, false);

    p0.select = true;
    helper.down([p0], [], [], 10, 20);
    assertEquals(helper.moving, true);

    helper.currentCanvas = "2d";
    helper.down([p0], [], [], 10, 20);
    assertEquals(helper.moving, false);
  });

  await t.step("moving selected point sends animated m then adjust other selected", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const [p0, p1] = model.points;
    p0.select = true;
    p1.select = true;

    helper.currentCanvas = "3d";
    helper.moving = true;
    helper.downPoint = p0;
    helper.downPoints = [p0];
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 40;
    helper.currentY = -20;
    helper.fromPoint();
    assertEquals(cmds[0], "t 1000 m 40 20 0 p0 adjust p1");

    // Only the hovered point is listed in m; move wins over crease toward another point
    cmds.length = 0;
    p0.select = true;
    p1.select = true;
    helper.moving = true;
    helper.downPoint = p0;
    helper.upPoint = p1;
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 40;
    helper.currentY = 0;
    helper.fromPoint();
    assertEquals(cmds[0], "t 1000 m 40 0 0 p0 adjust p1");
  });

  await t.step("moving with only the hovered point selected has no adjust", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];
    p0.select = true;
    helper.moving = true;
    helper.downPoint = p0;
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 40;
    helper.currentY = 0;
    helper.fromPoint();
    assertEquals(cmds[0], "t 1000 m 40 0 0 p0");
  });

  await t.step("moving click without drag falls through to a normal single-click toggle", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];
    p0.select = true;
    helper.currentCanvas = "3d";

    helper.down([p0], [], [], 0, 0);
    assertEquals(helper.moving, true);
    helper.up([p0], [], []);
    assertEquals(p0.select, false);
    assertEquals(cmds.length, 0);
  });

  await t.step("double-click on an already-selected point in 3d sends adjust", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];
    helper.currentCanvas = "3d";

    // First click selects the point (moving is false: not selected yet).
    helper.down([p0], [], [], 0, 0);
    assertEquals(helper.moving, false);
    helper.up([p0], [], []);
    assertEquals(p0.select, true);

    // Second click within the double-click window: down() now sets moving
    // true (point already selected), but a plain click must still reach the
    // double-click/adjust logic instead of being swallowed by moveSelectedPoint().
    cmds.length = 0;
    helper.down([p0], [], [], 0, 0);
    assertEquals(helper.moving, true);
    helper.up([p0], [], []);
    assertEquals(cmds[0], "adjust p0");
  });

  await t.step("canvasDragToWorld3d unprojects at constant depth", async () => {
    const { model, command } = setup();
    const mat4 = await import("../js/lib/mat4.js");
    const helper = new Helper(model, command, { canvasView: mat4.create() });
    const p = model.points[0];
    p.x = 10;
    p.y = 20;
    p.z = 30;
    const delta = helper.canvasDragToWorld3d(10, 20, 15, 25, p);
    assertEquals(Math.round(delta.dx), 5);
    assertEquals(Math.round(delta.dy), 5);
    assertEquals(Math.round(delta.dz), 0);
  });

  await t.step("draw() uses orange while moving a selected point", () => {
    const { model, command } = setup();
    let strokeStyle = "";
    const overlay = mockOverlayCanvas((ctx) => { strokeStyle = ctx.strokeStyle; });
    const helper = new Helper(model, command, null);
    helper.view3d = { overlay };
    helper.currentCanvas = "3d";
    helper.downPoint = model.points[0];
    helper.moving = true;
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 10;
    helper.currentY = 10;
    helper.draw();
    assertEquals(strokeStyle, "orange");
  });
});
