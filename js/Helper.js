import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Model} from './Model.js';
import {Vector3} from './Vector3.js';
import * as mat4 from './lib/mat4.js';

const CLICK_PX_MOUSE = 12;
const CLICK_PX_TOUCH = 24;
// Pick radii, in canvas pixels (2d divides them by the view scale)
const PICK_POINT_PX = 10;
const PICK_SEGMENT_PX = 6;
// Two clicks closer than this count as a double click
const DOUBLE_CLICK_MS = 400;

export class Helper {
    constructor(model, command, view3d, view2d) {
        this.model = model;
        this.command = command;
        this.view3d = view3d;
        this.view2d = view2d;
        // Two independent double-click timers: one for "double-click a point to
        // adjust it", one for "double-click the background to reset the view".
        // Sharing a single timer made a plain background click reset the view
        // whenever it followed a point click closely enough.
        this.pointClickTime = 0;
        this.viewClickTime = 0;
        this.lastClickPoints = [];
        this.pointerType = 'mouse';
        // Which layer of a pile of superimposed faces the next click takes.
        // Survives between gestures: that is what makes clicking again go deeper.
        this.layerIndex = 0;
        this.lastPile = [];
        // Mouse coordinates, first and current
        this.firstX = this.firstY = this.currentX = this.currentY = undefined;

        // To test with Deno, view3d (and its overlay) may be null
        const overlay = view3d?.overlay;
        if (overlay) {
            overlay.addEventListener('pointerdown', (event) => {
                if (event.button === 1) event.preventDefault(); // no autoscroll
                try { overlay.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                this.down3d(event);
            });
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

    isClickAt(x, y) {
        const dx = (x ?? 0) - (this.firstX ?? 0);
        const dy = (y ?? 0) - (this.firstY ?? 0);
        return Math.hypot(dx, dy) < this.clickThreshold();
    }

    isClick() {
        return this.isClickAt(this.currentX, this.currentY);
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
        this.endPreview();
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
        this.orbiting = false;
        this.pileAll = false;
    }

    // pointerType decides the click/drag threshold, so it has to follow the
    // device actually being used rather than stay at its constructor default.
    trackPointerType(event) {
        if (event?.pointerType) this.pointerType = event.pointerType;
    }

    /**
     * Live fold preview: the paper actually turns while dragging instead of only
     * being promised by an arrow. The rotation is applied to the model, redrawn,
     * and undone on the next move, so the drag never touches the undo history —
     * the animated command emitted on release is still the only recorded step.
     */
    previewFold(fold) {
        this.resetPreview();
        if (!fold) return;
        this.previewBaseline ??= this.model.snapshotPositions();
        const moving = this.movingPoints(fold.axis, this.foldFlap(fold.axis));
        this.model.rotate(fold.axis, fold.angle, moving);
        this.markPreviewDirty();
    }

    /** Put the paper back where the drag found it, keeping the baseline. */
    resetPreview() {
        if (!this.previewBaseline) return;
        this.model.restorePositions(this.previewBaseline);
        this.markPreviewDirty();
    }

    /** End of gesture: back to the baseline and forget it. */
    endPreview() {
        this.resetPreview();
        this.previewBaseline = undefined;
    }

    // Projected coordinates feed both picking and the overlay, so they have to be
    // recomputed as soon as the preview moves a point, not on the next frame.
    markPreviewDirty() {
        this.previewDirty = true;
        this.view3d?.updateCanvasCoords?.();
    }

    /** True once, so the render loop knows to rebuild its buffers. */
    consumePreviewDirty() {
        const dirty = this.previewDirty;
        this.previewDirty = false;
        return dirty;
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

    // Model units. Creases span hundreds of units, so this only ever catches
    // points that really are meant to sit on the hinge.
    static AXIS_EPSILON = 1;

    // Fold angle, in canvas pixels and degrees
    static MIN_LEVER_PX = 30;
    static ANGLE_SNAP_DEG = 5;
    static ANGLE_DEAD_DEG = 5;

    // Draw drag preview when down on a point, segment, or face: a curved arrow
    // along the path the paper will travel when folding, a straight filled arrow
    // for creasing (by/across/bisector) — see Arrow.svg.
    draw() {
        if (!this.downPoint && !this.downSegment && !this.downFace) {
            return;
        }
        const context = (this.currentCanvas === '2d' ? this.view2d.canvas2d : this.view3d.overlay).getContext('2d');
        const fold = this.downFace ? this.foldIntent() : undefined;
        if (fold) {
            this.drawFoldArrow(context, fold);
        } else {
            this.drawFilledArrow(
                context, this.firstX, this.firstY, this.currentX, this.currentY,
                this.moving ? 'orange' : 'green',
            );
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

    /**
     * The flap vertex the arrow is drawn from: the one that travels furthest,
     * which is what a diagram draws its arrow on.
     */
    foldTip(axis, flap) {
        let best, bestD = -1;
        for (const face of flap) {
            for (const p of face.points) {
                const d = Vector3.pointLineDistance(p, axis.p1, axis.p2);
                if (d > bestD) { bestD = d; best = p; }
            }
        }
        return best;
    }

    /**
     * The path the tip sweeps while the flap rotates from flat to `angle`, in
     * canvas pixels. In 3d this is the true projected trajectory, so the arrow
     * curves exactly the way the paper swings. The flat crease pattern has no
     * third dimension to swing through, so there the same rotation projects to a
     * straight line and the arc is bowed by hand, the way diagrams draw it.
     */
    foldArc(axis, angle, tip, steps = 24) {
        const path = [];
        if (!tip) return path;
        if (this.currentCanvas === '2d') {
            // Tip now, and where it lands: rotating by `angle` about the crease
            // mirrors it across the crease line at 180 degrees.
            const a = this.canvasPoint(axis.p1), b = this.canvasPoint(axis.p2);
            const t = this.canvasPoint(tip);
            const dx = b.xf - a.xf, dy = b.yf - a.yf;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            // Signed distance of the tip to the crease, and its foot on it
            const side = (t.xf - a.xf) * uy - (t.yf - a.yf) * ux;
            const footX = t.xf - side * uy, footY = t.yf + side * ux;
            const rad = angle * Math.PI / 180;
            for (let i = 0; i <= steps; i++) {
                const th = rad * i / steps;
                // In plane the tip closes on the crease as cos, and the part of
                // the swing that leaves the sheet is drawn as the bow.
                const along = side * Math.cos(th);
                const bow = side * Math.sin(th) * 0.55;
                path.push({
                    x: footX + along * uy + bow * ux,
                    y: footY - along * ux + bow * uy,
                });
            }
            return path;
        }
        // 3d: rotate a copy of the tip and project it, step by step
        const canvasView = this.view3d?.canvasView;
        if (!canvasView) return path;
        const clone = {x: tip.x, y: tip.y, z: tip.z};
        let previous = 0;
        for (let i = 0; i <= steps; i++) {
            const th = angle * i / steps;
            this.model.rotate(axis, th - previous, [clone]);
            previous = th;
            const v = Vector3.transformMat4(clone, canvasView);
            path.push({x: v.x, y: v.y});
        }
        return path;
    }

    /**
     * Origami arrow: a curved shaft along the paper's own path, with a solid head
     * when the fold comes towards the viewer (valley) and a hollow one when it
     * goes away (mountain), plus a faint ghost of the full 180 degree fold so the
     * destination is visible before getting there.
     */
    drawFoldArrow(context, fold) {
        const tip = this.foldTip(fold.axis, this.foldFlap(fold.axis));
        const path = tip ? this.foldArc(fold.axis, fold.angle, tip) : [];
        if (path.length < 2) {
            // Nothing projected yet (first frame, or headless): straight arrow
            this.drawHollowArrow(context, this.firstX, this.firstY, this.currentX, this.currentY);
            return;
        }
        const valley = this.comesForward(fold, tip);
        const side = valley ? 1 : -1;
        // Where the fold is heading, so the destination is visible before reaching it
        const full = Helper.bowArc(this.foldArc(fold.axis, Math.sign(fold.angle) * 180, tip), side);
        this.strokeArc(context, full, {color: 'rgba(230,168,23,0.35)', width: 3, dashed: false});
        const bowed = Helper.bowArc(path, side);
        this.strokeArc(context, bowed, {color: Helper.FOLD_AMBER, width: 5, dashed: !valley});
        this.drawArcHead(context, bowed, valley);
    }

    /**
     * A fold seen head on projects to a straight line: the paper swings out of
     * the screen and none of the curve survives. Diagrams draw the arc anyway, so
     * top the projected sag up to a readable minimum. The correction vanishes at
     * both ends, so the arrow still starts and lands exactly where the paper does,
     * and it does nothing when the view already shows a real curve.
     */
    static bowArc(path, side, minSagRatio = 0.16) {
        if (path.length < 3) return path;
        const first = path[0], last = path[path.length - 1];
        const chordX = last.x - first.x, chordY = last.y - first.y;
        const chord = Math.hypot(chordX, chordY);
        if (chord < 1e-6) return path;
        const nx = -chordY / chord, ny = chordX / chord;
        let sag = 0;
        for (const p of path) {
            sag = Math.max(sag, Math.abs((p.x - first.x) * nx + (p.y - first.y) * ny));
        }
        const extra = Math.max(0, chord * minSagRatio - sag);
        if (extra === 0) return path;
        return path.map((p, i) => {
            const bow = Math.sin(Math.PI * i / (path.length - 1)) * extra * side;
            return {x: p.x + nx * bow, y: p.y + ny * bow};
        });
    }

    /**
     * Does the paper swing towards the viewer? Diagrams draw that as a valley
     * (solid shaft, solid head) and the other way as a mountain (dashed, hollow).
     * Eye z grows towards the camera, the model view sitting at z = -700.
     */
    comesForward(fold, tip) {
        if (this.currentCanvas === '2d') return fold.angle > 0;
        const clone = {x: tip.x, y: tip.y, z: tip.z};
        this.model.rotate(fold.axis, fold.angle / 2, [clone]);
        const modelView = this.view3d?.modelView;
        if (!modelView) return true;
        return Vector3.transformMat4(clone, modelView).z > (tip.zEye ?? tip.z);
    }

    strokeArc(context, path, {color, width, dashed}) {
        if (path.length < 2) return;
        context.save();
        context.strokeStyle = color;
        context.lineWidth = width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        if (dashed) context.setLineDash([10, 6]);
        context.beginPath();
        context.moveTo(path[0].x, path[0].y);
        for (const p of path.slice(1)) context.lineTo(p.x, p.y);
        context.stroke();
        context.restore();
    }

    /** Head at the end of the arc, aligned with the path's own last direction. */
    drawArcHead(context, path, filled) {
        if (path.length < 2) return;
        const HEAD_LEN = 22, HEAD_HALF_W = 11;
        const end = path[path.length - 1];
        let previous = path[path.length - 2];
        // Step back along the path until far enough for a stable direction
        for (let i = path.length - 2; i >= 0; i--) {
            previous = path[i];
            if (Math.hypot(end.x - previous.x, end.y - previous.y) >= HEAD_LEN) break;
        }
        const dx = end.x - previous.x, dy = end.y - previous.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;
        const bx = end.x - ux * HEAD_LEN, by = end.y - uy * HEAD_LEN;
        context.save();
        context.beginPath();
        context.moveTo(end.x, end.y);
        context.lineTo(bx + px * HEAD_HALF_W, by + py * HEAD_HALF_W);
        context.lineTo(bx - px * HEAD_HALF_W, by - py * HEAD_HALF_W);
        context.closePath();
        context.fillStyle = filled ? Helper.FOLD_AMBER : '#fff';
        context.strokeStyle = Helper.FOLD_AMBER;
        context.lineWidth = 2;
        context.lineJoin = 'round';
        context.fill();
        context.stroke();
        context.restore();
    }

    // Thin straight shaft + small solid triangular head, both a fixed size —
    // only the shaft stretches with the drag. Crease preview (by3d/across3d/bisector3d);
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
        const ids = this.model.segments.filter(s => s.select).map(s => `${this.id(s)}(${Math.round(Segment.length2d(s))},${Math.round(Segment.length3d(s) / this.model.scale)})`);
        if (ids.length) {
            this.command.command(`// selectSegments ${ids.join(' ')}`);
        }
    }

    sameStack(a, b) {
        return !!a?.length && a.length === b?.length && a.every(o => b.includes(o));
    }

    isDoubleClickPoints(points) {
        return Date.now() - this.pointClickTime < DOUBLE_CLICK_MS
            && this.sameStack(points, this.lastClickPoints);
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

    /**
     * Signed rotation angle (degrees) for hinging on `s`, measured from the grab
     * point (refX, refY) to the cursor. Uses canvasPoint() so 2d (xf,-yf) and 3d
     * (xCanvas,yCanvas) stay consistent.
     *
     * The grabbed point sweeps a circle around the hinge, and seen roughly face
     * on that circle projects to a signed distance d(angle) = d0 * cos(angle),
     * so acos() reads the angle back. The paper follows the hand: 90 degrees
     * when the cursor reaches the crease, 180 at the mirror position, and a
     * given drag always means the same rotation wherever the face was grabbed.
     *
     * Dragging the other way, away from the crease, folds the other way. That
     * half is a convention rather than a projection — a mountain and a valley of
     * equal angle project identically — and is mirrored so both directions need
     * the same travel.
     */
    rotationLabel(s, refX, refY, x, y) {
        const p1 = this.canvasPoint(s.p1), p2 = this.canvasPoint(s.p2);
        const dx = p2.xf - p1.xf, dy = p2.yf - p1.yf;
        const len = Math.hypot(dx, dy);
        if (len < 1e-9) return 0;
        const side = (px, py) => ((px - p1.xf) * dy - (py - p1.yf) * dx) / len;
        const d0 = side(refX, refY);
        // Grabbing right next to the hinge would make a single pixel worth tens
        // of degrees; below this the lever arm is treated as this long.
        const lever = Math.sign(d0 || 1) * Math.max(Math.abs(d0), Helper.MIN_LEVER_PX);
        // Measured from the grab point, so clamping the lever arm shortens the
        // travel needed without pretending the paper starts already folded.
        const ratio = 1 + (side(x, y) - d0) / lever;
        const radians = ratio <= 1
            ? Math.sign(lever) * Math.acos(Math.max(-1, ratio))
            : -Math.sign(lever) * Math.acos(Math.max(-1, 2 - ratio));
        return Helper.snapAngle(radians * 180 / Math.PI);
    }

    // To the degree, settling on the usual origami angles when close enough.
    static snapAngle(degrees) {
        const rounded = Math.round(degrees);
        const nearest = Math.round(rounded / 45) * 45;
        const snapped = Math.abs(rounded - nearest) <= Helper.ANGLE_SNAP_DEG ? nearest : rounded;
        return Math.abs(snapped) < Helper.ANGLE_DEAD_DEG ? 0 : snapped;
    }

    move(points, segments, faces, x, y) {
        // Undo last frame's preview first: picking, the fold axis and the angle
        // must all be read off the geometry the drag started from, or the preview
        // feeds back into the decision that produced it.
        this.resetPreview();
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
            // Only the fold-axis candidate should highlight — clear other segment hovers
            this.model.segments.forEach(s => { s.hover = false; });
            const axis = this.foldAxis(this.currentSegment);
            if (axis) {
                axis.hover = true;
                this.label = this.angleFor(axis);
            }
            this.previewFold(this.foldIntent());
        }
    }

    up(points, segments, faces) {
        // The recorded command has to start from the unfolded state, so the
        // preview is rolled back before anything is emitted.
        this.endPreview();
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
                this.pointClickTime = 0;
                this.lastClickPoints = [];
                return;
            }
            this.pointClickTime = Date.now();
            this.lastClickPoints = [...this.downPoints];
            this.togglePointStack(this.downPoints);
            return;
        }

        if (this.model.faces.some(f => f.select)) {
            // Creases blocked in fold
            return;
        }
        if (this.upPoint) {
            // A drag that ends back on its own start point has no crease to
            // describe; it used to emit `by3d p0 p0`, which does nothing but
            // still costs a line of recorded script and an undo step.
            if (this.upPoint === this.downPoint) return;
            const cmd = this.model.getSegment(this.downPoint, this.upPoint) ? 'c' : 'by';
            this.sendCmd(cmd, this.downPoint, this.upPoint);
        } else if (this.upSegment) {
            this.sendCmd('p', this.upSegment, this.downPoint);
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
            this.toggleSegmentStack(this.downSegments);
            this.logSelectedSegments();
            return;
        }

        if (this.model.faces.some(f => f.select)) {
            return;
        }
        if (this.upSegment) {
            // Dragging along a single crease used to emit `b3d s0 s0`: the
            // bisector of a segment with itself, which cannot mean anything.
            if (this.upSegment === this.downSegment) return;
            this.sendCmd('b', this.downSegment, this.upSegment);
        } else if (this.upPoint) {
            this.sendCmd('parallel', this.downSegment, this.upPoint);
        }
    }

    fromFace() {
        if (this.isClick()) {
            this.fromFaceClick();
            return;
        }
        // Folding is gated on the face already being selected (see foldAxis) —
        // a drag on an unselected face can only score a crease or select it.
        this.fromFaceDrag();
    }

    /**
     * Clicking a pile of superimposed faces arms the top one, the layer the user
     * is actually looking at — "the front flap" of a diagram. Clicking the same
     * pile again goes one layer deeper, and past the last one clears it, so the
     * whole stack is reachable without a modifier. Shift takes the pile as a
     * whole, which is what selecting used to do for every click.
     */
    fromFaceClick() {
        const pile = this.upFaces.length ? this.upFaces : this.downFaces;
        if (!pile.length) return;
        if (this.pileAll) {
            this.toggleFaceStack(pile);
        } else {
            this.layerIndex = this.sameStack(pile, this.lastPile) ? this.layerIndex + 1 : 0;
            this.lastPile = [...pile];
            pile.forEach(f => { f.select = false; });
            // One past the deepest layer means "none of them", so a pile can be
            // cycled through and let go without hunting for empty space.
            if (this.layerIndex < pile.length) {
                pile[this.layerIndex].select = true;
            } else {
                this.layerIndex = -1;
            }
        }
        const ids = this.model.faces.filter(f => f.select).map(f => `${this.id(f)}(${f.offset})`);
        const depth = this.pileAll || pile.length < 2 || this.layerIndex < 0
            ? '' : ` (couche ${this.layerIndex + 1}/${pile.length})`;
        if (ids.length) {
            this.command.command(`// selectFaces ${ids.join(' ')}${depth}`);
        }
    }

    /** Select all stacked faces, or deselect all if every one is already selected. */
    toggleFaceStack(faces) {
        if (!faces.length) return;
        const allOn = faces.every(f => f.select);
        faces.forEach(f => { f.select = !allOn; });
    }

    /**
     * A drag starting on a face only folds once that face is already selected
     * (see foldAxis) — picking up a flap to fold is a deliberate two-step
     * gesture: select it first, then drag. Before it's selected, a drag either
     * scores a crease across existing paper, or — if it crosses nothing —
     * arms the face for folding, same as a click would.
     */
    fromFaceDrag() {
        const fold = this.foldIntent();
        if (fold) {
            this.foldAlong(fold.axis, fold.angle);
            return;
        }
        if (this.splitSegments()) return;
        if (!this.downFace.select) this.fromFaceClick();
    }

    /**
     * Rotation angle (degrees) if hinging the dragged face on `axis` right now.
     * Measured from where the paper was grabbed, so the angle is the result of
     * the drag rather than of the cursor's absolute position on the canvas.
     */
    angleFor(axis) {
        return this.rotationLabel(axis, this.firstX, this.firstY, this.currentX, this.currentY);
    }

    /** Explicit pin, else a segment you're aiming directly at that borders this face. */
    priorityAxis(nearSegment) {
        return this.selectedAxis()
            || (nearSegment && this.faceBorderSegments(this.downFace).includes(nearSegment) ? nearSegment : undefined);
    }

    /**
     * Axis to fold the dragged face around right now, or undefined if this
     * drag should score a crease (or just select the face) instead.
     * Folding only ever applies to an already-selected face — once armed,
     * whatever the drag crosses is ignored, since the user has already
     * committed to folding. A priorityAxis() always wins; the nearest
     * border edge is the fallback.
     */
    foldAxis(nearSegment) {
        if (!this.downFace?.select) return undefined;
        const priority = this.priorityAxis(nearSegment);
        if (priority) return priority;
        return this.nearestBorderSegment(this.downFace, this.currentX, this.currentY);
    }

    /**
     * The fold releasing now would commit, or undefined if this drag will do
     * something else. Single source of truth: the preview arrow and the released
     * gesture read the same decision, so the arrow cannot promise a fold that
     * does not happen. It used to: draw() asked about currentSegment while up()
     * asked about upSegment, and a release on a landmark point cancelled the
     * fold outright — while the amber arrow still showed an angle.
     */
    foldIntent() {
        // Still within the click threshold: up() will treat this as a click, so
        // the arrow must not advertise a fold yet.
        if (this.isClick()) return undefined;
        const axis = this.foldAxis(this.currentSegment);
        if (!axis) return undefined;
        const angle = this.angleFor(axis);
        return angle ? {axis, angle} : undefined;
    }

    /** Would releasing now actually rotate the dragged face? */
    willFold() {
        return !!this.foldIntent();
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

    /** Every segment lying on the crease line: the whole hinge, not just `axis`. */
    hingeSegments(axis) {
        const hinge = new Set(this.model.segments.filter(s => s.select));
        hinge.add(axis);
        for (const s of this.model.segments) {
            if (Helper.onAxisLine(s, axis)) hinge.add(s);
        }
        return hinge;
    }

    static onAxisLine(s, axis) {
        return Vector3.pointLineDistance(s.p1, axis.p1, axis.p2) < Helper.AXIS_EPSILON
            && Vector3.pointLineDistance(s.p2, axis.p1, axis.p2) < Helper.AXIS_EPSILON;
    }

    /** The faces the gesture points at, before any propagation. */
    foldSeeds() {
        const seeds = new Set(this.model.faces.filter(f => f.select));
        if (this.downFace) seeds.add(this.downFace);
        return seeds;
    }

    /**
     * The flap this fold moves: every face connected to the grabbed (or selected)
     * ones without crossing the hinge. This is what a diagram means by "fold this
     * layer" — paper on the same side of the crease travels together. Without it
     * only the grabbed face rotated and the sheet tore along its other creases.
     *
     * A crease only defines a flap when it actually separates the paper. An
     * interior crease that the sheet wraps around — the situation every compound
     * fold is built on — separates nothing, and propagating through it would
     * swing the whole model. isolatesFlap() catches that and the seeds are used
     * as they are, leaving the reconciliation to `adjust`, exactly as the
     * templates do by hand.
     */
    foldFlap(axis) {
        const flap = this.floodFrom(axis);
        return Helper.isolatesFlap(this.model, this.hingeSegments(axis), flap)
            ? flap
            : this.foldSeeds();
    }

    /**
     * Does the hinge have paper on one side only? If both faces along any part of
     * the crease ended up in the same set, the fold went round it and the crease
     * is not a boundary: the fold is compound, not a simple flap.
     */
    static isolatesFlap(model, hinge, flap) {
        for (const s of hinge) {
            const sides = Model.incidentFaces(model, s);
            if (sides.length === 2 && flap.has(sides[0]) && flap.has(sides[1])) return false;
        }
        return true;
    }

    /** A fold whose crease does not separate the paper needs more than one rotation. */
    isCompoundFold(axis) {
        return !Helper.isolatesFlap(this.model, this.hingeSegments(axis), this.floodFrom(axis));
    }

    /** Faces reachable from the seeds without crossing the hinge. */
    floodFrom(axis) {
        const hinge = this.hingeSegments(axis);
        const seen = new Set(this.foldSeeds());
        const queue = [...seen];
        while (queue.length) {
            for (const s of this.faceBorderSegments(queue.pop())) {
                if (hinge.has(s)) continue;
                for (const neighbour of Model.incidentFaces(this.model, s)) {
                    if (seen.has(neighbour)) continue;
                    seen.add(neighbour);
                    queue.push(neighbour);
                }
            }
        }
        return seen;
    }

    /** Every vertex of the flap, whether it moves or not. */
    flapPoints(flap) {
        const pts = new Set();
        for (const face of flap) face.points.forEach(p => pts.add(p));
        return [...pts];
    }

    /**
     * Flap vertices that actually travel. Points on the rotation axis stay put,
     * and excluding them keeps the command's point list honest as well as
     * avoiding floating-point drift from rotating a point that should not move.
     */
    movingPoints(axis, flap) {
        return this.flapPoints(flap).filter(p =>
            Vector3.pointLineDistance(p, axis.p1, axis.p2) >= Helper.AXIS_EPSILON);
    }

    rotatePointIds(axis, flap = this.foldFlap(axis)) {
        return this.movingPoints(axis, flap).map(p => this.id(p));
    }

    /**
     * Points the paper is still attached to somewhere other than the hinge, so
     * the solver has to drag them along. For a plain fold this is empty: every
     * link between the flap and the rest of the sheet lies on the crease. It only
     * fills up for a compound fold — rabbit ear, squash, petal — which is exactly
     * the `a` list the templates have to spell out by hand today:
     *     t 1000 r s9 180 p6 a p2
     */
    slackPoints(axis, flap, moving) {
        const inFlap = new Set(this.flapPoints(flap));
        const slack = new Set();
        for (const p of moving) {
            for (const s of this.model.searchSegmentsOnePoint(p)) {
                const other = s.p1 === p ? s.p2 : s.p1;
                if (inFlap.has(other)) continue;
                if (Vector3.pointLineDistance(other, axis.p1, axis.p2) < Helper.AXIS_EPSILON) continue;
                slack.add(other);
            }
        }
        return [...slack];
    }

    // Points the solver reconciles instead of rotating: those the user selected,
    // plus the slack the fold drags along. Never one that is already rotating.
    adjustPointIds(rotatedIds, slack = []) {
        const rotated = new Set(rotatedIds);
        const ids = new Set([
            ...this.model.points.filter(p => p.select),
            ...slack,
        ].map(p => this.id(p)));
        return [...ids].filter(id => !rotated.has(id));
    }
    rotatePoints(axis, angle) {
        const flap = this.foldFlap(axis);
        const moving = this.movingPoints(axis, flap);
        const pts = moving.map(p => this.id(p));
        const adjustPts = this.adjustPointIds(pts, this.slackPoints(axis, flap, moving));
        const adjust = adjustPts.length ? ` a ${adjustPts.join(' ')}` : '';
        const faces = [...flap].map(f => this.id(f));
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
        // Euclidean, like the segment test below: Manhattan made the sensitive
        // area of a point a diamond, so a point felt harder to grab diagonally.
        const points = this.model.points.filter(p => Math.hypot(p.xf - xf, p.yf - yf) < PICK_POINT_PX / scale);
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < PICK_SEGMENT_PX / scale);
        const faces = this.model.faces.filter(f => Face.contains2d(f, xf, yf));
        return {points, segments, faces};
    }

    // Down on flat 2d
    down2d(event) {
        this.currentCanvas = '2d';
        this.trackPointerType(event);
        this.pileAll = !!event.altKey;
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
        // Where the pointer was released, not where the last pointermove landed:
        // a coalesced or dropped move otherwise makes a drag read as a click.
        this.currentX = xf;
        this.currentY = -yf;
        this.up(points, segments, faces);
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
        const points = this.model.points.filter(p => Math.hypot(p.xCanvas - xCanvas, p.yCanvas - yCanvas) < PICK_POINT_PX);
        // Segments near xCanvas, yCanvas
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas) < PICK_SEGMENT_PX);
        // Faces under cursor: depth-sorted; when contextFace set, adjacent faces only
        const faces = this.pickFaces3d(xCanvas, yCanvas, contextFace);
        return {points, segments, faces};
    }
    // Down on 3d overlay
    down3d(event) {
        this.currentCanvas = '3d';
        this.trackPointerType(event);
        this.pileAll = !!event.altKey;
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        // Shift, or the middle button, always orbits. Without it there is no way
        // to look at the model from another angle once it fills the view: the
        // drag is spent on whatever is under the cursor instead.
        const forceOrbit = !!(event.shiftKey || event.button === 1);
        const {points, segments, faces} = forceOrbit
            ? {points: [], segments: [], faces: []}
            : this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
        // Orbiting is decided once, here: re-deciding it on every move made an
        // orbit stop as soon as the cursor passed over the paper and resume once
        // it left again.
        this.orbiting = forceOrbit
            || (points.length === 0 && segments.length === 0 && faces.length === 0);
    }

    // Move on 3d overlay
    move3d(event) {
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const contextFace = this.downFace || undefined;
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas, contextFace);
        // Handle 3d rotation, on the left or the middle button
        if (this.orbiting && (event.buttons & 5) > 0) {
            // Rotation
            const factor = (600 / (event.target?.height || 600));
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
        const wasClick = this.isClickAt(xCanvas, yCanvas);
        this.currentX = xCanvas;
        this.currentY = yCanvas;
        this.up(points, segments, faces);
        // An orbit ends wherever it ends; only a click on nothing arms the
        // double-click that resets the view.
        if (wasClick && points.length === 0 && segments.length === 0 && faces.length === 0) {
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
        if (Date.now() - this.viewClickTime < DOUBLE_CLICK_MS) {
            this.view3d.angleX = this.view3d.angleY = this.view3d.angleZ = 0;
            this.view3d.translationX = this.view3d.translationY = 0;
            this.view3d.scale = 1;
            this.command.command('fit');
            this.viewClickTime = 0;
            return;
        }
        this.viewClickTime = Date.now();
    }
}
