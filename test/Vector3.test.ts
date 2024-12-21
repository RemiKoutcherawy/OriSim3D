// deno test test/Vector3-test.ts
import { Vector3 } from "../js/Vector3.js";
import { assertEquals } from "https://deno.land/std@0.114.0/testing/asserts.ts";

Deno.test("Vector3.closestPoint", () => {
    let a, b, c, p;

    // Degenerate into one point 0,0,0 = 'a' Closest point c is (a,a)
    a = new Vector3(0, 0, 0);
    p = Vector3.closestPoint(a, a, a);
    assertEquals(p, a, "A and AB degenerate to same point");

    // Segment degenerates, point c is at y=100
    c = new Vector3(100, 0, 0);
    p = Vector3.closestPoint(c, a, a);
    assertEquals(p, a, "AB degenerate, C separate point");

    // Point C is on AB
    b = new Vector3(100, 100, 0);
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

Deno.test("Vector3.pointLineDistance", () => {
    let a, b, c, d;

    // Degenerate into one point 0,0,0 = 'a' Closest point c is (a,a)
    a = new Vector3(0, 0, 0);
    d = Vector3.pointLineDistance(a, a, a);
    assertEquals(d, 0, "C and AB degenerate to same point");

    // Segment degenerates, point c is at y=100
    c = new Vector3(100, 0, 0);
    d = Vector3.pointLineDistance(c, a, a);
    assertEquals(d, 100, "AB degenerate, C separate point");

    // Point C is on AB
    b = new Vector3(100, 100, 0);
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

Deno.test("Vector3.dot", () => {
    const a = new Vector3(2, 3, 4);
    const b = new Vector3(5, 6, 7);
    const dot = Vector3.dot(a, b);
    assertEquals(dot, 56, "Dot (2,3,4).(5,6,7) should be 2*5+3*6+4*7=56");
});

Deno.test("Vector3.scale", () => {
    const a = new Vector3(2, 3, 4);
    Vector3.scale(a, 2);
    assertEquals(a.x, 4, "(2,3,4) Scale 2 should give (4,6,8)");
    assertEquals(a.y, 6, "(2,3,4) Scale 2 should give (4,6,8)");
    assertEquals(a.z, 8, "(2,3,4) Scale 2 should give (4,6,8)");
});

Deno.test("Vector3.length3d", () => {
    const a = new Vector3(3, 6, 6);
    const l = Vector3.length3d(a);
    assertEquals(l, 9, "(3,6,6) length3d 9+36+36=81 81=9*9");
});

Deno.test("Vector3.normalize", () => {
    const a = new Vector3(3, 6, 6);
    const n = Vector3.normalize(a);
    assertEquals(Vector3.length3d(n), 1, "(3,6,6) normalize");
});

Deno.test("Vector3.add", () => {
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, 5, 6);
    const c = Vector3.add(a, b);
    assertEquals(c.x, 5, "1+4 = 5");
    assertEquals(c.y, 7, "2+5 = 7");
    assertEquals(c.z, 9, "3+6 = 9");
});

Deno.test("Vector3.sub", () => {
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, 5, 6);
    const c = Vector3.sub(a, b);
    assertEquals(c.x, -3, "1-4 = -3");
    assertEquals(c.y, -3, "2-5 = -3");
    assertEquals(c.z, -3, "3-6 = -3");
});
