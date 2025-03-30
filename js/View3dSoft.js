export class View3dSoft {
    constructor(model, canvas) {
        this.model = model;
        this.canvas = canvas;
        this.context2d = canvas.getContext('2d');
        this.canvasBuffer = this.context2d.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.depthBuffer = Array();
        this.depthBuffer.length = this.canvas.width * this.canvas.height;
    }
    AMBIENT = 0;
    POINT = 1;
    DIRECTIONAL = 2;
    viewportSize = 1;
    projectionPlaneZ = 1;
    lights = [
        new Light(this.AMBIENT, 0.2),
        new Light(this.DIRECTIONAL, 0.2, new Vertex(-1, 0, 1)),
        new Light(this.POINT, 0.6, new Vertex(-3, 2, -10))
    ];
    putPixel(x, y, color) {
        x = this.canvas.width / 2 + (x | 0);
        y = this.canvas.height / 2 - (y | 0) - 1;

        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            return;
        }

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
        // this.canvas.width = this.canvas.width;
        this.depthBuffer = Array();
        this.depthBuffer.length = this.canvas.width * this.canvas.height;
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
    render() {
        this.clearAll();
        this.renderScene(camera, instances, this.lights);
        this.updateCanvas();
    }
    renderTriangle(triangle, vertices, projected, camera, lights, orientation) {
        let normal2, normal1, normal0;
        let uz02, vz02, vz012, uz012;
        // Compute triangle normal. Use the unsorted vertices, otherwise the winding of the points may change.
        let normal = this.computeTriangleNormal(vertices[triangle.indexes[0]], vertices[triangle.indexes[1]], vertices[triangle.indexes[2]]);
        // Backface culling.
        let vertexToCamera = vertices[triangle.indexes[0]].mul(-1);
        if (vertexToCamera.dot(normal) <= 0) {
            return;
        }
        // Sort by projected point Y.
        let indexes = this.sortedVertexIndexes(triangle.indexes, projected);
        let [i0, i1, i2] = indexes;
        let [v0, v1, v2] = [vertices[triangle.indexes[i0]], vertices[triangle.indexes[i1]], vertices[triangle.indexes[i2]]];
        // Get attribute values (X, 1/Z) at the vertices.
        let p0 = projected[triangle.indexes[i0]];
        let p1 = projected[triangle.indexes[i1]];
        let p2 = projected[triangle.indexes[i2]];

        // Compute attribute values at the edges.
        let [x02, x012] = this.edgeInterpolate(p0.y, p0.x, p1.y, p1.x, p2.y, p2.x);
        let [iz02, iz012] = this.edgeInterpolate(p0.y, 1.0 / v0.z, p1.y, 1.0 / v1.z, p2.y, 1.0 / v2.z);
        if (triangle.texture) {
            if (this.UsePerspectiveCorrectDepth) {
                [uz02, uz012] = this.edgeInterpolate(p0.y, triangle.uvs[i0].x / v0.z,
                    p1.y, triangle.uvs[i1].x / v1.z,
                    p2.y, triangle.uvs[i2].x / v2.z);
                [vz02, vz012] = this.edgeInterpolate(p0.y, triangle.uvs[i0].y / v0.z,
                    p1.y, triangle.uvs[i1].y / v1.z,
                    p2.y, triangle.uvs[i2].y / v2.z);
            } else {
                [uz02, uz012] = this.edgeInterpolate(p0.y, triangle.uvs[i0].x,
                    p1.y, triangle.uvs[i1].x,
                    p2.y, triangle.uvs[i2].x);
                [vz02, vz012] = this.edgeInterpolate(p0.y, triangle.uvs[i0].y,
                    p1.y, triangle.uvs[i1].y,
                    p2.y, triangle.uvs[i2].y);
            }
        }
        if (this.UseVertexNormals) {
            let transform = Mat4.MultiplyMM4(Mat4.Transposed(camera.orientation), orientation);
            normal0 = Mat4.MultiplyMV(transform, new Vertex4(triangle.normals[i0]));
            normal1 = Mat4.MultiplyMV(transform, new Vertex4(triangle.normals[i1]));
            normal2 = Mat4.MultiplyMV(transform, new Vertex4(triangle.normals[i2]));
        } else {
            normal0 = normal;
            normal1 = normal;
            normal2 = normal;
        }
        let intensity;
        let i02, i012, nx02, nx012, ny02, ny012, nz02, nz012, xLeft, xRight;
        if (this.ShadingModel === this.FLAT) {
            // Flat shading: compute lighting for the entire triangle.
            let center = new Vertex((v0.x + v1.x + v2.x) / 3.0, (v0.y + v1.y + v2.y) / 3.0, (v0.z + v1.z + v2.z) / 3.0);
            intensity = this.computeIllumination(center, normal0, camera, lights);
        } else if (this.ShadingModel === this.GOURAUD) {
            // Gouraud shading: compute lighting at the vertices, and interpolate.
            let i0 = this.computeIllumination(v0, normal0, camera, lights);
            let i1 = this.computeIllumination(v1, normal1, camera, lights);
            let i2 = this.computeIllumination(v2, normal2, camera, lights);
            [i02, i012] = this.edgeInterpolate(p0.y, i0, p1.y, i1, p2.y, i2);
        } else if (this.ShadingModel === this.PHONG) {
            // Phong shading: interpolate normal vectors.
            [nx02, nx012] = this.edgeInterpolate(p0.y, normal0.x, p1.y, normal1.x, p2.y, normal2.x);
            [ny02, ny012] = this.edgeInterpolate(p0.y, normal0.y, p1.y, normal1.y, p2.y, normal2.y);
            [nz02, nz012] = this.edgeInterpolate(p0.y, normal0.z, p1.y, normal1.z, p2.y, normal2.z);
        }
        // Determine which is left and which is right.
        let m = (x02.length / 2) | 0;
        let izLeft, izRight, iLeft, iRight, nxLeft, nxRight, nyLeft, nyRight, nzLeft, nzRight, uzLeft, uzRight,
            vzLeft, vzRight;
        if (x02[m] < x012[m]) {
            [xLeft, xRight] = [x02, x012];
            [izLeft, izRight] = [iz02, iz012];
            [iLeft, iRight] = [i02, i012];

            [nxLeft, nxRight] = [nx02, nx012];
            [nyLeft, nyRight] = [ny02, ny012];
            [nzLeft, nzRight] = [nz02, nz012];

            [uzLeft, uzRight] = [uz02, uz012];
            [vzLeft, vzRight] = [vz02, vz012];
        } else {
            [xLeft, xRight] = [x012, x02];
            [izLeft, izRight] = [iz012, iz02];
            [iLeft, iRight] = [i012, i02];

            [nxLeft, nxRight] = [nx012, nx02];
            [nyLeft, nyRight] = [ny012, ny02];
            [nzLeft, nzRight] = [nz012, nz02];

            [uzLeft, uzRight] = [uz012, uz02];
            [vzLeft, vzRight] = [vz012, vz02];
        }

        // Draw horizontal segments.
        let xl, xr, zl, zr, il, ir, nxl, nxr, nyl, nyr, nzl, nzr;
        let iScan, nxScan, nyScan, nzScan, uzScan, vzScan;
        for (let y = p0.y; y <= p2.y; y++) {
            [xl, xr] = [xLeft[y - p0.y] | 0, xRight[y - p0.y] | 0];

            // interpolate attributes for this scanline.
            [zl, zr] = [izLeft[y - p0.y], izRight[y - p0.y]];
            let zScan = this.interpolate(xl, zl, xr, zr);

            if (this.ShadingModel === this.GOURAUD) {
                [il, ir] = [iLeft[y - p0.y], iRight[y - p0.y]];
                iScan = this.interpolate(xl, il, xr, ir);
            } else if (this.ShadingModel === this.PHONG) {
                [nxl, nxr] = [nxLeft[y - p0.y], nxRight[y - p0.y]];
                [nyl, nyr] = [nyLeft[y - p0.y], nyRight[y - p0.y]];
                [nzl, nzr] = [nzLeft[y - p0.y], nzRight[y - p0.y]];

                nxScan = this.interpolate(xl, nxl, xr, nxr);
                nyScan = this.interpolate(xl, nyl, xr, nyr);
                nzScan = this.interpolate(xl, nzl, xr, nzr);
            }
            if (triangle.texture) {
                uzScan = this.interpolate(xl, uzLeft[y - p0.y], xr, uzRight[y - p0.y]);
                vzScan = this.interpolate(xl, vzLeft[y - p0.y], xr, vzRight[y - p0.y]);
            }
            for (let x = xl; x <= xr; x++) {
                let invZ = zScan[x - xl];
                if (this.updateDepthBufferIfCloser(x, y, invZ)) {

                    if (this.ShadingModel === this.FLAT) {
                        // Just use the per-triangle intensity.
                    } else if (this.ShadingModel === this.GOURAUD) {
                        intensity = iScan[x - xl];
                    } else if (this.ShadingModel === this.PHONG) {
                        let vertex = this.unProjectVertex(x, y, invZ);
                        let normal = new Vertex(nxScan[x - xl], nyScan[x - xl], nzScan[x - xl]);
                        intensity =  this.computeIllumination(vertex, normal, camera, lights);
                    }
                    let color, u, v;
                    if (triangle.texture) {
                        if (this.UsePerspectiveCorrectDepth) {
                            u = uzScan[x - xl] / zScan[x - xl];
                            v = vzScan[x - xl] / zScan[x - xl];
                        } else {
                            u = uzScan[x - xl];
                            v = vzScan[x - xl];
                        }
                        color = triangle.texture.getTexel(u, v);
                    } else {
                        color = triangle.color;
                    }
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
            v.x * this.projectionPlaneZ / v.z,
            v.y * this.projectionPlaneZ / v.z));
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
        let v0v1 = v1.sub(v0);
        let v0v2 = v2.sub(v0);
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
    FLAT = 0;
    GOURAUD = 1;
    PHONG = 2;
    ShadingModel = this.PHONG;
    UseVertexNormals = true;
    UsePerspectiveCorrectDepth = true;
    edgeInterpolate(y0, v0, y1, v1, y2, v2) {
        let v01 = this.interpolate(y0, v0, y1, v1);
        let v12 = this.interpolate(y1, v1, y2, v2);
        let v02 = this.interpolate(y0, v0, y2, v2);
        v01.pop();
        let v012 = v01.concat(v12);
        return [v02, v012];
    }
    clipTriangle(triangle, plane, triangles, vertices) {
        let v0 = vertices[triangle.indexes[0]];
        let v1 = vertices[triangle.indexes[1]];
        let v2 = vertices[triangle.indexes[2]];

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
            // The triangle has two vertices in. Output is two clipped triangles.
        }
    }
    transformAndClip(clippingPlanes, model, scale, transform) {
        // Transform the bounding sphere, and attempt early discard.
        let center = Mat4.MultiplyMV(transform, new Vertex4(model.boundsCenter));
        let radius = model.boundsRadius * scale;
        for (let p = 0; p < clippingPlanes.length; p++) {
            let distance = clippingPlanes[p].normal.dot(center) + clippingPlanes[p].distance;
            if (distance < -radius) {
                return null;
            }
        }
        // Apply modelView transform.
        let vertices = [];
        for (let i = 0; i < model.vertices.length; i++) {
            vertices.push(Mat4.MultiplyMV(transform, new Vertex4(model.vertices[i])));
        }
        // Clip the entire model against each successive plane.
        let triangles = model.triangles.slice();
        for (let p = 0; p < clippingPlanes.length; p++) {
            let newTriangles = []
            for (let i = 0; i < triangles.length; i++) {
                this.clipTriangle(triangles[i], clippingPlanes[p], newTriangles, vertices);
            }
            triangles = newTriangles;
        }
        return new Model(vertices, triangles, center, model.boundsRadius);
    }
    renderModel(model, camera, lights, orientation) {
        let projected = [];
        for (let i = 0; i < model.vertices.length; i++) {
            projected.push(this.projectVertex(new Vertex4(model.vertices[i])));
        }
        for (let i = 0; i < model.triangles.length; i++) {
            this.renderTriangle(model.triangles[i], model.vertices, projected, camera, lights, orientation);
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
    constructor(url) {
        this.image = new Image();
        this.image.src = url;
        let texture = this;
        this.image.onload =  () => {
            texture.iw = texture.image.width;
            texture.ih = texture.image.height;
            texture.canvas = document.createElement('canvas');
            texture.canvas.width = texture.iw;
            texture.canvas.height = texture.ih;
            let c2d = texture.canvas.getContext('2d');
            c2d.drawImage(texture.image, 0, 0, texture.iw, texture.ih);
            texture.pixelData = c2d.getImageData(0, 0, texture.iw, texture.ih);
        };
    }
    getTexel(u, v) {
        let iu = (u * this.iw) | 0;
        let iv = (v * this.ih) | 0;
        let offset = (iv * this.iw * 4 + iu * 4);
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
    constructor(indexes, color, normals = [], texture = null, uvs = []) {
        this.indexes = indexes;
        this.color = color;
        this.normals = normals;
        this.texture = texture;
        this.uvs = uvs;
    }
}
class Model {
    constructor(vertices, triangles, boundsCenter, boundsRadius) {
        this.vertices = vertices;
        this.triangles = triangles;
        this.boundsCenter = boundsCenter;
        this.boundsRadius = boundsRadius;
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

// ----- Cube model -----
const vertices = [
    new Vertex(1, 1, 1),
    new Vertex(-1, 1, 1),
    new Vertex(-1, -1, 1),
    new Vertex(1, -1, 1),
    new Vertex(1, 1, -1),
    new Vertex(-1, 1, -1),
    new Vertex(-1, -1, -1),
    new Vertex(1, -1, -1)
];
const RED = new Color(255, 0, 0);
const GREEN = new Color(0, 255, 0);
const BLUE = new Color(0, 0, 255);
const YELLOW = new Color(255, 255, 0);
const PURPLE = new Color(255, 0, 255);
const CYAN = new Color(0, 255, 255);
const texture = new Texture('textures/front.jpg');
const triangles = [
    new Triangle([0, 1, 2], RED, [new Vertex(0, 0, 1), new Vertex(0, 0, 1), new Vertex(0, 0, 1)], texture, [new Pt(0, 0), new Pt(1, 0), new Pt(1, 1)]),
    new Triangle([0, 2, 3], RED, [new Vertex(0, 0, 1), new Vertex(0, 0, 1), new Vertex(0, 0, 1)], texture, [new Pt(0, 0), new Pt(1, 1), new Pt(0, 1)]),
    new Triangle([4, 0, 3], GREEN, [new Vertex(1, 0, 0), new Vertex(1, 0, 0), new Vertex(1, 0, 0)], texture, [new Pt(0, 0), new Pt(1, 0), new Pt(1, 1)]),
    new Triangle([4, 3, 7], GREEN, [new Vertex(1, 0, 0), new Vertex(1, 0, 0), new Vertex(1, 0, 0)], texture, [new Pt(0, 0), new Pt(1, 1), new Pt(0, 1)]),
    new Triangle([5, 4, 7], BLUE, [new Vertex(0, 0, -1), new Vertex(0, 0, -1), new Vertex(0, 0, -1)], texture, [new Pt(0, 0), new Pt(1, 0), new Pt(1, 1)]),
    new Triangle([5, 7, 6], BLUE, [new Vertex(0, 0, -1), new Vertex(0, 0, -1), new Vertex(0, 0, -1)], texture, [new Pt(0, 0), new Pt(1, 1), new Pt(0, 1)]),
    new Triangle([1, 5, 6], YELLOW, [new Vertex(-1, 0, 0), new Vertex(-1, 0, 0), new Vertex(-1, 0, 0)], texture, [new Pt(0, 0), new Pt(1, 0), new Pt(1, 1)]),
    new Triangle([1, 6, 2], YELLOW, [new Vertex(-1, 0, 0), new Vertex(-1, 0, 0), new Vertex(-1, 0, 0)], texture, [new Pt(0, 0), new Pt(1, 1), new Pt(0, 1)]),
    new Triangle([1, 0, 5], PURPLE, [new Vertex(0, 1, 0), new Vertex(0, 1, 0), new Vertex(0, 1, 0)], texture, [new Pt(0, 0), new Pt(1, 0), new Pt(1, 1)]),
    new Triangle([5, 0, 4], PURPLE, [new Vertex(0, 1, 0), new Vertex(0, 1, 0), new Vertex(0, 1, 0)], texture, [new Pt(0, 1), new Pt(1, 1), new Pt(0, 0)]),
    new Triangle([2, 6, 7], CYAN, [new Vertex(0, -1, 0), new Vertex(0, -1, 0), new Vertex(0, -1, 0)], texture, [new Pt(0, 0), new Pt(1, 0), new Pt(1, 1)]),
    new Triangle([2, 7, 3], CYAN, [new Vertex(0, -1, 0), new Vertex(0, -1, 0), new Vertex(0, -1, 0)], texture, [new Pt(0, 0), new Pt(1, 1), new Pt(0, 1)]),
];
const cube = new Model(vertices, triangles, new Vertex(0, 0, 0), Math.sqrt(3));
// ----------
const view3dSoft = new View3dSoft(null, window.document.getElementById("canvas"));
class Instance {
    constructor(model, position, orientation, scale){
        this.model = model;
        this.position = position;
        this.orientation = orientation ?? Mat4.Identity4x4;
        this.scale = scale ?? 1.0;
        this.transform = Mat4.MultiplyMM4(Mat4.MakeTranslationMatrix(this.position), Mat4.MultiplyMM4(this.orientation, Mat4.MakeScalingMatrix(this.scale)));
    }
}
const instances = [
    new Instance(cube, new Vertex(-1.5, 0, 7), Mat4.Identity4x4, 0.75),
    new Instance(cube, new Vertex(1.25, 2.5, 7.5), Mat4.MakeOYRotationMatrix(195)),
    new Instance(cube, new Vertex(1.75, 0, 5), Mat4.MakeOYRotationMatrix(-30)),
];
const camera = new Camera(new Vertex(-3, 1, 2), Mat4.MakeOYRotationMatrix(-30));
let s2 = 1.0 / Math.sqrt(2);
camera.clippingPlanes = [
    new Plane(new Vertex(0, 0, 1), -1), // Near
    new Plane(new Vertex(s2, 0, s2), 0), // Left
    new Plane(new Vertex(-s2, 0, s2), 0), // Right
    new Plane(new Vertex(0, -s2, s2), 0), // Top
    new Plane(new Vertex(0, s2, s2), 0), // Bottom
];
view3dSoft.render();
// 612 lines
