// Interprets a list of commands and apply them on Model
import {Interpolator} from './Interpolator.js';
import {State} from './Model.js';
import {ReadWrite} from './ReadWrite.js';

const INTERPOLATORS = {
    il: Interpolator.LinearInterpolator,
    ib: Interpolator.BounceInterpolator,
    io: Interpolator.OvershootInterpolator,
    ia: Interpolator.AnticipateInterpolator,
    iao: Interpolator.AnticipateOvershootInterpolator,
    iad: Interpolator.AccelerateDecelerateInterpolator,
    iso: Interpolator.SpringOvershootInterpolator,
    isb: Interpolator.SpringBounceInterpolator,
    igb: Interpolator.GravityBounceInterpolator,
};

const TOGGLES = ['labels', 'textures', 'overlay', 'lines', 'snap'];

export class Command {
    model; // Current model
    // Tokenized commands
    tokenTodo = [];
    iToken = 0;
    done = []; // List of model states
    instructions = []; // List of commands done
    // Time interpolated at an instant 'p' preceding and at instant 'n' now
    tpi = 0;
    tni = 1;
    // Goal for fit
    scale = 1; deltaX = 0; deltaY = 0;
    scaleStart = 1; txStart = 0; tyStart = 0;
    // Interpolator used in anim() to map tn (time normalized) to tni (time interpolated)
    interpolator = Interpolator.LinearInterpolator;
    // Animation
    duration = 0;
    tStart = 0;
    // Eventual CommandArea
    commandArea;

    constructor(model, view3d) {
        this.model = model;
        this.view3d = view3d;
    }

    // The main entry point executes a string of commands
    command(cde) {
        this.commandArea?.addLine(cde);
        const tokens = this.tokenize(cde);
        if (tokens[0] === 'd' || tokens[0] === 'define') {
            this.done = [];
            this.tokenTodo = [];
            this.iToken = 0;
            this.instructions = [];
        } else if (tokens[0] === 'u' || tokens[0] === 'undo') {
            // Drop the snapshot of the live model; runUndo restores the previous one.
            if (this.done.length > 0) {
                this.done.pop();
            }
            this.model.state = State.undo;
            return this;
        } else if (tokens[0] === 'run') {
            this.model.state = State.run;
            return this;
        }
        // A new instruction must leave undo, otherwise anim() keeps calling runUndo
        // and tokenTodo is never consumed (mouse / commandArea look "dead").
        if (this.model.state === State.undo) {
            this.model.state = State.run;
        }
        this.tokenTodo.push(...tokens);
        return this;
    }

    // Tokenize, split the input String in Array of String
    tokenize(input) {
        const cleaned = input
            .replace(/[);]/gm, '') // Remove old separators
            .replace(/(:?\/\/|<!--)[^\r\n]*/g, '') // Remove comments
            .replace(/^\s*$/gm, '')   // Remove spaces only lines
            .replace(/\n{2,}/g, '\n') // Remove empty lines
            .trim();                  // Remove leading/trailing whitespace
        return cleaned.match(/\S+|\n/g) || [];
    }

    isNumber(token) {
        return token !== '\n' && !Number.isNaN(Number(token));
    }

    peek() {
        return this.tokenTodo[this.iToken];
    }

    next() {
        return this.tokenTodo[this.iToken++];
    }

    // Optional number with default
    num(fallback) {
        return this.isNumber(this.peek()) ? Number.parseFloat(this.next()) : fallback;
    }

    // Consume one object token (always advances, like the previous idx++)
    object(prefix) {
        const obj = this.listObjects(this.tokenTodo, this.iToken, prefix)[0];
        this.iToken++;
        return obj;
    }

    // Consume a run of objects with the same prefix (p0 p1 p2...)
    objects(prefix) {
        const list = this.listObjects(this.tokenTodo, this.iToken, prefix);
        this.iToken += list.length;
        return list;
    }

    // Animation delta between previous and current interpolated time
    get dt() {
        return this.tni - this.tpi;
    }

    // State machine returns true if the model needs redrawing
    // Only 4 states: run, anim, undo, pause
    // Called by requestAnimationFrame(loop)
    anim() {
        switch (this.model.state) {
            case State.pause:
                return false;
            case State.run:
                return this.runNext();
            case State.undo:
                return this.runUndo();
            case State.anim:
                return this.runAnim();
            default:
                console.log('unhandled state', Object.keys(State)[this.model.state]);
                return false;
        }
    }

    runNext() {
        if (this.iToken >= this.tokenTodo.length) {
            return false;
        }
        this.idxBefore = this.iToken;
        // Handle time command to start animation and switch to Anim
        if (this.peek() === 't' || this.peek() === 'time') {
            // Snapshot before the animated line (state is still run). Without it,
            // undo only has anim-frame snapshots and never returns to State.run.
            this.pushUndo();
            this.iToken++;
            this.duration = Number.parseFloat(this.next());
            this.tStart = performance.now();
            this.tpi = 0;
            this.model.state = State.anim;
            return true;
        }
        this.execute(this.iToken);
        this.doneInstructions(this.idxBefore, this.iToken);
        return true;
    }

    runUndo() {
        // Empty stack: stay in undo and nothing ever runs again (commandArea / mouse).
        if (this.done.length === 0) {
            this.model.state = State.run;
            return false;
        }
        this.popUndo();
        // Continue undo through per-frame snapshots of an animated line
        if (this.model.state === State.anim) {
            this.model.state = State.undo;
            return true;
        }
        this.model.state = State.run;
        return true;
    }

    runAnim() {
        const tn = Math.min((performance.now() - this.tStart) / this.duration, 1);
        this.tni = this.interpolator(tn);
        // Execute commands after t xxx up to end of line
        const iBeginAnim = this.iToken;
        while (this.iToken < this.tokenTodo.length && this.peek() !== '\n') {
            this.execute(this.iToken);
        }
        this.tpi = this.tni;
        if (tn >= 1) {
            this.tni = 1;
            this.tpi = 0;
            if (this.model.snap) {
                this.model.align();
            }
            this.doneInstructions(this.idxBefore, this.iToken);
            this.model.state = State.run;
            return true;
        }
        this.iToken = iBeginAnim;
        return true;
    }

    doneInstructions(idxBefore, idxAfter) {
        const doneCommands = this.tokenTodo.slice(idxBefore, idxAfter).join(' ');
        if (doneCommands === 'undo') {
            this.instructions.pop();
        } else if (doneCommands !== '' && doneCommands !== '\n') {
            this.instructions.push(doneCommands);
        }
    }

    // Execute one instruction from tokenTodo starting at idx on the model
    execute(idx) {
        this.iToken = idx;
        const token = this.next();
        const handler = HANDLERS[token];
        if (handler) {
            handler(this);
        } else if (token !== '\n') {
            this.skipUnexpected();
        }
        this.pushUndo();
    }

    skipUnexpected() {
        const idx = this.iToken - 1;
        console.log('Unexpected end of command', this.tokenTodo.slice(idx, idx + 3).join(' '));
        this.iToken = idx;
        while (this.peek() !== '\n' && this.iToken < this.tokenTodo.length) {
            this.iToken++;
        }
        if (this.iToken < this.tokenTodo.length) {
            this.iToken++;
        }
    }

    listObjects(tokenList, iStart, prefix) {
        const list = [];
        prefix = prefix.toLowerCase();
        const collections = {p: this.model.points, s: this.model.segments, f: this.model.faces};
        const collection = collections[prefix];
        while (iStart < tokenList.length) {
            const token = tokenList[iStart];
            if (token === '\n' || !token || token[0].toLowerCase() !== prefix) break;
            const n = Number(token.slice(1));
            if (Number.isNaN(n) || !collection?.[n]) break;
            list.push(collection[n]);
            iStart++;
        }
        return list;
    }

    pushUndo() {
        this.done.push(this.model.serialize());
    }

    popUndo() {
        if (this.done.length === 0) {
            return;
        }
        Object.assign(this.model, this.model.deserialize(this.done.pop()));
    }
}

function take(cmd, prefix, n, label, apply) {
    const list = cmd.objects(prefix);
    if (list.length !== n) {
        console.log(label, list.length, cmd.tokenTodo.slice(cmd.iToken, cmd.iToken + n + 1).join(' '));
    }
    apply(...list);
}

function select(cmd, prefix, collection) {
    const selected = cmd.objects(prefix);
    collection.forEach((o) => {
        o.select = selected.includes(o) && !o.select;
    });
}

function turn(axis) {
    return (cmd) => {
        cmd.view3d[axis] += Number.parseFloat(cmd.next()) * cmd.dt;
    };
}

function define(cmd) {
    const width = cmd.num(200);
    const height = cmd.num(200);
    cmd.model.init(width, height);
    const v = cmd.view3d;
    if (v) {
        v.angleX = v.angleY = v.angleZ = 0;
        v.scale = 1;
        v.translationX = v.translationY = 0;
    }
}

function splitSegment(cmd) {
    const s = cmd.object('s');
    const k = Number.parseFloat(cmd.next());
    if (k >= 0 && k <= 1) {
        cmd.model.splitSegmentByRatio2d(s, k);
    }
}

function rotate(cmd) {
    const s = cmd.object('s');
    const angle = Number(cmd.next()) * cmd.dt;
    cmd.model.rotate(s, angle, cmd.objects('p'));
}

// fold / valley: offset moving faces once, then rotate (same unit as `offset 1`)
// mountain: opposite offset sign
// foldFlat: fold then adjust the moved points (typical `r … a p…`)
// Offset on a non-animated command, or on the first anim step (tpi === 0 and dt !== 0).
function foldCmd(cmd, layerSign, thenAdjust = false) {
    const s = cmd.object('s');
    const angle = Number(cmd.next());
    const pts = cmd.objects('p');
    const firstStep = cmd.model.state !== State.anim || (cmd.tpi === 0 && cmd.dt !== 0);
    if (firstStep) {
        cmd.model.offsetForFold(s, pts, layerSign * angle, 1);
    }
    cmd.model.rotate(s, angle * cmd.dt, pts);
    if (thenAdjust) {
        cmd.model.adjustList(pts.length ? pts : cmd.model.points);
    }
}

function move(cmd) {
    const d = cmd.dt;
    const dx = Number(cmd.next()) * d;
    const dy = Number(cmd.next()) * d;
    const dz = Number(cmd.next()) * d;
    cmd.model.movePoints(dx, dy, dz, cmd.objects('p'));
}

function zoom(cmd) {
    const scale = Number.parseFloat(cmd.next());
    const x = cmd.num(0);
    const y = cmd.num(0);
    const a = (1 + cmd.tni * (scale - 1)) / (1 + cmd.tpi * (scale - 1));
    const b = scale * (cmd.tni / a - cmd.tpi);
    cmd.view3d.translationX += x * b;
    cmd.view3d.translationY += y * b;
    cmd.view3d.scale *= a;
}

function fit(cmd) {
    if (cmd.tpi === 0) {
        const bounds = cmd.model.get3DBounds();
        cmd.scale = 400 / Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin);
        cmd.deltaX = -(bounds.xMin + bounds.xMax) / 2;
        cmd.deltaY = -(bounds.yMin + bounds.yMax) / 2;
        cmd.scaleStart = cmd.view3d.scale;
        cmd.txStart = cmd.view3d.translationX;
        cmd.tyStart = cmd.view3d.translationY;
    }
    cmd.view3d.translationX = cmd.txStart + (cmd.deltaX * cmd.scale - cmd.txStart) * cmd.tni;
    cmd.view3d.translationY = cmd.tyStart + (cmd.deltaY * cmd.scale - cmd.tyStart) * cmd.tni;
    cmd.view3d.scale = cmd.scaleStart + (cmd.scale - cmd.scaleStart) * cmd.tni;
}

const HANDLERS = {};
function on(names, handler) {
    for (const name of names.split(/\s+/)) {
        HANDLERS[name] = handler;
    }
}

on('d define', define);
on('pause', (cmd) => { cmd.model.state = State.pause; });

on('by by3d', (cmd) => take(cmd, 'p', 2, 'by3d needs 2 points', (a, b) => cmd.model.splitBy3d(a, b)));
on('by2d', (cmd) => take(cmd, 'p', 2, 'by2d needs 2 points', (a, b) => cmd.model.splitBy2d(a, b)));
on('c3d across3d cross3d', (cmd) => take(cmd, 'p', 2, 'c3d needs 2 points', (a, b) => cmd.model.splitCross3d(a, b)));
on('c2d across2d', (cmd) => take(cmd, 'p', 2, 'c2d needs 2 points', (a, b) => cmd.model.splitCross2d(a, b)));
on('p2d perpendicular2d', (cmd) => cmd.model.splitPerpendicular2d(cmd.object('s'), cmd.object('p')));
on('p3d perpendicular3d', (cmd) => cmd.model.splitPerpendicular3d(cmd.object('s'), cmd.object('p')));
on('bisector2d b2d', (cmd) => take(cmd, 's', 2, 'bisector2d needs 2 segments', (a, b) => cmd.model.bisector2d(a, b)));
on('bisector3d b3d', (cmd) => take(cmd, 's', 2, 'bisector3d needs 2 segments', (s1, s2) => cmd.model.bisector3d(s1.p1, s1.p2, s2.p1, s2.p2)));
on('bisector2dPoints', (cmd) => take(cmd, 'p', 3, 'bisector2dPoints needs 3 points', (a, b, c) => cmd.model.bisector2dPoints(a, b, c)));
on('bisector3dPoints', (cmd) => take(cmd, 'p', 3, 'bisector3dPoints needs 3 points', (a, b, c) => cmd.model.bisector3dPoints(a, b, c)));
on('split splitSegment2d', splitSegment);

on('r rotate', rotate);
on('fold valley', (cmd) => foldCmd(cmd, 1));
on('mountain', (cmd) => foldCmd(cmd, -1));
on('foldFlat ff', (cmd) => foldCmd(cmd, 1, true));
on('m move', move);
on('mop moveOnPoint', (cmd) => {
    const pts = cmd.objects('p');
    cmd.model.moveOnPoint(pts[0], pts);
});
on('mos moveOnSegment', (cmd) => cmd.model.moveOnSegment(cmd.object('s'), cmd.objects('p')));
on('a adjust', (cmd) => {
    const pts = cmd.objects('p');
    cmd.model.adjustList(pts.length === 0 ? cmd.model.points : pts);
});
on('check', (cmd) => {
    cmd.model.points.forEach((p) => { p.select = false; });
    cmd.model.segments.forEach((s) => { s.select = false; });
    cmd.model.checkSegments();
});
on('o offset', (cmd) => cmd.model.offset(Number.parseFloat(cmd.next()) / 10, cmd.objects('f')));

on('tx', turn('angleX'));
on('ty', turn('angleY'));
on('tz', turn('angleZ'));
on('z zoom', zoom);
on('fit', fit);

on('selectPoints sp', (cmd) => select(cmd, 'p', cmd.model.points));
on('selectSegments ss', (cmd) => select(cmd, 's', cmd.model.segments));
on('selectFaces sf', (cmd) => select(cmd, 'f', cmd.model.faces));

on('read', (cmd) => {
    const token = cmd.peek();
    const filename = token && token !== '\n' && !HANDLERS[token] ? cmd.next() : undefined;
    ReadWrite.readFileAsText(filename).then((text) => {
        if (text == null) return;
        ReadWrite.loadText(cmd, text);
        cmd.view3d?.initBuffers?.();
        cmd.view3d?.initModelView?.();
    });
});
on('write', (cmd) => {
    const filename = cmd.next();
    ReadWrite.writeFile(filename, cmd.instructions.join('\n')).then(() => console.log('complete'));
});

for (const [name, interpolator] of Object.entries(INTERPOLATORS)) {
    HANDLERS[name] = (cmd) => { cmd.interpolator = interpolator; };
}
for (const prop of TOGGLES) {
    HANDLERS[prop] = (cmd) => { cmd.model[prop] = !cmd.model[prop]; };
}
