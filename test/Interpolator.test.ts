import { Interpolator } from "../js/Interpolator.js";
import { assertEquals } from "https://deno.land/std@0.110.0/testing/asserts.ts";

Deno.test('LinearInterpolator', () => {
    const i = Interpolator.LinearInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0), 0);
    assertEquals(Math.round(t05 * 10), 5);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('AccelerateDecelerateInterpolator', () => {
    const i = Interpolator.AccelerateDecelerateInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0 * 10), 0);
    assertEquals(Math.round(t05 * 10), 5);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('SpringOvershootInterpolator', () => {
    const i = Interpolator.SpringOvershootInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0 * 10), 0);
    assertEquals(Math.round(t05 * 10), 9);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('SpringBounceInterpolator', () => {
    const i = Interpolator.SpringBounceInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0 * 10), 0);
    assertEquals(Math.round(t05 * 10), 9);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('GravityBounceInterpolator', () => {
    const i = Interpolator.GravityBounceInterpolator;
    const t0 = i(0);
    const t1 = i(1);
    const t05 = i(0.5);
    assertEquals(Math.abs(Math.round(t0 * 10)), 0);
    assertEquals(Math.round(t05 * 10), 10);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('BounceInterpolator', () => {
    const i = Interpolator.BounceInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0 * 10), 0);
    assertEquals(Math.round(t05 * 10), 7);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('OvershootInterpolator', () => {
    const i = Interpolator.OvershootInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0 * 10), 0);
    assertEquals(Math.round(t05 * 10), 11);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('AnticipateInterpolator', () => {
    const i = Interpolator.AnticipateInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.round(t0 * 10), 0);
    assertEquals(Math.round(t05 * 10), 1);
    assertEquals(Math.round(t1 * 10), 10);
});

Deno.test('AnticipateOvershootInterpolator', () => {
    const i = Interpolator.AnticipateOvershootInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assertEquals(Math.abs(Math.round(t0 * 10)), 0);
    assertEquals(Math.round(t05 * 10), 5);
    assertEquals(Math.round(t1 * 10), 10);
});
