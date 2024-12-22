import {Segment} from './Segment.js';
import {Face} from './Face.js';
import {Helper} from './Helper.js';

export class Helper3d extends Helper {
    constructor(view3d, overlay, model, command) {
        super(model, command);
        this.view3d = view3d;
        this.overlay = overlay;
        this.model = model;
        this.command = command;
        if (overlay) {
            overlay.addEventListener('mousedown', (event) => this.down3d(event));
            overlay.addEventListener('mousemove', (event) => this.move3d(event));
            overlay.addEventListener('mouseup', (event) => this.up3d(event));
            overlay.addEventListener('wheel', (event) => this.wheel(event), {passive: true});
            overlay.addEventListener('mouseout', (event) => this.out(event));
        }
        this.firstX = undefined;
        this.firstY = undefined;
        this.currentX = undefined;
        this.currentY = undefined;
        this.firstPoint = undefined;
        this.firstSegment = undefined;
        this.firstFace = undefined;
    }

    // Event position to model position
    eventToModelPosition(event) {
        if (!(event instanceof Event)) return event; // Used for test
        const rect = event.target.getBoundingClientRect();
        return {
            xCanvas: event.clientX - rect.left,
            yCanvas: event.clientY - rect.top,
        };
    }

    // Méthode générique pour rechercher dans un tableau avec une condition
    searchCanvas(elements, condition) {
        let list = [];
        for (let i = 0; i < elements.length; i++) {
            if (condition(elements[i])) {
                list.push(elements[i]);
            }
        }
        return list;
    }

    searchPointsCanvas3d(xCanvas, yCanvas) {
        return this.searchCanvas(this.model.points, (p) => {
            let d = Math.abs(p.xCanvas - xCanvas) + Math.abs(p.yCanvas - yCanvas);
            return d < 10;
        });
    }

    searchSegmentsCanvas3d(xCanvas, yCanvas) {
        return this.searchCanvas(this.model.segments, (s) => {
            let d = Segment.distance2d(s.p1.xCanvas, s.p1.yCanvas, s.p2.xCanvas, s.p2.yCanvas, xCanvas, yCanvas);
            return d < 6;
        });
    }

    searchFacesCanvas3d(xCanvas, yCanvas) {
        return this.searchCanvas(this.model.faces, (f) => {
            return Face.contains3d(f, xCanvas, yCanvas);
        });
    }

    // Update 3d hoveredPoints, hoveredSegments, hoveredFaces todo test
    hover3d(xCanvas, yCanvas) {
        let points = this.searchPointsCanvas3d(xCanvas, yCanvas);
        let segments = this.searchSegmentsCanvas3d(xCanvas, yCanvas);
        let faces = this.searchFacesCanvas3d(xCanvas, yCanvas);
        this.model.hover2d3d(points, segments, faces);
    }

    // Click to select points and segments
    click3d(event) {
        const {xCanvas, yCanvas} = this.eventToModelPosition(event);
        let points = this.searchPointsCanvas3d(xCanvas, yCanvas);
        let segments = this.searchSegmentsCanvas3d(xCanvas, yCanvas);
        let faces = this.searchFacesCanvas3d(xCanvas, yCanvas);
        this.model.click2d3d(points, segments, faces);
    }

    // Utilitaire pour extraire la position et rechercher dans le canvas
    getPositionAndSearch(event) {
        const { xCanvas, yCanvas } = this.eventToModelPosition(event);
        const points = this.searchPointsCanvas3d(xCanvas, yCanvas);
        const segments = this.searchSegmentsCanvas3d(xCanvas, yCanvas);
        const faces = this.searchFacesCanvas3d(xCanvas, yCanvas);
        return { xCanvas, yCanvas, points, segments, faces };
    }

    // Mouse down 3d
    down3d(event) {
        const { xCanvas, yCanvas, points, segments, faces } = this.getPositionAndSearch(event);
        this.firstX = xCanvas;
        this.firstY = yCanvas;

        if (points.length !== 0) {
            this.firstPoint = points[0];
        } else if (segments.length !== 0) {
            this.firstSegment = segments[0];
        } else if (faces.length !== 0) {
            this.firstFace = faces[0];
        }
    }

    move3d(event) {
        const { xCanvas, yCanvas, points, segments, faces } = this.getPositionAndSearch(event);
        this.model.hover2d3d(points, segments, faces);

        if (this.firstPoint) {
            // Additional logic here if needed
        } else if (this.firstSegment) {
            // Additional logic here if needed
        } else if (this.firstFace) {
            if ((xCanvas - this.currentX) > 0) {
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset += 1);
            } else if ((xCanvas - this.currentX) < 0) {
                this.model.faces.filter(f => f.select === 1).forEach(f => f.offset -= 1);
            }
        } else if (event.buttons === 1) {
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
        this.currentX = xCanvas;
        this.currentY = yCanvas;
    }

    up3d(event) {
        const { xCanvas, yCanvas, points, segments, faces } = this.getPositionAndSearch(event);

        // From  point
        if (this.firstPoint) {
            // To Point
            if (points.length !== 0) {
                if (this.firstPoint === points[0]) {
                    // To same point
                    this.click3d(event)
                } else if (points.length > 0) {
                    // To other point
                    const aIndex = this.model.indexOf(this.firstPoint);
                    const bIndex = this.model.indexOf(points[0]);
                    if (this.model.getSegment(this.firstPoint, points[0])) {
                        this.command.command(`cross3d ${aIndex} ${bIndex}`);
                    } else {
                        this.command.command(`by3d ${aIndex} ${bIndex}`);
                    }
                }
            }
            else if (segments.length !== 0) {
                // To segment Perpendicular
                const aIndex = this.model.indexOf(segments[0]);
                const bIndex = this.model.indexOf(this.firstPoint);
                this.command.command(`perpendicular ${aIndex} ${bIndex}`);
            } else if(faces.length !== 0) {
                // To a face
                const selectedSegments = this.model.segments.filter (s => s.select === 1);
                const sIndex = this.model.indexOf(selectedSegments[0]);
                const pIndex = this.model.points.filter (p => p.select === 1).map(p => this.model.indexOf(p)).join(' ');
                const cde = `t 1000 rotate ${sIndex} 180 ${pIndex};`;
                this.command.command(cde);
            }
        }
        // From segment
        else if (this.firstSegment) {
            if (this.firstSegment === segments[0]) {
                // To same segment
                this.click3d(event)
            } else if (points.length !== 0) {
                // To a point : crease perpendicular
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(points[0]);
                this.command.command(`perpendicular ${aIndex} ${bIndex}`);
            } else if (segments.length !== 0) {
                // To another segment : crease bisector
                const aIndex = this.model.indexOf(this.firstSegment);
                const bIndex = this.model.indexOf(segments[0]);
                this.command.command(`bisector3d ${aIndex} ${bIndex}`);
            } else if(faces.length !== 0) {
                // To a face
                const selectedSegments = this.model.segments.filter (s => s.select === 1);
                const sIndex = this.model.indexOf(selectedSegments[0]);
                const pIndex = this.model.points.filter (p => p.select === 1).map(p => this.model.indexOf(p)).join(' ');
                const cde = `t 1000 rotate ${sIndex} 180 ${pIndex};`;
                this.command.command(cde);
            }
        }
        // From face
        else if (this.firstFace) {
            if (this.firstFace === faces[0]){
                // Offset face
                const fIndex = this.model.indexOf(faces[0]);
                const offset = (yCanvas > this.firstY) ? 10 : -10;
                const cde = `offset ${offset} ${fIndex};`;
                this.command.command(cde);
            }
        } else {
            // Deselect
            this.model.points.forEach(p => p.select = 0);
            this.model.segments.forEach(s => s.select = 0);
            // Handle an eventual doubleClick
            this.doubleClick(event);
        }
        this.firstX = undefined;
        this.firstPoint = undefined;
        this.firstSegment = undefined;
        this.firstFace = undefined;
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

    // Draw helper
    draw() {
        if (this.firstPoint || this.firstSegment || this.firstFace) {
            const context2d = this.overlay.getContext('2d');
            context2d.lineWidth = 4;
            context2d.lineCap = 'round';
            context2d.strokeStyle = 'green';
            context2d.beginPath();
            context2d.moveTo(this.firstX, this.firstY);
            context2d.lineTo(this.currentX, this.currentY);
            context2d.stroke();
        }
    }
}
