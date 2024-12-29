import { Model } from "../js/Model.js";
import { Command } from "../js/Command.js";
import { Helper } from "../js/Helper.js";

import { assertEquals } from "jsr:@std/assert";

Deno.test("Helper Tests", async (t) => {
  const model = new Model().init(-200, -200, 200, 200);
  const command = new Command(model);
  const helper = new Helper(model, command, null, null, null);

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
    "search3d() points, segments, faces near xCanvas,yCanvas", () => {
      const result = helper.search3d(0, 0);
      assertEquals(result.points.length, 4);
      assertEquals(result.segments.length, 4);
      assertEquals(result.faces.length, 1);
    },
  );
});
