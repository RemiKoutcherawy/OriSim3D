import {Model} from '../js/Model.js';
import {Command} from '../js/Command.js';
import {Helper2d} from '../js/Helper2d.js';

const {test} = QUnit;

QUnit.module('Model', hooks => {
    let model = new Model();
    let command = new Command(model);
    let helper = new Helper2d(null, model, command);

    hooks.beforeEach(function () {
        // Runs once before each test in the module
        model.init(-200, -200, 200, 200);
    });

    test('searchPoints2d', assert => {
        assert.equal(helper.searchPoints2d(200, 200)[0], model.points[2], '3rd point');
        assert.equal(helper.searchPoints2d(202, 202)[0], model.points[2], '3rd point');
        assert.equal(helper.searchPoints2d(210, 210)[0], null, 'no point');
    });

    test('searchSegments2d', assert => {
        let s0 = model.segments[0];
        // Should find first segment.
        let segments = helper.searchSegments2d(s0.p1.xf, s0.p1.yf);
        assert.equal(segments.length, 2, 'Model two first segments should be found');
        assert.equal(model.segments[0], segments[0], 'Model first segment should be found');
        // Should not find any segment
        segments = helper.searchSegments2d(0, 0);
        assert.equal(segments.length, 0, 'Model should not have segment 0 2');
    });

    test('searchFaces2d', assert => {
        // Should find first face.
        let faces = helper.searchFaces2d(0, 0);
        assert.equal(faces.length, 1, 'Model first face should be found');
        assert.equal(faces[0], model.faces[0], 'Model first face should be found');
        // Should not find any face
        faces = helper.searchFaces2d(400, 400);
        assert.equal(faces.length, 0, 'Face should not be found');
    });

    test('hover2d', assert => {
        // Hover on point, segment and face
        helper.hover2d(-200, -200);
        assert.equal(model.points[0].hover, true, 'First point hovered');
        assert.equal(model.segments[0].hover, false, 'No segment hovered');
        assert.equal(model.faces[0].hover, false, 'No face hovered');
        helper.hover2d(0, -200);
        assert.equal(model.points[0].hover, false, 'No point hovered');
        assert.equal(model.segments[0].hover, true, 'First segment hovered');
        assert.equal(model.faces[0].hover, false, 'No face hovered');
        helper.hover2d(0, 0);
        assert.equal(model.points[0].hover, false, 'No point hovered');
        assert.equal(model.segments[0].hover, false, 'No segment hovered');
        assert.equal(model.faces[0].hover, true, 'First face hovered');
    });

    test('click2d', assert => {
        // Click on point, segment and face
        helper.click2d({xf: -200, yf: -200});
        assert.equal(model.points[0].select, 1, 'First point selected');
        assert.equal(model.segments.some(s => s.select !== 0), false, 'No segment selected');
        assert.equal(model.faces.some(f => f.select !== 0), false, 'No face selected');
        helper.click2d({xf: -200, yf: -200});
        assert.equal(model.points[0].select, 2, 'First point double selected');
        helper.click2d({xf: -200, yf: -200});
        assert.equal(model.points[0].select, 0, 'First point deselected');
        helper.click2d({xf: 0, yf: -200});
        assert.equal(model.points.some(p => p.select !== 0), false, 'No point selected');
        assert.equal(model.segments[0].select, 1, 'First segment selected');
        assert.equal(model.faces.some(f => f.select !== 0), false, 'No face selected');
        helper.click2d({xf: 0, yf: -200});
        assert.equal(model.segments[0].select, 2, 'First segment double selected');
        helper.click2d({xf: 0, yf: -200});
        assert.equal(model.segments[0].select, 0, 'First segment deselected');
        helper.click2d({xf: 0, yf: 0});
        assert.equal(model.points.some(p => p.select !== 0), false, 'No point selected');
        assert.equal(model.segments.some(s => s.select !== 0), false, 'No segment selected');
        assert.equal(model.faces[0].select, 1, 'First face selected');
        helper.click2d({xf: 0, yf: 0});
        assert.equal(model.faces[0].select, 2, 'Face selected');
    });

});
