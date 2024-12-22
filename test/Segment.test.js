import {Vector3} from "../js/Vector3.js";
import {Point} from "../js/Point.js";
import {Segment} from "../js/Segment.js";

const {test} = QUnit;

QUnit.module('Segment', () => {

    test('length2d3d', assert => {
        // 3,4,5 (30^2 + 40^2 = 50^2)
        const p1 = new Point(10, 20, 10, 20, 30);
        const p2 = new Point(40, 60, 40, 60, 30);
        const length2d = Segment.length2d(new Segment(p1, p2));
        assert.deepEqual(length2d, 50, "length2d");
        const length3d = Segment.length3d(new Segment(p1, p2));
        assert.deepEqual(length3d, 50, "length");
    });

    test('distance2d', assert => {
        let p1 = new Point(0, 0);
        let p2 = new Point(100, 100);
        // End points
        let d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p1.xf, p1.yf);
        assert.deepEqual(d, 0, "distanceToSegment");
        d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p2.xf, p2.yf);
        assert.deepEqual(d, 0, "distanceToSegment");
        // Apart on X
        let p3 = new Point(-30, 0);
        d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p3.xf, p3.yf);
        assert.deepEqual(d, 30, "distanceToSegment");
        // Apart on Y
        p3 = new Point(0, -30);
        d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p3.xf, p3.yf);
        assert.deepEqual(d, 30, "distanceToSegment");
        // Apart and aligned on XY
        p3 = new Point(110, 110);
        d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p3.xf, p3.yf);
        assert.deepEqual(d, Math.sqrt(10 * 10 + 10 * 10), "distanceToSegment");
        // 3,4,5 (9+16=25)
        p3 = new Point(-30, -40);
        d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p3.xf, p3.yf);
        assert.deepEqual(d, 50, "distanceToSegment");
        p3 = new Point(110, 100);
        d = Segment.distance2d(p1.xf,p1.yf, p2.xf,p2.yf, p3.xf, p3.yf);
        assert.deepEqual(d, 10, "distanceToSegment");
    });

    test('CCW', assert => {
        const v1 = new Point(0, 0, 0, 0);
        const v2 = new Point(0, 0, 10, 10);
        // End points
        let d = Segment.CCW(v1, v2, v1);
        assert.deepEqual(d, 0, "CCW with v1");
        d = Segment.CCW(v1, v2, v2);
        assert.deepEqual(d, 0, "CCW with v2");
        // Apart on X
        let v3 = {x:-30, y:0};
        d = Segment.CCW(v1, v2, v3);
        assert.deepEqual(d, 300, "CCW with on left");
        // General CCW 3,4,5 (9+16=25) above line
        v3 = {x:3, y:4};
        d = Segment.CCW(v1, v2, v3);
        assert.deepEqual(d, 10, "CCW with on left");
        // General CCW 3,4,5 (9+16=25) under line
        v3 = {x:4, y:3};
        d = Segment.CCW(v1, v2, v3);
        assert.deepEqual(d, -10, "CCW with point on right");

        // Debug particular case
        const v4 = {x:-100, y:-100};
        const v5 = {x:100, y:100};
        const v6 = {x:100, y:100};
        d = Segment.CCW(v4, v5, v6);
        assert.deepEqual(d, 0, "CCW with on point right");
    });

    test('CCWFlat', assert => {
        let v1 = new Point(0, 0);
        let v2 = new Point(10, 10);
        // End points
        let d = Segment.CCWFlat(v1, v2, v1);
        assert.deepEqual(d, 0, "CCWFlat with v1");
        d = Segment.CCWFlat(v1, v2, v2);
        assert.deepEqual(d, 0, "CCW with v2");
        // Apart on X
        let v3 = new Point(-30, 0);
        d = Segment.CCWFlat(v1, v2, v3);
        assert.deepEqual(d, 300, "CCWFlat with point on left");
        // General CCW 3,4,5 (9+16=25) above line
        v3 = new Point(3, 4);
        d = Segment.CCWFlat(v1, v2, v3);
        assert.deepEqual(d, 10, "CCW with on left");
        // General CCW 3,4,5 (9+16=25) under line
        v3 = new Point(4, 3);
        d = Segment.CCWFlat(v1, v2, v3);
        assert.deepEqual(d, -10, "CCW with on right");

        // Debug particular case
        v1 = new Point(-100, -100);
        v2 = new Point(100, 100);
        v3 = new Point(100, 100);
        d = Segment.CCWFlat(v1, v2, v3);
        assert.deepEqual(d, 0, "CCWFlat with point on right");
    });
});

QUnit.module('Segment Flat intersection2d', () => {
    const a = new Point(0, 0);
    const b = new Point(100, 100);
    const c = new Point(100, 0);
    const d = new Point(0, 100);
    test('Across Flat', assert => {
        let inter = Segment.intersectionFlat(a, b, c, d);
        let expect = new Point(50, 50);
        assert.deepEqual(inter, expect, 'En croix');
        // Check with basic intersection
        let inter2d = Segment.intersection2dBasicFlat(a, b, c, d);
        assert.deepEqual(inter, inter2d, 'En T');
    });
    test('T shape Flat', assert => {
        d.xf = 50;
        d.yf = 50;
        let inter = Segment.intersectionFlat(a, b, c, d);
        let expect = new Point(50, 50);
        assert.deepEqual(inter, expect, 'Crossing T');
    });
    test('Disjoint Flat', assert => {
        d.xf = 60;
        d.yf = 40;
        let inter = Segment.intersectionFlat(a, b, c, d);
        let expect = undefined;
        assert.deepEqual(inter, expect, 'Disjoint');
    });
    test('Parallel Flat', assert => {
        c.xf = 10;
        c.yf = 0;
        d.xf = 20;
        d.yf = 10;
        let inter = Segment.intersectionFlat(a, b, c, d);
        let expect = undefined;
        assert.deepEqual(inter, expect, 'Parallel');
    });
    test('Collinear Flat superposed', assert => {
        c.xf = -100;
        c.yf = -100;
        d.xf = 200;
        d.yf = 200;
        let inter = Segment.intersectionFlat(a, b, c, d);
        let expect = new Point(0, 0);
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat included', assert => {
        c.xf = 50;
        c.yf = 50;
        d.xf = 100;
        d.yf = 100;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = new Point(50, 50);
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat disjoint lower', assert => {
        c.xf = -50;
        c.yf = -50;
        d.xf = -100;
        d.yf = -100;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = undefined;
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat disjoint upper', assert => {
        c.xf = 200;
        c.yf = 200;
        d.xf = 300;
        d.yf = 300;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = undefined;
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat surrounded', assert => {
        c.xf = -200;
        c.yf = -200;
        d.xf = 300;
        d.yf = 300;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = new Point(0, 0);
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat reduced to one point apart', assert => {
        c.xf = 200;
        c.yf = 200;
        d.xf = 200;
        d.yf = 200;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = undefined;
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat reduced to one point included', assert => {
        c.xf = 50;
        c.yf = 50;
        d.xf = 50;
        d.yf = 50;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = new Point(50, 50);
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat vertical', assert => {
        a.xf = 0;
        a.yf = 0;
        b.xf = 0;
        b.yf = 100;
        c.xf = 0;
        c.yf = 50;
        d.xf = 0;
        d.yf = 50;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = new Point(0, 50);
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat horizontal', assert => {
        a.xf = 0;
        a.yf = 0;
        b.xf = 100;
        b.yf = 0;
        c.xf = 50;
        c.yf = 0;
        d.xf = 50;
        d.yf = 0;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = new Point(50, 0);
        assert.deepEqual(inter, expect, 'Collinear');
    });
    test('Collinear Flat horizontal reverse', assert => {
        a.xf = 0;
        a.yf = 0;
        b.xf = 100;
        b.yf = 0;
        c.xf = 200;
        c.yf = 0;
        d.xf = 50;
        d.yf = 0;
        const inter = Segment.intersectionFlat(a, b, c, d);
        const expect = new Point(50, 0);
        assert.deepEqual(inter, expect, 'Collinear');
    });
});
QUnit.module('Segment Flat intersection2d', () => {
    const a = new Point(200, 200);
    const b = new Point(0, 0);
    const c = new Point(0, -100);
    const d = new Point(-100, 100);
    test('TEST BUG Flat', assert => {
        const inter = Segment.intersectionFlat(a, b, c, d);
        assert.equal(inter, undefined, 'undefined expected');
        // Check with basic intersection
        const inter2d = Segment.intersection2dBasicFlat(a, b, c, d);
        assert.equal(inter, inter2d, 'En T');
    });
});
QUnit.module('Segment 3D', () => {

    test('Segment 3D closestSegment', assert => {
        let a, b, c, d, e, s;

        // Both segments degenerate into one point 0,0,0 = the Closest segment c is (a,a)
        a = new Vector3(0, 0, 0);
        s = Segment.closestSegment(a, a, a, a);
        assert.deepEqual(s.p, a, "Both segments degenerate to same point");
        assert.deepEqual(s.q, a, "Both segments degenerate to same point");

        // First segment degenerates and second segment degenerates but is distinct
        c = new Vector3(0, -100, 0);
        s = Segment.closestSegment(a, a, c, c);
        assert.deepEqual(s.p, a, "Both segments degenerate to distinct points");
        assert.deepEqual(s.q, c, "First segment degenerate to distinct points");

        // First segment degenerates (0,0,0) and second segment is crossing first segment
        c = new Vector3(0, -100, 0);
        d = new Vector3(0, 100, 0);
        s = Segment.closestSegment(a, a, c, d);
        assert.deepEqual(s.p, a, "First segment degenerate to 1 point, on second segment");
        assert.deepEqual(s.q, a, "First segment degenerate to 1 point, on second segment");

        // First degenerate and second is a distinct line
        c = new Vector3(100, -100, 0);
        d = new Vector3(100, 100, 0);
        e = new Vector3(100, 0, 0); // Closest to  0,0,0
        s = Segment.closestSegment(a, a, c, d);
        assert.deepEqual(s.p, a, "First segment degenerate to 1 point, second segment apart");
        assert.deepEqual(s.q, e, "First segment degenerate to 1 point, second segment apart");

        // First and second are parallel lines
        a = new Vector3(0, -100, 0);
        b = new Vector3(0, 100, 0);
        c = new Vector3(100, -200, 0);
        d = new Vector3(100, 100, 0);
        e = new Vector3(100, -100, 0); // a projected on cd
        s = Segment.closestSegment(a, b, c, d);
        // Should take the first point of ab and project it on cd
        assert.deepEqual(s.p, a, "Parallel segments");
        assert.deepEqual(s.q, e, "Parallel segments");

        // First and second are intersecting lines
        a = new Vector3(100, 0, 0); // vertical on x = 100
        b = new Vector3(100, 400, 0);
        c = new Vector3(0, 0, 0);	// 45° from 0,0 to 200,200
        d = new Vector3(200, 200, 0);
        s = Segment.closestSegment(a, b, c, d);
        assert.deepEqual(s.p, new Vector3(100, 100, 0), "Intersecting segments");
        assert.deepEqual(s.q, new Vector3(100, 100, 0), "Intersecting segments");

        // First and second are non-intersecting segments
        a = new Vector3(100, 0, 0); // vertical x=100 y[0,100]
        b = new Vector3(100, 100, 0);
        c = new Vector3(0, 200, 0); // horizontal y=200 x[0,200]
        d = new Vector3(200, 200, 0);
        s = Segment.closestSegment(a, b, c, d);
        assert.deepEqual(s.p, new Vector3(100, 100, 0), "Non intersecting segments on same plane");
        assert.deepEqual(s.q, new Vector3(100, 200, 0), "Non intersecting segments on same plane");

        // First and second are non-intersecting lines in 3D
        a = new Vector3(0, 0, 100); // diagonal on back side of cube
        b = new Vector3(100, 100, 100);
        c = new Vector3(0, 100, 0); // diagonal on front side of cube
        d = new Vector3(100, 0, 0);
        s = Segment.closestSegment(a, b, c, d); // line between middle of front face to middle of back face
        assert.deepEqual(s.p, new Vector3(50, 50, 100), "Non intersecting segments in 3D");
        assert.deepEqual(s.q, new Vector3(50, 50, 0), "Non intersecting segments in 3D");
    });

    test('Segment 3D distanceToSegment', assert => {
        let a, b, c, d, e;

        // Both segments degenerate into one point 0,0,0 = the Closest segment c is (a,a)
        a = new Vector3(0, 0, 0);
        d = Segment.distanceToSegment(a, a, a, a);
        assert.deepEqual(d, 0, "Both segments degenerate to same point");

        // First segment degenerates and second segment degenerates but is distinct
        c = new Vector3(0, -100, 0);
        e = Segment.distanceToSegment(a, a, c, c);
        assert.deepEqual(e, 100, "Both segments degenerate to distinct points");

        // First segment degenerates (0,0,0) and second segment is crossing first segment
        c = new Vector3(0, -100, 0);
        d = new Vector3(0, 100, 0);
        e = Segment.distanceToSegment(a, a, c, d);
        assert.deepEqual(e, 0, "First segment degenerate to 1 point, on second segment");

        // First degenerate and second is a distinct line
        c = new Vector3(100, -100, 0);
        d = new Vector3(100, 100, 0);
        e = Segment.distanceToSegment(a, a, c, d);
        assert.deepEqual(e, 100, "First segment degenerate to 1 point, second segment apart");

        // First and second are parallel lines
        a = new Vector3(0, -100, 0);
        b = new Vector3(0, 100, 0);
        c = new Vector3(100, -200, 0);
        d = new Vector3(100, 100, 0);
        e = Segment.distanceToSegment(a, b, c, d);
        // Should take the first point of ab and project it on cd
        assert.deepEqual(e, 100, "Parallel segments");

        // First and second are intersecting lines
        a = new Vector3(100, 0, 0); // vertical on x = 100
        b = new Vector3(100, 400, 0);
        c = new Vector3(0, 0, 0);	// 45° from 0,0 to 200,200
        d = new Vector3(200, 200, 0);
        e = Segment.distanceToSegment(a, b, c, d);
        assert.deepEqual(e, 0, "Intersecting segments");

        // First and second are non-intersecting segments
        a = new Vector3(100, 0, 0); // vertical x=100 y[0,100]
        b = new Vector3(100, 100, 0);
        c = new Vector3(0, 200, 0); // horizontal y=200 x[0,200]
        d = new Vector3(200, 200, 0);
        e = Segment.distanceToSegment(a, b, c, d);
        assert.deepEqual(e, 100, "Non intersecting segments on same plane");

        // First and second are non-intersecting lines in 3D
        a = new Vector3(0, 0, 100); // diagonal on back side of cube
        b = new Vector3(100, 100, 100);
        c = new Vector3(0, 100, 0); // diagonal on front side of cube
        d = new Vector3(100, 0, 0);
        e = Segment.distanceToSegment(a, b, c, d); // line between middle of front face to middle of back face
        assert.deepEqual(e, 100, "Non intersecting segments in 3D");

        // Real point
        a = new Vector3(200, 200, 0);
        b = new Vector3(200, -200, 0);
        c = new Vector3(0, 0, 700);
        d = new Vector3(50, 50, 526);
        d = Vector3.scale(Vector3.sub(d, c), 1000);
        e = Segment.distanceToSegment(a, b, c, d);
        e = e < 1 ? 0 : e;
        assert.deepEqual(e, 0, "Non intersecting segments in 3D");
    });
});
// 362
