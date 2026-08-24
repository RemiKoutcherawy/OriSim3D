import { Command } from '../js/Command.js';
import { Model, State } from '../js/Model.js';
import { assertEquals } from '@std/assert';

function runScript(text: string) {
    const model = new Model();
    const cmd = new Command(model);
    const unexpected: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
        const s = args.join(' ');
        if (/Unexpected/.test(s)) unexpected.push(s);
        orig(...args);
    };
    try {
        cmd.command(text);
        let n = 0;
        while (cmd.iToken < cmd.tokenTodo.length || model.state === State.anim) {
            if (model.state === State.anim) {
                cmd.tStart = performance.now() - cmd.duration - 1;
            }
            if (!cmd.anim()) break;
            if (++n > 50000) throw new Error('too many anim steps');
        }
    } finally {
        console.log = orig;
    }
    return { model, cmd, unexpected };
}

function zSpan(model: Model) {
    const zs = model.points.map((p) => p.z);
    return Math.max(...zs) - Math.min(...zs);
}

Deno.test('example models', async (t) => {
    await t.step('avion folds into a 3D airplane', async () => {
        const text = await Deno.readTextFile('models/avion.txt');
        const { model, unexpected } = runScript(text);
        assertEquals(unexpected, []);
        assertEquals(model.points.length, 16);
        assertEquals(model.faces.length, 10);
        assertEquals(zSpan(model) > 50, true, 'wings should leave the crease-pattern plane');
    });

    await t.step('boat still completes', async () => {
        const text = await Deno.readTextFile('models/boat.txt');
        const { model, unexpected } = runScript(text);
        assertEquals(unexpected, []);
        assertEquals(model.faces.length > 1, true);
        assertEquals(zSpan(model) > 50, true);
    });

    await t.step('cocotte still completes', async () => {
        const text = await Deno.readTextFile('models/cocotte.txt');
        const { model, unexpected } = runScript(text);
        assertEquals(unexpected, []);
        assertEquals(model.faces.length > 1, true);
        assertEquals(zSpan(model) > 50, true);
    });
});
