// View3dSoft
// Converted from WebGL to Software Rendering with ImageData API
// Using putPixel(x, y, color, z) for rendering with depth testing

export class View3d {
    vertices = [];
    lines = [];
    triangles = [];
    lightDir = View3d.normalize([0, 0, -1]);
    ambient = 0.2;
    depthBuffer = null;
    context2d = null;
    // Current rotation angle (x-axis, y-axis degrees)
    angleX = 0.0;
    angleY = 0.0;
    scale = 1.0;

    constructor(model, canvas3d) {
        this.model = model;
        this.canvas3d = canvas3d;
        this.context2d = canvas3d.getContext('2d');
        this.width = canvas3d.width = canvas3d.clientWidth;
        this.height = canvas3d.height = canvas3d.clientHeight;
        this.imgData = this.context2d.createImageData(this.width, this.height);
        this.createDepthBuffer();
        this.initBuffers();
        this.render();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.width = this.canvas3d.width = window.innerWidth;
            this.height = this.canvas3d.height = window.innerHeight;
            this.imgData = this.context2d.createImageData(this.width, this.height);
            this.createDepthBuffer();
            this.render();
        });
    }

    createDepthBuffer() {
        const {width, height} = this;
        // Array is [][]
        this.depthBuffer = Array.from({length: height}, () => Array(width).fill(Infinity));
    }

    // Pixel drawing with depth testing
    putPixel(x, y, color, z) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        if (z < this.depthBuffer[y][x]) {
            const i = (y * this.width + x) * 4;
            const data = this.imgData.data;
            data[i] = color[0];
            data[i + 1] = color[1];
            data[i + 2] = color[2];
            data[i + 3] = 255;
            this.depthBuffer[y][x] = z;
        }
    }


    // Initialize geometry buffers
    initBuffers() {
        // Pre-allocate arrays for better memory management
        const faces = this.model.faces;
        let triangleCount = 0;
        for (let f of faces) {
            triangleCount += Math.max(0, f.points.length - 2);
        }
        this.vertices = new Array(triangleCount * 3);
        this.triangles = new Array(triangleCount);
        const n = [0, 0, 0];
        let index = 0;
        this.indexMap = new Map(); // index in the vertex array for each point

        // Process each face
        for (let f of faces) {
            const pts = f.points;
            if (pts.length < 3) continue;
            View3d.calculateNormal(pts, n);
            const offset = f.offset || 0;
            // Center of fan
            const p0 = pts[0];
            const v0x = p0.x + offset * n[0];
            const v0y = p0.y + offset * n[1];
            const v0z = p0.z + offset * n[2];
            this.indexMap.set(p0, index*3);

            // Create triangles using triangle fan
            for (let i = 1; i < pts.length - 1; i++) {
                // First vertex of triangle (center of fan)
                this.vertices[index*3] = [v0x, v0y, v0z, 1.0];
                // Second vertex
                const p1 = pts[i];
                this.vertices[index*3 + 1] = [p1.x + offset * n[0], p1.y + offset * n[1], p1.z + offset * n[2], 1.0];
                // Third vertex
                const p2 = pts[i + 1];
                this.vertices[index*3 + 2] = [p2.x + offset * n[0], p2.y + offset * n[1], p2.z + offset * n[2], 1.0];
                // Add triangle
                this.triangles[index] = {v: [index*3, index*3 + 1, index*3 + 2]};
                // Keep track of the index for each point to draw lines
                if (!this.indexMap.has(p1)) this.indexMap.set(p1, index*3 + 1);
                if (!this.indexMap.has(p2)) this.indexMap.set(p2, index*3 + 2);
                index++;
            }
        }
        // Segments
        this.lines = new Array(this.model.segments.length * 2);
        for (let i = 0; i < this.model.segments.length; i++) {
            const s = this.model.segments[i];
            const idx1 = this.indexMap.get(s.p1);
            const idx2 = this.indexMap.get(s.p2);
            this.lines[i * 2] = idx1;
            this.lines[i * 2 + 1] = idx2;
        }
    }

    // Calculate face normal
    static calculateNormal(pts, result) {
        if (!result) result = [0, 0, 0];
        for (let i = 0; i < pts.length - 2; i++) {
            const p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
            const u1 = p2.x - p1.x, u2 = p2.y - p1.y, u3 = p2.z - p1.z;
            const v1 = p3.x - p1.x, v2 = p3.y - p1.y, v3 = p3.z - p1.z;
            result[0] = u2 * v3 - u3 * v2;
            result[1] = u3 * v1 - u1 * v3;
            result[2] = u1 * v2 - u2 * v1;
            const len = Math.abs(result[0]) + Math.abs(result[1]) + Math.abs(result[2]);
            if (len > 0.1) {
                const invLen = 1 / Math.sqrt(result[0] * result[0] + result[1] * result[1] + result[2] * result[2]);
                result[0] *= invLen;
                result[1] *= invLen;
                result[2] *= invLen;
                return result;
            }
        }
        result[0] = 0;
        result[1] = 0;
        result[2] = 1;
        return result;
    }

    // Calculate model-view-projection matrix and project vertices
    initModelView() {
        const aspect = this.width / this.height;
        const proj = View3d.perspectiveMat4(Math.PI/3, aspect, 0.1, 1000);
        const view = View3d.translateMat4(0, 0, -500);
        let model = View3d.multiplyMat4(
            View3d.rotateYMat4(this.angleY),
            View3d.rotateXMat4(this.angleX)
        );
        model = View3d.multiplyMat4(
            model,
            View3d.scaleMat4(this.scale, this.scale, this.scale)
        );
        let mvp = View3d.multiplyMat4(proj, view);
        mvp = View3d.multiplyMat4(mvp, model);
        this.invTransModel = View3d.inverseTransposeMat4(model);

        // Project vertices
        const vertices = this.vertices;
        const width = this.width;
        const height = this.height;
        const projected = new Array(vertices.length);
        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            const tv = View3d.transformVec4(mvp, v);
            const w = tv[3] || 1;
            const invW = 1 / w;
            projected[i] = [
                (tv[0] * invW + 1) * width * 0.5,  // x
                (1 - tv[1] * invW) * height * 0.5, // y
                tv[2] * invW,                      // z
                w                                  // w
            ];
        }
        this.projected = projected;
    }

    // Render
    render() {
        if (this.projected === undefined) return;
        const data = this.imgData.data;
        const len = data.length;
        for (let i = 0; i < len; i += 4) {
            data[i] = 204;     // R
            data[i + 1] = 228; // G
            data[i + 2] = 255; // B
            data[i + 3] = 255; // A
        }
        const width = this.width;
        const height = this.height;
        const depthBuffer = this.depthBuffer;
        for (let i = 0; i < height; i++) {
            const row = depthBuffer[i];
            for (let j = 0; j < width; j++) {
                row[j] = Infinity;
            }
        }
        // 3D rendering
        this.renderTriangles();
        this.renderLines();
        // Overlay
        this.drawFaces();
        this.drawSegments();
        this.drawPoints();

        this.context2d.putImageData(this.imgData, 0, 0);
    }

    // Helper function to fill a triangle with solid color and lighting
    fillTriangle(p0, p1, p2, z0, z1, z2, isFront, factor) {
        // Calculate bounding box of the triangle (with clipping)
        const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
        const maxX = Math.min(this.width-1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
        const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
        const maxY = Math.min(this.height-1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));

        // Precompute barycentric coordinate constants
        const p1y_p2y = p1[1] - p2[1];
        const p2x_p1x = p2[0] - p1[0];
        const p2y_p0y = p2[1] - p0[1];
        const p0x_p2x = p0[0] - p2[0];

        const denom1 = p1y_p2y * (p0[0] - p2[0]) + p2x_p1x * (p0[1] - p2[1]);
        const denom2 = p2y_p0y * (p1[0] - p2[0]) + p0x_p2x * (p1[1] - p2[1]);

        // Prepare color values (blue for front, yellow for back)
        let r, g, b;
        if (isFront) {
            r = 0;
            g = 0;
            b = Math.min(255, Math.floor(255 * factor));
        } else {
            r = Math.min(255, Math.floor(255 * factor));
            g = Math.min(255, Math.floor(255 * factor));
            b = 0;
        }

        const color = [r, g, b];

        // Scan the bounding box of the triangle
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const b0 = (p1y_p2y * (x - p2[0]) + p2x_p1x * (y - p2[1])) / denom1;
                if (b0 < 0) continue;
                const b1 = (p2y_p0y * (x - p2[0]) + p0x_p2x * (y - p2[1])) / denom2;
                if (b1 < 0) continue;
                const b2 = 1 - b0 - b1;
                if (b2 < 0) continue;
                const z = b0 * z0 + b1 * z1 + b2 * z2;
                this.putPixel(x, y, color, z);
            }
        }
    }

    // Render triangles using software rendering
    renderTriangles() {
        // Cache frequently accessed properties
        const vertices = this.vertices;
        const projected = this.projected;
        const triangles = this.triangles;
        const ambient = this.ambient;
        const lightDir = this.lightDir;
        const invTransModel = this.invTransModel;

        // Temporary vectors for calculations (reused to avoid garbage collection)
        const e1 = [0, 0, 0];
        const e2 = [0, 0, 0];
        const normal = [0, 0, 0];
        const lightNormal = [0, 0, 0];
        const cameraDir = [0, 0, -1]; // Camera looks along -Z

        // Process all triangles
        for (let i = 0; i < triangles.length; i++) {
            const t = triangles[i];
            const v0 = vertices[t.v[0]];
            const v1 = vertices[t.v[1]];
            const v2 = vertices[t.v[2]];
            e1[0] = v1[0] - v0[0]; e1[1] = v1[1] - v0[1]; e1[2] = v1[2] - v0[2];
            e2[0] = v2[0] - v0[0]; e2[1] = v2[1] - v0[1]; e2[2] = v2[2] - v0[2];
            View3d.cross(e1, e2, normal);
            View3d.normalize(normal, normal);
            View3d.transformNormal(invTransModel, normal, normal);
            const isFront = View3d.dot(normal, cameraDir) > 0;
            if (isFront) { lightNormal[0] = normal[0]; lightNormal[1] = normal[1]; lightNormal[2] = normal[2];}
            else { lightNormal[0] = -normal[0]; lightNormal[1] = -normal[1]; lightNormal[2] = -normal[2]; }
            const factor = Math.max(0, View3d.dot(lightNormal, lightDir)) * (1 - ambient) + ambient;
            const p0 = projected[t.v[0]];
            const p1 = projected[t.v[1]];
            const p2 = projected[t.v[2]];
            this.fillTriangle(p0, p1, p2, p0[2], p1[2], p2[2], isFront, factor);
        }
    }

    // Render lines using software rendering
    renderLines() {
        for (let i = 0; i < this.lines.length; i += 2) {
            const idx1 = this.lines[i];
            const idx2 = this.lines[i + 1];
            const v1 = this.projected[idx1];
            const v2 = this.projected[idx2];
            this.drawLine(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
        }
    }

    // Draw a line using Bresenham's algorithm
    drawLine(x1, y1, z1, x2, y2, z2, lineColor = [0, 0, 0]) {
        x1 = Math.round(x1);
        x2 = Math.round(x2);
        y1 = Math.round(y1);
        y2 = Math.round(y2);
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        let x = x1;
        let y = y1;
        let z = z1 +1;
        const totalSteps = Math.max(dx, dy);
        const zStep = totalSteps > 0 ? (z2 - z1) / totalSteps : 0;
        this.putPixel(Math.round(x), Math.round(y), lineColor, z);
        while ((sx > 0 && x < x2) || (sx < 0 && x > x2) ||
               (sy > 0 && y < y2) || (sy < 0 && y > y2)) {
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
            z += zStep;
            this.putPixel(Math.round(x), Math.round(y), lineColor, z);
        }
        this.putPixel(Math.round(x2), Math.round(y2), lineColor, z2);
    }
    //void DrawFilledCircle(int x0, int y0, int radius)
    // {
    //     int x = radius;
    //     int y = 0;
    //     int xChange = 1 - (radius << 1);
    //     int yChange = 0;
    //     int radiusError = 0;
    //
    //     while (x >= y)
    //     {
    //         for (int i = x0 - x; i <= x0 + x; i++)
    //         {
    //             SetPixel(i, y0 + y);
    //             SetPixel(i, y0 - y);
    //         }
    //         for (int i = x0 - y; i <= x0 + y; i++)
    //         {
    //             SetPixel(i, y0 + x);
    //             SetPixel(i, y0 - x);
    //         }
    //
    //         y++;
    //         radiusError += yChange;
    //         yChange += 2;
    //         if (((radiusError << 1) + xChange) > 0)
    //         {
    //             x--;
    //             radiusError += xChange;
    //             xChange += 2;
    //         }
    //     }
    // }

    // Draw circle using Bresenham's algorithm
    drawCircle(xc, yc, r, z, color) {
        let x = 0;
        let y = r;
        let d = 3 - 2 * r;

        const fillSpan = (x1, x2, y) => {
            for (let x = x1; x <= x2; x++) {
                this.putPixel(x, y, color, z);
            }
        };
        const plot = (x, y) => {
            fillSpan(xc - x, xc + x, yc + y);
            fillSpan(xc - x, xc + x, yc - y);
            fillSpan(xc - y, xc + y, yc + x);
            fillSpan(xc - y, xc + y, yc - x);
        };
        plot(x, y);
        while (y >= x) {
            x++;
            if (d > 0) {
                y--;
                d = d + 4 * (x - y) + 10;
            } else {
                d = d + 4 * x + 6;
            }
            plot(x, y);
        }
    }
    // Draw Points. Called from render()
    drawPoints() {
        for (let p of this.model.points) {
            const idx = this.indexMap.get(p);
            const proj = this.projected[idx];
            if (!proj) continue;
            const radius = p.hover ? 10 : 6;
            const color = p.select === 1 ? [255, 0, 0] : // red
                p.select === 2 ? [255, 165, 0] : // orange
                    p.hover ? [0, 0, 255] : // blue
                        [135, 206, 235]; // skyblue
            this.drawCircle(Math.round(proj[0]), Math.round(proj[1]), radius, proj[2], color);
        }
    }

    // Draw hovered segments
    drawSegments() {
        for (let i = 0; i < this.model.segments.length; i++) {
            const s = this.model.segments[i];
            const width = s.hover ? 6 : 3;
            const color = s.select === 1 ? [255, 0, 0] : s.select === 2 ? [255, 165, 0] : s.hover ? [0, 0, 255] : [135, 206, 235];
            for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
                const p1 = this.projected[this.indexMap.get(s.p1)];
                const p2 = this.projected[this.indexMap.get(s.p2)];
                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len === 0) continue;
                const offsetX = -w * dy / len;
                const offsetY = w * dx / len;
                const x1 = Math.round(p1[0] + offsetX);
                const y1 = Math.round(p1[1] + offsetY);
                const x2 = Math.round(p2[0] + offsetX);
                const y2 = Math.round(p2[1] + offsetY);
                const z1 = p1[2];
                const z2 = p2[2];
                this.drawLine(x1, y1, z1, x2, y2, z2, color);
            }
        }
    }

    // Draw hovered faces
    drawFaces() {
        for (let f of this.model.faces) {
            if (f.hover) {
                const pts = f.points;
                const len = pts.length;
                const projectedPts = pts.map(p => {
                    const idx = this.indexMap.get(p);
                    return this.projected[idx];
                });
                let minY = Infinity;
                let maxY = -Infinity;
                for (const p of projectedPts) {
                    minY = Math.min(minY, Math.floor(p[1]));
                    maxY = Math.max(maxY, Math.ceil(p[1]));
                }
                minY = Math.max(0, minY);
                maxY = Math.min(this.height - 1, maxY);
                for (let y = minY; y <= maxY; y++) {
                    let intersections = [];
                    for (let i = 0; i < len; i++) {
                        const p1 = projectedPts[i];
                        const p2 = projectedPts[(i + 1) % len];
                        if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
                            const x = p1[0] + (y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]);
                            const z = p1[2] + (y - p1[1]) * (p2[2] - p1[2]) / (p2[1] - p1[1]);
                            intersections.push({x, z});
                        }
                    }
                    intersections.sort((a, b) => a.x - b.x);
                    for (let i = 0; i < intersections.length; i += 2) {
                        const x1 = Math.max(0, Math.floor(intersections[i].x));
                        const x2 = Math.min(this.width - 1, Math.ceil(intersections[i + 1].x));
                        const z1 = intersections[i].z;
                        const z2 = intersections[i + 1].z;
                        for (let x = x1; x <= x2; x++) {
                            const t = (x - x1) / (x2 - x1);
                            const z = z1 + t * (z2 - z1) +1;
                            this.putPixel(x, y, [255, 192, 203], z); // Pink color
                        }
                    }
                }
            }
        }
    }

    /**
     * Draw labels for Points, Segments, Faces
     * each label takes a slot on the screen
     */
    labels = [];

    drawLabels(context2d) {
        this.labels = [];
        // Points
        for (let p of this.model.points) {
            const txt = String(this.model.points.indexOf(p));
            const oneLabel = new Label(p.xCanvas, p.yCanvas);
            this.labels.push(oneLabel);
            this.labels.forEach(label => {
                if (label !== oneLabel && label.over(oneLabel)) {
                    oneLabel.moveLabel();
                }
            });
            // Line
            context2d.strokeStyle = 'black';
            context2d.beginPath();
            context2d.moveTo(p.xCanvas, p.yCanvas);
            context2d.lineTo(oneLabel.getX(), oneLabel.getY());
            context2d.lineWidth = 1;
            context2d.stroke();
            // Circle
            const radius = 12;
            context2d.fillStyle = p.select === 1 ? 'red' : p.select === 2 ? 'orange' : 'skyblue';
            context2d.beginPath();
            context2d.arc(oneLabel.getX(), oneLabel.getY(), radius, 0, 2 * Math.PI);
            context2d.stroke();
            context2d.fill();
            // Text
            context2d.fillStyle = 'black';
            context2d.font = '20px serif';
            context2d.fillText(txt, oneLabel.getX() - 4 * (txt.length), oneLabel.getY() + 5);
        }
    }

    static createMat4() {return [[1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]];}
    static multiplyMat4(a, b) {
        const r = View3d.createMat4();
        for (let i = 0; i < 4; i++)
            for (let j = 0; j < 4; j++)
                r[i][j] = a[i][0]*b[0][j] + a[i][1]*b[1][j] + a[i][2]*b[2][j] + a[i][3]*b[3][j];
        return r;
    }
    static transformVec4(mat, vec) {
        const r = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++)
            r[i] = mat[i][0]*vec[0] + mat[i][1]*vec[1] + mat[i][2]*vec[2] + mat[i][3]*(vec[3] || 1);
        return r;
    }
    static perspectiveMat4(fov, aspect, near, far) {
        const f = 1/Math.tan(fov/2), nf = 1/(near-far);
        return [[f/aspect,0,0,0], [0,f,0,0], [0,0,(far+near)*nf,2*far*near*nf], [0,0,-1,0]];
    }
    static translateMat4(tx, ty, tz) {
        return [[1,0,0,tx], [0,1,0,ty], [0,0,1,tz], [0,0,0,1]];
    }
    static rotateYMat4(angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return [[c,0,s,0], [0,1,0,0], [-s,0,c,0], [0,0,0,1]];
    }
    static rotateXMat4(angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return [[1,0,0,0], [0,c,-s,0], [0,s,c,0], [0,0,0,1]];
    }
    static scaleMat4(sx, sy, sz) {
        return [[sx,0,0,0], [0,sy,0,0], [0,0,sz,0], [0,0,0,1]];
    }
    static frustumMat4(left, right, bottom, top, near, far) {
        const rl = 1 / (right - left);
        const tb = 1 / (top - bottom);
        const nf = 1 / (near - far);
        const result = View3d.createMat4();
        result[0][0] = near * 2 * rl;
        result[1][1] = near * 2 * tb;
        result[2][0] = (right + left) * rl;
        result[2][1] = (top + bottom) * tb;
        result[2][2] = (far + near) * nf;
        result[2][3] = -1;
        result[3][2] = far * near * 2 * nf;
        result[3][3] = 0;
        return result;
    }
    // Cross product: v1 × v2, optionally store in result
    static cross(v1, v2, result = null) {
        if (!result) result = [0, 0, 0];
        result[0] = v1[1]*v2[2] - v1[2]*v2[1];
        result[1] = v1[2]*v2[0] - v1[0]*v2[2];
        result[2] = v1[0]*v2[1] - v1[1]*v2[0];
        return result;
    }

    // Dot product: v1 · v2
    static dot(v1, v2) {
        return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    }

    // Normalize vector, optionally store in result
    static normalize(v, result = null) {
        if (!result) result = [0, 0, 0];
        const len = Math.sqrt(this.dot(v, v));
        if (len) {
            const invLen = 1 / len;
            result[0] = v[0] * invLen;
            result[1] = v[1] * invLen;
            result[2] = v[2] * invLen;
        } else if (v !== result) {
            // Copy input to result if not normalizing in-place
            result[0] = v[0];
            result[1] = v[1];
            result[2] = v[2];
        }
        return result;
    }

    // Transform normal by matrix, optionally store in result
    static transformNormal(mat, normal, result = null) {
        if (!result) result = [0, 0, 0];
        result[0] = mat[0][0]*normal[0] + mat[0][1]*normal[1] + mat[0][2]*normal[2];
        result[1] = mat[1][0]*normal[0] + mat[1][1]*normal[1] + mat[1][2]*normal[2];
        result[2] = mat[2][0]*normal[0] + mat[2][1]*normal[1] + mat[2][2]*normal[2];
        return this.normalize(result, result);
    }
    static inverseTransposeMat4(mat) {
        const r = View3d.createMat4();
        const c = mat[0][0], s = mat[2][0]; // For rotation Y matrix
        r[0][0] = c; r[0][2] = -s;
        r[1][1] = 1;
        r[2][0] = s; r[2][2] = c;
        return r;
    }
}

class Label {
    static size = 20;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.n = 0;
    }

    getX() {
        return Math.floor(this.x + Label.size * 2 * Math.cos((this.n - 1) * Math.PI / 4));
    }

    getY() {
        return Math.floor(this.y + Label.size * 2 * Math.sin((this.n - 1) * Math.PI / 4));
    }

    moveLabel() {
        this.n++;
        return this.n > 8;
    }

    over(other) {
        const dx = this.getX() - other.getX();
        const dy = this.getY() - other.getY();
        return !(Math.abs(dy) > 20 || Math.abs(dx) > 20);

    }
}
// 646 lines
