import {Model} from '../js/Model.js';
import {Plane} from '../js/Plane.js';
import {Point} from '../js/Point.js';
import {Segment} from '../js/Segment.js';

const {test} = QUnit;

QUnit.module('Model', hooks => {
    let model;

    hooks.before(function () {
        // Runs once before all tests in the module
        model = new Model();
    });

    hooks.beforeEach(function () {
        // Runs once before each test in the module
        model.init(-200, -200, 200, 200);
    });

    test('init', assert => {
        assert.equal(model.points.length, 4, '4 points');
        assert.equal(model.segments.length, 4, '4 segments');
        assert.equal(model.faces.length, 1, '1 face');
    });

    // Serialize / Deserialize
    test('serialize / deserialize', assert => {
        // Serialize
        let serialized = model.serialize();
        assert.equal(serialized.length, 491, "serialized model should have length 491");

        // Change model, should not affect serialized
        model.addPoint(0, 0, 0, 0, 0);
        model.addSegment(model.points[0], model.points[1]);
        model.addFace([model.points[2], model.points[3]]);

        // Deserialize
        Object.assign(model, model.deserialize(serialized));
        assert.equal(model.points.length, 4, "deserialized should have 4 points");
        assert.equal(model.segments.length, 4, "deserialized should have 4 segments");
        assert.equal(model.faces.length, 1, "deserialized should have 1 face");
    });

    test('hover2d3d', assert => {
        // Hover on point, segment and face
        model.hover2d3d([model.points[0]], [], []);
        assert.equal(model.points[0].hover, true, 'First point hovered');
        assert.equal(model.segments.some(s => s.hover !== false), false, 'No segment hovered');
        assert.equal(model.faces.some(f => f.hover !== false), false, 'No face hovered');
        model.hover2d3d([], [model.segments[0]], []);
        assert.equal(model.points.some(p => p.hover !== false), false, 'No point hovered');
        assert.equal(model.segments[0].hover, true, 'First segment hovered');
        assert.equal(model.faces.some(f => f.hover !== false), false, 'No face hovered');
        model.hover2d3d([], [], [model.faces[0]]);
        assert.equal(model.points.some(p => p.hover !== false), false, 'No point hovered');
        assert.equal(model.segments.some(s => s.hover !== false), false, 'No segment hovered');
        assert.equal(model.faces[0].hover, true, 'First face hovered');
    });

    test('click2d3d', assert => {
        // Click on point, segment and face
        model.click2d3d([model.points[0]], [], []);
        assert.equal(model.points[0].select, 1, 'First point selected');
        model.click2d3d([model.points[0]], [], []);
        assert.equal(model.points[0].select, 2, 'First point double selected');
        model.click2d3d([], [model.segments[0]], []);
        assert.equal(model.segments[0].select, 1, 'First segment selected');
        model.click2d3d([], [model.segments[0]], []);
        assert.equal(model.segments[0].select, 2, 'First segment double selected');
        model.click2d3d([], [], [model.faces[0]]);
        assert.equal(model.faces[0].select, 1, 'First face selected');
        model.click2d3d([], [], [model.faces[0]]);
        assert.equal(model.faces[0].select, 2, 'First face double selected');
    });

    test('indexOf', assert => {
        assert.equal(model.indexOf(model.points[0]), 0, 'First point');
        assert.equal(model.indexOf(model.segments[0]), 0, 'First segment');
        assert.equal(model.indexOf(model.faces[0]), 0, 'First face');
    });

    test('addPoint', assert => {
        let p = model.points[0];
        // Should not create a new point, but return existing point.
        const p1 = model.addPoint(p.xf, p.yf, p.x, p.y, p.z);
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(p, p1, 'Point should be the same');
        // Should add and return new point
        const p2 = model.addPoint(0, 0, 0, 0, 0);
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.points[4], p2, 'Model should have the new point');
    });

    test('addSegment', assert => {
        const s0 = model.segments[0];
        // Should not create a new segment, but return existing segment.
        let s = model.addSegment(s0.p1, s0.p2);
        assert.equal(model.segments.length, 4, 'Model should have 4 segments');
        assert.equal(model.segments[0], s, 'Model first segment should be added segment');
        // Should add new segment with 2 points
        s = model.addSegment(model.points[0], model.points[2]);
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
        assert.equal(model.segments[4], s, 'Model should have the new segment');
    });

    test('addFace', assert => {
        const f0 = model.faces[0];
        // Should not create a new face, but return existing face.
        let face = model.addFace(f0.points);
        assert.equal(model.faces.length, 1, 'Model should have 1 face');
        assert.equal(model.faces[0], face, 'Model first face should be added face');
        // Should add new face with 3 first points
        model.addFace([f0.points[0], f0.points[1], f0.points[2]]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });

    test('searchSegment3d', assert => {
        const s0 = model.segments[0];
        // Should find first segment.
        let segment = model.getSegment(s0.p1, s0.p2);
        assert.equal(model.segments[0], segment, 'Model first segment should be found');
        // Should find first segment.
        segment = model.getSegment(model.points[0], model.points[3]);
        assert.equal(model.segments[3], segment, 'Model third segment should be found');
        // Should not find any segment
        segment = model.getSegment(model.points[0], model.points[2]);
        assert.equal(segment, undefined, 'Model should not have segment 0 2');
    });

    test('searchFacesWithAB', assert => {
        // Should find first face.
        let faces = model.searchFacesWithAB(model.points[0], model.points[1]);
        assert.equal(faces.length, 1, 'Model first face should be found');
        assert.equal(faces[0], model.faces[0], 'Model first face should be found');
        // Should find in reserve order.
        faces = model.searchFacesWithAB(model.points[1], model.points[0]);
        assert.equal(faces.length, 1, 'Model first face should be found');
        assert.equal(faces[0], model.faces[0], 'Model first face should be found');
        // Should find from last to first.
        faces = model.searchFacesWithAB(model.points[3], model.points[0]);
        assert.equal(faces.length, 1, 'Model first face should be found');
        assert.equal(faces[0], model.faces[0], 'Model first face should be found');
        // Should not find any face ?
        // faces = model.searchFacesWithAB(model.points[0], model.points[2]);
        //     assert.equal(faces.length, 0, 'Face should not be found');
    });

    test('splitFaceByPlane3d rotated', assert => {
        let plane = Plane.by(model.points[1], model.points[3]);
        model.splitAllFacesByPlane3d(plane);
        assert.equal(model.faces.length, 2, 'model should have 2 faces');
        assert.equal(model.segments.length, 5, 'model should have 5 segments');

        const pt = model.points[2];
        const s = model.getSegment(model.points[1], model.points[3]);
        model.rotate(s, 180.0, [pt]);

        plane = Plane.across(model.points[1], model.points[3]);
        model.splitAllFacesByPlane3d(plane);
        assert.equal(model.faces.length, 4, 'model should have 4 faces');
    });

    // Origami
    test('splitFaceByPlane3d on side', assert => {
        // Plane by [0] [1] bottom segment
        const plane = Plane.by(model.points[0], model.points[1]);
        const face = model.faces[0];
        model.splitFaceByPlane3d(face, plane);
        assert.equal(model.faces.length, 1, 'Split on side should not add any face');
    });

    test('splitFaceByPlane3d diagonal', assert => {
        // Plane by [0] [2] diagonal
        const plane = Plane.by(model.points[0], model.points[2]);
        const face = model.faces[0];
        model.splitFaceByPlane3d(face, plane);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
        assert.equal(model.faces[0].points.length, 3, 'Face 0 should have 3 points');
        assert.equal(model.faces[1].points.length, 3, 'Face 1 should have 3 points');
    });

    test('splitFaceByPlane3d diagonal on triangle', assert => {
        // Plane across [0] [2] diagonal on triangle
        const plane = Plane.across(model.points[0], model.points[2]);
        const face = model.faces[0];
        model.splitFaceByPlane3d(face, plane);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
        assert.equal(model.faces[0].points.length, 3, 'Face 0 should have 3 points');
        assert.equal(model.faces[1].points.length, 3, 'Face 1 should have 3 points');
    });

    test('splitFaceByPlane3d', assert => {
        // Plane across [0] [1]
        let plane = Plane.across(model.points[0], model.points[1]);
        let face = model.faces[0];
        assert.equal(model.faces.length, 1, 'Model should have 1 face');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(model.segments.length, 4, 'Model should have 4 segments');

        model.splitFaceByPlane3d(face, plane);

        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 6, 'Model should have 6 points');
        assert.equal(model.segments.length, 7, 'Model should have 7 segments');
    });

    test('splitAllFacesByPlane3d two diagonals', (assert) => {
        // Diagonal Split 0,2
        let plane = Plane.by(model.points[0], model.points[2]);
        model.splitAllFacesByPlane3d(plane);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
        assert.equal(model.faces[0].points.length, 3, 'Face 0 should have 3 points');
        assert.equal(model.faces[1].points.length, 3, 'Face 1 should have 3 points');
        // Diagonal Split 1,3
        plane = Plane.by(model.points[1], model.points[3]);
        model.splitAllFacesByPlane3d(plane);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.segments.length, 8, 'Model should have 8 segments');
    });

    test('splitAllFacesByPlane two other diagonals', (assert) => {
        // Diagonal Split 3,1
        let plane = Plane.by(model.points[3], model.points[1]);
        model.splitAllFacesByPlane3d(plane);
        // Diagonal Split 0,2
        plane = Plane.by(model.points[0], model.points[2]);
        model.splitAllFacesByPlane3d(plane);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.segments.length, 8, 'Model should have 8 segments');
    });

    test('splitCross3d', (assert) => {
        // Plane crossing X=0 => 2 faces, and 2 intersections
        model.splitCross3d(model.points[0], model.points[1]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 6, 'Model should have 6 points');
        assert.equal(model.segments.length, 7, 'Model should have 7 segments');
        // Plane crossing Y=0 => 4 faces, and 3 intersections
        model.splitCross3d(model.points[1], model.points[2]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 9, 'Model should have 9 points');
        assert.equal(model.segments.length, 12, 'Model should have 12 segments');
    });

    test('splitCross3d', (assert) => {
        // Plane on YZ crossing X=0 => 2 faces, plus 2 intersections
        model.splitCross3d(model.points[0], model.points[1]);
        model.splitCross3d(model.points[0], model.points[3]);
        model.splitCross3d(model.points[0], model.points[2]);
        model.splitCross3d(model.points[1], model.points[3]);
        model.splitCross3d(model.points[0], model.points[8]);
        assert.equal(model.faces.length, 12, 'Model should have 12 faces');
        assert.equal(model.points.length, 14, 'Model should have 14 points');
        assert.equal(model.segments.length, 25, 'Model should have 25 segments');
    });

    test('splitCross2d', (assert) => {
        // Plane on YZ crossing X=0 => 2 faces, plus 2 intersections
        // d -200 -200 200 -200 200 200 -200 200; c2d 0 1;
        model.splitCross2d(model.points[0], model.points[1]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 6, 'Model should have 6 points');
        assert.equal(model.segments.length, 7, 'Model should have 7 segments');
        assert.equal(model.points[4].y, -200, 'Point 4 should be at y=-200');
        assert.equal(model.points[5].y, 200, 'Point 4 should be at y=200');

        // Same should not modify anything
        model.splitCross2d(model.points[0], model.points[1]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 6, 'Model should have 6 points');
        assert.equal(model.segments.length, 7, 'Model should have 7 segments');
        assert.equal(model.points[4].y, -200, 'Point 4 should be at y=-200');
        assert.equal(model.points[5].y, 200, 'Point 4 should be at y=200');

        model.splitCross2d(model.points[0], model.points[3]);
        model.splitCross2d(model.points[0], model.points[2]);
        model.splitCross2d(model.points[1], model.points[3]);
        assert.equal(model.faces.length, 8, 'Model should have 8 faces');
    });

    test('splitBy3d', (assert) => {
        // On edge
        model.splitBy3d(model.points[0], model.points[1]);
        assert.equal(model.faces.length, 1, 'Model should have 1 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        // On diagonal
        model.splitBy3d(model.points[0], model.points[2]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        // On other diagonal
        model.splitBy3d(model.points[1], model.points[3]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
    });

    test('splitBy2d', (assert) => {
        // On edge by_2d 0 1 by_2d 0 2 by_2d 1 3
        model.splitBy2d(model.points[1], model.points[2]);
        assert.equal(model.faces.length, 1, 'Model should have 1 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        // On diagonal
        model.splitBy2d(model.points[0], model.points[2]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.faces[0].points.length, 3, 'Face should have 3 points');
        assert.equal(model.faces[1].points.length, 3, 'Face should have 3 points');
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        // On other diagonal
        model.splitBy2d(model.points[1], model.points[3]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
    });

    test('splitBy2d', (assert) => {
        // Double cross
        model.splitCross2d(model.points[0], model.points[1]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 6, 'Model should have 6 points');
        model.splitCross2d(model.points[1], model.points[2]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 9, 'Model should have 9 points');

        // By center 7 2 OK
        model.splitBy2d(model.points[7], model.points[2]);
        console.log('7 2 OK');
        assert.equal(model.faces.length, 5, 'Model should have 5 faces');

        // By center 7 2 OK
        model.splitBy2d(model.points[7], model.points[2]);
        console.log('7 2 OK second');
        assert.equal(model.faces.length, 5, 'Model should have 5 faces');

        // By center 2 7 OK
        model.splitBy2d(model.points[2], model.points[7]);
        assert.equal(model.faces.length, 5, 'Model should have 5 faces');
    });

    test('splitPerpendicular', (assert) => {
        // On edge
        model.splitPerpendicular(model.segments[0], model.points[2]);
        assert.equal(model.faces.length, 1, 'Model should have 1 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        // Add center
        let p = model.addPoint(0, 0, 0, 0, 0);
        // Split perpendicular to edge by center
        model.splitPerpendicular(model.segments[0], p);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 7, 'Model should have 7 points');
    });

    test('bisector2d', (assert) => {
        model.bisector2d(model.segments[0], model.segments[1]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        model.bisector2d(model.segments[0], model.segments[2]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 7, 'Model should have 7 points');
    });

    test('bisector3dPoints', (assert) => {
        model.bisector3dPoints(model.points[0], model.points[1], model.points[2]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
    });

    test('bisector2dPoints', (assert) => {
        model.bisector2dPoints(model.points[0], model.points[1], model.points[2]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
    });

    test('bisector3d', (assert) => {
        // From bottom to right (crossing lines) gives 2 triangles
        model.bisector3d(model.points[0], model.points[1], model.points[1], model.points[2]);
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');

        // From left to right (parallel lines) the 2 faces are split to 4 faces
        model.bisector3d(model.points[0], model.points[3], model.points[2], model.points[1]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 7, 'Model should have 7 points');

        // From left to right (parallel lines) the 4 faces are unchanged
        model.bisector3d(model.points[0], model.points[3], model.points[2], model.points[1]);
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 7, 'Model should have 7 points');
    });

    test('rotate', (assert) => {
        // Rotate around diagonal [1][3], by 90°, point [2]
        let pt = model.points[2];
        let s = model.addSegment(model.points[1], model.points[3]);
        model.rotate(s, -90.0, [pt]);
        // after
        assert.equal(Math.round(pt.x), 0, 'Got:' + pt.x);
        assert.equal(Math.round(pt.y), 0, 'Got:' + pt.y);
        assert.equal(Math.round(pt.z), Math.round(Math.sqrt(200 * 200 + 200 * 200)), 'Got:' + pt.z);
        // Should not move
        pt = model.points[1];
        assert.equal(Math.round(pt.x), 200, 'Got:' + pt.x);
        assert.equal(Math.round(pt.y), -200, 'Got:' + pt.y);
        assert.equal(Math.round(pt.z), 0, 'Got:' + pt.z);

        // Rotate with axe bottom edge [0,1] by 90 points 0,2
        model = new Model().init(-200, -200, 200, 200);
        s = model.getSegment(model.points[0], model.points[1]); // bottom segment 0
        assert.equal(Math.round(pt.x), 200, 'got:' + pt.x);
        assert.equal(Math.round(pt.y), -200, 'got:' + pt.y);
        assert.equal(Math.round(pt.z), 0, 'got:' + pt.z);
        model.rotate(s, 90.0, [model.points[2], model.points[3]]);
        pt = model.points[2]; // 200, 200, 0 axe 1, 0, 0 => 200, -200, 400
        assert.equal(Math.round(pt.x), 200, 'got:' + pt.x);
        assert.equal(Math.round(pt.y), -200, 'got:' + pt.y);
        assert.equal(Math.round(pt.z), 400, 'got:' + pt.z);
        // Should not move
        pt = model.points[0];
        assert.equal(Math.round(pt.x), -200, 'got:' + pt.x);
        assert.equal(Math.round(pt.y), -200, 'got:' + pt.y);
        assert.equal(Math.round(pt.z), 0, 'got:' + pt.z);
    });

    test('rotate', (assert) => {
        let point = model.points[2];
        // before
        assert.equal(point.x, 200);
        assert.equal(point.y, 200);
        assert.equal(point.z, 0);
        // Turn model around x, by 90°
        model.rotate(new Segment(new Point(-1, 0, -1, 0, 0), new Point(1, 0, 1, 0, 0), 0), 90.0);
        // after
        assert.equal(Math.round(point.x), 200, 'Got:' + point.x);
        assert.equal(Math.round(point.y), 0, 'Got:' + point.y);
        assert.equal(Math.round(point.z), 200, 'Got:' + point.z);
    });

    // Adjust
    test('Adjust', (assert) => {
        let p = model.points[0];
        let s = model.segments[0];
        p.x = -100; // arbitrary move
        // Adjust one point on all segments
        let max = model.adjust(p);
        assert.equal(Math.round(p.x), -200, 'Got:' + p.x);
        assert.equal(max < 0.01, true, 'Got:' + max);
        p.x = -400; // arbitrary move
        // Adjust one point on list of segments
        max = model.adjust(p, [s]);
        assert.equal(Math.round(p.x), -200, 'Got:' + p.x);
        assert.equal(max < 0.01, true, 'Got:' + max);
    });

    // Adjust list
    test('Adjust List', (assert) => {
        let p0 = model.points[0];
        let p1 = model.points[1];
        p0.x = -100;
        // Adjust multiple points on all segments
        let max = model.adjustList([p0, p1]);
        assert.equal(Math.round(p0.x), -200, 'Expect -200 Got' + p0.x);
        assert.equal(max < 0.01, true, 'Expect max < 0.01 Got' + max);
    });

    // Move
    test('Move List', (assert) => {
        let p0 = model.points[0];
        let p1 = model.points[1];
        // Move 2 points by dx=1, dy=2, dz=3
        model.move(1, 2, 3, [p0, p1]);
        assert.equal(Math.round(p0.x), -199, 'Got:' + p0.x);
        assert.equal(Math.round(p0.y), -198, 'Got:' + p0.y);
        assert.equal(Math.round(p0.z), 3, 'Got:' + p0.z);
        // Move all points by 1,2,3
        model.move(1, 2, 3, model.points);
        assert.equal(Math.round(p0.x), -198, 'Got:' + p0.x);
        assert.equal(Math.round(p0.y), -196, 'Got:' + p0.y);
        assert.equal(Math.round(p0.z), 6, 'Got:' + p0.z);
    });

    // Move On
    test('Move on List', function (assert) {
        let p0 = model.points[0];
        let p1 = model.points[1];
        // Move on p0 points p1
        model.moveOn(p0, 0, 1, [p1]);
        assert.equal(Math.round(p1.x), 200, 'Got:' + p1.x);
        assert.equal(Math.round(p1.y), -200, 'Got:' + p1.y);
        assert.equal(Math.round(p1.z), 0, 'Got:' + p1.z);
        model.moveOn(p0, 1, 0, [p1]);
        assert.equal(Math.round(p1.x), -200, 'Got:' + p1.x);
        assert.equal(Math.round(p1.y), -200, 'Got:' + p1.y);
        assert.equal(Math.round(p1.z), 0, 'Got:' + p1.z);
    });

    // Split Segment on point
    test('Split Segment On Point 2d', function (assert) {
        let s = model.segments[0];
        let p = {xf: 0, yf:-200};
        model.splitSegmentOnPoint2d(s, p);
        assert.equal(model.faces.length, 1, 'Model should have 1 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });

    // Split Segment by ratio
    test('Split Segment by ratio 2d', function (assert) {
        let s = model.segments[0];
        let k = 1/2;
        model.splitSegmentByRatio2d(s, k);
        assert.equal(model.faces.length, 1, 'Model should have 1 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });


    // Flat
    test('Flat', function (assert) {
        let p0 = model.points[0];
        let p1 = model.points[1];
        model.move(0, 0, 3, [p0, p1]);

        // Move flat points p0 p1
        model.flat([p1]);
        assert.equal(Math.round(p1.x), 200, 'Got:' + p1.x);
        assert.equal(Math.round(p1.y), -200, 'Got:' + p1.y);
        assert.equal(Math.round(p1.z), 0, 'Got:' + p1.z);
        model.move(0, 0, 3, [p0, p1]);
        model.flat();
        assert.equal(Math.round(p1.x), 200, 'Got:' + p1.x);
        assert.equal(Math.round(p1.y), -200, 'Got:' + p1.y);
        assert.equal(Math.round(p1.z), 0, 'Got:' + p1.z);
    });

    // Turn
    test('Turn', function (assert) {
        let p = model.points[0];
        assert.equal(p.x, -200, 'Got' + p.x);
        assert.equal(p.y, -200, 'Got' + p.y);

        let axis = new Segment(new Point(0, 0), new Point(0, 0, 1, 0, 0));
        model.turn(axis, 180);
        assert.equal(p.x, -200, 'Got' + p.x);
        assert.equal(Math.round(p.y), 200, 'Got' + p.y);

        axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 1, 0));
        model.turn(axis, 180);
        assert.equal(Math.round(p.x), 200, 'Got ' + p.x);
        assert.equal(Math.round(p.y), 200, 'Got ' + p.y);

        axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 0, 1));
        model.turn(axis, 180);
        assert.equal(Math.round(p.x), -200, 'Got' + p.x);
        assert.equal(Math.round(p.y), -200, 'Got' + p.y);
    });

    // Offset
    test('Offset', function (assert) {
        model.splitCross3d(model.points[0], model.points[2]);
        model.offset(42, [model.faces[0]]);
        assert.equal(model.faces[0].offset, 42, 'Got:' + model.faces[0].offset);
        assert.equal(model.faces[1].offset, 0, 'Got:' + model.faces[1].offset);
    });

    // get2DBounds
    test('get2DBounds', function (assert) {
        let bounds = model.get2DBounds();
        assert.equal(bounds.xMin, -200, 'Got:' + bounds.xMin);
        assert.equal(bounds.xMax, 200, 'Got:' + bounds.xMax);
        assert.equal(bounds.yMin, -200, 'Got:' + bounds.yMin);
        assert.equal(bounds.yMax, 200, 'Got:' + bounds.yMax);
    });

    // get3DBounds
    test('get3DBounds', function (assert) {
        let bounds = model.get3DBounds();
        assert.equal(bounds.xMin, -200, 'Got:' + bounds.xMin);
        assert.equal(bounds.xMax, 200, 'Got:' + bounds.xMax);
        assert.equal(bounds.yMin, -200, 'Got:' + bounds.yMin);
        assert.equal(bounds.yMax, 200, 'Got:' + bounds.yMax);
    });

    // ScaleModel
    test('scaleModel', function (assert) {
        let p0 = model.points[0];
        model.scaleModel(4);
        assert.equal(p0.x, -800, 'Got:' + p0.x);
        assert.equal(p0.y, -800, 'Got:' + p0.y);
        assert.equal(p0.z, 0, 'Got:' + p0.z);
    });

    // Test rotate
    test('Rotate', function (assert) {
        model.splitBy3d(model.points[3], model.points[1])
        model.rotate(model.segments[4], -180, [model.points[2]]);
        model.splitCross3d(model.points[3], model.points[1]);
        assert.equal(model.segments.length, 8, 'Got:' + model.segments.length);
        assert.equal(model.faces[0].points.length, 3, 'Got:' + model.faces[0].points.length);
    });
});
