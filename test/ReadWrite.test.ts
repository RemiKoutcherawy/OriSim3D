import {ReadWrite} from "../js/ReadWrite.js";
import {Model} from "../js/Model.js";
import {assertEquals} from "jsr:@std/assert";

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
        let model = new Model();
        model.init(200, 200);
        let json = ReadWrite.toJSONFold(model);
        let model2 = ReadWrite.jsonFoldToModel(json);
        assertEquals(model.points.length, model2.points.length, "Points length should be equal");
        assertEquals(model.segments.length, model2.segments.length, "Segments length should be equal");
        assertEquals(model.faces.length, model2.faces.length, "Faces length should be equal");
    });
});
