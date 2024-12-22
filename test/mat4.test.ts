import { mat4 } from '../js/mat4.js';
import { assertEquals, assertAlmostEquals } from "jsr:@std/assert";

Deno.test("mat4.create", () => {
    const result = mat4.create();
    const expected = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    assertEquals(result, expected);
});

Deno.test("mat4.applyMatrix4", () => {
    const m = mat4.create();
    const v = new Float32Array([1, 2, 3]);
    const result = mat4.applyMatrix4(m, v);
    const expected = new Float32Array([1, 2, 3]);
    assertEquals(result, expected);
});

Deno.test("mat4.multiply", () => {
    const a = mat4.create();
    const b = mat4.create();
    const out = new Float32Array(16);
    const result = mat4.multiply(out, a, b);
    const expected = mat4.create();
    assertEquals(result, expected);
});

Deno.test("mat4.scale", () => {
    const a = mat4.create();
    const v = new Float32Array([2, 3, 4]);
    const out = new Float32Array(16);
    const result = mat4.scale(out, a, v);
    const expected = new Float32Array([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1]);
    assertEquals(result, expected);
});

Deno.test("mat4.rotate", () => {
    const a = mat4.create();
    const axis = new Float32Array([1, 0, 0]);
    const out = new Float32Array(16);
    const result = mat4.rotate(out, a, Math.PI / 2, axis);
    const expected = new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
    expected.forEach((val, index) => assertAlmostEquals(result[index], val));
});

Deno.test("mat4.rotateX", () => {
    const a = mat4.create();
    const out = new Float32Array(16);
    const result = mat4.rotateX(out, a, Math.PI / 2);
    const expected = new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
    expected.forEach((val, index) => assertAlmostEquals(result[index], val));
});

Deno.test("mat4.rotateY", () => {
    const a = mat4.create();
    const out = new Float32Array(16);
    const result = mat4.rotateY(out, a, Math.PI / 2);
    const expected = new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
    expected.forEach((val, index) => assertAlmostEquals(result[index], val));
});

Deno.test("mat4.fromTranslation", () => {
    const v = new Float32Array([1, 2, 3]);
    const out = new Float32Array(16);
    const result = mat4.fromTranslation(out, v);
    const expected = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
    assertEquals(result, expected);
});

Deno.test("mat4.frustum", () => {
    const out = new Float32Array(16);
    const result = mat4.frustum(out, -1, 1, -1, 1, 1, 10);
    const expected = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.2222222, -1, 0, 0, -2.2222223, 0]);
    expected.forEach((val, index) => assertAlmostEquals(result[index], val));
});
