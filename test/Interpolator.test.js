import {Interpolator} from "../js/Interpolator.js";

const {test} = QUnit;

QUnit.module('Interpolator', () => {
  test('LinearInterpolator', assert => {
    const i = Interpolator.LinearInterpolator;
    const t0 = i(0);const t1 = i(1);const t05 = i(0.5);
    assert.strictEqual(Math.round(t0), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 5, "T 0.5");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  });
    test('AccelerateDecelerateInterpolator', assert => {
      const i = Interpolator.AccelerateDecelerateInterpolator;
      const t0 = i(0);const t1 = i(1);const t05 = 0.5;
      assert.strictEqual(Math.round(t0* 10), 0, "T 0.0");
      assert.strictEqual(Math.round(t05 * 10), 5, "T 0.5");
      assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
    });
  test('SpringOvershootInterpolator', assert => {
    const i  = Interpolator.SpringOvershootInterpolator;
    const t0 = i(0);const t1 = i(1);const t05 = i(0.5);
    assert.strictEqual(Math.round(t0* 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 9, "T 9.0");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  });
  test('SpringBounceInterpolator', assert => {
    const i  = Interpolator.SpringBounceInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assert.strictEqual(Math.round(t0* 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 9, "T 9.0");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  });
  test('GravityBounceInterpolator', assert => {
    const i  = Interpolator.GravityBounceInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assert.strictEqual(Math.round(t0 * 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 10, "T 10.0");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  });
  test('BounceInterpolator', assert => {
    const i  = Interpolator.BounceInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assert.strictEqual(Math.round(t0 * 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 7, "T 7.0");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  });
  test('OvershootInterpolator', assert => {
    const i  = Interpolator.OvershootInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assert.strictEqual(Math.round(t0* 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 11, "T 0.5");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  });
  test('AnticipateInterpolator', assert => {
    const i  = Interpolator.AnticipateInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assert.strictEqual(Math.round(t0 * 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 1, "T 1.0");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
  })
  test('AnticipateOvershootInterpolator', assert => {
    const i  = Interpolator.AnticipateOvershootInterpolator;
    const t0 = i(0); const t1 = i(1); const t05 = i(0.5);
    assert.strictEqual(Math.round(t0* 10), 0, "T 0.0");
    assert.strictEqual(Math.round(t05 * 10), 5, "T 5.0");
    assert.strictEqual(Math.round(t1 * 10), 10, "T 1.0");
    // draw(Interpolator.AnticipateOvershootInterpolator, 'red');
  })
});
