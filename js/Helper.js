import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Vector3} from './Vector3.js';
import * as mat4 from './lib/mat4.js';

export class Helper {
    constructor(model, command, canvas2d, view3d, overlay) {
        this.model = model;
        this.command = command;
        this.canvas2d = canvas2d;
        this.view3d = view3d;
        this.overlay = overlay;
        this.touchTime = 0;
        this.label = undefined;
        // Mouse coordinates, first and current
        this.firstX = this.firstY = this.currentX = this.currentY = undefined;
        // Point, segment, or face selected on down
        this.downPoint = this.downSegment = this.downFace = undefined;
        this.upPoint = this.upSegment = this.upFace = undefined;
        // Drag of an already-selected point → move command
        this.moving = false;
        this.moveSegment = undefined;
        this.shiftKey = false;
        this.altKey = false;

        // Current canvas: 2d or 3d
        this.currentCanvas = undefined;
        // To test with Deno overlay is null
        if (overlay) {
            // 3d
            overlay.addEventListener('pointerdown', (event) => this.down3d(event));
            overlay.addEventListener('pointermove', (event) => this.move3d(event));
            overlay.addEventListener('pointerup', (event) => this.up3d(event));
            overlay.addEventListener('pointercancel', (event) => this.out(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('contextmenu', (event) => {event.preventDefault();});
            // 2d — pointer* covers mouse and touch
            canvas2d.addEventListener('pointerdown', (event) => {
                try { canvas2d.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                this.down2d(event);
            });
            canvas2d.addEventListener('pointermove', (event) => this.move2d(event));
            canvas2d.addEventListener('pointerup', (event) => this.up2d(event));
            canvas2d.addEventListener('pointercancel', (event) => this.out(event));
            // Keyboard
            document.addEventListener('keydown', (event) => this.keydown(event));
        }
        this.out();
    }
    keydown(event) {
        // Control Z to undo
        if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
            this.command.command('undo');
        }
    }

    // Helper method to get formatted object string id (e.g. 'p0', 's1', 'f2')
    id(obj) {
        if (!obj) return '';
        if (this.model.points.includes(obj)) return 'p' + this.model.indexOf(obj);
        if (this.model.segments.includes(obj)) return 's' + this.model.indexOf(obj);
        if (this.model.faces.includes(obj)) return 'f' + this.model.indexOf(obj);
        return '';
    }

    // init properties
    out() {
        this.downPoint = this.downSegment = this.downFace = undefined;
        this.upPoint = this.upSegment = this.upFace = undefined;
        this.currentCanvas = this.label = undefined;
        this.moving = false;
        this.moveSegment = undefined;
        this.shiftKey = false;
        this.altKey = false;
        this.rawX = this.rawY = undefined;
    }

    // Draw only if a point, segment, or face is selected
    draw() {
        if (!this.downPoint && !this.downSegment && !this.downFace) {
            return;
        }
        const context = (this.currentCanvas === '2d' ? this.canvas2d : this.overlay).getContext('2d');
        context.lineWidth = 4;
        context.lineCap = 'round';
        context.strokeStyle = this.moving ? 'orange' : 'green';
        context.beginPath();
        context.moveTo(this.firstX, this.firstY);
        context.lineTo(this.currentX, this.currentY);
        context.stroke();
        if (this.label) {
            // Circle
            const radius = 18;
            context.fillStyle = 'skyblue';
            context.beginPath();
            context.arc(this.currentX, this.currentY - 16, radius, 0, 2 * Math.PI);
            context.stroke();
            context.fill();
            // Text
            context.fillStyle = 'black';
            context.font = '20px serif';
            context.fillText(this.label, this.currentX - 10, this.currentY - 8);
        }
    }

    // Logic begins here
    down(points, segments, faces, x, y) {
        this.downPoint = points[0];
        this.downSegment = !this.downPoint ? segments[0] : undefined;
        this.downFace = !this.downPoint && !this.downSegment ? faces[0] : undefined;
        this.firstX = this.currentX = this.rawX = x;
        this.firstY = this.currentY = this.rawY = y;
        // Move starts from a point that is already selected (2D and 3D)
        this.moving = !!(this.downPoint && this.downPoint.select);
        this.moveSegment = undefined;
        if (this.moving && this.downPoint) {
            const segs = this.model.searchSegmentsOnePoint(this.downPoint);
            this.moveSegment = segs.find(s => s.select);
        }
    }

    // Signed rotation angle (degrees) from ref point to cursor, around segment.
    rotationLabel(s, refX, refY, x, y) {
        let distToFirst, distToCurrent;
        if (this.currentCanvas === '2d') {
            // Signed distance from the reference point to segment.
            distToFirst = (refX - s.p1.xf) * (s.p2.yf - s.p1.yf) - (refY - s.p1.yf) * (s.p2.xf - s.p1.xf);
            // Signed distance from current point to segment. Which is cos(angle) * distToFirst.
            distToCurrent = (x - s.p1.xf) * (s.p2.yf - s.p1.yf) - (-y - s.p1.yf) * (s.p2.xf - s.p1.xf); // Note inverse y
        } else {
            const p1Proj = [s.p1.xCanvas, s.p1.yCanvas], p2Proj = [s.p2.xCanvas, s.p2.yCanvas];
            distToFirst = (refX - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (refY - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
            distToCurrent = (x - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (y - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
        }
        if (Math.abs(distToFirst) < 1e-6) return 0;
        // Clamp ratio = distToCurrent/distToFirst
        let ratio = Math.abs(distToCurrent / distToFirst);
        ratio = Math.round(ratio * 100) / 100;
        // Angle in degrees
        let angle = (ratio - 1) * 180 * -Math.sign(distToFirst);
        // Round to step 10
        angle = Math.round(angle / 10) * 10;
        // Clamp near-zero angle to 0
        return Math.abs(angle) < 10 ? 0 : angle;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        if (this.downPoint) {
            this.downPoint.hover = true;
            // Rotation preview only when not dragging a selected point to move it
            const s = this.model.segments.find(s => s.select);
            if (s && !this.moving) {
                // Deselect other segments
                this.model.segments.filter(sg => sg.select && sg !== s).forEach(sg => sg.select = false);
                // The point we move from
                const p = this.downPoint;
                p.select = true;
                const refX = this.currentCanvas === '2d' ? p.xf : p.xCanvas;
                const refY = this.currentCanvas === '2d' ? p.yf : p.yCanvas;
                this.label = this.rotationLabel(s, refX, refY, x, y);
            }
        } else if (this.downSegment) {
            this.downSegment.hover = true;
        }
        this.currentX = this.rawX = x;
        this.currentY = this.rawY = y;
        if (this.moving && this.currentCanvas === '2d' && this.downPoint) {
            const c = this.constrain2dToSegment(
                this.downPoint,
                x - this.firstX,
                -(y - this.firstY),
            );
            this.currentX = this.firstX + c.dx;
            this.currentY = this.firstY - c.dy;
        }
    }

    up(points, segments, faces) {
        this.upPoint = points[0];
        this.upSegment = !this.upPoint ? segments[0] : undefined;
        this.upFace = !this.upPoint && !this.upSegment ? faces[0] : undefined;

        if (this.downPoint) this.fromPoint();
        else if (this.downSegment) this.fromSegment();
        else if (this.downFace) this.fromFace();
        else {
            this.model.points.forEach(p => p.select = false);
            this.model.segments.forEach(s => s.select = false);
            this.model.faces.forEach(f => f.select = false);
        }
        this.out();
    }

    fromPoint() {
        if (this.moving) {
            this.moveSelectedPoint();
            return;
        }
        if (this.upPoint) {
            if (this.downPoint === this.upPoint) {
                this.downPoint.select = !this.downPoint.select;
            } else {
                const cmd = this.model.getSegment(this.downPoint, this.upPoint) ? 'across' : 'by';
                this.sendCmd(cmd, this.downPoint, this.upPoint);
            }
        } else if (this.label) {
            this.rotatePoints();
        } else if (this.upSegment) {
            this.sendCmd('p', this.upSegment, this.downPoint);
        }
    }

    // Click on a selected point: deselect. Drag: move then adjust and check.
    moveSelectedPoint() {
        const dist = Math.hypot(
            (this.rawX ?? this.currentX) - this.firstX,
            (this.rawY ?? this.currentY) - this.firstY,
        );
        if (dist < 4) {
            this.downPoint.select = !this.downPoint.select;
            return;
        }
        const moveIds = this.idsOf(this.pointsToMove());
        const adjIds = this.idsOf(this.pointsToAdjust());
        const round = (n) => Math.round(n * 10) / 10;
        let cmd;
        if (this.currentCanvas === '2d') {
            const {dx, dy} = this.constrain2dToSegment(
                this.downPoint,
                this.currentX - this.firstX,
                -(this.currentY - this.firstY),
            );
            if (round(dx) === 0 && round(dy) === 0) return;
            cmd = `move2d ${round(dx)} ${round(dy)} ${moveIds} adjust ${adjIds} check`;
        } else {
            const {dx, dy, dz} = this.dragToWorld();
            if (dx === 0 && dy === 0 && dz === 0) return;
            cmd = `move ${dx} ${dy} ${dz} ${moveIds} adjust ${adjIds} check`;
        }
        this.command.command(cmd);
    }

    idsOf(objs) {
        return objs.map(o => this.id(o)).join(' ');
    }

    useMoveAll() {
        return this.shiftKey || this.model.moveAll;
    }

    useAdjustLinked() {
        return this.altKey || this.model.adjustLinked;
    }

    pointsToMove() {
        if (this.useMoveAll()) {
            const selected = this.model.points.filter(p => p.select);
            if (this.downPoint && !selected.includes(this.downPoint)) selected.unshift(this.downPoint);
            return selected.length ? selected : [this.downPoint];
        }
        return [this.downPoint];
    }

    pointsToAdjust() {
        const pts = [...this.pointsToMove()];
        if (this.useAdjustLinked()) {
            for (const p of [...pts]) {
                for (const s of this.model.searchSegmentsOnePoint(p)) {
                    const other = s.p1 === p ? s.p2 : s.p1;
                    if (!pts.includes(other)) pts.push(other);
                }
            }
        }
        return pts;
    }

    pickMoveSegment(point, dx, dy) {
        const segs = this.model.searchSegmentsOnePoint(point);
        if (segs.length === 0) return undefined;
        if (this.moveSegment && segs.includes(this.moveSegment)) return this.moveSegment;
        const selected = segs.find(s => s.select);
        if (selected) return selected;
        let best = segs[0], bestScore = -1;
        for (const s of segs) {
            const other = s.p1 === point ? s.p2 : s.p1;
            const vx = other.xf - point.xf, vy = other.yf - point.yf;
            const len = Math.hypot(vx, vy) || 1;
            const score = Math.abs(dx * vx + dy * vy) / len;
            if (score > bestScore) {
                bestScore = score;
                best = s;
            }
        }
        return best;
    }

    facesRemainConvex2d(point, dx, dy) {
        const faces = this.model.faces.filter(f => f.points.includes(point));
        const signs = faces.map(f => Math.sign(Face.area2dFlat(f.points)));
        point.xf += dx;
        point.yf += dy;
        let ok = true;
        for (let i = 0; i < faces.length; i++) {
            const area = Face.area2dFlat(faces[i].points);
            if (!Face.isConvex2d(faces[i]) || Math.sign(area) !== signs[i]) {
                ok = false;
                break;
            }
        }
        point.xf -= dx;
        point.yf -= dy;
        return ok;
    }

    // Project 2D drag onto an incident segment; clamp so faces stay convex.
    constrain2dToSegment(point, dx, dy) {
        const zero = {dx: 0, dy: 0};
        if (!point) return zero;
        const s = this.pickMoveSegment(point, dx, dy);
        if (!s) return zero;
        this.moveSegment = s;
        const other = s.p1 === point ? s.p2 : s.p1;
        const vx = other.xf - point.xf, vy = other.yf - point.yf;
        const len2 = vx * vx + vy * vy;
        if (len2 < 1e-12) return zero;
        const len = Math.sqrt(len2);
        let t = (dx * vx + dy * vy) / len2;
        const tmax = Math.max(0, 1 - Math.min(0.02, 2 / len));
        t = Math.max(0, Math.min(t, tmax));
        const ok = (tt) => this.facesRemainConvex2d(point, tt * vx, tt * vy);
        if (!ok(t)) {
            let lo = 0, hi = t;
            for (let i = 0; i < 16; i++) {
                const mid = (lo + hi) / 2;
                if (ok(mid)) lo = mid;
                else hi = mid;
            }
            t = lo;
        }
        return {dx: t * vx, dy: t * vy};
    }

    dragToWorld() {
        const round = (n) => Math.round(n * 10) / 10;
        const delta = this.currentCanvas === '3d'
            ? this.canvasDragToWorld3d(this.firstX, this.firstY, this.currentX, this.currentY, this.downPoint)
            : {dx: this.currentX - this.firstX, dy: -(this.currentY - this.firstY), dz: 0};
        return {dx: round(delta.dx), dy: round(delta.dy), dz: round(delta.dz)};
    }

    // Unproject overlay drag at the point's projected depth (screen-parallel plane).
    canvasDragToWorld3d(x0, y0, x1, y1, point) {
        const fallback = {dx: x1 - x0, dy: -(y1 - y0), dz: 0};
        const m = this.view3d?.canvasView;
        if (!m || !point) return fallback;
        const inv = mat4.invert(mat4.create(), m);
        if (!inv) return fallback;
        const z = Vector3.transformMat4(point, m).z;
        const world0 = Vector3.transformMat4({x: x0, y: y0, z}, inv);
        const world1 = Vector3.transformMat4({x: x1, y: y1, z}, inv);
        return {
            dx: world1.x - world0.x,
            dy: world1.y - world0.y,
            dz: world1.z - world0.z,
        };
    }

    fromSegment() {
        if (this.upSegment) {
            if (this.upSegment === this.downSegment) {
                this.downSegment.select = !this.downSegment.select;
                this.command.command(`// Différences ${this.model.indexOf(this.downSegment)} ${Segment.length2d(this.downSegment)} ${Segment.length3d(this.downSegment)}`);
            } else {
                this.sendCmd('bisector', this.downSegment, this.upSegment);
            }
        } else if (this.upPoint) {
            this.sendCmd('p', this.downSegment, this.upPoint);
        }
    }

    fromFace() {
        if (this.upFace === this.downFace) {
            this.downFace.select = !this.downFace.select;
            this.command.command(`// face ${this.model.indexOf(this.downFace)} offset ${this.downFace.offset} `);
        } else if (this.upFace) {
            this.fromFaceToFace(this.downFace, this.upFace);
        } else {
            this.splitSegments();
        }
    }

    fromFaceToFace(f1, f2) {
        this.command.command(`// From ${this.id(f1)} to ${this.id(f2)}`);
        this.model.faces.filter(f => f.select).forEach(f => {
            this.command.command(`// Selected ${this.id(f)}`);
        });
    }

    faceCentroid(face) {
        let xf = 0, yf = 0;
        for (const p of face.points) {
            xf += p.xf;
            yf += p.yf;
        }
        return {xf: xf / face.points.length, yf: yf / face.points.length};
    }

    faceCentroidCanvas(face) {
        let xCanvas = 0, yCanvas = 0;
        for (const p of face.points) {
            xCanvas += p.xCanvas;
            yCanvas += p.yCanvas;
        }
        return {
            xCanvas: xCanvas / face.points.length,
            yCanvas: yCanvas / face.points.length,
        };
    }

    splitSegments() {
        this.command.command(`// To another face Split`);
        const is2d = this.currentCanvas === '2d';
        const ySign = is2d ? -1 : 1;
        const first = {xf: this.firstX, yf: ySign * this.firstY};
        const current = {xf: this.currentX, yf: ySign * this.currentY};
        this.model.segments.forEach((s, i) => {
            const p1 = is2d ? s.p1 : {xf: s.p1.xCanvas, yf: s.p1.yCanvas};
            const p2 = is2d ? s.p2 : {xf: s.p2.xCanvas, yf: s.p2.yCanvas};
            const inter = Segment.intersectionFlat(first, current, p1, p2);
            if (inter) {
                const ratio = Math.hypot(inter.xf - p1.xf, inter.yf - p1.yf) / Math.hypot(p2.xf - p1.xf, p2.yf - p1.yf);
                // Use local temps so flat paper (z===0) is not mutated as a side effect
                const z1 = s.p1.z || 0.1;
                const z2 = s.p2.z || 0.1;
                const t = Math.round((is2d ? ratio : (ratio * z1) / ((1 - ratio) * z2 + ratio * z1)) * 100) / 100;
                this.command.command(`split s${i} ${t}`);
            }
        });
    }

    sendCmd(base, ...objs) {
        const suffix = this.currentCanvas === '2d' ? '2d' : '3d';
        const args = objs.map(o => typeof o === 'string' ? o : this.id(o));
        this.command.command(`${base}${suffix} ${args.join(' ')}`);
    }

    readKeys(event) {
        if (event?.shiftKey !== undefined) this.shiftKey = !!event.shiftKey;
        if (event?.altKey !== undefined) this.altKey = !!event.altKey;
    }

    // Rotate selected points around selected segment
    rotatePoints() {
        const s = this.model.segments.find(s => s.select);
        const pts = this.model.points.filter(p => p.select).map(p => this.id(p));
        this.command.command(`t 1000 r ${this.id(s)} ${this.label} ${pts.join(' ')}`);
    }

    // Flat 2d
    event2d(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.canvas2d.getBoundingClientRect();
        const x = (event.clientX - rect.left) * this.canvas2d.width / rect.width;
        const y = (event.clientY - rect.top) * this.canvas2d.height / rect.height;
        const context2d = this.canvas2d.getContext('2d');
        const transform = context2d.getTransform();
        const p = new DOMPoint(x, y);
        const q = transform.inverse().transformPoint(p);
        return {
            xf: q.x,
            yf: -q.y, // Note inverse y coordinate
        };
    }
    // Points, then segments, then faces near xf, yf
    search2d(xf, yf) {
        // Points near xf, yf
        const points = this.model.points.filter(p => Math.hypot(p.xf - xf, p.yf - yf) < 10);
        // Segments near xf, yf
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < 4);
        // Face containing xf, yf
        const faces = this.model.faces.filter(f => Face.contains2d(f, xf, yf));
        return {points, segments, faces};
    }
    // Down on flat 2d
    down2d(event) {
        this.currentCanvas = '2d';
        this.readKeys(event);
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.down(points, segments, faces, xf, -yf); // Note inverse y coordinate
    }
    // Move on flat 2d
    move2d(event) {
        this.currentCanvas = '2d';
        this.readKeys(event);
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.move(points, segments, faces, xf, -yf);
    }
    // Up on flat 2d
    up2d(event) {
        this.readKeys(event);
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.up(points, segments, faces);
    }

    // Canvas 3d
    eventCanvas3d(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.overlay.getBoundingClientRect();
        return {
            xCanvas: event.clientX - rect.left,
            yCanvas: event.clientY - rect.top,
        };
    }
    // Points, then segments, then faces near xCanvas, yCanvas
    pickFaces3d(xCanvas, yCanvas, contextFace = undefined) {
        let faces = this.model.faces.filter(f =>
            Face.contains3d(f, xCanvas, yCanvas, this.view3d),
        );
        if (contextFace) {
            faces = faces.filter(f =>
                f !== contextFace &&
                this.model.sharedSegments(contextFace, f).length > 0,
            );
        }
        if (this.view3d?.faceDepth) {
            faces.sort((a, b) => this.view3d.faceDepth(a) - this.view3d.faceDepth(b));
        }
        return faces;
    }

    search3d(xCanvas, yCanvas, contextFace = undefined) {
        // Points near xCanvas, yCanvas
        const points = this.model.points.filter(p => Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 10);
        // Segments near xCanvas, yCanvas
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas) < 6);
        // Faces under cursor: depth-sorted; when contextFace set, adjacent faces only
        const faces = this.pickFaces3d(xCanvas, yCanvas, contextFace);
        return {points, segments, faces};
    }
    // Down on 3d overlay
    down3d(event) {
        this.currentCanvas = '3d';
        this.readKeys(event);
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
    }

    // Move on 3d overlay
    move3d(event) {
        this.currentCanvas = '3d';
        this.readKeys(event);
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const contextFace = this.downFace || undefined;
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas, contextFace);
        // Handle 3d rotation
        if (points.length === 0 && segments.length === 0 && faces.length === 0
            && event.buttons === 1
            && !this.downPoint && !this.downSegment && !this.downFace) {
            // Rotation
            const factor = (600 / event.target.height) ;
            const dx = factor * (xCanvas - this.currentX);
            const dy = factor * (yCanvas - this.currentY);
            this.view3d.angleX += dy;
            this.view3d.angleY += dx;
        } else if ((event.buttons & 2) > 0) {
            // Translation
            const dx = (xCanvas - this.currentX);
            const dy = (yCanvas - this.currentY);
            this.view3d.translationY -= dy;
            this.view3d.translationX += dx;
        }
        this.move(points, segments, faces, xCanvas, yCanvas);
        this.view3d.initModelView();
        this.view3d.initPerspective();
    }
    // Up on 3d overlay
    up3d(event) {
        this.readKeys(event);
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.up(points, segments, faces);
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
    }

    // Mouse wheel on 3d overlay
    wheel(event) {
        // deltaY => up or down zoom view
        this.view3d.scale = event.scale !== undefined ? event.scale / 10 : this.view3d.scale + event.deltaY / 300;
        this.view3d.scale = Math.max(0.2, Math.min(3, this.view3d.scale)); // 0.2 < scale < 3
        this.view3d.initModelView();
        this.view3d.initPerspective();
    }

    doubleClick() {
        if (Date.now() - this.touchTime < 400) {
            this.view3d.angleX = this.view3d.angleY = this.view3d.angleZ = 0;
            this.view3d.translationX = this.view3d.translationY = 0;
            this.view3d.scale = 1;
            this.command.command('fit');
        }
        this.touchTime = Date.now();
    }
}
