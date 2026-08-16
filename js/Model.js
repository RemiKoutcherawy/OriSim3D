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

function side2d(d, epsilon) {
    return d < -epsilon ? -1 : d > epsilon ? 1 : 0;
}

export class Model {

    constructor() {
        this.points = [];
        this.segments = [];
        this.faces = [];
        this.state = State.run;
        this.scale = 1;
        this.labels = false;
        this.textures = false;
        this.overlay = false;
        this.lines = false;
        this.snap = false;
    }

    init(width = 200, height = 200) {
        this.points = [];
        this.segments = [];
        this.faces = [];
        const p0 = new Point(-width, -height, -width, -height, 0);
        const p1 = new Point(width, -height, width, -height, 0);
        const p2 = new Point(width, height, width, height, 0);
        const p3 = new Point(-width, height, -width, height, 0);
        this.points.push(p0, p1, p2, p3);
        this.segments.push(new Segment(p0, p1), new Segment(p1, p2), new Segment(p2, p3), new Segment(p3, p0));
        this.faces.push(new Face([p0, p1, p2, p3]));
        this.state = State.run;
        this.labels = true;
        this.textures = false;
        this.overlay = true;
        this.lines = true;
        this.snap = true;
        return this;
    }

    firstHit(points, segments, faces) {
        return points.length ? points : segments.length ? segments : faces;
    }

    hover2d3d(points, segments, faces) {
        this.points.forEach((p) => { p.hover = false; });
        this.segments.forEach((s) => { s.hover = false; });
        this.faces.forEach((f) => { f.hover = false; });
        this.firstHit(points, segments, faces).forEach((o) => { o.hover = true; });
    }

    click2d3d(points, segments, faces) {
        this.firstHit(points, segments, faces).forEach((o) => { o.select = !o.select; });
    }

    indexOf(object) {
        if (object instanceof Point) return this.points.indexOf(object);
        if (object instanceof Segment) return this.segments.indexOf(object);
        if (object instanceof Face) return this.faces.indexOf(object);
        return -1;
    }

    getPoint(xf, yf, epsilon = 2) {
        return this.points.find((p) => Math.abs(p.xf - xf) + Math.abs(p.yf - yf) < epsilon);
    }

    addPoint(xf, yf, x, y, z) {
        const existing = this.getPoint(xf, yf);
        if (existing) return existing;
        const point = new Point(xf, yf, x, y, z);
        this.points.push(point);
        return point;
    }

    addSegment(a, b) {
        const existing = this.getSegment(a, b);
        if (existing) return existing;
        const segment = new Segment(a, b);
        this.segments.push(segment);
        return segment;
    }

    getFace(points) {
        return this.faces.find((f) =>
            f.points.length === points.length && f.points.every((p, i) => p === points[i])
        );
    }

    addFace(points) {
        const existing = this.getFace(points);
        if (existing) return existing;
        points.forEach((p, i, a) => this.addSegment(p, a[(i + 1) % a.length]));
        const face = new Face(points);
        this.faces.push(face);
        return face;
    }

    commitSplit(face, left, right) {
        face.points = left;
        const created = this.addFace(right);
        created.offset = face.offset;
    }

    // Reverse so newly added faces are not visited in the same pass
    forEachFaceReverse(fn) {
        for (let i = this.faces.length - 1; i >= 0; i--) fn(this.faces[i]);
    }

    // Split face by plane 3d. 9 cases: left <0, on 0, right >0
    splitFaceByPlane3d(face, plane) {
        const left = [], right = [];
        let lastInter;
        const epsilon = 10;
        const side = (d) => (Math.abs(d) <= epsilon ? 0 : d < 0 ? -1 : 1);

        let last = face.points[face.points.length - 1];
        let dLast = Face.planeToPointSignedDistance(plane, last);
        for (const current of face.points) {
            const dCurrent = Face.planeToPointSignedDistance(plane, current);
            const lastSide = side(dLast);
            const currSide = side(dCurrent);
            if (lastSide && lastSide === currSide) {
                (currSide < 0 ? left : right).push(current);
            } else if (currSide === 0) {
                left.push(current);
                right.push(current);
                lastInter = current;
            } else if (lastSide === 0) {
                (currSide < 0 ? left : right).push(current);
            } else {
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

        if (polygonArea3d(left) && polygonArea3d(right)) {
            this.commitSplit(face, left, right);
        }
    }

    addIntersection3d(inter, left, right, dCurrent, current, last, lastInter) {
        inter = this.addPoint(inter.xf, inter.yf, inter.x, inter.y, inter.z);
        left.push(inter);
        right.push(inter);
        (dCurrent < 0 ? left : right).push(current);

        const segment = this.getSegment(last, current);
        if (segment) Model.splitSegment(segment, last, inter);
        this.addSegment(inter, current);

        if (lastInter && inter !== lastInter) {
            this.addSegment(lastInter, inter);
            return undefined;
        }
        return inter;
    }

    splitFaceBySegment2d(face, a, b) {
        const left = [], right = [];
        const EPSILON = 1;
        let last = face.points[face.points.length - 1];
        let dLast = Face.distance2dLineToPoint(a, b, last);
        if (Math.abs(dLast) < EPSILON && Segment.intersectionFlat(a, b, last, face.points[0]) === undefined) {
            return;
        }
        for (const current of face.points) {
            const dCurrent = Face.distance2dLineToPoint(a, b, current);
            const lastSide = side2d(dLast, EPSILON);
            const currSide = side2d(dCurrent, EPSILON);
            if (lastSide === currSide) {
                if (currSide < 0) left.push(current);
                else if (currSide > 0) right.push(current);
                else {
                    if (Segment.intersectionFlat(a, b, last, current) === undefined) return;
                    left.push(current);
                    right.push(current);
                }
            } else if (currSide === 0) {
                if (Segment.intersectionFlat(a, b, last, current) === undefined) return;
                left.push(current);
                right.push(current);
            } else if (lastSide === 0) {
                (currSide < 0 ? left : right).push(current);
            } else {
                const inter = Segment.intersectionFlat(a, b, last, current);
                if (inter === undefined) return;
                Point.align3dFrom2d(last, current, inter);
                this.addIntersectionPoint(inter, left, right, last, current);
                (currSide < 0 ? left : right).push(current);
            }
            last = current;
            dLast = dCurrent;
        }
        if (Math.abs(Face.area2dFlat(left)) > EPSILON && Math.abs(Face.area2dFlat(right)) > EPSILON) {
            this.commitSplit(face, left, right);
        }
    }

    addIntersectionPoint(inter, left, right, last, current) {
        inter = this.addPoint(inter.xf, inter.yf, inter.x, inter.y, inter.z);
        left.push(inter);
        right.push(inter);
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
    }

    splitSegmentByRatio2d(s, k) {
        this.splitSegmentOnPoint2d(s, new Point(
            s.p1.xf + k * (s.p2.xf - s.p1.xf),
            s.p1.yf + k * (s.p2.yf - s.p1.yf),
        ));
    }

    splitSegmentOnPoint2d(s, p) {
        const a = s.p1, b = s.p2;
        p = this.addPoint(p.xf, p.yf);
        Point.align3dFrom2d(a, b, p);
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
        Model.splitSegment(s, a, p);
        this.addSegment(p, b);
        return s;
    }

    splitAllFacesByPlane3d(plane) {
        this.forEachFaceReverse((face) => this.splitFaceByPlane3d(face, plane));
    }

    splitAllFacesBySegment2d(a, b) {
        this.forEachFaceReverse((face) => this.splitFaceBySegment2d(face, a, b));
    }

    splitAllFacesByLine2d(a, b) {
        const dx = (b.xf - a.xf) * 1000, dy = (b.yf - a.yf) * 1000;
        this.splitAllFacesBySegment2d(
            new Point(a.xf + dx, a.yf + dy),
            new Point(b.xf - dx, b.yf - dy),
        );
    }

    splitCross3d(p1, p2) {
        this.splitAllFacesByPlane3d(Plane.across(p1, p2));
    }

    splitCross2d(p1, p2) {
        const nx = p2.yf - p1.yf, ny = -(p2.xf - p1.xf);
        const mx = (p1.xf + p2.xf) / 2, my = (p1.yf + p2.yf) / 2;
        this.splitAllFacesByLine2d(new Point(mx + nx, my + ny), new Point(mx - nx, my - ny));
    }

    splitBy3d(p1, p2) {
        this.splitAllFacesByPlane3d(Plane.by(p1, p2));
    }

    splitBy2d(p1, p2) {
        this.splitAllFacesBySegment2d(p1, p2);
    }

    splitPerpendicular2d(s, point) {
        this.splitAllFacesBySegment2d(point, Segment.project2d(s, point));
    }

    splitPerpendicular3d(s, point) {
        this.splitAllFacesByPlane3d(Plane.orthogonal(s.p1, s.p2, point));
    }

    bisector3d(a, b, c, d) {
        const {p, q} = Segment.closestSegment(a, b, c, d);
        if (p.x === q.x && p.y === q.y && p.z === q.z) {
            const farther = (u, v) => Vector3.length3d(Vector3.sub(u, p)) > Vector3.length3d(Vector3.sub(v, p)) ? u : v;
            this.bisector3dPoints(farther(a, b), p, farther(c, d));
        } else {
            this.splitAllFacesByPlane3d(Plane.across(p, q));
        }
    }

    bisector2d(s1, s2) {
        const inter = Segment.intersection2dLines(s1.p1, s1.p2, s2.p1, s2.p2);
        if (inter) {
            const a = Point.distance2d(inter, s1.p1) < Point.distance2d(inter, s1.p2) ? s1.p2 : s1.p1;
            const b = Point.distance2d(inter, s2.p1) < Point.distance2d(inter, s2.p2) ? s2.p2 : s2.p1;
            this.bisector2dPoints(a, inter, b);
        } else {
            const middle = {xf: (s1.p1.xf + s2.p1.xf) / 2, yf: (s1.p1.yf + s2.p1.yf) / 2};
            const p1p2 = {xf: s1.p2.xf - s1.p1.xf, yf: s1.p2.yf - s1.p1.yf};
            this.splitAllFacesByLine2d(middle, {xf: middle.xf + p1p2.xf, yf: middle.yf + p1p2.yf});
        }
    }

    bisector3dPoints(a, p, c) {
        const k = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z) / Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
        const e = new Vector3(p.x + k * (c.x - p.x), p.y + k * (c.y - p.y), p.z + k * (c.z - p.z));
        this.splitAllFacesByPlane3d(Plane.across(a, e));
    }

    bisector2dPoints(a, b, c) {
        const v1n = Point.normalise({xf: b.xf - a.xf, yf: b.yf - a.yf});
        const v2n = Point.normalise({xf: b.xf - c.xf, yf: b.yf - c.yf});
        const p = {xf: b.xf + v1n.xf * 10, yf: b.yf + v1n.yf * 10};
        const q = {xf: b.xf + v2n.xf * 10, yf: b.yf + v2n.yf * 10};
        this.splitAllFacesByLine2d(b, {xf: (p.xf + q.xf) / 2, yf: (p.yf + q.yf) / 2});
    }

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

    adjust(point) {
        const segments = this.searchSegmentsOnePoint(point);
        let max = 0.1;
        for (let i = 0; max > 0.001 && i < 200; i++) {
            max = 0;
            const pm = new Vector3(0, 0, 0);
            for (const s of segments) {
                const lg3d = Segment.length3d(s) / this.scale;
                const lg2d = Segment.length2d(s);
                const d = Math.abs(lg2d - lg3d);
                if (d > max) max = d;
                const r = lg2d / lg3d;
                const other = s.p2 === point ? s.p1 : s.p1 === point ? s.p2 : null;
                if (!other) continue;
                pm.x += other.x + (point.x - other.x) * r;
                pm.y += other.y + (point.y - other.y) * r;
                pm.z += other.z + (point.z - other.z) * r;
            }
            if (segments.length > 0) {
                point.x = pm.x / segments.length;
                point.y = pm.y / segments.length;
                point.z = pm.z / segments.length;
            }
        }
        return max;
    }

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

    checkSegments() {
        for (const s of this.segments) {
            if (Math.abs(Segment.length2d(s) - Segment.length3d(s) / this.scale) > 1) {
                s.select = true;
            }
        }
    }

    searchSegmentsOnePoint(a) {
        return this.segments.filter((s) => s.p1 === a || s.p2 === a);
    }

    searchFacesWithAB(a, b) {
        const seg = this.getSegment(a, b);
        if (seg) {
            const list = Segment.incidentFaces(this, seg);
            if (list?.length) return list;
        }
        return this.faces.filter((f) => f.points.includes(a) && f.points.includes(b));
    }

    movePoints(dx, dy, dz, points) {
        if (points.length === 0) points = this.points;
        points.forEach((p) => {
            p.x += dx;
            p.y += dy;
            p.z += dz;
        });
    }

    moveOnPoint(p0, points) {
        points.forEach((p) => {
            p.x = p0.x;
            p.y = p0.y;
            p.z = p0.z;
        });
    }

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

    turn(axe, angle) {
        this.rotate(axe, angle, this.points);
    }

    offset(dz, faces) {
        if (dz === 0 || faces.length === 0) {
            this.faces.forEach((face) => { face.offset = 0; });
        } else {
            faces.forEach((face) => { face.offset += dz / 10; });
        }
    }

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

    get2DBounds() {
        return this.bounds((p) => p.xf, (p) => p.yf);
    }

    get3DBounds() {
        return this.bounds((p) => p.x, (p) => p.y);
    }

    scaleModel(scale) {
        this.scale *= scale;
        this.points.forEach((p) => {
            p.x *= scale;
            p.y *= scale;
            p.z *= scale;
        });
    }

    serialize() {
        const exclude = new Set(['hidden']);
        const pointIndex = new Map(this.points.map((p, i) => [p, i]));
        const replacer = (key, value) => {
            if (value instanceof Segment) return {p1: pointIndex.get(value.p1), p2: pointIndex.get(value.p2)};
            if (value instanceof Face) return {points: value.points.map((p) => pointIndex.get(p)), offset: value.offset};
            if (exclude.has(key)) return undefined;
            return value;
        };
        return JSON.stringify(this, replacer);
    }

    deserialize(json) {
        return JSON.parse(json, this.reviver);
    }

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

    getSegment(p1, p2) {
        return this.segments.find((s) =>
            (s.p1 === p1 && s.p2 === p2) || (s.p1 === p2 && s.p2 === p1)
        );
    }
}
