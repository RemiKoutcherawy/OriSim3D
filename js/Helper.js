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
        // Mouse coordinates, down and current
        this.downX = this.downY = this.currentX = this.currentY = undefined;
        // Objects under down (and primary down point/segment/face)
        this.downPoints = this.downSegments = this.downFaces = undefined;
        this.downPoint = this.downSegment = this.downFace = undefined;
        // Current canvas: 2d or 3d
        this.currentCanvas = undefined
        // To test with Deno overlay is null
        if (overlay) {
            // 3d
            overlay.addEventListener('mousedown', (event) => this.down3d(event));
            overlay.addEventListener('mousemove', (event) => this.move3d(event));
            overlay.addEventListener('mouseup', (event) => this.up3d(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('mouseout', (event) => this.out(event));
            overlay.addEventListener('contextmenu', (event) => {event.preventDefault();});
            // 2d
            canvas2d.addEventListener('mousedown', (event) => this.down2d(event));
            canvas2d.addEventListener('pointermove', (event) => this.move2d(event));
            canvas2d.addEventListener('mouseup', (event) => this.up2d(event));
            canvas2d.addEventListener('mouseout', (event) => this.out(event));
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

    // init properties
    out() {
        this.downX = this.downY = this.currentX = this.currentY = undefined;
        this.downPoints = this.downSegments = this.downFaces = undefined;
        this.downPoint = this.downSegment = this.downFace = this.currentCanvas = this.label = undefined;
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
        context.moveTo(this.downX, this.downY);
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
        this.downPoints = points;
        this.downSegments = segments;
        this.downFaces = faces;
        this.downPoint = points[0];
        this.downSegment = !this.downPoint ? segments[0] : undefined;
        this.downFace = !this.downPoint && !this.downSegment ? faces[0] : undefined;
        this.downX = this.currentX = x;
        this.downY = this.currentY = y;
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
                let distToFirst, distToCurrent;
                if (this.currentCanvas === '2d') {
                    // Signed distance from the down point to segment.
                    distToFirst = (p.xf - s.p1.xf) * (s.p2.yf - s.p1.yf) - (p.yf - s.p1.yf) * (s.p2.xf - s.p1.xf);
                    // Signed distance from current point to segment. Which is cos(angle) * distToFirst.
                    distToCurrent = (x - s.p1.xf) * (s.p2.yf - s.p1.yf) - (-y - s.p1.yf) * (s.p2.xf - s.p1.xf); // Note inverse y
                } else {
                    // Get projected coordinates for points
                    const pProj = [p.xCanvas, p.yCanvas], p1Proj = [s.p1.xCanvas, s.p1.yCanvas], p2Proj = [s.p2.xCanvas, s.p2.yCanvas];
                    distToFirst = (pProj[0] - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (pProj[1] - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
                    distToCurrent = (x - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (y - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
                }
                // Clamp ratio = distToCurrent/distToFirst
                let ratio = Math.abs(distToCurrent / distToFirst);
                ratio = Math.round(ratio * 100) / 100;
                // Angle in degrees
                let angle = (ratio - 1) * 180 * -Math.sign(distToFirst);
                // Round to step 10
                angle = Math.round(angle / 10) * 10;
                // Clamp near-zero angle to 0
                this.label = Math.abs(angle) < 10 ? 0 : angle;
            }
        } else if (this.downSegment) {
            this.downSegment.hover = true;
        }
        this.currentX = x;
        this.currentY = y;
    }

    up(points, segments, faces) {
        this.downPoint = (this.downPoints || []).find(p => points.includes(p));
        this.downSegment = (this.downSegments || []).find(s => segments.includes(s));
        this.downFace = (this.downFaces || []).find(f => faces.includes(f));
        if (this.downPoint) {
            this.fromPoint(points, segments)
        } else if (this.downSegment) {
            this.fromSegment(points, segments)
        } else if (this.downFace) {
            this.fromFace(points, segments, faces)
        }
        else {
            this.model.points.forEach(p => p.select = false)
            this.model.segments.forEach(s => s.select = false)
            this.model.faces.forEach(f => f.select = false)
        }
        this.out()
    }
    fromPoint(points, segments) {
        // To Point
        if (points.length > 0) {
            const p = points[0]
            // To the same point select or deselect
            if (this.downPoint === p) {
                p.select = !p.select;
            }
            // To another point
            else {
                // Two points on same segment => Crease across segment
                if (this.model.getSegment(this.downPoint, p)) {
                    this.sendCmd('across', 'p' + this.model.indexOf(this.downPoint), 'p' + this.model.indexOf(p));
                }
                // Two points but not on same segment => Crease by two points
                else {
                    this.sendCmd('by', 'p' + this.model.indexOf(this.downPoint), 'p' + this.model.indexOf(p))
                }
            }
        }
        // To segment but not in current rotation
        else if (segments.length > 0 && this.label === undefined) {
            const s = segments[0]
            this.sendCmd('p', 's' + this.model.indexOf(s), 'p' + this.model.indexOf(this.downPoint))
        }
        // To segment in current rotation
        else if (this.label) {
            this.rotatePoints()
        }
    }
    fromSegment(points, segments) {
        // To segment
        if (segments.length > 0 ){
            const s = segments[0]
            // To same segment select
            if (s === this.downSegment) {
                s.select = !s.select
            }
            // To another segment crease bisector
            else{
                this.sendCmd('bisector', 's' + this.model.indexOf(this.downSegment), 's' + this.model.indexOf(s))
            }
        }
        // To point crease perpendicular from segment to point
        else if (points.length > 0)
            this.sendCmd('p', 's' + this.model.indexOf(this.downSegment), 'p' + this.model.indexOf(points[0]))
    }
    fromFace(points, segments, faces) {
        console.log(faces.length, faces[0] === this.downFace, faces.some(f => f.select === true))
        // To the same face: select or deselect
        if (faces.length > 0 && faces[0] === this.downFace) {
            faces.forEach(f => f.select = !f.select);
            // Show offsets
            faces.forEach((f)=>{
                this.command.command(`// face ${this.model.indexOf(f)} offset ${f.offset} `);
            });
        }
        // To another face with some selected
        else if (faces.length > 0 && faces.some(f => f.select === true)) {
            this.command.command(`// To another face with some selected`);
            this.fromFaceToFace(this.downFace, faces[0]);
        }
        // To nothing: split segments on 2d crease pattern.
        else {
            this.command.command(`// To another face Split`);
            const is2d = this.currentCanvas === '2d';
            const ySign = is2d ? -1 : 1;
            const down = {xf: this.downX, yf: ySign * this.downY};
            const current = {xf: this.currentX, yf: ySign * this.currentY};
            this.model.segments.forEach((s, i) => {
                const p1 = is2d ? s.p1 : {xf: s.p1.xCanvas, yf: s.p1.yCanvas};
                const p2 = is2d ? s.p2 : {xf: s.p2.xCanvas, yf: s.p2.yCanvas};
                const inter = Segment.intersectionFlat(down, current, p1, p2);
                if (inter) {
                    const ratio = Math.hypot(inter.xf - p1.xf, inter.yf - p1.yf) / Math.hypot(p2.xf - p1.xf, p2.yf - p1.yf);
                    s.p1.z ||= 0.1;
                    s.p2.z ||= 0.1;
                    const t = Math.round((is2d ? ratio : (ratio * s.p1.z) / ((1 - ratio) * s.p2.z + ratio * s.p1.z)) * 100) / 100;
                    this.command.command(`split s${i} ${t}`);
                }
            });
        }
    }

    // From face to face with some faces selected
    fromFaceToFace(f1, f2) {
        const i1 = this.model.indexOf(f1);
        const i2 = this.model.indexOf(f2);
        // With some faces selected
        this.command.command(`// From f${i1} to f${i2}`);
        const faces = this.model.faces.filter(f => f.select === true);
        // Debug list selected faces
        faces.forEach((f) => {
            this.command.command(`// Selected ${this.model.indexOf(f)}`)
        });
    }

    sendCmd(base, ...ids) {
        const suffix = this.currentCanvas === '2d' ? '2d' : '3d'
        this.command.command(`${base}${suffix} ${ids.join(' ')}`)
    }
    // Rotate selected points around selected segment
    rotatePoints() {
        const s = this.model.segments.find(s => s.select)
        const pts = this.model.points.filter(p => p.select).map(p => 'p' + this.model.points.indexOf(p))
        this.command.command(`t 1000 r s${this.model.indexOf(s)} ${this.label} ${pts.join(' ')}`)
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
    get2dSelection(event) {
        const {xf, yf} = this.event2d(event);
        return {xf, yf, ...this.search2d(xf, yf)};
    }
    // Down on flat 2d
    down2d(event) {
        this.currentCanvas = '2d';
        const {xf, yf, points, segments, faces} = this.get2dSelection(event);
        this.down(points, segments, faces, xf, -yf); // Note inverse y coordinate
    }
    // Move on flat 2d
    move2d(event) {
        this.currentCanvas = '2d';
        const {xf, yf, points, segments, faces} = this.get2dSelection(event);
        this.move(points, segments, faces, xf, -yf);
    }
    // Up on flat 2d
    up2d(event) {
        const {points, segments, faces} = this.get2dSelection(event);
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
    search3d(xCanvas, yCanvas) {
        // Points near xCanvas, yCanvas
        const points = this.model.points.filter(p => Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 10);
        // Segments near xCanvas, yCanvas
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas) < 6);
        // Face containing xCanvas, yCanvas
        const faces = this.model.faces.filter(f => Face.contains3d(f, xCanvas, yCanvas, this.view3d));
        return {points, segments, faces};
    }
    get3dSelection(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        return {xCanvas, yCanvas, ...this.search3d(xCanvas, yCanvas)};
    }
    // Down on 3d overlay
    down3d(event) {
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas, points, segments, faces} = this.get3dSelection(event);
        this.down(points, segments, faces, xCanvas, yCanvas);
    }

    // Move on 3d overlay
    move3d(event) {
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas, points, segments, faces} = this.get3dSelection(event);
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
        const {points, segments, faces} = this.get3dSelection(event);
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
