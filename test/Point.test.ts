import { Point } from "../js/Point.js";
import { assertEquals } from "@std/assert";

Deno.test("Point.align2dFrom3d", () => {
    const p0 = new Point(-100, -100, -100, -100, 0);
    const p1 = new Point(100, -100, 100, -100, 0);
    // p is the middle of the segment a b, with wrong x, y
    let p = new Point(1, 1, 0, -100, 0);
    Point.align2dFrom3d(p0, p1, p);
    assertEquals(p.xf, 0, "x should be 0");
    assertEquals(p.yf, -100, "y should be -100");
    // degenerated case p is on the segment
    p = new Point(1, 1, p1.x, p1.y, p1.z);
    Point.align2dFrom3d(p0, p1, p);
    assertEquals(p.xf, 100, "x should be 100");
    assertEquals(p.yf, -100, "x should be -100");
});

Deno.test("align3dFrom2d", () => {
    const p0 = new Point(-100, -100, -100, -100, 0);
    const p1 = new Point(100, -100, 100, -100, 0);
    // p is on segment p0 p1, with wrong x, y, z
    let p = new Point(50, -100, 0, 0, 100);
    Point.align3dFrom2d(p0, p1, p);
    assertEquals(p.x, 50, "x should be 50");
    assertEquals(p.y, -100, "y should be -100");
    assertEquals(p.z, 0, "z should be 0");
    // degenerated case p is on endpoint
    p = new Point(100, -100, 0, 0, 100);
    Point.align3dFrom2d(p0, p1, p);
    assertEquals(p.x, 100, "x should be 100");
    assertEquals(p.y, -100, "y should be -100");
    assertEquals(p.z, 0, "z should be 0");
});

Deno.test("distance2d", () => {
    const a = new Point(0, 0, 0, 0, 100);
    const b = new Point(30, 40, 0, 0, 100);
    const d = Point.distance2d(a, b);
    assertEquals(d, 50, "distance should be 50");
});

Deno.test("Point.normalize and Point.normalise alias", () => {
  const norm = Point.normalize({ xf: 3, yf: 4 });
  assertEquals(norm.xf, 0.6);
  assertEquals(norm.yf, 0.8);

  const normAlias = Point.normalise({ xf: 3, yf: 4 });
  assertEquals(normAlias.xf, 0.6);
  assertEquals(normAlias.yf, 0.8);

  const zero = Point.normalize({ xf: 0, yf: 0 });
  assertEquals(zero.xf, 0);
  assertEquals(zero.yf, 0);
});
