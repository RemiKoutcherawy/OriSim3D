import {Point} from "../js/Point.js";

const {test} = QUnit;

QUnit.module('Point', () => {
    const p0 = new Point(-100, -100, -100, -100, 0);
    const p1 = new Point(100, -100, 100, -100, 0);

    test('align2dFrom3d', assert => {
        // p is the middle of segment a b, with wrong x, y
        let p = new Point(1, 1, 0, -100, 0);
        Point.align2dFrom3d(p0, p1, p);
        assert.equal(p.xf, 0, 'x should be 0');
        assert.equal(p.yf, -100, 'y should be -100');
        // degenerated case p is on segment
        p = new Point(1, 1, p1.x, p1.y, p1.z);
        Point.align2dFrom3d(p0, p1, p);
        assert.equal(p.xf, 100, 'x should be 100');
        assert.equal(p.yf, -100, 'x should be -100');
    });

    test('align3dFrom2d', assert => {
        // p is on segment p0 p1, with wrong x, y, z
        let p = new Point(50, -100, 0, 0, 100);
        Point.align3dFrom2d(p0, p1, p);
        assert.equal(p.x, 50, 'x should be 50');
        assert.equal(p.y, -100, 'y should be -100');
        assert.equal(p.z, 0, 'z should be 0');
        // degenerated case p is on endpoint
        p = new Point(100, -100, 0, 0, 100);
        Point.align3dFrom2d(p0, p1, p);
        assert.equal(p.x, 100, 'x should be 100');
        assert.equal(p.y, -100, 'y should be -100');
        assert.equal(p.z, 0, 'z should be 0');
    });

    test('distance2d', assert => {
        const a = new Point(0, 0, 0, 0, 100);
        const b = new Point(30, 40, 0, 0, 100);
        const d = Point.distance2d(a, b);
        assert.equal(d, 50, 'distance should be 50');
    });

});
