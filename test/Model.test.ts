import {Model} from '../js/Model.js';
import {Plane} from '../js/Plane.js';
import {Point} from '../js/Point.js';
import {Segment} from '../js/Segment.js';
import {assertEquals} from "jsr:@std/assert";

Deno.test("Model init serialize", async (t) => {
    await t.step("init", () => {
        const model = new Model().init(-200, -200, 200, 200);
        assertEquals(model.points.length, 4, '4 points');
        assertEquals(model.segments.length, 4, '4 segments');
        assertEquals(model.faces.length, 1, '1 face');
    });
    await t.step("serialize / deserialize", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Serialize
        const serialized = model.serialize();
        assertEquals(serialized.length, 491, "serialized model should have length 491");

        // Change model, should not affect serialized
        model.addPoint(0, 0, 0, 0, 0);
        model.addSegment(model.points[0], model.points[1]);
        model.addFace([model.points[2], model.points[3]]);

        // Deserialize
        Object.assign(model, model.deserialize(serialized));
        assertEquals(model.points.length, 4, "deserialized should have 4 points");
        assertEquals(model.segments.length, 4, "deserialized should have 4 segments");
        assertEquals(model.faces.length, 1, "deserialized   should have 1 face");
    });
});

Deno.test("Model hover2d3d click2d3d", async (t) => {
    await t.step("hover2d3d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Hover on point, segment and face
        model.hover2d3d([model.points[0]], [], []);
        assertEquals(model.points[0].hover, true, 'First point hovered');
        assertEquals(model.segments.some(s => s.hover !== false), false, 'No segment hovered');
        assertEquals(model.faces.some(f => f.hover !== false), false, 'No face hovered');
        model.hover2d3d([], [model.segments[0]], []);
        assertEquals(model.points.some(p => p.hover !== false), false, 'No point hovered');
        assertEquals(model.segments[0].hover, true, 'First segment hovered');
        assertEquals(model.faces.some(f => f.hover !== false), false, 'No face hovered');
        model.hover2d3d([], [], [model.faces[0]]);
        assertEquals(model.points.some(p => p.hover !== false), false, 'No point hovered');
        assertEquals(model.segments.some(s => s.hover !== false), false, 'No segment hovered');
        assertEquals(model.faces[0].hover, true, 'First face hovered');
    });
    await t.step("click2d3d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Click on point, segment and face
        model.click2d3d([model.points[0]], [], []);
        assertEquals(model.points[0].select, 1, 'First point selected');
        model.click2d3d([model.points[0]], [], []);
        assertEquals(model.points[0].select, 2, 'First point double selected');
        model.click2d3d([], [model.segments[0]], []);
        assertEquals(model.segments[0].select, 1, 'First segment selected');
        model.click2d3d([], [model.segments[0]], []);
        assertEquals(model.segments[0].select, 2, 'First segment double selected');
        model.click2d3d([], [], [model.faces[0]]);
        assertEquals(model.faces[0].select, 1, 'First face selected');
        model.click2d3d([], [], [model.faces[0]]);
        assertEquals(model.faces[0].select, 2, 'First face double selected');
    });
});

Deno.test("Model indexOf addPoint addSegment addFace", async (t) => {
    await t.step("indexOf", () => {
        const model = new Model().init(-200, -200, 200, 200);
        assertEquals(model.indexOf(model.points[0]), 0, 'First point');
        assertEquals(model.indexOf(model.segments[0]), 0, 'First segment');
        assertEquals(model.indexOf(model.faces[0]), 0, 'First face');
    });
    await t.step("addPoint", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p = model.points[0];
        // Should not create a new point, but return existing point.
        const p1 = model.addPoint(p.xf, p.yf, p.x, p.y, p.z);
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        assertEquals(p, p1, 'Point should be the same');
        // Should add and return new point
        const p2 = model.addPoint(0, 0, 0, 0, 0);
        assertEquals(model.points.length, 5, 'Model should have 5 points');
        assertEquals(model.points[4], p2, 'Model should have the new point');
    });
    await t.step("addSegment", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const s0 = model.segments[0];
        // Should not create a new segment, but return existing segment.
        let s = model.addSegment(s0.p1, s0.p2);
        assertEquals(model.segments.length, 4, 'Model should have 4 segments');
        assertEquals(model.segments[0], s, 'Model first segment should be added segment');
        // Should add new segment with 2 points
        s = model.addSegment(model.points[0], model.points[2]);
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
        assertEquals(model.segments[4], s, 'Model should have the new segment');
    });
    await t.step("addFace", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const f0 = model.faces[0];
        // Should not create a new face, but return existing face.
        const face = model.addFace(f0.points);
        assertEquals(model.faces.length, 1, 'Model should have 1 face');
        assertEquals(model.faces[0], face, 'Model first face should be added face');
        // Should add new face with 3 first points
        model.addFace([f0.points[0], f0.points[1], f0.points[2]]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
    });
});

Deno.test("Model searchSegment3d searchFacesWithAB", async (t) => {
    await t.step("searchSegment3d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const s0 = model.segments[0];
        // Should find first segment.
        let segment = model.getSegment(s0.p1, s0.p2);
        assertEquals(model.segments[0], segment, 'Model first segment should be found');
        // Should find first segment.
        segment = model.getSegment(model.points[0], model.points[3]);
        assertEquals(model.segments[3], segment, 'Model third segment should be found');
        // Should not find any segment
        segment = model.getSegment(model.points[0], model.points[2]);
        assertEquals(segment, undefined, 'Model should not have segment 0 2');
    });
    await t.step("searchFacesWithAB", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Should find first face.
        const faces = model.searchFacesWithAB(model.points[1], model.points[0]);
        assertEquals(faces.length, 1, 'Model first face should be found');
        assertEquals(faces[0], model.faces[0], 'Model first face should be found');
    });
});

Deno.test("Model splitFaceByPlane3d splitAllFacesByPlane3d splitCross3d", async (t) => {
    await t.step("splitFaceByPlane3d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        let plane = Plane.by(model.points[1], model.points[3]);
        model.splitAllFacesByPlane3d(plane);
        assertEquals(model.faces.length, 2, 'model should have 2 faces');
        assertEquals(model.segments.length, 5, 'model should have 5 segments');

        const pt = model.points[2];
        const s = model.getSegment(model.points[1], model.points[3]);
        model.rotate(s, 180.0, [pt]);

        plane = Plane.across(model.points[1], model.points[3]);
        model.splitAllFacesByPlane3d(plane);
        assertEquals(model.faces.length, 4, 'model should have 4 faces');
    });
    await t.step("splitFaceByPlane3d on side", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Plane by [0] [1] bottom segment
        const plane = Plane.by(model.points[0], model.points[1]);
        const face = model.faces[0];
        model.splitFaceByPlane3d(face, plane);
        assertEquals(model.faces.length, 1, 'Split on side should not add any face');
    });
    await t.step("splitFaceByPlane3d on diagonal", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Plane by [0] [2] diagonal
        const plane = Plane.by(model.points[0], model.points[2]);
        const face = model.faces[0];
        model.splitFaceByPlane3d(face, plane);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
        assertEquals(model.faces[0].points.length, 3, 'Face 0 should have 3 points');
        assertEquals(model.faces[1].points.length, 3, 'Face 1 should have 3 points');
    });
    await t.step("splitFaceByPlane3d diagonal on triangle", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Plane across [0] [2] diagonal on triangle
        const plane = Plane.across(model.points[0], model.points[2]);
        const face = model.faces[0];
        model.splitFaceByPlane3d(face, plane);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
        assertEquals(model.faces[0].points.length, 3, 'Face 0 should have 3 points');
        assertEquals(model.faces[1].points.length, 3, 'Face 1 should have 3 points');
    });
    await t.step("splitAllFacesByPlane3d two diagonals", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Diagonal Split 0,2
        let plane = Plane.by(model.points[0], model.points[2]);
        model.splitAllFacesByPlane3d(plane);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
        assertEquals(model.faces[0].points.length, 3, 'Face 0 should have 3 points');
        assertEquals(model.faces[1].points.length, 3, 'Face 1 should have 3 points');
        // Diagonal Split 1,3
        plane = Plane.by(model.points[1], model.points[3]);
        model.splitAllFacesByPlane3d(plane);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 5, 'Model should have 5 points');
        assertEquals(model.segments.length, 8, 'Model should have 8 segments');
    });
    await t.step("splitAllFacesByPlane two other diagonals", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Diagonal Split 3,1
        let plane = Plane.by(model.points[3], model.points[1]);
        model.splitAllFacesByPlane3d(plane);
        // Diagonal Split 0,2
        plane = Plane.by(model.points[0], model.points[2]);
        model.splitAllFacesByPlane3d(plane);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 5, 'Model should have 5 points');
        assertEquals(model.segments.length, 8, 'Model should have 8 segments');
    });
    await t.step("splitCross3d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Plane crossing X=0 => 2 faces, and 2 intersections
        model.splitCross3d(model.points[0], model.points[1]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 6, 'Model should have 6 points');
        assertEquals(model.segments.length, 7, 'Model should have 7 segments');
        // Plane crossing Y=0 => 4 faces, and 3 intersections
        model.splitCross3d(model.points[1], model.points[2]);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 9, 'Model should have 9 points');
        assertEquals(model.segments.length, 12, 'Model should have 12 segments');
    });
    await t.step("splitCross3d on diagonal", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Plane on YZ crossing X=0 => 2 faces, plus 2 intersections
        model.splitCross3d(model.points[0], model.points[1]);
        model.splitCross3d(model.points[0], model.points[3]);
        model.splitCross3d(model.points[0], model.points[2]);
        model.splitCross3d(model.points[1], model.points[3]);
        model.splitCross3d(model.points[0], model.points[8]);
        assertEquals(model.faces.length, 12, 'Model should have 12 faces');
        assertEquals(model.points.length, 14, 'Model should have 14 points');
        assertEquals(model.segments.length, 25, 'Model should have 25 segments');
    });
    await t.step("splitCross2d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Plane on YZ crossing X=0 => 2 faces, plus 2 intersections
        // d -200 -200 200 -200 200 200 -200 200; c2d 0 1;
        model.splitCross2d(model.points[0], model.points[1]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 6, 'Model should have 6 points');
        assertEquals(model.segments.length, 7, 'Model should have 7 segments');
        assertEquals(model.points[4].y, -200, 'Point 4 should be at y=-200');
        assertEquals(model.points[5].y, 200, 'Point 4 should be at y=200');

        // Same should not modify anything
        model.splitCross2d(model.points[0], model.points[1]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 6, 'Model should have 6 points');
        assertEquals(model.segments.length, 7, 'Model should have 7 segments');
        assertEquals(model.points[4].y, -200, 'Point 4 should be at y=-200');
        assertEquals(model.points[5].y, 200, 'Point 4 should be at y=200');

        model.splitCross2d(model.points[0], model.points[3]);
        model.splitCross2d(model.points[0], model.points[2]);
        model.splitCross2d(model.points[1], model.points[3]);
        assertEquals(model.faces.length, 8, 'Model should have 8 faces');
    });
});

Deno.test("Model splitBy3d ", async (t) => {
    await t.step("splitBy3d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // On edge
        model.splitBy3d(model.points[0], model.points[1]);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        // On diagonal
        model.splitBy3d(model.points[0], model.points[2]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        // On other diagonal
        model.splitBy3d(model.points[1], model.points[3]);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 5, 'Model should have 5 points');
    });
    await t.step("splitBy2d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // On edge by_2d 0 1 by_2d 0 2 by_2d 1 3
        model.splitBy2d(model.points[1], model.points[2]);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        // On diagonal
        model.splitBy2d(model.points[0], model.points[2]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.faces[0].points.length, 3, 'Face should have 3 points');
        assertEquals(model.faces[1].points.length, 3, 'Face should have 3 points');
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        // On other diagonal
        model.splitBy2d(model.points[1], model.points[3]);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 5, 'Model should have 5 points');
    });
    await t.step("splitBy2d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        model.splitBy2d(model.points[1], model.points[2]);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        model.splitBy2d(model.points[1], model.points[2]);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        model.splitBy2d(model.points[2], model.points[1]);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
    });
    await t.step("splitPerpendicular", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // On edge
        model.splitPerpendicular(model.segments[0], model.points[2]);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        // Add center
        const p = model.addPoint(0, 0, 0, 0, 0);
        // Split perpendicular to edge by center
        model.splitPerpendicular(model.segments[0], p);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 7, 'Model should have 7 points');
    });
});

Deno.test("Model bisector", async (t) => {
    await t.step("bisector2d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        model.bisector2d(model.segments[0], model.segments[1]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
        model.bisector2d(model.segments[0], model.segments[2]);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 7, 'Model should have 7 points');
    });
    await t.step("bisector3dPoints", () => {
        const model = new Model().init(-200, -200, 200, 200);
        model.bisector3dPoints(model.points[0], model.points[1], model.points[2]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
    });
    await t.step("bisector2dPoints", () => {
        const model = new Model().init(-200, -200, 200, 200);
        model.bisector2dPoints(model.points[0], model.points[1], model.points[2]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');
    });
    await t.step("bisector3dPoints", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // From bottom to right (crossing lines) gives 2 triangles
        model.bisector3d(model.points[0], model.points[1], model.points[1], model.points[2]);
        assertEquals(model.faces.length, 2, 'Model should have 2 faces');
        assertEquals(model.points.length, 4, 'Model should have 4 points');

        // From left to right (parallel lines) the 2 faces are split to 4 faces
        model.bisector3d(model.points[0], model.points[3], model.points[2], model.points[1]);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 7, 'Model should have 7 points');

        // From left to right (parallel lines) the 4 faces are unchanged
        model.bisector3d(model.points[0], model.points[3], model.points[2], model.points[1]);
        assertEquals(model.faces.length, 4, 'Model should have 4 faces');
        assertEquals(model.points.length, 7, 'Model should have 7 points');
    });
});

Deno.test("Model rotate turn", async (t) => {
    await t.step("rotate", () => {
        const model = new Model().init(-200, -200, 200, 200);
        // Rotate around diagonal [1][3], by 90°, point [2]
        let pt = model.points[2];
        const s = model.addSegment(model.points[1], model.points[3]);
        model.rotate(s, -90.0, [pt]);
        // after
        assertEquals(Math.round(pt.x), 0, 'Got:' + pt.x);
        assertEquals(Math.round(pt.y), 0, 'Got:' + pt.y);
        assertEquals(Math.round(pt.z), Math.round(Math.sqrt(200 * 200 + 200 * 200)), 'Got:' + pt.z);
        // Should not move
        pt = model.points[1];
        assertEquals(Math.round(pt.x), 200, 'Got:' + pt.x);
        assertEquals(Math.round(pt.y), -200, 'Got:' + pt.y);
        assertEquals(Math.round(pt.z), 0, 'Got:' + pt.z);
    });

    await t.step("turn", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p = model.points[0];
        assertEquals(p.x, -200, 'Got' + p.x);
        assertEquals(p.y, -200, 'Got' + p.y);

        let axis = new Segment(new Point(0, 0), new Point(0, 0, 1, 0, 0));
        model.turn(axis, 180);
        assertEquals(p.x, -200, 'Got' + p.x);
        assertEquals(Math.round(p.y), 200, 'Got' + p.y);

        axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 1, 0));
        model.turn(axis, 180);
        assertEquals(Math.round(p.x), 200, 'Got ' + p.x);
        assertEquals(Math.round(p.y), 200, 'Got ' + p.y);

        axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 0, 1));
        model.turn(axis, 180);
        assertEquals(Math.round(p.x), -200, 'Got' + p.x);
        assertEquals(Math.round(p.y), -200, 'Got' + p.y);
    });
});

Deno.test("Model adjust adjustList", async (t) => {
    await t.step("adjust", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p = model.points[0];
        const s = model.segments[0];
        p.x = -100; // arbitrary move
        // Adjust one point on all segments
        let max = model.adjust(p);
        assertEquals(Math.round(p.x), -200, 'Got:' + p.x);
        assertEquals(max < 0.01, true, 'Got:' + max);
        p.x = -400; // arbitrary move
        // Adjust one point on list of segments
        max = model.adjust(p, [s]);
        assertEquals(Math.round(p.x), -200, 'Got:' + p.x);
        assertEquals(max < 0.01, true, 'Got:' + max);
    });
    await t.step("adjustList", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p0 = model.points[0];
        const p1 = model.points[1];
        p0.x = -100;
        // Adjust multiple points on all segments
        const max = model.adjustList([p0, p1]);
        assertEquals(Math.round(p0.x), -200, 'Expect -200 Got' + p0.x);
        assertEquals(max < 0.01, true, 'Expect max < 0.01 Got' + max);
    });
});

Deno.test("Model move moveOn", async (t) => {
    await t.step("move", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p0 = model.points[0];
        const p1 = model.points[1];
        model.move(1, 2, 3, [p0, p1]);
        assertEquals(Math.round(p0.x), -199, 'Got:' + p0.x);
        assertEquals(Math.round(p0.y), -198, 'Got:' + p0.y);
        assertEquals(Math.round(p0.z), 3, 'Got:' + p0.z);
        model.move(1, 2, 3, model.points);
        assertEquals(Math.round(p0.x), -198, 'Got:' + p0.x);
        assertEquals(Math.round(p0.y), -196, 'Got:' + p0.y);
        assertEquals(Math.round(p0.z), 6, 'Got:' + p0.z);
    });
    await t.step("moveOn", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p0 = model.points[0];
        const p1 = model.points[1];
        // Move on p0 points p1
        model.moveOn(p0, 0, 1, [p1]);
        assertEquals(Math.round(p1.x), 200, 'Got:' + p1.x);
        assertEquals(Math.round(p1.y), -200, 'Got:' + p1.y);
        assertEquals(Math.round(p1.z), 0, 'Got:' + p1.z);
        model.moveOn(p0, 1, 0, [p1]);
        assertEquals(Math.round(p1.x), -200, 'Got:' + p1.x);
        assertEquals(Math.round(p1.y), -200, 'Got:' + p1.y);
        assertEquals(Math.round(p1.z), 0, 'Got:' + p1.z);
    });
});

Deno.test("Model splitSegmentOnPoint2d splitSegmentByRatio2d", async (t) => {
    await t.step("splitSegmentOnPoint2d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const s = model.segments[0];
        const p = {xf: 0, yf: -200};
        model.splitSegmentOnPoint2d(s, p);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 5, 'Model should have 5 points');
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
    });
    await t.step("splitSegmentByRatio2d", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const s = model.segments[0];
        const k = 1 / 2;
        model.splitSegmentByRatio2d(s, k);
        assertEquals(model.faces.length, 1, 'Model should have 1 faces');
        assertEquals(model.points.length, 5, 'Model should have 5 points');
        assertEquals(model.segments.length, 5, 'Model should have 5 segments');
    });
    await t.step("flat", () => {
        const model = new Model().init(-200, -200, 200, 200);
        const p0 = model.points[0];
        const p1 = model.points[1];
        model.move(0, 0, 3, [p0, p1]);

        // Move flat points p0 p1
        model.flat([p1]);
        assertEquals(Math.round(p1.x), 200, 'Got:' + p1.x);
        assertEquals(Math.round(p1.y), -200, 'Got:' + p1.y);
        assertEquals(Math.round(p1.z), 0, 'Got:' + p1.z);
        model.move(0, 0, 3, [p0, p1]);
        model.flat();
        assertEquals(Math.round(p1.x), 200, 'Got:' + p1.x);
        assertEquals(Math.round(p1.y), -200, 'Got:' + p1.y);
        assertEquals(Math.round(p1.z), 0, 'Got:' + p1.z);
    });
});
// Turn
Deno.test('Turn',  () => {
    const model = new Model().init(-200, -200, 200, 200);
    const p = model.points[0];
    assertEquals(p.x, -200, 'Got' + p.x);
    assertEquals(p.y, -200, 'Got' + p.y);

    let axis = new Segment(new Point(0, 0), new Point(0, 0, 1, 0, 0));
    model.turn(axis, 180);
    assertEquals(p.x, -200, 'Got' + p.x);
    assertEquals(Math.round(p.y), 200, 'Got' + p.y);

    axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 1, 0));
    model.turn(axis, 180);
    assertEquals(Math.round(p.x), 200, 'Got ' + p.x);
    assertEquals(Math.round(p.y), 200, 'Got ' + p.y);

    axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 0, 1));
    model.turn(axis, 180);
    assertEquals(Math.round(p.x), -200, 'Got' + p.x);
    assertEquals(Math.round(p.y), -200, 'Got' + p.y);
});

// Offset
Deno.test('Offset', () => {
    const model = new Model().init(-200, -200, 200, 200);
    model.splitCross3d(model.points[0], model.points[2]);
    model.offset(42, [model.faces[0]]);
    assertEquals(model.faces[0].offset, 42, 'Got:' + model.faces[0].offset);
    assertEquals(model.faces[1].offset, 0, 'Got:' + model.faces[1].offset);
});

// get2DBounds
Deno.test('get2DBounds', () => {
    const model = new Model().init(-200, -200, 200, 200);
    const bounds = model.get2DBounds();
    assertEquals(bounds.xMin, -200, 'Got:' + bounds.xMin);
    assertEquals(bounds.xMax, 200, 'Got:' + bounds.xMax);
    assertEquals(bounds.yMin, -200, 'Got:' + bounds.yMin);
    assertEquals(bounds.yMax, 200, 'Got:' + bounds.yMax);
});

// get3DBounds
Deno.test('get3DBounds', () => {
    const model = new Model().init(-200, -200, 200, 200);
    const bounds = model.get3DBounds();
    assertEquals(bounds.xMin, -200, 'Got:' + bounds.xMin);
    assertEquals(bounds.xMax, 200, 'Got:' + bounds.xMax);
    assertEquals(bounds.yMin, -200, 'Got:' + bounds.yMin);
    assertEquals(bounds.yMax, 200, 'Got:' + bounds.yMax);
});

// ScaleModel
Deno.test('scaleModel', () => {
    const model = new Model().init(-200, -200, 200, 200);
    const p0 = model.points[0];
    model.scaleModel(4);
    assertEquals(p0.x, -800, 'Got:' + p0.x);
    assertEquals(p0.y, -800, 'Got:' + p0.y);
    assertEquals(p0.z, 0, 'Got:' + p0.z);
});

// Test rotate
Deno.test('Rotate', () => {
    const model = new Model().init(-200, -200, 200, 200);
    model.splitBy3d(model.points[3], model.points[1])
    model.rotate(model.segments[4], -180, [model.points[2]]);
    model.splitCross3d(model.points[3], model.points[1]);
    assertEquals(model.segments.length, 8, 'Got:' + model.segments.length);
    assertEquals(model.faces[0].points.length, 3, 'Got:' + model.faces[0].points.length);
});
