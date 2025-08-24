import { Model } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Helper } from "../js/Helper.js";

import { assertEquals } from "jsr:@std/assert";

// Mock View3d class to test Helper.search3d
class MockView3d {
  indexMap = new Map();
  projected: number[][] = [];
  scale = 10;
  constructor(model: Model) {
    model.points.forEach((point, index) => {
      this.indexMap.set(point, index);
      this.projected[index] = [0, 0, 0, 1];
    });
    this.projected[0] = [3, 3, 0, 1];
    this.projected[1] = [3, -3, 0, 1];
    this.projected[2] = [-3, -3, 0, 1];
    this.projected[3] = [-3, 3, 0, 1];
  }
}

Deno.test("Helper Tests", async (t) => {
  const model = new Model().init(200, 200);
  const command = new Command(model);
  const mockView3d = new MockView3d(model);
  const helper = new Helper(model, command, null, mockView3d, null);

  await t.step("down()", () => {
    const points = model.points.slice(0, 0);
    helper.down(points, [], []);
    assertEquals(helper.firstPoint, points[0]);
    const segments = model.segments.slice(0, 0);
    helper.down([], segments, []);
    assertEquals(helper.firstSegment, segments[0]);
    const faces = model.faces.slice(0, 0);
    helper.down([], [], faces);
    assertEquals(helper.firstFace, faces[0]);
    helper.down([], [], []);
    assertEquals(helper.firstPoint, undefined);
    assertEquals(helper.firstSegment, undefined);
    assertEquals(helper.firstFace, undefined);
    // Todo test down logic here
  });

  await t.step("move()", () => {
    const points = model.points.slice(0, 0);
    helper.move(points, [], []);
    assertEquals(helper.firstPoint, points[0]);
    const segments = model.segments.slice(0, 0);
    helper.move([], segments, []);
    assertEquals(helper.firstSegment, segments[0]);
    const faces = model.faces.slice(0, 0);
    helper.move([], [], faces);
    assertEquals(helper.firstFace, faces[0]);
    helper.move([], [], []);
    assertEquals(helper.firstPoint, undefined);
    assertEquals(helper.firstSegment, undefined);
    assertEquals(helper.firstFace, undefined);
    // Todo test move logic here
  });
  await t.step("up()", () => {
    const points = model.points.slice(0, 0);
    helper.up(points, [], []);
    assertEquals(helper.firstPoint, points[0]);
    const segments = model.segments.slice(0, 0);
    helper.up([], segments, []);
    assertEquals(helper.firstSegment, segments[0]);
    const faces = model.faces.slice(0, 0);
    helper.up([], [], faces);
    assertEquals(helper.firstFace, faces[0]);
    helper.up([], [], []);
    assertEquals(helper.firstPoint, undefined);
    assertEquals(helper.firstSegment, undefined);
    assertEquals(helper.firstFace, undefined);
    // Todo test move logic here
  });

  await t.step("search2d() points, segments, faces near xf,yf", () => {
    const result = helper.search2d(200, 200);
    assertEquals(result.points.length, 1);
    assertEquals(result.segments.length, 2);
    assertEquals(result.faces.length, 1);
  });

  await t.step(
    "search3d() points, segments, faces near x,y in 3d canvas", () => {
      const result = helper.search3d(3, 3);
      assertEquals(result.points.length, 1);
      assertEquals(result.segments.length, 2);
      assertEquals(result.faces.length, 1);
    },
  );
});
