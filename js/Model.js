import {Point} from './Point.js';
import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Vector3} from './Vector3.js';
import {Plane} from './Plane.js';

export const State = {run: 0, anim: 1, undo: 2, pause: 3,};

// Newell: magnitude of the accumulated normal (0 if degenerated or < 3 points)
function polygonArea3d(points) {
    if (!points || points.length < 3) return 0;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        nx += (a.y - b.y) * (a.z + b.z);
        ny += (a.z - b.z) * (a.x + b.x);
        nz += (a.x - b.x) * (a.y + b.y);
    }
    return Math.hypot(nx, ny, nz);
}

// -1 left, 0 on the line, +1 right
function side2d(d, epsilon) {
    return d < -epsilon ? -1 : d > epsilon ? 1 : 0;
}

export class Model {

    constructor() {
        // Core
        this.points = [];
        this.segments = [];
        this.faces = [];

        // State of the model
        this.state = State.run;
        this.scale = 1;

        // Helper
        this.labels = false;
        this.textures = false;
        this.overlay = false; // show points segments and face
        this.lines = false;   // render lines on 3d
        this.snap = false;     // snap nearest points
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
        this.segments.push(new Segment(p0, p1), new Segment(p1, p2), new Segment(p2, p3), new Segment(p3, p0));
        // 1 face
        this.faces.push(new Face([p0, p1, p2, p3]));
        // State run
        this.state = State.run;
        // Options
        this.labels = true;
        this.textures = false;
        this.overlay = true; // show points segments and face
        this.lines = true;   // render lines on 3d
        this.snap = true;    // snap nearest points
        return this;
    }

    // First non-empty pick among points, then segments, then faces
    firstHit(points, segments, faces) {
        return points.length ? points : segments.length ? segments : faces;
    }

    // Update hover2d3d on points, segments, faces 2d and 3d
    hover2d3d(points, segments, faces) {
        // Clean
        this.points.forEach((p) => { p.hover = false; });
        this.segments.forEach((s) => { s.hover = false; });
        this.faces.forEach((f) => { f.hover = false; });
        // Hover
        this.firstHit(points, segments, faces).forEach((o) => { o.hover = true; });
    }

    // Handle click2d3d on points, segments, faces 2d and 3d
    click2d3d(points, segments, faces) {
        this.firstHit(points, segments, faces).forEach((o) => { o.select = !o.select; });
    }

    // Index of Point or Segment or Face
    indexOf(object) {
        if (object instanceof Point) return this.points.indexOf(object);
        if (object instanceof Segment) return this.segments.indexOf(object);
        if (object instanceof Face) return this.faces.indexOf(object);
        return -1;
    }

    // Get point on the flat crease pattern
    getPoint(xf, yf, epsilon = 2) {
        return this.points.find((p) => Math.abs(p.xf - xf) + Math.abs(p.yf - yf) < epsilon);
    }

    // Add a point or return an existing point
    addPoint(xf, yf, x, y, z) {
        const existing = this.getPoint(xf, yf);
        // None found, create one
        if (existing) return existing;
        const point = new Point(xf, yf, x, y, z);
        this.points.push(point);
        return point;
    }

    // Add a segment or return an existing segment
    addSegment(a, b) {
        const existing = this.getSegment(a, b);
        // None found, create one
        if (existing) return existing;
        const segment = new Segment(a, b);
        this.segments.push(segment);
        return segment;
    }

    // Get the face containing these points in this order
    getFace(points) {
        return this.faces.find((f) =>
            f.points.length === points.length && f.points.every((p, i) => p === points[i])
        );
    }

    // Add a face or return an existing face
    addFace(points) {
        const existing = this.getFace(points);
        // None found, create one
        if (existing) return existing;
        // Add segments for the face
        points.forEach((p, i, a) => this.addSegment(p, a[(i + 1) % a.length]));
        const face = new Face(points);
        this.faces.push(face);
        return face;
    }

    // Replace face polygon by left, add right as a new face, keep offset
    commitSplit(face, left, right) {
        face.points = left;
        const created = this.addFace(right);
        created.offset = face.offset;
    }

    // Reverse order to safely add new faces in the same pass
    forEachFaceReverse(fn) {
        for (let i = this.faces.length - 1; i >= 0; i--) fn(this.faces[i]);
    }

    // Origami
    // Split face by plane 3d
    // 9 cases: left <0, on 0, right >0
    //         Current
    // last | < | 0 | > |
    //    < | 1 | 3 | 9 |
    //    0 | 6 | 4 | 7 |
    //    > | 8 | 5 | 2 |
    // Not exactly 0 for distance but epsilon = 10
    splitFaceByPlane3d(face, plane) {
        const left = [], right = [];
        let lastInter;
        const epsilon = 10;
        const side = (d) => (Math.abs(d) <= epsilon ? 0 : d < 0 ? -1 : 1);

        // Begin with the last point
        let last = face.points[face.points.length - 1];
        let dLast = Face.planeToPointSignedDistance(plane, last);
        for (const current of face.points) {
            // Segment from previous to current
            const dCurrent = Face.planeToPointSignedDistance(plane, current);
            const lastSide = side(dLast);
            const currSide = side(dCurrent);
            // last and current on the same side // 1, 2
            if (lastSide && lastSide === currSide) {
                (currSide < 0 ? left : right).push(current);
            }
            // current on plane // 3 4 5
            else if (currSide === 0) {
                left.push(current);
                right.push(current);
                lastInter = current;
            }
            // last on plane, current on left or right // 6 7
            else if (lastSide === 0) {
                (currSide < 0 ? left : right).push(current);
            }
            // last and current on different side, crossing // 8 9
            else {
                const inter = Face.intersectionPlaneSegment(plane, last, current);
                if (inter) {
                    Point.align2dFrom3d(last, current, inter);
                    lastInter = this.addIntersection3d(inter, left, right, dCurrent, current, last, lastInter);
                } else {
                    (currSide < 0 ? left : right).push(current);
                }
            }
            last = current;
            dLast = dCurrent;
        }

        // Modify initial face and add new face if not degenerated
        // Discard degenerated polygons artifacts (true 3d area, not xy projection)
        if (polygonArea3d(left) && polygonArea3d(right)) {
            this.commitSplit(face, left, right);
        }
    }

    addIntersection3d(inter, left, right, dCurrent, current, last, lastInter) {
        inter = this.addPoint(inter.xf, inter.yf, inter.x, inter.y, inter.z);
        left.push(inter);
        right.push(inter);
        (dCurrent < 0 ? left : right).push(current);

        // Set Segment [last,current] to [last,inter]
        const segment = this.getSegment(last, current);
        if (segment) Model.splitSegment(segment, last, inter);
        // Add a new segment
        this.addSegment(inter, current);

        // Eventually, if last intersection was on plane, add a segment from the last intersection to inter
        if (lastInter && inter !== lastInter) {
            this.addSegment(lastInter, inter);
            return undefined;
        }
        return inter;
    }

    splitFaceBySegment2d(face, a, b) {
        const left = [], right = [];
        const EPSILON = 1;
        // Segment from last to current
        let last = face.points[face.points.length - 1];
        let dLast = Face.distance2dLineToPoint(a, b, last); // Positive if on the right of the segment a,b
        // Discard if on the line but not on Segment
        if (Math.abs(dLast) < EPSILON && Segment.intersectionFlat(a, b, last, face.points[0]) === undefined) {
            return;
        }
        for (const current of face.points) {
            // Segment from previous to current
            const dCurrent = Face.distance2dLineToPoint(a, b, current);
            const lastSide = side2d(dLast, EPSILON);
            const currSide = side2d(dCurrent, EPSILON);
            if (lastSide === currSide) {
                // Last and current on the same side, or both on the line
                if (currSide < 0) left.push(current);
                else if (currSide > 0) right.push(current);
                else {
                    // Don't split face if inter is on the line but not on the segment ab
                    if (Segment.intersectionFlat(a, b, last, current) === undefined) return;
                    left.push(current);
                    right.push(current);
                }
            } else if (currSide === 0) {
                // Last off the line, current on the line
                if (Segment.intersectionFlat(a, b, last, current) === undefined) return;
                left.push(current);
                right.push(current);
            } else if (lastSide === 0) {
                // Last on the line, current on left or right
                (currSide < 0 ? left : right).push(current);
            } else {
                // Crossing: last on left current on right, or the reverse
                const inter = Segment.intersectionFlat(a, b, last, current);
                if (inter === undefined) return;
                // Origami: lift 2d intersection onto the 3d crease
                Point.align3dFrom2d(last, current, inter);
                this.addIntersectionPoint(inter, left, right, last, current);
                (currSide < 0 ? left : right).push(current);
            }
            last = current;
            dLast = dCurrent;
        }
        // Discard degenerated polygons artifacts
        // Modify initial face and add new face if not degenerated
        if (Math.abs(Face.area2dFlat(left)) > EPSILON && Math.abs(Face.area2dFlat(right)) > EPSILON) {
            this.commitSplit(face, left, right);
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
        if (!segment) return;
        if (segment.p1 === last) segment.p2 = inter;
        else if (segment.p2 === last) segment.p1 = inter;
        // else Segment already cut
    }

    splitSegmentByRatio2d(s, k) {
        this.splitSegmentOnPoint2d(s, new Point(
            s.p1.xf + k * (s.p2.xf - s.p1.xf),
            s.p1.yf + k * (s.p2.yf - s.p1.yf),
        ));
    }

    splitSegmentOnPoint2d(s, p) {
        // Align Point p on segment s in 2D
        const a = s.p1, b = s.p2;
        // Add this as a new point to the model
        p = this.addPoint(p.xf, p.yf);
        Point.align3dFrom2d(a, b, p);
        // Add the point p to both faces, between a and b
        for (const face of this.searchFacesWithAB(a, b)) {
            const pts = face.points;
            if (pts.includes(p)) continue;
            for (let i = 0; i < pts.length; i++) {
                const next = pts[(i + 1) % pts.length];
                if ((pts[i] === a && next === b) || (pts[i] === b && next === a)) {
                    pts.splice(i + 1, 0, p);
                    break;
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
        this.forEachFaceReverse((face) => this.splitFaceByPlane3d(face, plane));
    }

    // Split all faces by a segment two points on 2d crease pattern
    splitAllFacesBySegment2d(a, b) {
        this.forEachFaceReverse((face) => this.splitFaceBySegment2d(face, a, b));
    }

    // Split all faces by a line defined by two points on 2d crease pattern
    splitAllFacesByLine2d(a, b) {
        // Vector from a to b, extended
        const dx = (b.xf - a.xf) * 1000, dy = (b.yf - a.yf) * 1000;
        this.splitAllFacesBySegment2d(
            new Point(a.xf + dx, a.yf + dy),
            new Point(b.xf - dx, b.yf - dy),
        );
    }

    // Split faces across two points in 3d
    splitCross3d(p1, p2) {
        this.splitAllFacesByPlane3d(Plane.across(p1, p2));
    }

    // Split faces across two points in 2d
    splitCross2d(p1, p2) {
        const nx = p2.yf - p1.yf, ny = -(p2.xf - p1.xf); // x,y -> y,-x
        const mx = (p1.xf + p2.xf) / 2, my = (p1.yf + p2.yf) / 2;
        // Two points apart from the middle
        this.splitAllFacesByLine2d(new Point(mx + nx, my + ny), new Point(mx - nx, my - ny));
    }

    // Split faces by a plane passing by two points on xy orthogonal to z
    splitBy3d(p1, p2) {
        this.splitAllFacesByPlane3d(Plane.by(p1, p2));
    }

    // Split faces by a line passing by two points in 2d
    splitBy2d(p1, p2) {
        this.splitAllFacesBySegment2d(p1, p2);
    }

    // Split faces by a line perpendicular to [p1,p2] passing by point
    splitPerpendicular2d(s, point) {
        this.splitAllFacesBySegment2d(point, Segment.project2d(s, point));
    }

    // Split faces by a plane perpendicular to [p1,p2] passing by point
    splitPerpendicular3d(s, point) {
        this.splitAllFacesByPlane3d(Plane.orthogonal(s.p1, s.p2, point));
    }

    // Split faces by a plane between two lines [ab] [cd]
    bisector3d(a, b, c, d) {
        const {p, q} = Segment.closestSegment(a, b, c, d);
        // The closest line is just one point
        if (p.x === q.x && p.y === q.y && p.z === q.z) {
            // Choose points a and c far from center p (which could be a or c)
            const farther = (u, v) => Vector3.length3d(Vector3.sub(u, p)) > Vector3.length3d(Vector3.sub(v, p)) ? u : v;
            this.bisector3dPoints(farther(a, b), p, farther(c, d));
        } else {
            // Lines do not cross, parallel, there is a plane across the closest segment
            this.splitAllFacesByPlane3d(Plane.across(p, q));
        }
    }

    // Split faces by a line between two lines [ab] [cd]
    bisector2d(s1, s2) {
        const inter = Segment.intersection2dLines(s1.p1, s1.p2, s2.p1, s2.p2);
        if (inter) {
            // Farther from the intersection on each segment
            const a = Point.distance2d(inter, s1.p1) < Point.distance2d(inter, s1.p2) ? s1.p2 : s1.p1;
            const b = Point.distance2d(inter, s2.p1) < Point.distance2d(inter, s2.p2) ? s2.p2 : s2.p1;
            this.bisector2dPoints(a, inter, b);
        } else {
            // Lines do not cross, parallel: split by line from (p1+p2)/2 oriented by p1p2
            const middle = {xf: (s1.p1.xf + s2.p1.xf) / 2, yf: (s1.p1.yf + s2.p1.yf) / 2};
            const p1p2 = {xf: s1.p2.xf - s1.p1.xf, yf: s1.p2.yf - s1.p1.yf};
            this.splitAllFacesByLine2d(middle, {xf: middle.xf + p1p2.xf, yf: middle.yf + p1p2.yf});
        }
    }

    // Split faces by a plane between two segments [ap] [pc].
    bisector3dPoints(a, p, c) {
        // Project [a] on [p c] to get a symmetric point
        const k = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) / Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
        // e is on pc symmetric of a
        const e = new Vector3(p.x + k * (c.x - p.x), p.y + k * (c.y - p.y), p.z + k * (c.z - p.z));
        // Define Plane across a and e
        this.splitAllFacesByPlane3d(Plane.across(a, e));
    }

    // Split faces by a line between three points: A, B, C.
    bisector2dPoints(a, b, c) {
        // Two vectors from b to a and c
        const v1n = Point.normalise({xf: b.xf - a.xf, yf: b.yf - a.yf});
        const v2n = Point.normalise({xf: b.xf - c.xf, yf: b.yf - c.yf});
        // Two points from b aligned on ba and bc
        const p = {xf: b.xf + v1n.xf * 10, yf: b.yf + v1n.yf * 10};
        const q = {xf: b.xf + v2n.xf * 10, yf: b.yf + v2n.yf * 10};
        // Middle intersection
        this.splitAllFacesByLine2d(b, {xf: (p.xf + q.xf) / 2, yf: (p.yf + q.yf) / 2});
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
        list.forEach((p) => {
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
        let max = 0.1;
        // Iterate while the length difference between 2d and 3d is > 1e-3
        for (let i = 0; max > 0.001 && i < 200; i++) {
            max = 0;
            // Pm is the medium point
            const pm = new Vector3(0, 0, 0);
            for (const s of segments) {
                const lg3d = Segment.length3d(s) / this.scale;
                const lg2d = Segment.length2d(s); // Should not change
                const d = Math.abs(lg2d - lg3d);
                if (d > max) max = d;
                // Move B = A + AB * r with r = l2d / l3d
                // AB * r is based on length 3d to match length 2d
                const r = lg2d / lg3d;
                const other = s.p2 === point ? s.p1 : s.p1 === point ? s.p2 : null;
                if (!other) continue;
                pm.x += other.x + (point.x - other.x) * r;
                pm.y += other.y + (point.y - other.y) * r;
                pm.z += other.z + (point.z - other.z) * r;
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
            for (const point of list) {
                const d = Math.abs(this.adjust(point));
                if (d > max) max = d;
            }
        }
        return max;
    }

    // Checks segments and selects segments with anormal length
    checkSegments() {
        for (const s of this.segments) {
            const lg3d = Segment.length3d(s) / this.scale;
            const lg2d = Segment.length2d(s); // Should not change
            if (Math.abs(lg2d - lg3d) > 1) {
                s.select = true;
            }
        }
    }

    // Search all segments containing Point a
    searchSegmentsOnePoint(a) {
        return this.segments.filter((s) => s.p1 === a || s.p2 === a);
    }

    // Search faces containing a segment [a, b]
    searchFacesWithAB(a, b) {
        const seg = this.getSegment(a, b);
        if (seg) {
            const list = Segment.incidentFaces(this, seg);
            if (list.length > 0) return list;
        }
        // Fallback: faces that contain both vertices
        return this.faces.filter((f) => f.points.includes(a) && f.points.includes(b));
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
        points.forEach((p) => {
            p.x = p0.x;
            p.y = p0.y;
            p.z = p0.z;
        });
    }

    // Move on a segment s the following points.
    moveOnSegment(s, points) {
        const A = s.p1, B = s.p2;
        const lengthAB = Math.hypot(B.xf - A.xf, B.yf - A.yf);
        points.forEach((p) => {
            const t = lengthAB === 0 ? 0 : Math.hypot(p.xf - A.xf, p.yf - A.yf) / lengthAB;
            p.x = A.x + t * (B.x - A.x);
            p.y = A.y + t * (B.y - A.y);
            p.z = A.z + t * (B.z - A.z);
        });
    }

    // snap align points near each other, and round coordinates
    align() {
        this.points.forEach((p, i) => {
            if (Math.abs(p.z) <= 2) p.z = 0;
            p.x = Math.round(p.x * 100) / 100;
            p.y = Math.round(p.y * 100) / 100;
            p.z = Math.round(p.z * 100) / 100;
            this.points.slice(i + 1).forEach((q) => {
                if (Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 1) {
                    q.x = p.x;
                    q.y = p.y;
                    q.z = p.z;
                }
            });
        });
    }

    // Turn the model around axis by angle
    turn(axe, angle) {
        this.rotate(axe, angle, this.points);
    }

    // Faces that move with a fold: at least one vertex in `points` besides the axis ends
    movingFaces(s, points) {
        const moving = new Set(points);
        return this.faces.filter((f) =>
            f.points.some((p) => moving.has(p) && p !== s.p1 && p !== s.p2)
        );
    }

    // Offset those faces. `layer` uses the same unit as the offset command (1 => 0.01).
    // Call once at the start of a fold, not every animation frame.
    // Sign of angle chooses the side (valley vs mountain). Heuristic: works for a
    // simple flap; not a general layer stack (see offset comment in View3d).
    offsetForFold(s, points, angle, layer = 1) {
        const faces = this.movingFaces(s, points);
        if (!faces.length || !layer || !angle) return faces;
        this.offset(Math.sign(angle) * layer / 10, faces);
        return faces;
    }

    // Valley fold: offset moving faces then rotate (angle in degrees)
    fold(s, angle, points, layer = 1) {
        this.offsetForFold(s, points, angle, layer);
        this.rotate(s, angle, points);
    }

    // Mountain fold: opposite offset sign, same rotation
    mountain(s, angle, points, layer = 1) {
        this.offsetForFold(s, points, -angle, layer);
        this.rotate(s, angle, points);
    }

    // Fold then adjust 3d lengths of the moved points (typical `r … a p…`)
    foldFlat(s, angle, points, layer = 1) {
        this.fold(s, angle, points, layer);
        this.adjustList(points.length ? points : this.points);
    }

    // Offset faces by dz
    offset(dz, faces) {
        if (dz === 0 || faces.length === 0) {
            this.faces.forEach((face) => { face.offset = 0; });
        } else {
            faces.forEach((face) => { face.offset += dz / 10; });
        }
    }

    // Bounds helper [xMin, yMin, xMax, yMax]
    bounds(getX, getY) {
        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        this.points.forEach((p) => {
            xMin = Math.min(xMin, getX(p));
            xMax = Math.max(xMax, getX(p));
            yMin = Math.min(yMin, getY(p));
            yMax = Math.max(yMax, getY(p));
        });
        return {xMin, xMax, yMin, yMax};
    }

    // 2d Boundary [xMin, yMin, xMax, yMax]
    get2DBounds() {
        return this.bounds((p) => p.xf, (p) => p.yf);
    }

    // 3D Boundary View [xMin, yMin, xMax, yMax]
    get3DBounds() {
        return this.bounds((p) => p.x, (p) => p.y);
    }

    // Scale model @testOK
    scaleModel(scale) {
        this.scale *= scale;
        this.points.forEach((p) => {
            p.x *= scale;
            p.y *= scale;
            p.z *= scale;
        });
    }

    // Serialize the model, replace instances by indexes in JSON, and return a JSON string
    serialize() {
        // Non-serialized / UI-only fields
        const exclude = new Set(['hidden']);
        const pointIndex = new Map(this.points.map((p, i) => [p, i]));
        // Define a replacer function to convert instances into indexes in JSON
        const replacer = (key, value) => {
            if (value instanceof Segment) return {p1: pointIndex.get(value.p1), p2: pointIndex.get(value.p2)};
            if (value instanceof Face) return {points: value.points.map((p) => pointIndex.get(p)), offset: value.offset};
            if (exclude.has(key)) return undefined;
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
        if (key === 'points' && Array.isArray(value) && value.every((p) => p !== null && typeof p === 'object')) {
            return value.map((p) => new Point(p.xf, p.yf, p.x, p.y, p.z));
        }
        if (key === 'segments') {
            return value.map((segment) => new Segment(this.points[segment.p1], this.points[segment.p2]));
        }
        if (key === 'faces') {
            return value.map((face) => {
                const newFace = new Face(face.points.map((index) => this.points[index]));
                newFace.offset = face.offset;
                return newFace;
            });
        }
        return value;
    }

    // Get a segment from two points
    getSegment(p1, p2) {
        return this.segments.find((s) =>
            (s.p1 === p1 && s.p2 === p2) || (s.p1 === p2 && s.p2 === p1)
        );
    }
}
