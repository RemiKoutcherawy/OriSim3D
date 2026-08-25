import { Model } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Helper } from "../js/Helper.js";
import { Point } from "../js/Point.js";
import { Segment } from "../js/Segment.js";

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

  await t.step("mode is mark until a face is selected", () => {
    const { model, helper } = setup();
    assertEquals(helper.mode, "mark");
    model.points[0].select = true;
    model.segments[0].select = true;
    assertEquals(helper.mode, "mark");
    model.faces[0].select = true;
    assertEquals(helper.mode, "fold");
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
    assertEquals(cmds[0], "across3d p0 p1");

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

  await t.step("mark P→S sends p3d; S→P sends commented splitParallel", () => {
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
    assertEquals(cmds[0], "// splitParallel s0 p0");
  });

  await t.step("mark S→S toggle and bisector", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const [s0, s1] = model.segments;

    helper.down([], [s0], [], 0, 0);
    helper.up([], [s0], []);
    assertEquals(s0.select, true);
    assertEquals(cmds[0], "// selectSegments s0");

    cmds.length = 0;
    helper.down([], [s0], [], 0, 0);
    helper.currentX = 40;
    helper.currentY = 40;
    helper.up([], [s1], []);
    assertEquals(cmds[0], "bisector3d s0 s1");
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
    assertEquals(cmds[0], `// selectSegments ${helper.id(s0)} ${helper.id(sExtra)}`);
  });

  await t.step("mark face click cycles pile; end clears only that pile", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    // Two overlapping faces in one pile (depth order)
    model.splitBy2d(model.points[0], model.points[2]);
    const f0 = model.faces[0];
    const f1 = model.faces[1];
    const pile = [f0, f1];

    helper.down([], [], [f0, f1], 0, 0);
    helper.up([], [], [f0, f1]);
    assertEquals(f0.select, true);
    assertEquals(f1.select, false);
    assertEquals(helper.mode, "fold");
    assertEquals(cmds[0], "// selectFaces f0");

    // Back to mark would require clearing faces — still fold. Cycle next:
    cmds.length = 0;
    helper.down([], [], [f0, f1], 0, 0);
    helper.up([], [], [f0, f1]);
    assertEquals(f0.select, false);
    assertEquals(f1.select, true);
    assertEquals(cmds[0], "// selectFaces f1");

    cmds.length = 0;
    helper.down([], [], [f0, f1], 0, 0);
    helper.up([], [], [f0, f1]);
    assertEquals(f0.select, false);
    assertEquals(f1.select, false);
    assertEquals(helper.mode, "mark");
    assertEquals(cmds.length, 0);

    // Points/segments untouched by pile clear
    model.points[0].select = true;
    model.segments[0].select = true;
    helper.cycleFacePile(pile);
    assertEquals(f0.select, true);
    helper.cycleFacePile(pile);
    helper.cycleFacePile(pile);
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
    assertEquals(cmds[0], "// selectFaces f1");
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
    assertEquals(helper.mode, "mark");
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

  await t.step("mark face drag across a segment splits it", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];

    helper.down([], [], [f0], -100, 0);
    helper.currentX = 250;
    helper.currentY = 0;
    helper.up([], [], []);
    assertEquals(cmds.some((c) => c.startsWith("split ")), true);
    assertEquals(helper.mode, "mark");
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
    assertEquals(hovered[0], helper.hoverAxis);
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
    assertEquals(helper.mode, "mark");
  });

  await t.step("fold F→F without axis: angle uses hover border segment", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    f0.select = true;

    helper.down([], [], [f0], 0, 0);
    // Move near top edge s0 (y=-200) to hover it, with enough angle
    helper.move([], [], [f0], 0, -150);
    assertEquals(helper.hoverAxis, model.segments[0]);
    const label = helper.label as number;
    assertEquals(label !== 0, true);

    cmds.length = 0;
    helper.up([], [], [f0]);
    assertEquals(cmds[0].startsWith(`t 1000 r s0 ${label}`), true);
    assertEquals(helper.mode, "mark");
  });

  await t.step("fold F→F without axis, no angle, up empty: split on intersection", () => {
    const { model, command, helper } = setup();
    const cmds = captureCmds(command);
    const f0 = model.faces[0];
    f0.select = true;

    helper.down([], [], [f0], -100, 0);
    helper.move([], [], [f0], 250, 0);
    // Angle path would win via hover axis; force the no-angle branch
    helper.rotationLabel = () => 0;

    cmds.length = 0;
    helper.up([], [], []);
    assertEquals(cmds.some((c) => c.startsWith("split ")), true);
  });

  await t.step("fold F→F up on point sends commented splitParallel", () => {
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
    helper.up([p2], [], []);
    assertEquals(cmds[0], "// splitParallel s0 p2");
  });

  await t.step("segment selected in mark remains when entering fold", () => {
    const { model, helper } = setup();
    model.segments[0].select = true;
    helper.down([], [], [model.faces[0]], 0, 0);
    helper.up([], [], [model.faces[0]]);
    assertEquals(model.faces[0].select, true);
    assertEquals(model.segments[0].select, true);
    assertEquals(helper.mode, "fold");
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

  await t.step("draw() uses green stroke", () => {
    const { model, command } = setup();
    let strokeStyle = "";
    const overlay = {
      getContext: () => ({
        lineWidth: 0,
        lineCap: "",
        strokeStyle: "",
        fillStyle: "",
        font: "",
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {
          strokeStyle = this.strokeStyle;
        },
        fill() {},
        arc() {},
        fillText() {},
      }),
    };
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
});
