// View3dWebGL
// Inspired by https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Lighting_in_WebGL Sample 7
// No uNormalMatrix but vLightingBack

import {mat4} from './mat4.js';

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
    out highp vec3 vLightingBack;

    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vTexCoordsFront = aTexCoordsFront;
        vTexCoordsBack  = aTexCoordsBack;
                  
        highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
        highp vec3 directionalLightColor = vec3(1.0, 1.0, 1.0);
        highp vec3 directionalVector =  normalize(vec3(0.1, 0.1, 0.75)); // normalize(vec3(0.85, 0.8, 0.75));
        highp vec4 normal = normalize(uModelViewMatrix * vec4(aVertexNormal, 1.0));
        highp float directional = dot(normal.xyz, directionalVector);
        vLighting = ambientLight + (directionalLightColor * directional);
        vLightingBack = ambientLight - (directionalLightColor * directional);
    }
    `;

    // Fragment shader program
    FRAGMENT_SHADER = `#version 300 es
        precision highp float;
        
        in highp vec2 vTexCoordsFront;
        in highp vec2 vTexCoordsBack;
        in highp vec3 vLighting;
        in highp vec3 vLightingBack;
                
        uniform sampler2D uSamplerFront;
        uniform sampler2D uSamplerBack;
        uniform vec4 uFrontColor;
        uniform vec4 uBackColor;

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
                lighting = vLightingBack;
            }
            outColor = vec4(texelColor.rgb * lighting, texelColor.a);
        }
    `;

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
        this.gl = canvas3d.getContext('webgl2');

        this.initShaders();
        this.initTextures();
        this.initPerspective();
        this.initModelView();

        // Resize
        window.addEventListener('resize', () => {
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

        // Fragment
        const fgShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fgShader, this.FRAGMENT_SHADER);
        gl.compileShader(fgShader);

        // Create the shader program
        const program = gl.createProgram();
        gl.attachShader(program, vxShader);
        gl.attachShader(program, fgShader);
        gl.linkProgram(program);
        checkErrors(gl, program, vxShader, fgShader);

        // Use it and copy it in an attribute of gl
        gl.useProgram(program);
        gl.program = program;
        checkErrors(gl, program, vxShader, fgShader);

        // Front color
        const uFrontColor = gl.getUniformLocation(gl.program, 'uFrontColor');
        gl.uniform4f(uFrontColor, 0.0, 0.5, 1.0, 0.8); // 0x0080FFCC

        // Back color
        const uBackColor = gl.getUniformLocation(gl.program, 'uBackColor');
        gl.uniform4f(uBackColor, 1.0, 1.0, 0.0, 0.8); // 0xFFFF00CC

        function checkErrors(gl, program, glVertexShader, glFragmentShader) {
            const programLog = gl.getProgramInfoLog(program).trim();
            const vertexLog = gl.getShaderInfoLog(glVertexShader).trim();
            const fragmentLog = gl.getShaderInfoLog(glFragmentShader).trim();
            if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
                console.error('Shader Error ' + gl.getError() + ' - ' + 'VALIDATE_STATUS ' + gl.getProgramParameter(program, 35715) + '\n\n' + 'Program Info Log: ' + programLog + '\n' + vertexLog + '\n' + fragmentLog);
            }
        }
    }

    // Textures
    initTextures() {
        const gl = this.gl;
        // Create a texture object Front
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        // Placeholder One Pixel Color Blue 70ACF3
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0x70, 0xAC, 0xF3, 255]));
        const uSamplerFront = gl.getUniformLocation(gl.program, 'uSamplerFront');
        gl.uniform1i(uSamplerFront, 0);

        const imageFront = new Image();
        const scope = this;
        imageFront.onload = function () {
            gl.activeTexture(gl.TEXTURE0);
            // Flip the image Y coordinate
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
            // One of the dimensions is not a power of 2, so set the filtering to render it.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, imageFront);
            // Textures dimensions
            scope.wTexFront = imageFront.width;
            scope.hTexFront = imageFront.height;
        };
        // Require CORS
        // imageFront.src = './textures/front.jpg';
        // Does not require CORS, use if image is inlined in html
        if (window.document.getElementById('front')) {
            imageFront.src = window.document.getElementById('front').src;
        }

        // Create a texture object Back
        const textureBack = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textureBack);

        // Placeholder One Pixel Color Yellow #FDEC43
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0xFD, 0xEC, 0x43, 0xFF]));
        const uSamplerBack = gl.getUniformLocation(gl.program, 'uSamplerBack');
        gl.uniform1i(uSamplerBack, 1);

        const imageBack = new Image();
        imageBack.onload = function () {
            gl.activeTexture(gl.TEXTURE1);
            // Flip the image Y coordinate
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.bindTexture(gl.TEXTURE_2D, textureBack);
            // One of the dimensions is not a power of 2, so set the filtering to render it.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, imageBack);
            // Textures dimensions
            scope.wTexBack = imageBack.width;
            scope.hTexBack = imageBack.height;

            // Recompute texture coords
            scope.initBuffers();

            // First Render
            scope.render();
        };
        // Require CORS
        // imageBack.src = './textures/back.jpg';
        // Does not require CORS if image is inlined
        if (window.document.getElementById('back')) {
            imageBack.src = window.document.getElementById('back').src;
        }
    }

    // Perspective and background
    initPerspective() {
        const gl = this.gl;
        gl.clearColor(0xCC / 0xFF, 0xE4 / 0xFF, 0xFF / 0xFF, 0xFF / 0xFF);  // Clear to light blue, 0xCCE4FF fully opaque
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // Viewport
        this.canvas3d.width = this.canvas3d.clientWidth;
        this.canvas3d.height = this.canvas3d.clientHeight;
        gl.viewport(0, 0, this.canvas3d.clientWidth, this.canvas3d.clientHeight);

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

        // Set projection matrix
        const uProjectionMatrix = gl.getUniformLocation(gl.program, 'uProjectionMatrix');
        gl.uniformMatrix4fv(uProjectionMatrix, false, this.projection);
    }

    // Buffers
    initBuffers() {
        const gl = this.gl;
        this.vtx = []; // vertex coords
        this.ftx = []; // front texture coords
        this.btx = []; // back texture coords
        this.fnr = []; // front normals coords
        this.lin = []; // lines indices
        this.indexMap = new WeakMap(); // index in vtx for each point

        // Faces with FAN
        let index = 0;
        for (let f of this.model.faces) {
            const pts = f.points;
            const n = normal(pts);

            for (let i = 1; i < pts.length - 1; i++) {
                // First point
                this.vtx.push(pts[0].x + f.offset * n[0], pts[0].y + f.offset * n[1], pts[0].z + f.offset * n[2]);
                this.fnr.push(n[0], n[1], n[2]);
                // Texture at first point of triangle
                this.ftx.push((200 + pts[0].xf) / this.wTexFront);
                this.ftx.push((200 + pts[0].yf) / this.hTexFront);
                this.btx.push((200 + pts[0].xf) / this.wTexBack);
                this.btx.push((200 + pts[0].yf) / this.hTexBack);

                // Two other points : i and i+1
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

                // Keep track of index in vtx for each point to draw lines
                this.indexMap.set(pts[0], index++);
                this.indexMap.set(pts[i], index++);
                this.indexMap.set(pts[i + 1], index++);
            }
        }

        // Vertices
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vtx), gl.STATIC_DRAW); // Vertex
        const aVertexPosition = gl.getAttribLocation(gl.program, 'aVertexPosition');
        gl.vertexAttribPointer(aVertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexPosition);

        // Normals
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.fnr), gl.STATIC_DRAW); // fnr Face Normal
        const aVertexNormal = gl.getAttribLocation(gl.program, 'aVertexNormal');
        gl.vertexAttribPointer(aVertexNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexNormal);

        // Front texture
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.ftx), gl.STATIC_DRAW); // Front Texture
        const aTexCoordsFront = gl.getAttribLocation(gl.program, 'aTexCoordsFront');
        gl.vertexAttribPointer(aTexCoordsFront, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aTexCoordsFront);

        // Back texture
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.btx), gl.STATIC_DRAW); // Back Texture
        const aTexCoordsBack = gl.getAttribLocation(gl.program, 'aTexCoordsBack');
        gl.vertexAttribPointer(aTexCoordsBack, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aTexCoordsBack);

        // Segments
        for (let s of this.model.segments) {
            this.lin.push(this.indexMap.get(s.p1), this.indexMap.get(s.p2));
        }
        this.linBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.linBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.lin), gl.STATIC_DRAW);

        // uniform flag for lines
        gl.uniform1i(gl.getUniformLocation(gl.program, 'uLine'), 0);

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

        // Set Model View Matrix in Shader
        const uModelViewMatrix = this.gl.getUniformLocation(this.gl.program, 'uModelViewMatrix');
        this.gl.uniformMatrix4fv(uModelViewMatrix, false, this.modelView);

        // Overlay
        this.overlay.width = this.overlay.clientWidth;
        this.overlay.height = this.overlay.clientHeight;
        const scale = mat4.scale(new Float32Array(16), mat4.create(), [this.overlay.width / 2.0, -this.overlay.height / 2.0, 1.0]);
        const translation = mat4.fromTranslation(new Float32Array(16), [1, -1, 0]);
        const overlay = mat4.multiply(new Float32Array(16), scale, translation);

        // canvasView = overlay * projection * modelView
        // gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        const projection = mat4.multiply(new Float32Array(16), this.projection, this.modelView,);
        this.canvasView = mat4.multiply(new Float32Array(16), overlay, projection);

        // Set xCanvas, yCanvas to model points
        for (let p of this.model.points) {
            const v = mat4.applyMatrix4(this.canvasView, [p.x, p.y, p.z]);
            p.xCanvas = v[0];
            p.yCanvas = v[1];
        }
    }

    // Render
    render() {
        const gl = this.gl;

        // Faces with texture shader
        gl.useProgram(gl.program);

        // Clear and draw triangles
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Faces
        gl.drawArrays(gl.TRIANGLES, 0, this.vtx.length / 3);

        // Segments drawElements and not drawArrays because normals implies 3 vertices per triangle
        const uLine = gl.getUniformLocation(gl.program, 'uLine');
        gl.uniform1i(uLine, 1); // Draw lines in black
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.linBuffer);
        gl.drawElements(gl.LINES, this.lin.length, gl.UNSIGNED_SHORT, 0);
        gl.uniform1i(uLine, 0); // Back to normal

        // Context 2d
        const context2d = this.overlay.getContext('2d');
        context2d.clearRect(0, 0, this.overlay.clientWidth, this.overlay.clientHeight)

        // Model projected on overlay canvas
        // this.drawSegments(this.model.segments, 'black', 1); // done by webgl
        this.drawSegments(this.model.segments); // Hover and select
        this.drawPoints(this.model.points);
        this.drawFaces(this.model.faces);    // Only for hover and select

        if (this.model.labels) {
            this.drawLabels(context2d);
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
