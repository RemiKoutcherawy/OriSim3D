export class Helper {
    constructor(model, command) {
        this.model = model;
        this.command = command;
        this.out();
    }

    // Réinitialise les propriétés
    out() {
        this.firstX = undefined;
        this.firstY = undefined;
        this.currentX = undefined;
        this.currentY = undefined;
        this.firstPoint = undefined;
        this.firstSegment = undefined;
        this.firstFace = undefined;
    }

    // Dessine si un point, un segment ou une face est sélectionné
    draw(context) {
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

    // Logic begin here
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
            /* */
        } else if (this.firstSegment) {
            /* */
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
                } else if (points.length > 0) {
                    // To other point
                    const aIndex = this.model.indexOf(this.firstPoint);
                    const bIndex = this.model.indexOf(points[0]);
                    if (this.model.getSegment(this.firstPoint, points[0])) {
                        this.command.command(`cross2d ${aIndex} ${bIndex}`).anim();
                    } else {
                        this.command.command(`by2d ${aIndex} ${bIndex}`);
                    }
                }
            }
            // To segment
            if (segments.length !== 0) {
                this.command.command(`by2d ${this.model.indexOf(this.firstPoint)} ${this.model.indexOf(segments[0].p1)}`);
            }
        }
        // From segment
        else if (this.firstSegment) {
            // To segment
            if (segments.length !== 0) {
                if (this.firstSegment === segments[0]) {
                    // To same segment
                    this.model.click2d3d(points, segments, faces);
                } else {
                    // To other segment
                    this.command.command(`cross2d ${this.model.indexOf(this.firstSegment.p1)} ${this.model.indexOf(segments[0].p1)}`);
                }
            }
            // To point
            if (points.length !== 0) {
                this.command.command(`by2d ${this.model.indexOf(this.firstSegment.p1)} ${this.model.indexOf(points[0])}`);
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
                    this.command.command(`cross2d ${this.model.indexOf(this.firstFace.p1)} ${this.model.indexOf(faces[0].p1)}`);
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
        }
        this.out();
    }
}
