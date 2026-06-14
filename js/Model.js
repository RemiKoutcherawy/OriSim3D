import {Point} from './Point.js';
import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Vector3} from './Vector3.js';
import {Plane} from './Plane.js';

export const State = {run: 0, anim: 1, undo: 2, pause: 3,};

export class Model {

    constructor() {
        // Core
        this.points = [];
        this.segments = [];
        this.faces = [];

        // State of the model
        this.state = State.run;
        this.scale = 1;

        // Glues points to segments
        this.glues = [];

        // Helper
        this.labels = false;
        this.textures = false;
        this.overlay = false; // show points segments and face
        this.lines = false; // render lines on 3d
    }

    // Initialize with 2d coordinates
    init(width = 200, height = 200) {
        this.points = [];
        this.segments = [];
        this.faces = [];
        // 4 points
        const p0 = new Point(-width, -height, -width, -height, 0);
        const p1 = new Point(width, -height, width, -height, 0);
        const p2 = new Point(width, height, width, height, 0);
        const p3 = new Point(-width, height, -width, height, 0);
        this.points.push(p0, p1, p2, p3);
        // 4 segments
        const s0 = new Segment(p0, p1);
        const s1 = new Segment(p1, p2);
        const s2 = new Segment(p2, p3);
        const s3 = new Segment(p3, p0);
        this.segments.push(s0, s1, s2, s3);
        // 1 face
        const f = new Face([p0, p1, p2, p3]);
        this.faces.push(f);
        // State run
        this.state = State.run;
        return this;
    }

    // Update hover2d3d on points, segments, faces 2d and 3d
    hover2d3d(points, segments, faces) {
        // Clean
        this.points.forEach((p) => p.hover = false);
        this.segments.forEach((s) => s.hover = false);
        this.faces.forEach((f) => f.hover = false);
        // Hover
        if (points.length > 0) {
            points.forEach((p) => p.hover = true);
        } else if (segments.length > 0) {
            segments.forEach((s) => s.hover = true);
        } else if (faces.length > 0) {
            faces.forEach((f) => f.hover = true);
        }
    }

    // Handle click2d3d on points, segments, faces 2d and 3d
    click2d3d(points, segments, faces) {
        if (points.length > 0) {
            points.forEach((p) => p.select = (p.select + 1) % 3);
        } else if (segments.length > 0) {
            segments.forEach((s) => s.select = (s.select + 1) % 3);
        } else if (faces.length > 0) {
            faces.forEach((f) => f.select = (f.select + 1) % 3);
        }
    }

    // Index of Point or Segment or Face
    indexOf(object) {
        if (object instanceof Point) {
            return this.points.indexOf(object);
        } else if (object instanceof Segment) {
            return this.segments.indexOf(object);
        } else if (object instanceof Face) {
            return this.faces.indexOf(object);
        } else {
            return -1;
        }
    }

    // Get point on the flat crease pattern
    getPoint(xf, yf, epsilon = 2) {
        for (const p of this.points) {
            const df = Math.abs(p.xf - xf) + Math.abs(p.yf - yf);
            if (df < epsilon) {
                return p;
            }
        }
        return undefined;
    }

    // Add a point or return an existing point
    addPoint(xf, yf, x, y, z) {
        let point = this.getPoint(xf, yf);
        // None found, create one
        if (!point) {
            point = new Point(xf, yf, x, y, z);
            this.points.push(point);
        }
        return point;
    }

    // Add a segment or return an existing segment
    addSegment(a, b) {
        let segment = this.getSegment(a, b);
        // None found, create one
        if (!segment) {
            segment = new Segment(a, b);
            this.segments.push(segment);
        }
        return segment;
    }

    // Get the face-containing points
    getFace(points) {
        for (const f of this.faces) {
            if (f.points === points) {
                return f;
            }
        }
        return undefined;
    }

    // Add a face or return an existing face
    addFace(points) {
        let face = this.getFace(points);
        // None found, create one
        if (!face) {
            // Add segments for the face
            points.forEach((p, i, a) => {
                this.addSegment(p, a[(i + 1) % a.length]);
            });
            face = new Face(points);
            this.faces.push(face);
        }
        return face;
    }

    // Origami
    // Split face by plane 3d
    splitFaceByPlane3d(face, plane) {
        // Split face
        let left = [];
        let right = [];
        let lastInter;

        // Segment from last to current
        // 9 cases: left <0, on 0, right >0
        //         Current
        // last | < | 0 | > |
        //    < | 1 | 3 | 9 |
        //    0 | 6 | 4 | 7 |
        //    > | 8 | 5 | 2 |
        // Not exactly 0 for distance but epsilon = 10
        const epsilon = 10;

        // Begin with the last point
        let last = face.points[face.points.length - 1];
        let dLast = Face.planeToPointSignedDistance(plane, last);
        for (const current of face.points) {
            // Segment from previous to current
            const dCurrent = Face.planeToPointSignedDistance(plane, current);
            // last and current on the same side // 1, 2
            if (dLast * dCurrent > epsilon) {
                dCurrent < 0 ? left.push(current) : right.push(current);
            }
            // current on plane // 3 4 5
            else if (Math.abs(dCurrent) <= epsilon) {
                left.push(current);
                right.push(current);
                lastInter = current;
            }
            // last on plane, current on left or right // 6 7
            else if (Math.abs(dLast) <= epsilon) {
                dCurrent < 0 ? left.push(current) : right.push(current);
            }
            // last and current on different side, crossing // 8 9
            else {
                const inter = Face.intersectionPlaneSegment(plane, last, current);

                // Origami
                Point.align2dFrom3d(last, current, inter);
                lastInter = this.addIntersection3d(inter, left, right, dCurrent, current, last, lastInter);
            }
            last = current;
            dLast = dCurrent;
        }

        // Modify initial face and add new face if not degenerated
        // Discard degenerated polygons artifacts
        left = Face.area3d(left) === 0 ? undefined : left;
        right = Face.area3d(right) === 0 ? undefined : right;
        if (left && right) {
            face.points = left;
            const newFace = this.addFace(right);
            // Keep offset for added face
            newFace.offset = face.offset;
        }
    }

    addIntersection3d(inter, left, right, dCurrent, current, last, lastInter) {
        inter = this.addPoint(inter.xf, inter.yf, inter.x, inter.y, inter.z);
        left.push(inter);
        right.push(inter);
        dCurrent < 0 ? left.push(current) : right.push(current);

        // Set Segment [last,current] to [last,inter]
        const segment = this.getSegment(last, current);
        if (segment) {
            Model.splitSegment(segment, last, inter);
        }

        // Add a new segment
        this.addSegment(inter, current);

        // Eventually, if last intersection was on plane, add a segment from the last intersection to inter
        if (lastInter && inter !== lastInter) {
            this.addSegment(lastInter, inter);
            lastInter = undefined;
        } else {
            lastInter = inter;
        }
        return lastInter;
    }

    splitFaceBySegment2d(face, a, b) {
        const left = [], right = [];
        let inter;

        // Segment from last to current
        const EPSILON = 1;
        let last = face.points[face.points.length - 1];
        let dLast = Face.distance2dLineToPoint(a, b, last); // Positive if on the right of the segment a,b
        // Discard if on the line but not on Segment
        if (Math.abs(dLast) < EPSILON
            && Segment.intersectionFlat(a, b, last, face.points[0]) === undefined) {
            return;
        }
        for (const current of face.points) {
            // Segment from previous to current
            const dCurrent = Face.distance2dLineToPoint(a, b, current);
            if (dLast < -EPSILON) { // Last on the left
                if (dCurrent < -EPSILON) { // Current on the left
                    left.push(current);
                } else if (Math.abs(dCurrent) <= EPSILON) { // Last on the left Current on the line ab
                    // Don't split face if inter is on the line but not on the segment ab
                    if (
                        Segment.intersectionFlat(a, b, last, current) ===
                            undefined
                    ) {
                        return;
                    }
                    left.push(current);
                    right.push(current);
                } else if (dCurrent > EPSILON) { // Last on left Current on right => crossing
                    // Don't split face if inter is on the line but not on the segment
                    inter = Segment.intersectionFlat(a, b, last, current);
                    if (inter === undefined) {
                        return;
                    }
                    // Origami
                    Point.align3dFrom2d(last, current, inter);
                    inter = this.addIntersectionPoint(inter, left, right, last, current);
                    right.push(current);
                }
            } else if (Math.abs(dLast) <= EPSILON) { // Last on the line
                if (dCurrent < -EPSILON) { // Current on the left
                    left.push(current);
                } else if (Math.abs(dCurrent) <= EPSILON) { // Current on the line
                    // Current on the line TEST 0 Point { xf: 0, yf: 0, x: 0, y: 0, z: 0, xCanvas: 0, yCanvas: 0 }
                    // Don't split face if the intersection is on the line but not on the segment
                    if (
                        Segment.intersectionFlat(a, b, last, current) === undefined
                    ) {
                        return;
                    }
                    left.push(current);
                    right.push(current);
                } else if (dCurrent > EPSILON) { // Current on right
                    right.push(current);
                }
            } else if (dLast > EPSILON) { // Last on the right
                if (dCurrent < -EPSILON) { // Current on the left => crossing
                    // Don't split face if the intersection is on the line but not on the segment
                    inter = Segment.intersectionFlat(a, b, last, current);
                    if (inter === undefined) {
                        return;
                    }
                    // Origami
                    Point.align3dFrom2d(last, current, inter);
                    // Add intersection to both sides
                    inter = this.addIntersectionPoint(inter, left, right, last, current);
                    left.push(current);
                } else if (Math.abs(dCurrent) <= EPSILON) { // Current on the line
                    if (
                        Segment.intersectionFlat(a, b, last, current) ===
                            undefined
                    ) {
                        return;
                    }
                    left.push(current);
                    right.push(current);
                } else if (dCurrent > EPSILON) { // Current on right
                    right.push(current);
                }
            }
            last = current;
            dLast = dCurrent;
        }
        // Discard degenerated polygons artifacts
        const areaLeft = Face.area2dFlat(left);
        const areaRight = Face.area2dFlat(right);
        // Modify initial face and add new face if not degenerated
        if (Math.abs(areaLeft) > EPSILON && Math.abs(areaRight) > EPSILON) {
            face.points = left;
            const newFace = this.addFace(right);
            // Keep offset for added face
            newFace.offset = face.offset;
        }
    }

    addIntersectionPoint(inter, left, right, last, current) {
        // Add intersection to both sides
        inter = this.addPoint(inter.xf, inter.yf, inter.x, inter.y, inter.z);
        left.push(inter);
        right.push(inter);
        // Set Segment [last,current] to [last,inter]
        const segment = this.getSegment(last, current);
        if (segment) {
            Model.splitSegment(segment, last, inter);
            this.addSegment(inter, current);
        }
        return inter;
    }

    static splitSegment(segment, last, inter) {
        if (segment !== undefined) {
            if (segment.p1 === last) {
                segment.p2 = inter;
            } else if (segment.p2 === last) {
                segment.p1 = inter;
            } else {
                // Segment already cut
            }
        }
    }

    splitSegmentByRatio2d(s, k) {
        const p = new Point(
            s.p1.xf + k * (s.p2.xf - s.p1.xf),
            s.p1.yf + k * (s.p2.yf - s.p1.yf),
        );
        this.splitSegmentOnPoint2d(s, p);
    }

    splitSegmentOnPoint2d(s, p) {
        // Align Point p on segment s in 2D
        const a = s.p1;
        const b = s.p2;
        // Add this as a new point to the model
        p = this.addPoint(p.xf, p.yf);
        Point.align3dFrom2d(a, b, p);
        // Add the point p to both faces.
        const listFaces = this.searchFacesWithAB(a, b);
        for (const face of listFaces) {
            if (face.points.includes(p)) {
                const pts = face.points;
                for (let i = 0; i < pts.length; i++) {
                    if (
                        pts[i] === a &&
                        pts[i === pts.length - 1 ? 0 : i + 1] === b
                    ) {
                        pts.splice(i + 1, 0, p);
                        break;
                    }
                    if (
                        pts[i] === b &&
                        pts[i === pts.length - 1 ? 0 : i + 1] === a
                    ) {
                        pts.splice(i + 1, 0, p);
                        break;
                    }
                }
            }
        }
        // Reduce segment s to [a, p]
        Model.splitSegment(s, a, p);
        // And add a new segment p,b
        this.addSegment(p, b);
        return s;
    }

    // Split all faces by a plane
    splitAllFacesByPlane3d(plane) {
        // Reverse order to safely add new faces
        for (let i = this.faces.length - 1; i > -1; i--) {
            const face = this.faces[i];
            this.splitFaceByPlane3d(face, plane);
        }
    }

    // Split all faces by a segment two points on 2d crease pattern
    splitAllFacesBySegment2d(a, b) {
        // Reverse order to safely add new faces
        for (let i = this.faces.length - 1; i > -1; i--) {
            const face = this.faces[i];
            this.splitFaceBySegment2d(face, a, b);
        }
    }

    // Split all faces by a line defined by two points on 2d crease pattern
    splitAllFacesByLine2d(a, b) {
        // Vector from a to b
        let ab = { xf: b.xf - a.xf, yf: b.yf - a.yf };
        // Extend ab
        ab = { xf: ab.xf * 1000, yf: ab.yf * 1000 };
        const p = new Point(a.xf + ab.xf, a.yf + ab.yf);
        const q = new Point(b.xf - ab.xf, b.yf - ab.yf);
        this.splitAllFacesBySegment2d(p, q);
    }

    // Split faces across two points in 3d
    splitCross3d(p1, p2) {
        const plane = Plane.across(p1, p2);
        // Reverse order to safely add new faces
        for (let i = this.faces.length - 1; i > -1; i--) {
            const face = this.faces[i];
            this.splitFaceByPlane3d(face, plane);
        }
    }

    // Split faces across two points in 2d
    splitCross2d(p1, p2) {
        const normal = {x: p2.yf - p1.yf, y: -(p2.xf - p1.xf) }; // x,y -> y,-x
        const middle = {x: (p1.xf + p2.xf) / 2, y: (p1.yf + p2.yf) / 2 };
        // Two points apart from the middle
        const a = new Point(middle.x + normal.x, middle.y + normal.y);
        const b = new Point(middle.x - normal.x, middle.y - normal.y);
        this.splitAllFacesByLine2d(a, b);
    }

    // Split faces by a plane passing by two points on xy orthogonal to z
    splitBy3d(p1, p2) {
        const plane = Plane.by(p1, p2);
        this.splitAllFacesByPlane3d(plane);
    }

    // Split faces by a line passing by two points in 2d
    splitBy2d(p1, p2) {
        this.splitAllFacesBySegment2d(p1, p2);
    }

    // Split faces by a line perpendicular to [p1,p2] passing by point
    splitPerpendicular2d(s, point) {
        const projection = Segment.project2d(s, point);
        // Reverse order to safely add new faces
        for (let i = this.faces.length - 1; i > -1; i--) {
            const face = this.faces[i];
            this.splitFaceBySegment2d(face, point, projection);
        }
    }
    // Split faces by a plane perpendicular to [p1,p2] passing by point
    splitPerpendicular3d(s, point) {
        const plane = Plane.orthogonal(s.p1, s.p2, point);
        // Reverse order to safely add new faces
        for (let i = this.faces.length - 1; i > -1; i--) {
            const face = this.faces[i];
            this.splitFaceByPlane3d(face, plane);
        }
    }

    // Split faces by a plane between two lines [ab] [cd]
    bisector3d(a, b, c, d) {
        const {p, q} = Segment.closestSegment(a, b, c, d);
        // The closest line is just one point
        if (p.x === q.x && p.y === q.y && p.z === q.z) {
            // Choose points a and c far from center p (which could be a or c)
            a = Vector3.length3d(Vector3.sub(a, p)) > Vector3.length3d(Vector3.sub(b, p)) ? a : b;
            c = Vector3.length3d(Vector3.sub(c, p)) > Vector3.length3d(Vector3.sub(d, p)) ? c : d;
            this.bisector3dPoints(a, p, c);
        } else {
            // Lines do not cross, parallel, there is a plane across the closest segment
            const plane = Plane.across(p, q);
            this.splitAllFacesByPlane3d(plane);
        }
    }

    // Split faces by a line between two lines [ab] [cd]
    bisector2d(s1, s2) {
        let inter = Segment.intersection2dLines(s1.p1, s1.p2, s2.p1, s2.p2);
        if (inter) {
            // Farther from the intersection on each segment
            const a = Point.distance2d(inter, s1.p1) < Point.distance2d(inter, s1.p2) ? s1.p2 : s1.p1;
            const b = Point.distance2d(inter, s2.p1) < Point.distance2d(inter, s2.p2) ? s2.p2 : s2.p1;
            this.bisector2dPoints(a, inter, b);
        } else {
            // Lines do not cross, parallel: split by line between from (p1+p2)/2 oriented by p1p2
            const middle = {xf: (s1.p1.xf + s2.p1.xf) / 2, yf: (s1.p1.yf + s2.p1.yf) / 2};
            const p1p2 = {xf: s1.p2.xf - s1.p1.xf, yf: s1.p2.yf - s1.p1.yf};
            const middleDecal = {xf: middle.xf + p1p2.xf, yf: middle.yf + p1p2.yf};
            this.splitAllFacesByLine2d(middle, middleDecal);
        }
    }

    // Split faces by a plane between two segments [ap] [pc].
    bisector3dPoints(a, p, c) {
        // Project [a] on [p c] to get a symmetric point
        const ap = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
        const cp = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
        const k = ap / cp;
        // e is on pc symmetric of a
        const e = new Vector3(p.x + k * (c.x - p.x), p.y + k * (c.y - p.y), p.z + k * (c.z - p.z));
        // Define Plane across a and e
        const plane = Plane.across(a, e);
        this.splitAllFacesByPlane3d(plane);
    }

    // Split faces by a line between three points: A, B, C.
    bisector2dPoints(a, b, c) {
        // Two vectors from b to a and c
        const v1 = {xf: b.xf - a.xf, yf: b.yf - a.yf};
        const v2 = {xf: b.xf - c.xf, yf: b.yf - c.yf};
        // Two normalized vectors
        const v1n = Point.normalise(v1);
        const v2n = Point.normalise(v2);
        // Two points from b aligned on ba and bc
        const p = {xf: b.xf + v1n.xf * 10, yf: b.yf + v1n.yf * 10};
        const q = {xf: b.xf + v2n.xf * 10, yf: b.yf + v2n.yf * 10};
        // Middle intersection
        const pq = {xf: (p.xf + q.xf) / 2, yf: (p.yf + q.yf) / 2};
        this.splitAllFacesByLine2d(b, pq);
    }

    // Rotate around axis Segment, by angle, the list of Points
    rotate(s, angle, list = this.points) {
        const angleRd = angle * Math.PI / 180;
        const ax = s.p1.x, ay = s.p1.y, az = s.p1.z;
        let nx = s.p2.x - ax, ny = s.p2.y - ay, nz = s.p2.z - az;
        const n = 1 / Math.hypot(nx, ny, nz);
        nx *= n;
        ny *= n;
        nz *= n;
        const sin = Math.sin(angleRd), cos = Math.cos(angleRd);
        const c1 = 1 - cos;
        const c11 = c1 * nx * nx + cos, c12 = c1 * nx * ny - nz * sin, c13 = c1 * nx * nz + ny * sin;
        const c21 = c1 * ny * nx + nz * sin, c22 = c1 * ny * ny + cos, c23 = c1 * ny * nz - nx * sin;
        const c31 = c1 * nz * nx - ny * sin, c32 = c1 * nz * ny + nx * sin, c33 = c1 * nz * nz + cos;
        list.forEach(function (p) {
            const ux = p.x - ax, uy = p.y - ay, uz = p.z - az;
            p.x = ax + c11 * ux + c12 * uy + c13 * uz;
            p.y = ay + c21 * ux + c22 * uy + c23 * uz;
            p.z = az + c31 * ux + c32 * uy + c33 * uz;
        });
    }

    // Adjust one point 3d with 2d length of segments
    adjust(point) {
        // Take all segments containing point p
        const segments = this.searchSegmentsOnePoint(point);
        let max = 0.1, i;
        // Iterate while the length difference between 2d and 3d is > 1e-3
        for (i = 0; max > 0.001 && i < 200; i++) {
            max = 0;
            // Iterate over all segments
            // Pm is the medium point
            const pm = new Vector3(0, 0, 0);
            for (let j = 0; j < segments.length; j++) {
                const s = segments[j];
                const lg3d = Segment.length3d(s) / this.scale;
                const lg2d = Segment.length2d(s); // Should not change
                const d = lg2d - lg3d;
                if (Math.abs(d) > max) {
                    max = Math.abs(d);
                }
                // Move B = A + AB * r with r = l2d / l3d
                // AB * r is based on length 3d to match length 2d
                const r = lg2d / lg3d;
                if (s.p2 === point) {
                    // move s.p2
                    pm.x += s.p1.x + (s.p2.x - s.p1.x) * r;
                    pm.y += s.p1.y + (s.p2.y - s.p1.y) * r;
                    pm.z += s.p1.z + (s.p2.z - s.p1.z) * r;
                } else if (s.p1 === point) {
                    // move s.p1
                    pm.x += s.p2.x + (s.p1.x - s.p2.x) * r;
                    pm.y += s.p2.y + (s.p1.y - s.p2.y) * r;
                    pm.z += s.p2.z + (s.p1.z - s.p2.z) * r;
                }
            }
            // Set Point with an average position taking all segments
            if (segments.length > 0) {
                point.x = pm.x / segments.length;
                point.y = pm.y / segments.length;
                point.z = pm.z / segments.length;
            }
        }
        return max;
    }

    // Adjust list of points 3d
    adjustList(list) {
        let max = 0.1;
        for (let i = 0; max > 0.001 && i < 200; i++) {
            max = 0;
            for (let j = 0; j < list.length; j++) {
                const point = list[j];
                const d = this.adjust(point);
                if (Math.abs(d) > max) {
                    max = Math.abs(d);
                }
            }
        }
        return max;
    }

    // Checks segments and selects segments with anormal length
    checkSegments() {
        const max = 1;
        for (let i = 0; i < this.segments.length; i++) {
            const s = this.segments[i];
            const lg3d = Segment.length3d(s) / this.scale;
            const lg2d = Segment.length2d(s); // Should not change
            const d = lg2d - lg3d;
            if (Math.abs(d) > max) {
                s.select = 1;
            }
        }
    }

    gluePointToSegment(point, segment) {
        const A = segment.p1, B = segment.p2;
        const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
        const ab2 = abx * abx + aby * aby + abz * abz;
        if (ab2 < 1) return;
        const t = ((point.x - A.x) * abx + (point.y - A.y) * aby + (point.z - A.z) * abz) / ab2;
        const existing = this.glues.findIndex(g => g.point === point && g.segment === segment);
        if (existing >= 0) {
            this.glues[existing].t = t;
        } else {
            this.glues.push({point, segment, t});
        }
    }

    applyGlue() {
        for (const g of this.glues) {
            const A = g.segment.p1, B = g.segment.p2;
            g.point.x = A.x + g.t * (B.x - A.x);
            g.point.y = A.y + g.t * (B.y - A.y);
            g.point.z = A.z + g.t * (B.z - A.z);
        }
    }

    // Search all segments containing Point a
    searchSegmentsOnePoint(a) {
        const list = [];
        this.segments.forEach(function (s) {
            if (s.p1 === a || s.p2 === a) list.push(s);
        });
        return list;
    }

    // Search faces containing a segment [a, b]
    searchFacesWithAB(a, b) {
        const seg = this.getSegment(a, b);
        if (seg) {
            const list = Segment.incidentFaces(this, seg);
            if (list?.length) return list;
        }
        // Legacy fallback: faces that contain both vertices (not necessarily adjacent)
        const faces = [];
        this.faces.forEach((f) => {
            if (f.points.includes(b) && f.points.includes(a)) {
                faces.push(f);
            }
        });
        return faces;
    }

    // Move a list of points by dx,dy,dz
    movePoints(dx, dy, dz, points) {
        if (points.length === 0) points = this.points;
        points.forEach((p) => {
            p.x += dx;
            p.y += dy;
            p.z += dz;
        });
    }

    // Move on a point 'p0' all following list of points
    moveOnPoint(p0, points) {
        points.forEach(function (p) {
            p.x = p0.x;
            p.y = p0.y;
            p.z = p0.z;
        });
    }
    // Move on a segment s the following points.
    moveOnSegment(s, points) {
        const A = s.p1, B = s.p2;
        const abx = B.x - A.x;
        const aby = B.y - A.y;
        const abz = B.z - A.z;
        points.forEach(function (p) {
            const t = (abx * (p.x - A.x) + aby * (p.y - A.y) + abz * (p.z - A.z)) / (abx * abx + aby * aby + abz * abz);
            p.x = A.x + abx * t;
            p.y = A.y + aby * t;
            p.z = A.z + abz * t;
        });
    }
    // Move on a face the following points.
    moveOnFace(face, points) {
        const A = face.points[0], B = face.points[1], C = face.points[2];
        const AB = {x: B.x-A.x, y: B.y-A.y, z: B.z-A.z};
        const AC = {x: C.x-A.x, y: C.y-A.y, z: C.z-A.z};
        const N = {
            x: AB.y*AC.z - AB.z*AC.y,
            y: AB.z*AC.x - AB.x*AC.z,
            z: AB.x*AC.y - AB.y*AC.x
        };
        const NN = N.x*N.x + N.y*N.y + N.z*N.z;
        if (NN <= 0.1) return;
        points.forEach(p => {
            const t = ((p.x-A.x)*N.x + (p.y-A.y)*N.y + (p.z-A.z)*N.z) / NN;
            p.x -= t*N.x;
            p.y -= t*N.y;
            p.z -= t*N.z;
        });
    }

    // Move given or all points to z = 0
    flat(points) {
        points = points ?? this.points;
        points.forEach((point) => point.z = 0)
    }

    // Turn the model around axis by angle
    turn(axe, angle) {
        this.rotate(axe, angle, this.points);
    }

    // Offset faces by dz
    offset(dz, faces) {
        if (dz === 0 || faces.length === 0) {
            this.faces.forEach(function (face) {face.offset = 0;});
        } else {
            faces.forEach(function (face) {face.offset += dz / 10;});
        }
    }

    // 2d Boundary [xMin, yMin, xMax, yMax]
    get2DBounds() {
        let xMax = -100;
        let xMin = 100;
        let yMax = -100;
        let yMin = 100;
        this.points.forEach(function (p) {
            xMin = Math.min(xMin, p.xf);
            xMax = Math.max(xMax, p.xf);
            yMin = Math.min(yMin, p.yf);
            yMax = Math.max(yMax, p.yf);
        });
        return {xMin, xMax, yMin,  yMax};
    }

    // Scale model @testOK
    scaleModel(scale) {
        this.scale *= scale;
        this.points.forEach(function (p) {
            p.x *= scale;
            p.y *= scale;
            p.z *= scale;
        });
    }

    // 3D Boundary View [xMin, yMin, xMax, yMax]
    get3DBounds() {
        let xMax = -200, xMin = 200;
        let yMax = -200, yMin = 200;
        this.points.forEach(function (p) {
            xMin = Math.min(xMin, p.x);
            xMax = Math.max(xMax, p.x);
            yMin = Math.min(yMin, p.y);
            yMax = Math.max(yMax, p.y);
        });
        return {xMin, xMax, yMin, yMax};
    }

    // Serialize the model, replace instances by indexes in JSON, and return a JSON string
    serialize() {
        // Non-serialized / UI-only fields
        const exclude = new Set(['labels', 'textures', 'overlay', 'lines', 'glues']);
        const pointIndex = new Map(this.points.map((p, i) => [p, i]));
        // Define a replacer function to convert instances into indexes in JSON
        const replacer = (key, value) => {
            if (value instanceof Segment)
                return { p1: pointIndex.get(value.p1), p2: pointIndex.get(value.p2) };
            if (value instanceof Face)
                return value.points.map((p) => pointIndex.get(p));
            if (exclude.has(key))
                return undefined;
            return value;
        };
        return JSON.stringify(this, replacer);
    }

    // Deserialize the model, revive objects, and return a new model
    deserialize(json) {
        return JSON.parse(json, this.reviver);
    }
    // Define a reviver to convert points objects into Points instances, and indexes into instance
    reviver(key, value) {
        if (key === 'points') {
            return value.map((p) => new Point(p.xf, p.yf, p.x, p.y, p.z));
        } else if (key === 'segments') {
            return value.map((segment) => new Segment(this.points[segment.p1], this.points[segment.p2]));
        } else if (key === 'faces') {
            return value.map((facePoints) => {
                return new Face(facePoints.map((index) => this.points[index]));
            });
        }
        return value;
    }

    // Get a segment from two points
    getSegment(p1, p2) {
        for (const s of this.segments) {
            if ((s.p1 === p1 && s.p2 === p2) || (s.p1 === p2 && s.p2 === p1)) {
                return s;
            }
        }
        return undefined;
    }
}

// 804
