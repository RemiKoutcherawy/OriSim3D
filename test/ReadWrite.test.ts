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

    await t.step('jsonFoldToModel reads a flat-foldable crease pattern with M/V/B assignment', () => {
        // Single interior vertex, 4 creases, alternating mountain/valley (Kawasaki-valid)
        const fold = {
            file_spec: 1.1,
            frame_classes: ['creasePattern'],
            vertices_coords: [[0, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]],
            edges_vertices: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]],
            edges_assignment: ['M', 'v', 'M', 'V', 'B', 'B', 'B', 'B'],
            faces_vertices: [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1]],
        };
        const model = ReadWrite.jsonFoldToModel(JSON.stringify(fold));
        assertEquals(model.segments.length, 8);
        assertEquals(model.segments[0].assignment, 'M');
        assertEquals(model.segments[1].assignment, 'V', 'lowercase v is normalized to V');
        assertEquals(model.segments[2].assignment, 'M');
        assertEquals(model.segments[3].assignment, 'V');
        assertEquals(model.segments[4].assignment, 'B', 'boundary edge');
        // Loaded as a flat crease pattern: still unfolded (z=0)
        assertEquals(model.points.every((p) => p.z === 0), true, 'crease pattern loads flat');
    });

    await t.step('jsonFoldToModel defaults missing or invalid assignment to U', () => {
        const fold = {
            vertices_coords: [[0, 0], [1, 0], [1, 1]],
            edges_vertices: [[0, 1], [1, 2], [2, 0]],
            edges_assignment: ['M', 'bogus'], // third edge has no entry at all
            faces_vertices: [[0, 1, 2]],
        };
        const model = ReadWrite.jsonFoldToModel(JSON.stringify(fold));
        assertEquals(model.segments[0].assignment, 'M');
        assertEquals(model.segments[1].assignment, 'U', 'invalid assignment falls back to U');
        assertEquals(model.segments[2].assignment, 'U', 'missing assignment falls back to U');
    });

    await t.step('jsonFoldToModel reads real M/V/B assignment from models/box.fold', async () => {
        const text = await ReadWrite.readFileAsText('models/box.fold');
        const model = ReadWrite.jsonFoldToModel(text as string);
        const counts: Record<string, number> = {M: 0, V: 0, B: 0, U: 0, F: 0};
        for (const s of model.segments) counts[s.assignment] = (counts[s.assignment] ?? 0) + 1;
        assertEquals(counts.M > 0, true, 'has mountain creases');
        assertEquals(counts.V > 0, true, 'has valley creases');
        assertEquals(counts.B > 0, true, 'has boundary edges');
        assertEquals(counts.U, 0, 'every edge in the file got a real assignment');
    });
});
