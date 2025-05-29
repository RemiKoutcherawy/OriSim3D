import {Segment} from './Segment.js';
import {Face} from './Face.js';

export class Helper {
    constructor(model, command, canvas2d, view3d, canvas3d) {
        this.model = model;
        this.command = command;
        this.canvas2d = canvas2d;
        this.view3d = view3d;
        this.overlay = canvas3d;
        this.touchTime = 0;
        this.label = undefined;
        // To test with Deno
        if (canvas2d) {
            // 3d
            canvas3d.addEventListener('mousedown', (event) => this.down3d(event));
            canvas3d.addEventListener('mousemove', (event) => this.move3d(event));
            canvas3d.addEventListener('mouseup', (event) => this.up3d(event));
            canvas3d.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            canvas3d.addEventListener('mouseout', (event) => this.out(event));
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
        this.label = undefined;
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
            this.firstPoint = undefined;
            this.firstSegment = undefined;
            this.firstFace = undefined;
        }
        this.touchTime = new Date().getTime();
        this.firstX = this.currentX = x;
        this.firstY = this.currentY = y;
    }

    move(points, segments, faces, x, y) {
        this.model.hover2d3d(points, segments, faces);
        if (this.firstPoint) {
            this.firstPoint.hover = true;
            // From Point with selected segment(s)
            const segments = this.model.segments.filter(s => s.select === 1);
            if (segments.length >= 1) {
                // The first selected segment
                const s = segments[0];
                // Deselect other segments
                segments.filter(sg => (sg.select === 1)).forEach(sg => {
                    if (sg !== s) {
                        sg.select = 0;
                    }
                });
                // The point we move from
                const p = this.firstPoint;
                // Select it
                p.select = 1;
                let distToFirst, distToCurrent;
                if (this.currentCanvas === '2d') {
                    // Signed distance from the first point to segment.
                    distToFirst = (p.xf - s.p1.xf) * (s.p2.yf - s.p1.yf) - (p.yf - s.p1.yf) * (s.p2.xf - s.p1.xf);
                    // Signed distance from current point to segment. Which is cos(angle) * distToFirst.
                    distToCurrent = (x - s.p1.xf) * (s.p2.yf - s.p1.yf) - (-y - s.p1.yf) * (s.p2.xf - s.p1.xf); // Note inverse y
                } else {
                    // Get projected coordinates for points
                    const pIdx = this.view3d.indexMap.get(p);
                    const p1Idx = this.view3d.indexMap.get(s.p1);
                    const p2Idx = this.view3d.indexMap.get(s.p2);

                    if (pIdx !== undefined && p1Idx !== undefined && p2Idx !== undefined) {
                        const pProj = this.view3d.projected[pIdx];
                        const p1Proj = this.view3d.projected[p1Idx];
                        const p2Proj = this.view3d.projected[p2Idx];

                        if (pProj && p1Proj && p2Proj) {
                            // Signed distance from the first point to segment.
                            distToFirst = (pProj[0] - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (pProj[1] - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
                            // Signed distance from current point to segment. Which to cos(angle) * distToFirst.
                            distToCurrent = (x - p1Proj[0]) * (p2Proj[1] - p1Proj[1]) - (y - p1Proj[1]) * (p2Proj[0] - p1Proj[0]);
                        }
                    }
                }
                // Clamp ratio = distToCurrent/distToFirst
                let ratio = Math.abs(distToCurrent / distToFirst);
                // Angle in degrees
                let angle = (ratio -1) * 180 * -Math.sign(distToFirst);
                // Round to step 10
                angle = Math.round(angle / 10) * 10;
                // Round to 0 for angles less than 10
                angle = Math.abs(Math.abs(angle) - 10) < 10 ? '00' : angle;
                this.label = angle;
            }
        }
        else if (this.firstSegment) {
            this.firstSegment.hover = true;
        } else if (this.firstFace) {
            // Offset face positive if the mouse moves right
            if ((x - this.currentX) > 0) {
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset += 1);
            }
            // Offset face negative if the mouse moves left
            else if ((x - this.currentX) < 0) {
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset -= 1);
            }
        }
        this.currentX = x;
        this.currentY = y;
    }

    up(points, segments, faces) {
        // From a point
        if (this.firstPoint) {
            // To Point
            if (points.length !== 0 && this.label === undefined) {
                if (this.firstPoint === points[0]) {
                    // To the same point select
                    points.forEach((p) => {
                        p.select = (p.select + 1) % 3;
                        // Adjust if double-select
                        if (p.select === 2) {
                            this.model.adjust(p);
                            this.view3d.initModelView();
                        }
                    });
                }
                // To another point
                else if (points.length > 0) {
                    const aIndex = this.model.indexOf(this.firstPoint);
                    const bIndex = this.model.indexOf(points[0]);
                    // Two points on an existing segment
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
            else if (segments.length !== 0 && this.label === undefined) {
                // Crease perpendicular from segment to point
                const aIndex = this.model.indexOf(segments[0]);
                const bIndex = this.model.indexOf(this.firstPoint);
                if (this.currentCanvas === '2d') {
                    this.command.command(`perpendicular2d ${aIndex} ${bIndex}`);
                } else {
                    this.command.command(`perpendicular3d ${aIndex} ${bIndex}`);
                }
            }
            // To face or nothing checks if rotating
            else if (this.label) {
                const segments = this.model.segments.filter(s => s.select === 1);
                const aIndex = this.model.indexOf(segments[0]);
                const selected = this.model.points.filter(s => s.select === 1);
                const bIndex = selected.map(p => this.model.points.indexOf(p));
                const adjust = this.model.points.filter(s => s.select === 2);
                const cIndex = adjust.map(p => this.model.points.indexOf(p));
                if (adjust.length === 0) {
                    this.command.command(`t 1000 rotate ${aIndex} ${this.label} ${bIndex.join(' ')};`);
                } else {
                    this.command.command(`t 1000 rotate ${aIndex} ${this.label} ${bIndex.join(' ')} a ${cIndex.join(' ')};`);
                }
            }
        }
        // From segment
        else if (this.firstSegment) {
            // To same segment select
            if (segments.length !== 0 && segments[0] === this.firstSegment) {
                segments.forEach((s) => s.select = (s.select + 1) % 3);
            }
            // To point crease perpendicular from segment to point
            else if (points.length !== 0) {
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(points[0]);
                if (this.currentCanvas === '2d') {
                    this.command.command(`perpendicular2d ${aIndex} ${bIndex}`);
                } else {
                    this.command.command(`perpendicular3d ${aIndex} ${bIndex}`);
                }
            }
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
                    // To the same face
                    this.model.click2d3d(points, segments, faces);
                } else {
                    // To another face
                }
            } else {
                // Deselect
                this.model.points.forEach(p => p.select = 0);
                this.model.segments.forEach(s => s.select = 0);
                this.model.faces.forEach(f => f.select = 0);
            }
        }
        // From Nothing to Nothing
        //  Handle swipe
        else if (((new Date().getTime()) - this.touchTime) < 1000 && this.currentCanvas === '2d') {
            if ((this.firstX - this.currentX) < -50) {
                // Undo if swipe right
                this.command.command('undo');
            } else if ((this.firstX - this.currentX) > 50) {
                // Turn if swipe left
                this.command.command('t 1000 ty -180;');
            } else if ((this.firstY - this.currentY) < -50) {
                // Handle turn if swipe up
                this.command.command('t 1000 tx 180;');
            } else if ((this.firstY - this.currentY) > 50) {
                // Handle turn if swipe down
                this.command.command('t 1000 tx -180;');
            }
        }
        // Deselect
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
        const faces = this.model.faces.filter(f =>  Face.contains2d(f, xf, yf));
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
        const points = [];
        for (const p of this.model.points) {
            const idx = this.view3d.indexMap.get(p);
            if (idx !== undefined) {
                const proj = this.view3d.projected[idx];
                if (proj && Math.abs(proj[0] - xCanvas) + Math.abs(proj[1] - yCanvas) < 10) {
                    points.push(p);
                }
            }
        }

        // Segments near xCanvas, yCanvas
        const segments = [];
        for (const s of this.model.segments) {
            const idx1 = this.view3d.indexMap.get(s.p1);
            const idx2 = this.view3d.indexMap.get(s.p2);
            if (idx1 !== undefined && idx2 !== undefined) {
                const proj1 = this.view3d.projected[idx1];
                const proj2 = this.view3d.projected[idx2];
                if (proj1 && proj2 && Segment.distance2d(proj1[0], proj1[1], proj2[0], proj2[1], xCanvas, yCanvas) < 6) {
                    segments.push(s);
                }
            }
        }

        // Face containing xCanvas, yCanvas
        const faces = this.model.faces.filter(f => Face.contains3d(f, xCanvas, yCanvas, this.view3d));
        return {points, segments, faces, xCanvas, yCanvas};
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
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        // Handle 3d rotation
        if (points.length === 0 && segments.length === 0 && faces.length === 0
            && event.buttons === 1 && this.firstPoint === undefined && this.firstSegment === undefined && this.firstFace === undefined) {
            // Rotation
            const factor = (600.0 / event.target.height) /100.0;
            const dx = factor * (xCanvas - this.currentX);
            const dy = factor * (yCanvas - this.currentY);
            this.view3d.angleX += dy;
            this.view3d.angleY += dx;
            this.view3d.initModelView();
        }
        this.move(points, segments, faces, xCanvas, yCanvas);
    }

    // Up on 3d overlay
    up3d(event) {
        const {xCanvas, yCanvas} = this.eventCanvas3d(event);
        const {points, segments, faces} = this.search3d(xCanvas, yCanvas);
        this.up(points, segments, faces);
        this.currentCanvas = undefined;
        if (points.length === 0 && segments.length === 0 && faces.length === 0) {
            this.doubleClick();
        }
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
        if (this.touchTime === 0) {
            this.touchTime = new Date().getTime();
        } else {
            // Double click?
            if (((new Date().getTime()) - this.touchTime) < 400) {
                this.command.command('fit');
                this.view3d.angleX = 0.0;
                this.view3d.angleY = 0.0;
                this.view3d.scale = 1.0;
            } else {
                this.touchTime = new Date().getTime();
            }
        }
    }

}
// 403
