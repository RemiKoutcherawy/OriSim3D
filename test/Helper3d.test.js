import {Model} from '../js/Model.js';
import {Command} from '../js/Command.js';
import {Helper3d} from '../js/Helper3d.js';

const {test} = QUnit;

QUnit.module('Model', hooks => {
    let model = new Model();
    let command= new Command(model);
    let helper = new Helper3d(null, null, model, command);

    hooks.beforeEach(function () {
        // Runs once before each test in the module
        model.init(-200, -200, 200, 200);
    });

    test('searchPointsCanvas3d', assert => {
        model.points[2].xCanvas = 200;
        model.points[2].yCanvas = 200;
        let points = helper.searchPointsCanvas3d(200, 200);
        assert.equal(points.length, 1, '3rd point');
        assert.equal(points[0], model.points[2], '3rd point');
        assert.equal(helper.searchPointsCanvas3d(210, 210)[0], null, 'no point');
    });

    test('searchSegmentsCanvas3d', assert => {
        // Should find all segments
        let segments = helper.searchSegmentsCanvas3d(0, 0);
        assert.equal(segments.length, 4, 'All 4 segments should be found, since they have xCanvas and yCanvas = 0');
        assert.equal(segments[0], model.segments[0], 'Model first segment should be found');
        // Should not find any segment
        segments = helper.searchSegmentsCanvas3d(40, 40);
        assert.equal(segments.length, 0, 'Model should not have segment 0 2');
    });

    test('searchFacesCanvas3d', assert => {
        // With Canvas coords should find first face.
        for (let i = 0; i < model.points.length; i++) {
            model.points[i].xCanvas = model.points[i].x;
            model.points[i].yCanvas = model.points[i].y;
        }
        let faces = helper.searchFacesCanvas3d(0, 0);
        assert.equal(faces.length, 1, 'Model first face should be found');
        assert.equal(faces[0], model.faces[0], 'Model first face should be found');
        // Should not find any face
        faces = helper.searchFacesCanvas3d(400, 400, 0);
        assert.equal(faces.length, 0, 'Face should not be found');
    });

    test('hover3d', assert => {
        // Hover on point, segment and face
        for (let i = 0; i < model.points.length; i++) {
            model.points[i].xCanvas = model.points[i].x;
            model.points[i].yCanvas = model.points[i].y;
        }
        helper.hover3d(-200, -200);
        assert.equal(model.points[0].hover, true, 'First point hovered');
        assert.equal(model.segments[0].hover, false, 'No segment hovered');
        assert.equal(model.faces[0].hover, false, 'No face hovered');
        helper.hover3d(0, -200);
        assert.equal(model.points[0].hover, false, 'No point hovered');
        assert.equal(model.segments[0].hover, true, 'First segment hovered');
        assert.equal(model.faces[0].hover, false, 'No face hovered');
        helper.hover3d(0, 0);
        assert.equal(model.points[0].hover, false, 'No point hovered');
        assert.equal(model.segments[0].hover, false, 'No segment hovered');
        assert.equal(model.faces[0].hover, true, 'First face hovered');
    });

    test('select', assert => {
        // Select point, segment and face
        model.click2d3d([model.points[0]], [], []);
        assert.equal(model.points[0].select, 1, 'First point selected');
        assert.equal(model.segments[0].select, 0, 'No segment selected');
        assert.equal(model.faces[0].select, false, 'No face selected');
        model.click2d3d([], [model.segments[0]], []);
        assert.equal(model.points[0].select, 1, 'First point selected');
        assert.equal(model.segments[0].select, true, 'First segment selected');
        assert.equal(model.faces[0].select, 0, 'No face selected');
        model.click2d3d([], [], [model.faces[0]]);
        assert.equal(model.points[0].select, 1, 'First point selected');
        assert.equal(model.segments[0].select, true, 'First segment selected');
        assert.equal(model.faces[0].select, 1, 'First face selected');
    });

});
