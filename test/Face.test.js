import {Face} from "../js/Face.js";
import {Point} from "../js/Point.js";

const {test} = QUnit;

QUnit.module('Face', () => {
    // Square from -100,-100 to 100,100
    const p0 = new Point(-100, -100, -100, -100, 0);
    const p1 = new Point(100, -100, 100, -100, 0);
    const p2 = new Point(100, 100, 100, 100, 0);
    const p3 = new Point(-100, 100, -100, 100, 0);
    // Face is a square -100,-100 to 100,100 counter clock wise
    const face = new Face([p0, p1, p2, p3]);

    test('area2dFlat', assert => {
        const area = Face.area2dFlat(face.points);
        assert.deepEqual(area, 200 * 200, "Area2d should be 200 * 200");
    });

    test('distance2dLineToPoint', assert => {
        const p1 = new Point(0, 0);
        const p2 = new Point(100, 100);
        // End points
        let d = Face.distance2dLineToPoint(p1, p2, p1);
        assert.deepEqual(d, 0, "from p1,p2 to p1 should be 0");
        d = Face.distance2dLineToPoint(p1, p2, p2);
        assert.deepEqual(d, 0, "from p1,p2 to p2 should be 0");
        // Apart on X
        let p3 = new Point(-30, 0);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assert.deepEqual(d, -3000, "from p1,p2 to (-30,0) should be < 0 on the left");
        // Apart on Y
        p3 = new Point(0, -30);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assert.deepEqual(d, 3000, "from p1,p2 to (0,-30) should be > 0 on the right");
        // Apart but aligned on XY
        p3 = new Point(110, 110);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assert.deepEqual(d, 0, "distance to point aligned on line should be 0");
        // Point on the left
        p3 = new Point(-100, 0);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assert.deepEqual(d, -10000, "distance to point (-100,0) on left should be < 0");
        // Point on the right
        p3 = new Point(100, 0);
        d = Face.distance2dLineToPoint(p1, p2, p3);
        assert.deepEqual(d, 10000, "distance to point (100,0) on the right should be > 0");
    });

    test('contains2d', assert => {
        let result = Face.contains2d(face, 10, 10);
        assert.equal(result, true, "Face contains 10, 10 ");
        // Check boundary points
        result = Face.contains2d(face, 100, 100);
        assert.equal(result, true, "Face contains 100, 100 ");
        result = Face.contains2d(face, -100, 100);
        assert.equal(result, true, "Face contains -100, 100 ");
        result = Face.contains2d(face, -100, -100);
        assert.equal(result, true, "Face contains -100, -100 ");
        result = Face.contains2d(face, 100, -100);
        assert.equal(result, true, true, "Face contains 100, -100 ");
    });

    test('area3d', assert => {
        const area = Face.area3d(face.points);
        assert.deepEqual(area, 200 * 200, "Area3d should be 200 * 200");
    });
});



