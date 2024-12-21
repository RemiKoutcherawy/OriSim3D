// deno test test/Plane.test.ts
import { Vector3 } from "../js/Vector3.js";
import { Plane } from "../js/Plane.js";
import { assertEquals } from "jsr:@std/assert";

Deno.test("plane across", () => {
    const p1: Vector3 = new Vector3(10, 50, 0);
    const p2: Vector3 = new Vector3(30, 50, 0);
    const plane = Plane.across(p1, p2);
    assertEquals(plane.normal.x, 1, "Normal x");
    assertEquals(plane.normal.y, 0, "Normal y");
    assertEquals(plane.normal.z, 0, "Normal z");
    assertEquals(
        Vector3.dot(plane.origin, plane.normal),
        20,
        "Distance 20",
    );
});

Deno.test("plane by", () => {
    const p1: Vector3 = new Vector3(30, 50, 0);
    const p2: Vector3 = new Vector3(10, 50, 0);
    const plane = Plane.by(p1, p2);
    assertEquals(plane.normal.x, 0, "Normal x");
    assertEquals(plane.normal.y, 1, "Normal y");
    assertEquals(plane.normal.z, 0, "Normal z");
    assertEquals(
        Vector3.dot(plane.origin, plane.normal),
        50,
        "Distance 50",
    );
});

Deno.test("plane orthogonal", () => {
    const p1: Vector3 = new Vector3(10, 50, 0);
    const p2: Vector3 = new Vector3(30, 50, 0);
    const pt: Vector3 = new Vector3(20, 0, 0);

    const plane = Plane.orthogonal(p1, p2, pt);
    assertEquals(plane.normal.x, 1, "Normal x");
    assertEquals(plane.normal.y, 0, "Normal y");
    assertEquals(plane.normal.z, 0, "Normal z");
    assertEquals(
        Vector3.dot(plane.origin, plane.normal),
        20,
        "Distance 20",
    );
});
