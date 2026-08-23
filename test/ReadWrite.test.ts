import {ReadWrite} from "../js/ReadWrite.js";
import {Model} from "../js/Model.js";
import {Point} from "../js/Point.js";
import {Command} from "../js/Command.js";
import {assertEquals} from "@std/assert";

Deno.test("ReadWrite", async (t) => {

    await t.step('readFileAsText', async () => {
        const text = await ReadWrite.readFileAsText('models/box.fold');
        if (text) assertEquals((text as string).length, 4322, "writeFold should be tested");
    });
    await t.step('writeFold', async () => {
        const model = new Model().init(200, 200);
        const filename = 'test/test.fold';
        const json = await ReadWrite.writeFold(model, filename);
        assertEquals(json.length > 0, true, "writeFold should be tested");
        await Deno.remove(filename);
    });

    await t.step('consistency toJSONFold / jsonFoldToModel', () => {
        const model = new Model();
        model.init(200, 200);
        const originalPoints = [...model.points];
        const json = ReadWrite.toJSONFold(model);
        // Model must not be mutated by toJSONFold
        assertEquals(model.points.length, 4, "Model points count unchanged");
        assertEquals(model.points[0], originalPoints[0], "Point instances unchanged");

        const parsedFold = JSON.parse(json);
        assertEquals(parsedFold.faces_vertices, [[0, 1, 2, 3]]);
        assertEquals(parsedFold.faces_edges, [[0, 1, 2, 3]]);

        const model2 = ReadWrite.jsonFoldToModel(json);
        assertEquals(model.points.length, model2.points.length, "Points length should be equal");
        assertEquals(model.segments.length, model2.segments.length, "Segments length should be equal");
        assertEquals(model.faces.length, model2.faces.length, "Faces length should be equal");
        assertEquals(model2.points[0] instanceof Point, true, "jsonFoldToModel should keep Point instances");
    });

    await t.step('loadText script fold and empty', () => {
        const model = new Model().init(200, 200);
        model.labels = false;
        model.edges = true;
        const command = new Command(model);
        const area = {textarea: {value: 'old', selectionStart: 0, selectionEnd: 0}};
        command.commandArea = area;

        assertEquals(ReadWrite.loadText(command, '   '), 'empty');
        assertEquals(area.textarea.value, 'old');

        const kindScript = ReadWrite.loadText(command, 'd 200 200\nlabels');
        assertEquals(kindScript, 'script');
        assertEquals(area.textarea.value.startsWith('d 200 200'), true);
        command.anim();

        const json = ReadWrite.toJSONFold(new Model().init(200, 200));
        model.labels = false;
        model.edges = true;
        const kindFold = ReadWrite.loadText(command, json);
        assertEquals(kindFold, 'fold');
        assertEquals(command.model.points[0] instanceof Point, true);
        assertEquals(command.model.labels, false, 'display flags are kept');
        assertEquals(command.model.edges, true, 'edges flag is kept');
        assertEquals(area.textarea.value, '');
        assertEquals(command.model.points.length, 4);
    });

    await t.step('writeSVG exports 3D view from xCanvas/yCanvas', async () => {
        const model = new Model().init(200, 200);
        // Simulated 3D projection (as View3d.updateCanvasCoords would set)
        model.points[0].xCanvas = 10; model.points[0].yCanvas = 20;
        model.points[1].xCanvas = 110; model.points[1].yCanvas = 20;
        model.points[2].xCanvas = 110; model.points[2].yCanvas = 120;
        model.points[3].xCanvas = 10; model.points[3].yCanvas = 120;
        const filename = 'test/test.svg';
        const svg = await ReadWrite.writeSVG(model, filename);
        assertEquals(svg.includes('<svg'), true);
        assertEquals(svg.includes('<polygon'), true);
        assertEquals(svg.includes('<line'), true);
        assertEquals(svg.includes('x1="10.00"'), true, 'uses xCanvas not xf');
        assertEquals(svg.includes('y1="10.00"'), true, 'uses yCanvas not yf');
        assertEquals(svg.includes('-200'), false, 'does not use crease-pattern xf');
        assertEquals((await Deno.readTextFile(filename)).startsWith('<?xml'), true);
        await Deno.remove(filename);
    });

    await t.step('writeSVG colors faces by front/back when view3d is passed', async () => {
        const model = new Model().init(200, 200);
        for (const p of model.points) {
            p.xCanvas = p.xf + 100;
            p.yCanvas = p.yf + 100;
        }
        const view3d = {
            modelView: new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ]),
            updateCanvasCoords() {},
        };
        const front = ReadWrite.svgFaceFillColor(model.faces[0], 0, view3d);
        assertEquals(front.startsWith('#'), true);
        assertEquals(front.includes('hsl'), false, 'uses front/back hex, not HSL fallback');
        // Blue front tint (#70ACF3 * lighting) vs yellow back
        const flipped = {
            points: [...model.faces[0].points].reverse(),
        };
        const back = ReadWrite.svgFaceFillColor(flipped, 0, view3d);
        assertEquals(front !== back, true, 'front and back get different fills');
        // Without view3d, falls back to HSL
        assertEquals(ReadWrite.svgFaceFillColor(model.faces[0], 0, null).startsWith('hsl'), true);

        const svg = await ReadWrite.writeSVG(model, 'test/test-faces.svg', view3d);
        assertEquals(svg.includes('fill="#'), true, 'polygons use hex front/back fills');
        assertEquals(svg.includes('hsl('), false);
        await Deno.remove('test/test-faces.svg');
    });

    await t.step('Command keeps optional view3d for svg export', () => {
        const model = new Model().init(200, 200);
        const view3d = {modelView: new Float32Array(16), updateCanvasCoords() {}};
        // deno-lint-ignore no-explicit-any
        const cmd = new Command(model, view3d as any);
        assertEquals(cmd.view3d, view3d);
    });

    await t.step('jsonFoldToModel preserves 3D z', () => {
        const fold = {
            file_spec: 1.1,
            frame_attributes: ['3D'],
            vertices_coords: [[0, 0, 5], [100, 0, 5], [100, 100, 0], [0, 100, 0]],
            edges_vertices: [[0, 1], [1, 2], [2, 3], [3, 0]],
            faces_vertices: [[0, 1, 2, 3]],
        };
        const model = ReadWrite.jsonFoldToModel(JSON.stringify(fold));
        assertEquals(model.points.length, 4);
        const zs = model.points.map((p) => p.z);
        assertEquals(zs.some((z) => z !== 0), true, '3D fold should keep non-zero z');
    });

    await t.step('toJSONFold exports M/V assignments and foldedForm frame', () => {
        const model = new Model().init(200, 200);
        model.splitBy2d(model.points[0], model.points[2]);
        const crease = model.segments.find((s) => s.assignment !== 'B');
        crease.assignment = 'V';
        model.points[2].z = 50;
        const fold = JSON.parse(ReadWrite.toJSONFold(model));
        assertEquals(fold.edges_assignment.includes('B'), true);
        assertEquals(fold.edges_assignment.includes('V'), true);
        assertEquals(Array.isArray(fold.file_frames), true);
        assertEquals(fold.file_frames[0].frame_classes.includes('foldedForm'), true);
        assertEquals(fold.file_frames[0].vertices_coords[2][2], 50);

        const roundTrip = ReadWrite.jsonFoldToModel(JSON.stringify(fold));
        assertEquals(roundTrip.segments.some((s) => s.assignment === 'V'), true);
        assertEquals(roundTrip.points.some((p) => Math.abs(p.z) > 1e-6), true);
    });

    await t.step('writeDiagrams builds multi-step SVG', async () => {
        const script = `d 200 200
across2d p1 p2
valley s4
`;
        const filename = 'test/diagrams.svg';
        const svg = await ReadWrite.writeDiagrams(script, filename);
        assertEquals(svg.includes('Step 1/'), true);
        assertEquals(svg.includes('<line'), true);
        assertEquals((await Deno.readTextFile(filename)).includes('Step'), true);
        await Deno.remove(filename);
    });
});
