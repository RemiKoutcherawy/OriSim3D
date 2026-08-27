// NOSONAR - SonarQube's S2187 test-detection doesn't recognize Deno's Deno.test()/t.step()
// API as test cases; this file contains 14 t.step() sub-tests (45 assertions) for Vector3.js.
// deno test test/Vector3-test.ts
import { Vector3 } from "../js/Vector3.js";
import * as mat4 from "../js/lib/mat4.js";
import { assertEquals } from "@std/assert";

Deno.test("Vector3", async (t) => {
    await t.step("closestPoint", () => {
        // Degenerate into one point 0,0,0 = 'a' Closest point c is (a,a)
        let a = new Vector3(0, 0, 0);
        let p = Vector3.closestPoint(a, a, a);
        assertEquals(p, a, "A and AB degenerate to same point");

        // Segment degenerates, point c is at y=100
        let c = new Vector3(100, 0, 0);
        p = Vector3.closestPoint(c, a, a);
        assertEquals(p, a, "AB degenerate, C separate point");

        // Point C is on AB
        let b = new Vector3(100, 100, 0);
        c = new Vector3(50, 50, 0);
        p = Vector3.closestPoint(c, a, b);
        assertEquals(p, c, "Point C is on segment AB");

        // Point C is aligned with AB
        a = new Vector3(50, 50, 50);
        b = new Vector3(100, 100, 100);
        c = new Vector3(0, 0, 0);
        p = Vector3.closestPoint(c, a, b);
        assertEquals(p, c);

        // Point C is not aligned on AB
        a = new Vector3(0, 0, 0);
        b = new Vector3(100, 0, 0);
        c = new Vector3(50, 100, 0);
        p = Vector3.closestPoint(c, a, b);
        assertEquals(p, new Vector3(50, 0, 0));
    });

    await t.step("pointLineDistance", () => {
        // Degenerate into one point 0,0,0 = 'a' Closest point c is (a,a)
        let a = new Vector3(0, 0, 0);
        let d = Vector3.pointLineDistance(a, a, a);
        assertEquals(d, 0, "C and AB degenerate to same point");

        // Segment degenerates, point c is at y=100
        let c = new Vector3(100, 0, 0);
        d = Vector3.pointLineDistance(c, a, a);
        assertEquals(d, 100, "AB degenerate, C separate point");

        // Point C is on AB
        let b = new Vector3(100, 100, 0);
        c = new Vector3(50, 50, 0);
        d = Vector3.pointLineDistance(c, a, b);
        assertEquals(d, 0, "Point C is on segment AB");

        // Point C is aligned with AB at 50
        a = new Vector3(50, 50, 50);
        b = new Vector3(100, 100, 100);
        c = new Vector3(0, 0, 0);
        d = Vector3.pointLineDistance(c, a, b);
        assertEquals(d, 0);

        // Point C is not aligned on AB
        a = new Vector3(0, 0, 0);
        b = new Vector3(100, 0, 0);
        c = new Vector3(50, 100, 0);
        d = Vector3.pointLineDistance(c, a, b);
        assertEquals(d, 100);
    });

    await t.step("dot", () => {
        const a = new Vector3(2, 3, 4);
        const b = new Vector3(5, 6, 7);
        const dot = Vector3.dot(a, b);
        assertEquals(dot, 56, "Dot (2,3,4).(5,6,7) should be 2*5+3*6+4*7=56");
    });

    await t.step("scale", () => {
        const a = new Vector3(2, 3, 4);
        const res = Vector3.scale(a, 2);
        assertEquals(res.x, 4, "(2,3,4) Scale 2 should give (4,6,8)");
        assertEquals(res.y, 6, "(2,3,4) Scale 2 should give (4,6,8)");
        assertEquals(res.z, 8, "(2,3,4) Scale 2 should give (4,6,8)");
        assertEquals(a.x, 2, "original vector should not be mutated");
        assertEquals(a.y, 3, "original vector should not be mutated");
        assertEquals(a.z, 4, "original vector should not be mutated");
    });

    await t.step("length3d", () => {
        const a = new Vector3(3, 6, 6);
        const l = Vector3.length3d(a);
        assertEquals(l, 9, "(3,6,6) length3d 9+36+36=81 81=9*9");
    });

    await t.step("normalize", () => {
        const a = new Vector3(3, 6, 6);
        const n = Vector3.normalize(a);
        assertEquals(Vector3.length3d(n), 1, "(3,6,6) normalize");
    });

    await t.step("add", () => {
        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c = Vector3.add(a, b);
        assertEquals(c.x, 5, "1+4 = 5");
        assertEquals(c.y, 7, "2+5 = 7");
        assertEquals(c.z, 9, "3+6 = 9");
    });

    await t.step("sub", () => {
        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c = Vector3.sub(a, b);
        assertEquals(c.x, -3, "1-4 = -3");
        assertEquals(c.y, -3, "2-5 = -3");
        assertEquals(c.z, -3, "3-6 = -3");
    });

    await t.step("transformMat4 identity", () => {
        const a = new Vector3(1, 2, 3);
        const identity = mat4.create();
        const res = Vector3.transformMat4(a, identity);
        assertEquals(res.x, 1);
        assertEquals(res.y, 2);
        assertEquals(res.z, 3);
    });

    await t.step("transformMat4 translation", () => {
        const a = new Vector3(1, 2, 3);
        const m = mat4.fromTranslation(mat4.create(), [10, 20, 30]);
        const res = Vector3.transformMat4(a, m);
        assertEquals(res.x, 11);
        assertEquals(res.y, 22);
        assertEquals(res.z, 33);
    });

    await t.step("transformMat4 scale", () => {
        const a = new Vector3(1, 2, 3);
        const m = mat4.scale(mat4.create(), mat4.create(), [2, 3, 4]);
        const res = Vector3.transformMat4(a, m);
        assertEquals(res.x, 2);
        assertEquals(res.y, 6);
        assertEquals(res.z, 12);
    });

    await t.step("transformMat4 with generic object {x, y, z}", () => {
        const pt = { x: 5, y: 10, z: 15 };
        const m = mat4.fromTranslation(mat4.create(), [1, 2, 3]);
        const res = Vector3.transformMat4(pt, m);
        assertEquals(res instanceof Vector3, true);
        assertEquals(res.x, 6);
        assertEquals(res.y, 12);
        assertEquals(res.z, 18);
    });

    await t.step("transformMat4 with perspective / w division", () => {
        const a = new Vector3(2, 4, 6);
        const m = mat4.create();
        m[15] = 2;
        const res = Vector3.transformMat4(a, m);
        assertEquals(res.x, 1);
        assertEquals(res.y, 2);
        assertEquals(res.z, 3);
    });

    await t.step("mat4.invert identity and translation", () => {
        const ident = mat4.invert(mat4.create(), mat4.create());
        assertEquals(ident !== null, true);
        assertEquals([...ident!], [...mat4.create()]);

        const t = mat4.fromTranslation(mat4.create(), [10, 20, 30]);
        const inv = mat4.invert(mat4.create(), t);
        const back = mat4.multiply(mat4.create(), t, inv!);
        for (let i = 0; i < 16; i++) {
            assertEquals(Math.abs(back[i] - mat4.create()[i]) < 1e-6, true);
        }
    });
});
