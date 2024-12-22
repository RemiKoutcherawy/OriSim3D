import {Model} from '../js/Model.js';
import {Command} from '../js/Command.js';
import {Point} from '../js/Point.js';
import {Interpolator} from '../js/Interpolator.js';

const {test} = QUnit;

QUnit.module('Command', hooks => {
    let model = new Model();
    let cde = new Command(model);

    hooks.beforeEach(function () {
        model.init(-200, -200, 200, 200);
        cde = new Command(model);
    });

    // Utility functions
    test('tokenize', assert => {
        let text = `
    d -200 -200 200 200
    c 0 1 c 0 3 c 0 2; c 1 3 // List of commands
    // Comment
    t 500 ty 180;
    t 1000 r 35 179 8 17 3) // Pas mal
`;
        let tokens = cde.tokenize(text);
        assert.equal(tokens.length, 38, 'Tokenized commands should have 42 token');
    });
    test('listPoints', assert => {
        let tokens = cde.tokenize('0, 1, other');
        let list = cde.listPoints(tokens, 0);
        assert.equal(list.length, 2, 'listPoints should give 2 points');
        // Second point should be (200,-200)
        assert.equal(list[1].x, 200, 'got:' + list[1].x);
        assert.equal(list[1].y, -200, 'got:' + list[1].y);
        assert.equal(list[1].z, 0, 'got:' + list[1].z);
    });
    test('listSegments', assert => {
        let tokens = cde.tokenize('0, 1, other');
        let list = cde.listSegments(tokens, 0);
        assert.equal(list.length, 2, 'listSegments should give 2 segments');
    });
    test('listFaces', assert => {
        let tokens = cde.tokenize('0, 1, other');
        let list = cde.listFaces(tokens, 0);
        assert.equal(list.length, 2, 'listFaces should give 2 faces');
    });

    // Define command
    test('command d define', assert => {
        cde.command('d -200 -200 200 200').anim();
        assert.equal(cde.iToken, 5, 'command should give 9 tokens');
        assert.equal(model.points.length, 4, 'model should have 4 points');
    });

    // Creases
    test('command by : by3d by2d', assert => {
        // By 0 and 2 should produce a new segment 4
        cde.command('by3d 0 2').anim();
        assert.equal(model.points.length, 4, 'b 0 2 should keep 4 points');
        assert.equal(model.segments.length, 5, 'b 0 2 should give 5 segments');
        cde.command('by2d 1 3').anim();
        assert.equal(model.points.length, 5, 'b 0 2 should have 5 points');
        assert.equal(model.segments.length, 8, 'b 0 2 should give 8 segments');
    });
    test('command across3d or c3d', assert => {
        // Cross between 0 and 2 should produce a new segment 1 3
        cde.command('c3d 0 2').anim();
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
        cde.command('c3d 1 3').anim();
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.segments.length, 8, 'Model should have 8 segments');
    });
    test('command across2d or c2d', assert => {
        // Cross between 0 and 2 should produce a new segment 1 3
        cde.command('c2d 0 3').anim();
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 6, 'Model should have 6 points');
        assert.equal(model.segments.length, 7, 'Model should have 7 segments');
    });
    test('command cross c2d', assert => {
        // Cross between 0 and 2 should produce a new segment 1 3
        cde.command('c2d 0 2').anim();
        assert.equal(model.faces.length, 2, 'Model should have 2 faces');
        assert.equal(model.points.length, 4, 'Model should have 4 points');
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
        // Cross between 1 and 3 should produce two new segments 0 4 and 4 2
        cde.command('c2d 1 3').anim();
        assert.equal(model.faces.length, 4, 'Model should have 4 faces');
        assert.equal(model.points.length, 5, 'Model should have 5 points');
        assert.equal(model.segments.length, 8, 'Model should have 8 segments');
    });
    test('command p or perpendicular', assert => {
        // Split on edge, segment 0 point 1, no change
        cde.command('p 0 1').anim();
        assert.equal(model.segments.length, 4, 'Model should have 4 segments');
        // Add center point 4 and split perpendicular to seg 0 passing by 4
        model.points.push(new Point(0, 0, 0, 0, 0));
        cde.command('p 0 4').anim();
        assert.equal(model.segments.length, 7, 'Model should have 7 segments');
    });
    test('command bisector2d', assert => {
        // Split on bisector between bottom and right edge
        cde.command('bisector2d 0 1').anim();
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });
    test('command bisector3d', assert => {
        // Split on bisector between bottom and right edge
        cde.command('bisector3d 0 1').anim();
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });
    test('command bisector2dPoints', assert => {
        // Split on bisector by leftBottom rightBottom and upRight points
        cde.command('bisector2dPoints 0 1 2').anim();
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });
    test('command bisector3dPoints', assert => {
        // Split on bisector by leftBottom rightBottom and upRight points
        cde.command('bisector3dPoints 0 1 2').anim();
        assert.equal(model.segments.length, 5, 'Model should have 5 segments');
    });
    test('command splitSegment2d', assert => {
        // Split by ratio n / d
        cde.command('splitSegment2d 0 1 2').anim();
        assert.equal(model.points.length, 5, 'Model should have 5 points');
    });
    test('command r rotate', assert => {
        let pt = model.points[2];
        // Rotate with axe bottom edge [0,1] by 90 points 0,2
        cde.command('rotate 0 90 0 2').anim();
        assert.equal(Math.round(pt.x), 200, 'Should keep x at 200');
        assert.equal(Math.round(pt.y), -200, 'Should move y from 200 to -200');
        assert.equal(Math.round(pt.z), 400, 'Should move y from 0 to 400');
        // Should not move
        pt = model.points[0];
        assert.equal(Math.round(pt.x), -200, 'got:' + pt.x);
        assert.equal(Math.round(pt.y), -200, 'got:' + pt.y);
        assert.equal(Math.round(pt.z), 0, 'got:' + pt.z);
    });
    test('command moveOn', assert => {
        let pt = model.points[2];
        assert.equal(Math.round(pt.x), 200, 'Should be at 200');
        // moveOn
        cde.command('moveOn 0 2').anim();
        assert.equal(Math.round(pt.x), -200, 'Should move x at -200');
        assert.equal(Math.round(pt.y), -200, 'Should move y at -200');
    });
    test('command move', assert => {
        let pt = model.points[2];
        assert.equal(Math.round(pt.x), 200, 'Should be at 200');
        // move
        cde.command('move 1 1 1 2').anim();
        assert.equal(Math.round(pt.x), 201, 'Should move x at 201');
        assert.equal(Math.round(pt.y), 201, 'Should move y at 201');
        assert.equal(Math.round(pt.z), 1, 'Should move z at 1');
    });
    test('command adjust', assert => {
        let pt = model.points[2];
        assert.equal(Math.round(pt.x), 200, 'Should be at 200');
        // move then  adjust
        cde.command('move 10 1 0 2').anim();
        assert.equal(Math.round(pt.x), 210, 'Should move x at 210');
        cde.command('adjust 2').anim();
        assert.equal(Math.round(pt.x), 200, 'Should move x at 200');
        assert.equal(Math.round(pt.y), 200, 'Should move y at 200');
        assert.equal(Math.round(pt.z), 0, 'Should move z at 0');
    });

    test('multiline command', assert => {
        cde.command(`
        by2d 0 2
        by3d 1 3
        `);
        while (cde.anim()){}
        assert.equal(model.points.length, 5, 'b 0 2 should have 5 points');
        assert.equal(model.segments.length, 8, 'b 0 2 should give 8 segments');
    });

    // Undo
    test('undo', assert => {
        cde.command('d -200 -200 200 200').anim();
        assert.equal(Math.round(model.points[2].y), 200, 'Should have y 200');
        // Rotate around axe [0,1] by 90 points [2,3]
        cde.command('rotate 0 90 2 3');
        while(cde.anim()) {} // Wait for animation to finish
        assert.equal(Math.round(model.points[2].y), -200, 'Should move y from 200 to -200');
        // Undo
        cde.command('undo');
        while(cde.anim()) {} // Wait for animation to finish
        assert.equal(Math.round(model.points[2].y), 200, 'Should revert y to 200');
    });
    test('undo', assert => {
        cde.command('d -200 -200 200 200').anim();
        assert.equal(Math.round(model.points[2].y), 200, 'Should have y 200');
        // Rotate around axe [0,1] by 90 points [2,3]
        cde.command('time 10 rotate 0 90 2 3;');
        while(cde.anim()) {
            // console.log(model.points[2].y);
        } // Wait for animation to finish
        assert.equal(Math.round(model.points[2].y), -200, 'Should move y from 200 to -200');
        // Undo
        cde.command('undo');
        while(cde.anim()) {} // Wait for animation to finish
        assert.equal(Math.round(model.points[2].y), 200, 'Should revert y to 200');
    });

    // Animation commands
    test('command t 10 rotate 0 90 2 3;', async assert => {
        cde.command('t 10 rotate 0 90 2 3;');
        while(cde.anim()) {} // Wait for animation to finish
        const pt = model.points[2]; // Should move to 200,-200,400
        assert.equal(Math.round(pt.x), 200, 'Should keep x at 200');
        assert.equal(Math.round(pt.y), -200, 'Should move y from 200 to -200');
        assert.equal(Math.round(pt.z), 400, 'Should move y from 0 to 400');
    });

    // Presentation commands
    test('command tx ty tz', assert => {
        cde.command('c3d 0 1 c3d 0 3 c3d 0 2 c3d 1 3').anim();
        cde.command('c3d 0 8 c3d 8 3 c3d 0 4 c3d 4 1').anim();
        cde.command('c3d 6 0 c3d 6 1 c3d 6 2 c3d 6 3').anim();
        cde.command('t 10 r 48 179 21 0 10)');
        while(cde.anim()) {}
        cde.command('ty 90').anim();
        assert.equal(model.segments.length, 56, 'got:' + model.segments.length);
        assert.equal(model.points.length, 25, 'got:' + model.points.length);
    });

    test('command turn 180', assert => {
        cde.command('turn 0 1 0 180').anim();
        assert.equal(Math.round(model.points[0].x), 200, 'Point should be at 200,0');
        assert.equal(Math.round(model.points[1].x), -200, 'Point should be at -200,0');
    });
    test('end', assert => {
        // Should not execute after end
        cde.command('d -200 -200 200 200 end c 0 2 c 1 3').anim();
        assert.equal(model.segments.length, 4, 'got:' + model.segments.length);
        assert.equal(model.points.length, 4, 'got:' + model.points.length);
    });
    // Interpolator
    test('Interpolator', assert => {
        cde.command('il').anim();
        assert.equal(cde.interpolator, Interpolator.LinearInterpolator, 'Got' + cde.interpolator);
        cde.command('iad').anim();
        assert.equal(cde.interpolator, Interpolator.AccelerateDecelerateInterpolator, 'Got' + cde.interpolator);
        cde.command('iso').anim();
        assert.equal(cde.interpolator, Interpolator.SpringOvershootInterpolator, 'Got' + cde.interpolator);
        cde.command('isb').anim();
        assert.equal(cde.interpolator, Interpolator.SpringBounceInterpolator, 'Got' + cde.interpolator);
        cde.command('igb').anim();
        assert.equal(cde.interpolator, Interpolator.GravityBounceInterpolator, 'Got' + cde.interpolator);
        cde.command('ib').anim();
        assert.equal(cde.interpolator, Interpolator.BounceInterpolator, 'Got' + cde.interpolator);
        cde.command('io').anim();
        assert.equal(cde.interpolator, Interpolator.OvershootInterpolator, 'Got' + cde.interpolator);
        cde.command('ia').anim();
        assert.equal(cde.interpolator, Interpolator.AnticipateInterpolator, 'Got' + cde.interpolator);
        cde.command('iao').anim();
        assert.equal(cde.interpolator, Interpolator.AnticipateOvershootInterpolator, 'Got' + cde.interpolator);
    });
    // Offset
    test('command offset', assert => {
        cde.command('c3d 0 2').anim();
        cde.command('o 42  1').anim();
        assert.equal(model.faces[0].offset, 0, 'Got:' + model.faces[0].offset);
        assert.equal(model.faces[1].offset, 42, 'Got:' + model.faces[1].offset);
    });
});
