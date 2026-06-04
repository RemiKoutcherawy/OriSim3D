import {ReadWrite} from "../js/ReadWrite.js";
import {Model} from "../js/Model.js";
import {assertEquals} from "jsr:@std/assert";

Deno.test("ReadWrite", async (t) => {

    await t.step('readFileAsText', () => {
        ReadWrite.readFileAsText('models/box.fold').then((text) => {
            if (text) assertEquals((text as String).length, 4322, "writeFold should be tested");
        })
    });
    await t.step('writeFold', () => {
        let model = new Model();
        model.init(200, 200);
        let filename = 'test/test.fold';
        ReadWrite.writeFold(model, filename).then(json => {
            assertEquals(json.length, 445, "writeFold should be tested");
        }).then( () => {
            Deno.remove(filename);
        });
    });
});
