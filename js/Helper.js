import {Segment} from './Segment.js';
import {Face} from './Face.js';

const CLICK_PX_MOUSE = 12;
const CLICK_PX_TOUCH = 24;

export class Helper {
    constructor(model, command, view3d, view2d) {
        this.model = model;
        this.command = command;
        this.view3d = view3d;
        this.view2d = view2d;
        this.touchTime = 0;
        this.lastClickPoints = [];
        this.pointerType = 'mouse';
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

    get overlay() {
        return this.view3d?.overlay;
    }

    get canvas2d() {
        return this.view2d?.canvas2d;
    }

    /** @returns {'mark'|'fold'} */
    get mode() {
        return this.model.faces.some(f => f.select) ? 'fold' : 'mark';
    }

    clickThreshold() {
        return this.pointerType === 'touch' ? CLICK_PX_TOUCH : CLICK_PX_MOUSE;
    }

    isClick() {
        const dx = (this.currentX ?? 0) - (this.firstX ?? 0);
        const dy = (this.currentY ?? 0) - (this.firstY ?? 0);
        return Math.hypot(dx, dy) < this.clickThreshold();
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
        this.hoverAxis = undefined;
        this.currentSegment = undefined;
    }

    clearSelection() {
        this.model.points.forEach(p => { p.select = false; });
        this.model.segments.forEach(s => { s.select = false; });
        this.model.faces.forEach(f => { f.select = false; });
    }

    selectedAxis() {
        return this.model.segments.find(s => s.select);
    }

    // Matches View3d.AXIS_AMBER — kept as a literal to avoid a View3d import here
    static FOLD_AMBER = '#e6a817';

    // Draw drag preview when down on a point, segment, or face: a filled arrow
    // for creasing (by/across/bisector), a hollow arrow only when the drag will
    // actually fold the face (willFold()) — see Arrow.svg.
    draw() {
        if (!this.downPoint && !this.downSegment && !this.downFace) {
            return;
        }
        const context = (this.currentCanvas === '2d' ? this.canvas2d : this.overlay).getContext('2d');
        if (this.downFace && this.willFold()) {
            this.drawHollowArrow(context, this.firstX, this.firstY, this.currentX, this.currentY);
        } else {
            this.drawFilledArrow(context, this.firstX, this.firstY, this.currentX, this.currentY);
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
    // only the shaft stretches with the drag. Crease preview (by3d/across3d/bisector3d).
    drawFilledArrow(context, x1, y1, x2, y2) {
        const HEAD_LEN = 12, HEAD_HALF_W = 5;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;
        const shaftLen = Math.max(len - HEAD_LEN, 0);
        const sx = x1 + ux * shaftLen, sy = y1 + uy * shaftLen;

        context.strokeStyle = context.fillStyle = 'green';
        context.lineWidth = 2;
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
        this.hoverAxis = undefined;
    }

    /** Select all stacked points, or deselect all if every one is already selected. */
    togglePointStack(points) {
        if (!points.length) return;
        const allOn = points.every(p => p.select);
        points.forEach(p => { p.select = !allOn; });
    }

    /**
     * Toggle a stack of superimposed segments as the fold axis.
     * Selecting the stack clears any other selected segments.
     */
    toggleSegmentStack(segments) {
        if (!segments.length) return;
        const allOn = segments.every(s => s.select);
        this.model.segments.forEach(s => { s.select = false; });
        if (!allOn) {
            segments.forEach(s => { s.select = true; });
        }
    }

    logSelectedSegments() {
        const ids = this.model.segments.filter(s => s.select).map(s => this.id(s));
        if (ids.length) {
            this.command.command(`// selectSegments ${ids.join(' ')}`);
        }
    }

    sameStack(a, b) {
        if (!a?.length || !b?.length || a.length !== b.length) return false;
        return a.every(o => b.includes(o));
    }

    samePointStack(a, b) {
        return this.sameStack(a, b);
    }

    isDoubleClickPoints(points) {
        return Date.now() - this.touchTime < 400
            && this.samePointStack(points, this.lastClickPoints);
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

    nearestBorderSegment(face, x, y) {
        let best, bestD = Infinity;
        for (const s of this.faceBorderSegments(face)) {
            const p1 = this.canvasPoint(s.p1);
            const p2 = this.canvasPoint(s.p2);
            const d = Segment.distance2d(p1.xf, p1.yf, p2.xf, p2.yf, x, y);
            if (d < bestD) {
                bestD = d;
                best = s;
            }
        }
        return best;
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
        this.hoverAxis = undefined;

        if (this.downPoint) {
            this.downPoints.forEach(p => { p.hover = true; });
        } else if (this.downSegment) {
            this.downSegments.forEach(s => { s.hover = true; });
        } else if (this.downFace) {
            this.downFace.hover = true;
            // Only the fold-axis candidate should highlight — clear other segment hovers
            this.model.segments.forEach(s => { s.hover = false; });
            const axis = this.foldAxis(this.currentSegment);
            this.hoverAxis = axis;
            if (axis) {
                axis.hover = true;
                this.label = this.angleFor(axis);
            }
        }
    }

    up(points, segments, faces) {
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
        const sameStack = this.isClick()
            && this.downPoints.length
            && this.samePointStack(this.downPoints, this.upPoints);

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
            this.togglePointStack(this.downPoints);
            return;
        }

        if (this.mode === 'fold') {
            // Creases blocked in fold
            return;
        }
        if (this.upPoint) {
            const cmd = this.model.getSegment(this.downPoint, this.upPoint) ? 'across' : 'by';
            this.sendCmd(cmd, this.downPoint, this.upPoint);
        } else if (this.upSegment) {
            this.sendCmd('p', this.upSegment, this.downPoint);
        }
    }

    fromSegment() {
        const sameStack = this.isClick()
            && this.downSegments.length
            && this.sameStack(this.downSegments, this.upSegments);

        if (sameStack) {
            this.toggleSegmentStack(this.downSegments);
            this.logSelectedSegments();
            return;
        }

        if (this.mode === 'fold') {
            return;
        }
        if (this.upSegment) {
            this.sendCmd('bisector', this.downSegment, this.upSegment);
        } else if (this.upPoint) {
            this.sendCmd('parallel', this.downSegment, this.upPoint);
        }
    }

    fromFace() {
        if (this.isClick()) {
            this.fromFaceClick();
            return;
        }
        // A drag starting on a face folds it directly — no separate "select the
        // face first" step, matching how picking up a flap of real paper works.
        this.fromFaceDrag();
    }

    fromFaceClick() {
        const samePile = this.downFace && this.upFaces.includes(this.downFace);
        if (samePile) {
            this.toggleFaceStack(this.upFaces.length ? this.upFaces : this.downFaces);
        } else if (this.upFace) {
            // Different face: select Up front only; keep points/segments
            this.upFace.select = true;
        }
        const ids = this.model.faces.filter(f => f.select).map(f => this.id(f));
        if (ids.length) {
            this.command.command(`// selectFaces ${ids.join(' ')}`);
        }
    }

    /** Select all stacked faces, or deselect all if every one is already selected. */
    toggleFaceStack(faces) {
        if (!faces.length) return;
        const allOn = faces.every(f => f.select);
        faces.forEach(f => { f.select = !allOn; });
    }

    /**
     * A drag starting on a face is either scoring a new crease across the paper
     * or folding the flap around a hinge, decided by a priority ladder:
     *  1. an explicit pin, or a segment you're aiming directly at that borders
     *     this face ("drag into an adjacent segment") — always folds there;
     *  2. otherwise a real cut across existing paper — whether an unrelated
     *     face or empty background beyond this face's own edge — scores it;
     *  3. otherwise (just nudging the flap, not aiming anywhere specific and
     *     not crossing anything) — fold around the nearest border edge.
     */
    fromFaceDrag() {
        if (this.upPoint) {
            return;
        }
        const axis = this.foldAxis(this.upSegment);
        if (axis) {
            const angle = this.angleFor(axis);
            if (angle) {
                this.foldAlong(axis, angle);
                return;
            }
        }
        this.splitSegments();
    }

    /** Rotation angle (degrees) if hinging the dragged face on `axis` right now. */
    angleFor(axis) {
        const c = this.faceCentroidCanvas(this.downFace);
        return this.rotationLabel(axis, c.x, c.y, this.currentX, this.currentY);
    }

    /** Explicit pin, else a segment you're aiming directly at that borders this face. */
    priorityAxis(nearSegment) {
        return this.selectedAxis()
            || (nearSegment && this.faceBorderSegments(this.downFace).includes(nearSegment) ? nearSegment : undefined);
    }

    /**
     * Axis to fold the dragged face around right now, or undefined if this
     * drag should score a crease instead: a priorityAxis() always wins; the
     * nearest border edge is only a fallback when nothing crosses either.
     */
    foldAxis(nearSegment) {
        const priority = this.priorityAxis(nearSegment);
        if (priority) return priority;
        if (this.computeCrossedSegments().length > 0) return undefined;
        return this.nearestBorderSegment(this.downFace, this.currentX, this.currentY);
    }

    /** Would releasing now actually rotate the dragged face? */
    willFold() {
        if (this.upPoint) return false;
        const axis = this.foldAxis(this.currentSegment);
        return !!(axis && this.angleFor(axis));
    }

    foldAlong(axis, angle) {
        this.model.segments.forEach(sg => { sg.select = false; });
        axis.select = true;
        this.rotatePoints(axis, angle);
        this.clearSelection();
    }

    /**
     * Convert a screen-space ratio r along a projected segment (0 at p1, 1 at p2)
     * into the perspective-correct parameter t along the 3D segment.
     * w1/w2 are homogeneous clip w (≈ -zEye) at the endpoints.
     */
    static screenRatioToSegmentT(r, w1, w2) {
        const a = w1 || 1;
        const b = w2 || 1;
        const denom = (1 - r) * b + r * a;
        if (Math.abs(denom) < 1e-12) return r;
        return (r * a) / denom;
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
        const downDepth = this.currentCanvas === '3d' && this.downFace && this.view3d?.faceDepth
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

    rotatePointIds() {
        const pts = new Set();
        this.model.points.filter(p => p.select).forEach(p => pts.add(p));
        this.model.faces.filter(f => f.select).forEach(f => {
            f.points.forEach(p => pts.add(p));
        });
        if (this.downFace) {
            this.downFace.points.forEach(p => pts.add(p));
        }
        return [...pts].map(p => this.id(p));
    }
    rotateFaceCommentIds() {
        const faces = new Set(this.model.faces.filter(f => f.select));
        if (this.downFace) faces.add(this.downFace);
        return [...faces].map(f => this.id(f));
    }

    rotatePoints(axis, angle) {
        const pts = this.rotatePointIds();
        const faces = this.rotateFaceCommentIds();
        const faceComment = faces.length ? ` // ${faces.join(' ')}` : '';
        this.command.command(`t 1000 r ${this.id(axis)} ${angle} ${pts.join(' ')}${faceComment}`);
    }

    // Canvas 2d (flat crease pattern)
    event2d(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.canvas2d.getBoundingClientRect();
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
        const scale = this.view2d?.scale || 1;
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
        this.up(points, segments, faces);
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
