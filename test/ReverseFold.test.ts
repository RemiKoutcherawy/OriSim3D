import { Model } from '../js/Model.js';
import { Command } from '../js/Command.js';
import { assertEquals } from '@std/assert';

function run(text: string) {
    const model = new Model().init(200, 200);
    const cde = new Command(model);
    cde.command(text);
    let n = 0;
    while (cde.anim() && n++ < 50_000) { /* drain commands */ }
    return model;
}

function lengthsMatch(model: Model, epsilon = 1) {
    return model.segments.every((s) => {
        const l2 = Math.hypot(s.p1.xf - s.p2.xf, s.p1.yf - s.p2.yf);
        const l3 = Math.hypot(s.p1.x - s.p2.x, s.p1.y - s.p2.y, s.p1.z - s.p2.z);
        return Math.abs(l2 - l3) <= epsilon;
    });
}

Deno.test('Outside reverse fold', async (t) => {
    await t.step('book fold creates a vertical spine and two faces', () => {
        const model = run(`
            d 200 200
            c2d p0 p1
            o -1 f0
            r s6 180 p1 p2
        `);
        assertEquals(model.points.length, 6);
        assertEquals(model.faces.length, 2);
        // Right layer stacked on the left: p1,p2 sit on p0,p3
        assertEquals(Math.round(model.points[1].x), Math.round(model.points[0].x));
        assertEquals(Math.round(model.points[2].x), Math.round(model.points[3].x));
        assertEquals(Math.round(model.points[1].z), 0);
        assertEquals(model.faces[0].offset < 0, true);
    });

    await t.step('by3d through both layers makes the 45° reverse creases', () => {
        const model = run(`
            d 200 200
            c2d p0 p1
            o -1 f0
            r s6 180 p1 p2
            split s6 0.5
            by3d p6 p3
        `);
        assertEquals(model.points.length, 7, 'p6 is the spine midpoint');
        assertEquals(model.faces.length, 4, 'two body quads + two flap triangles');
        assertEquals(model.segments.length, 10);
        // Flap triangles share the spine tip p5 and the new vertex p6
        assertEquals(model.faces[2].points.includes(model.points[5]), true);
        assertEquals(model.faces[3].points.includes(model.points[5]), true);
        assertEquals(Math.round(model.points[6].xf), 0);
        assertEquals(Math.round(model.points[6].yf), 0);
    });

    await t.step('wrap -180 around the front crease moves the tip outside', () => {
        const model = run(`
            d 200 200
            c2d p0 p1
            o -1 f0
            r s6 180 p1 p2
            split s6 0.5
            by3d p6 p3
            r s6 40 p1 p2
            r s8 -180 p5
            r s6 -40 p1 p2
            o 0
            o 2 f3
            o -1 f0
            o -2 f2
        `);
        // Tip p5 reflected over the 45° crease lands at the left edge midpoint
        assertEquals(Math.round(model.points[5].x), -200);
        assertEquals(Math.round(model.points[5].y), 0);
        assertEquals(Math.round(model.points[5].z), 0);
        assertEquals(lengthsMatch(model), true);
        // Outside wrap: flap triangles sandwich the two body layers
        assertEquals(model.faces[3].offset > model.faces[1].offset, true);
        assertEquals(model.faces[1].offset > model.faces[0].offset, true);
        assertEquals(model.faces[0].offset > model.faces[2].offset, true);
    });
});
