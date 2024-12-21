// deno test test/Segment.test.ts
import { Point } from "../js/Point.js";
import { Segment } from "../js/Segment.js";
import { Vector3 } from "../js/Vector3.js";
import { assertEquals } from "jsr:@std/assert";

Deno.test("distance2d - calculates 2D distance from a point to a segment", async (t) => {
  const p1 = new Point(0, 0);
  const p2 = new Point(100, 100);
  let p3 = new Point(-30, 0);

  await t.step("End points", () => {
    const d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p1.xf, p1.yf);
    assertEquals(d, 0, "distanceToSegment");
  });
  await t.step("Across Flat", () => {
    const d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p2.xf, p2.yf);
    assertEquals(d, 0, "distanceToSegment");
  });
  await t.step("Apart on X", () => {
    const d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p3.xf, p3.yf);
    assertEquals(d, 30, "distanceToSegment");
  });
  await t.step("Apart on Y", () => {
    p3 = new Point(0, -30);
    const d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p3.xf, p3.yf);
    assertEquals(d, 30, "distanceToSegment");
  });
  await t.step("Apart and aligned on XY", () => {
    p3 = new Point(110, 110);
    const d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p3.xf, p3.yf);
    assertEquals(d, Math.sqrt(10 * 10 + 10 * 10), "distanceToSegment");
  });
  await t.step("3,4,5 (9+16=25)", () => {
    p3 = new Point(-30, -40);
    let d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p3.xf, p3.yf);
    assertEquals(d, 50, "distanceToSegment");
    p3 = new Point(110, 100);
    d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p3.xf, p3.yf);
    assertEquals(d, 10, "distanceToSegment");
  });
});

Deno.test("CCW in 3D", async (t) => {
  const v1 = new Point(0, 0, 0, 0);
  const v2 = new Point(0, 0, 10, 10);

  await t.step("End points", () => {
    const d = Segment.CCW(v1, v2, v1);
    assertEquals(d, 0, "CCW with v1");
  });
  await t.step("End points", () => {
    const d = Segment.CCW(v1, v2, v2);
    assertEquals(d, 0, "CCW with v2");
  });
  await t.step("Apart on X -30", () => {
    const v3 = new Point(0, 0, -30, 0);
    const d = Segment.CCW(v1, v2, v3);
    assertEquals(d, 300, "CCW with on left");
  });
  await t.step("Apart on X +30", () => {
    const v3 = new Point(0, 0, 30, 0);
    const d = Segment.CCW(v1, v2, v3);
    assertEquals(d, -300, "CCW with on right");
  });
  await t.step("General CCW 3,4,5 (9+16=25) under line", () => {
    const v3 = new Point(0, 0, 4, 3);
    const d = Segment.CCW(v1, v2, v3);
    assertEquals(d, -10, "CCW with point under line");
  });
  await t.step("General CCW 3,4,5 (9+16=25) above line", () => {
    const v3 = new Point(0, 0, 3, 4);
    const d = Segment.CCW(v1, v2, v3);
    assertEquals(d, 10, "CCW with point above line");
  });
  // Debug particular case
  const v4 = new Point(0, 0, -100, -100);
  const v5 = new Point(0, 0, 100, 100);
  const v6 = new Point(0, 0, 100, 100);
  const d = Segment.CCW(v4, v5, v6);
  assertEquals(d, 0, "CCW with on point right");
});

Deno.test("CCWFlat", async (t) => {
  const v1 = new Point(0, 0);
  const v2 = new Point(10, 10);
  await t.step("End points", () => {
    // End points
    let d = Segment.CCWFlat(v1, v2, v1);
    assertEquals(d, 0, "CCWFlat with v1");
    d = Segment.CCWFlat(v1, v2, v2);
    assertEquals(d, 0, "CCW with v2");
  });
  await t.step("Apart on X +30", () => {
    // Apart on X
    const v3 = new Point(30, 0);
    const d = Segment.CCWFlat(v1, v2, v3);
    assertEquals(d, -300, "CCWFlat with point on right");
  });
  await t.step("Apart on X -30", () => {
    // Apart on X
    const v3 = new Point(-30, 0);
    const d = Segment.CCWFlat(v1, v2, v3);
    assertEquals(d, 300, "CCWFlat with point on left");
  });
  await t.step("General CCW 3,4,5 (9+16=25) above line", () => {
    // General CCW 3,4,5 (9+16=25) above line
    const v3 = new Point(3, 4);
    const d = Segment.CCWFlat(v1, v2, v3);
    assertEquals(d, 10, "CCW with on left");
  });
  await t.step("General CCW 3,4,5 (9+16=25) under line", () => {
    // General CCW 3,4,5 (9+16=25) under line
    const v3 = new Point(4, 3);
    const d = Segment.CCWFlat(v1, v2, v3);
    assertEquals(d, -10, "CCW with on right");
  });
  await t.step("Debug particular case", () => {
    // Debug particular case
    const v1 = new Point(-100, -100);
    const v2 = new Point(100, 100);
    const v3 = new Point(100, 100);
    const d = Segment.CCWFlat(v1, v2, v3);
    assertEquals(d, 0, "CCWFlat with point on right");
  });
});

Deno.test("Segment Flat intersection2d", async (t) => {
  const a = new Point(0, 0);
  let b = new Point(100, 100);
  let c = new Point(100, 0);
  let d = new Point(0, 100);
  await t.step("Across Flat", () => {
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(50, 50);
    assertEquals(inter, expect, "En croix");
    // Check with basic intersection
    const inter2d = Segment.intersection2dBasicFlat(a, b, c, d);
    assertEquals(inter, inter2d, "En T");
  });
  await t.step("T shape Flat", () => {
    d = new Point(50, 50);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(50, 50);
    assertEquals(inter, expect, "Crossing T");
  });
  await t.step("Disjoint Flat", () => {
    d = new Point(50, 40);
    const inter = Segment.intersectionFlat(a, b, c, d);
    assertEquals(inter, undefined, "Disjoint Flat");
  });
  await t.step("Parallel Flat", () => {
    c = new Point(10, 0);
    d = new Point(20, 10);
    const inter = Segment.intersectionFlat(a, b, c, d);
    assertEquals(inter, undefined, "Parallel Flat");
  });
  c = new Point(-100, -100);
  d = new Point(200, 200);
  await t.step("Collinear Flat", () => {
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(0, 0);
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat included", () => {
    c = new Point(50, 50);
    d = new Point(100, 100);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(50, 50);
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat disjoint lower", () => {
    c = new Point(-50, -50);
    d = new Point(-100, -100);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = undefined;
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat disjoint upper", () => {
    c = new Point(200, 200);
    d = new Point(300, 300);
    const inter = Segment.intersectionFlat(a, b, c, d);
    assertEquals(inter, undefined, "Collinear");
  });
  await t.step("Collinear Flat surrounded", () => {
    c = new Point(-200, -200);
    d = new Point(300, 300);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(0, 0);
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat reduced to one point apart", () => {
    c = new Point(200, 200);
    d = new Point(200, 200);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = undefined;
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat reduced to one point included", () => {
    c = new Point(50, 50);
    d = new Point(50, 50);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(50, 50);
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat vertical", () => {
    b= new Point(0, 100);
    c= new Point(0, 50);
    d= new Point(0, 50);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(0, 50);
    assertEquals(inter, expect, 'Collinear');
  });
  await t.step("Collinear Flat horizontal", () => {
    b = new Point(100, 0);
    c = new Point(50, 0);
    d = new Point(50, 0);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(50, 0);
    assertEquals(inter, expect, "Collinear");
  });
  await t.step("Collinear Flat horizontal reverse", () => {
    b = new Point(100, 0);
    c = new Point(200, 0);
    d = new Point(50, 0);
    const inter = Segment.intersectionFlat(a, b, c, d);
    const expect = new Point(50, 0);
    assertEquals(inter, expect, "Collinear");
  });
});

Deno.test("Segment 3D", async (t) => {
  const a = new Point(0, 0, 0, 0, 0);

  await t.step("Segment 3D closestSegment same points", () => {
    // Both segments degenerate into one point 0,0,0 = the Closest segment c is (a,a)
    const s = Segment.closestSegment(a, a, a, a);
    assertEquals(s.p, a, "Both segments degenerate to same point");
    assertEquals(s.q, a, "Both segments degenerate to same point");
  });
  await t.step("Segment 3D closestSegment distinct points", () => {
    // First segment degenerates and second segment degenerates but is distinct
    const c = new Point(0, 0, 0, -100, 0);
    const s = Segment.closestSegment(a, a, c, c);
    assertEquals(s.p, a, "Both segments degenerate to distinct points");
    assertEquals(s.q, c, "First segment degenerate to distinct points");
  });
  await t.step("Segment 3D closestSegment one point", () => {
    // First segment degenerates (0,0,0) and second segment is crossing first segment
    const c = new Point(0, 0, 0, -100, 0);
    const d = new Point(0, 0, 0, 100, 0);
    const a=  new Vector3(0, 0, 0);
    const s = Segment.closestSegment(a, a, c, d);
    assertEquals(s.p, a, "Segment degenerate to 1 point, on second segment",);
    assertEquals(s.q, a, "First segment degenerate to 1 point, on second segment",
    );
  });
  await t.step("Segment 3D closestSegment second apart", () => {
    // First degenerate and second is a distinct line
    const a=  new Vector3(0, 0, 0);
    const c = new Point(0, 0, 100, -100, 0);
    const d = new Point(0, 0, 100, 100, 0);
    const e = new Vector3(100, 0, 0); // Closest to  0,0,0
    const s = Segment.closestSegment(a, a, c, d);
    assertEquals(s.p, a, "First segment degenerate to one point, second segment apart");
    assertEquals(s.q, e, "First segment degenerate to one point, second segment apart");
  });
  await t.step("Segment 3D closestSegment parallel segments", () => {
    // First and second are parallel segments
    const a = new Vector3( 0, -100, 0);
    const b = new Point(0, 0, 0, 100, 0);
    const c = new Point(0, 0, 100, -200, 0);
    const d = new Point(0, 0, 100, 100, 0);
    const e = new Vector3( 100, -100, 0); // a projected on cd
    const s = Segment.closestSegment(a, b, c, d);
    // Should take the first point of ab and project it on cd
    assertEquals(s.p, a, "Parallel segments");
    assertEquals(s.q, e, "Parallel segments");
  });
  await t.step("Segment 3D closestSegment intersecting segments", () => {
    // First and second are intersecting segments
    const a = new Point(0, 0, 100, 0, 0); // vertical on x = 100
    const b = new Point(0, 0, 100, 400, 0);
    const c = new Point(0, 0, 0, 0, 0); // 45° from 0,0 to 200,200
    const d = new Point(0, 0, 200, 200, 0);
    const s = Segment.closestSegment(a, b, c, d);
    const expect = new Vector3(100, 100, 0);
    assertEquals(s.p, expect, "Intersecting segments first point");
    assertEquals(s.q, expect, "Intersecting segments second point");
  });

  await t.step("Segment 3D closestSegment non intersecting segments same plane", () => {
    // First and second are non-intersecting segments
    const a = new Point(0, 0, 100, 0, 0); // vertical x=100 y[0,100]
    const b = new Point(0, 0, 100, 100, 0);
    const c = new Point(0, 0, 0, 200, 0); // horizontal y=200 x[0,200]
    const d = new Point(0, 0, 200, 200, 0);
    const s = Segment.closestSegment(a, b, c, d);
    let expect = new Vector3(100, 100, 0);
    assertEquals(s.p, expect, "Non intersecting segments on same plane");
    expect = new Vector3(100, 200, 0);
    assertEquals(s.q, expect, "Non intersecting segments on same plane",);
  });

  await t.step("Segment 3D closestSegment non intersecting segments in 3D", () => {
    // First and second are non-intersecting lines in 3D
    const  a = new Point(0, 0, 0, 0, 100); // diagonal on back side of cube
    const b = new Point(0, 0, 100, 100, 100);
    const c = new Point(0, 0, 0, 100, 0); // diagonal on front side of cube
    const d = new Point(0, 0, 100, 0, 0);
    const s = Segment.closestSegment(a, b, c, d); // line between middle of front face to middle of back face
    let expect = new Vector3( 50, 50, 100);
    assertEquals(s.p, expect, "Non intersecting segments in 3D first point");
    expect = new Vector3( 50, 50, 0);
    assertEquals(s.q, expect, "Non intersecting segments in 3D second point");
  });
});