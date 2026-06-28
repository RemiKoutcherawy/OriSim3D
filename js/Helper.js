import {Segment} from './Segment.js';
import {Face} from './Face.js';

export class Helper {
    constructor(model, command, canvas2d, view3d, overlay, commandArea) {
        this.model = model;
        this.command = command;
        this.canvas2d = canvas2d;
        this.view3d = view3d;
        this.overlay = overlay;
        this.commandArea = commandArea; // maybe null
        this.touchTime = 0;
        this.label = undefined;
        // To test with Deno
        if (overlay) {
            // 3d
            overlay.addEventListener('mousedown', (event) => this.down3d(event));
            overlay.addEventListener('mousemove', (event) => this.move3d(event));
            overlay.addEventListener('mouseup', (event) => this.up3d(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('mouseout', (event) => this.out(event));
            overlay.addEventListener('contextmenu', (event) => {event.preventDefault();});
        }
        if (canvas2d) {
            // 2d
            canvas2d.addEventListener('mousedown', (event) => this.down2d(event));
            canvas2d.addEventListener('pointermove', (event) => this.move2d(event));
            canvas2d.addEventListener('mouseup', (event) => this.up2d(event));
            canvas2d.addEventListener('mouseout', () => this.out());
        }
        this.out();
    }

    // init properties
    out() {
        this.firstX = this.firstY = this.currentX = this.currentY = undefined;
        this.firstPoint = this.firstSegment = this.firstFace = this.currentCanvas = this.label = undefined;
    }

    // Draw only if a point, segment, or face is selected
    draw() {
        if (!this.firstPoint && !this.firstSegment && !this.firstFace) {
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
        this.firstPoint = points[0];
        this.firstSegment = !this.firstPoint ? segments[0] : undefined;
        this.firstFace = !this.firstPoint && !this.firstSegment ? faces[0] : undefined;
        this.firstX = this.currentX = x;
        this.firstY = this.currentY = y;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        if (this.firstPoint) {
            this.firstPoint.hover = true;
            // From Point with selected segment(s)
            const s = this.model.segments.find(s => s.select === 1);
            if (s) {
                // Deselect other segments
                this.model.segments.filter(sg => sg.select === 1 && sg !== s).forEach(sg => sg.select = 0);
                // The point we move from
                const p = this.firstPoint;
                p.select = 1;
                let distToFirst, distToCurrent;
                if (this.currentCanvas === '2d') {
                    // Signed distance from the first point to segment.
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
                ratio = Math.round(ratio / 100) * 100;
                // Angle in degrees
                let angle = (ratio - 1) * 180 * -Math.sign(distToFirst);
                // Round to step 10
                angle = Math.round(angle / 10) * 10;
                // Round to 0 for angles less than 10
                angle = Math.abs(Math.abs(angle) - 10) < 10 ? '00' : angle;
                this.label = angle;
            }
        } else if (this.firstSegment) {
            this.firstSegment.hover = true;
        }
        this.currentX = x;
        this.currentY = y;
    }

    up(points, segments, faces) {
        // From a point
        if (this.firstPoint) {
            // To Point
            if (points.length > 0 && this.label === undefined) {
                const p = points[0];
                if (this.firstPoint === p) {
                    // To the same point select
                    points.forEach((p) => {
                        p.select = (p.select + 1) % 3;
                        // Adjust if double-select
                        if (p.select === 2) {
                            this.model.adjust(p);
                            this.view3d.initModelView();
                        }
                    });
                    let liste = points.map(p => 'p'+this.model.indexOf(p) + '[' + Math.round(p.x * 10) / 10 + ',' + Math.round(p.y * 10) / 10 + ',' + Math.round(p.z * 10) / 10 + ']').join(' ');
                    if (this.commandArea) this.commandArea.addLine(`points ${liste}`);
                }
                // To another point
                else if (points.length > 0) {
                    const p = points[0];
                    const aIndex = this.model.indexOf(this.firstPoint);
                    const bIndex = this.model.indexOf(p);
                    // Two points on an existing segment
                    if (this.model.getSegment(this.firstPoint, p)) {
                        if (this.currentCanvas === '2d') {
                            this.command.command(`across2d p${aIndex} p${bIndex}`);
                        } else {
                            this.command.command(`across3d p${aIndex} p${bIndex}`);
                        }
                    }
                    // Two points but not on segment
                    else {
                        if (this.currentCanvas === '2d') {
                            this.command.command(`by2d p${aIndex} p${bIndex}`);
                        } else {
                            this.command.command(`by3d p${aIndex} p${bIndex}`);
                        }
                    }
                }
            }
            // To segment
            else if (segments.length > 0 && this.label === undefined) {
                // Crease perpendicular from segment to point
                const aIndex = this.model.indexOf(segments[0]);
                const bIndex = this.model.indexOf(this.firstPoint);
                if (this.currentCanvas === '2d') {
                    this.command.command(`p2d s${aIndex} p${bIndex}`);
                } else {
                    this.command.command(`p3d s${aIndex} p${bIndex}`);
                }
            }
            // To face or nothing checks if rotating
            else if (this.label) {
                const s = this.model.segments.find(s => s.select === 1);
                const aIndex = this.model.indexOf(s);
                const selected = this.model.points.filter(s => s.select === 1);
                const bIndex = selected.map(p => 'p'+this.model.points.indexOf(p));
                const adjust = this.model.points.filter(s => s.select === 2);
                const cIndex = adjust.map(p => 'p'+this.model.points.indexOf(p));
                if (adjust.length === 0) {
                    this.command.command(`t 1000 r s${aIndex} ${this.label} ${bIndex.join(' ')}`);
                } else {
                    this.command.command(`t 1000 r s${aIndex} ${this.label} ${bIndex.join(' ')} a ${cIndex.join(' ')}`);
                }
            }
        }
        // From segment
        else if (this.firstSegment) {
            // To same segment select
            if (segments.length > 0) {
                const s = segments[0];
                if (s === this.firstSegment) {
                    segments.forEach((s) => s.select = (s.select + 1) % 3);
                    let liste = segments.map(s => ('s'+this.model.indexOf(s) + '[' + Math.round(Segment.length2d(s) * 10) / 10 + ';' + Math.round(Segment.length3d(s) * 10) / 10) + ']').join(' ');
                    if (this.commandArea) this.commandArea.addLine(`segments ${liste}`);
                }
                // To point crease perpendicular from segment to point
                else if (points.length > 0) {
                    const p = points[0];
                    const aIndex = this.model.indexOf(this.firstSegment);
                    const bIndex = this.model.indexOf(p);
                    if (this.currentCanvas === '2d') {
                        this.command.command(`p2d s${aIndex} p${bIndex}`);
                    } else {
                        this.command.command(`p3d s${aIndex} p${bIndex}`);
                    }
                }
                // To another segment crease bisector
                else if (segments.length > 0) {
                    const s = segments[0];
                    const aIndex = this.model.indexOf(this.firstSegment);
                    const bIndex = this.model.indexOf(s);
                    if (this.currentCanvas === '2d') {
                        this.command.command(`bisector2d s${aIndex} s${bIndex}`);
                    } else {
                        this.command.command(`bisector3d s${aIndex} s${bIndex}`);
                    }
                }
            }
        }
        // From face
        else if (this.firstFace) {
            if (faces.length > 0 && this.firstFace === faces[0]) {
                // To the same face
                this.model.click2d3d(points, segments, faces);
                let liste = faces.map(f => 'F'+this.model.indexOf(f) + ':' + f.offset).join(' ');
                if (this.commandArea) this.commandArea.addLine(`offsets ${liste}`);
            } else {
                // To another face or nothing: split segments on crease pattern.
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
                        s.p1.z ||= 0.1; s.p2.z ||= 0.1;
                        const t = Math.round((is2d ? ratio : (ratio * s.p1.z) / ((1 - ratio) * s.p2.z + ratio * s.p1.z)) * 100) / 100;
                        this.command.command(`split s${i} ${t}`);
                    }
                });
            }
        }
        // From Nothing to Nothing
        else {
            // Deselect
            this.model.points.forEach(p => p.select = 0);
            this.model.segments.forEach(s => s.select = 0);
            this.model.faces.forEach(f => f.select = 0);
        }
        this.out();
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
    search3d(xCanvas, yCanvas) {
        // Points near xCanvas, yCanvas
        const points = this.model.points.filter(p => Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 10);
        // Segments near xCanvas, yCanvas
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas) < 6);
        // Face containing xCanvas, yCanvas
        const faces = this.model.faces.filter(f => Face.contains3d(f, xCanvas, yCanvas, this.view3d));
        return {points, segments, faces, xCanvas, yCanvas};
    }

    // Down on 3d overlay
    down3d(event) {
        if (event.button === 2) {
            event.preventDefault();
        }
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
    }

    // Move on 3d overlay
    move3d(event) {
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        // Handle 3d rotation
        if (points.length === 0 && segments.length === 0 && faces.length === 0
            && event.buttons === 1
            && !this.firstPoint && !this.firstSegment && !this.firstFace) {
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
        const {points, segments, faces, xCanvas, yCanvas} = this.search3d(...Object.values(this.eventCanvas3d(event)));
        if (this.firstPoint && points.length === 0 && !segments.length && this.currentX !== this.firstX) {
            let dx = (xCanvas - this.firstX) / this.view3d.scale, dy = (this.firstY - yCanvas) / this.view3d.scale, v = this.view3d,
                r = d => d * Math.PI / 180;
            const cz = Math.cos(r(v.angleZ)), sz = Math.sin(r(v.angleZ));
            [dx, dy] = [dx * cz - dy * sz, dx * sz + dy * cz];
            let mx = dx * Math.cos(r(v.angleY)), my = dy * Math.sin(r(v.angleY)),
                mz = dx * Math.sin(r(v.angleY)) - dy * Math.sin(r(v.angleX)),
                sel = this.model.points.filter(pt => pt.select === 1),
                pts = sel.map(pt => 'p'+this.model.points.indexOf(pt)).join(' ');
            // Round to 0.01
            mx = Math.round(mx * 100) / 100;
            my = Math.round(my * 100) / 100;
            mz = Math.round(mz * 100) / 100;
            this.command.command(`move ${mx} ${my} ${mz} ${pts}`);
            this.command.command(`adjust ${pts}`);
            this.out();
        } else {
            this.up(points, segments, faces);
        }
        this.currentCanvas = undefined;
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
    }

    // Mouse wheel on 3d overlay
    wheel(event) {
        // deltaY => up or down zoom view
        this.view3d.scale = event.scale !== undefined ? event.scale / 10 : this.view3d.scale + event.deltaY / 3000;
        this.view3d.scale = Math.min(Math.max(this.view3d.scale, 0.2), 3); // 0.2 < scale < 3
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
