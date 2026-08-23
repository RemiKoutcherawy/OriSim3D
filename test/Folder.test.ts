import {assertEquals, assert} from "@std/assert";
import {Model} from "../js/Model.js";
import {Point} from "../js/Point.js";
import {Command} from "../js/Command.js";
import {Folder, FoldType, OR} from "../js/Folder.js";
import {ReadWrite} from "../js/ReadWrite.js";

function bookFoldModel() {
    const model = new Model().init(200, 200);
    model.splitBy2d(new Point(0, -200), new Point(0, 200));
    const crease = model.getSegment(
        model.points.find((p) => p.xf === 0 && p.yf === -200),
        model.points.find((p) => p.xf === 0 && p.yf === 200),
    );
    crease.type = FoldType.VALLEY;
    return {model, crease};
}

Deno.test("Folder", async (t) => {
    await t.step("book fold maps the left half onto the right", () => {
        const {model} = bookFoldModel();
        assertEquals(model.faces.length, 2);
        const result = Folder.fold(model);
        assert(result.answerCount >= 1, "at least one layer assignment");

        const left = model.points.filter((p) => p.xf < -1);
        for (const p of left) {
            assertEquals(Math.round(p.x), 200, `xf=${p.xf} should fold to x=200, got ${p.x}`);
            assertEquals(Math.round(p.z), 0);
        }
        const creasePts = model.points.filter((p) => Math.abs(p.xf) < 1);
        for (const p of creasePts) {
            assertEquals(Math.round(p.x), 0);
        }
        // Crease pattern is unchanged
        assertEquals(model.points[0].xf, -200);
    });

    await t.step("valley book fold stacks the moving face above the other", () => {
        const {model} = bookFoldModel();
        const result = Folder.fold(model);
        const or = result.overlapRelation;
        assertEquals(or.length, 2);
        assert(or[0][1] === OR.UPPER || or[0][1] === OR.LOWER);
        assertEquals(or[1][0], or[0][1] === OR.UPPER ? OR.LOWER : OR.UPPER);
        assert(model.faces.some((f) => f.offset !== 0) || model.faces[0].offset !== model.faces[1].offset
            || true);
        const offsets = model.faces.map((f) => f.offset);
        assert(offsets[0] !== offsets[1], `offsets should differ: ${offsets}`);
    });

    await t.step("mountain is the opposite of valley", () => {
        const valley = bookFoldModel();
        Folder.fold(valley.model);
        const mountain = bookFoldModel();
        mountain.crease.type = FoldType.MOUNTAIN;
        Folder.fold(mountain.model);
        assert(
            valley.model.faces[0].offset !== mountain.model.faces[0].offset
            || valley.model.faces[1].offset !== mountain.model.faces[1].offset,
            "mountain and valley should invert layer offsets",
        );
    });

    await t.step("fold without estimation keeps z-order at 0", () => {
        const {model} = bookFoldModel();
        Folder.fold(model, {fullEstimation: false});
        assertEquals(model.faces[0].offset, 0);
        assertEquals(model.faces[1].offset, 0);
        const left = model.points.filter((p) => p.xf < -1);
        assertEquals(Math.round(left[0].x), 200);
    });

    await t.step("two sequential folds (quarter sheet)", () => {
        const model = new Model().init(200, 200);
        model.splitBy2d(new Point(0, -200), new Point(0, 200));
        model.splitBy2d(new Point(-200, 0), new Point(200, 0));
        assertEquals(model.faces.length, 4);
        for (const s of model.segments) {
            if (model.searchFacesWithAB(s.p1, s.p2).length === 2) s.type = FoldType.VALLEY;
        }
        const result = Folder.fold(model);
        assert(result.answerCount >= 1);
        // All four corners of the square should land in the same quadrant
        const corners = [model.points[0], model.points[1], model.points[2], model.points[3]];
        const xs = corners.map((p) => Math.round(p.x));
        const ys = corners.map((p) => Math.round(p.y));
        assertEquals(new Set(xs).size, 1, `corners x ${xs}`);
        assertEquals(new Set(ys).size, 1, `corners y ${ys}`);
    });

    await t.step("command foldcp / mountain / valley", () => {
        const model = new Model().init(200, 200);
        const cmd = new Command(model);
        cmd.command("d 200 200").anim();
        cmd.command("split s0 0.5").anim();
        cmd.command("split s2 0.5").anim();
        cmd.command("by2d p4 p5").anim();
        const crease = model.segments.find((s) =>
            Math.abs(s.p1.xf) < 1 && Math.abs(s.p2.xf) < 1
        );
        assert(crease, "vertical crease");
        const n = model.segments.indexOf(crease);
        cmd.command(`valley s${n}`).anim();
        assertEquals(crease.type, FoldType.VALLEY);
        cmd.command("foldcp").anim();
        const left = model.points.filter((p) => p.xf < -1);
        assertEquals(Math.round(left[0].x), 200);
    });

    await t.step("serialize keeps Segment.type", () => {
        const {model, crease} = bookFoldModel();
        const json = model.serialize();
        const restored = Model.deserialize(json);
        const restoredCrease = restored.segments.find((s) =>
            Math.abs(s.p1.xf) < 1 && Math.abs(s.p2.xf) < 1
        );
        assertEquals(restoredCrease?.type, FoldType.VALLEY);
        assertEquals(crease.type, FoldType.VALLEY);
    });

    await t.step("FOLD import keeps edges_assignment", () => {
        const model = new Model().init(200, 200);
        model.splitBy2d(new Point(0, -200), new Point(0, 200));
        const crease = model.segments.find((s) =>
            Math.abs(s.p1.xf) < 1 && Math.abs(s.p2.xf) < 1
        );
        crease.type = FoldType.MOUNTAIN;
        const json = ReadWrite.toJSONFold(model);
        const parsed = JSON.parse(json);
        assert(parsed.edges_assignment.includes("M"));
        const loaded = ReadWrite.jsonFoldToModel(json);
        assert(loaded.segments.some((s) => s.type === FoldType.MOUNTAIN));
    });
});
