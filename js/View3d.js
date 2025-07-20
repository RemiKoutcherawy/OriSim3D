// View3dSoft
// Converted from WebGL to Software Rendering with ImageData API
// Using putPixel(x, y, color, z) for rendering with depth testing

export class View3d {
    vertices = [];
    lines = [];
    triangles = [];
    // Textures
    uvs = [];
    frontTexture;
    backTexture;
    texWidth;
    texHeight;
    texturesLoaded = 0;
    lightDir = View3d.normalize([0, 0, -1]);
    ambient = 0.2;
    // Buffer
    depthBuffer = null;
    context2d = null;
    width = 0;
    height = 0;
    // Current rotation angle (x-axis, y-axis degrees)
    angleX = 0.0;
    angleY = 0.0;
    scale = 1.0;
    translationX = 0;
    translationY = 0;

    constructor(model, canvas3d) {
        this.model = model;
        this.canvas3d = canvas3d;
        this.context2d = canvas3d.getContext('2d');
        this.width = canvas3d.width = canvas3d.clientWidth;
        this.height = canvas3d.height = canvas3d.clientHeight;
        this.imgData = this.context2d.createImageData(this.width, this.height);
        this.createDepthBuffer();
        this.initBuffers();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.width = this.canvas3d.width = canvas3d.clientWidth;
            this.height = this.canvas3d.height= canvas3d.clientHeight;
            this.imgData = this.context2d.createImageData(this.width, this.height);
            this.initModelView();
            this.createDepthBuffer();
            this.render();
        });
    }

    createDepthBuffer() {
        this.depthBuffer = new Array(this.width * this.height).fill(Infinity);
    }

    // Pixel drawing with depth testing
    putPixel(x, y, color, z) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const pos = y * this.width + x;
        const i = pos * 4;
        const data = this.imgData.data;
        if (z < this.depthBuffer[pos]) {
            data[i] = color[0];
            data[i + 1] = color[1];
            data[i + 2] = color[2];
            data[i + 3] = 255;
            this.depthBuffer[pos] = z;
        }
    }
    // Textures
    initTextures() {
        const textureLoad = (img, data) => {
            img.onload = () => {
                const texCanvas = document.createElement("canvas");
                texCanvas.width = this.texWidth = img.width;
                texCanvas.height = this.texHeight = img.height;
                const texCtx = texCanvas.getContext("2d");
                texCtx.scale(1, -1);
                texCtx.translate(0, -this.texHeight);
                texCtx.drawImage(img, 0, 0);
                data(texCtx.getImageData(0, 0, this.texWidth, this.texHeight).data);
                if (++this.texturesLoaded === 2) this.render();
            };
            img.onerror = () => {
                this.texturesLoaded = 2;
                this.render();
            };
        };
        if (this.model.textures) {
            const frontImg = new Image(), backImg = new Image();
            frontImg.src = 'textures/front.jpg';
            backImg.src = 'textures/back.jpg';
            textureLoad(frontImg, data => this.frontTexture = data);
            textureLoad(backImg, data => this.backTexture = data);
        } else {
            // Defaults
            this.frontTexture = new Uint8ClampedArray([0xA5, 0xC6, 0xFA, 255]);  // lightblue for front
            this.backTexture = new Uint8ClampedArray([0xFF, 0xF3, 0x6D, 255]);  // lemon yellow for back
            this.texWidth = 1;
            this.texHeight = 1;
        }
    }

    // Buffers
    initBuffers() {
        this.initTextures();
        const faces = this.model.faces;
        let triangleCount = 0;
        for (const f of faces) {
            triangleCount += Math.max(0, f.points.length - 2);
        }
        this.vertices = new Array(triangleCount * 3);
        this.triangles = new Array(triangleCount);
        this.uvs = [];
        this.indexMap = new WeakMap();
        let index = 0;

        // Process each face
        for (const f of faces) {
            const pts = f.points;
            if (pts.length < 3) continue;
            const offset = f.offset || 0;
            const n = faceNormal(pts);
            View3d.normalize(n, n);

            // Center of fan
            const p0 = pts[0];

            // Create triangles using triangle fan
            for (let i = 1; i < pts.length - 1; i++) {
                const p1 = pts[i];
                const p2 = pts[i + 1];

                // First point
                const v0x = p0.x + offset * n[0];
                const v0y = p0.y + offset * n[1];
                const v0z = p0.z + offset * n[2];
                this.vertices[index] = [v0x, v0y, v0z, 1.0];
                // Texture at first point of triangle
                const ft0u = (200 + pts[0].xf) / this.texWidth;
                const ft0v = (200 + pts[0].yf) / this.texHeight;
                this.uvs[index] = [ft0u, ft0v];
                this.indexMap.set(p0, index);

                // Second point of triangle
                const v1x = p1.x + offset * n[0];
                const v1y = p1.y + offset * n[1];
                const v1z = p1.z + offset * n[2];
                this.vertices[index + 1] = [v1x, v1y, v1z, 1.0];
                // Texture at second point of triangle
                const ft1u = (200 + pts[i].xf) / this.texWidth;
                const ft1v = (200 + pts[i].yf) / this.texHeight;
                this.uvs[index + 1] = [ft1u, ft1v];
                this.indexMap.set(p1, index + 1);

                // Third point of the triangle
                const v2x = p2.x + f.offset * n[0];
                const v2y = p2.y + f.offset * n[1];
                const v2z = p2.z + f.offset * n[2];
                this.vertices[index + 2] = [v2x, v2y, v2z, 1.0];
                // Texture at third point of triangle
                const ft2u = (200 + pts[i + 1].xf) / this.texWidth;
                const ft2v = (200 + pts[i + 1].yf) / this.texHeight;
                this.uvs[index + 2] = [ft2u, ft2v];
                this.indexMap.set(p2, index + 2);

                // Add triangle to the list
                const triangleIndex = Math.floor(index / 3);
                this.triangles[triangleIndex] = {v: [index,index+1,index+2], uv: [index,index+1,index+2]};

                index+=3;
            }
        }
        // Segments
        const segmentCount = this.model.segments.length;
        this.lines = new Array(segmentCount * 2);
        for (let i = 0; i < segmentCount; i++) {
            const s = this.model.segments[i];
            this.lines[i * 2] = this.indexMap.get(s.p1);
            this.lines[i * 2 + 1] = this.indexMap.get(s.p2);
        }

        // Face normal in [3]
        function faceNormal(pts) {
            const n = [3];
            for (let i = 0; i < pts.length - 2; i++) {
                // Take triangles until p2p1 x p1p3 > 0.1
                const p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
                const u = [p2.x - p1.x, p2.y - p1.y, p2.z - p1.z];
                const v = [p3.x - p1.x, p3.y - p1.y, p3.z - p1.z];
                n[0] = u[1] * v[2] - u[2] * v[1];
                n[1] = u[2] * v[0] - u[0] * v[2];
                n[2] = u[0] * v[1] - u[1] * v[0];
                if (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) > 0.1) {
                    break;
                }
            }
            return n;
        }
    }

    // Calculate model-view-projection matrix and project vertices
    initModelView() {
        const aspect = this.width / this.height;
        const bounds = this.model.get3DBounds();
        const modelWidth = bounds.xMax - bounds.xMin;
        const modelHeight = bounds.yMax - bounds.yMin;
        const fov = Math.PI/4.2;
        const viewDistance = Math.max(modelWidth / aspect, modelHeight) / Math.tan(fov/2) *0.7; //* 1.2;
        const proj = View3d.perspectiveMat4(fov, aspect, 0.1, viewDistance * 2);
        const viewMatrix = View3d.translateMat4(
                -(bounds.xMin + bounds.xMax) / 2,
                -(bounds.yMin + bounds.yMax) / 2,
                -viewDistance // Position camera
            );
        // Handle Model rotation
        let modelMatrix = View3d.multiplyMat4(
            View3d.rotateYMat4(this.angleY),
            View3d.rotateXMat4(this.angleX)
        );
        // Handle Model translation on X only
        modelMatrix = View3d.multiplyMat4(
            modelMatrix,
            View3d.translateMat4(this.translationX, 0, 0)
        );
        // Handle model scale
        modelMatrix = View3d.multiplyMat4(
            modelMatrix,
            View3d.scaleMat4(this.scale, this.scale, this.scale)
        );
        let mvp = View3d.multiplyMat4(proj, viewMatrix);
        mvp = View3d.multiplyMat4(mvp, modelMatrix);
        // Used for normals
        this.invTransModel = View3d.inverseTransposeMat4(modelMatrix);

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
        const startTime = performance.now();
        const data = this.imgData.data;
        const len = data.length;
        for (let i = 0; i < len; i += 4) {
            data[i] = 204;     // R
            data[i + 1] = 228; // G
            data[i + 2] = 255; // B
            data[i + 3] = 255; // A
        }
        const depthBuffer = this.depthBuffer;
        depthBuffer.fill(Infinity);
        // 3D rendering
        this.renderTriangles();
        if (this.model.lines) {
            this.renderLines();
        }
        // Overlay
        if (this.model.overlay) {
            this.drawFaces();
            this.drawSegments();
            this.drawPoints();
        }
        this.context2d.putImageData(this.imgData, 0, 0);

        if (this.model.labels) {
            this.drawLabels(this.context2d);
        }
        // 30 ms is ok
        const endTime = performance.now();
        if ((endTime - startTime) > 200) {
            console.log(`Render time: ${(endTime - startTime).toFixed(2)}ms`);
        }
    }

    // Helper function to fill a triangle with texture and lighting
    fillTriangle(p0, p1, p2, z0, z1, z2, uv0, uv1, uv2, w0, w1, w2, tex, factor) {
        const area = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2;
        if (area < 0.01) {
            return; // Skip triangles that are too small
        }
        // Calculate bounding box of the triangle (with clipping)
        const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
        const maxX = Math.min(this.width-1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
        const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
        const maxY = Math.min(this.height-1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));

        // Barycentric coordinates
        const p1y_p2y = p1[1] - p2[1];
        const p2x_p1x = p2[0] - p1[0];
        const p2y_p0y = p2[1] - p0[1];
        const p0x_p2x = p0[0] - p2[0];
        const denominator1 = p1y_p2y * (p0[0] - p2[0]) + p2x_p1x * (p0[1] - p2[1]);
        const denominator2 = p2y_p0y * (p1[0] - p2[0]) + p0x_p2x * (p1[1] - p2[1]);

        // Bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const b0 = (p1y_p2y * (x - p2[0]) + p2x_p1x * (y - p2[1])) / denominator1;
                if (b0 < 0) continue;
                const b1 = (p2y_p0y * (x - p2[0]) + p0x_p2x * (y - p2[1])) / denominator2;
                if (b1 < 0) continue;
                const b2 = 1 - b0 - b1;
                if (b2 < 0) continue;
                const z = b0 * z0 + b1 * z1 + b2 * z2;

                // Prevent division by zero in w calculations
                w0 = Math.abs(w0) < 0.001 ? 0.001 : w0;
                w1 = Math.abs(w1) < 0.001 ? 0.001 : w1;
                w2 = Math.abs(w2) < 0.001 ? 0.001 : w2;
                let invW = b0/w0 + b1/w1 + b2/w2;
                invW = Math.abs(invW) < 0.001 ? 0.001 : invW;
                const u = (b0*uv0[0]/w0 + b1*uv1[0]/w1 + b2*uv2[0]/w2) / invW;
                const v = (b0*uv0[1]/w0 + b1*uv1[1]/w1 + b2*uv2[1]/w2) / invW;
                // Ensure texture coordinates are valid
                const tx = Math.floor(u * this.texWidth) % this.texWidth;
                const ty = Math.floor(v * this.texHeight) % this.texHeight;
                // Handle potential negative values from modulo operation
                const texX = tx < 0 ? tx + this.texWidth : tx;
                const texY = ty < 0 ? ty + this.texHeight : ty;
                const ti = (texY * this.texWidth + texX) * 4;
                // Ensure texture data exists and is valid
                const color = tex && ti < tex.length - 2 ?
                    [tex[ti] * factor, tex[ti + 1] * factor, tex[ti + 2] * factor]
                        .map(c => Math.min(255, Math.max(0, Math.floor(c)))) :
                    [0xFF, 0xFF, 0xFF]; // Default to white
                // Draw pixel with depth testing
                this.putPixel(x, y, color, z);
            }
        }
    }

    // Render triangles using software rendering
    renderTriangles() {
        const vertices = this.vertices;
        const projected = this.projected;
        const triangles = this.triangles;
        const ambient = this.ambient;
        const lightDir = this.lightDir;
        const invTransModel = this.invTransModel;
        // console.log(this.frontTexture, this.backTexture);
        // Process all triangles
        for (let i = 0; i < triangles.length; i++) {
            const t = triangles[i];
            const v0 = vertices[t.v[0]], v1 = vertices[t.v[1]], v2 = vertices[t.v[2]];
            const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
            const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
            let normal = View3d.normalize(View3d.cross(e1, e2));
            normal = View3d.transformNormal(invTransModel, normal);
            const isFront = View3d.dot(normal, [0, 0, -1]) < 0;
            const tex = isFront ? this.frontTexture : this.backTexture;
            const lightNormal = isFront ? [-normal[0], -normal[1], -normal[2]] : normal;
            const factor = Math.max(0, View3d.dot(lightNormal, lightDir)) * (1 - ambient) + ambient;
            const uv0 = this.uvs[t.uv[0]], uv1 = this.uvs[t.uv[1]], uv2 = this.uvs[t.uv[2]];
            const p0 = projected[t.v[0]], p1 = projected[t.v[1]], p2 = projected[t.v[2]];
            const z0 = p0[2], z1 = p1[2], z2 = p2[2];
            const w0 = p0[3], w1 = p1[3], w2 = p2[3];
            this.fillTriangle(p0, p1, p2, z0, z1, z2, uv0, uv1, uv2, w0, w1, w2, tex, factor);
        }
    }

    // Render lines using software rendering
    renderLines() {
        const projected = this.projected;
        for (let i = 0; i < this.lines.length; i += 2) {
            const idx1 = this.lines[i];
            const idx2 = this.lines[i + 1];
            if (idx1 !== undefined && idx2 !== undefined) {
                const v1 = projected[idx1];
                const v2 = projected[idx2];
                this.drawLine(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
            }
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
        let z = z1 - 1; // Draw above to see the line
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

    // Draw a filled circle using Bresenham's algorithm
    drawFilledCircle(xc, yc, r, z, color) {
        let x = 0;
        let y = r;
        let d = 3 - 2 * r;
        z = z - 1;  // Draw above to see the circle
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
            if (!proj || p.select !== 0 || p.hover === true) continue;
            const color = [135, 206, 235]; // skyblue
            const radius = 6;
            this.drawFilledCircle(Math.round(proj[0]), Math.round(proj[1]), radius, proj[2], color);
        }
        // Overlay with selected and hovered
        for (let p of this.model.points) {
            const idx = this.indexMap.get(p);
            const proj = this.projected[idx];
            if (!proj || (p.select === 0 && p.hover === false)) continue;
            const radius = p.hover ? 10 : 6;
            const color = p.select === 1 ? [255, 0, 0] : // red
                p.select === 2 ? [255, 165, 0] : // orange
                    p.hover ? [0, 0, 255] : // blue
                        [0, 0, 0]; // skyblue
            this.drawFilledCircle(Math.round(proj[0]), Math.round(proj[1]), radius, proj[2], color);
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
                if (!p1 || !p2) continue;
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
                            const z = z1 + t * (z2 - z1) -1; // -1 to draw above to see the face
                            this.putPixel(x, y, [255, 192, 203], z); // Pink color
                        }
                    }
                }
            }
        }
    }
    /**
     * Draw labels for Points, Segments, Faces
     */
    labels = [];
    drawLabels(context2d) {
        this.labels = [];
        // Points
        for (let p of this.model.points) {
            const txt = String(this.model.points.indexOf(p));
            const idx = this.indexMap.get(p);
            if (!idx) continue;
            const proj = this.projected[idx];
            if (!proj) continue;
            const x = proj[0], y = proj[1];
            const oneLabel = new Label(x, y);
            this.labels.push(oneLabel);
            this.labels.forEach(label => {
                if (label !== oneLabel && label.over(oneLabel)) {
                    oneLabel.moveLabel();
                }
            });
            // Line
            context2d.strokeStyle = 'black';
            context2d.beginPath();
            context2d.moveTo(x, y);
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
    // Cross product: v1 × v2, optionally store in result arg
    static cross(v1, v2, result = null) {
        if (!result) result = [0, 0, 0];
        result[0] = v1[1]*v2[2] - v1[2]*v2[1];
        result[1] = v1[2]*v2[0] - v1[0]*v2[2];
        result[2] = v1[0]*v2[1] - v1[1]*v2[0];
        return result;
    }
    static dot(v1, v2) {return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];}
    // Normalize vector, optionally store in result arg
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
    // Transform normal by matrix, optionally store in the result arg
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
    getX() {return Math.floor(this.x + Label.size * 2 * Math.cos((this.n - 1) * Math.PI / 4));}
    getY() {return Math.floor(this.y + Label.size * 2 * Math.sin((this.n - 1) * Math.PI / 4));}
    moveLabel() {this.n++; return this.n > 8;}
    over(other) {
        const dx = this.getX() - other.getX();
        const dy = this.getY() - other.getY();
        return !(Math.abs(dy) > 20 || Math.abs(dx) > 20);
    }
}
// 650 lines
