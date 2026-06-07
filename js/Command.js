// Interprets a list of commands and apply them on Model
import {Interpolator} from './Interpolator.js';
import {State} from './Model.js';
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
        if (this.commandArea !== undefined) {
            this.commandArea.addLine(cde);
        }
        // Define
        if (cde.startsWith('d') || cde.startsWith('define')) {
            // Reset
            this.done = [];
            this.tokenTodo = [];
            this.iToken = 0;
            this.instructions = [];
        }
        // Undo
        else if (cde === 'u' || cde === 'undo') {
            // Current is removed
            this.done.pop();
            // Last will be restored
            this.model.state = State.undo;
            // return early, no need to tokenize
            return this;
        }
        // Tokenize and push
        this.tokenTodo.push(...this.tokenize(cde));
        return this;
    }

    // Tokenize, split the input String in Array of String
    tokenize = function tokenize(input) {
        let cleaned = input
            .replace(/[);]/gm, '') // Remove old /g global /m multiline
            .replace(/(:?\/\/|<!--)[^\r\n]*/g, '') // Remove comments ?: non-capturing /g global
            .replace(/^\s*$/gm, '')   // Remove spaces only lines
            .replace(/\n{2,}/g, '\n') // Remove empty lines
            .trim();                  // Remove leading/trailing whitespace
        return cleaned.match(/\S+|\n/g) || [];
    }

    // Returns true if token is a number
    isNumber(token) {
        return token !== '\n' && !Number.isNaN(Number(token));
    }

    // State machine returns true if the model needs redrawing
    // Only 4 states: run, anim, undo, pause
    // Called by requestAnimationFrame(loop)
    anim() {
        if (this.model.state === State.pause) {
            // Nothing to do
            return false;
        }
        // If running
        else if (this.model.state === State.run) {
            // Nothing to do
            if (this.iToken >= this.tokenTodo.length) {
                return false;
            } else {
                this.idxBefore = this.iToken;
                // Handle time command to start animation and switch to Anim
                if (this.tokenTodo[this.iToken] === 't' || this.tokenTodo[this.iToken] === 'time') {
                    this.iToken++;
                    this.duration = Number.parseFloat(this.tokenTodo[this.iToken++]);
                    this.tStart = performance.now();
                    this.tpi = 0;
                    // State anim for the next call
                    this.model.state = State.anim;
                    return true;
                }

                // Execute one command starting at this.iToken
                this.execute(this.iToken);

                // Keep track of done
                this.doneInstructions(this.idxBefore, this.iToken);
                return true;
            }
        }
        // Handle undo
        else if (this.model.state === State.undo) {
            // Restore model
            this.popUndo();
            // Continue undo if the model was in animation
            if (this.model.state === State.anim) {
                this.model.state = State.undo;
            }
            return true;
        }
        // Animation in progress
        else if (this.model.state === State.anim) {
            // Compute tn varying from 0 to 1
            const t = performance.now();
            let tn = Math.min((t - this.tStart) / this.duration, 1);
            this.tni = this.interpolator(tn);
            // Execute commands after t xxx up to end of line
            let iBeginAnim = this.iToken;
            while (this.iToken < this.tokenTodo.length && this.tokenTodo[this.iToken] !== '\n') {
                this.execute(this.iToken);
            }
            // t preceding (tpi) is now to t now (tni)
            this.tpi = this.tni; // t preceding
            // If Animation is finished, set end values
            if (tn >= 1) {
                this.tni = 1;
                this.tpi = 0;
                // Keep track of done
                this.doneInstructions(this.idxBefore, this.iToken);
                // No more animation State run for the next call
                this.model.state = State.run;
                return true;
            }
            // Rewind to continue animation
            this.iToken = iBeginAnim;
            return true;
        }
        console.log('unhandled state', Object.keys(State)[this.model.state]);
        return false;
    }

    doneInstructions(idxBefore, idxAfter) {
        // Keep track of commands done
        let doneCommands = this.tokenTodo.slice(idxBefore, idxAfter).join(' ');
        if (doneCommands === 'undo') {
            this.instructions.pop();
        } else if (doneCommands !== '' && doneCommands !== '\n') {
            this.instructions.push(doneCommands);
        }
    }

    // Execute one instruction from tokenTodo starting at idx on the model
    execute(idx) {
        const tokenList = this.tokenTodo;

        // Define sheet
        if (tokenList[idx] === 'd' || tokenList[idx] === 'define') {
            // Define a sheet by N points x,y CCW
            idx++;
            const width = this.isNumber(tokenList[idx]) ? Number.parseFloat(tokenList[idx++]) : 200;
            const height = this.isNumber(tokenList[idx]) ? Number.parseFloat(tokenList[idx++]) : 200;
            this.model.init(width, height);
            if (this.view3d) {
                this.view3d.angleX = 0;
                this.view3d.angleY = 0;
                this.view3d.angleZ = 0;
                this.view3d.scale = 1;
                this.view3d.translationX = 0;
                this.view3d.translationY = 0;
            }
        }

        // Origami splits
        else if (tokenList[idx] === 'by3d') {
            // Split by two points in 3d: by3d p1 p2
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            if(pts.length !== 2) console.log('by3d needs 2 points', pts.length, tokenList.slice(idx,idx+3).join(' '))
            idx += pts.length;
            this.model.splitBy3d(pts[0], pts[1]);
        } else if (tokenList[idx] === 'by2d') {
            // Split by two points in 2d on the crease pattern: by 2d p1 p2
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            if(pts.length !== 2) console.log('by2d needs 2 points', pts.length, tokenList.slice(idx,idx+3).join(' '))
            idx += pts.length;
            this.model.splitBy2d(pts[0], pts[1]);
        } else if (tokenList[idx] === 'c' ||tokenList[idx] === 'c3d' || tokenList[idx] === 'across3d' || tokenList[idx] === 'cross3d') {
            // Split across two points in 3d: c3d p1 p2;
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            if(pts.length !== 2) console.log('c3d needs 2 points', pts.length, tokenList.slice(idx,idx+3).join(' '))
            idx += pts.length;
            this.model.splitCross3d(pts[0], pts[1]);
        } else if (tokenList[idx] === 'c2d' || tokenList[idx] === 'across2d') {
            // Split across two points on 2d the crease pattern: c2d p1 p2;
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            if(pts.length !== 2) console.log('c2d needs 2 points', pts.length, tokenList.slice(idx,idx+3).join(' '))
            idx += pts.length;
            this.model.splitCross2d(pts[0], pts[1]);
        } else if (tokenList[idx] === 'p2d' || tokenList[idx] === 'perpendicular2d') {
            // Split perpendicular to segment by point in 2d: p s1 p1;
            idx++;
            const s = this.listObjects(tokenList, idx, 'S')[0];
            idx++;
            const p = this.listObjects(tokenList, idx, 'P')[0];
            idx++;
            this.model.splitPerpendicular2d(s, p);
        } else if (tokenList[idx] === 'p3d' || tokenList[idx] === 'perpendicular3d') {
            // Split perpendicular to segment by point in 3d: p s1 p1;
            idx++;
            const s = this.listObjects(tokenList, idx, 'S')[0];
            idx++;
            const p = this.listObjects(tokenList, idx, 'P')[0];
            idx++;
            this.model.splitPerpendicular3d(s, p);
        } else if (tokenList[idx] === 'bisector2d') {
            // Split by a line passing between segments: s2d s1 s2;
            idx++;
            const sgs = this.listObjects(tokenList, idx, 'S');
            if(sgs.length !== 2) console.log('bisector2d needs 2 segments', sgs.length, tokenList.slice(idx,idx+3).join(' '))
            idx += sgs.length;
            this.model.bisector2d(sgs[0], sgs[1]);
        } else if (tokenList[idx] === 'bisector3d') {
            // Split by a plane passing between segments: s1 s2;
            idx++;
            const sgs = this.listObjects(tokenList, idx, 'S');
            if(sgs.length !== 2) console.log('bisector3d needs 2 segments', sgs.length, tokenList.slice(idx,idx+3).join(' '))
            idx += sgs.length;
            const s1 = sgs[0];
            const s2 = sgs[1];
            this.model.bisector3d(s1.p1, s1.p2, s2.p1, s2.p2);
        } else if (tokenList[idx] === 'bisector2dPoints') {
            // Split by a line bisector of 3 points A B C. B is in the middle
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            if(pts.length !== 3) console.log('bisector2dPoints needs 3 points', pts.length, tokenList.slice(idx,idx+4).join(' '))
            idx += pts.length;
            this.model.bisector2dPoints(pts[0], pts[1], pts[2]);
        }  else if (tokenList[idx] === 'bisector3dPoints') {
            // Split by a plane bisector of 3 points A B C. B is in the middle
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            if(pts.length !== 3) console.log('bisector3dPoints needs 3 points', pts.length, tokenList.slice(idx,idx+4).join(' '))
            idx += pts.length;
            this.model.bisector3dPoints(pts[0], pts[1], pts[2]);
        }
        // Segment split
        else if (tokenList[idx] === 'split'|| tokenList[idx] === 'splitSegment2d') { // "s: split segment factor"
            // Split segment by ratio
            idx++;
            const s = this.listObjects(tokenList, idx, 'S')[0];
            idx++;
            const k = Number.parseFloat(tokenList[idx++]);
            if (k >= 0 && k <= 1) {
                this.model.splitSegmentByRatio2d(s, k);
            }
        }

        // Origami folding
        else if (tokenList[idx] === 'r' || tokenList[idx] === 'rotate') {
            // Rotate around 'Seg' with 'Angle' all 'Points' with animation: r s1 angle p1 p2 p3...
            idx++;
            const s = this.listObjects(tokenList, idx, 'S')[0];
            idx++;
            const angle = Number(tokenList[idx++]) * (this.tni - this.tpi);
            const pts = this.listObjects(tokenList, idx, 'P');
            idx += pts.length;
            this.model.rotate(s, angle, pts);
        }  else if (tokenList[idx] === 'mop' || tokenList[idx] === 'moveOnPoint') {
            // Move all points on first
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            idx += pts.length;
            this.model.moveOnPoint(pts[0], pts);
        } else if (tokenList[idx] === 'mos' || tokenList[idx] === 'moveOnSegment') {
            // Move points on the segment
            idx++;
            const s = this.model.segments[Number(tokenList[idx++])];
            const pts = this.listObjects(tokenList, idx, 'P');
            idx += pts.length;
            this.model.moveOnSegment(s, pts);
        } else if (tokenList[idx] === 'm' || tokenList[idx] === 'move') {
            // Move n points by dx,dy,dz in 3D with animation: move dx dy dz p1 p2 p3...
            idx++;
            const dx = Number(tokenList[idx++]) * (this.tni - this.tpi);
            const dy = Number(tokenList[idx++]) * (this.tni - this.tpi);
            const dz = Number(tokenList[idx++]) * (this.tni - this.tpi);
            const pts = this.listObjects(tokenList, idx, 'P');
            idx += pts.length;
            this.model.movePoints(dx, dy, dz, pts);
        } else if (tokenList[idx] === 'flat') {
            // Set z = 0 for p1 p2 p3... Should be removed
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            this.model.flat(pts);
            idx += pts.length;
        } else if (tokenList[idx] === 'a' || tokenList[idx] === 'adjust') {
            // Adjust points in 3D to equal 2D length of segments: a p1 p2 p3...
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            idx += pts.length;
            this.model.adjustList(pts.length ===0 ? this.model.points : pts);
        } else if (tokenList[idx] === 'check') {
            idx++;
            // Deselect all
            this.model.points.forEach(p => p.select = 0);
            this.model.segments.forEach(s => s.select = 0);
            this.model.checkSegments();
        } else if (tokenList[idx] === 'o' || tokenList[idx] === 'offset') {
            // Offset by dz a list of faces: o dz f1 f2...
            idx++;
            const dz = Number.parseFloat(tokenList[idx++]) / 10;
            const faces = this.listObjects(tokenList, idx, 'F');
            idx += faces.length;
            this.model.offset(dz, faces);
        }

        // View3D turn, zoom and move
        else if (tokenList[idx] === 'tx') {
            // "tx: TurnX angle"
            idx++;
            this.view3d.angleX += Number.parseFloat(tokenList[idx++]) * (this.tni - this.tpi);
        } else if (tokenList[idx] === 'ty') {
            // "ty: TurnY angle"
            idx++;
            this.view3d.angleY += Number.parseFloat(tokenList[idx++]) * (this.tni - this.tpi);
        } else if (tokenList[idx] === 'tz') {
            // "tz: TurnZ angle"
            idx++;
            this.view3d.angleZ += Number.parseFloat(tokenList[idx++]) * (this.tni - this.tpi);
        } else if (tokenList[idx] === 'z' || tokenList[idx] === 'zoom') { // @OK
            // Zoom scale x y. The zoom is centered on x y z=0: z 2 50 50
            idx++;
            let scale = Number.parseFloat(tokenList[idx++]);
            const x = this.isNumber(tokenList[idx]) ? Number.parseFloat(tokenList[idx++]) : 0;
            const y = this.isNumber(tokenList[idx]) ? Number.parseFloat(tokenList[idx++]) : 0;
            // Animation
            const a = ((1 + this.tni * (scale - 1)) / (1 + this.tpi * (scale - 1)));
            const b = scale * (this.tni / a - this.tpi);
            this.view3d.translationX += x * b;
            this.view3d.translationY += y * b;
            this.view3d.scale *= a;
        } else if (tokenList[idx] === 'fit') {
            idx++;
            if (this.tpi === 0) {
                const bounds = this.model.get3DBounds();
                const w = 400;
                this.scale = w / Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin);
                this.deltaX = -(bounds.xMin + bounds.xMax) / 2;
                this.deltaY = -(bounds.yMin + bounds.yMax) / 2;
                this.scaleStart = this.view3d.scale;
                this.txStart = this.view3d.translationX;
                this.tyStart = this.view3d.translationY;
            }
            const targetTx = this.deltaX * this.scale;
            const targetTy = this.deltaY * this.scale;
            const targetScale = this.scale;
            this.view3d.translationX = this.txStart + (targetTx - this.txStart) * this.tni;
            this.view3d.translationY = this.tyStart + (targetTy - this.tyStart) * this.tni;
            this.view3d.scale = this.scaleStart + (targetScale - this.scaleStart) * this.tni;
        }

        // Interpolator
        else if (tokenList[idx] === 'il') { // "il: Interpolator Linear"
            idx++;
            this.interpolator = Interpolator.LinearInterpolator;
        } else if (tokenList[idx] === 'ib') { // "ib: Interpolator Bounce"
            idx++;
            this.interpolator = Interpolator.BounceInterpolator;
        } else if (tokenList[idx] === 'io') { // "io: Interpolator OverShoot"
            idx++;
            this.interpolator = Interpolator.OvershootInterpolator;
        } else if (tokenList[idx] === 'ia') { // "ia: Interpolator Anticipate"
            idx++;
            this.interpolator = Interpolator.AnticipateInterpolator;
        } else if (tokenList[idx] === 'iao') { // "iao: Interpolator Anticipate OverShoot"
            idx++;
            this.interpolator = Interpolator.AnticipateOvershootInterpolator;
        } else if (tokenList[idx] === 'iad') { // "iad: Interpolator Accelerate Decelerate"
            idx++;
            this.interpolator = Interpolator.AccelerateDecelerateInterpolator;
        } else if (tokenList[idx] === 'iso') { // "iso Interpolator Spring Overshoot"
            idx++;
            this.interpolator = Interpolator.SpringOvershootInterpolator;
        } else if (tokenList[idx] === 'isb') { // "isb Interpolator Spring Bounce"
            idx++;
            this.interpolator = Interpolator.SpringBounceInterpolator;
        } else if (tokenList[idx] === 'igb') { // "igb: Interpolator Gravity Bounce"
            idx++;
            this.interpolator = Interpolator.GravityBounceInterpolator;
        }

        // Select
        else if (tokenList[idx] === 'selectPoints' || tokenList[idx] === 'sp') {
            idx++;
            const pts = this.listObjects(tokenList, idx, 'P');
            idx += pts.length;
            this.model.points.forEach(function(p){
                p.select = pts.includes(p) ? 1 : 0;
            });
        } else if (tokenList[idx] === 'selectSegments' || tokenList[idx] === 'ss') {
            idx++;
            const sgs = this.listObjects(tokenList, idx, 'S');
            idx += sgs.length;
            this.model.segments.forEach(function(s){
                s.select = sgs.includes(s) ? 1 : 0;
            });
        } else if (tokenList[idx] === 'labels') {
            idx++;
            this.model.labels = !this.model.labels;
        } else if (tokenList[idx] === 'textures') {
            idx++;
            this.model.textures = !this.model.textures;
        } else if (tokenList[idx] === 'overlay') {
            idx++;
            this.model.overlay = !this.model.overlay;
        } else if (tokenList[idx] === 'lines') {
            idx++;
            this.model.lines = !this.model.lines;
        }

        // Read-Write file
        else if (tokenList[idx] === 'read') {
            idx++;
            ReadWrite.readFileAsText('text.txt', this.instructions).then(() => console.log('complete'));
        } else if (tokenList[idx] === 'write') {
            idx++;
            let doneCde = this.instructions.join('\n');
            ReadWrite.writeFile('text.txt', doneCde).then(() => console.log('complete'));
        }

        // End of line
        else if (tokenList[idx] === '\n') {
            idx++;
        }

        // Unexpected end
        else {
            console.log('Unexpected end of command', tokenList[idx]);
            // Ignore until the next command after '\n'
            while (tokenList[idx] !== '\n' && idx < tokenList.length) {
                idx++;
            }
            if (idx < tokenList.length) {
                idx++;
            }
        }

        // Keep state after executing
        this.pushUndo();
        this.iToken = idx;
    }
    listObjects(tokenList, iStart, prefix) {
        const list = [];
        while (iStart < tokenList.length) {
            const token = tokenList[iStart++];
            if (token === '\n') break;
            if (!token.startsWith(prefix)) break;
            let n = Number(token.slice(1));
            if(/^\d+$/.test(token)) break;
            if (prefix === 'P' && this.model.points[n] !== undefined) {
                list.push(this.model.points[n]);
            }
            else if (token.startsWith('S') && this.model.segments[n] !== undefined) {
                list.push(this.model.segments[n]);
            }
            else if (token.startsWith('F') && this.model.faces[n] !== undefined) {
                list.push(this.model.faces[n]);
            }
            else break;
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
        // Previous is restored if any
        Object.assign(this.model, this.model.deserialize(this.done.pop()));
    }
}
// 467 lines
