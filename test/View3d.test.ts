import { View3d } from "../js/View3d.js";
import { Model } from "../js/Model.js";
import * as mat4 from "../js/lib/mat4.js";
import { assertEquals } from "@std/assert";

// Deno has no DOM: View3d reaches into globalThis.document (for #front/#back
// texture <img> tags) and `new Image()` unconditionally in initTextures().
// Stub both so the constructor can run headless; restored after every test.
function withStubbedDom<T>(fn: () => T): T {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  const originalDocument = g.document;
  const originalImage = g.Image;
  g.document = { getElementById: () => null };
  g.Image = class {};
  try {
    return fn();
  } finally {
    g.document = originalDocument;
    g.Image = originalImage;
  }
}

// Minimal WebGL2RenderingContext stand-in: every method View3d calls, plus
// the constants it reads. Values of the constants are arbitrary but distinct;
// nothing in View3d branches on their actual GLenum value.
function createMockGL() {
  const calls: string[] = [];
  let nextId = 0;
  // deno-lint-ignore no-explicit-any
  const gl: any = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    RGBA: 5, UNSIGNED_BYTE: 6, TEXTURE_2D: 7, UNPACK_FLIP_Y_WEBGL: 8,
    TEXTURE_WRAP_S: 9, TEXTURE_WRAP_T: 10, CLAMP_TO_EDGE: 11, TEXTURE_MIN_FILTER: 12,
    LINEAR: 13, RGB: 14, DEPTH_TEST: 15, LEQUAL: 16, ARRAY_BUFFER: 17,
    STATIC_DRAW: 18, FLOAT: 19, ELEMENT_ARRAY_BUFFER: 20, UNSIGNED_SHORT: 21,
    TEXTURE0: 22, TEXTURE1: 23, COLOR_BUFFER_BIT: 24, DEPTH_BUFFER_BIT: 25,
    TRIANGLES: 26, LINES: 27,

    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramInfoLog: () => "",
    getProgramParameter: () => true,
    useProgram: () => {},
    getError: () => 0,

    createTexture: () => ({}),
    bindTexture: () => {},
    texImage2D: () => {},
    pixelStorei: () => {},
    texParameteri: () => {},

    getUniformLocation: () => ({ id: nextId++ }),
    uniform1i: () => {},
    uniformMatrix4fv: () => {},

    clearColor: () => {},
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    viewport: () => {},

    createVertexArray: () => ({}),
    bindVertexArray: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: () => nextId++,
    vertexAttribPointer: () => {},
    enableVertexAttribArray: () => {},

    activeTexture: () => {},
    clear: () => calls.push("clear"),
    drawArrays: () => calls.push("drawArrays"),
    drawElements: () => calls.push("drawElements"),
  };
  return { gl, calls };
}

function createMockCanvas3d(gl: unknown, width = 200, height = 100) {
  return {
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    getContext: () => gl,
  };
}

// Same style of recording 2d-context mock as View2d.test.ts / Helper.test.ts.
function createMockContext2d() {
  const calls: { method: string; args: unknown[]; fillStyle?: string; strokeStyle?: string }[] = [];
  const ctx = {
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    font: "",
    beginPath: () => calls.push({ method: "beginPath", args: [] }),
    arc: (...args: unknown[]) => calls.push({ method: "arc", args }),
    moveTo: (...args: unknown[]) => calls.push({ method: "moveTo", args }),
    lineTo: (...args: unknown[]) => calls.push({ method: "lineTo", args }),
    closePath: () => calls.push({ method: "closePath", args: [] }),
    stroke() { calls.push({ method: "stroke", args: [], strokeStyle: this.strokeStyle }); },
    fill() { calls.push({ method: "fill", args: [], fillStyle: this.fillStyle }); },
    fillText: (...args: unknown[]) => calls.push({ method: "fillText", args }),
    clearRect: (...args: unknown[]) => calls.push({ method: "clearRect", args }),
  };
  return { ctx, calls };
}

function createMockOverlay(ctx: unknown, width = 200, height = 100) {
  return {
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    getContext: () => ctx,
  };
}

Deno.test("View3d", async (t) => {
  await t.step("constructs, compiles shaders, and builds buffers from the model", () => {
    withStubbedDom(() => {
      const model = new Model().init(200, 200); // one flat quad face, 4 points
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const { ctx } = createMockContext2d();
      const overlay = createMockOverlay(ctx);

      // deno-lint-ignore no-explicit-any
      const view3d = new View3d(model, canvas3d, overlay as any);

      assertEquals(view3d.gl, gl);
      assertEquals(view3d.projection.length, 16);
      assertEquals(view3d.modelView.length, 16);
      // Quad fan-triangulated into 2 triangles: 2 * 3 vertices * 3 coords
      assertEquals(view3d.vtx.length, 18);
      // Contour: 4 edges * 2 indices
      assertEquals(view3d.lin.length, 8);
    });
  });

  await t.step("normal() returns the unit normal of a planar face", () => {
    const view3d = Object.create(View3d.prototype);
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    assertEquals(view3d.normal(pts), [0, 0, 1]);
  });

  await t.step("normal() falls back to [0,0,1] for degenerate (coincident) points", () => {
    const view3d = Object.create(View3d.prototype);
    const pts = [
      { x: 5, y: 5, z: 5 },
      { x: 5, y: 5, z: 5 },
      { x: 5, y: 5, z: 5 },
    ];
    assertEquals(view3d.normal(pts), [0, 0, 1]);
  });

  await t.step("faceDepth() averages eye-space z, falling back to z when zEye is unset", () => {
    const view3d = Object.create(View3d.prototype);
    const face = { points: [{ z: 1 }, { zEye: 5, z: 99 }, { z: 3 }] };
    assertEquals(view3d.faceDepth(face), 3);
  });

  await t.step("updateCanvasCoords() projects a world-origin point to the overlay center under identity view", () => {
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const { ctx } = createMockContext2d();
      const overlay = createMockOverlay(ctx, 200, 100);
      // deno-lint-ignore no-explicit-any
      const view3d = new View3d(model, canvas3d, overlay as any);

      // deno-lint-ignore no-explicit-any
      view3d.model = { points: [{ x: 0, y: 0, z: 0 }] } as any;
      view3d.projection = mat4.create();
      view3d.modelView = mat4.create();

      view3d.updateCanvasCoords();

      const p = view3d.model.points[0];
      assertEquals(Math.round(p.xCanvas), 100); // width / 2
      assertEquals(Math.round(p.yCanvas), 50);  // height / 2
      assertEquals(Math.round(p.zEye), 0);
    });
  });

  await t.step("render() draws the model on gl and mirrors overlay/edges/labels state on the 2d context", () => {
    withStubbedDom(() => {
      const model = new Model().init(200, 200); // init() defaults overlay/edges/lines to true
      const { gl, calls: glCalls } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const { ctx, calls: ctxCalls } = createMockContext2d();
      const overlay = createMockOverlay(ctx);
      // deno-lint-ignore no-explicit-any
      const view3d = new View3d(model, canvas3d, overlay as any);

      glCalls.length = 0;
      ctxCalls.length = 0;
      view3d.render();

      assertEquals(glCalls.includes("clear"), true);
      assertEquals(glCalls.includes("drawArrays"), true);
      assertEquals(glCalls.includes("drawElements"), true); // model.lines defaults to true
      assertEquals(ctxCalls.some((c) => c.method === "clearRect"), true);
      // overlay/edges true: points + segments get drawn (each does a fill/stroke)
      assertEquals(ctxCalls.some((c) => c.method === "fill"), true);
      assertEquals(ctxCalls.some((c) => c.method === "stroke"), true);
    });
  });

  await t.step("drawPoints() colors a selected point red and a hovered point blue", () => {
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const { ctx, calls } = createMockContext2d();
      const overlay = createMockOverlay(ctx);
      // deno-lint-ignore no-explicit-any
      const view3d = new View3d(model, canvas3d, overlay as any);
      view3d.overlay = overlay;

      const [p0, p1] = model.points;
      p0.xCanvas = 10; p0.yCanvas = 10; p0.select = true;
      p1.xCanvas = 20; p1.yCanvas = 20; p1.hover = true;

      calls.length = 0;
      view3d.drawPoints([p0, p1]);

      const fills = calls.filter((c) => c.method === "fill").map((c) => c.fillStyle);
      assertEquals(fills.includes("red"), true);
      assertEquals(fills.includes("blue"), true);
    });
  });

  await t.step("drawFaces() skips faces that are neither selected nor hovered", () => {
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const { ctx, calls } = createMockContext2d();
      const overlay = createMockOverlay(ctx);
      // deno-lint-ignore no-explicit-any
      const view3d = new View3d(model, canvas3d, overlay as any);
      view3d.overlay = overlay;

      for (const p of model.points) { p.xCanvas = p.xf; p.yCanvas = p.yf; }
      const face = model.faces[0];

      calls.length = 0;
      view3d.drawFaces([face]);
      assertEquals(calls.length, 0); // not selected, not hovered: nothing drawn

      face.select = true;
      calls.length = 0;
      view3d.drawFaces([face]);
      const fills = calls.filter((c) => c.method === "fill").map((c) => c.fillStyle);
      assertEquals(fills.includes("rgba(255,0,0,0.35)"), true);
    });
  });

  await t.step("drawLabels() writes one label per visible point and skips hidden ones", () => {
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const { ctx, calls } = createMockContext2d();
      const overlay = createMockOverlay(ctx);
      // deno-lint-ignore no-explicit-any
      const view3d = new View3d(model, canvas3d, overlay as any);
      view3d.overlay = overlay;
      view3d.model = { points: [model.points[0], model.points[1]] };
      model.points[0].xCanvas = 0; model.points[0].yCanvas = 0;
      model.points[1].xCanvas = 50; model.points[1].yCanvas = 50; model.points[1].hidden = true;

      calls.length = 0;
      view3d.drawLabels(ctx);

      const texts = calls.filter((c) => c.method === "fillText").map((c) => c.args[0]);
      assertEquals(texts, ["0"]); // index of the visible point only
    });
  });
});
