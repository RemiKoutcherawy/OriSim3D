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
        this.firstX = this.firstY = this.currentX = this.currentY = undefined;
        this.downPoints = [];
        this.downPoint = this.downSegment = this.downFace = undefined;
        this.upPoint = this.upSegment = this.upFace = undefined;
        this.moving = false;
        if (overlay) {
            overlay.addEventListener('pointerdown', (event) => this.down3d(event));
            overlay.addEventListener('pointermove', (event) => this.move3d(event));
            overlay.addEventListener('pointerup', (event) => this.up3d(event));
            overlay.addEventListener('pointercancel', (event) => this.out(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('contextmenu', (event) => {event.preventDefault();});
            canvas2d.addEventListener('pointerdown', (event) => {
                try { canvas2d.setPointerCapture(event.pointerId); } catch { /* ignore */ }
                this.down2d(event);
            });
            canvas2d.addEventListener('pointermove', (event) => this.move2d(event));
            canvas2d.addEventListener('pointerup', (event) => this.up2d(event));
            canvas2d.addEventListener('pointercancel', (event) => this.out(event));
            document.addEventListener('keydown', (event) => this.keydown(event));
        }
        this.out();
    }
    keydown(event) {
        if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
            this.command.command('undo');
        }
    }

    id(obj) {
        if (!obj) return '';
        if (this.model.points.includes(obj)) return 'p' + this.model.indexOf(obj);
        if (this.model.segments.includes(obj)) return 's' + this.model.indexOf(obj);
        if (this.model.faces.includes(obj)) return 'f' + this.model.indexOf(obj);
        return '';
    }

    out() {
        this.downPoints = [];
        this.downPoint = this.downSegment = this.downFace = undefined;
        this.upPoint = this.upSegment = this.upFace = undefined;
        this.currentCanvas = this.label = undefined;
        this.moving = false;
        this.rawX = this.rawY = undefined;
    }

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

    down(points, segments, faces, x, y) {
        this.downPoints = [...points];
        this.downPoint = points[0];
        this.downSegment = !this.downPoint ? segments[0] : undefined;
        this.downFace = !this.downPoint && !this.downSegment ? faces[0] : undefined;
        this.firstX = this.currentX = x;
        this.firstY = this.currentY = y;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        if (this.downPoint) {
            this.downPoint.hover = true;
            const s = this.model.segments.find(s => s.select);
            if (s) {
                this.model.segments.filter(sg => sg.select && sg !== s).forEach(sg => sg.select = false);
                const p = this.downPoint;
                p.select = true;
                let distToFirst, distToCurrent;
                if (this.currentCanvas === '2d') {
                    distToFirst = (p.xf - s.p1.xf) * (s.p2.yf - s.p1.yf) - (p.yf - s.p1.yf) * (s.p2.xf - s.p1.xf);
                    distToCurrent = (x - s.p1.xf) * (s.p2.yf - s.p1.yf) - (-y - s.p1.yf) * (s.p2.xf - s.p1.xf);
                } else {
                    const pProj = [p.xCanvas, p.yCanvas], p1Proj = [s.p1.xCanvas, s.p1.yCanvas], p2Proj = [s.p2.xCanvas, s.p2.yCanvas];
                    distToFirst = (pProj[0] - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (pProj[1] - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
                    distToCurrent = (x - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (y - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
                }
                let ratio = Math.abs(distToCurrent / distToFirst);
                ratio = Math.round(ratio * 100) / 100;
                let angle = (ratio - 1) * 180 * -Math.sign(distToFirst);
                angle = Math.round(angle / 10) * 10;
                this.label = Math.abs(angle) < 10 ? 0 : angle;
            }
        } else if (this.downSegment) {
            this.downSegment.hover = true;
        }
        this.currentX = x;
        this.currentY = y;
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
        if (this.upPoint) {
            if (this.downPoint === this.upPoint) {
                this.downPoints.forEach(p => p.select = !p.select);
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
                s.p1.z ||= 0.1;
                s.p2.z ||= 0.1;
                const t = Math.round((is2d ? ratio : (ratio * s.p1.z) / ((1 - ratio) * s.p2.z + ratio * s.p1.z)) * 100) / 100;
                this.command.command(`split s${i} ${t}`);
            }
        });
    }

    sendCmd(base, ...objs) {
        const suffix = this.currentCanvas === '2d' ? '2d' : '3d';
        const args = objs.map(o => typeof o === 'string' ? o : this.id(o));
        this.command.command(`${base}${suffix} ${args.join(' ')}`);
    }

    rotatePoints() {
        const s = this.model.segments.find(s => s.select);
        const pts = this.model.points.filter(p => p.select).map(p => this.id(p));
        this.command.command(`t 1000 r ${this.id(s)} ${this.label} ${pts.join(' ')}`);
    }

    event2d(event) {
        if (!(event instanceof Event)) return event;
        const rect = this.canvas2d.getBoundingClientRect();
        const x = (event.clientX - rect.left) * this.canvas2d.width / rect.width;
        const y = (event.clientY - rect.top) * this.canvas2d.height / rect.height;
        const context2d = this.canvas2d.getContext('2d');
        const transform = context2d.getTransform();
        const p = new DOMPoint(x, y);
        const q = transform.inverse().transformPoint(p);
        return {
            xf: q.x,
            yf: -q.y,
        };
    }

    search2d(xf, yf) {
        const points = this.model.points.filter(p => Math.hypot(p.xf - xf, p.yf - yf) < 10);
        const segments = this.model.segments.filter(s => Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < 4);
        const faces = this.model.faces.filter(f => Face.contains2d(f, xf, yf));
        return {points, segments, faces};
    }

    down2d(event) {
        this.currentCanvas = '2d';
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.down(points, segments, faces, xf, -yf);
    }

    move2d(event) {
        this.currentCanvas = '2d';
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.move(points, segments, faces, xf, -yf);
    }

    up2d(event) {
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.up(points, segments, faces);
    }

    eventCanvas3d(event) {
        if (!(event instanceof Event)) return event;
        const rect = this.overlay.getBoundingClientRect();
        return {
            xCanvas: event.clientX - rect.left,
            yCanvas: event.clientY - rect.top,
        };
    }

    search3d(xCanvas, yCanvas) {
        const points = this.model.points.filter(p => Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 10);
        const segments = this.model.segments.filter(s => {
            const p1 = s.p1, p2 = s.p2;
            return Math.abs(p1.xCanvas - xCanvas) + Math.abs(p1.yCanvas - yCanvas) < 10 ||
                   Math.abs(p2.xCanvas - xCanvas) + Math.abs(p2.yCanvas - yCanvas) < 10;
        });
        const faces = this.model.faces.filter(f => Face.contains3d(f, xCanvas, yCanvas, this.view3d));
        return {points, segments, faces};
    }

    down3d(event) {
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
    }

    move3d(event) {
        this.currentCanvas = '3d';
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.move(points, segments, faces, xCanvas, yCanvas);
    }

    up3d(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.up(points, segments, faces);
    }

    wheel(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        this.view3d.scale *= delta;
        this.view3d.initModelView();
        this.view3d.render();
    }

    out() {
        this.downPoints = [];
        this.downPoint = this.downSegment = this.downFace = undefined;
        this.upPoint = this.upSegment = this.upFace = undefined;
        this.currentCanvas = this.label = undefined;
        this.moving = false;
        this.rawX = this.rawY = undefined;
    }
}
