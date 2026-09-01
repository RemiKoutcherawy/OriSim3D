// NOSONAR - SonarQube's S2187 test-detection doesn't recognize Deno's Deno.test()/t.step()
// API as test cases; this file contains 38 t.step() sub-tests (127 assertions) for Helper.js.
import { Model } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Helper } from "../js/Helper.js";
import { Point } from "../js/Point.js";
import { Segment } from "../js/Segment.js";
import { Face } from "../js/Face.js";

import { assertEquals } from "@std/assert";

type Pt = { xf: number; yf: number };

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
    helper.pointClickTime = 0;
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
    helper.pointClickTime = Date.now();
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

  await t.step("releasing on a point delivers the fold the preview promised", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    const s0 = model.segments[0];
    const p2 = model.points[2];
    f0.select = true;
    s0.select = true;

    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    const label = helper.label as number;
    assertEquals(label !== 0, true);
    assertEquals(helper.willFold(), true);

    // Finishing a fold on a landmark point is the natural aim. It used to emit
    // nothing at all while the amber arrow was still promising an angle.
    cmds.length = 0;
    helper.up([p2], [], []);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].startsWith(`t 1000 r s0 ${label}`), true);
  });

  await t.step("the preview and the released gesture always agree", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    const s0 = model.segments[0];
    const p0 = model.points[0];

    // Sweep a drag across the face and check, at every stop, that willFold()
    // matches whether releasing there actually emits a rotation. Releasing on a
    // point is the case that used to diverge; a drag shorter than the click
    // threshold is the other one.
    for (const y of [-190, -150, -60, -13, -11, 0, 11, 13, 60, 150, 190]) {
      f0.select = true;
      s0.select = true;
      helper.down([], [], [f0], 0, 0);
      helper.move([], [], [f0], 0, y);
      const promised = helper.willFold();
      cmds.length = 0;
      helper.up([p0], [], []);
      const folded = cmds.some((c) => c.startsWith("t 1000 r "));
      assertEquals(folded, promised, `drag to y=${y}`);
    }
  });

  await t.step("the fold angle is zero at the grab point, whatever it is", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    helper.currentCanvas = "2d";
    // Grabbing anywhere, including right next to the hinge at drawing y = 200
    for (const startY of [0, 100, 190, 199]) {
      helper.down([], [], [f0], 0, startY);
      helper.move([], [], [f0], 0, startY);
      assertEquals(helper.label, 0);
    }
  });

  await t.step("the fold angle measures the drag, not the cursor's position", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    helper.currentCanvas = "2d";
    // Same 100 px drag toward the hinge, from two different grab points:
    // the old distance-ratio law read 50 deg from one and 180 from the other.
    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, 100);
    const fromCentre = helper.label as number;
    helper.down([], [], [f0], 0, 50);
    helper.move([], [], [f0], 0, 150);
    const fromCloser = helper.label as number;
    assertEquals(fromCentre !== 0, true);
    // Same lever arm class, so the same drag stays in the same ballpark
    assertEquals(Math.abs(fromCloser) > Math.abs(fromCentre), true);
    // and neither jumps straight to a flat fold
    assertEquals(Math.abs(fromCentre) < 180, true);
    assertEquals(Math.abs(fromCloser) < 180, true);
  });

  await t.step("a short drag near the hinge no longer folds the paper flat", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    helper.currentCanvas = "2d";
    // 1 px from the hinge; the old law returned 180 deg for any drag at all
    helper.down([], [], [f0], 0, 199);
    helper.move([], [], [f0], 0, 199 + 13);
    assertEquals(Math.abs(helper.label as number) < 90, true);
    // A flat fold still needs a real drag: at least twice the minimum lever arm
    helper.move([], [], [f0], 0, 199 + 2 * 30);
    assertEquals(helper.label, 180);
  });

  await t.step("90 and 180 degrees are reachable in both directions", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    helper.currentCanvas = "2d";
    // Pin the hinge so the nearest-border fallback cannot switch axis mid-drag
    const s0 = model.segments[0]; // drawing y = 200
    s0.select = true;
    const lever = 200; // grabbed at the centre of the sheet

    helper.down([], [], [f0], 0, 0);
    // 90 deg lands the grab point on the crease
    helper.move([], [], [f0], 0, lever);
    assertEquals(helper.label, 90);
    // 180 deg lands it at the mirror position
    helper.move([], [], [f0], 0, 2 * lever);
    assertEquals(helper.label, 180);
    // and it saturates there rather than wrapping back towards zero
    helper.move([], [], [f0], 0, 3 * lever);
    assertEquals(helper.label, 180);
    // Dragging away from the crease folds the other way, over the same travel
    helper.move([], [], [f0], 0, -lever);
    assertEquals(helper.label, -90);
    helper.move([], [], [f0], 0, -2 * lever);
    assertEquals(helper.label, -180);
  });

  await t.step("the hinge follows the border edge the drag is aiming at", () => {
    const { model, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    helper.currentCanvas = "2d";
    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, 150); // towards s0, at drawing y = 200
    assertEquals(model.segments[0].hover, true);
    helper.move([], [], [f0], 0, -150); // towards s2, at drawing y = -200
    assertEquals(model.segments[2].hover, true);
  });

  await t.step("snapAngle rounds to the degree and settles on origami angles", () => {
    assertEquals(Helper.snapAngle(0), 0);
    assertEquals(Helper.snapAngle(3), 0); // dead zone
    assertEquals(Helper.snapAngle(-3), 0);
    assertEquals(Helper.snapAngle(88), 90); // snapped
    assertEquals(Helper.snapAngle(-177), -180);
    assertEquals(Helper.snapAngle(43.4), 45);
    assertEquals(Helper.snapAngle(60.2), 60); // too far from 45 or 90 to snap
    assertEquals(Helper.snapAngle(-112), -112);
  });

  await t.step("the fold arrow follows the paper's real trajectory", async () => {
    const mat4 = await import("../js/lib/mat4.js");
    const { model, command } = setup();
    const view3d = {
      canvasView: mat4.create(),
      modelView: mat4.create(),
      indexMap: new Map(model.points.map((p, i) => [p, i])),
      faceDepth: () => 0,
      updateCanvasCoords() {},
    };
    const helper = new Helper(model, command, view3d);
    helper.currentCanvas = "3d";
    const f0 = model.faces[0];
    f0.select = true;
    const axis = model.segments[0];

    // The arrow starts at the flap vertex that travels furthest, as diagrams do
    const tip = helper.foldTip(axis, helper.foldFlap(axis));
    const distance = (p: { x: number; y: number; z: number }) =>
      Math.hypot(p.x - axis.p1.x, p.y - axis.p1.y, p.z - axis.p1.z);
    model.points.forEach((p) => assertEquals(distance(tip) >= distance(p), true));

    // ...and it ends exactly where that vertex lands, not somewhere decorative
    for (const angle of [90, 180, -90]) {
      const path = helper.foldArc(axis, angle, tip);
      const landing = { x: tip.x, y: tip.y, z: tip.z };
      model.rotate(axis, angle, [landing]);
      const end = path[path.length - 1];
      assertEquals(Math.round(end.x), Math.round(landing.x));
      assertEquals(Math.round(end.y), Math.round(landing.y));
    }
  });

  await t.step("the 2d arrow bows the way a hand-drawn diagram does", () => {
    const { model, command } = setup();
    const helper = new Helper(model, command, null);
    helper.currentCanvas = "2d";
    const f0 = model.faces[0];
    f0.select = true;
    const axis = model.segments[0];
    const tip = helper.foldTip(axis, helper.foldFlap(axis));
    const path = helper.foldArc(axis, 180, tip);

    // At 180 degrees the tip lands mirrored across the crease
    const t0 = helper.canvasPoint(tip);
    const end = path[path.length - 1];
    assertEquals(Math.round(end.x), Math.round(t0.xf));
    assertEquals(Math.round(end.y), Math.round(t0.yf + 2 * (200 - t0.yf)));

    // and the path between is a bulge, not a straight line
    const chord = Math.hypot(end.x - path[0].x, end.y - path[0].y);
    const sag = Math.max(...path.map((p) => Math.abs(p.x - path[0].x)));
    assertEquals(sag > chord * 0.1, true);
  });

  await t.step("bowArc makes a flat projection readable, and leaves a curve alone", () => {
    const straight = Array.from({ length: 25 }, (_, i) => ({ x: 100, y: -200 + i * 20 }));
    const bowed = Helper.bowArc(straight, 1);
    const chord = 480;
    const sag = Math.max(...bowed.map((p: { x: number }) => Math.abs(p.x - 100)));
    assertEquals(sag > chord * 0.1, true);
    // The correction vanishes at both ends: the arrow still starts and lands
    // exactly where the paper does
    assertEquals(Math.abs(bowed[0].x - 100) < 1e-9, true);
    assertEquals(Math.abs(bowed[24].x - 100) < 1e-9, true);
    assertEquals(bowed[0].y, straight[0].y);
    assertEquals(bowed[24].y, straight[24].y);

    // A projection that already curves enough is returned untouched
    const curved = Array.from({ length: 25 }, (_, i) => {
      const u = i / 24;
      return { x: 100 + Math.sin(Math.PI * u) * 300, y: -200 + u * 480 };
    });
    assertEquals(Helper.bowArc(curved, 1), curved);
  });

  await t.step("the drag folds the paper live, and leaves no trace of it", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    f0.select = true;
    const snapshot = () => model.points.map((p) => `${p.x},${p.y},${p.z}`).join("|");
    const before = snapshot();
    const undoBefore = command.done.length;

    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    assertEquals(snapshot() !== before, true); // the paper really turned
    assertEquals(helper.consumePreviewDirty(), true);
    assertEquals(helper.consumePreviewDirty(), false); // consumed once

    // Dragging back updates the preview rather than compounding it
    helper.move([], [], [f0], 0, 0);
    assertEquals(snapshot(), before);

    helper.move([], [], [f0], 0, -150);
    cmds.length = 0;
    helper.up([], [], [f0]);
    // Released: the model is back to its starting state and the animated command
    // is the only recorded step, so undo still works one fold at a time
    assertEquals(snapshot(), before);
    assertEquals(command.done.length, undoBefore);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].startsWith("t 1000 r s0 "), true);
  });

  await t.step("an abandoned drag puts the paper back", () => {
    const { model, command, helper } = setup();
    const f0 = model.faces[0];
    f0.select = true;
    const snapshot = () => model.points.map((p) => `${p.x},${p.y},${p.z}`).join("|");
    const before = snapshot();
    helper.down([], [], [f0], 0, 0);
    helper.move([], [], [f0], 0, -150);
    assertEquals(snapshot() !== before, true);
    helper.out(); // pointercancel
    assertEquals(snapshot(), before);
  });

  await t.step("a fold carries the whole flap, not just the grabbed face", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const P = (xf: number, yf: number) => new Point(xf, yf) as never;
    // Hinge at x = 0; the left half is creased again at y = 0, so the flap
    // left of the hinge is two faces sharing an edge that is not the hinge.
    model.splitAllFacesBySegment2d(P(0, -200), P(0, 200));
    model.splitAllFacesBySegment2d(P(-200, 0), P(0, 0));
    const flap = model.faces.filter((f) => f.points.some((p: Pt) => p.xf < -1));
    assertEquals(flap.length, 2);
    const axis = model.segments.find(
      (s) => Math.abs(s.p1.xf) < 1e-9 && Math.abs(s.p2.xf) < 1e-9,
    )!;

    // The user grabbed ONE face of the flap, as the UI invites them to
    helper.downFace = flap[0];
    helper.rotatePoints(axis, 180);

    const rotated: string[] = cmds[0].match(/p\d+/g) ?? [];
    const shouldMove = model.points.filter((p) => p.xf < -1).map((p) => helper.id(p));
    assertEquals(shouldMove.length, 3);
    // Every point of the flap moves: leaving one behind tore the sheet
    shouldMove.forEach((id) => assertEquals(rotated.includes(id), true));
    // ...and nothing on the far side of the hinge comes along
    model.points.filter((p) => p.xf > 1).forEach((p) =>
      assertEquals(rotated.includes(helper.id(p)), false)
    );
    // Points sitting on the hinge itself stay put
    model.points.filter((p) => Math.abs(p.xf) < 1e-9).forEach((p) =>
      assertEquals(rotated.includes(helper.id(p)), false)
    );
    // Both faces of the flap are reported in the trailing comment
    flap.forEach((f) => assertEquals(cmds[0].includes(helper.id(f)), true));
  });

  await t.step("the flap stops at every segment lying on the hinge line", () => {
    const { model, helper } = setup();
    const P = (xf: number, yf: number) => new Point(xf, yf) as never;
    // Hinge at x = 0, then a crease at y = 0 that also splits the hinge in two,
    // so the crease line is made of two collinear segments.
    model.splitAllFacesBySegment2d(P(0, -200), P(0, 200));
    model.splitAllFacesBySegment2d(P(-200, 0), P(200, 0));
    const onHinge = model.segments.filter(
      (s) => Math.abs(s.p1.xf) < 1e-9 && Math.abs(s.p2.xf) < 1e-9,
    );
    assertEquals(onHinge.length, 2);

    const grabbed = model.faces.find((f) => f.points.every((p: Pt) => p.xf <= 1e-9))!;
    helper.downFace = grabbed;
    const flap = helper.foldFlap(onHinge[0]);
    // Only the two left faces travel; the fold must not leak through the other
    // collinear piece of the same crease.
    assertEquals(flap.size, 2);
    [...flap].forEach((f) =>
      assertEquals(f.points.every((p: Pt) => p.xf <= 1e-9), true)
    );
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

  await t.step("pointerType follows the device instead of staying at its default", () => {
    const { helper } = setup();
    assertEquals(helper.clickThreshold(), 12);
    // down2d/down3d call trackPointerType with the real pointer event
    helper.trackPointerType({ pointerType: "touch" });
    assertEquals(helper.pointerType, "touch");
    assertEquals(helper.clickThreshold(), 24);
    helper.trackPointerType({ pointerType: "pen" });
    assertEquals(helper.clickThreshold(), 12);
    // An event without pointerType must not clobber what we know
    helper.trackPointerType({});
    assertEquals(helper.pointerType, "pen");
  });

  await t.step("a point click no longer arms the background double-click", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const view3d = {
      angleX: 30, angleY: 40, angleZ: 5,
      translationX: 100, translationY: -50, scale: 2,
      initModelView() {}, initPerspective() {},
    };
    helper.view3d = view3d;
    helper.currentCanvas = "3d";

    // Select a point: this stamps the point double-click timer...
    helper.down([model.points[0]], [], [], 0, 0);
    helper.up([model.points[0]], [], []);
    assertEquals(model.points[0].select, true);

    // ...which must not make a single background click reset the view.
    cmds.length = 0;
    helper.doubleClick();
    assertEquals(view3d.angleX, 30);
    assertEquals(view3d.scale, 2);
    assertEquals(cmds.length, 0);

    // A real double-click on the background still resets it.
    helper.doubleClick();
    assertEquals(view3d.angleX, 0);
    assertEquals(view3d.translationX, 0);
    assertEquals(view3d.scale, 1);
    assertEquals(cmds[0], "fit");
  });

  await t.step("point picking is a disc, not a diamond", () => {
    const { model, helper } = setup();
    helper.view2d = { scale: 1 };
    const [x, y] = [model.points[2].xf, model.points[2].yf]; // (200, 200)
    // 9 px straight out and 9.9 px diagonally are both inside a 10 px radius
    assertEquals(helper.search2d(x + 9, y).points.length, 1);
    assertEquals(helper.search2d(x + 7, y + 7).points.length, 1);
    // 11 px out is outside it, in either direction
    assertEquals(helper.search2d(x + 11, y).points.length, 0);
    assertEquals(helper.search2d(x + 8, y + 8).points.length, 0);
  });

  await t.step("orbiting is latched at pointerdown, not re-decided each move", () => {
    const { model, command } = setup();
    const view3d = {
      angleX: 0, angleY: 0, angleZ: 0,
      translationX: 0, translationY: 0, scale: 1,
      overlay: null,
      indexMap: new Map(model.points.map((p, i) => [p, i])),
      faceDepth: () => 0,
      initModelView() {}, initPerspective() {},
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
    const helper = new Helper(model, command, view3d);
    // Press on empty space, far outside the sheet
    helper.down3d({ xCanvas: 900, yCanvas: 900, pointerType: "mouse" });
    assertEquals(helper.orbiting, true);

    // Drag across the paper: the orbit must keep going
    helper.move3d({ xCanvas: 0, yCanvas: 0, buttons: 1, target: { height: 600 } });
    const turned = view3d.angleY;
    assertEquals(turned !== 0, true);
    helper.move3d({ xCanvas: 40, yCanvas: 0, buttons: 1, target: { height: 600 } });
    assertEquals(view3d.angleY !== turned, true);

    // Pressing on the paper does not start an orbit
    helper.out();
    helper.down3d({ xCanvas: 0, yCanvas: 0, pointerType: "mouse" });
    assertEquals(helper.orbiting, false);

    // ...unless Shift or the middle button is used, the only way to turn the
    // view once the model fills it
    helper.out();
    helper.down3d({ xCanvas: 0, yCanvas: 0, pointerType: "mouse", shiftKey: true });
    assertEquals(helper.orbiting, true);
    assertEquals(helper.downFace, undefined);
    helper.out();
    helper.down3d({ xCanvas: 0, yCanvas: 0, pointerType: "mouse", button: 1 });
    assertEquals(helper.orbiting, true);
    assertEquals(helper.downFace, undefined);
    const before = view3d.angleY;
    helper.move3d({ xCanvas: 60, yCanvas: 0, buttons: 4, target: { height: 600 } });
    assertEquals(view3d.angleY !== before, true);
  });

  await t.step("a gesture that ends where it started emits nothing", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const p0 = model.points[0];
    const s0 = model.segments[0];

    // Dragging along one crease used to emit `b3d s0 s0`, the bisector of a
    // segment with itself: harmless to the geometry, but it filled the recorded
    // script and the undo stack with lines that do nothing.
    helper.down([], [s0], [], -150, -200);
    helper.currentX = 150;
    helper.currentY = -200;
    helper.up([], [s0], []);
    assertEquals(cmds.length, 0);

    // Same for a drag from a point back onto itself
    helper.down([p0], [], [], -200, -200);
    helper.currentX = -100;
    helper.currentY = -100;
    helper.up([p0], [], []);
    assertEquals(cmds.length, 0);

    // A genuine crease between two distinct points still goes through
    helper.down([p0], [], [], -200, -200);
    helper.currentX = 200;
    helper.currentY = 200;
    helper.up([model.points[2]], [], []);
    assertEquals(cmds.length, 1);
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
