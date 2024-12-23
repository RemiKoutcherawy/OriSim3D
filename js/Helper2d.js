import { Helper } from './Helper.js';
import { Segment } from './Segment.js';
import { Face } from './Face.js';

export class Helper2d extends Helper {
    constructor(canvas2d, model, command) {
        super(model, command);
        this.canvas2d = canvas2d;
        if (canvas2d) {
            canvas2d.addEventListener('mousedown', (event) => this.down2d(event));
            canvas2d.addEventListener('pointermove', (event) => this.move2d(event));
            canvas2d.addEventListener('mouseup', (event) => this.up2d(event));
            canvas2d.addEventListener('mouseout', () => this.out());
        }
    }

    // Event position to model flat position
    eventToModelPosition(event) {
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
        const points = this.model.points.filter(p => {
            return Math.hypot(p.xf - xf, p.yf - yf) < 10;
        });
        // Segments near xf, yf
        const segments = this.model.segments.filter(s => {
            return Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < 6;
        });
        // Face containing xf, yf
        const faces = this.model.faces.filter(f => {
            return Face.contains2d(f, xf, yf);
        });
        return {points, segments, faces};
    }

    // Down cache first element
    down2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        super.down(points, segments, faces, xf, -yf);
    }

    // Hove and drag
    move2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        super.move(points, segments, faces, xf, -yf);
    }

    // Up queue command
    up2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        super.up(points, segments, faces, xf, -yf);
    }

    // Draw helper with canvas 2d context
    draw() {
        super.draw(this.canvas2d.getContext('2d'));
    }
}

// 76 lines
