import {Segment} from './Segment.js';
import {Face} from './Face.js';

const CLICK_PX_MOUSE = 12;
const CLICK_PX_TOUCH = 24;

export class Helper {
    /**
     * @param {*} model
     * @param {*} command
     * @param {*} [view3d]
     */
    constructor(model, command, view3d = null) {
        this.model = model;
        this.command = command;
        this.view3d = view3d;
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
            document.addEventListener('keydown', (event) => this.keydown(event));
        }
        this.out();
    }

    get overlay() {
        return this.view3d?.overlay;
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
        // Let native text editing (e.g. its own undo) happen while typing
        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
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
    }

    clearSelection() {
        this.model.points.forEach(p => { p.select = false; });
        this.model.segments.forEach(s => { s.select = false; });
        this.model.faces.forEach(f => { f.select = false; });
    }

    selectedAxis() {
        return this.model.segments.find(s => s.select);
    }

    // Draw drag preview when down on a point, segment, or face
    draw() {
        if (!this.downPoint && !this.downSegment && !this.downFace) {
            return;
        }
        const context = this.overlay.getContext('2d');
        context.lineWidth = 4;
        context.lineCap = 'round';
        context.strokeStyle = 'green';
        context.beginPath();
        context.moveTo(this.firstX, this.firstY);
        context.lineTo(this.currentX, this.currentY);
        context.stroke();
        if (this.label) {
            const radius = 18;
            context.fillStyle = 'skyblue';
            context.beginPath();
            context.arc(this.currentX, this.currentY - 16, radius, 0, 2 * Math.PI);
            context.stroke();
            context.fill();
            context.fillStyle = 'black';
            context.font = '20px serif';
            context.fillText(String(this.label), this.currentX - 10, this.currentY - 8);
        }
    }

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
            x += p.xCanvas;
            y += p.yCanvas;
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
            const d = Segment.distance2d(
                s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, x, y,
            );
            if (d < bestD) {
                bestD = d;
                best = s;
            }
        }
        return best;
    }

    // Signed rotation angle (degrees) from ref point to cursor, around segment.
    rotationLabel(s, refX, refY, x, y) {
        const p1Proj = [s.p1.xCanvas, s.p1.yCanvas], p2Proj = [s.p2.xCanvas, s.p2.yCanvas];
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
        this.label = undefined;
        this.hoverAxis = undefined;

        if (this.downPoint) {
            this.downPoints.forEach(p => { p.hover = true; });
        } else if (this.downSegment) {
            this.downSegments.forEach(s => { s.hover = true; });
        } else if (this.downFace && this.mode === 'fold') {
            this.downFace.hover = true;
            // Only the fold-axis candidate should highlight — clear other segment hovers
            this.model.segments.forEach(s => { s.hover = false; });
            const axis = this.selectedAxis() || this.nearestBorderSegment(this.downFace, x, y);
            this.hoverAxis = axis;
            if (axis) {
                axis.hover = true;
                const c = this.faceCentroidCanvas(this.downFace);
                this.label = this.rotationLabel(axis, c.x, c.y, x, y);
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
            this.command.command(
                `// splitParallel ${this.id(this.downSegment)} ${this.id(this.upPoint)}`,
            );
        }
    }

    fromFace() {
        if (this.isClick()) {
            this.fromFaceClick();
            return;
        }
        if (this.mode === 'fold') {
            this.fromFaceFoldDrag();
        } else {
            // mark: drag across the paper splits crossed segments
            this.splitSegments();
        }
    }

    fromFaceClick() {
        const samePile = this.downFace && this.upFaces.includes(this.downFace);
        if (samePile) {
            this.cycleFacePile(this.upFaces.length ? this.upFaces : this.downFaces);
        } else if (this.upFace) {
            // Different face: select Up front only; keep points/segments
            this.upFace.select = true;
        }
        const ids = this.model.faces.filter(f => f.select).map(f => this.id(f));
        if (ids.length) {
            this.command.command(`// selectFaces ${ids.join(' ')}`);
        }
    }

    // Cycle depth pile: select front, then next, … then clear only this pile's faces
    cycleFacePile(pile) {
        if (!pile.length) return;
        const idx = pile.findIndex(f => f.select);
        if (idx === -1) {
            pile[0].select = true;
            return;
        }
        pile[idx].select = false;
        if (idx + 1 < pile.length) {
            pile[idx + 1].select = true;
        }
    }

    fromFaceFoldDrag() {
        const axis = this.selectedAxis() || this.hoverAxis
            || this.nearestBorderSegment(this.downFace, this.currentX, this.currentY);
        const c = this.faceCentroidCanvas(this.downFace);
        const angle = axis
            ? this.rotationLabel(axis, c.x, c.y, this.currentX, this.currentY)
            : 0;

        if (this.upPoint) {
            const s = axis || this.selectedAxis();
            if (s) {
                this.command.command(
                    `// splitParallel ${this.id(s)} ${this.id(this.upPoint)}`,
                );
            }
            return;
        }

        if (axis && angle) {
            this.model.segments.forEach(sg => { sg.select = false; });
            axis.select = true;
            this.rotatePoints(axis, angle);
            this.clearSelection();
            return;
        }

        if (!this.upSegment) {
            this.splitSegments();
        }
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

    splitSegments() {
        const first = {xf: this.firstX, yf: this.firstY};
        const current = {xf: this.currentX, yf: this.currentY};
        this.model.segments.forEach((s, i) => {
            const p1 = {xf: s.p1.xCanvas, yf: s.p1.yCanvas};
            const p2 = {xf: s.p2.xCanvas, yf: s.p2.yCanvas};
            const inter = Segment.intersectionFlat(first, current, p1, p2);
            if (!inter) return;
            const len = Math.hypot(p2.xf - p1.xf, p2.yf - p1.yf);
            if (len < 1e-9) return;
            const r = Math.hypot(inter.xf - p1.xf, inter.yf - p1.yf) / len;
            const t = Helper.screenRatioToSegmentT(r, this.clipW(s.p1), this.clipW(s.p2));
            const rounded = Math.round(t * 100) / 100;
            if (rounded > 0 && rounded < 1) {
                this.command.command(`split s${i} ${rounded}`);
            }
        });
    }

    sendCmd(base, ...objs) {
        const args = objs.map(o => typeof o === 'string' ? o : this.id(o));
        this.command.command(`${base}3d ${args.join(' ')}`);
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

    // Canvas 3d
    eventCanvas3d(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.overlay.getBoundingClientRect();
        return {
            xCanvas: event.clientX - rect.left,
            yCanvas: event.clientY - rect.top,
            pointerType: event.pointerType || 'mouse',
        };
    }

    pickFaces3d(xCanvas, yCanvas) {
        const faces = this.model.faces.filter(f =>
            Face.contains3d(f, xCanvas, yCanvas, this.view3d),
        );
        if (this.view3d?.faceDepth) {
            faces.sort((a, b) => this.view3d.faceDepth(a) - this.view3d.faceDepth(b));
        }
        return faces;
    }

    search3d(xCanvas, yCanvas) {
        const points = this.model.points.filter(p =>
            Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 10,
        );
        const segments = this.model.segments.filter(s =>
            Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas) < 6,
        );
        const faces = this.pickFaces3d(xCanvas, yCanvas);
        return {points, segments, faces};
    }

    down3d(event) {
        const {xCanvas, yCanvas, pointerType} = this.eventCanvas3d(event);
        this.pointerType = pointerType || 'mouse';
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
    }

    move3d(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        if (points.length === 0 && segments.length === 0 && faces.length === 0
            && event.buttons === 1
            && !this.downPoint && !this.downSegment && !this.downFace) {
            const factor = (600 / event.target.height);
            const dx = factor * (xCanvas - this.currentX);
            const dy = factor * (yCanvas - this.currentY);
            this.view3d.angleX += dy;
            this.view3d.angleY += dx;
        } else if ((event.buttons & 2) > 0) {
            const dx = (xCanvas - this.currentX);
            const dy = (yCanvas - this.currentY);
            this.view3d.translationY -= dy;
            this.view3d.translationX += dx;
        }
        this.move(points, segments, faces, xCanvas, yCanvas);
        this.view3d.initModelView();
        this.view3d.initPerspective();
    }

    up3d(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.up(points, segments, faces);
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
    }

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
