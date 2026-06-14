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
    c P0 P1 c P0 P3 c P0 P2; c P1 P3 // List of commands
    // Comment
    t 500 ty 180;
    t 1000 r S35 179 P8 P17 P3 // Pas mal
`;
        const tokens = cde.tokenize(text);
        assertEquals(tokens.length, 30);
    });

    await t.step('listObjects P', () => {
        const tokens = cde.tokenize('P0 p1 pX p2\n');
        const list = cde.listObjects(tokens, 0, 'P');
        assertEquals(list.length, 2);
        // The second point should be (200,-200)
        assertEquals(list[1].x, 200);
        assertEquals(list[1].y, -200);
        assertEquals(list[1].z, 0);
    });
    await t.step('listObjects P99', () => {
        const tokens = cde.tokenize('P0 P1 P99'); // P99 is not a point
        const list = cde.listObjects(tokens, 0, 'P')
        assertEquals(list.length, 2);
    });
    await t.step('listObjects S', () => {
        const tokens = cde.tokenize('S0 S1 ');
        const list = cde.listObjects(tokens, 0, 'S');
        assertEquals(list.length, 2);
    });
    await t.step('listObjects F', () => {
        const tokens = cde.tokenize('F0 F1');
        const list = cde.listObjects(tokens, 0, 'F');
        assertEquals(list.length, 1);
    });

    // Define command
    await t.step('command d define', () => {
        cde.command('d 200 200').anim();
        assertEquals(cde.iToken, 3);
        assertEquals(model.points.length, 4);
    });

    // Creases
    await t.step('command by : by3d by2d', () => {
        cde.command('by3d P0 P2').anim();
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        cde.command('by2d P1 P3').anim();
        // cde.tokenTodo = cde.tokenize('by3d P0 P2 by2d P1 P3');
        // cde.iToken = 0;
        // cde.execute(cde.iToken);
        // cde.execute(cde.iToken);
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    await t.step('command across3d or c3d', () => {
        // Cross between 0 and 2 should produce a new segment 1 3
        cde.command('d 200 200').anim();
        cde.command('c3d P0 P2').anim();
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        cde.command('c3d P1 P3').anim();
        assertEquals(model.faces.length, 4);
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    await t.step('command across2d or c2d', () => {
        cde.command('d 200 200').anim();
        cde.command('c2d P0 P3').anim();
        cde.tokenTodo = cde.tokenize('c2d P0 P3');
        cde.iToken = 0;
        cde.execute(cde.iToken);
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 6);
        assertEquals(model.segments.length, 7);
    });

    await t.step('command cross c2d', () => {
        cde.command('d 200 200').anim();
        cde.command('c2d P0 P2').anim();
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        cde.command('c2d P1 P3').anim();
        assertEquals(model.faces.length, 4);
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    await t.step('command perpendicular 3d', () => {
        cde.command('d 200 200').anim();
        cde.command('p3d S0 P1').anim();
        assertEquals(model.segments.length, 4);
        model.points.push(new Point(0, 0, 0, 0, 0));
        cde.command('p3d S0 P4').anim();
        assertEquals(model.segments.length, 7);
    });
    await t.step('command perpendicular 2d', () => {
        cde.command('d 200 200').anim();
        cde.command('p2d S0 P1').anim();
        assertEquals(model.segments.length, 4);
        model.points.push(new Point(0, 0, 0, 0, 0));
        cde.command('p2d S0 P4').anim();
        assertEquals(model.segments.length, 5);
    });
    await t.step('command bisector2d', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector2d S0 S1').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command bisector3d', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector3d S0 S1').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command bisector2dPoints', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector2dPoints P0 P1 P2').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command bisector3dPoints', () => {
        cde.command('d 200 200').anim();
        cde.command('bisector3dPoints P0 P1 P2').anim();
        assertEquals(model.segments.length, 5);
    });

    await t.step('command splitSegment2d', () => {
        // Split by ratio n / d
        cde.command('d 200 200').anim();
        cde.command('splitSegment2d S0 0.5').anim();
        cde.command('splitSegment2d S0 1').anim();
        cde.command('splitSegment2d S0 -1').anim();
        assertEquals(model.points.length, 5);
    });

    await t.step('command r rotate', () => {
        cde.command('d 200 200').anim();
        let pt = model.points[2];
        // Rotate with axe bottom edge [0,1] by 90 points 0,2
        cde.command('rotate S0 90 P0 P2').anim();
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
        cde.command('moveOnPoint P0 P2').anim();
        assertEquals(Math.round(pt.x), -200);
        assertEquals(Math.round(pt.y), -200);
    });

    await t.step('command move', () => {
        cde.command('d 200 200').anim();
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        cde.command('move 10 20 30 P2').anim();
        assertEquals(Math.round(pt.x), 210);
        assertEquals(Math.round(pt.y), 220);
        assertEquals(Math.round(pt.z), 30);
    });

    await t.step('command adjust', () => {
        cde.command('d 200 200').anim();
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        cde.command('move 10 1 0 P2').anim();
        assertEquals(Math.round(pt.x), 210);
        cde.command('adjust 2').anim();
        assertEquals(Math.round(pt.x), 200);
        assertEquals(Math.round(pt.y), 201);
        assertEquals(Math.round(pt.z), 0);
    });

    await t.step('multiline command', () => {
        cde.command('d 200 200').anim();
        cde.command(`
        by2d P0 P2
        by3d P1 P3
        `);
        while(cde.anim()) {/* wait for all commands to finish */}
        assertEquals(model.points.length, 5);
        assertEquals(model.segments.length, 8);
    });

    // Undo
    await t.step('undo', () => {
        cde.command('d 200 200').anim();
        cde.command('d 200 200').anim();
        assertEquals(Math.round(model.points[2].y), 200);
        // Rotate around axe [0,1] by 90 points [2,3]
        cde.command('rotate S0 90 P2 P3');
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
        cde.command('time 10 rotate S0 90 P2 P3;');
        while(cde.anim()) {/* wait for animation to finish */}
        assertEquals(Math.round(model.points[2].y), -200);
        cde.command('undo');
        while(cde.anim()) {/* wait for animation to finish */}
        assertEquals(Math.round(model.points[2].y), 200);
    });

    // Animation commands
    await t.step('command t 10 rotate S0 90 P2 P3', () => {
        cde.command('t 10 rotate S0 90 P2 P3');
        while(cde.anim()) {/* wait for animation to finish */}
        const pt = model.points[2];
        assertEquals(Math.round(pt.x), 200);
        assertEquals(Math.round(pt.y), -200);
        assertEquals(Math.round(pt.z), 400);
    });

    // Presentation commands
    await t.step('command tx ty tz', () => {
        cde.command('d 200 200');
        cde.command('c3d P0 P1 c3d P0 P3 c3d P0 P2 c3d P1 P3');
        cde.command('c3d P0 P8 c3d P8 P3 c3d P0 P4 c3d P4 P1');
        cde.command('c3d P6 P0 c3d P6 P1 c3d P6 P2 c3d P6 P3');
        cde.command('r S48 179 P21 P0 P9').anim();
        while(cde.anim()) {/* wait for all commands to finish */}
        cde.command('ty 90').anim();
        assertEquals(model.segments.length, 56);
        assertEquals(model.points.length, 25);
    });

    await t.step('command turn 180', () => {
        const viewReset = {angleX:0, angleY:0, angleZ:0, translationX:0, translationY:0, scale:1};
        const cdeReset = new Command(model, viewReset);
        cdeReset.command('d 200 200').anim();
        cdeReset.command('tx 180').anim();
        // Model is not modified only view is rotated
        assertEquals(Math.round(model.points[0].x), -200);
        assertEquals(Math.round(model.points[1].x), 200);
        // View is turned
        assertEquals(viewReset.angleX, 180);
        cdeReset.command('ty 180').anim();
        assertEquals(viewReset.angleY, 180);
    });

    await t.step('end', () => {
        cde.command('d 200 200 end c P0 2P c P1 P3').anim();
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
        cde.command('c3d P0 P2').anim();
        // cde.command('o 42  F1').anim();
        cde.tokenTodo = cde.tokenize('o 42  F1');
        cde.iToken = 0;
        cde.execute(cde.iToken);
        assertEquals(model.faces[0].offset, 0);
        assertEquals(Math.round(model.faces[1].offset*100)/100, 0.42);
    });

    // execute one instruction directly from tokenTodo
    await t.step('execute', () => {
        cde.command('d 200 200').anim();
        assertEquals(model.points.length, 4);
        assertEquals(model.faces.length, 1);

        // Directly execute a cross-split instruction
        cde.tokenTodo = cde.tokenize('c3d P0 P2');
        cde.iToken = 0;
        cde.execute(cde.iToken);

        // The face should be split in two
        assertEquals(model.faces.length, 2);
        assertEquals(model.points.length, 4);
        assertEquals(model.segments.length, 5);
        assertEquals(cde.iToken > 0, true);
    });
});
