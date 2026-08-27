// Interprets a list of commands and apply them on Model
import {Interpolator} from './Interpolator.js';
import {Model, State} from './Model.js';
import {ReadWrite} from './ReadWrite.js';

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
    // Fit target captured at tpi === 0, then applied incrementally like zoom



    // Interpolator used in anim() to map tn (time normalized) to tni (time interpolated)
    interpolator = Interpolator.LinearInterpolator;
    // Animation
    duration = 0;
    tStart = 0;
    // Eventual CommandArea
    commandArea;
    // Optional 3D view (for svg export and other view-dependent commands)
    /** @type {{ modelView?: Float32Array, updateCanvasCoords?: () => void } | null} */
    view3d;

    /**
     * @param {import('./Model.js').Model} model
     * @param {{ modelView?: Float32Array, updateCanvasCoords?: () => void } | null} [view3d]
     */
    constructor(model, view3d = null) {
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
                this.instructions.pop();
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
            .replaceAll(/(:?\/\/|<!--)[^\r\n]*/g, '') // Remove comments
            .replaceAll(/^\s*$/gm, '')   // Remove spaces only lines
            .replaceAll(/\n{2,}/g, '\n') // Remove empty lines
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

    // Consume one token (always advances, like the previous idx++)
    token(prefix) {
        const token = this.listTokens(this.tokenTodo, this.iToken, prefix)[0];
        this.iToken++;
        return token;
    }

    // Consume a run of tokens with the same prefix (p0 p1 p2...)
    tokens(prefix) {
        const list = this.listTokens(this.tokenTodo, this.iToken, prefix);
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
                this.model.snapPoints();
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
        const command = COMMANDS[token];
        if (command) {
            command(this);
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

    listTokens(tokenList, iStart, prefix) {
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
        if (this.model.state === State.anim) {
            this.done.push({
                state: State.anim,
                coords: this.model.snapshotPositions(),
            });
        } else {
            this.done.push(this.model.serialize());
        }
    }

    popUndo() {
        if (this.done.length === 0) {
            return;
        }
        const snapshot = this.done.pop();
        if (typeof snapshot === 'string') {
            Object.assign(this.model, this.model.deserialize(snapshot));
        } else if (snapshot?.state === State.anim) {
            this.model.state = State.anim;
            if (snapshot.coords) {
                this.model.restorePositions(snapshot.coords);
            }
        }
    }
}

function take(cmd, prefix, n, label, apply) {
    const list = cmd.tokens(prefix);
    if (list.length !== n) {
        console.log(label, list.length, cmd.tokenTodo.slice(cmd.iToken, cmd.iToken + n + 1).join(' '));
        return;
    }
    apply(...list);
}

function select(cmd, prefix, collection) {
    const selected = cmd.tokens(prefix);
    collection.forEach((o) => {
        o.select = selected.includes(o) && !o.select;
    });
}

function turn(axis) {
    return (cmd) => {
        const angle = Number(cmd.next()) * cmd.dt;
        cmd.model.turn(axis, angle);
    };
}

function define(cmd) {
    cmd.model.init(cmd.num(200), cmd.num(200));
}

// Replay a recorded instruction list (cmd.instructions) on a fresh headless Model,
// instantly settling any 't'-animated line, one Model snapshot returned per instruction.
export function replaySteps(instructions) {
    const replay = new Command(new Model());
    const steps = [];
    for (const line of instructions) {
        replay.command(line);
        while (replay.iToken < replay.tokenTodo.length || replay.model.state === State.anim) {
            if (replay.model.state === State.anim) {
                replay.tStart = performance.now() - replay.duration - 1; // force tn >= 1
            }
            if (!replay.anim()) break;
        }
        steps.push(Model.deserialize(replay.model.serialize()));
    }
    return steps;
}

function splitSegment(cmd) {
    const s = cmd.token('s');
    const k = Number.parseFloat(cmd.next());
    if (k >= 0 && k <= 1) {
        cmd.model.splitSegmentByRatio2d(s, k);
    }
}

function rotate(cmd) {
    const s = cmd.token('s');
    const angle = Number(cmd.next()) * cmd.dt;
    cmd.model.rotate(s, angle, cmd.tokens('p'));
}

function move(cmd) {
    const d = cmd.dt;
    const dx = Number(cmd.next()) * d;
    const dy = Number(cmd.next()) * d;
    const dz = Number(cmd.next()) * d;
    cmd.model.movePoints(dx, dy, dz, cmd.tokens('p'));
}

function zoom(cmd) {
    const scale = Number.parseFloat(cmd.next());
    const a = (1 + cmd.tni * (scale - 1)) / (1 + cmd.tpi * (scale - 1));
    cmd.model.zoom(a, cmd.num(0), cmd.num(0));
}

function fit(cmd) {
    if (cmd.tpi === 0) {
        const b = cmd.model.get3DBounds();
        cmd.fitScale = 400 / (Math.max(b.xMax - b.xMin, b.yMax - b.yMin) || 1);
        cmd.fitCx = (b.xMin + b.xMax) / 2;
        cmd.fitCy = (b.yMin + b.yMax) / 2;
    }
    const s = cmd.fitScale;
    const a = (1 + cmd.tni * (s - 1)) / (1 + cmd.tpi * (s - 1));
    cmd.model.zoom(a, 0, 0);
    const k = s * (a * cmd.tpi - cmd.tni);
    cmd.model.movePoints(cmd.fitCx * k, cmd.fitCy * k, 0, cmd.model.points);
}

// Order faces front-to-back: the first face is set nearest the viewer, each
// following one progressively behind it.
function order(cmd) {
    const faces = cmd.tokens('f');
    faces.forEach((face, i) => {
        const rank = faces.length - 1 - i;
        const nz = Model.normal(face)[2];
        face.offset = rank === 0 ? 0 : Math.sign(nz) * rank;
    });
}

const COMMANDS = {};
function on(names, command) {
    for (const name of names.split(/\s+/)) {
        COMMANDS[name] = command;
    }
}

function help(cmd) {
    const groups = [COMMANDS];
    cmd.commandArea?.addLine(`Commandes (${groups.length}) :\n${groups.map((g) => g.join('/')).join('\n')}`);
}

on('d define', define);
on('pause', (cmd) => { cmd.model.state = State.pause; });

on('by by3d', (cmd) => take(cmd, 'p', 2, 'by3d needs 2 points', (a, b) => cmd.model.splitBy3d(a, b)));
on('by2d', (cmd) => take(cmd, 'p', 2, 'by2d needs 2 points', (a, b) => cmd.model.splitBy2d(a, b)));
on('c3d across3d', (cmd) => take(cmd, 'p', 2, 'c3d needs 2 points', (a, b) => cmd.model.splitCross3d(a, b)));
on('c2d across2d', (cmd) => take(cmd, 'p', 2, 'c2d needs 2 points', (a, b) => cmd.model.splitCross2d(a, b)));
on('p2d perpendicular2d', (cmd) => cmd.model.splitPerpendicular2d(cmd.token('s'), cmd.token('p')));
on('p3d perpendicular3d', (cmd) => cmd.model.splitPerpendicular3d(cmd.token('s'), cmd.token('p')));
on('parallel2d', (cmd) => cmd.model.splitParallel2d(cmd.token('s'), cmd.token('p')));
on('parallel3d', (cmd) => cmd.model.splitParallel3d(cmd.token('s'), cmd.token('p')));
on('bisector2d b2d', (cmd) => take(cmd, 's', 2, 'bisector2d needs 2 segments', (a, b) => cmd.model.bisector2d(a, b)));
on('bisector3d b3d', (cmd) => take(cmd, 's', 2, 'bisector3d needs 2 segments', (s1, s2) => cmd.model.bisector3d(s1.p1, s1.p2, s2.p1, s2.p2)));
on('bisector2dPoints', (cmd) => take(cmd, 'p', 3, 'bisector2dPoints needs 3 points', (a, b, c) => cmd.model.bisector2dPoints(a, b, c)));
on('bisector3dPoints', (cmd) => take(cmd, 'p', 3, 'bisector3dPoints needs 3 points', (a, b, c) => cmd.model.bisector3dPoints(a, b, c)));
on('split splitSegment2d', splitSegment);

on('r rotate', rotate);
on('m move', move);
on('mop moveOnPoint', (cmd) => {const pts = cmd.tokens('p');cmd.model.moveOnPoint(pts[0], pts);});
on('mos moveOnSegment', (cmd) => cmd.model.moveOnSegment(cmd.token('s'), cmd.tokens('p')));
on('a adjust', (cmd) => {
    const pts = cmd.tokens('p');
    cmd.model.adjustList(pts.length === 0 ? cmd.model.points : pts);
});
on('check', (cmd) => {
    cmd.model.points.forEach((p) => { p.select = false; });
    cmd.model.segments.forEach((s) => { s.select = false; });
    cmd.model.checkSegments();
});
on('o offset', (cmd) => cmd.model.offset(Number.parseFloat(cmd.next()) / 10, cmd.tokens('f')));
on('order', order);
on('mountain mv', (cmd) => cmd.tokens('s').forEach((s) => { s.assignment = 'M'; }));
on('valley', (cmd) => cmd.tokens('s').forEach((s) => { s.assignment = 'V'; }));

on('tx', turn('x'));
on('ty', turn('y'));
on('tz', turn('z'));
on('z zoom', zoom);
on('fit', fit);

on('selectPoints sp', (cmd) => select(cmd, 'p', cmd.model.points));
on('selectSegments ss', (cmd) => select(cmd, 's', cmd.model.segments));
on('selectFaces sf', (cmd) => select(cmd, 'f', cmd.model.faces));

on('read', (cmd) => {
    const token = cmd.peek();
    const filename = token && token !== '\n' && !COMMANDS[token] ? cmd.next() : undefined;
    ReadWrite.readFileAsText(filename).then((text) => {
        if (text == null) return;
        ReadWrite.loadText(cmd, text);
    });
});
on('write instructions', (cmd) => {
    const token = cmd.peek();
    const filename = token && token !== '\n' && !COMMANDS[token] ? cmd.next() : undefined;
    ReadWrite.writeFile(cmd.instructions.join('\n'), filename).catch((e) => console.error(e));
});
on('writeSvg svg', (cmd) => {
    const token = cmd.peek();
    const filename = token && token !== '\n' && !COMMANDS[token] ? cmd.next() : undefined;
    cmd.view3d?.updateCanvasCoords?.();
    ReadWrite.writeSVG(cmd.model, filename).catch((e) => console.error(e));
});
on('writeFold fold', (cmd) => {
    const token = cmd.peek();
    const filename = token && token !== '\n' && !COMMANDS[token] ? cmd.next() : undefined;
    ReadWrite.writeFold(cmd.model, filename).catch((e) => console.error(e));
});
on('writeDiagrams diagrams', (cmd) => {
    const token = cmd.peek();
    const filename = token && token !== '\n' && !COMMANDS[token] ? cmd.next() : undefined;
    ReadWrite.writeDiagrams(replaySteps(cmd.instructions), filename).catch((e) => console.error(e));
});

// Toggles
on('labels', (cmd) => { cmd.model.labels = !cmd.model.labels; });
on('textures', (cmd) => { cmd.model.textures = !cmd.model.textures; });
on('lines', (cmd) => { cmd.model.lines = !cmd.model.lines; });
on('snap', (cmd) => { cmd.model.snap = !cmd.model.snap; });

// Interpolator
on('il', (cmd) => { cmd.interpolator = Interpolator.LinearInterpolator });
on('ib', (cmd) => { cmd.interpolator = Interpolator.BounceInterpolator });
on('io', (cmd) => { cmd.interpolator = Interpolator.OvershootInterpolator });
on('ia', (cmd) => { cmd.interpolator = Interpolator.AnticipateInterpolator });
on('iao', (cmd) => { cmd.interpolator = Interpolator.AnticipateOvershootInterpolator });
on('iad', (cmd) => { cmd.interpolator = Interpolator.AccelerateDecelerateInterpolator });
on('iso', (cmd) => { cmd.interpolator = Interpolator.SpringOvershootInterpolator });
on('isb', (cmd) => { cmd.interpolator = Interpolator.SpringBounceInterpolator });
on('igb', (cmd) => { cmd.interpolator = Interpolator.GravityBounceInterpolator });

on('? help', help);


