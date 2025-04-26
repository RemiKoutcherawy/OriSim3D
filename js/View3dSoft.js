import {Model} from "./Model.js";
export class View3dSoft {
    constructor(model, canvas) {
        this.model = model;
        this.canvas = canvas;
        this.context2d = canvas.getContext('2d');
        this.canvasBuffer = this.context2d.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.depthBuffer = Array();
        this.depthBuffer.length = this.canvas.width * this.canvas.height;
        this.camera = new Camera(new Vertex(0, 0, -800), Mat4.Identity4x4);
        this.transform = Mat4.Identity4x4;
        this.scale = 1.0;
        this.textureFront = new Texture('front', this);
        this.textureBack = new Texture('back', this);
        this.initPerspective();
        // Resize
        (globalThis.window || globalThis).addEventListener('resize', () => {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            this.depthBuffer.length = this.canvas.width * this.canvas.height;
            this.initPerspective();
            this.render();
        });
    }
    AMBIENT = 0;
    POINT = 1;
    DIRECTIONAL = 2;
    viewportSize = 1;
    projectionPlaneZ = 2;
    lights = [
        new Light(this.AMBIENT, 0.2),
        new Light(this.DIRECTIONAL, 0.2, new Vertex(0, 0, -800)),
        new Light(this.POINT, 0.2, new Vertex(-3, 2, -800))
    ];
    triangles = Array();
    vertices = Array();
    putPixel(x, y, color) {
        x = this.canvas.width / 2 + (x | 0);
        y = this.canvas.height / 2 - (y | 0) - 1;
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {return;}
        let offset = 4 * (x + this.canvasBuffer.width * y);
        this.canvasBuffer.data[offset++] = color.r;
        this.canvasBuffer.data[offset++] = color.g;
        this.canvasBuffer.data[offset++] = color.b;
        this.canvasBuffer.data[offset++] = 255; // Alpha = 255 (full opacity)
    }
    updateCanvas() {
        this.context2d.putImageData(this.canvasBuffer, 0, 0);
    }
    updateDepthBufferIfCloser(x, y, invZ) {
        x = this.canvas.width / 2 + (x | 0);
        y = this.canvas.height / 2 - (y | 0) - 1;
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            return false;
        }
        let offset = x + this.canvas.width * y;
        if (this.depthBuffer[offset] === undefined || this.depthBuffer[offset] < invZ) {
            this.depthBuffer[offset] = invZ;
            return true;
        }
        return false;
    }
    clearAll() {
        this.depthBuffer = Array();
        this.depthBuffer.length = this.canvas.width * this.canvas.height;
    }
    // Perspective and background
    initPerspective() {
        // Viewport
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        // Choose portrait or landscape
        const ratio = this.canvas.clientWidth / this.canvas.clientHeight;
        const fov = 40, near = 50, far = 1200;
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
        this.camera.clippingPlanes = [
            new Plane(new Vertex(0, 0, near), -1), // Near
            new Plane(new Vertex(left, 0, left), 0), // Left
            new Plane(new Vertex(-right, 0, right), 0), // Right
            new Plane(new Vertex(0, -top, top), 0), // Top
            new Plane(new Vertex(0, bottom, bottom), 0), // Bottom
        ];
    }
    render() {
        this.clearAll();
        let cameraMatrix = Mat4.MultiplyMM4(Mat4.Transposed(this.camera.orientation), Mat4.MakeTranslationMatrix(this.camera.position));
        let transform = Mat4.MultiplyMM4(cameraMatrix, this.transform);
        this.renderModel(this.model, this.camera, this.lights);
        this.updateCanvas();
    }
    makeTriangles(model){
        this.triangles = Array();
        const vtx = []; // vertex coords
        const fnr = []; // front normals coords
        const ftx = []; // front texture coords
        const btx = []; // back texture coords
        // Textures dimensions defaults
        const wTexFront = 1,hTexFront = 1,wTexBack = 1,hTexBack = 1;
        // Faces with FAN
        let index = 1;
        const front = new Color(0, 0, 128);
        const back = new Color(128, 128, 0);
        for (let f of model.faces) {
            const pts = f.points;
            const n = normal(pts); // Normal for face

            for (let i = 1; i < pts.length - 1; i++) {
                // First point with offset
                vtx.push(new Vertex4( pts[0].x + f.offset * n[0], pts[0].y + f.offset * n[1], pts[0].z + f.offset * n[2]));
                fnr.push(new Vertex(n[0], n[1], n[2]));
                // Texture at first point of triangle
                ftx.push((200 + pts[0].xf) / wTexFront);
                ftx.push((200 + pts[0].yf) / hTexFront);
                btx.push((200 + pts[0].xf) / wTexBack);
                btx.push((200 + pts[0].yf) / hTexBack);

                // Two other points: i and i+1
                vtx.push(new Vertex4(pts[i].x + f.offset * n[0], pts[i].y + f.offset * n[1], pts[i].z + f.offset * n[2]));
                fnr.push(new Vertex(n[0], n[1], n[2]));

                // Second point of triangle
                vtx.push(new Vertex4(pts[i + 1].x + f.offset * n[0], pts[i + 1].y + f.offset * n[1], pts[i + 1].z + f.offset * n[2]));
                fnr.push(new Vertex(n[0], n[1], n[2]));

                // Texture at second point of triangle
                ftx.push((200 + pts[i].xf) / wTexFront);
                ftx.push((200 + pts[i].yf) / hTexFront);
                btx.push((200 + pts[i].xf) / wTexBack);
                btx.push((200 + pts[i].yf) / hTexBack);

                // Texture at third point of triangle
                ftx.push((200 + pts[i + 1].xf) / wTexFront);
                ftx.push((200 + pts[i + 1].yf) / hTexFront);
                btx.push((200 + pts[i + 1].xf) / wTexBack);
                btx.push((200 + pts[i + 1].yf) / hTexBack);

                //         this.indexes = indexes;
                //         this.color = color;
                //         this.normals = normals;
                //         this.texture = texture;
                //         this.uvs = uvs;
                this.triangles.push(new Triangle([0, index, index+1], fnr, ftx ));
                this.triangles.push(new Triangle([0, index+1, index], fnr, btx ));
                index++;
                // this.triangles.push(new Triangle([0, index++, index++], color, bnr ));
            }
        }
        return vtx;

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
            const sq = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
            n[0] /= sq;
            n[1] /= sq;
            n[2] /= sq;
            return n;
        }
    }
    renderTriangle(triangle, points, projected, camera, lights) {
        let normal2, normal1, normal0;
        let uz02, vz02, vz012, uz012;
        let texture = this.textureFront;
        // Compute triangle normal. Use the unsorted points, otherwise the winding of the points may change.
        let normal = this.computeTriangleNormal(points[triangle.indexes[0]], points[triangle.indexes[1]], points[triangle.indexes[2]]);
        // Backface culling.
        if (normal.z <= 0) {
            // console.log("backface culling:", normal.z);
            texture = this.textureFront;
        } else {
            texture = this.textureBack;
        }
        // Sort by projected point Y.
        let indexes = this.sortedVertexIndexes(triangle.indexes, projected);
        let [i0, i1, i2] = indexes;
        let [v0, v1, v2] = [points[triangle.indexes[i0]], points[triangle.indexes[i1]], points[triangle.indexes[i2]]];
        // Get attribute values (X, 1/Z) at the points.
        let p0 = projected[triangle.indexes[i0]];
        let p1 = projected[triangle.indexes[i1]];
        let p2 = projected[triangle.indexes[i2]];
        // Compute attribute values at the edges.
        let [x02, x012] = this.edgeInterpolate(p0.y, p0.x, p1.y, p1.x, p2.y, p2.x);
        let [iz02, iz012] = this.edgeInterpolate(p0.y, 1.0 / v0.z, p1.y, 1.0 / v1.z, p2.y, 1.0 / v2.z);
            [uz02, uz012] = this.edgeInterpolate(p0.y, triangle.uvs[i0].x / v0.z,
                p1.y, triangle.uvs[i1].x / v1.z,
                p2.y, triangle.uvs[i2].x / v2.z);
            [vz02, vz012] = this.edgeInterpolate(p0.y, triangle.uvs[i0].y / v0.z,
                p1.y, triangle.uvs[i1].y / v1.z,
                p2.y, triangle.uvs[i2].y / v2.z);

        let transform = Mat4.Transposed(camera.orientation);
        normal0 = Mat4.MultiplyMV(transform, new Vertex4(triangle.normals[i0]));
        normal1 = Mat4.MultiplyMV(transform, new Vertex4(triangle.normals[i1]));
        normal2 = Mat4.MultiplyMV(transform, new Vertex4(triangle.normals[i2]));
        let intensity;
        let nx02, nx012, ny02, ny012, nz02, nz012, xLeft, xRight;
        // Phong shading: interpolate normal vectors.
        [nx02, nx012] = this.edgeInterpolate(p0.y, normal0.x, p1.y, normal1.x, p2.y, normal2.x);
        [ny02, ny012] = this.edgeInterpolate(p0.y, normal0.y, p1.y, normal1.y, p2.y, normal2.y);
        [nz02, nz012] = this.edgeInterpolate(p0.y, normal0.z, p1.y, normal1.z, p2.y, normal2.z);
        // Determine which is left and which is right.
        let m = (x02.length / 2) | 0;
        let izLeft, izRight, nxLeft, nxRight, nyLeft, nyRight, nzLeft, nzRight, uzLeft, uzRight,
            vzLeft, vzRight;
        if (x02[m] < x012[m]) {
            [xLeft, xRight] = [x02, x012];
            [izLeft, izRight] = [iz02, iz012];
            [nxLeft, nxRight] = [nx02, nx012];
            [nyLeft, nyRight] = [ny02, ny012];
            [nzLeft, nzRight] = [nz02, nz012];
            [uzLeft, uzRight] = [uz02, uz012];
            [vzLeft, vzRight] = [vz02, vz012];
        } else {
            [xLeft, xRight] = [x012, x02];
            [izLeft, izRight] = [iz012, iz02];
            [nxLeft, nxRight] = [nx012, nx02];
            [nyLeft, nyRight] = [ny012, ny02];
            [nzLeft, nzRight] = [nz012, nz02];
            [uzLeft, uzRight] = [uz012, uz02];
            [vzLeft, vzRight] = [vz012, vz02];
        }
        // Draw horizontal segments.
        let xl, xr, zl, zr, nxl, nxr, nyl, nyr, nzl, nzr;
        let nxScan, nyScan, nzScan, uzScan, vzScan;
        for (let y = p0.y; y <= p2.y; y++) {
            [xl, xr] = [xLeft[y - p0.y] | 0, xRight[y - p0.y] | 0];
            // interpolate attributes for this scanline.
            [zl, zr] = [izLeft[y - p0.y], izRight[y - p0.y]];
            let zScan = this.interpolate(xl, zl, xr, zr);
            [nxl, nxr] = [nxLeft[y - p0.y], nxRight[y - p0.y]];
            [nyl, nyr] = [nyLeft[y - p0.y], nyRight[y - p0.y]];
            [nzl, nzr] = [nzLeft[y - p0.y], nzRight[y - p0.y]];
            nxScan = this.interpolate(xl, nxl, xr, nxr);
            nyScan = this.interpolate(xl, nyl, xr, nyr);
            nzScan = this.interpolate(xl, nzl, xr, nzr);
                uzScan = this.interpolate(xl, uzLeft[y - p0.y], xr, uzRight[y - p0.y]);
                vzScan = this.interpolate(xl, vzLeft[y - p0.y], xr, vzRight[y - p0.y]);
            for (let x = xl; x <= xr; x++) {
                let invZ = zScan[x - xl];
                if (this.updateDepthBufferIfCloser(x, y, invZ)) {
                    // Phong Shading
                    let vertex = this.unProjectVertex(x, y, invZ);
                    let normal = new Vertex(nxScan[x - xl], nyScan[x - xl], nzScan[x - xl]);
                    intensity =  this.computeIllumination(vertex, normal, camera, lights);
                    let color, u, v;
                        u = uzScan[x - xl] / zScan[x - xl];
                        v = vzScan[x - xl] / zScan[x - xl];
                        color = texture.getTexel(u, v);
                        if(y === p0.y && x === xl)console.log('color', color, intensity);
                    this.putPixel(x, y, color.mul(intensity));
                }
            }
        }
    }
    interpolate(i0, d0, i1, d1) {
        if (i0 === i1) {
            return [d0];
        }
        let values = [];
        let a = (d1 - d0) / (i1 - i0);
        let d = d0;
        for (let i = i0; i <= i1; i++) {
            values.push(d);
            d += a;
        }
        return values;
    }
    viewportToCanvas(p2d) {
        return new Pt(
            p2d.x * this.canvas.width / this.viewportSize | 0,
            p2d.y * this.canvas.height / this.viewportSize | 0);
    }
    // Converts 2D canvas coordinates to 2D viewport coordinates.
    canvasToViewport(p2d) {
        return new Pt(
            p2d.x * this.viewportSize / this.canvas.width,
            p2d.y * this.viewportSize / this.canvas.height);
    }
    projectVertex(v) {
        return this.viewportToCanvas(new Pt(
            v.x * this.projectionPlaneZ / (v.z + 1000),
            v.y * this.projectionPlaneZ / (v.z + 1000)));
    }
    unProjectVertex(x, y, invZ) {
        let oz = 1.0 / invZ;
        let ux = x * oz / this.projectionPlaneZ;
        let uy = y * oz / this.projectionPlaneZ;
        let p2d = this.canvasToViewport(new Pt(ux, uy));
        return new Vertex(p2d.x, p2d.y, oz);
    }
    // Sort the indexes to the vertex indexes in the triangle from bottom to top.
    sortedVertexIndexes(vertexIndexes, projected) {
        let indexes = [0, 1, 2];
        if (projected[vertexIndexes[indexes[1]]].y < projected[vertexIndexes[indexes[0]]].y) {
            let swap = indexes[0];
            indexes[0] = indexes[1];
            indexes[1] = swap;
        }
        if (projected[vertexIndexes[indexes[2]]].y < projected[vertexIndexes[indexes[0]]].y) {
            let swap = indexes[0];
            indexes[0] = indexes[2];
            indexes[2] = swap;
        }
        if (projected[vertexIndexes[indexes[2]]].y < projected[vertexIndexes[indexes[1]]].y) {
            let swap = indexes[1];
            indexes[1] = indexes[2];
            indexes[2] = swap;
        }
        return indexes;
    }
    computeTriangleNormal(v0, v1, v2) {
        const v0v1 = v1.sub(v0);
        const v0v2 = v2.sub(v0);
        return v0v1.cross(v0v2);
    }
    computeIllumination(vertex, normal, camera, lights) {
        let illumination = 0;
        for (let l = 0; l < lights.length; l++) {
            let light = lights[l];
            if (light.type === this.AMBIENT) {
                illumination += light.intensity;
                continue;
            }

            let vl;
            if (light.type === this.DIRECTIONAL) {
                let cameraMatrix = Mat4.Transposed(camera.orientation);
                vl = Mat4.MultiplyMV(cameraMatrix, new Vertex4(light.vector));
            } else if (light.type === this.POINT) {
                let cameraMatrix = Mat4.MultiplyMM4(Mat4.Transposed(camera.orientation), Mat4.MakeTranslationMatrix(camera.position.mul(-1)));
                let transformedLight = Mat4.MultiplyMV(cameraMatrix, new Vertex4(light.vector));
                vl = vertex.mul(-1).add(transformedLight);
            }

            // Diffuse component.
            let cosAlpha = vl.dot(normal) / (vl.length() * normal.length());
            if (cosAlpha > 0) {
                illumination += cosAlpha * light.intensity;
            }

            // Specular component.
            let reflected = normal.mul(2 * normal.dot(vl)).sub(vl);
            let view = camera.position.sub(vertex);

            let cosBeta = reflected.dot(view) / (reflected.length() * view.length());
            if (cosBeta > 0) {
                let specular = 50;
                illumination += Math.pow(cosBeta, specular) * light.intensity;
            }
        }
        return illumination;
    }
    edgeInterpolate(y0, v0, y1, v1, y2, v2) {
        let v01 = this.interpolate(y0, v0, y1, v1);
        let v12 = this.interpolate(y1, v1, y2, v2);
        let v02 = this.interpolate(y0, v0, y2, v2);
        v01.pop();
        let v012 = v01.concat(v12);
        return [v02, v012];
    }
    clipTriangle(triangle, plane, triangles, points) {
        let v0 = points[triangle.indexes[0]];
        let v1 = points[triangle.indexes[1]];
        let v2 = points[triangle.indexes[2]];

        let in0 = plane.normal.dot(v0) + plane.distance > 0;
        let in1 = plane.normal.dot(v1) + plane.distance > 0;
        let in2 = plane.normal.dot(v2) + plane.distance > 0;

        let inCount = in0 + in1 + in2;
        if (inCount === 0) {
            // Nothing to do - the triangle is fully clipped out.
        } else if (inCount === 3) {
            // The triangle is fully in front of the plane.
            triangles.push(triangle);
        } else if (inCount === 1) {
            // The triangle has one vertex in. Output is one clipped triangle.
        } else if (inCount === 2) {
            // The triangle has two points in. Output is two clipped triangles.
        }
    }
    transformAndClip(clippingPlanes, model, scale, transform) {
        // Transform the bounding sphere, and attempt early discard.
        let center = Mat4.MultiplyMV(transform, new Vertex4(0,0,0,1));
        let radius = 200 * scale;
        for (let p = 0; p < clippingPlanes.length; p++) {
            let distance = clippingPlanes[p].normal.dot(center) + clippingPlanes[p].distance;
            if (distance < -radius) {
                return null;
            }
        }
        // Apply modelView transform.
        let points = [];
        for (let i = 0; i < model.points.length; i++) {
            points.push(Mat4.MultiplyMV(transform, new Vertex4(model.points[i])));
        }
        // Clip the entire model against each successive plane.
        let triangles = this.triangles.slice();
        for (let p = 0; p < clippingPlanes.length; p++) {
            let newTriangles = []
            for (let i = 0; i < triangles.length; i++) {
                this.clipTriangle(triangles[i], clippingPlanes[p], newTriangles, points);
            }
            triangles = newTriangles;
        }
        return new Model(points, triangles, center, model.boundsRadius);
    }
    renderModel(model, camera, lights) {
        let cameraMatrix = Mat4.MultiplyMM4(Mat4.Transposed(camera.orientation), Mat4.MakeTranslationMatrix(camera.position.mul(-1)));
        let transform = Mat4.MultiplyMM4(cameraMatrix, this.transform);
        let clipped = this.transformAndClip(camera.clippingPlanes, this.model, this.scale, transform);

        let projected = [];
        for (let i = 0; i < model.points.length; i++) {
            projected.push(this.projectVertex(new Vertex4(model.points[i])));
            // console.log(`projected:[${i}]`, projected[i]);
        }
        let points = this.makeTriangles(this.model);
        // let points = Array.from(model.points, (p) => new Vertex4(p.x, p.y, p.z) );
        for (let i = 0; i < this.triangles.length; i++) {
            // console.log(`triangle:${i}`,i, camera.position);
            this.renderTriangle(this.triangles[i], points, projected, camera, lights);
        }
    }
    renderScene(camera, instances, lights) {
        let cameraMatrix = Mat4.MultiplyMM4(Mat4.Transposed(camera.orientation), Mat4.MakeTranslationMatrix(camera.position.mul(-1)));

        for (let i = 0; i < instances.length; i++) {
            let transform = Mat4.MultiplyMM4(cameraMatrix, instances[i].transform);
            let clipped = this.transformAndClip(camera.clippingPlanes, instances[i].model, instances[i].scale, transform);
            if (clipped != null) {
                this.renderModel(clipped, camera, lights, instances[i].orientation);
            }
        }
    }
}
class Pt {
    constructor(x, y, h) {
        this.x = x;
        this.y = y;
        this.h = h;
    }
}
class Color {
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    mul(n) {
        return new Color(this.r * n, this.g * n, this.b * n);
    }
}
class Light {
    constructor(type, intensity, vector) {
        this.type = type;
        this.intensity = intensity;
        this.vector = vector;
    }
}
class Texture {
    constructor(id, view3dSoft) {
        this.image = new Image();
        const yellow = new ImageData(1, 1);
        yellow.data.set([255, 255, 0, 255]); // Jaune
        for (let i = 0; i < yellow.data.length; i += 4) yellow.data.set([255, 255, 0, 255], i);

        const blue = new ImageData(1, 1);
        blue.data.set([255, 255, 255, 0]); // Bleu
        for (let i = 0; i < blue.data.length; i += 4) blue.data.set([0, 0, 255, 255], i);

        this.image.src = window.document.getElementById(id).src;
        let texture = this;
        this.image.onload =  () => {
            texture.iw = texture.image.width;
            texture.ih = texture.image.height;
            texture.canvas = document.createElement('canvas');
            texture.canvas.width = texture.iw;
            texture.canvas.height = texture.ih;
            let c2d = texture.canvas.getContext('2d');
            c2d.drawImage(texture.image, 0, 0, texture.iw, texture.ih);

            c2d.putImageData(yellow, 0, 0);
            texture.pixelData = c2d.getImageData(0, 0, texture.iw, texture.ih);
            view3dSoft.render();
        };
    }
    getTexel(u, v) {
        let iu = (u * this.iw) | 0;
        let iv = (v * this.ih) | 0;
        let offset = (iv * this.iw * 4 + iu * 4);
        if (this.pixelData === undefined) {
            return new Color(128, 0, 128);
        }
        return new Color(
            this.pixelData.data[offset],
            this.pixelData.data[offset + 1],
            this.pixelData.data[offset + 2]
        );
    }
}
class Vertex {
    constructor(x, y, z) {this.x = x;this.y = y;this.z = z;}
    add(v) {return new Vertex(this.x + v.x, this.y + v.y, this.z + v.z);}
    sub(v) {return new Vertex(this.x - v.x, this.y - v.y, this.z - v.z);}
    mul(n) {return new Vertex(this.x * n, this.y * n, this.z * n);}
    dot(vec) {return this.x * vec.x + this.y * vec.y + this.z * vec.z;}
    length() {return Math.sqrt(this.dot(this));}
}
class Vertex4 {
    constructor(arg1, y, z, w) {
        if (y === undefined) {this.x = arg1.x;this.y = arg1.y;this.z = arg1.z;this.w = arg1.w | 1;}
        else {this.x = arg1;this.y = y;this.z = z;this.w = w;}
    }
    add(v) {return new Vertex4(this.x + v.x, this.y + v.y, this.z + v.z);}
    sub(v) {return new Vertex4(this.x - v.x, this.y - v.y, this.z - v.z, this.w - v.w);}
    mul(n) {return new Vertex4(this.x * n, this.y * n, this.z * n, this.w);}
    dot(vec) {return this.x * vec.x + this.y * vec.y + this.z * vec.z;}
    cross(v2) {return new Vertex4(this.y * v2.z - this.z * v2.y, this.z * v2.x - this.x * v2.z, this.x * v2.y - this.y * v2.x);}
    length() {return Math.sqrt(this.dot(this));}
}
class Mat4 {
    constructor(data) {this.data = data;}
    static Identity4x4 = new Mat4([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
    // Makes a transform matrix for a rotation around the OY axis.
    static MakeOYRotationMatrix(degrees) {
        let cos = Math.cos(degrees * Math.PI / 180.0);
        let sin = Math.sin(degrees * Math.PI / 180.0);
        return new Mat4([[cos, 0, -sin, 0],
            [0, 1, 0, 0],
            [sin, 0, cos, 0],
            [0, 0, 0, 1]])
    }
    // Makes a transform matrix for a translation.
    static MakeTranslationMatrix(translation) {
        return new Mat4([[1, 0, 0, translation.x],
            [0, 1, 0, translation.y],
            [0, 0, 1, translation.z],
            [0, 0, 0, 1]]);
    }
    // Makes a transform matrix for a scaling.
    static MakeScalingMatrix(scale) {
        return new Mat4([[scale, 0, 0, 0],
            [0, scale, 0, 0],
            [0, 0, scale, 0],
            [0, 0, 0, 1]]);
    }
    static MultiplyMV(mat4, vec4) {
        let result = [0, 0, 0, 0];
        let vec = [vec4.x, vec4.y, vec4.z, vec4.w];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i] += mat4.data[i][j] * vec[j];
            }
        }
        return new Vertex4(result[0], result[1], result[2], result[3]);
    }
    static MultiplyMM4(matA, matB) {
        let result = new Mat4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    result.data[i][j] += matA.data[i][k] * matB.data[k][j];
                }
            }
        }
        return result;
    }
    static Transposed(mat) {
        let result = new Mat4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result.data[i][j] = mat.data[j][i];
            }
        }
        return result;
    }
}
class Triangle {
    constructor(indexes, normals = [], uvs = []) {
        this.indexes = indexes;
        this.normals = normals;
        this.uvs = uvs;
    }
}
class Camera {
    constructor(position, orientation) {
        this.position = position;
        this.orientation = orientation;
        this.clippingPlanes = [];
    }
}
class Plane {
    constructor(normal, distance) {
        this.normal = normal;
        this.distance = distance;
    }
}
// 621 lines
