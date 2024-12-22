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

    // Event position to model position
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

    // Points near xf, yf
    searchPoints2d(xf, yf) {
        return this.model.points.filter(p =>
            Math.hypot(p.xf - xf, p.yf - yf) < 10
        );
    }

    // Segments near xf, yf
    searchSegments2d(xf, yf) {
        return this.model.segments.filter(s => {
            const d = Segment.distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf);
            return d < 6;
        });
    }

    // Face containing xf, yf
    searchFaces2d(xf, yf) {
        return this.model.faces.filter(f => Face.contains2d(f, xf, yf));
    }

    // Points
    searchElements2d(xf, yf) {
        const points = this.searchPoints2d(xf, yf);
        const segments = this.searchSegments2d(xf, yf);
        const faces = this.searchFaces2d(xf, yf);
        return { points, segments, faces };
    }

    // Update 2d hoveredPoints, hoveredSegments, hoveredFaces
    hover2d(xf, yf) {
        const { points, segments, faces } = this.searchElements2d(xf, yf);
        this.model.hover2d3d(points, segments, faces);
    }

    // Select
    click2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);
        const { points, segments, faces } = this.searchElements2d(xf, yf);
        this.model.click2d3d(points, segments, faces);
    }

    // Drag
    down2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);
        const { points, segments, faces } = this.searchElements2d(xf, yf);
        this.firstX = xf;
        this.firstY = -yf;

        if (points.length !== 0) {
            this.firstPoint = points[0];
        } else if (segments.length !== 0) {
            this.firstSegment = segments[0];
        }  else if (faces.length !== 0) {
            this.firstFace = faces[0];
        } else {
            this.firstX = undefined;
            this.firstY = undefined;
        }
    }

    // Hover and drag
    move2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);

        // Hover highlights points and segments
        const { points, segments, faces } = this.searchElements2d(xf, yf);
        this.model.hover2d3d(points, segments, faces);

        if (this.firstPoint) {
            /* */
        } else if (this.firstSegment) {
            /* */
        } else if (this.firstFace) {
            if ((xf - this.currentX) > 0) {
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset += 1);
            } else if ((xf - this.currentX) < 0) {
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset -= 1);
            }
        }
        this.currentX = xf;
        this.currentY = -yf;
    }

    up2d(event) {
        const {xf, yf} = this.eventToModelPosition(event);
        const { points, segments, faces } = this.searchElements2d(xf, yf);

        // From  point
        if (this.firstPoint) {
            // To Point
            if (points.length !== 0) {
                if (this.firstPoint === points[0]) {
                    // To same point
                    this.click2d(event)
                } else if (points.length > 0) {
                    // To other point
                    const aIndex = this.model.indexOf(this.firstPoint);
                    const bIndex = this.model.indexOf(points[0]);
                    if (this.model.getSegment(this.firstPoint, points[0])) {
                        this.command.command(`cross2d ${aIndex} ${bIndex}`);
                    } else {
                        this.command.command(`by2d ${aIndex} ${bIndex}`);
                    }
                }
            }
            // To segment
            else if (segments.length !== 0) {
                // Perpendicular
                const aIndex = this.model.indexOf(segments[0]);
                const bIndex = this.model.indexOf(this.firstPoint);
                this.command.command(`perpendicular ${aIndex} ${bIndex}`);
            }
        }
        // From segment
        else if (this.firstSegment) {
            if (this.firstSegment === segments[0]) {
                // To same segment
                this.model.click2d3d(points, segments, faces);
            } else if (points.length !== 0) {
                // To a point : crease perpendicular
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(points[0]);
                this.command.command(`perpendicular ${aIndex} ${bIndex}`);
            } else if (segments.length !== 0) {
                // To another segment : crease bisector
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(segments[0]);
                this.command.command(`bisector2d ${aIndex} ${bIndex}`);
            }
        }
        // From face
        else if (this.firstFace) {
            // To same face
            if (this.firstFace === faces[0]){
                // Select Face
                this.firstFace.select += 1 % 3;
                // Offset face
                this.firstFace.offset += (yf > this.firstX) ? 10 : -10;
            }
        } else {
            // Deselect
            this.model.points.forEach(p => p.select = 0);
            this.model.segments.forEach(s => s.select = 0);
        }
        this.firstX = undefined;
        this.firstPoint = undefined;
        this.firstSegment = undefined;
        this.firstFace = undefined;
    }

    // Draw helper
    draw() {
        super.draw(this.canvas2d.getContext('2d'));
    }
}
