import {Model} from "../js/Model.js";
import {QUnit} from './qunit/qunit';

const {test} = QUnit;

QUnit.module('Serialize', () => {
    const model = new Model();
    model.init(-200, -200, 200, 200);

    // Serialize with replacer / Deserialize with reviver
    test('serialize / deserialize', assert => {
        model.init(-200, -200, 200, 200);

        // Serialize
        let serialized = model.serialize();
        // {"points":[{"xf":-200,"yf":-200,"x":-200,"y":-200,"z":0,"xCanvas":0,"yCanvas":0},...,"segments":[{"p1":0,"p2":1},...,"faces":[[0,1,2,3]]}
        assert.equal(serialized.length, 491, "serialized model should have length 491");

        // Change model, should not affect serialized
        model.addPoint(0, 0, 0, 0, 0);
        model.addSegment(model.points[0], model.points[1]);
        model.addFace([model.points[2], model.points[3]]);

        // Deserialize
        Object.assign(model, model.deserialize(serialized));
        // console.log(model.deserialize(serialized));
        // {"points":[{"xf":-200,"yf":-200,"x":-200,"y":-200,"z":0,"xCanvas":0,"yCanvas":0},...,"segments":[{"p1":0,"p2":1},...,"faces":[[0,1,2,3]]}
        assert.equal(model.points.length, 4, "deserialized should have 4 points");
        assert.equal(model.segments.length, 4, "deserialized should have 4 segments");
        assert.equal(model.faces.length, 1, "deserialized should have 1 face");
    });
});
