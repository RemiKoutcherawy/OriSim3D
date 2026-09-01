// NOSONAR - SonarQube's S2187 test-detection doesn't recognize Deno's Deno.test()/t.step()
// API as test cases; this file contains 12 t.step() sub-tests (33 assertions) for View3d.js.
import { View3d } from "../js/View3d.js";
import { Model } from "../js/Model.js";
import * as mat4 from "../js/lib/mat4.js";
import { assertEquals } from "@std/assert";

// Deno has no DOM: View3d reaches into globalThis.document (for #front/#back
// texture <img> tags and createElement('canvas') for the overlay) and
// `new Image()` in initTextures(). Stub both so the constructor can run
// headless; restored after every test.
function withStubbedDom<T>(fn: () => T, overlay?: ReturnType<typeof createMockOverlay>): T {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  const originalDocument = g.document;
  const originalImage = g.Image;
  const stubOverlay = overlay ?? createMockOverlay(createMockContext2d().ctx);
  g.document = {
    getElementById: () => null,
    createElement: (tag: string) => tag === "canvas" ? stubOverlay : {},
  };
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
    after: () => {},
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
    save: () => calls.push({ method: "save", args: [] }),
    restore: () => calls.push({ method: "restore", args: [] }),
    setLineDash: (...args: unknown[]) => calls.push({ method: "setLineDash", args }),
  };
  return { ctx, calls };
}

function createMockOverlay(ctx: unknown, width = 200, height = 100) {
  return {
    id: "",
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    getContext: () => ctx,
  };
}

Deno.test("View3d", async (t) => {
  await t.step("constructs, compiles shaders, and builds buffers from the model", () => {
    const { ctx } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200); // one flat quad face, 4 points
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);

      const view3d = new View3d(model, canvas3d);

      assertEquals(view3d.gl, gl);
      assertEquals(view3d.overlay, overlay);
      assertEquals(view3d.projection.length, 16);
      assertEquals(view3d.modelView.length, 16);
      // Quad fan-triangulated into 2 triangles: 2 * 3 vertices * 3 coords
      assertEquals(view3d.vtx.length, 18);
      // Contour: 4 edges * 2 indices
      assertEquals(view3d.lin.length, 8);
    }, overlay);
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
    // Distance from the camera, so the sign is flipped: eye z grows towards it
    assertEquals(view3d.faceDepth(face), -3);
  });

  await t.step("faceDepth() puts the face nearest the camera first", () => {
    const view3d = Object.create(View3d.prototype);
    // Everything visible sits between eye z -50 and -1200; -650 is nearer than -750
    const near = { points: [{ zEye: -650 }] };
    const far = { points: [{ zEye: -750 }] };
    assertEquals(view3d.faceDepth(near) < view3d.faceDepth(far), true);
    assertEquals([far, near].sort((a, b) => view3d.faceDepth(a) - view3d.faceDepth(b))[0], near);
  });

  await t.step("faceDepth() accounts for the offset that separates coplanar layers", async () => {
    const mat4 = await import("../js/lib/mat4.js");
    const view3d = Object.create(View3d.prototype);
    view3d.modelView = mat4.create();
    // Two coplanar faces facing the camera, one lifted towards it by `offset`
    const flat = { points: [{ x: 0, y: 0, z: 0, zEye: -700 }], offset: 0 };
    const lifted = {
      points: [
        { x: 0, y: 0, z: 0, zEye: -700 },
        { x: 10, y: 0, z: 0, zEye: -700 },
        { x: 0, y: 10, z: 0, zEye: -700 },
      ],
      offset: 5,
    };
    // Without the offset both would tie and the pile order would be arbitrary
    assertEquals(view3d.faceDepth(lifted) < view3d.faceDepth(flat), true);
  });

  await t.step("syncCanvasSize() sets identical buffer sizes on canvas3d and overlay", () => {
    const { ctx } = createMockContext2d();
    const overlay = createMockOverlay(ctx, 200, 100);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl, 200, 100);
      const view3d = new View3d(model, canvas3d);
      const size = view3d.syncCanvasSize();
      assertEquals(size, { width: 200, height: 100 });
      assertEquals(canvas3d.width, 200);
      assertEquals(canvas3d.height, 100);
      assertEquals(overlay.width, 200);
      assertEquals(overlay.height, 100);
    }, overlay);
  });

  await t.step("updateCanvasCoords() projects a world-origin point to the overlay center under identity view", () => {
    const { ctx } = createMockContext2d();
    const overlay = createMockOverlay(ctx, 200, 100);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl, 200, 100);
      const view3d = new View3d(model, canvas3d);

      // deno-lint-ignore no-explicit-any
      view3d.model = { points: [{ x: 0, y: 0, z: 0 }] } as any;
      view3d.projection = mat4.create();
      view3d.modelView = mat4.create();

      view3d.updateCanvasCoords();

      const p = view3d.model.points[0];
      assertEquals(Math.round(p.xCanvas), 100); // width / 2
      assertEquals(Math.round(p.yCanvas), 50);  // height / 2
      assertEquals(Math.round(p.zEye), 0);
    }, overlay);
  });

  await t.step("render() draws the model on gl and mirrors overlay state on the 2d context", () => {
    const { ctx, calls: ctxCalls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl, calls: glCalls } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);

      model.segments[0].select = true; // gives drawSegments an axis to stroke
      glCalls.length = 0;
      ctxCalls.length = 0;
      view3d.render();

      assertEquals(glCalls.includes("clear"), true);
      assertEquals(glCalls.includes("drawArrays"), true);
      assertEquals(glCalls.includes("drawElements"), true); // model.lines defaults to true
      assertEquals(ctxCalls.some((c) => c.method === "clearRect"), true);
      assertEquals(ctxCalls.some((c) => c.method === "stroke"), true); // selected segment drawn as axis
    }, overlay);
  });

  await t.step("drawPoints() colors a selected point red and a hovered point blue", () => {
    const { ctx, calls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);

      const [p0, p1] = model.points;
      p0.xCanvas = 10; p0.yCanvas = 10; p0.select = true;
      p1.xCanvas = 20; p1.yCanvas = 20; p1.hover = true;

      calls.length = 0;
      view3d.drawPoints([p0, p1]);

      const fills = calls.filter((c) => c.method === "fill").map((c) => c.fillStyle);
      assertEquals(fills.includes("red"), true);
      assertEquals(fills.includes("blue"), true);
    }, overlay);
  });

  await t.step("drawSegments() draws red axis for the first selected segment", () => {
    const { ctx, calls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);

      for (const p of model.points) { p.xCanvas = p.xf; p.yCanvas = p.yf; }
      model.segments[0].select = true;
      model.segments[1].select = true; // ignored — only first axis

      calls.length = 0;
      view3d.drawSegments(model.segments);
      const red = calls.filter((c) => c.method === "stroke" && c.strokeStyle === "red");
      assertEquals(red.length > 0, true);
    }, overlay);
  });

  await t.step("drawSegments() in fold mode draws axis and hover candidate, both as axis style", () => {
    const { ctx, calls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);

      for (const p of model.points) { p.xCanvas = p.xf; p.yCanvas = p.yf; }
      model.faces[0].select = true;
      model.segments[0].select = true;
      model.segments[1].hover = true;

      calls.length = 0;
      view3d.drawSegments(model.segments);
      const strokes = calls.filter((c) => c.method === "stroke");
      assertEquals(strokes.length, 2); // axis + hover candidate
      assertEquals(strokes.every((c) => c.strokeStyle === "red"), true);
    }, overlay);
  });

  await t.step("drawSegments() treats a hovered (mid-drag) face like a selected one for the axis candidate", () => {
    const { ctx, calls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);

      for (const p of model.points) { p.xCanvas = p.xf; p.yCanvas = p.yf; }
      // Dragging directly off an unselected face only sets .hover, not .select,
      // until the fold commits — the axis candidate must still render red.
      model.faces[0].hover = true;
      model.segments[0].hover = true;

      calls.length = 0;
      view3d.drawSegments(model.segments);
      const strokes = calls.filter((c) => c.method === "stroke");
      assertEquals(strokes.length, 1);
      assertEquals(strokes[0].strokeStyle, "red");
    }, overlay);
  });

  await t.step("drawFaces() skips faces that are neither selected nor hovered", () => {
    const { ctx, calls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);

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
    }, overlay);
  });

  await t.step("drawLabels() writes one label per visible point and skips hidden ones", () => {
    const { ctx, calls } = createMockContext2d();
    const overlay = createMockOverlay(ctx);
    withStubbedDom(() => {
      const model = new Model().init(200, 200);
      const { gl } = createMockGL();
      const canvas3d = createMockCanvas3d(gl);
      const view3d = new View3d(model, canvas3d);
      view3d.model = { points: [model.points[0], model.points[1]], segments: [] };
      model.points[0].xCanvas = 0; model.points[0].yCanvas = 0;
      model.points[1].xCanvas = 50; model.points[1].yCanvas = 50; model.points[1].hidden = true;

      calls.length = 0;
      view3d.drawLabels(ctx);

      const texts = calls.filter((c) => c.method === "fillText").map((c) => c.args[0]);
      assertEquals(texts, ["0"]); // index of the visible point only
    }, overlay);
  });
});
