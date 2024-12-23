import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Helper} from './Helper.js';

export class Helper3d extends Helper {
    constructor(view3d, overlay, model, command) {
        super(model, command);
        this.view3d = view3d;
        this.overlay = overlay;
        if (overlay) {
            overlay.addEventListener('mousedown', (event) => this.down3d(event));
            overlay.addEventListener('mousemove', (event) => this.move3d(event));
            overlay.addEventListener('mouseup', (event) => this.up3d(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('mouseout', (event) => this.out(event));
        }
    }

    // Event position to model position
    eventToModelPosition(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = this.overlay.getBoundingClientRect();
        return {
            xCanvas: event.clientX - rect.left,
            yCanvas: event.clientY - rect.top,
        };
    }

    // Utilitaire pour extraire la position et rechercher dans le canvas
    search3d(xCanvas, yCanvas) {
        // Points near xf, yf
        const points = this.model.points.filter(p => Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 6);
        // Segments near xf, yf
        const segments = this.model.segments.filter(s => {
            return Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas) < 6;
        });
        // Face containing xf, yf
        const faces = this.model.faces.filter(f => {
            return Face.contains3d(f, xCanvas, yCanvas);
        });
        return {points, segments, faces, xCanvas, yCanvas};
    }

    // Mouse down3d 3d
    down3d(event) {
        const {xCanvas, yCanvas} = this.eventToModelPosition(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        super.down(points, segments, faces, xCanvas, yCanvas);
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
    }

    move3d(event) {
        const {xCanvas, yCanvas} = this.eventToModelPosition(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        super.move(points, segments, faces, xCanvas, yCanvas);
    }

    up3d(event) {
        const {xCanvas, yCanvas} = this.eventToModelPosition(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        super.up(points, segments, faces);
    }

    wheel(event) {
        if (event.deltaY) {
            this.view3d.scale = event.scale !== undefined ? event.scale : this.view3d.scale + event.deltaY / 300.0;
            this.view3d.scale = Math.max(this.view3d.scale, 0.0);
            this.view3d.initModelView();
        }
    }

    doubleClick() {
        if (this.touchtime === 0) {
            this.touchtime = new Date().getTime();
        } else {
            // Double click ?
            if (((new Date().getTime()) - this.touchtime) < 400) {
                this.command.command('fit');
                this.view3d.angleX = 0.0;
                this.view3d.angleY = 0.0;
                this.view3d.scale = 1.0;
            } else {
                this.touchtime = new Date().getTime();
            }
        }
    }

    // Draw helper with overlay context
    draw() {
        super.draw(this.overlay.getContext('2d'));
    }
}

// 88
