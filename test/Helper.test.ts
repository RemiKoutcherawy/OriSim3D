import { Model } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Helper } from "../js/Helper.js";

import { assertEquals } from "@std/assert";

// Mock View3d class to test Helper.search3d
class MockView3d {
  indexMap = new Map();
  scale = 10;
  constructor(model: Model) {
    model.points.forEach((point, index) => {
      this.indexMap.set(point, index);
    });
    model.points[0].xCanvas = -200; model.points[0].yCanvas = -200;
    model.points[1].xCanvas = 200; model.points[1].yCanvas = -200;
    model.points[2].xCanvas = 200; model.points[2].yCanvas = 200;
    model.points[3].xCanvas = -200; model.points[0].yCanvas = 200;
  }
}

Deno.test("Helper Tests", async (t) => {
  await t.step("id() returns correct identifier strings", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);

    assertEquals(helper.id(model.points[0]), "p0");
    assertEquals(helper.id(model.segments[0]), "s0");
    assertEquals(helper.id(model.faces[0]), "f0");
    assertEquals(helper.id(null), "");
  });

  await t.step("down() sets initial selection", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);

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

    helper.down([], [], [], 0, 0);
    assertEquals(helper.downPoint, undefined);
    assertEquals(helper.downSegment, undefined);
    assertEquals(helper.downFace, undefined);
  });

  await t.step("fromPoint interactions", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);

    const cmds: string[] = [];
    const original = command.command.bind(command);
    command.command = (cde) => {
      cmds.push(cde);
      return original(cde);
    };

    helper.currentCanvas = '2d';

    // Same point -> toggle select
    const p0 = model.points[0];
    p0.select = false;
    helper.downPoint = p0;
    helper.upPoint = p0;
    helper.fromPoint();
    assertEquals(p0.select, true);

    // Point to Point on same segment -> across2d
    const p1 = model.points[1]; // segment between p0 and p1 exists
    cmds.length = 0;
    helper.downPoint = p0;
    helper.upPoint = p1;
    helper.fromPoint();
    assertEquals(cmds[0], "across2d p0 p1");

    // Point to Point not on same segment -> by2d
    const p2 = model.points[2]; // diagonal, no segment between p0 and p2
    cmds.length = 0;
    helper.downPoint = p0;
    helper.upPoint = p2;
    helper.fromPoint();
    assertEquals(cmds[0], "by2d p0 p2");

    // Point to segment without label -> perpendicular (p2d)
    const s0 = model.segments[0];
    cmds.length = 0;
    helper.label = undefined;
    helper.downPoint = p0;
    helper.upPoint = undefined;
    helper.upSegment = s0;
    helper.fromPoint();
    assertEquals(cmds[0], "p2d s0 p0");

    // Point with rotation label -> rotatePoints
    p0.select = false;
    s0.select = true;
    p2.select = true;
    helper.label = 90;
    helper.upPoint = undefined;
    helper.upSegment = undefined;
    cmds.length = 0;
    helper.downPoint = p0;
    helper.fromPoint();
    assertEquals(cmds[0], "t 1000 r s0 90 p2");

    command.command = original;
  });

  await t.step("fromSegment interactions", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);

    const cmds: string[] = [];
    const original = command.command.bind(command);
    command.command = (cde) => {
      cmds.push(cde);
      return original(cde);
    };

    helper.currentCanvas = '2d';
    const s0 = model.segments[0];
    const s1 = model.segments[1];
    const p0 = model.points[0];

    // Same segment -> toggle select
    s0.select = false;
    helper.downSegment = s0;
    helper.upSegment = s0;
    helper.fromSegment();
    assertEquals(s0.select, true);

    // Segment to another segment -> bisector2d
    cmds.length = 0;
    helper.downSegment = s0;
    helper.upSegment = s1;
    helper.fromSegment();
    assertEquals(cmds[0], "bisector2d s0 s1");

    // Segment to point -> perpendicular (p2d)
    cmds.length = 0;
    helper.downSegment = s0;
    helper.upSegment = undefined;
    helper.upPoint = p0;
    helper.fromSegment();
    assertEquals(cmds[0], "p2d s0 p0");

    command.command = original;
  });

  await t.step("fromFace interactions", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);

    const cmds: string[] = [];
    const original = command.command.bind(command);
    command.command = (cde) => {
      cmds.push(cde);
      return original(cde);
    };

    const f0 = model.faces[0];

    // Same face -> toggle select
    f0.select = false;
    helper.downFace = f0;
    helper.upFace = f0;
    helper.fromFace();
    assertEquals(f0.select, true);

    // Split face so we have 2 faces for face-to-face test
    model.splitBy2d(model.points[0], model.points[2]);
    const f1 = model.faces[1];
    f1.select = true;

    cmds.length = 0;
    helper.currentCanvas = '2d';
    helper.firstX = 0;
    helper.firstY = 0;
    helper.currentX = 50;
    helper.currentY = 50;
    helper.downFace = model.faces[0];
    helper.upFace = f1;
    helper.fromFace();
    assertEquals(cmds[0].startsWith('// Déjà à plat'), true);

    // After folding one flap 90°, face-to-face issues a rotate command
    const hinge = model.sharedSegments(f0, f1)[0];
    model.rotate(hinge, 90, model.flapPoints(f1, hinge));
    cmds.length = 0;
    helper.fromFaceToFace(f0, f1);
    assertEquals(cmds.some((c) => c.startsWith('t 1000 r')), true);
    assertEquals(hinge.select, true);

    command.command = original;
  });

  await t.step("up() sets upPoint, upSegment, upFace", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);

    let capturedUpPoint, capturedUpSegment, capturedUpFace;
    const originalOut = helper.out.bind(helper);
    helper.out = () => {
      capturedUpPoint = helper.upPoint;
      capturedUpSegment = helper.upSegment;
      capturedUpFace = helper.upFace;
      originalOut();
    };

    helper.up([model.points[0]], [], []);
    assertEquals(capturedUpPoint, model.points[0]);
    assertEquals(capturedUpSegment, undefined);
    assertEquals(capturedUpFace, undefined);
    assertEquals(helper.upPoint, undefined);

    helper.up([], [model.segments[0]], []);
    assertEquals(capturedUpPoint, undefined);
    assertEquals(capturedUpSegment, model.segments[0]);
    assertEquals(capturedUpFace, undefined);
    assertEquals(helper.upSegment, undefined);

    helper.up([], [], [model.faces[0]]);
    assertEquals(capturedUpPoint, undefined);
    assertEquals(capturedUpSegment, undefined);
    assertEquals(capturedUpFace, model.faces[0]);
    assertEquals(helper.upFace, undefined);
  });

  await t.step("search2d() points, segments, faces near xf,yf", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const mockView3d = new MockView3d(model);
    const helper = new Helper(model, command, null, mockView3d, null);

    const result = helper.search2d(200, 200);
    assertEquals(result.points.length, 1);
    assertEquals(result.segments.length, 2);
    assertEquals(result.faces.length, 1);
  });

  await t.step(
    "search3d() points, segments, faces near x,y in 3d canvas", () => {
      const model = new Model().init(200, 200);
      const command = new Command(model);
      const mockView3d = new MockView3d(model);
      const helper = new Helper(model, command, null, mockView3d, null);

      const result = helper.search3d(200, 200);
      assertEquals(result.points.length, 1);
      assertEquals(result.segments.length, 2);
      assertEquals(result.faces.length, 1);
    },
  );

  await t.step("splitSegments does not mutate point z", () => {
    const model = new Model().init(200, 200);
    const command = new Command(model);
    const helper = new Helper(model, command, null, null, null);
    helper.currentCanvas = '2d';
    helper.firstX = -200;
    helper.firstY = 0;
    helper.currentX = 200;
    helper.currentY = 0;
    assertEquals(model.points.every((p) => p.z === 0), true);
    helper.splitSegments();
    assertEquals(model.points.every((p) => p.z === 0), true, 'flat paper stays z=0');
  });
});
