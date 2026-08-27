// deno test test/Plane.test.ts
import { Vector3 } from "../js/Vector3.js";
import { Plane } from "../js/Plane.js";
import { assertEquals} from "@std/assert";

Deno.test("Plane ", async (t) => {
    await t.step("across", () => {
        const p1: Vector3 = new Vector3(10, 50, 0);
        const p2: Vector3 = new Vector3(30, 50, 0);
        const plane = Plane.across(p1, p2);
        assertEquals(plane.normal.x, 1, "Normal x");
        assertEquals(plane.normal.y, 0, "Normal y");
        assertEquals(plane.normal.z, 0, "Normal z");
        assertEquals(Vector3.dot(plane.origin, plane.normal), 20, "Distance 20",);
    });
    await t.step("by", () => {
        const p1: Vector3 = new Vector3(30, 50, 0);
        const p2: Vector3 = new Vector3(10, 50, 0);
        const plane = Plane.by(p1, p2);
        assertEquals(plane.normal.x, 0, "Normal x");
        assertEquals(plane.normal.y, 1, "Normal y");
        assertEquals(plane.normal.z, 0, "Normal z");
        assertEquals(Vector3.dot(plane.origin, plane.normal), 50);
    });
    await t.step("orthogonal", () => {
        const p1: Vector3 = new Vector3(10, 50, 0);
        const p2: Vector3 = new Vector3(30, 50, 0);
        const pt: Vector3 = new Vector3(20, 0, 0);

        const plane = Plane.orthogonal(p1, p2, pt);
        assertEquals(plane.normal.x, 1, "Normal x");
        assertEquals(plane.normal.y, 0, "Normal y");
        assertEquals(plane.normal.z, 0, "Normal z");
        assertEquals(Vector3.dot(plane.origin, plane.normal), 20);
    });
    await t.step("parallel", () => {
        const p1: Vector3 = new Vector3(10, 50, 0);
        const p2: Vector3 = new Vector3(30, 50, 0);
        const pt: Vector3 = new Vector3(20, 0, 0);

        const plane = Plane.parallel(p1, p2, pt);
        // direction (20,0,0) × Z → normal (0,-1,0) normalized to (0,-1,0)
        assertEquals(plane.normal.x, 0, "Normal x");
        assertEquals(plane.normal.y, -1, "Normal y");
        assertEquals(plane.normal.z, 0, "Normal z");
        assertEquals(Vector3.dot(plane.origin, plane.normal), 0);
    });
    await t.step("parallel along Z falls back to vertical plane", () => {
        const p1: Vector3 = new Vector3(10, 10, 0);
        const p2: Vector3 = new Vector3(10, 10, 5);
        const pt: Vector3 = new Vector3(3, 4, 0);
        const plane = Plane.parallel(p1, p2, pt);
        assertEquals(plane.normal.x, 1, "Normal x");
        assertEquals(plane.normal.y, 0, "Normal y");
        assertEquals(plane.normal.z, 0, "Normal z");
        assertEquals(Vector3.dot(plane.origin, plane.normal), 3);
    });
});
