/**
 * Mitani / ORIPA Folder, adapted to OriSim3D (Model / Face / Segment / Point).
 *
 * Original: Folder_withCommentByMitani.java
 * Copyright (C) 2005-2009 Jun Mitani http://mitani.cs.tsukuba.ac.jp/
 * GPLv3 — same license as OriSim3D.
 *
 * Mapping:
 * - OriFace → Face, indexed by model.faces
 * - OriEdge / OriHalfedge → Segment + consecutive Face.points
 *   (adjacency via Model.incidentFaces, no half-edge mesh)
 * - vertex.p / positionAfterFolded → Point.x, Point.y (crease xf,yf unchanged)
 * - overlap matrix → Face.offset along the face normal (View3d already uses it)
 * - OriLine.TYPE_RIDGE / TYPE_VALLEY → Segment.type 'M' / 'V' (FOLD assignment)
 *
 * makeSubFaces() does not rebuild a planar arrangement (ORIPA Doc.buildOrigami).
 * It samples folded-face centroids — enough for typical crease patterns, not for
 * every stacked-edge configuration. See holdCondition4s / SubFace notes below.
 */
import {Model} from './Model.js';

export const OR = {
    UNDEFINED: 0,
    UPPER: 1,
    LOWER: 2,
    NO_OVERLAP: 9,
};

export const FoldType = {
    BORDER: 'B',
    MOUNTAIN: 'M',
    VALLEY: 'V',
    UNASSIGNED: 'U',
    FLAT: 'F',
};

const EPS = 1e-4;
const MAX_ANSWERS = 64;
const MAX_SUBFACE_FACES = 8;

class Condition3 {
    constructor(upper, lower, other) {
        this.upper = upper;
        this.lower = lower;
        this.other = other;
    }
}

class Condition4 {
    constructor(upper1, lower1, upper2, lower2) {
        this.upper1 = upper1;
        this.lower1 = lower1;
        this.upper2 = upper2;
        this.lower2 = lower2;
    }
}

class SubFace {
    constructor(faces) {
        this.faces = faces;
        this.condition3s = [];
        this.condition4s = [];
        this.answerStacks = [];
        this.allFaceOrderDecided = false;
        this.sortedFaces = [];
    }

    sortFaceOverlapOrder(orMat) {
        this.answerStacks = [];
        this.sortedFaces = this.faces.map(() => null);
        if (this.#undefinedCount(orMat) === 0 || this.faces.length > MAX_SUBFACE_FACES) {
            this.allFaceOrderDecided = true;
            return 0;
        }
        this.#seedConstraints(orMat);
        this.#sort(0);
        return this.answerStacks.length;
    }

    #undefinedCount(orMat) {
        let pending = 0;
        for (let i = 0; i < this.faces.length; i++) {
            for (let j = i + 1; j < this.faces.length; j++) {
                if (orMat[this.faces[i].tmpInt][this.faces[j].tmpInt] === OR.UNDEFINED) pending++;
            }
        }
        return pending;
    }

    #seedConstraints(orMat) {
        for (const f of this.faces) {
            f.condition2s = [];
            f.condition3s = this.condition3s.filter((c) => f.tmpInt === c.other);
            f.condition4s = this.condition4s.filter((c) => f.tmpInt === c.upper1 || f.tmpInt === c.upper2);
            f.condition2s = this.faces
                .filter((other) => orMat[f.tmpInt][other.tmpInt] === OR.LOWER)
                .map((other) => other.tmpInt);
            f.alreadyStacked = false;
            f.tmpInt2 = -1;
        }
    }

    #sort(index) {
        if (this.answerStacks.length >= MAX_ANSWERS) return;
        for (const f of this.faces) {
            if (f.alreadyStacked) continue;
            if (f.condition2s.some((i) => !this.faces.find((x) => x.tmpInt === i)?.alreadyStacked)) continue;
            if (!this.#checkLocal(f)) continue;

            this.sortedFaces[index] = f;
            f.alreadyStacked = true;
            f.tmpInt2 = index;
            if (index === this.faces.length - 1) {
                this.answerStacks.push([...this.sortedFaces]);
            } else {
                this.#sort(index + 1);
            }
            this.sortedFaces[index] = null;
            f.alreadyStacked = false;
            f.tmpInt2 = -1;
        }
    }

    #checkLocal(face) {
        for (const cond of face.condition3s) {
            const lower = this.faces.find((f) => f.tmpInt === cond.lower);
            const upper = this.faces.find((f) => f.tmpInt === cond.upper);
            if (lower?.alreadyStacked && !upper?.alreadyStacked) return false;
        }
        for (const cond of face.condition4s) {
            const l1 = this.faces.find((f) => f.tmpInt === cond.lower1);
            const l2 = this.faces.find((f) => f.tmpInt === cond.lower2);
            const u1 = this.faces.find((f) => f.tmpInt === cond.upper1);
            const u2 = this.faces.find((f) => f.tmpInt === cond.upper2);
            if (face.tmpInt === cond.upper2
                && l2?.alreadyStacked && l1?.alreadyStacked && !u1?.alreadyStacked
                && l2.tmpInt2 < l1.tmpInt2) return false;
            if (face.tmpInt === cond.upper1
                && l2?.alreadyStacked && l1?.alreadyStacked && !u2?.alreadyStacked
                && l1.tmpInt2 < l2.tmpInt2) return false;
        }
        return true;
    }
}

export class Folder {
    constructor(model) {
        this.model = model;
        this.overlapRelation = [];
        this.overlapRelations = [];
        this.subFaces = [];
        this.condition4s = [];
        this.tmp = new Map();
    }

    /**
     * Fold the crease pattern.
     * @param {{fullEstimation?: boolean}} [options]
     * @returns {{answerCount: number, overlapRelation: number[][]}}
     */
    fold({fullEstimation = true} = {}) {
        this.overlapRelations = [];
        this.condition4s = [];
        this.simpleFoldWithoutZorder();
        if (!fullEstimation) {
            this.#applyOffsets(null);
            return {answerCount: 0, overlapRelation: []};
        }

        this.subFaces = this.makeSubFaces();
        this.setOverlapRelation();
        this.step1();
        this.holdCondition3s();
        this.holdCondition4s();
        this.estimation(this.overlapRelation);

        const work = Folder.matrixCopy(this.overlapRelation);
        for (const sub of this.subFaces) sub.sortFaceOverlapOrder(work);

        if (this.subFaces.length === 0) {
            this.overlapRelations.push(Folder.matrixCopy(this.overlapRelation));
        } else {
            this.findAnswer(0, this.overlapRelation);
        }

        if (this.overlapRelations.length === 0) {
            this.overlapRelations.push(Folder.matrixCopy(this.overlapRelation));
        }
        this.overlapRelation = Folder.matrixCopy(this.overlapRelations[0]);
        this.#applyOffsets(this.overlapRelation);
        return {answerCount: this.overlapRelations.length, overlapRelation: this.overlapRelation};
    }

    static fold(model, options) {
        return new Folder(model).fold(options);
    }

    // --- Step 2: walk faces and mirror across creases (folded 2D in x,y) ---

    simpleFoldWithoutZorder() {
        const faces = this.model.faces;
        this.tmp = new Map();
        faces.forEach((face, id) => {
            face.faceFront = true;
            face.tmpFlg = false;
            face.tmpInt = id;
            const pos = new Map();
            for (const p of face.points) pos.set(p, {x: p.xf, y: p.yf});
            this.tmp.set(face, pos);
        });
        if (faces.length === 0) return;
        this.walkFace(faces[0]);
        for (const face of faces) {
            const pos = this.tmp.get(face);
            for (const p of face.points) {
                const q = pos.get(p);
                p.x = q.x;
                p.y = q.y;
                p.z = 0;
            }
            face.tmpFlg = false;
        }
    }

    walkFace(face) {
        face.tmpFlg = true;
        for (const he of this.#halfedges(face)) {
            if (!he.pairFace || he.pairFace.tmpFlg) continue;
            this.flipFace(he.pairFace, he);
            he.pairFace.tmpFlg = true;
            this.walkFace(he.pairFace);
        }
    }

    flipFace(face, baseHe) {
        const moving = this.tmp.get(face);
        const fixed = this.tmp.get(baseHe.face);
        const preA = moving.get(baseHe.p1);
        const preB = moving.get(baseHe.p2);
        const afterA = fixed.get(baseHe.p1);
        const afterB = fixed.get(baseHe.p2);

        const baseDir = {x: preB.x - preA.x, y: preB.y - preA.y};
        const after = {x: afterB.x - afterA.x, y: afterB.y - afterA.y};
        const afterLen = Math.hypot(after.x, after.y) || 1;
        const afterDir = {x: after.x / afterLen, y: after.y / afterLen};

        for (const p of face.points) {
            const cur = moving.get(p);
            const {d0, d1} = signedDistanceAndParam(cur, preA, baseDir);
            moving.set(p, {
                x: afterA.x + d1 * afterDir.x + d0 * afterDir.y,
                y: afterA.y + d1 * afterDir.y - d0 * afterDir.x,
            });
        }

        // A fold always turns the neighbor over when both still have the same front.
        if (face.faceFront === baseHe.face.faceFront) {
            for (const p of face.points) {
                const cur = moving.get(p);
                if (distanceToSegment2(cur, afterA, afterB) < EPS) continue;
                moving.set(p, reflectPoint(cur, afterA, afterB));
            }
            face.faceFront = !face.faceFront;
        }
    }

    // --- Overlap matrix ---

    setOverlapRelation() {
        const faces = this.model.faces;
        const size = faces.length;
        const eps = Math.max(this.#paperSize() * 1e-5, EPS);
        this.overlapRelation = Array.from({length: size}, () => new Array(size).fill(OR.NO_OVERLAP));
        for (let i = 0; i < size; i++) {
            this.overlapRelation[i][i] = OR.NO_OVERLAP;
            for (let j = i + 1; j < size; j++) {
                const overlap = polygonsOverlap(this.#folded(faces[i]), this.#folded(faces[j]), eps);
                const value = overlap ? OR.UNDEFINED : OR.NO_OVERLAP;
                this.overlapRelation[i][j] = value;
                this.overlapRelation[j][i] = value;
            }
        }
    }

    // Neighbor pairs: mountain / valley decide who is above.
    step1() {
        for (const face of this.model.faces) {
            for (const he of this.#halfedges(face)) {
                if (!he.pairFace) continue;
                const i = face.tmpInt, j = he.pairFace.tmpInt;
                const current = this.overlapRelation[i][j];
                if (current === OR.UPPER || current === OR.LOWER) continue;
                const type = this.#edgeType(he.segment);
                const ridgeOnFront = face.faceFront && type === FoldType.MOUNTAIN;
                const valleyOnBack = !face.faceFront && type === FoldType.VALLEY;
                if (ridgeOnFront || valleyOnBack) {
                    this.overlapRelation[i][j] = OR.UPPER;
                    this.overlapRelation[j][i] = OR.LOWER;
                } else if (type === FoldType.MOUNTAIN || type === FoldType.VALLEY) {
                    this.overlapRelation[i][j] = OR.LOWER;
                    this.overlapRelation[j][i] = OR.UPPER;
                }
            }
        }
    }

    // If face k covers the crease between i (lower) and j, then k is on the same
    // side of both — otherwise k would penetrate the crease.
    // http://mitani.cs.tsukuba.ac.jp/origami/img/invalid_cases.png (b)
    holdCondition3s() {
        for (const fI of this.model.faces) {
            for (const he of this.#halfedges(fI)) {
                if (!he.pairFace) continue;
                if (this.overlapRelation[fI.tmpInt][he.pairFace.tmpInt] !== OR.LOWER) continue;
                this.#recordCondition3(fI, he.pairFace, he);
            }
        }
    }

    #recordCondition3(fI, fJ, he) {
        for (const fK of this.model.faces) {
            if (fK === fI || fK === fJ || !this.#lineCrossesFace(fK, he)) continue;
            const cond = new Condition3(fI.tmpInt, fJ.tmpInt, fK.tmpInt);
            fK.condition3s = fK.condition3s || [];
            fK.condition3s.push(new Condition3(cond.upper, cond.lower, cond.other));
            for (const sub of this.subFaces) {
                if (sub.faces.includes(fI) && sub.faces.includes(fJ) && sub.faces.includes(fK)) {
                    sub.condition3s.push(cond);
                }
            }
        }
    }

    // Two stacked creases: four faces, four legal orders (A>B>C>D, C>D>A>B, A>C>D>B, C>A>B>D).
    // http://mitani.cs.tsukuba.ac.jp/origami/img/invalid_cases.png (c)
    holdCondition4s() {
        const internals = this.model.segments.filter((s) => Model.incidentFaces(this.model, s).length === 2);
        for (let i = 0; i < internals.length; i++) {
            for (let j = i + 1; j < internals.length; j++) {
                this.#recordCondition4(internals[i], internals[j]);
            }
        }
    }

    #recordCondition4(e0, e1) {
        const [left0, right0] = this.#edgeSides(e0);
        const [left1, right1] = this.#edgeSides(e1);
        if (!left0 || !right0 || !left1 || !right1) return;
        if (!segmentsOverlap(this.#foldedSeg(e0), this.#foldedSeg(e1))) return;
        const [upper0, lower0] = this.#upperLower(left0, right0);
        const [upper1, lower1] = this.#upperLower(left1, right1);
        const cond = new Condition4(upper0.tmpInt, lower0.tmpInt, upper1.tmpInt, lower1.tmpInt);
        const shared = this.subFaces.filter((sub) =>
            sub.faces.includes(left0) && sub.faces.includes(right0)
            && sub.faces.includes(left1) && sub.faces.includes(right1)
        );
        shared.forEach((sub) => sub.condition4s.push(cond));
        if (shared.length) this.condition4s.push(cond);
    }

    #upperLower(a, b) {
        return this.overlapRelation[a.tmpInt][b.tmpInt] === OR.UPPER ? [b, a] : [a, b];
    }

    estimation(orMat) {
        let changed;
        do {
            changed = this.#estimateBy3faces(orMat)
                || this.#estimateBy3faces2(orMat)
                || this.#estimateBy4faces(orMat);
        } while (changed);
    }

    #estimateBy3faces(orMat) {
        let changed = false;
        for (const fI of this.model.faces) {
            for (const he of this.#halfedges(fI)) {
                if (he.pairFace && this.#propagateAcrossCrease(orMat, fI, he)) changed = true;
            }
        }
        return changed;
    }

    #propagateAcrossCrease(orMat, fI, he) {
        let changed = false;
        const fJ = he.pairFace;
        for (const fK of this.model.faces) {
            if (fK === fI || fK === fJ || !this.#lineCrossesFace(fK, he, 0.0001)) continue;
            const ik = orMat[fI.tmpInt][fK.tmpInt];
            const jk = orMat[fJ.tmpInt][fK.tmpInt];
            if (ik !== OR.UNDEFINED && jk === OR.UNDEFINED) {
                this.#setOR(orMat, fJ.tmpInt, fK.tmpInt, ik, true);
                changed = true;
            } else if (jk !== OR.UNDEFINED && ik === OR.UNDEFINED) {
                this.#setOR(orMat, fI.tmpInt, fK.tmpInt, jk, true);
                changed = true;
            }
        }
        return changed;
    }

    // Transitivity on a subface: a>b and b>c ⇒ a>c
    #estimateBy3faces2(orMat) {
        let changed = false;
        for (const sub of this.subFaces) {
            const ids = sub.faces.map((f) => f.tmpInt);
            while (closeOneTransitive(ids, orMat)) changed = true;
        }
        return changed;
    }

    #estimateBy4faces(orMat) {
        const changed = [false];
        for (const cond of this.condition4s) this.#applyCondition4(orMat, cond, changed);
        return changed[0];
    }

    #applyCondition4(orMat, cond, changed) {
        const lower = (i, j) => this.#setLowerIfUndefined(orMat, i, j, changed);
        const isLower = (i, j) => orMat[i][j] === OR.LOWER;
        if (isLower(cond.lower1, cond.upper2)) {
            lower(cond.upper1, cond.upper2);
            lower(cond.upper1, cond.lower2);
            lower(cond.lower1, cond.lower2);
        }
        if (isLower(cond.lower2, cond.upper1)) {
            lower(cond.upper2, cond.upper1);
            lower(cond.upper2, cond.lower1);
            lower(cond.lower2, cond.lower1);
        }
        if (isLower(cond.upper1, cond.upper2) && isLower(cond.upper2, cond.lower1)) {
            lower(cond.upper1, cond.lower2);
            lower(cond.lower2, cond.lower1);
        }
        if (isLower(cond.upper1, cond.lower2) && isLower(cond.lower2, cond.lower1)) {
            lower(cond.upper1, cond.upper2);
            lower(cond.upper2, cond.lower1);
        }
        if (isLower(cond.upper2, cond.upper1) && isLower(cond.upper1, cond.lower2)) {
            lower(cond.upper2, cond.lower1);
            lower(cond.lower1, cond.lower2);
        }
        if (isLower(cond.upper2, cond.lower1) && isLower(cond.lower1, cond.lower2)) {
            lower(cond.upper2, cond.upper1);
            lower(cond.upper1, cond.lower2);
        }
    }

    findAnswer(subFaceIndex, orMat) {
        if (this.overlapRelations.length >= MAX_ANSWERS) return;
        const sub = this.subFaces[subFaceIndex];
        const last = subFaceIndex === this.subFaces.length - 1;
        const accept = (mat) => {
            if (last) this.overlapRelations.push(Folder.matrixCopy(mat));
            else this.findAnswer(subFaceIndex + 1, mat);
        };
        if (sub.allFaceOrderDecided) {
            accept(orMat);
            return;
        }
        for (const stack of sub.answerStacks) {
            if (!stackCompatible(stack, orMat)) continue;
            accept(applyStack(stack, orMat));
        }
    }

    // Sample each folded face centroid: faces that contain it share a subface.
    makeSubFaces() {
        const faces = this.model.faces;
        const eps = Math.max(this.#paperSize() / 1000, EPS);
        const locals = [];
        for (const face of faces) {
            const inner = centroid(this.#folded(face));
            const group = faces.filter((f) => pointInPolygon(inner, this.#folded(f), eps));
            if (group.length === 0) continue;
            if (!locals.some((s) => sameFaceSet(s.faces, group))) locals.push(new SubFace(group));
        }
        return locals;
    }

    static matrixCopy(from) {
        return from.map((row) => row.slice());
    }

    // --- OriSim3D write-back ---

    #applyOffsets(orMat) {
        const faces = this.model.faces;
        if (!orMat) {
            faces.forEach((f) => { f.offset = 0; });
            return;
        }
        const ranks = ranksFromMatrix(orMat);
        const step = 2;
        faces.forEach((face, i) => {
            const n = Model.normal(face);
            const sign = n[2] >= 0 ? 1 : -1;
            face.offset = sign * ranks[i] * step;
        });
    }

    // --- helpers ---

    #halfedges(face) {
        const pts = face.points;
        return pts.map((p1, i) => {
            const p2 = pts[(i + 1) % pts.length];
            const segment = this.model.getSegment(p1, p2);
            const incident = segment ? Model.incidentFaces(this.model, segment) : [];
            const pairFace = incident.find((f) => f !== face) || null;
            return {face, p1, p2, segment, pairFace};
        });
    }

    #folded(face) {
        return face.points.map((p) => ({x: p.x, y: p.y}));
    }

    #foldedSeg(segment) {
        return {a: {x: segment.p1.x, y: segment.p1.y}, b: {x: segment.p2.x, y: segment.p2.y}};
    }

    #edgeType(segment) {
        if (!segment) return FoldType.UNASSIGNED;
        if (segment.type === FoldType.MOUNTAIN || segment.type === FoldType.VALLEY) return segment.type;
        const n = Model.incidentFaces(this.model, segment).length;
        if (n < 2) return FoldType.BORDER;
        return FoldType.VALLEY;
    }

    #edgeSides(segment) {
        const faces = Model.incidentFaces(this.model, segment);
        return [faces[0], faces[1]];
    }

    #lineCrossesFace(face, he, pad = 0.001) {
        const poly = this.#folded(face);
        const a = {x: he.p1.x, y: he.p1.y};
        const b = {x: he.p2.x, y: he.p2.y};
        const mid = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
        if (pointInPolygon(mid, poly, pad)) return true;
        for (let i = 0; i < poly.length; i++) {
            const c = poly[i], d = poly[(i + 1) % poly.length];
            if (segmentsProperIntersect(a, b, c, d)) return true;
        }
        return false;
    }

    #paperSize() {
        const b = this.model.get2DBounds();
        return Math.max(b.xMax - b.xMin, b.yMax - b.yMin, 1);
    }

    #setOR(orMat, i, j, value, pair) {
        orMat[i][j] = value;
        if (pair) orMat[j][i] = value === OR.LOWER ? OR.UPPER : OR.LOWER;
    }

    #setLowerIfUndefined(orMat, i, j, changed) {
        if (orMat[i][j] === OR.UNDEFINED) {
            orMat[i][j] = OR.LOWER;
            orMat[j][i] = OR.UPPER;
            changed[0] = true;
        }
    }
}

function signedDistanceAndParam(p, origin, dir) {
    const len = Math.hypot(dir.x, dir.y) || 1;
    const ux = dir.x / len, uy = dir.y / len;
    const dx = p.x - origin.x, dy = p.y - origin.y;
    return {d1: dx * ux + dy * uy, d0: dx * uy - dy * ux};
}

function distanceToSegment2(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function reflectPoint(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) return {x: p.x, y: p.y};
    const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    const fx = a.x + t * abx, fy = a.y + t * aby;
    return {x: 2 * fx - p.x, y: 2 * fy - p.y};
}

function centroid(poly) {
    let x = 0, y = 0;
    for (const p of poly) {
        x += p.x;
        y += p.y;
    }
    const n = poly.length || 1;
    return {x: x / n, y: y / n};
}

function pointInPolygon(p, poly, eps = EPS) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        if (Math.hypot(xi - p.x, yi - p.y) < eps) return true;
        const denom = (yj - yi) || EPS;
        const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / denom + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function polygonsOverlap(a, b, eps) {
    if (a.some((p) => pointInPolygon(p, b, eps)) || b.some((p) => pointInPolygon(p, a, eps))) return true;
    for (let i = 0; i < a.length; i++) {
        const a1 = a[i], a2 = a[(i + 1) % a.length];
        for (let j = 0; j < b.length; j++) {
            if (segmentsProperIntersect(a1, a2, b[j], b[(j + 1) % b.length])) return true;
        }
    }
    return pointInPolygon(centroid(a), b, eps) || pointInPolygon(centroid(b), a, eps);
}

function segmentsProperIntersect(a, b, c, d) {
    const d1 = cross(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y);
    const d2 = cross(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y);
    const d3 = cross(d.x - c.x, d.y - c.y, a.x - c.x, a.y - c.y);
    const d4 = cross(d.x - c.x, d.y - c.y, b.x - c.x, b.y - c.y);
    return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS))
        && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}

function segmentsOverlap(s0, s1) {
    const {a, b} = s0, {a: c, b: d} = s1;
    if (segmentsProperIntersect(a, b, c, d)) return true;
    const abx = b.x - a.x, aby = b.y - a.y;
    const len = Math.hypot(abx, aby) || 1;
    const distC = Math.abs(cross(abx, aby, c.x - a.x, c.y - a.y)) / len;
    const distD = Math.abs(cross(abx, aby, d.x - a.x, d.y - a.y)) / len;
    if (distC > 2 && distD > 2) return false;
    const t = (p) => ((p.x - a.x) * abx + (p.y - a.y) * aby) / (len * len);
    const t0 = Math.min(t(c), t(d)), t1 = Math.max(t(c), t(d));
    return t1 > 0.05 && t0 < 0.95 && Math.min(t1, 1) - Math.max(t0, 0) > 0.2;
}

function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
}

function sameFaceSet(a, b) {
    return a.length === b.length && a.every((f) => b.includes(f));
}

function closeOneTransitive(ids, orMat) {
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            if (closePairVia(ids, ids[i], ids[j], orMat)) return true;
        }
    }
    return false;
}

function closePairVia(ids, a, b, orMat) {
    if (orMat[a][b] !== OR.UNDEFINED) return false;
    for (const c of ids) {
        if (c === a || c === b) continue;
        if (orMat[a][c] === OR.UPPER && orMat[c][b] === OR.UPPER) {
            orMat[a][b] = OR.UPPER;
            orMat[b][a] = OR.LOWER;
            return true;
        }
        if (orMat[a][c] === OR.LOWER && orMat[c][b] === OR.LOWER) {
            orMat[a][b] = OR.LOWER;
            orMat[b][a] = OR.UPPER;
            return true;
        }
    }
    return false;
}

function stackCompatible(stack, orMat) {
    for (let i = 0; i < stack.length; i++) {
        for (let j = i + 1; j < stack.length; j++) {
            if (orMat[stack[i].tmpInt][stack[j].tmpInt] === OR.LOWER) return false;
        }
    }
    return true;
}

function applyStack(stack, orMat) {
    const pass = Folder.matrixCopy(orMat);
    for (let i = 0; i < stack.length; i++) {
        for (let j = i + 1; j < stack.length; j++) {
            pass[stack[i].tmpInt][stack[j].tmpInt] = OR.UPPER;
            pass[stack[j].tmpInt][stack[i].tmpInt] = OR.LOWER;
        }
    }
    return pass;
}

function ranksFromMatrix(orMat) {
    const n = orMat.length;
    const rank = new Array(n).fill(0);
    for (let pass = 0; pass < n; pass++) {
        let changed = false;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (orMat[i][j] === OR.UPPER && rank[i] <= rank[j]) {
                    rank[i] = rank[j] + 1;
                    changed = true;
                }
            }
        }
        if (!changed) break;
    }
    return rank;
}

export {Condition3, Condition4, SubFace};
