import {ReadWrite} from "../js/ReadWrite.js";
import {Model} from "../js/Model.js";
import {Point} from "../js/Point.js";
import {Command} from "../js/Command.js";
import {assertEquals} from "@std/assert";

Deno.test("ReadWrite", async (t) => {

    await t.step('readFileAsText', async () => {
        const text = await ReadWrite.readFileAsText('models/box.fold');
        if (text) assertEquals((text as String).length, 4322, "writeFold should be tested");
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
        const command = new Command(model, {angleX: 0, angleY: 0, angleZ: 0});
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
        const kindFold = ReadWrite.loadText(command, json);
        assertEquals(kindFold, 'fold');
        assertEquals(command.model.points[0] instanceof Point, true);
        assertEquals(command.model.labels, false, 'display flags are kept');
        assertEquals(area.textarea.value, '');
        assertEquals(command.model.points.length, 4);
    });
});
