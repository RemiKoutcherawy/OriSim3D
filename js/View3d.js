// View3dSoft
// Converted from WebGL to Software Rendering with ImageData API
// Using putPixel(x, y, color, z) for rendering with depth testing

export class View3d {
    angle = 0.0;
    vertices = [
        [-100,-100,0,1], [100,-100,0,1], [100,100,0,1], [-100,100,0,1]
    ];
    uvs = [
        [0,0], [1,0], [1,1], [0,1]
    ];
    triangles = [
        {v: [0,1,2], uv: [0,1,2]},
        {v: [0,2,3], uv: [0,2,3]}
    ];
    frontData;
    backData;
    texWidth;
    texHeight;
    texturesLoaded = 0;
    lightDir = View3d.normalize([0, 0, -1]);
    ambient = 0.2;

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
    // rotateXMat4(angle) {
    //   const c = Math.cos(angle), s = Math.sin(angle);
    //   return [[1,0,0,0], [0,c,-s,0], [0,s,c,0], [0,0,0,1]];
    // }
    // scaleMat4(sx, sy, sz) {
    //   return [[sx,0,0,0], [0,sy,0,0], [0,0,sz,0], [0,0,0,1]];
    // }
    // static frustumMat4(left, right, bottom, top, near, far) {
    //   const rl = 1 / (right - left);
    //   const tb = 1 / (top - bottom);
    //   const nf = 1 / (near - far);
    //   const result = View3d.createMat4();
    //   result[0][0] = near * 2 * rl;
    //   result[1][1] = near * 2 * tb;
    //   result[2][0] = (right + left) * rl;
    //   result[2][1] = (top + bottom) * tb;
    //   result[2][2] = (far + near) * nf;
    //   result[2][3] = -1;
    //   result[3][2] = far * near * 2 * nf;
    //   result[3][3] = 0;
    //   return result;
    // }
    static cross(v1, v2) {
      return [v1[1]*v2[2]-v1[2]*v2[1], v1[2]*v2[0]-v1[0]*v2[2], v1[0]*v2[1]-v1[1]*v2[0]];
    }
    static dot(v1, v2) {
      return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    }
    static normalize(v) {
      const len = Math.sqrt(this.dot(v, v));
      return len ? [v[0]/len, v[1]/len, v[2]/len] : v;
    }
    static transformNormal(mat, normal) {
      const r = [0, 0, 0];
      for (let i = 0; i < 3; i++)
        r[i] = mat[i][0]*normal[0] + mat[i][1]*normal[1] + mat[i][2]*normal[2];
      return View3d.normalize(r);
    }
    static inverseTransposeMat4(mat) {
      const r = View3d.createMat4();
      const c = mat[0][0], s = mat[2][0]; // For rotation Y matrix
      r[0][0] = c; r[0][2] = -s;
      r[1][1] = 1;
      r[2][0] = s; r[2][2] = c;
      return r;
    }
    depthBuffer = null;
    frontTexture = null;
    backTexture = null;
    context2d = null;
    // Current rotation angle (x-axis, y-axis degrees)
    angleX = 0.0;
    angleY = 0.0;
    scale = 1.0;

    constructor(model, canvas3d, overlay) {
        // Instance variables
        this.model = model;
        this.canvas3d = canvas3d;
        this.overlay = overlay;
        this.context2d = canvas3d.getContext('2d');

        // Initialize canvas buffer and depth buffer
        this.width = this.canvas3d.width = this.canvas3d.clientWidth;
        this.height = this.canvas3d.height = this.canvas3d.clientHeight;
        this.imgData = this.context2d.getImageData(0, 0, this.canvas3d.width, this.canvas3d.height);
        this.depthBuffer = Array(this.canvas3d.height).fill(Infinity).map(() => Array(this.canvas3d.width).fill(Infinity));

        this.initTextures();
        // Resize
        window.addEventListener('resize', () => {
            const c = this.canvas3d, ctx = c.getContext("2d");
            this.width = c.width = window.innerWidth;
            this.height = c.height = window.innerHeight;
            this.imgData = ctx.createImageData(this.width, this.height);
            this.depthBuffer = Array(this.height).fill(Infinity).map(() => Array(this.width).fill(Infinity));
            this.render();
        });
    }

    putPixel(x, y, color, z) {
        const width = this.canvas3d.width, height = this.canvas3d.height, imgData = this.imgData;
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        if (z < this.depthBuffer[y][x]) {
            const i = (y * width + x) * 4;
            imgData.data[i] = color[0]; imgData.data[i + 1] = color[1]; imgData.data[i + 2] = color[2]; imgData.data[i + 3] = 255;
            this.depthBuffer[y][x] = z;
        }
    }

    // Textures
    initTextures() {
        // Create texture objects
        this.frontTexture = { image: null, width: 1, height: 1 };
        this.backTexture = { image: null, width: 1, height: 1 };

        // Load textures
        const frontImg = new Image(), backImg = new Image();
        frontImg.src = 'textures/front.jpg';
        backImg.src = 'textures/back.jpg';
        let scope = this;

        function loadTexture(img, callback) {
            img.onload = () => {
                const texCanvas = document.createElement("canvas");
                texCanvas.width = scope.texWidth = img.width;
                texCanvas.height = scope.texHeight = img.height;
                const texCtx = texCanvas.getContext("2d");
                texCtx.scale(1, -1);
                texCtx.translate(0, -scope.texHeight);
                texCtx.drawImage(img, 0, 0);
                callback(texCtx.getImageData(0, 0, scope.texWidth, scope.texHeight).data);
                if (++scope.texturesLoaded === 2) scope.render();
            };
        }
        loadTexture(frontImg, data => this.frontData = data);
        loadTexture(backImg, data => this.backData = data);
    }


    // // Perspective and background
    // perspective() {
    //     // Clear canvas with light blue background (0xCCE4FF)
    //     this.context2d.fillStyle = 'rgb(204, 228, 255)';
    //     this.context2d.fillRect(0, 0, this.canvas3d.width, this.canvas3d.height);
    //
    //     // Reset canvas buffer
    //     // this.canvasBuffer = this.context2d.getImageData(0, 0, this.canvas3d.width, this.canvas3d.height);
    //
    //     // Clear depth buffer
    //     this.clearDepthBuffer();
    //
    //     // Choose portrait or landscape
    //     const ratio = this.canvas3d.clientWidth / this.canvas3d.clientHeight;
    //     const fov = 40;
    //     const near = 50, far = 1200;
    //     let top, bottom, left, right;
    //     if (ratio >= 1.0) {
    //         top = near * Math.tan(fov * (Math.PI / 360.0));
    //         bottom = -top;
    //         left = bottom * ratio;
    //         right = top * ratio;
    //     } else {
    //         right = near * Math.tan(fov * (Math.PI / 360.0));
    //         left = -right;
    //         top = right / ratio;
    //         bottom = left / ratio;
    //     }
    //
    //     // Basic frustum at a distance of 700. Camera is at z=0, model at -700
    //     const frustum = View3d.frustumMat4(left, right, bottom, top, near, far);
    //
    //     // Step back
    //     // frustum[3][3] += 700;
    //
    //     this.projection = frustum;
    // }

    // Buffers
    initBuffers() {
        // Faces with FAN
        let index = 0;
        for (let f of this.model.faces) {
            const pts = f.points;
            const n = normal(pts);
            for (let i = 1; i < pts.length - 1; i++) {
                // First point
                const v0x = pts[0].x + f.offset * n[0];
                const v0y = pts[0].y + f.offset * n[1];
                const v0z = pts[0].z + f.offset * n[2];
                this.vertices.push([v0x, v0y, v0z, 1.0 ]);

                // Texture at first point of triangle
                const ft0u = (200 + pts[0].xf) / this.texWidth;
                const ft0v = (200 + pts[0].yf) / this.texHeight;
                this.uvs.push([ft0u, ft0v]);

                // Second point of triangle
                const v1x = pts[i].x + f.offset * n[0];
                const v1y = pts[i].y + f.offset * n[1];
                const v1z = pts[i].z + f.offset * n[2];
                this.vertices.push([v1x, v1y, v1z, 1.0]);

                // Texture at second point of triangle
                const ft1u = (200 + pts[i].xf) / this.texWidth;
                const ft1v = (200 + pts[i].yf) / this.texHeight;
                this.uvs.push([ft1u, ft1v]);

                // Third point of triangle
                const v2x = pts[i + 1].x + f.offset * n[0];
                const v2y = pts[i + 1].y + f.offset * n[1];
                const v2z = pts[i + 1].z + f.offset * n[2];
                this.vertices.push([v2x, v2y, v2z, 1.0]);

                // Texture at third point of triangle
                const ft2u = (200 + pts[i + 1].xf) / this.texWidth;
                const ft2v = (200 + pts[i + 1].yf) / this.texHeight;
                this.uvs.push([ft2u, ft2v]);

                // Add triangle to list
                this.triangles.push({v: [index,index+1,index+2], uv: [index,index+1,index+2]},);
                index+=3;
            }
        }
        //
        // // Segments
        // for (let s of this.model.segments) {
        //     this.lin.push(this.indexMap.get(s.p1), this.indexMap.get(s.p2));
        // }
        //
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
        // // Rotation around X axis
        // let ex = this.createMat4();
        // ex = this.rotateXMat4(this.angleX / 200);
        // // Rotation around Y axis
        // let mv = this.rotateYMat4(this.angleY / 100);
        // mv = this.multiplyMat4(mv, ex);
        // // Scale ModelView
        // this.modelView = this.scaleMat4(this.scale, this.scale, this.scale);
        // this.modelView = this.multiplyMat4(this.modelView, mv);
        //
        // // Overlay
        // // if (this.overlay) {
        // //     this.overlay.width = this.overlay.clientWidth;
        // //     this.overlay.height = this.overlay.clientHeight;
        // //     const scale = this.scaleMat4(this.overlay.width / 2.0, -this.overlay.height / 2.0, 1.0);
        // //     const translation = this.translateMat4(1, -1, 0);
        // //     const overlay = this.multiplyMat4(scale, translation);
        // //
        // //     // canvasView = overlay * projection * modelView
        // //     const projection = this.multiplyMat4(this.projection, this.modelView);
        // //     this.canvasView = this.multiplyMat4(overlay, projection);
        // //
        // //     // Set xCanvas, yCanvas to model points
        // //     for (let p of this.model.points) {
        // //         const v = View3d.transformVec4(this.canvasView, [p.x, p.y, p.z]);
        // //         p.xCanvas = v[0];
        // //         p.yCanvas = v[1];
        // //     }
        // // }
        //
        // // Compute projected vertices for all triangles
        // this.projectedVertices = [];
        //
        // // Combined projection and model view matrix
        // const mvp = this.multiplyMat4(this.projection, this.modelView);
        //
        // // Project all vertices
        // for (let i = 0; i < this.vtx.length; i += 3) {
        //     const x = this.vtx[i];
        //     const y = this.vtx[i + 1];
        //     const z = this.vtx[i + 2];
        //
        //     // Apply MVP matrix
        //     const projected = View3d.transformVec4(mvp, [x, y, z, 1.0]);
        //
        //     // Perspective division
        //     const w = projected[3];
        //     const px = projected[0] / w;
        //     const py = projected[1] / w;
        //     const pz = projected[2] / w;
        //
        //     this.projectedVertices.push({ x: px, y: py, z: pz, w: w });
        // }
    }

    // Render
    render() {
        if (this.texturesLoaded < 2) return;
        this.angle += 0.01;
        for (let i = 0; i < this.imgData.data.length; i += 4) this.imgData.data[i + 3] = 0;
        for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) this.depthBuffer[y][x] = Infinity;
        const proj = View3d.perspectiveMat4(Math.PI/3, this.width/this.height, 0.1, 100);
        const view = View3d.translateMat4(0, 0, -500);
        const model = View3d.rotateYMat4(this.angle);
        let mvp = View3d.multiplyMat4(proj, view);
        mvp = View3d.multiplyMat4(mvp, model);
        const invTransModel = View3d.inverseTransposeMat4(model);
        const scope = this;
        const projected = this.vertices.map(v => {
            const tv = View3d.transformVec4(mvp, v);
            const w = tv[3];
            return [(tv[0]/w + 1) * scope.width/2, (1 - tv[1]/w) * scope.height/2, tv[2]/w, w];
        });
        this.renderTriangles(invTransModel, projected);
        const ctx = this.canvas3d.getContext("2d");
        ctx.putImageData(this.imgData, 0, 0);

        // If overlay exists, draw UI elements on it
        // if (this.overlay) {
        //     // Context 2d
        //     const context2d = this.overlay.getContext('2d');
        //     context2d.clearRect(0, 0, this.overlay.clientWidth, this.overlay.clientHeight);
        //
        //     // Model projected on overlay canvas
        //     this.drawSegments(this.model.segments); // Hover and select
        //     this.drawPoints(this.model.points);
        //     this.drawFaces(this.model.faces);    // Only for hover and select
        //
        //     if (this.model.labels) {
        //         this.drawLabels(context2d);
        //     }
        // }
    }

    // Helper function to fill a triangle with texture and lighting
    fillTriangle(p0, p1, p2, z0, z1, z2, uv0, uv1, uv2, w0, w1, w2, tex, factor) {
        const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
        const maxX = Math.min(this.width-1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
        const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
        const maxY = Math.min(this.height-1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const b0 = ((p1[1]-p2[1])*(x-p2[0]) + (p2[0]-p1[0])*(y-p2[1])) /
                    ((p1[1]-p2[1])*(p0[0]-p2[0]) + (p2[0]-p1[0])*(p0[1]-p2[1]));
                const b1 = ((p2[1]-p0[1])*(x-p2[0]) + (p0[0]-p2[0])*(y-p2[1])) /
                    ((p2[1]-p0[1])*(p1[0]-p2[0]) + (p0[0]-p2[0])*(p1[1]-p2[1]));
                const b2 = 1 - b0 - b1;
                if (b0 >= 0 && b1 >= 0 && b2 >= 0) {
                    const z = b0 * z0 + b1 * z1 + b2 * z2;
                    const invW = b0/w0 + b1/w1 + b2/w2;
                    const u = (b0*uv0[0]/w0 + b1*uv1[0]/w1 + b2*uv2[0]/w2) / invW;
                    const v = (b0*uv0[1]/w0 + b1*uv1[1]/w1 + b2*uv2[1]/w2) / invW;
                    const tx = Math.floor(u * this.texWidth) % this.texWidth;
                    const ty = Math.floor(v * this.texHeight) % this.texHeight;
                    const ti = (ty * this.texWidth + tx) * 4;
                    const color = [tex[ti] * factor, tex[ti + 1] * factor, tex[ti + 2] * factor]
                        .map(c => Math.min(255, Math.max(0, Math.floor(c))));
                    // Draw pixel with depth testing
                    this.putPixel(x, y, color, z);
                }
            }
        }
    }

    // Render triangles using software rendering
    renderTriangles(invTransModel, projected) {
        this.triangles.forEach(t => {
            const v0 = this.vertices[t.v[0]], v1 = this.vertices[t.v[1]], v2 = this.vertices[t.v[2]];
            const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
            const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
            let normal = View3d.normalize(View3d.cross(e1, e2));
            normal = View3d.transformNormal(invTransModel, normal);
            const isFront = View3d.dot(normal, [0, 0, -1]) > 0; // Camera looks along -Z
            const tex = isFront ? this.frontData : this.backData;
            const lightNormal = isFront ? normal : [-normal[0], -normal[1], -normal[2]]; // Flip normal for back face
            const factor = Math.max(0, View3d.dot(lightNormal, this.lightDir)) * (1 - this.ambient) + this.ambient;
            const uv0 = this.uvs[t.uv[0]], uv1 = this.uvs[t.uv[1]], uv2 = this.uvs[t.uv[2]];
            const p0 = projected[t.v[0]], p1 = projected[t.v[1]], p2 = projected[t.v[2]];
            const z0 = p0[2], z1 = p1[2], z2 = p2[2];
            const w0 = p0[3], w1 = p1[3], w2 = p2[3];
            this.fillTriangle(p0, p1, p2, z0, z1, z2, uv0, uv1, uv2, w0, w1, w2, tex, factor);
        });
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

            // Draw pixel with depth testing
            this.putPixel(x, y, lineColor, z);

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
