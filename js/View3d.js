// View3dWebGL
// Inspired by https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Lighting_in_WebGL Sample 7
// No uNormalMatrix but vLightingBack
import * as mat4 from './lib/mat4.js';
import { Vector3 } from './Vector3.js';

export class View3d {
    // Vertex shader program
    VERTEX_SHADER = `#version 300 es
    precision highp float;
    
    in vec4 aVertexPosition;
    in vec3 aVertexNormal;
    in vec2 aTexCoordsFront;
    in vec2 aTexCoordsBack;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    out highp vec2 vTexCoordsFront;
    out highp vec2 vTexCoordsBack;
    out highp vec3 vLighting;
    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vTexCoordsFront = aTexCoordsFront;
        vTexCoordsBack  = aTexCoordsBack;
        highp vec3 directionalVector =  normalize(vec3(0.1, 0.1, 0.75)); // normalize(vec3(0.85, 0.8, 0.75));
        highp vec4 normal = normalize(uModelViewMatrix * vec4(aVertexNormal, 0.0));
        float directional = dot(normal.xyz, directionalVector);
        vLighting = vec3(0.1) + directional;
    }
    `;

    // Fragment shader program
    FRAGMENT_SHADER = `#version 300 es
        precision highp float;
        
        in highp vec2 vTexCoordsFront;
        in highp vec2 vTexCoordsBack;
        in highp vec3 vLighting;
                
        uniform sampler2D uSamplerFront;
        uniform sampler2D uSamplerBack;
        uniform bool uLine; 
        out vec4 outColor; 
        void main(void) {
            highp vec4 texelColor;
            highp vec3 lighting = vLighting;
            if (uLine) {
                texelColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else if (gl_FrontFacing) {
                texelColor = texture(uSamplerFront, vTexCoordsFront);
            } else {
                texelColor = texture(uSamplerBack,  vTexCoordsBack);
                lighting = vec3(0.1) - vLighting;            
            }
            outColor = vec4(texelColor.rgb * lighting, texelColor.a);
        }
    `;

    // Current rotation angle (x-axis, y-axis degrees)
    angleX = 0;
    angleY = 0;
    angleZ = 0;
    translationX = 0;
    translationY = 0;
    scale = 1;

    // Projection and model view matrix
    projection = new Float32Array(16);
    modelView = new Float32Array(16);
    canvasView = new Float32Array(16);

    // Textures dimensions defaults
    wTexFront = 1;
    hTexFront = 1;
    wTexBack = 1;
    hTexBack = 1;

    // WebGL Textures
    texPlaceholderFront = null;
    texImageFront = null;
    texPlaceholderBack = null;
    texImageBack = null;

    // Arrays
    vtx = []; // vertex coords
    ftx = []; // front texture coords
    btx = []; // back texture coords
    fnr = []; // front normals coords
    lin = []; // lines indices

    // WebGL Buffers
    vtxBuffer = null;
    fnrBuffer = null;
    ftxBuffer = null;
    btxBuffer = null;
    linBuffer = null;
    vao = null;

    constructor(model, canvas3d, overlay = null) {
        // Instance variables
        this.model = model;
        this.canvas3d = canvas3d;
        this.overlay = overlay;
        this.gl = canvas3d.getContext('webgl2');

        this.initShaders();
        this.initTextures();
        this.initPerspective();
        this.initModelView();

        // Resize
        globalThis.addEventListener('resize', () => {
            this.initPerspective();
            this.initModelView();
            this.render();
        });
    }

    // Shaders
    initShaders() {
        // Vertex
        const gl = this.gl;
        const vxShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vxShader, this.VERTEX_SHADER);
        gl.compileShader(vxShader);
        if (!gl.getShaderParameter(vxShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vxShader));
        }
        // Fragment
        const fgShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fgShader, this.FRAGMENT_SHADER);
        gl.compileShader(fgShader);
        if (!gl.getShaderParameter(fgShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fgShader));
        }
        // Create the shader program
        const program = gl.createProgram();
        gl.attachShader(program, vxShader);
        gl.attachShader(program, fgShader);
        gl.linkProgram(program);
        this.checkErrors(gl, program, vxShader, fgShader);

        // Use it and copy it in an attribute of gl
        gl.useProgram(program);
        gl.program = program;
        this.checkErrors(gl, program, vxShader, fgShader);
    }

    checkErrors(gl, program, glVertexShader, glFragmentShader) {
        const programLog = gl.getProgramInfoLog(program).trim();
        const vertexLog = gl.getShaderInfoLog(glVertexShader).trim();
        const fragmentLog = gl.getShaderInfoLog(glFragmentShader).trim();
        if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
            console.error('Shader Error ' + gl.getError() + ' - ' + 'VALIDATE_STATUS ' + gl.getProgramParameter(program, 35715) + '\n\n' + 'Program Info Log: ' + programLog + '\n' + vertexLog + '\n' + fragmentLog);
        }
    }

    // Textures
    initTextures() {
        const gl = this.gl;

        // Front placeholder (Blue 70ACF3)
        this.texPlaceholderFront = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texPlaceholderFront);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0x70, 0xAC, 0xF3, 255]));

        // Front image texture (defaults to blue placeholder until loaded)
        this.texImageFront = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texImageFront);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0x70, 0xAC, 0xF3, 255]));

        const imageFront = new Image();
        const imageElement = globalThis.document.getElementById('front');
        if (imageElement?.src) {
            imageFront.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, this.texImageFront);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, imageFront);
                this.wTexFront = imageFront.width;
                this.hTexFront = imageFront.height;
                this.initBuffers();
                this.render();
            };
            imageFront.src = imageElement.src;
        } else {
            this.wTexFront = 1;
            this.hTexFront = 1;
        }

        // Back placeholder (Yellow FFFF00A8)
        this.texPlaceholderBack = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texPlaceholderBack);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0xFF, 0xFF, 0x00, 0xA8]));

        // Back image texture (defaults to yellow placeholder until loaded)
        this.texImageBack = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texImageBack);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0xFF, 0xFF, 0x00, 0xA8]));

        const imageBack = new Image();
        const imageBackElement = globalThis.document.getElementById('back');
        if (imageBackElement?.src) {
            imageBack.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, this.texImageBack);
                // Flip the image Y coordinate
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
                // One of the dimensions is not a power of 2, so set the filtering to render it.
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, imageBack);
                // Textures dimensions
                this.wTexBack = imageBack.width;
                this.hTexBack = imageBack.height;
                this.initBuffers();
                this.render();
            };
            imageBack.src = imageBackElement.src;
        } else {
            this.wTexBack = 1;
            this.hTexBack = 1;
        }

        const uSamplerFront = gl.getUniformLocation(gl.program, 'uSamplerFront');
        gl.uniform1i(uSamplerFront, 0);
        const uSamplerBack = gl.getUniformLocation(gl.program, 'uSamplerBack');
        gl.uniform1i(uSamplerBack, 1);

        // Recompute texture coords
        this.initBuffers();
        // First Render
        this.render();
    }

    // Perspective and background
    initPerspective() {
        const gl = this.gl;
        gl.clearColor(0xCC / 0xFF, 0xE4 / 0xFF, 0x1, 0x1);  // Clear to light blue, 0xCCE4FF fully opaque
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // Viewport
        this.canvas3d.width = this.canvas3d.clientWidth;
        this.canvas3d.height = this.canvas3d.clientHeight;
        gl.viewport(0, 0, this.canvas3d.clientWidth, this.canvas3d.clientHeight);

        const ratio = this.canvas3d.clientWidth / this.canvas3d.clientHeight;
        const fov = 40;
        const near = 50;
        const far = 1200;
        this.projection = mat4.perspective(mat4.create(), fov * Math.PI / 180, ratio, near, far);
        // Set projection matrix
        const uProjectionMatrix = gl.getUniformLocation(gl.program, 'uProjectionMatrix');
        gl.uniformMatrix4fv(uProjectionMatrix, false, this.projection);
    }

    // Buffers
    initBuffers() {
        const gl = this.gl;
        if (!this.vao) {
            this.vao = gl.createVertexArray();
        }
        gl.bindVertexArray(this.vao);
        this.vtx = []; // vertex coords
        this.ftx = []; // front texture coords
        this.btx = []; // back texture coords
        this.fnr = []; // front normals coords
        this.lin = []; // lines indices
        this.indexMap = new WeakMap(); // index in vtx for each point

        // Faces with FAN
        let index = 0;
        for (const f of this.model.faces) {
            const pts = f.points;
            const n = this.normal(pts);
            const faceIndex = new Map();

            for (let i = 1; i < pts.length - 1; i++) {
                // First point
                this.vtx.push(pts[0].x + f.offset * n[0], pts[0].y + f.offset * n[1], pts[0].z + f.offset * n[2]);
                this.fnr.push(n[0], n[1], n[2]);
                // Texture at first point of triangle
                this.ftx.push((200 + pts[0].xf) / this.wTexFront);
                this.ftx.push((200 + pts[0].yf) / this.hTexFront);
                this.btx.push((200 + pts[0].xf) / this.wTexBack);
                this.btx.push((200 + pts[0].yf) / this.hTexBack);

                // Two other points: i and i+1
                this.vtx.push(pts[i].x + f.offset * n[0], pts[i].y + f.offset * n[1], pts[i].z + f.offset * n[2]);
                this.fnr.push(n[0], n[1], n[2]);

                // Second point of triangle
                this.vtx.push(pts[i + 1].x + f.offset * n[0], pts[i + 1].y + f.offset * n[1], pts[i + 1].z + f.offset * n[2]);
                this.fnr.push(n[0], n[1], n[2]);
                // Texture at second point of triangle
                this.ftx.push((200 + pts[i].xf) / this.wTexFront);
                this.ftx.push((200 + pts[i].yf) / this.hTexFront);
                this.btx.push((200 + pts[i].xf) / this.wTexBack);
                this.btx.push((200 + pts[i].yf) / this.hTexBack);

                // Texture at third point of triangle
                this.ftx.push((200 + pts[i + 1].xf) / this.wTexFront);
                this.ftx.push((200 + pts[i + 1].yf) / this.hTexFront);
                this.btx.push((200 + pts[i + 1].xf) / this.wTexBack);
                this.btx.push((200 + pts[i + 1].yf) / this.hTexBack);

                // Keep track of index in vtx for each point, per face for the contour
                if (!this.indexMap.has(pts[0])) this.indexMap.set(pts[0], index);
                if (!faceIndex.has(pts[0])) faceIndex.set(pts[0], index);
                index++;
                if (!this.indexMap.has(pts[i])) this.indexMap.set(pts[i], index);
                if (!faceIndex.has(pts[i])) faceIndex.set(pts[i], index);
                index++;
                if (!this.indexMap.has(pts[i + 1])) this.indexMap.set(pts[i + 1], index);
                if (!faceIndex.has(pts[i + 1])) faceIndex.set(pts[i + 1], index);
                index++;
            }

            // Contour of this face only, in point order, using this face's own vertex copies
            for (let i = 0; i < pts.length; i++) {
                this.lin.push(faceIndex.get(pts[i]), faceIndex.get(pts[(i + 1) % pts.length]));
            }
        }

        // Vertices
        if (!this.vtxBuffer) {this.vtxBuffer = gl.createBuffer();}
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vtxBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vtx), gl.STATIC_DRAW); // Vertex
        const aVertexPosition = gl.getAttribLocation(gl.program, 'aVertexPosition');
        gl.vertexAttribPointer(aVertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexPosition);

        // Normals
        if (!this.fnrBuffer) {this.fnrBuffer = gl.createBuffer();}
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fnrBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.fnr), gl.STATIC_DRAW); // fnr Face Normal
        const aVertexNormal = gl.getAttribLocation(gl.program, 'aVertexNormal');
        gl.vertexAttribPointer(aVertexNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexNormal);

        // Front texture
        if (!this.ftxBuffer) {this.ftxBuffer = gl.createBuffer();}
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ftxBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.ftx), gl.STATIC_DRAW); // Front Texture
        const aTexCoordsFront = gl.getAttribLocation(gl.program, 'aTexCoordsFront');
        gl.vertexAttribPointer(aTexCoordsFront, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aTexCoordsFront);

        // Back texture
        if (!this.btxBuffer) {this.btxBuffer = gl.createBuffer();}
        gl.bindBuffer(gl.ARRAY_BUFFER, this.btxBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.btx), gl.STATIC_DRAW); // Back Texture
        const aTexCoordsBack = gl.getAttribLocation(gl.program, 'aTexCoordsBack');
        gl.vertexAttribPointer(aTexCoordsBack, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aTexCoordsBack);

        // Lines buffer, contour built per face above
        if (!this.linBuffer) {this.linBuffer = gl.createBuffer();}
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.linBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.lin), gl.STATIC_DRAW);

        // uniform flag for lines
        gl.uniform1i(gl.getUniformLocation(gl.program, 'uLine'), 0);
        // Unbind VAO after setup
        gl.bindVertexArray(null);
    }
    // Compute Face normal in [3]
    normal(pts) {
        const n = [0, 0, 0];
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
        const sq = Math.hypot(n[0], n[1], n[2]);
        if (sq < 1e-6) return [0, 0, 1];
        n[0] /= sq;
        n[1] /= sq;
        n[2] /= sq;
        return n;
    }
    // Model view matrix
    initModelView() {
        // Rotation around X axis
        let ex = mat4.create();
        mat4.translate(ex, ex, [this.translationX, this.translationY, -700]);   // recul en view space
        ex = mat4.rotateX(ex, ex, this.angleX * Math.PI / 180);
        // Rotation around Y axis
        ex = mat4.rotateY(ex, ex, this.angleY * Math.PI / 180);
        // Rotation around Z axis
        const mv = mat4.rotateZ(ex, ex, this.angleZ * Math.PI / 180);
        // Scale ModelView
        this.modelView = mat4.scale(mv, mv, [this.scale, this.scale, this.scale]);

        // Set Model View Matrix in Shader
        const uModelViewMatrix = this.gl.getUniformLocation(this.gl.program, 'uModelViewMatrix');
        this.gl.uniformMatrix4fv(uModelViewMatrix, false, this.modelView);

        // Overlay
        if (this.model.overlay) {
            this.overlay.width = this.overlay.clientWidth;
            this.overlay.height = this.overlay.clientHeight;
            const scale = mat4.scale(mat4.create(), mat4.create(), [this.overlay.width / 2, -this.overlay.height / 2, 1]);
            const translation = mat4.fromTranslation(mat4.create(), [1, -1, 0]);
            const overlay = mat4.multiply(mat4.create(), scale, translation);

            // canvasView = overlay * projection * modelView
            // gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            const projection = mat4.multiply(mat4.create(), this.projection, this.modelView);
            this.canvasView = mat4.multiply(mat4.create(), overlay, projection);

            // Set xCanvas, yCanvas to model points
            for (const p of this.model.points) {
                const v = Vector3.transformMat4(p, this.canvasView);
                p.xCanvas = v.x;
                p.yCanvas = v.y;
            }
        }
    }

    // Render
    render() {
        const gl = this.gl;

        // Faces with texture shader
        gl.useProgram(gl.program);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.model.textures ? this.texImageFront : this.texPlaceholderFront);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.model.textures ? this.texImageBack : this.texPlaceholderBack);

        // Clear and draw triangles
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Faces
        gl.drawArrays(gl.TRIANGLES, 0, this.vtx.length / 3);

        if (this.model.lines){
            // Segments drawElements and not drawArrays because normals imply 3 vertices per triangle
            const uLine = gl.getUniformLocation(gl.program, 'uLine');
            gl.uniform1i(uLine, 1); // Draw lines in black
            gl.disable(gl.DEPTH_TEST);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.linBuffer);
            gl.drawElements(gl.LINES, this.lin.length, gl.UNSIGNED_SHORT, 0);
            gl.enable(gl.DEPTH_TEST);
            gl.uniform1i(uLine, 0); // Back to normal
        }

        // Model projected on overlay canvas
        // Context 2d
        const context2d = this.overlay.getContext('2d');
        context2d.clearRect(0, 0, this.overlay.clientWidth, this.overlay.clientHeight)
        if (this.model.overlay) {
            // this.drawSegments(this.model.segments, 'black', 1); // done by webgl
            this.drawSegments(this.model.segments); // Hover and select
            this.drawPoints(this.model.points);
            this.drawFaces(this.model.faces);    // Only for hover and select
            if (this.model.labels) {
                this.drawLabels(context2d);
            }
        }
    }

    // Draw on overlay. Called from render()
    drawPoints(points,) {
        const context2d = this.overlay.getContext('2d');
        const priority = p => p.select ? 2 : p.hover ? 1 : 0;
        const ordered = [...points].sort((a, b) => priority(a) - priority(b));
        for (const p of ordered) {
            // Circle with color for selected, bigger for hovered
            context2d.beginPath();
            context2d.arc(p.xCanvas, p.yCanvas, p.hover ? 10 : 6, 0, 2 * Math.PI);
            context2d.fillStyle = p.select ? 'red' : p.hover ? 'blue' : 'skyblue';
            context2d.fill();
        }
    }

    // Draw on overlay. Called from render()
    drawSegments(segments) {
        const context2d = this.overlay.getContext('2d');
        const priority = s => s.select ? 2 : s.hover ? 1 : 0;
        const ordered = [...segments].sort((a, b) => priority(a) - priority(b));
        for (const s of ordered) {
            context2d.lineWidth = s.hover ? 6 : 3;
            context2d.beginPath();
            context2d.moveTo(s.p1.xCanvas, s.p1.yCanvas);
            context2d.lineTo(s.p2.xCanvas, s.p2.yCanvas);
            context2d.strokeStyle = s.select ? 'red' : s.hover ? 'blue' : 'skyblue';
            context2d.stroke();
        }
    }

    // Draw faces
    drawFaces(faces) {
        const context2d = this.overlay.getContext('2d');
        for (const f of faces) {
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
        for (const p of this.model.points) {
            if (p.hidden) {continue;}
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
            context2d.fillStyle = p.select ? 'red' : 'skyblue';
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
