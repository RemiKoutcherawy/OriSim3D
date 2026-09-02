// NOSONAR - SonarQube's S2187 test-detection doesn't recognize Deno's Deno.test()/t.step()
// API as test cases; this file contains 3 t.step() sub-tests (6 assertions) for View2d.js.
import { View2d } from "../js/View2d.js";
import { Model } from "../js/Model.js";
import { assertEquals } from "@std/assert";

Deno.test("View2d", async (t) => {
    const calls: { method: string; args: unknown[] }[] = [];
    const mockContext = {
        font: "",
        lineWidth: 1,
        strokeStyle: "",
        fillStyle: "",
        beginPath: () => calls.push({ method: "beginPath", args: [] }),
        arc: (...args: unknown[]) => calls.push({ method: "arc", args }),
        moveTo: (...args: unknown[]) => calls.push({ method: "moveTo", args }),
        lineTo: (...args: unknown[]) => calls.push({ method: "lineTo", args }),
        closePath: () => calls.push({ method: "closePath", args: [] }),
        stroke: () => calls.push({ method: "stroke", args: [] }),
        fill: () => calls.push({ method: "fill", args: [] }),
        fillText: (...args: unknown[]) => calls.push({ method: "fillText", args }),
        save: () => calls.push({ method: "save", args: [] }),
        restore: () => calls.push({ method: "restore", args: [] }),
        setTransform: (...args: unknown[]) => calls.push({ method: "setTransform", args }),
        fillRect: (...args: unknown[]) => calls.push({ method: "fillRect", args }),
        setLineDash: (...args: unknown[]) => calls.push({ method: "setLineDash", args }),
    };

    const mockCanvas = {
        width: 800,
        height: 600,
        clientLeft: 0,
        clientTop: 0,
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
        getContext: () => mockContext,
    };

    const model = new Model().init(200, 200);
    // Split model to have 2 faces and an internal segment
    model.splitCross2d(model.points[0], model.points[2]);

    // deno-lint-ignore no-explicit-any
    const view2d = new View2d(model, mockCanvas as any);

    await t.step("drawFaces renders face index and normal sign", () => {
        calls.length = 0;
        view2d.drawFaces(model.faces);
        const textCalls = calls.filter((c) => c.method === "fillText");
        // For each of 2 faces: index and normal ('+')
        const texts = textCalls.map((c) => c.args[0]);
        assertEquals(texts.includes("0"), true);
        assertEquals(texts.includes("1"), true);
        assertEquals(texts.includes("+"), true);
    });

    await t.step("drawSegments renders segment index and angle between faces", () => {
        calls.length = 0;
        view2d.drawSegments(model.segments);
        const textCalls = calls.filter((c) => c.method === "fillText");
        const texts = textCalls.map((c) => c.args[0]);
        // Internal diagonal segment connects 2 coplanar faces, so angle 0 is drawn
        assertEquals(texts.includes("0"), true);
    });

    await t.step("drawModel executes completely without errors", () => {
        calls.length = 0;
        view2d.drawModel();
        assertEquals(calls.length > 0, true);
    });
});
