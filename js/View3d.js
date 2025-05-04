// View3dSoft
// Converted from WebGL to Software Rendering with ImageData API
// Using putPixel(x, y, color) for rendering
import {mat4} from './mat4.js';

export class View3d {
    // Software rendering properties
    canvasBuffer = null;
    depthBuffer = null;
    frontTexture = null;
    backTexture = null;
    context2d = null;

    // Current rotation angle (x-axis, y-axis degrees)
    angleX = 0.0;
    angleY = 0.0;
    scale = 1.0;

    // Projection and model view matrix
    projection = new Float32Array(16);
    modelView = new Float32Array(16);
    canvasView = new Float32Array(16);

    // Textures dimensions defaults
    wTexFront = 1;
    hTexFront = 1;
    wTexBack = 1;
    hTexBack = 1;

    // Arrays
    vtx = []; // vertex coords
    ftx = []; // front texture coords
    btx = []; // back texture coords
    fnr = []; // front normals coords
    lin = []; // lines indices

    constructor(model, canvas3d, overlay) {
        // Instance variables
        this.model = model;
        this.canvas3d = canvas3d;
        this.overlay = overlay;
        this.context2d = canvas3d.getContext('2d');

        // Initialize canvas buffer and depth buffer
        this.canvas3d.width = this.canvas3d.clientWidth;
        this.canvas3d.height = this.canvas3d.clientHeight;
        this.canvasBuffer = this.context2d.getImageData(0, 0, this.canvas3d.width, this.canvas3d.height);
        this.depthBuffer = new Array(this.canvas3d.width * this.canvas3d.height).fill(-Infinity);

        // Front and back colors
        this.frontColor = { r: 0, g: 128, b: 255, a: 204 }; // 0x0080FFCC
        this.backColor = { r: 255, g: 255, b: 0, a: 204 };  // 0xFFFF00CC

        this.initTextures();
        this.initPerspective();
        this.initModelView();

        // Resize
        window.addEventListener('resize', () => {
            this.canvas3d.width = this.canvas3d.clientWidth;
            this.canvas3d.height = this.canvas3d.clientHeight;
            this.canvasBuffer = this.context2d.getImageData(0, 0, this.canvas3d.width, this.canvas3d.height);
            this.depthBuffer = new Array(this.canvas3d.width * this.canvas3d.height).fill(-Infinity);
            this.initPerspective();
            this.initModelView();
            this.render();
        });
    }

    // Put a pixel on the canvas buffer
    putPixel(x, y, color) {
        x = Math.round((x + 1) * this.canvas3d.width / 2);  // Transform to screen space
        y = Math.round((1 - y) * this.canvas3d.height / 2); // Invert Y to align with canvas

        if (x < 0 || x >= this.canvas3d.width || y < 0 || y >= this.canvas3d.height) {
            return;
        }

        const offset = 4 * (x + this.canvasBuffer.width * y);
        this.canvasBuffer.data[offset] = color.r;
        this.canvasBuffer.data[offset + 1] = color.g;
        this.canvasBuffer.data[offset + 2] = color.b;
        this.canvasBuffer.data[offset + 3] = color.a || 255; // Alpha (default to fully opaque)
    }

    // Update the canvas with the buffer data
    updateCanvas() {
        this.context2d.putImageData(this.canvasBuffer, 0, 0);
    }

    // Check and update depth buffer
    updateDepthBufferIfCloser(x, y, z) {
        x = Math.round((x + 1) * this.canvas3d.width / 2);
        y = Math.round((1 - y) * this.canvas3d.height / 2);

        if (x < 0 || x >= this.canvas3d.width || y < 0 || y >= this.canvas3d.height) {
            return false;
        }

        const offset = x + this.canvas3d.width * y;
        if (this.depthBuffer[offset] < z) {
            this.depthBuffer[offset] = z;
            return true;
        }
        return false;
    }

    // Clear depth buffer
    clearDepthBuffer() {
        this.depthBuffer.fill(-Infinity);
    }

    // Textures
    initTextures() {
        // Create texture objects
        this.frontTexture = { image: null, width: 1, height: 1 };
        this.backTexture = { image: null, width: 1, height: 1 };

        // Load front texture
        const imageFront = new Image();
        const scope = this;
        imageFront.onload = function() {
            // Create a canvas to read pixel data
            const canvas = document.createElement('canvas');
            canvas.width = imageFront.width;
            canvas.height = imageFront.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageFront, 0, 0);

            // Store texture data
            scope.frontTexture.image = ctx.getImageData(0, 0, imageFront.width, imageFront.height);
            scope.frontTexture.width = imageFront.width;
            scope.frontTexture.height = imageFront.height;
            scope.wTexFront = imageFront.width;
            scope.hTexFront = imageFront.height;
        };

        if (window.document.getElementById('front')) {
            imageFront.src = window.document.getElementById('front').src;
        }

        // Load back texture
        const imageBack = new Image();
        imageBack.onload = function() {
            // Create a canvas to read pixel data
            const canvas = document.createElement('canvas');
            canvas.width = imageBack.width;
            canvas.height = imageBack.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBack, 0, 0);

            // Store texture data
            scope.backTexture.image = ctx.getImageData(0, 0, imageBack.width, imageBack.height);
            scope.backTexture.width = imageBack.width;
            scope.backTexture.height = imageBack.height;
            scope.wTexBack = imageBack.width;
            scope.hTexBack = imageBack.height;

            // Recompute texture coords
            scope.initBuffers();

            // First Render
            scope.render();
        };

        if (window.document.getElementById('back')) {
            imageBack.src = window.document.getElementById('back').src;
        }
    }

    // Get texture color at coordinates
    getTextureColor(texture, u, v) {
        if (!texture.image) {
            return texture === this.frontTexture ?
                { r: 0x70, g: 0xAC, b: 0xF3, a: 255 } : // Blue placeholder
                { r: 0xFD, g: 0xEC, b: 0x43, a: 255 };  // Yellow placeholder
        }

        // Clamp texture coordinates
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));

        // Convert to pixel coordinates
        const x = Math.floor(u * (texture.width - 1));
        const y = Math.floor(v * (texture.height - 1));

        // Get pixel data
        const offset = (y * texture.width + x) * 4;
        return {
            r: texture.image.data[offset],
            g: texture.image.data[offset + 1],
            b: texture.image.data[offset + 2],
            a: texture.image.data[offset + 3]
        };
    }

    // Perspective and background
    initPerspective() {
        // Clear canvas with light blue background (0xCCE4FF)
        this.context2d.fillStyle = 'rgb(204, 228, 255)';
        this.context2d.fillRect(0, 0, this.canvas3d.width, this.canvas3d.height);

        // Reset canvas buffer
        this.canvasBuffer = this.context2d.getImageData(0, 0, this.canvas3d.width, this.canvas3d.height);

        // Clear depth buffer
        this.clearDepthBuffer();

        // Choose portrait or landscape
        const ratio = this.canvas3d.clientWidth / this.canvas3d.clientHeight;
        const fov = 40;
        const near = 50, far = 1200;
        let top, bottom, left, right;
        if (ratio >= 1.0) {
            top = near * Math.tan(fov * (Math.PI / 360.0));
            bottom = -top;
            left = bottom * ratio;
            right = top * ratio;
        } else {
            right = near * Math.tan(fov * (Math.PI / 360.0));
            left = -right;
            top = right / ratio;
            bottom = left / ratio;
        }

        // Basic frustum at a distance of 700. Camera is at z=0, model at -700
        const frustum = mat4.frustum(new Float32Array(16), left, right, bottom, top, near, far);
        // Step back
        frustum[15] += 700;

        this.projection = frustum;
    }

    // Buffers
    initBuffers() {
        this.vtx = []; // vertex coords
        this.ftx = []; // front texture coords
        this.btx = []; // back texture coords
        this.fnr = []; // front normals coords
        this.lin = []; // lines indices
        this.triangles = []; // triangles for rendering
        this.indexMap = new WeakMap(); // index in vtx for each point

        // Faces with FAN
        let index = 0;
        for (let f of this.model.faces) {
            const pts = f.points;
            const n = normal(pts);

            for (let i = 1; i < pts.length - 1; i++) {
                // Create a triangle
                const triangle = {
                    vertices: [],
                    normals: [],
                    frontTexCoords: [],
                    backTexCoords: []
                };

                // First point
                const v0x = pts[0].x + f.offset * n[0];
                const v0y = pts[0].y + f.offset * n[1];
                const v0z = pts[0].z + f.offset * n[2];
                triangle.vertices.push({ x: v0x, y: v0y, z: v0z });
                triangle.normals.push({ x: n[0], y: n[1], z: n[2] });

                // Texture at first point of triangle
                const ft0u = (200 + pts[0].xf) / this.wTexFront;
                const ft0v = (200 + pts[0].yf) / this.hTexFront;
                const bt0u = (200 + pts[0].xf) / this.wTexBack;
                const bt0v = (200 + pts[0].yf) / this.hTexBack;
                triangle.frontTexCoords.push({ u: ft0u, v: ft0v });
                triangle.backTexCoords.push({ u: bt0u, v: bt0v });

                // Store in flat arrays for compatibility
                this.vtx.push(v0x, v0y, v0z);
                this.fnr.push(n[0], n[1], n[2]);
                this.ftx.push(ft0u, ft0v);
                this.btx.push(bt0u, bt0v);

                // Second point of triangle
                const v1x = pts[i].x + f.offset * n[0];
                const v1y = pts[i].y + f.offset * n[1];
                const v1z = pts[i].z + f.offset * n[2];
                triangle.vertices.push({ x: v1x, y: v1y, z: v1z });
                triangle.normals.push({ x: n[0], y: n[1], z: n[2] });

                // Texture at second point of triangle
                const ft1u = (200 + pts[i].xf) / this.wTexFront;
                const ft1v = (200 + pts[i].yf) / this.hTexFront;
                const bt1u = (200 + pts[i].xf) / this.wTexBack;
                const bt1v = (200 + pts[i].yf) / this.hTexBack;
                triangle.frontTexCoords.push({ u: ft1u, v: ft1v });
                triangle.backTexCoords.push({ u: bt1u, v: bt1v });

                // Store in flat arrays for compatibility
                this.vtx.push(v1x, v1y, v1z);
                this.fnr.push(n[0], n[1], n[2]);
                this.ftx.push(ft1u, ft1v);
                this.btx.push(bt1u, bt1v);

                // Third point of triangle
                const v2x = pts[i + 1].x + f.offset * n[0];
                const v2y = pts[i + 1].y + f.offset * n[1];
                const v2z = pts[i + 1].z + f.offset * n[2];
                triangle.vertices.push({ x: v2x, y: v2y, z: v2z });
                triangle.normals.push({ x: n[0], y: n[1], z: n[2] });

                // Texture at third point of triangle
                const ft2u = (200 + pts[i + 1].xf) / this.wTexFront;
                const ft2v = (200 + pts[i + 1].yf) / this.hTexFront;
                const bt2u = (200 + pts[i + 1].xf) / this.wTexBack;
                const bt2v = (200 + pts[i + 1].yf) / this.hTexBack;
                triangle.frontTexCoords.push({ u: ft2u, v: ft2v });
                triangle.backTexCoords.push({ u: bt2u, v: bt2v });

                // Store in flat arrays for compatibility
                this.vtx.push(v2x, v2y, v2z);
                this.fnr.push(n[0], n[1], n[2]);
                this.ftx.push(ft2u, ft2v);
                this.btx.push(bt2u, bt2v);

                // Add triangle to list
                this.triangles.push(triangle);

                // Keep track of index in vtx for each point to draw lines
                this.indexMap.set(pts[0], index++);
                this.indexMap.set(pts[i], index++);
                this.indexMap.set(pts[i + 1], index++);
            }
        }

        // Segments
        for (let s of this.model.segments) {
            this.lin.push(this.indexMap.get(s.p1), this.indexMap.get(s.p2));
        }

        // Compute Face normal in [3]
        function normal(pts) {
            let n = [3];
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
            // n.normalize();
            const sq = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
            n[0] /= sq;
            n[1] /= sq;
            n[2] /= sq;
            return n;
        }
    }

    // Model view matrix
    initModelView() {
        // Rotation around X axis
        let ex = mat4.create();
        ex = mat4.rotateX(ex, ex, this.angleX / 200);
        // Rotation around Y axis
        let mv = mat4.rotateY(ex, ex, this.angleY / 100);
        // Scale ModelView
        this.modelView = mat4.scale(mv, mv, [this.scale, this.scale, this.scale]);

        // Overlay
        if (this.overlay) {
            this.overlay.width = this.overlay.clientWidth;
            this.overlay.height = this.overlay.clientHeight;
            const scale = mat4.scale(new Float32Array(16), mat4.create(), [this.overlay.width / 2.0, -this.overlay.height / 2.0, 1.0]);
            const translation = mat4.fromTranslation(new Float32Array(16), [1, -1, 0]);
            const overlay = mat4.multiply(new Float32Array(16), scale, translation);

            // canvasView = overlay * projection * modelView
            const projection = mat4.multiply(new Float32Array(16), this.projection, this.modelView);
            this.canvasView = mat4.multiply(new Float32Array(16), overlay, projection);

            // Set xCanvas, yCanvas to model points
            for (let p of this.model.points) {
                const v = mat4.applyMatrix4(this.canvasView, [p.x, p.y, p.z]);
                p.xCanvas = v[0];
                p.yCanvas = v[1];
            }
        }

        // Compute projected vertices for all triangles
        this.projectedVertices = [];

        // Combined projection and model view matrix
        const mvp = mat4.multiply(new Float32Array(16), this.projection, this.modelView);

        // Project all vertices
        for (let i = 0; i < this.vtx.length; i += 3) {
            const x = this.vtx[i];
            const y = this.vtx[i + 1];
            const z = this.vtx[i + 2];

            // Apply MVP matrix
            const projected = mat4.applyMatrix4(mvp, [x, y, z, 1.0]);

            // Perspective division
            const w = projected[3];
            const px = projected[0] / w;
            const py = projected[1] / w;
            const pz = projected[2] / w;

            this.projectedVertices.push({ x: px, y: py, z: pz, w: w });
        }
    }

    // Render
    render() {
        // Initialize perspective (clears canvas and depth buffer)
        this.initPerspective();

        // Render triangles
        this.renderTriangles();

        // Render lines
        this.renderLines();

        // Update canvas with buffer data
        this.updateCanvas();

        // If overlay exists, draw UI elements on it
        if (this.overlay) {
            // Context 2d
            const context2d = this.overlay.getContext('2d');
            context2d.clearRect(0, 0, this.overlay.clientWidth, this.overlay.clientHeight);

            // Model projected on overlay canvas
            this.drawSegments(this.model.segments); // Hover and select
            this.drawPoints(this.model.points);
            this.drawFaces(this.model.faces);    // Only for hover and select

            if (this.model.labels) {
                this.drawLabels(context2d);
            }
        }
    }

    // Render triangles using software rendering
    renderTriangles() {
        // For each triangle
        for (let t = 0; t < this.triangles.length; t++) {
            const triangle = this.triangles[t];

            // Get projected vertices for this triangle
            const v0 = this.projectedVertices[t * 3];
            const v1 = this.projectedVertices[t * 3 + 1];
            const v2 = this.projectedVertices[t * 3 + 2];
            console.log(t, this.triangles[t]);
            console.log(v0, v1, v2);

            // Skip if any vertex is undefined
            if (!v0 || !v1 || !v2) continue;

            // Skip triangles outside the view frustum
            if (Math.abs(v0.x) > 1 && Math.abs(v1.x) > 1 && Math.abs(v2.x) > 1) continue;
            if (Math.abs(v0.y) > 1 && Math.abs(v1.y) > 1 && Math.abs(v2.y) > 1) continue;
            if (v0.z < -1 && v1.z < -1 && v2.z < -1) continue;
            if (v0.z > 1 && v1.z > 1 && v2.z > 1) continue;

            // Compute face normal for backface culling
            const edge1x = v1.x - v0.x;
            const edge1y = v1.y - v0.y;
            const edge2x = v2.x - v0.x;
            const edge2y = v2.y - v0.y;
            const normalZ = edge1x * edge2y - edge1y * edge2x;

            // Determine if front or back facing (for texture selection)
            const isFrontFacing = normalZ <= 0;
            const texture = isFrontFacing ? this.frontTexture : this.backTexture;
            const texCoords = isFrontFacing ? triangle.frontTexCoords : triangle.backTexCoords;

            // Compute bounding box for the triangle
            const minX = Math.max(-1, Math.min(v0.x, v1.x, v2.x));
            const maxX = Math.min(1, Math.max(v0.x, v1.x, v2.x));
            const minY = Math.max(-1, Math.min(v0.y, v1.y, v2.y));
            const maxY = Math.min(1, Math.max(v0.y, v1.y, v2.y));

            // Rasterize the triangle
            for (let y = minY; y <= maxY; y += 0.005) {
                for (let x = minX; x <= maxX; x += 0.005) {
                    // Compute barycentric coordinates
                    const denominator = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
                    if (Math.abs(denominator) < 0.00001) continue;

                    const lambda0 = ((v1.y - v2.y) * (x - v2.x) + (v2.x - v1.x) * (y - v2.y)) / denominator;
                    const lambda1 = ((v2.y - v0.y) * (x - v2.x) + (v0.x - v2.x) * (y - v2.y)) / denominator;
                    const lambda2 = 1 - lambda0 - lambda1;

                    // Check if point is inside triangle
                    if (lambda0 >= 0 && lambda1 >= 0 && lambda2 >= 0) {
                        // Interpolate z value for depth test
                        const z = lambda0 * v0.z + lambda1 * v1.z + lambda2 * v2.z;

                        // Depth test
                        if (this.updateDepthBufferIfCloser(x, y, z)) {
                            // Interpolate texture coordinates
                            const u = lambda0 * texCoords[0].u + lambda1 * texCoords[1].u + lambda2 * texCoords[2].u;
                            const v = lambda0 * texCoords[0].v + lambda1 * texCoords[1].v + lambda2 * texCoords[2].v;

                            // Get texture color
                            const texColor = this.getTextureColor(texture, u, v);

                            // Interpolate normals for lighting
                            const nx = lambda0 * triangle.normals[0].x + lambda1 * triangle.normals[1].x + lambda2 * triangle.normals[2].x;
                            const ny = lambda0 * triangle.normals[0].y + lambda1 * triangle.normals[1].y + lambda2 * triangle.normals[2].y;
                            const nz = lambda0 * triangle.normals[0].z + lambda1 * triangle.normals[1].z + lambda2 * triangle.normals[2].z;

                            // Lighting calculation (similar to GLSL shader)
                            const ambientLight = [0.3, 0.3, 0.3];
                            const directionalLightColor = [1.0, 1.0, 1.0];
                            const directionalVector = [0.1, 0.1, 0.75];

                            // Normalize normal
                            const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz);
                            const normalizedNx = nx / normalLength;
                            const normalizedNy = ny / normalLength;
                            const normalizedNz = nz / normalLength;

                            // Dot product for directional lighting
                            const directional = normalizedNx * directionalVector[0] +
                                               normalizedNy * directionalVector[1] +
                                               normalizedNz * directionalVector[2];

                            // Choose lighting based on face orientation
                            let lighting;
                            if (isFrontFacing) {
                                lighting = [
                                    ambientLight[0] + (directionalLightColor[0] * directional),
                                    ambientLight[1] + (directionalLightColor[1] * directional),
                                    ambientLight[2] + (directionalLightColor[2] * directional)
                                ];
                            } else {
                                lighting = [
                                    ambientLight[0] - (directionalLightColor[0] * directional),
                                    ambientLight[1] - (directionalLightColor[1] * directional),
                                    ambientLight[2] - (directionalLightColor[2] * directional)
                                ];
                            }

                            // Apply lighting to texture color
                            const finalColor = {
                                r: Math.min(255, Math.max(0, Math.floor(texColor.r * lighting[0]))),
                                g: Math.min(255, Math.max(0, Math.floor(texColor.g * lighting[1]))),
                                b: Math.min(255, Math.max(0, Math.floor(texColor.b * lighting[2]))),
                                a: texColor.a
                            };

                            // Draw pixel
                            this.putPixel(x, y, finalColor);
                        }
                    }
                }
            }
        }
    }

    // Render lines using software rendering
    renderLines() {
        // For each line segment
        for (let i = 0; i < this.lin.length; i += 2) {
            const idx1 = this.lin[i];
            const idx2 = this.lin[i + 1];

            // Get projected vertices
            const v1 = this.projectedVertices[idx1];
            const v2 = this.projectedVertices[idx2];

            // Skip if any vertex is undefined
            if (!v1 || !v2) continue;

            // Skip lines outside the view frustum
            if ((Math.abs(v1.x) > 1 && Math.abs(v2.x) > 1) ||
                (Math.abs(v1.y) > 1 && Math.abs(v2.y) > 1) ||
                (v1.z < -1 && v2.z < -1) ||
                (v1.z > 1 && v2.z > 1)) {
                continue;
            }

            // Draw line using Bresenham's algorithm
            this.drawLine(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        }
    }

    // Draw a line using Bresenham's algorithm
    drawLine(x1, y1, z1, x2, y2, z2) {
        // Line color (black)
        const lineColor = { r: 0, g: 0, b: 0, a: 255 };

        // Calculate differences
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 0.01 : -0.01;
        const sy = y1 < y2 ? 0.01 : -0.01;

        // Error term
        let err = dx - dy;

        // Current position
        let x = x1;
        let y = y1;
        let z = z1;

        // Z interpolation
        const totalSteps = Math.max(Math.ceil(dx / 0.01), Math.ceil(dy / 0.01));
        const zStep = (z2 - z1) / (totalSteps || 1);

        // Draw the line
        let steps = 0;
        while (steps < 1000 && ((sx > 0 && x <= x2) || (sx < 0 && x >= x2)) &&
               ((sy > 0 && y <= y2) || (sy < 0 && y >= y2))) {

            // Depth test and draw pixel
            if (this.updateDepthBufferIfCloser(x, y, z)) {
                this.putPixel(x, y, lineColor);
            }

            // Update position
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }

            // Update z
            z += zStep;
            steps++;
        }
    }

    // Draw on overlay. Called from render()
    drawPoints(points,) {
        const context2d = this.overlay.getContext('2d');
        for (let p of points) {
            // Circle with color for selected, bigger for hovered
            context2d.beginPath();
            context2d.arc(p.xCanvas, p.yCanvas, p.hover ? 10 : 6, 0, 2 * Math.PI);
            context2d.fillStyle = p.select === 1 ? 'red' : p.select === 2 ? 'orange' : p.hover ? 'blue' : 'skyblue';
            context2d.fill();
        }
    }

    // Draw on overlay. Called from render()
    drawSegments(segments) {
        // if (segments === undefined) {return;}
        const context2d = this.overlay.getContext('2d');
        for (let s of segments) {
            context2d.lineWidth = s.hover ? 6 : 3;
            context2d.beginPath();
            context2d.moveTo(s.p1.xCanvas, s.p1.yCanvas);
            context2d.lineTo(s.p2.xCanvas, s.p2.yCanvas);
            context2d.strokeStyle = s.select === 1 ? 'red' : s.select === 2 ? 'orange' : s.hover ? 'blue' : 'skyblue';
            context2d.stroke();
        }
    }

    // Draw faces
    drawFaces(faces) {
        const context2d = this.overlay.getContext('2d');
        for (let f of faces) {
            if (f.hover) {
                context2d.fillStyle = 'pink';
                const pts = f.points;
                context2d.beginPath();
                let xCanvas = pts[0].xCanvas;
                let yCanvas = pts[0].yCanvas;
                context2d.moveTo(xCanvas, yCanvas);
                pts.forEach((p) => {
                    xCanvas = p.xCanvas;
                    yCanvas = p.yCanvas;
                    context2d.lineTo(xCanvas, yCanvas);
                })
                context2d.closePath();
                context2d.fill();
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

// 574 lines of code
