import {Segment} from './Segment.js';
import {Face} from './Face.js';

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
        this.currentCanvas = this.label = this.hinge = undefined;
    }

    // Draw only if a point, segment, or face is selected
    draw() {
        if (!this.downPoint && !this.downSegment && !this.downFace) {
            return;
        }
        const context = (this.currentCanvas === '2d' ? this.canvas2d : this.overlay).getContext('2d');
        context.lineWidth = 4;
        context.lineCap = 'round';
        context.strokeStyle = 'green';
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
        this.firstX = this.currentX = x;
        this.firstY = this.currentY = y;
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

    // Face drag: same as rotationLabel but 2D sign is inverted.
    faceRotationLabel(s, refX, refY, x, y) {
        let angle = this.rotationLabel(s, refX, refY, x, y);
        if (this.currentCanvas === '2d' && angle) angle = -angle;
        return angle;
    }

    // Target face for fold: prefer unselected adjacent face toward cursor.
    facePickPoint(f) {
        if (this.currentCanvas === '2d') {
            const c = this.faceCentroid(f);
            return {x: c.xf, y: -c.yf};
        }
        const c = this.faceCentroidCanvas(f);
        return {x: c.xCanvas, y: c.yCanvas};
    }

    pickTargetFace(candidates, downFace, x, y) {
        const others = candidates.filter((f) => f !== downFace);
        if (others.length === 0) return undefined;
        const selected = new Set(
            this.model.faces.filter((f) => f.select && f !== downFace),
        );
        const towardDest = others.filter((f) => !selected.has(f));
        const pool = towardDest.length > 0 ? towardDest : others;
        if (pool.length === 1) return pool[0];
        let best = pool[0];
        let bestD = Infinity;
        for (const f of pool) {
            const p = this.facePickPoint(f);
            const d = Math.hypot(x - p.x, y - p.y);
            if (d < bestD) {
                bestD = d;
                best = f;
            }
        }
        return best;
    }

    adjacentTargetFaces(faces, downFace) {
        return faces.filter((f) =>
            f !== downFace && this.model.sharedSegments(downFace, f).length > 0,
        );
    }

    hasDragged(threshold = 5) {
        return Math.hypot(this.currentX - this.firstX, this.currentY - this.firstY) >= threshold;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        if (this.downPoint) {
            this.downPoint.hover = true;
            // From Point with selected segment(s)
            const s = this.model.segments.find(s => s.select);
            if (s) {
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
        } else if (this.downFace) {
            this.downFace.hover = true;
            if (!this.hasDragged()) {
                this.hinge = undefined;
                this.label = undefined;
            } else {
                const candidates = this.currentCanvas === '3d'
                    ? faces
                    : this.adjacentTargetFaces(faces, this.downFace);
                const f2 = this.pickTargetFace(candidates, this.downFace, x, y);
                let hinge;
                if (f2) {
                    const shared = this.model.sharedSegments(this.downFace, f2);
                    if (shared.length > 0) {
                        const dragStart = this.currentCanvas === '2d'
                            ? {xf: this.firstX, yf: -this.firstY}
                            : this.faceCentroid(this.downFace);
                        const dragEnd = this.currentCanvas === '2d'
                            ? {xf: x, yf: -y}
                            : this.faceCentroid(f2);
                        hinge = shared.length === 1
                            ? shared[0]
                            : this.model.nearestSharedSegment(
                                shared,
                                (dragStart.xf + dragEnd.xf) / 2,
                                (dragStart.yf + dragEnd.yf) / 2,
                            );
                    }
                }
                if (!hinge) {
                    const mid = this.dragMidpoint();
                    hinge = this.nearestFaceSegment(this.downFace, mid.x, mid.y);
                }
                if (hinge) {
                    this.model.segments.forEach((sg) => { sg.select = false; });
                    hinge.select = true;
                    this.hinge = hinge;
                    const {refX, refY} = this.mobileFaceRef(this.downFace, hinge);
                    this.label = this.faceRotationLabel(hinge, refX, refY, x, y);
                } else {
                    this.hinge = undefined;
                    this.label = undefined;
                }
            }
        }
        this.currentX = x;
        this.currentY = y;
    }

    up(points, segments, faces) {
        this.upPoint = points[0];
        this.upSegment = !this.upPoint ? segments[0] : undefined;
        if (!this.upPoint && !this.upSegment && this.downFace) {
            if (this.hasDragged()) {
                const candidates = this.adjacentTargetFaces(faces, this.downFace);
                this.upFace = this.pickTargetFace(candidates, this.downFace, this.currentX, this.currentY)
                    ?? (faces[0] !== this.downFace ? faces[0] : undefined);
            } else {
                this.upFace = this.downFace;
            }
        } else {
            this.upFace = !this.upPoint && !this.upSegment ? faces[0] : undefined;
        }

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
        if (!this.hasDragged()) {
            this.downFace.select = !this.downFace.select;
            this.command.command(`// face ${this.model.indexOf(this.downFace)} offset ${this.downFace.offset} `);
            return;
        }
        if (this.label) {
            if (this.upFace && this.upFace !== this.downFace) {
                this.fromFaceToFace(this.downFace, this.upFace);
            } else {
                this.fromFaceFold(this.downFace);
            }
        } else if (this.upFace && this.upFace !== this.downFace) {
            this.fromFaceToFace(this.downFace, this.upFace);
        } else {
            this.splitSegments();
        }
    }

    // Midpoint of the current drag in flat (2d) or canvas (3d) coordinates.
    dragMidpoint() {
        if (this.currentCanvas === '2d') {
            return {
                x: (this.firstX + this.currentX) / 2,
                y: -(this.firstY + this.currentY) / 2,
            };
        }
        return {
            x: (this.firstX + this.currentX) / 2,
            y: (this.firstY + this.currentY) / 2,
        };
    }

    // Edge of face closest to (x, y) in the current canvas space.
    nearestFaceSegment(face, x, y) {
        const segs = this.model.segmentsOfFace(face);
        if (segs.length === 0) return undefined;
        let best = segs[0];
        let bestD = Infinity;
        for (const s of segs) {
            const d = this.currentCanvas === '2d'
                ? Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, x, y)
                : Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, x, y);
            if (d < bestD) {
                bestD = d;
                best = s;
            }
        }
        return best;
    }

    // Fold face around hinge from drag; angle from mouse only.
    fromFaceFold(face) {
        const mid = this.dragMidpoint();
        const hinge = this.hinge ?? this.nearestFaceSegment(face, mid.x, mid.y);
        if (!hinge) {
            this.command.command(`// Pli impossible: pas de charnière sur ${this.id(face)}`);
            return;
        }
        this.executeFaceFold(face, hinge);
    }

    executeFaceFold(face, hinge) {
        if (!(this.model.isBorderPoint(hinge.p1) && this.model.isBorderPoint(hinge.p2))) {
            this.command.command(`// Attention: charnière ${this.id(hinge)} pas entièrement sur le bord`);
        }
        this.model.segments.forEach((s) => { s.select = false; });
        hinge.select = true;
        const selected = this.model.faces.filter((f) => f.select);
        const pts = selected.length > 0
            ? this.model.flapPoints(face, hinge, selected)
            : this.model.flapPoints(face, hinge);
        if (pts.length === 0) {
            this.command.command(`// Pli impossible: aucun point mobile sur ${this.id(face)}`);
            return;
        }
        let angle = this.label;
        if (angle === undefined) {
            const {refX, refY} = this.mobileFaceRef(face, hinge);
            angle = this.faceRotationLabel(hinge, refX, refY, this.currentX, this.currentY);
        }
        if (!angle) {
            this.command.command(`// angle nul`);
            return;
        }
        const ptIds = pts.map((p) => this.id(p)).join(' ');
        this.command.command(`t 1000 r ${this.id(hinge)} ${angle} ${ptIds}`);
    }

    // Drag face f1 → face f2: fold mobile flap f1 toward f2 along shared hinge.
    fromFaceToFace(f1, f2) {
        const shared = this.model.sharedSegments(f1, f2);
        if (shared.length === 0) {
            this.command.command(`// Pli impossible: pas d'arête commune entre ${this.id(f1)} et ${this.id(f2)}`);
            return;
        }
        let hinge = this.hinge;
        if (!hinge || !shared.includes(hinge)) {
            const dragStart = this.currentCanvas === '2d'
                ? {xf: this.firstX, yf: -this.firstY}
                : this.faceCentroid(f1);
            const dragEnd = this.currentCanvas === '2d'
                ? {xf: this.currentX, yf: -this.currentY}
                : this.faceCentroid(f2);
            hinge = shared.length === 1
                ? shared[0]
                : this.model.nearestSharedSegment(
                    shared,
                    (dragStart.xf + dragEnd.xf) / 2,
                    (dragStart.yf + dragEnd.yf) / 2,
                );
        }
        this.executeFaceFold(f1, hinge);
    }

    mobileFaceRef(mobileFace, hinge) {
        const mobile = mobileFace.points.find((p) => p !== hinge.p1 && p !== hinge.p2);
        if (this.currentCanvas === '2d') {
            const c = mobile ? mobile : this.faceCentroid(mobileFace);
            return {refX: c.xf, refY: c.yf};
        }
        const c = mobile ? mobile : this.faceCentroidCanvas(mobileFace);
        return {refX: c.xCanvas, refY: c.yCanvas};
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
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.down(points, segments, faces, xf, -yf); // Note inverse y coordinate
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
