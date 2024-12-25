import {Segment} from './Segment.js';
import {Face} from './Face.js';

export class Helper {
    constructor(model, command, canvas2d, view3d, overlay) {
        this.model = model;
        this.command = command;
        this.canvas2d = canvas2d;
        this.view3d = view3d;
        this.overlay = overlay;
        this.touchtime = 0;
        // To test with Deno
        if (canvas2d) {
            // 3d
            overlay.addEventListener('mousedown', (event) => this.down3d(event));
            overlay.addEventListener('mousemove', (event) => this.move3d(event));
            overlay.addEventListener('mouseup', (event) => this.up3d(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('mouseout', (event) => this.out(event));
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
        this.firstX = undefined;
        this.firstY = undefined;
        this.currentX = undefined;
        this.currentY = undefined;
        this.firstPoint = undefined;
        this.firstSegment = undefined;
        this.firstFace = undefined;
        this.currentCanvas = undefined;
    }

    // Draw only if a point, segment, or face is selected
    draw() {
        const context = this.currentCanvas === '2d' ? this.canvas2d.getContext('2d') : this.overlay.getContext('2d');
        if (this.firstPoint || this.firstSegment || this.firstFace) {
            context.lineWidth = 4;
            context.lineCap = 'round';
            context.strokeStyle = 'green';
            context.beginPath();
            context.moveTo(this.firstX, this.firstY);
            context.lineTo(this.currentX, this.currentY);
            context.stroke();
        }
    }

    // Logic begins here
    down(points, segments, faces, x, y) {
        if (points.length !== 0) {
            this.firstPoint = points[0];
        } else if (segments.length !== 0) {
            this.firstSegment = segments[0];
        } else if (faces.length !== 0) {
            this.firstFace = faces[0];
        } else {
            this.firstX = undefined;
            this.firstY = undefined;
        }
        this.firstX = this.currentX = x;
        this.firstY = this.currentY = y;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        if (this.firstPoint) {
            this.firstPoint.hover = true;
        } else if (this.firstSegment) {
            this.firstSegment.hover = true;
        } else if (this.firstFace) {
            if ((x - this.currentX) > 0) {
                // Offset face positive if mouse moves right
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset += 1);
            } else if ((x - this.currentX) < 0) {
                // Offset face negative if mouse moves left
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset -= 1);
            }
        }
        this.currentX = x;
        this.currentY = y;
    }

    up(points, segments, faces) {
        // From  point
        if (this.firstPoint) {
            // To Point
            if (points.length !== 0) {
                if (this.firstPoint === points[0]) {
                    // To same point
                    this.model.click2d3d(points, segments, faces);
                }
                // To other point
                else if (points.length > 0) {
                    const aIndex = this.model.indexOf(this.firstPoint);
                    const bIndex = this.model.indexOf(points[0]);
                    // Two points on existing segment
                    if (this.model.getSegment(this.firstPoint, points[0])) {
                        if (this.currentCanvas === '2d') {
                            this.command.command(`across2d ${aIndex} ${bIndex}`);
                        } else {
                            this.command.command(`across3d ${aIndex} ${bIndex}`);
                        }
                    }
                    // Two points but not on segment
                    else {
                        if (this.currentCanvas === '2d') {
                            this.command.command(`by2d ${aIndex} ${bIndex}`);
                        } else {
                            this.command.command(`by3d ${aIndex} ${bIndex}`);
                        }
                    }
                }
            }
            // To segment
            else if (segments.length !== 0) {
                // Crease perpendicular from segment to point
                const aIndex = this.model.indexOf(segments[0]);
                const bIndex = this.model.indexOf(this.firstPoint);
                if (this.currentCanvas === '2d') {
                    this.command.command(`perpendicular2d ${aIndex} ${bIndex}`);
                } else {
                    this.command.command(`perpendicular3d ${aIndex} ${bIndex}`);
                }
            }
        }
        // From segment
        else if (this.firstSegment) {
            // To segment
            if (segments.length !== 0) {
                // To same segment select
                this.model.click2d3d(points, segments, faces);
            }
            // To point crease perpendicular from segment to point
            else if (points.length !== 0) {
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(points[0]);
                if (this.currentCanvas === '2d') {
                    this.command.command(`perpendicular2d ${aIndex} ${bIndex}`);
                } else {
                    this.command.command(`perpendicular3d ${aIndex} ${bIndex}`);
                }            }
            // To another segment crease bisector
            else if (segments.length !== 0) {
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(segments[0]);
                if (this.currentCanvas === '2d') {
                    this.command.command(`bisector2d ${aIndex} ${bIndex}`);
                } else {
                    this.command.command(`bisector3d ${aIndex} ${bIndex}`);
                }
            }
        }
        // From face
        else if (this.firstFace) {
            // To face
            if (faces.length !== 0) {
                if (this.firstFace === faces[0]) {
                    // To same face
                    this.model.click2d3d(points, segments, faces);
                } else {
                    // To other face
                }
            } else {
                // Deselect
                this.model.points.forEach(p => p.select = 0);
                this.model.segments.forEach(s => s.select = 0);
                this.model.faces.forEach(f => f.select = 0);
            }
        }
        // From Nothing to Nothing
        else {
            // Deselect
            this.model.points.forEach(p => p.select = 0);
            this.model.segments.forEach(s => s.select = 0);
            this.model.faces.forEach(f => f.select = 0);

            //  Handle swipe
            // console.log('delta X',(this.firstX - this.currentX));
            // console.log('delta time',(new Date().getTime()) - this.touchtime);
            if (((new Date().getTime()) - this.touchtime) < 6000) {
                if ((this.firstX - this.currentX) < 100) {
                    // Handle undo if swipe right
                    this.command.command('undo');
                }
                else if ((this.firstX - this.currentX) > 100){
                    // Handle turn if swipe left
                    this.command.command('tx');
                }
            } else {
                this.touchtime = new Date().getTime();
            }
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
        const points = this.model.points.filter(p => {
            return Math.hypot(p.xf - xf, p.yf - yf) < 10;
        });
        // Segments near xf, yf
        const segments = this.model.segments.filter(s => {
            return Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < 4;
        });
        // Face containing xf, yf
        const faces = this.model.faces.filter(f => {
            return Face.contains2d(f, xf, yf);
        });
        return {points, segments, faces};
    }
    // Down on flat 2d
    down2d(event) {
        this.currentCanvas = "2d";
        const {xf, yf} = this.event2d(event);
        const {points, segments, faces} = this.search2d(xf, yf);
        this.down(points, segments, faces, xf, -yf); // Note inverse y coordinate
    }
    // Hove on flat 2d
    move2d(event) {
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
    search3d(xCanvas, yCanvas) {
        // Points near xf, yf
        const points = this.model.points.filter(p => Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas) < 10);
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
    // Mouse down on 3d ovelay
    down3d(event) {
        this.currentCanvas = "3d";
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.down(points, segments, faces, xCanvas, yCanvas);
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
    }
    // Mouse move on 3d ovelay
    move3d(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        // handle 3d rotation
        if (points.length === 0 && segments.length === 0 && faces.length === 0
            && event.buttons === 1) {
            // Rotation
            const factor = 600 / event.target.height;
            const dx = factor * (xCanvas - this.currentX);
            const dy = factor * (yCanvas - this.currentY);
            this.view3d.angleX += dy;
            this.view3d.angleY += dx;
            this.view3d.initBuffers();
            this.view3d.initModelView();
            this.view3d.render();
        }
        this.move(points, segments, faces, xCanvas, yCanvas);
    }
    // Mouse up on 3d ovelay
    up3d(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.up(points, segments, faces, "3d");
        this.currentCanvas = undefined;
    }
    // Mouse wheel on 3d overlay
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

}
