import { Face } from "../js/Face.js";
import { Point } from "../js/Point.js";
import { assertEquals, assert } from "https://deno.land/std@0.114.0/testing/asserts.ts";

Deno.test("Face", async (t) => {
    // Square from -100,-100 to 100,100
    const p0 = new Point(-100, -100, -100, -100, 0);
    const p1 = new Point(100, -100, 100, -100, 0);
    const p2 = new Point(100, 100, 100, 100, 0);
    const p3 = new Point(-100, 100, -100, 100, 0);
    // Face is a square -100,-100 to 100,100 counter clock wise
    const face = new Face([p0, p1, p2, p3]);

    await t.step("area2dFlat", () => {
        const area = Face.area2dFlat(face.points);
        assertEquals(area, 200 * 200, "Area2d should be 200 * 200");
    });

    await t.step("distance2dLineToPoint", () => {
        const p1 = new Point(0, 0);
        const p2 = new Point(100, 100);
        // End points
        let d = Face.distance2dLineToPoint(p1, p2, p1);
        assertEquals(d, 0, "from p1,p2 to p1 should be 0");
        d = Face.distance2dLineToPoint(p1, p2, p2);
        assertEquals(d, 0, "from p1,p2 to p2 should be 0");
        // Apart on X
        let p3 = new Point(-30, 0);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assertEquals(d, -3000, "from p1,p2 to (-30,0) should be < 0 on the left");
        // Apart on Y
        p3 = new Point(0, -30);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assertEquals(d, 3000, "from p1,p2 to (0,-30) should be > 0 on the right");
        // Apart but aligned on XY
        p3 = new Point(110, 110);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assertEquals(d, 0, "distance to point aligned on line should be 0");
        // Point on the left
        p3 = new Point(-100, 0);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assertEquals(d, -10000, "distance to point (-100,0) on left should be < 0");
        // Point on the right
        p3 = new Point(100, 0);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assertEquals(d, 10000, "distance to point (100,0) on the right should be > 0");
    });

    await t.step("contains2d", () => {
        let result = Face.contains2d(face, 0, 0);
        assert(result, "Face contains 200, 300 ");
        // Check boundary points
        result = Face.contains2d(face, 100, 100);
        assert(result, "Face contains 100, 100 ");
        result = Face.contains2d(face, -100, 100);
        assert(result, "Face contains -100, 100 ");
        result = Face.contains2d(face, -100, -100);
        assert(result, "Face contains -100, -100 ");
        result = Face.contains2d(face, 100, -100);
        assert(result, "Face contains 100, -100 ");
    });

    await t.step("area3d", () => {
        const area = Face.area3d(face.points);
        assertEquals(area, 200 * 200, "Area3d should be 200 * 200");
    });
});
