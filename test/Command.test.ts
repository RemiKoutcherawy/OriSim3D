import { Model } from '../js/Model.js';
import { Command } from '../js/Command.js';
import { Point } from '../js/Point.js';
import { Interpolator } from '../js/Interpolator.js';
import { assertEquals } from "jsr:@std/assert";

Deno.test('Command', async (t) => {
    const model = new Model().init(200, 200);
    const view = {angleX:0, angleY:0, angleZ:0};
    const cde = new Command(model, view);

    await t.step('tokenize', () => {
        const text = `
    d 200 200
    c 0 1 c 0 3 c 0 2; c 1 3 // List of commands
    // Comment
    t 500 ty 180;
    t 1000 r 35 179 8 17 3) // Pas mal
`;
        const tokens = cde.tokenize(text);
        assertEquals(tokens.length, 36);
    });

    await t.step('listPoints', () => {
        const tokens = cde.tokenize('0 1');
        const list = cde.listPoints(tokens, 0);
        assertEquals(list.length, 2);
        // The second point should be (200,-200)
        assertEquals(list[1].x, 200);
        assertEquals(list[1].y, -200);
        assertEquals(list[1].z, 0);
    });

    await t.step('listSegments', () => {
        const tokens = cde.tokenize('0 1');
        const list = cde.listSegments(tokens, 0);
        assertEquals(list.length, 2);
    });

    await t.step('listFaces', () => {
        const tokens = cde.tokenize('0 1');
        const list = cde.listFaces(tokens, 0);
        assertEquals(list.length, 2);
    });

    // Define command
    await t.step('command d define', () => {
        cde.command('d 200 200').anim();
        assertEquals(cde.iToken, 3);
        assertEquals(model.points.length, 4);
    });

    // Creases
    await t.step('command by : by3d by2d', () => {
        cde.command('d 200 200').anim();
        cde.command('by3d 0 2').anim();
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        cde.command('by2d 1 3').anim();
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    await t.step('command across3d or c3d', () => {
        // Cross between 0 and 2 should produce a new segment 1 3
        cde.command('d 200 200').anim();
        cde.command('c3d 0 2').anim();
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        cde.command('c3d 1 3').anim();
        assertEquals(model.faces.length, 4);
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    await t.step('command across2d or c2d', () => {
        cde.command('d 200 200').anim();
        cde.command('c2d 0 3').anim();
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 6);
        assertEquals(model.segments.length, 7);
    });

    await t.step('command cross c2d', () => {
        cde.command('d 200 200').anim();
        cde.command('c2d 0 2').anim();
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        cde.command('c2d 1 3').anim();
        assertEquals(model.faces.length, 4);
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    await t.step('command perpendicular 3d', () => {
        cde.command('d 200 200').anim();
        cde.command('p3d 0 1').anim();
        assertEquals(model.segments.length, 4);
        model.points.push(new Point(0, 0, 0, 0, 0));
        cde.command('p3d 0 4').anim();
        assertEquals(model.segments.length, 7);
    });
    await t.step('command perpendicular 2d', () => {
        cde.command('d 200 200').anim();
        cde.command('p2d 0 1').anim();
        assertEquals(model.segments.length, 4);
        model.points.push(new Point(0, 0, 0, 0, 0));
        cde.command('p2d 0 4').anim();
        assertEquals(model.segments.length, 5);
    });
    await t.step('command bisector2d', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector2d 0 1').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command bisector3d', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector3d 0 1').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command bisector2dPoints', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector2dPoints 0 1 2').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command bisector3dPoints', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector3dPoints 0 1 2').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command splitSegment2d', () => {
        // Split by ratio n / d
        cde.command('d 200 200').anim();
        cde.command('splitSegment2d 0 1 2').anim();
        assertEquals(model.points.length, 5);
    });

    await t.step('command r rotate', () => {
        cde.command('d 200 200').anim();
        let pt = model.points[2];
        // Rotate with axe bottom edge [0,1] by 90 points 0,2
        cde.command('rotate 0 90 0 2').anim();
        assertEquals(Math.round(pt.x), 200);
        assertEquals(Math.round(pt.y), -200);
        assertEquals(Math.round(pt.z), 400);
        pt = model.points[0];
        assertEquals(Math.round(pt.x), -200);
        assertEquals(Math.round(pt.y), -200);
        assertEquals(Math.round(pt.z), 0);
    });

    await t.step('command moveOnPoint', () => {
        cde.command('d 200 200').anim();
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        cde.command('moveOnPoint 0 2').anim();
        assertEquals(Math.round(pt.x), -200);
        assertEquals(Math.round(pt.y), -200);
    });

    await t.step('command move', () => {
        cde.command('d 200 200').anim();
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        cde.command('move 10 20 30 2').anim();
        assertEquals(Math.round(pt.x), 210);
        assertEquals(Math.round(pt.y), 220);
        assertEquals(Math.round(pt.z), 30);
    });

    await t.step('command adjust', () => {
        cde.command('d 200 200').anim();
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        cde.command('move 10 1 0 2').anim();
        assertEquals(Math.round(pt.x), 210);
        cde.command('adjust 2').anim();
        assertEquals(Math.round(pt.x), 200);
        assertEquals(Math.round(pt.y), 200);
        assertEquals(Math.round(pt.z), 0);
    });

    await t.step('multiline command', () => {
        cde.command('d 200 200').anim();
        cde.command(`
        by2d 0 2
        by3d 1 3
        `);
        while (cde.anim()){/* wait for animation to finish */}
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    // Undo
    await t.step('undo', () => {
        cde.command('d 200 200').anim();
        cde.command('d 200 200').anim();
        assertEquals(Math.round(model.points[2].y), 200);
        // Rotate around axe [0,1] by 90 points [2,3]
        cde.command('rotate 0 90 2 3');
        while(cde.anim()) {/* wait for animation to finish */}
        assertEquals(Math.round(model.points[2].y), -200);
        // Undo
        cde.command('undo');
        while(cde.anim()) {/* wait for animation to finish */}
        assertEquals(Math.round(model.points[2].y), 200);
    });

    await t.step('undo', () => {
        cde.command('d 200 200').anim();
        assertEquals(Math.round(model.points[2].y), 200);
        cde.command('time 10 rotate 0 90 2 3;');
        while(cde.anim()) {/* wait for animation to finish */}
        assertEquals(Math.round(model.points[2].y), -200);
        cde.command('undo');
        while(cde.anim()) {/* wait for animation to finish */}
        assertEquals(Math.round(model.points[2].y), 200);
    });

    // Animation commands
    await t.step('command t 10 rotate 0 90 2 3;', () => {
        cde.command('t 10 rotate 0 90 2 3;');
        while(cde.anim()) {/* wait for animation to finish */}
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        assertEquals(Math.round(pt.y), -200);
        assertEquals(Math.round(pt.z), 400);
    });

    // Presentation commands
    await t.step('command tx ty tz', () => {
        cde.command('d 200 200').anim();
        cde.command('c3d 0 1 c3d 0 3 c3d 0 2 c3d 1 3').anim();
        cde.command('c3d 0 8 c3d 8 3 c3d 0 4 c3d 4 1').anim();
        cde.command('c3d 6 0 c3d 6 1 c3d 6 2 c3d 6 3').anim();
        cde.command('t 10 r 48 179 21 0 10)').anim();
        while(cde.anim()) {/* wait for animation to finish */}
        cde.command('ty 90').anim();
        assertEquals(model.segments.length, 56);
        assertEquals(model.points.length, 25);
    });

    await t.step('command turn 180', () => {
        cde.command('d 200 200').anim();
        cde.command('tx 180').anim();
        // Model is not modified only view is rotated
        assertEquals(Math.round(model.points[0].x), -200);
        assertEquals(Math.round(model.points[1].x), 200);
        // View is turned
        assertEquals(view.angleX, 180 * (Math.PI / 180));
        cde.command('ty 180').anim();
        assertEquals(view.angleY, 180 * (Math.PI / 180));
    });

    await t.step('end', () => {
        cde.command('d 200 200 end c 0 2 c 1 3').anim();
        assertEquals(model.segments.length, 4);
        assertEquals(model.points.length, 4);
    });
    // Interpolator
    await t.step('Interpolator', () => {
        cde.command('d 200 200').anim();
        cde.command('il').anim();
        assertEquals(cde.interpolator, Interpolator.LinearInterpolator);
        cde.command('iad').anim();
        assertEquals(cde.interpolator, Interpolator.AccelerateDecelerateInterpolator);
        cde.command('iso').anim();
        assertEquals(cde.interpolator, Interpolator.SpringOvershootInterpolator);
        cde.command('isb').anim();
        assertEquals(cde.interpolator, Interpolator.SpringBounceInterpolator);
        cde.command('igb').anim();
        assertEquals(cde.interpolator, Interpolator.GravityBounceInterpolator);
        cde.command('ib').anim();
        assertEquals(cde.interpolator, Interpolator.BounceInterpolator);
        cde.command('io').anim();
        assertEquals(cde.interpolator, Interpolator.OvershootInterpolator);
        cde.command('ia').anim();
        assertEquals(cde.interpolator, Interpolator.AnticipateInterpolator);
        cde.command('iao').anim();
        assertEquals(cde.interpolator, Interpolator.AnticipateOvershootInterpolator);
    });
    // Offset
    await t.step('command offset', () => {
        cde.command('d 200 200').anim();
        cde.command('c3d 0 2').anim();
        cde.command('o 42  1').anim();
        assertEquals(model.faces[0].offset, 0);
        assertEquals(model.faces[1].offset, 0.00042);
    });
});
