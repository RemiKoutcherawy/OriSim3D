export class View2d {

    constructor(model, canvas2d) {
        this.model = model;
        this.canvas2d = canvas2d;

        // Resize
        window.addEventListener('resize', () => {
            this.fit();
            this.drawModel();
        });
    }

    // Fit to show all the model in the view
    fit() {
        // Model
        const {xMin, yMin, xMax, yMax} = this.model.get2DBounds();
        const modelWidth = xMax - xMin;
        const modelHeight = yMax - yMin;
        // <div> containing Canvas
        const rect = this.canvas2d.getBoundingClientRect();
        const viewWidth = rect.width;
        const viewHeight = rect.height;
        // Resize canvas2d to fit inside <div>
        this.canvas2d.width = viewWidth - 2 * this.canvas2d.clientLeft;
        this.canvas2d.height = viewHeight - 2 * this.canvas2d.clientTop;
        // Compute scale to fit
        const scale = Math.min(viewWidth / modelWidth, viewHeight / modelHeight) / 1.2;
        // Compute offset to center drawing
        const xOffset = viewWidth / 2;
        const yOffset = viewHeight / 2;

        const context2d = this.canvas2d.getContext('2d');
        context2d.setTransform(scale, 0, 0, scale, xOffset, yOffset);
    }

    // Draw points
    drawPoints(points) {
        const context2d = this.canvas2d.getContext('2d');
        context2d.font = '18px serif';
        points.forEach(p => {
            const xc = p.xf;
            const yc = -p.yf;
            context2d.beginPath();
            context2d.arc(xc, yc, p.hover ? 12 : 8, 0, 2 * Math.PI);
            context2d.fillStyle = p.select === 1 ? 'red' : p.select === 2 ? 'orange' : p.hover ? 'blue' : 'skyblue';
            context2d.fill();

            // label
            context2d.fillStyle = p.hover ? 'white' : 'black';
            const label = String(this.model.points.indexOf(p));
            context2d.fillText(label, xc - 4 * label.length, yc + 5);
        });
    }

    // Draw segments
    drawSegments(segments) {
        const context2d = this.canvas2d.getContext('2d');
        context2d.font = '18px serif';
        context2d.lineWidth = 4;

        segments.forEach(s => {
            const [xf1, yf1, xf2, yf2] = [s.p1.xf, -s.p1.yf, s.p2.xf, -s.p2.yf];
            const [xc, yc] = [(xf1 + xf2) / 2, (yf1 + yf2) / 2];

            context2d.lineWidth = s.hover ? 6 : 3;
            context2d.beginPath();
            context2d.moveTo(xf1, yf1);
            context2d.lineTo(xf2, yf2);
            context2d.strokeStyle = s.select === 1 ? 'red' : s.select === 2 ? 'orange' : s.hover ? 'blue' : 'skyblue';
            context2d.stroke();
            // Add an arrow on p2
            const arrowLength = 20;
            const arrowAngle = Math.PI / 7;
            const angle = Math.atan2(yf2 - yf1, xf2 - xf1);
            const [arrowX1, arrowY1] = [xf2 - arrowLength * Math.cos(angle + arrowAngle), yf2 - arrowLength * Math.sin(angle + arrowAngle)];
            const [arrowX2, arrowY2] = [xf2 - arrowLength * Math.cos(angle - arrowAngle), yf2 - arrowLength * Math.sin(angle - arrowAngle)];
            context2d.beginPath();
            context2d.moveTo(xf2, yf2);
            context2d.lineTo(arrowX1, arrowY1);
            context2d.lineTo(arrowX2, arrowY2);
            context2d.closePath();
            context2d.fillStyle = s.select === 1 ? 'red' : s.select === 2 ? 'orange' : s.hover ? 'blue' : 'skyblue';
            context2d.fill();

            // Circle with color for selected, bigger for hovered
            context2d.beginPath();
            context2d.arc(xc, yc, s.hover ? 12 : 8, 0, 2 * Math.PI);
            context2d.fillStyle = s.select === 1 ? 'red' : s.select === 2 ? 'orange' : s.hover ? 'blue' : 'lightgreen';
            context2d.fill();

            // Label
            context2d.fillStyle = s.hover ? 'white' : 'black';
            const n = this.model.segments.indexOf(s);
            context2d.fillText(String(n), xc - (n < 10 ? 4 : 8), yc + 5);
        });
    }

    drawFaces(faces) {
        const context2d = this.canvas2d.getContext('2d');
        context2d.font = '18px serif';
        context2d.strokeStyle = 'black';

        faces.forEach(f => {
            const pts = f.points;
            let [cx, cy] = [0, 0];
            context2d.beginPath();
            context2d.moveTo(pts[0].xf, -pts[0].yf);
            pts.forEach(p => {
                context2d.lineTo(p.xf, -p.yf);
                cx += p.xf;
                cy += -p.yf;
            });
            context2d.closePath();
            context2d.fillStyle = f.hover ? 'lightcyan' : f.select ? 'pink' : 'lightblue';
            context2d.fill();

            cx /= pts.length;
            cy /= pts.length;
            context2d.beginPath();
            context2d.arc(cx, cy, 12, 0, 2 * Math.PI);
            context2d.fillStyle = 'lightcyan';
            context2d.fill();
            // Label
            context2d.fillStyle = 'black';
            const n = this.model.faces.indexOf(f);
            context2d.fillText(String(n), cx - (n < 10 ? 4 : 8), cy + 5);
        });
    }

    drawModel() {
        if (this.model.faces.length === 1) { this.fit();}
        const context2d = this.canvas2d.getContext('2d');
        context2d.save();
        context2d.setTransform(1, 0, 0, 1, 0, 0);
        context2d.fillStyle = '#CCE4FF';
        context2d.fillRect(0, 0, this.canvas2d.width, this.canvas2d.height);
        context2d.restore();

        this.drawFaces(this.model.faces);
        this.drawSegments(this.model.segments);
        this.drawPoints(this.model.points);
    }
}
// 145
