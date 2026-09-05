import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Vector3} from './Vector3.js';
import {State} from './Model.js';
import * as mat4 from './lib/mat4.js';

const CLICK_PX_MOUSE = 12;
const CLICK_PX_TOUCH = 24;

// Gesture vocabulary (see README):
// - Click a point/segment/face toggles its selection (whole coincident stack);
//   holding Ctrl/Cmd targets only the exact one under the cursor.
// - Clicking a segment arms it as the fold axis (only one armed at a time).
// - Dragging point<->point, point<->segment or segment<->segment scores a new
//   crease. The plain drag runs a line directly through what was dragged; holding
//   Ctrl/Cmd instead makes the two dragged things coincide once folded.
//   Drag direction (screen up/down) sets the crease to mountain/valley.
// - Once an axis is armed, dragging a face that borders it folds that face (and
//   any other already-selected faces) around the axis — the axis stays armed
//   afterwards, so folding the other side along the same crease is a second plain drag.
// - Dragging on a face with no axis armed, crossing existing creases, splits
//   them at the crossing points (to create landmark points to crease between).
export class Helper {
    constructor(model, command, view3d, view2d) {
        this.model = model;
        this.command = command;
        this.view3d = view3d;
        this.view2d = view2d;
        this.touchTime = 0;
        this.lastClickPoints = [];
        this.pointerType = 'mouse';
        this.precise = false;
        // Mouse coordinates, first and current
        this.firstX = this.firstY = this.currentX = this.currentY = undefined;

        // To test with Deno, view3d (and its overlay) may be null
        const overlay = view3d?.overlay;
        if (overlay) {
            overlay.addEventListener('pointerdown', (event) => this.down3d(event));
            overlay.addEventListener('pointermove', (event) => this.move3d(event));
            overlay.addEventListener('pointerup', (event) => this.up3d(event));
            overlay.addEventListener('pointercancel', (event) => this.out(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('contextmenu', (event) => {event.preventDefault();});
            // Keyboard
            document.addEventListener('keydown', (event) => this.keydown(event));
        }
        // Flat crease-pattern view — pointer* covers mouse and touch
        const canvas2d = view2d?.canvas2d;
        if (canvas2d) {
            canvas2d.addEventListener('pointerdown', (event) => {
                try { canvas2d.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                this.down2d(event);
            });
            canvas2d.addEventListener('pointermove', (event) => this.move2d(event));
            canvas2d.addEventListener('pointerup', (event) => this.up2d(event));
            canvas2d.addEventListener('pointercancel', (event) => this.out(event));
        }
        this.out();
    }

    clickThreshold() {
        return this.pointerType === 'touch' ? CLICK_PX_TOUCH : CLICK_PX_MOUSE;
    }

    isClick() {
        const dx = (this.currentX ?? 0) - (this.firstX ?? 0);
        const dy = (this.currentY ?? 0) - (this.firstY ?? 0);
        return Math.hypot(dx, dy) < this.clickThreshold();
    }

    // Ctrl/Cmd held: targets a single stacked item, or the coincidence-construction
    // variant of a crease, instead of the default whole-stack / through-line behaviour.
    isPrecise(event) {
        return !!(event && (event.ctrlKey || event.metaKey));
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

    out() {
        this.downPoints = [];
        this.downSegments = [];
        this.downPoint = this.downSegment = this.downFace = undefined;
        this.upPoints = [];
        this.upSegments = [];
        this.upPoint = this.upSegment = this.upFace = undefined;
        this.upFaces = [];
        this.downFaces = [];
        this.label = undefined;
        this.currentSegment = undefined;
        this.moving = false;
    }

    clearSelection() {
        this.model.points.forEach(p => { p.select = false; });
        this.model.segments.forEach(s => { s.select = false; });
        this.model.faces.forEach(f => { f.select = false; });
    }

    selectedAxis() {
        return this.model.segments.find(s => s.select);
    }

    static FOLD_AMBER = '#e6a817';
    static VALLEY_COLOR = 'green';
    static MOUNTAIN_COLOR = 'firebrick';

    // Draw drag preview when down on a point, segment, or face: a filled arrow for
    // creasing (colored by the mountain/valley the drag would set), a hollow arrow
    // only when the drag will actually fold the face (willFold()) — see Arrow.svg.
    draw() {
        if (!this.downPoint && !this.downSegment && !this.downFace) {
            return;
        }
        const context = (this.currentCanvas === '2d' ? this.view2d.canvas2d : this.view3d.overlay).getContext('2d');
        if (this.downFace && this.willFold()) {
            this.drawHollowArrow(context, this.firstX, this.firstY, this.currentX, this.currentY);
        } else {
            const color = this.moving ? 'orange'
                : this.assignmentFor() === 'M' ? Helper.MOUNTAIN_COLOR : Helper.VALLEY_COLOR;
            this.drawFilledArrow(context, this.firstX, this.firstY, this.currentX, this.currentY, color);
        }
        if (this.label) {
            const radius = 18;
            context.fillStyle = 'skyblue';
            context.beginPath();
            context.arc(this.currentX, this.currentY - 16, radius, 0, 2 * Math.PI);
            context.stroke();
            context.fill();
            context.fillStyle = 'black';
            context.font = '20px serif';
            context.fillText(this.label, this.currentX - 10, this.currentY - 8);
        }
    }

    // Thin straight shaft + small solid triangular head, both a fixed size —
    // only the shaft stretches with the drag. Crease preview (by/across/bisector);
    // orange when dragging a selected point to move it in 3d.
    drawFilledArrow(context, x1, y1, x2, y2, color = 'green') {
        const HEAD_LEN = 24, HEAD_HALF_W = 10;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;
        const shaftLen = Math.max(len - HEAD_LEN, 0);
        const sx = x1 + ux * shaftLen, sy = y1 + uy * shaftLen;

        context.strokeStyle = context.fillStyle = color;
        context.lineWidth = 6;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(sx, sy);
        context.stroke();
        context.beginPath();
        context.moveTo(x2, y2);
        context.lineTo(sx + px * HEAD_HALF_W, sy + py * HEAD_HALF_W);
        context.lineTo(sx - px * HEAD_HALF_W, sy - py * HEAD_HALF_W);
        context.closePath();
        context.fill();
    }

    // Straight thick shaft + hollow (outlined) triangular head, both a fixed size —
    // only the shaft stretches with the drag. Fold preview (rotating a face).
    drawHollowArrow(context, x1, y1, x2, y2) {
        const HEAD_LEN = 20, HEAD_HALF_W = 14, HALF_W = 6;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;
        const shaftLen = Math.max(len - HEAD_LEN, 0);
        const sx = x1 + ux * shaftLen, sy = y1 + uy * shaftLen; // shaft end / head base

        context.fillStyle = '#fff';
        context.strokeStyle = Helper.FOLD_AMBER;
        context.lineWidth = 2;
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(x1 + px * HALF_W, y1 + py * HALF_W);
        context.lineTo(sx + px * HALF_W, sy + py * HALF_W);
        context.lineTo(sx + px * HEAD_HALF_W, sy + py * HEAD_HALF_W);
        context.lineTo(x2, y2);
        context.lineTo(sx - px * HEAD_HALF_W, sy - py * HEAD_HALF_W);
        context.lineTo(sx - px * HALF_W, sy - py * HALF_W);
        context.lineTo(x1 - px * HALF_W, y1 - py * HALF_W);
        context.closePath();
        context.fill();
        context.stroke();
    }

    // Logic begins here
    down(points, segments, faces, x, y) {
        this.downPoints = points.length ? points : [];
        this.downPoint = this.downPoints[0];
        this.downSegments = !this.downPoint && segments.length ? segments : [];
        this.downSegment = this.downSegments[0];
        this.downFaces = !this.downPoint && !this.downSegment ? faces : [];
        this.downFace = this.downFaces[0];
        this.firstX = this.currentX = x;
        this.firstY = this.currentY = y;
        this.label = undefined;
        // 3d drag of an already-selected (hovered) point → animated move
        this.moving = !!(this.downPoint?.select && this.currentCanvas === '3d');
    }

    /** Select all stacked points, or deselect all if every one is already selected. */
    togglePointStack(points) {
        if (!points.length) return;
        const allOn = points.every(p => p.select);
        points.forEach(p => { p.select = !allOn; });
    }

    /** Select all stacked faces, or deselect all if every one is already selected. */
    toggleFaceStack(faces) {
        if (!faces.length) return;
        const allOn = faces.every(f => f.select);
        faces.forEach(f => { f.select = !allOn; });
    }

    /** Arm/disarm a segment as the sole fold axis — never a stack, only one axis at a time. */
    armAxis(segment) {
        const wasArmed = segment.select;
        this.model.segments.forEach(s => { s.select = false; });
        segment.select = !wasArmed;
        this.logSelectedSegments();
    }

    logSelectedSegments() {
        const ids = this.model.segments.filter(s => s.select).map(s => `${this.id(s)}(${Math.round(Segment.length2d(s))},${Math.round(Segment.length3d(s) / this.model.scale)})`);
        if (ids.length) {
            this.command.command(`// selectSegments ${ids.join(' ')}`);
        }
    }

    sameStack(a, b) {
        return !!a?.length && a.length === b?.length && a.every(o => b.includes(o));
    }

    isDoubleClickPoints(points) {
        return Date.now() - this.touchTime < 400
            && this.sameStack(points, this.lastClickPoints);
    }

    faceCentroidCanvas(face) {
        const pts = face.points;
        let x = 0, y = 0;
        for (const p of pts) {
            const c = this.canvasPoint(p);
            x += c.xf;
            y += c.yf;
        }
        return {x: x / pts.length, y: y / pts.length};
    }

    faceBorderSegments(face) {
        const segs = [];
        const pts = face.points;
        for (let i = 0; i < pts.length; i++) {
            const s = this.model.getSegment(pts[i], pts[(i + 1) % pts.length]);
            if (s) segs.push(s);
        }
        return segs;
    }

    // Signed rotation angle (degrees) from ref point to cursor, around segment.
    // Uses canvasPoint() so 2d (xf,-yf) and 3d (xCanvas,yCanvas) stay consistent.
    rotationLabel(s, refX, refY, x, y) {
        const p1 = this.canvasPoint(s.p1), p2 = this.canvasPoint(s.p2);
        const p1Proj = [p1.xf, p1.yf], p2Proj = [p2.xf, p2.yf];
        const distToFirst = (refX - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (refY - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
        const distToCurrent = (x - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (y - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
        if (Math.abs(distToFirst) < 1e-6) return 0;
        let ratio = Math.abs(distToCurrent / distToFirst);
        ratio = Math.round(ratio * 100) / 100;
        let angle = (ratio - 1) * 180 * -Math.sign(distToFirst);
        angle = Math.round(angle / 10) * 10;
        return Math.abs(angle) < 10 ? 0 : angle;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        this.currentX = x;
        this.currentY = y;
        this.currentSegment = segments[0];
        this.label = undefined;

        if (this.downPoint) {
            this.downPoints.forEach(p => { p.hover = true; });
        } else if (this.downSegment) {
            this.downSegments.forEach(s => { s.hover = true; });
        } else if (this.downFace) {
            this.downFace.hover = true;
            const axis = this.selectedAxis();
            if (axis && this.faceBorderSegments(this.downFace).includes(axis)) {
                this.label = this.angleFor(axis);
            }
        }
    }

    up(points, segments, faces, precise = false) {
        this.precise = precise;
        this.upPoints = points.length ? points : [];
        this.upPoint = this.upPoints[0];
        this.upSegments = !this.upPoint && segments.length ? segments : [];
        this.upSegment = this.upSegments[0];
        this.upFaces = !this.upPoint && !this.upSegment ? faces : [];
        this.upFace = this.upFaces[0];

        if (!this.downPoint && !this.downSegment && !this.downFace) {
            if (this.isClick()) this.clearSelection();
        } else if (this.downPoint) {
            this.fromPoint();
        } else if (this.downSegment) {
            this.fromSegment();
        } else if (this.downFace) {
            this.fromFace();
        }
        this.out();
    }

    fromPoint() {
        if (this.moving && !this.isClick()) {
            this.moveSelectedPoint();
            return;
        }

        const sameStack = this.isClick()
            && this.downPoints.length
            && this.sameStack(this.downPoints, this.upPoints);

        if (sameStack) {
            if (this.isDoubleClickPoints(this.downPoints)) {
                const ids = this.downPoints.map(p => this.id(p)).join(' ');
                this.command.command(`adjust ${ids}`);
                this.touchTime = 0;
                this.lastClickPoints = [];
                return;
            }
            this.touchTime = Date.now();
            this.lastClickPoints = [...this.downPoints];
            if (this.precise) {
                this.downPoint.select = !this.downPoint.select;
            } else {
                this.togglePointStack(this.downPoints);
            }
            return;
        }

        if (this.model.faces.some(f => f.select)) {
            // Creases blocked while composing a fold
            return;
        }
        if (this.upPoint) {
            this.creaseTwoPoints(this.downPoint, this.upPoint);
        } else if (this.upSegment) {
            this.creasePointSegment(this.downPoint, this.upSegment);
        }
    }

    /**
     * Drag of a selected point in 3d: move only that hovered point (animated),
     * then adjust every other selected point to restore segment lengths.
     */
    moveSelectedPoint() {
        const {dx, dy, dz} = this.dragToWorld();
        if (dx === 0 && dy === 0 && dz === 0) return;
        const movedId = this.id(this.downPoint);
        const others = this.model.points
            .filter((p) => p.select && p !== this.downPoint)
            .map((p) => this.id(p));
        let cmd = `t 1000 m ${dx} ${dy} ${dz} ${movedId}`;
        if (others.length) cmd += ` adjust ${others.join(' ')}`;
        this.command.command(cmd);
    }

    dragToWorld() {
        const round = (n) => Math.round(n * 10) / 10;
        const delta = this.canvasDragToWorld3d(
            this.firstX, this.firstY, this.currentX, this.currentY, this.downPoint,
        );
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
        const sameStack = this.isClick()
            && this.downSegments.length
            && this.sameStack(this.downSegments, this.upSegments);

        if (sameStack) {
            this.armAxis(this.downSegment);
            return;
        }

        if (this.model.faces.some(f => f.select)) {
            return;
        }
        if (this.upSegment) {
            this.creaseTwoSegments(this.downSegment, this.upSegment);
        } else if (this.upPoint) {
            this.creasePointSegment(this.upPoint, this.downSegment);
        }
    }

    fromFace() {
        if (this.isClick()) {
            this.fromFaceClick();
            return;
        }
        this.fromFaceDrag();
    }

    fromFaceClick() {
        if (this.precise) {
            this.downFace.select = !this.downFace.select;
        } else {
            const samePile = this.downFace && this.upFaces.includes(this.downFace);
            if (samePile) {
                this.toggleFaceStack(this.upFaces.length ? this.upFaces : this.downFaces);
            } else if (this.upFace) {
                // Different face: select Up front only; keep points/segments
                this.upFace.select = true;
            }
        }
        const ids = this.model.faces.filter(f => f.select).map(f => `${this.id(f)}(${f.offset})`);
        if (ids.length) {
            this.command.command(`// selectFaces ${ids.join(' ')}`);
        }
    }

    /**
     * A drag on a face folds it only when a crease is already armed as the fold
     * axis (via a prior click on it — never guessed) and that crease borders this
     * face. Otherwise, the drag can only score a crease across existing paper
     * (splitting whatever it crosses into new landmark points), or — if it
     * crosses nothing — arm/select the face like a click would.
     */
    fromFaceDrag() {
        const axis = this.selectedAxis();
        if (axis && this.faceBorderSegments(this.downFace).includes(axis)) {
            const angle = this.angleFor(axis);
            if (angle) {
                this.foldAlong(axis, angle);
                return;
            }
        }
        if (this.splitSegments()) return;
        if (!this.downFace.select) this.fromFaceClick();
    }

    /** Rotation angle (degrees) if hinging the dragged face on `axis` right now. */
    angleFor(axis) {
        const c = this.faceCentroidCanvas(this.downFace);
        return this.rotationLabel(axis, c.x, c.y, this.currentX, this.currentY);
    }

    /** Would releasing now actually rotate the dragged face? */
    willFold() {
        const axis = this.selectedAxis();
        if (!axis || !this.faceBorderSegments(this.downFace).includes(axis)) return false;
        return !!this.angleFor(axis);
    }

    // Folds the dragged face plus any other already-selected faces around axis, by
    // angle. The axis stays armed afterwards, so folding the other side along the
    // same crease (a very common diagram pattern) is just a second plain drag.
    foldAlong(axis, angle) {
        this.rotatePoints(axis, angle);
        this.model.points.forEach(p => { p.select = false; });
        this.model.faces.forEach(f => { f.select = false; });
    }

    /**
     * Convert a screen-space ratio r along a projected segment (0 at p1, 1 at p2)
     * into the perspective-correct parameter t along the 3D segment.
     * w1/w2 are homogeneous clip w (≈ -zEye) at the endpoints.
     */
    static screenRatioToSegmentT(r, a =1, b =1) {
        const denominator = (1 - r) * b + r * a;
        if (Math.abs(denominator) < 1e-12) return r;
        return (r * a) / denominator;
    }

    /** Clip-space w used for the point's canvas projection (perspective weight). */
    clipW(point) {
        // Flat crease pattern is orthographic — no perspective weighting
        if (this.currentCanvas === '2d') return 1;
        const m = this.view3d?.canvasView;
        if (m) {
            const w = m[3] * point.x + m[7] * point.y + m[11] * point.z + m[15];
            if (Math.abs(w) > 1e-9) return w;
        }
        // zEye is negative in front of the camera; clip w ≈ -zEye
        const zEye = point.zEye;
        if (zEye !== undefined && zEye !== null && Math.abs(zEye) > 1e-9) {
            return -zEye;
        }
        return 1;
    }

    // A point's flat-drawing coordinates on the canvas the current gesture is on
    canvasPoint(p) {
        return this.currentCanvas === '2d'
            ? {xf: p.xf, yf: -p.yf}
            : {xf: p.xCanvas, yf: p.yCanvas};
    }

    /**
     * Segments the current drag actually cuts across, as {index, ratio} pairs.
     * Pure (no commands issued) so both splitSegments() and the live arrow
     * preview can share this without splitSegments() firing twice.
     */
    computeCrossedSegments() {
        const first = {xf: this.firstX, yf: this.firstY};
        const current = {xf: this.currentX, yf: this.currentY};
        // In 3d, layers can overlap on screen. Ignore a segment that's occluded
        // behind the face being dragged — the drag can only be scoring a line on
        // the visible surface, not a hidden layer that merely projects onto it.
        const downDepth = this.currentCanvas === '3d' && this.downFace && this.view3d.faceDepth
            ? this.view3d.faceDepth(this.downFace)
            : undefined;
        const crossings = [];
        this.model.segments.forEach((s, i) => {
            if (downDepth !== undefined) {
                const faces = this.model.searchFacesWithAB(s.p1, s.p2);
                const visible = faces.length === 0
                    || faces.some(f => this.view3d.faceDepth(f) <= downDepth + 1e-6);
                if (!visible) return;
            }
            const p1 = this.canvasPoint(s.p1);
            const p2 = this.canvasPoint(s.p2);
            const inter = Segment.intersectionFlat(first, current, p1, p2);
            if (!inter) return;
            const len = Math.hypot(p2.xf - p1.xf, p2.yf - p1.yf);
            if (len < 1e-9) return;
            const r = Math.hypot(inter.xf - p1.xf, inter.yf - p1.yf) / len;
            const t = Helper.screenRatioToSegmentT(r, this.clipW(s.p1), this.clipW(s.p2));
            const ratio = Math.round(t * 100) / 100;
            if (ratio > 0 && ratio < 1) crossings.push({index: i, ratio});
        });
        return crossings;
    }

    /** @returns {boolean} true if the drag actually cut across at least one existing segment */
    splitSegments() {
        const crossings = this.computeCrossedSegments();
        crossings.forEach(({index, ratio}) => this.command.command(`split s${index} ${ratio}`));
        return crossings.length > 0;
    }

    sendCmd(base, ...objs) {
        const suffix = this.currentCanvas === '2d' ? '2d' : '3d';
        const args = objs.map(o => typeof o === 'string' ? o : this.id(o));
        this.command.command(`${base}${suffix} ${args.join(' ')}`);
    }

    // Screen-space drag direction sets mountain/valley: dragging toward the
    // bottom of the screen creases a valley, toward the top a mountain.
    assignmentFor() {
        return (this.currentY - this.firstY) < 0 ? 'M' : 'V';
    }

    // command.command() only enqueues — the model applies it on the next
    // animation frame. A crease command is never animated ('t ...'), so it is
    // always fully applied by exactly one command.anim() call; running that
    // now (only when nothing else is already mid-animation) lets the mark
    // gesture tag the resulting segment(s) immediately instead of a frame late.
    runQueuedNow() {
        if (this.model.state === State.run) {
            this.command.anim();
        }
    }

    /** Tag every segment created since `before` (a Set snapshot) with assignment. */
    tagNewSegments(before, assignment) {
        this.model.segments.forEach(s => {
            if (!before.has(s)) s.assignment = assignment;
        });
    }

    // Plain: straight crease through both points. Ctrl/Cmd: the crease that
    // brings one point onto the other once folded.
    creaseTwoPoints(a, b) {
        const before = new Set(this.model.segments);
        const assignment = this.assignmentFor();
        this.sendCmd(this.precise ? 'c' : 'by', a, b);
        this.runQueuedNow();
        this.tagNewSegments(before, assignment);
        // 'by' between two already-connected points reuses the existing edge
        // instead of creating a new one — tag it too.
        const direct = this.model.getSegment(a, b);
        if (direct) direct.assignment = assignment;
    }

    // Plain: crease through the point, perpendicular to the segment. Ctrl/Cmd:
    // the crease that brings the segment's line onto the point once folded.
    creasePointSegment(point, segment) {
        const before = new Set(this.model.segments);
        const assignment = this.assignmentFor();
        this.sendCmd(this.precise ? 'parallel' : 'p', segment, point);
        this.runQueuedNow();
        this.tagNewSegments(before, assignment);
    }

    // The only sensible crease between two segments: their bisector.
    creaseTwoSegments(a, b) {
        const before = new Set(this.model.segments);
        const assignment = this.assignmentFor();
        this.sendCmd('b', a, b);
        this.runQueuedNow();
        this.tagNewSegments(before, assignment);
    }

    rotatePointIds(axis) {
        const pts = new Set();
        this.model.faces.filter(f => f.select).forEach(f => {
            f.points.forEach(p => pts.add(p));
        });
        if (this.downFace) {
            this.downFace.points.forEach(p => pts.add(p));
        }
        // Axis endpoints don't move when rotating around that axis; excluding them
        // keeps the command's point list honest and avoids floating-point drift
        // from rotating a point that should stay exactly put.
        pts.delete(axis.p1);
        pts.delete(axis.p2);
        return [...pts].map(p => this.id(p));
    }
    // Selected points not rotated are adjusted instead
    adjustPointIds(rotatedIds) {
        const rotated = new Set(rotatedIds);
        return this.model.points
            .filter(p => p.select)
            .map(p => this.id(p))
            .filter(id => !rotated.has(id));
    }
    rotateFaceCommentIds() {
        const faces = new Set(this.model.faces.filter(f => f.select));
        if (this.downFace) faces.add(this.downFace);
        return [...faces].map(f => this.id(f));
    }

    rotatePoints(axis, angle) {
        const pts = this.rotatePointIds(axis);
        const adjustPts = this.adjustPointIds(pts);
        const adjust = adjustPts.length ? ` a ${adjustPts.join(' ')}` : '';
        const faces = this.rotateFaceCommentIds();
        const faceComment = faces.length ? ` // ${faces.join(' ')}` : '';
        this.command.command(`t 1000 r ${this.id(axis)} ${angle} ${pts.join(' ')}${adjust}${faceComment}`);
    }

    // Canvas 2d (flat crease pattern)
    event2d(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.view2d.canvas2d.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        const {scale, xOffset, yOffset} = this.view2d;
        return {
            xf: (canvasX - xOffset) / scale,
            yf: (yOffset - canvasY) / scale,
        };
    }

    // Points, then segments, then faces near xf, yf
    search2d(xf, yf) {
        const scale = this.view2d.scale || 1;
        const points = this.model.points.filter(p => Math.abs(p.xf - xf) + Math.abs(p.yf - yf) < 10 / scale);
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < 6 / scale);
        const faces = this.model.faces.filter(f => Face.contains2d(f, xf, yf));
        return {points, segments, faces};
    }

    // Down on flat 2d
    down2d(event) {
        this.currentCanvas = '2d';
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.down(points, segments, faces, xf, -yf); // Note inverse y coordinate (drawing space)
    }
    // Move on flat 2d
    move2d(event) {
        this.currentCanvas = '2d';
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.move(points, segments, faces, xf, -yf);
    }
    // Up on flat 2d
    up2d(event) {
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.up(points, segments, faces, this.isPrecise(event));
    }

    // Canvas 3d
    eventCanvas3d(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.view3d.overlay.getBoundingClientRect();
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
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
    }

    // Move on 3d overlay
    move3d(event) {
        this.currentCanvas = '3d';
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
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.up(points, segments, faces, this.isPrecise(event));
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
    }

    // Mouse wheel on 3d overlay
    wheel(event) {
        this.view3d.scale = event.scale !== undefined
            ? event.scale / 10
            : this.view3d.scale + event.deltaY / 300;
        this.view3d.scale = Math.max(0.2, Math.min(3, this.view3d.scale));
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
