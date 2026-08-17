// Input and Output
import {Point} from "./Point.js";
import {Segment} from "./Segment.js";
import {Model, State} from "./Model.js";
import {Face} from "./Face.js";

export class ReadWrite {

    static chooseFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.fold,.json,text/plain';
            input.onchange = (e) => {
                resolve(e.target.files?.[0] || null);
            };
            input.onabort = () => resolve(null);
            input.oncancel = () => resolve(null);
            input.click();
        });
    }

    // Replace the command queue (and stop a running animation)
    static resetCommand(command) {
        command.done = [];
        command.tokenTodo = [];
        command.iToken = 0;
        command.instructions = [];
        command.tpi = 0;
        command.tni = 1;
        command.model.state = State.run;
    }

    // Load a command script or a FOLD JSON into an existing Command
    static loadText(command, text) {
        const trimmed = String(text ?? '').replace(/^\uFEFF/, '').trim();
        if (!trimmed) return 'empty';
        if (trimmed.startsWith('{')) {
            try {
                const loaded = ReadWrite.jsonFoldToModel(trimmed);
                const keep = {
                    labels: command.model.labels,
                    textures: command.model.textures,
                    overlay: command.model.overlay,
                    lines: command.model.lines,
                    snap: command.model.snap,
                };
                ReadWrite.resetCommand(command);
                Object.assign(command.model, loaded, keep);
                command.model.state = State.run;
                if (command.commandArea) {
                    command.commandArea.textarea.value = '';
                }
                return 'fold';
            } catch {
                // Fall through and treat as a command script
            }
        }
        ReadWrite.resetCommand(command);
        const area = command.commandArea;
        command.commandArea = undefined;
        command.command(trimmed);
        command.commandArea = area;
        if (area) {
            const withNl = trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
            area.textarea.value = withNl;
            area.textarea.selectionStart = area.textarea.selectionEnd = withNl.length;
        }
        return 'script';
    }

    // Read with FileReader return text or null
    static async readFileAsText(filename) {
        if (typeof Deno !== "undefined") {
            if (!filename) return null;
            return await Deno.readTextFile(filename);
        }
        const file = await this.chooseFile();
        if (!file) return null;
        return await file.text();
    }

    static async writeFold(model, filename) {
        const json = this.toJSONFold(model);
        if (typeof Deno !== "undefined") {
            await Deno.writeTextFile(filename, json);
            await ReadWrite.readFileAsText(filename);
        } else {
            const data = new Blob([json], { type: "application/json" });
            const link = document.createElement("a");
            link.setAttribute("download", filename);
            link.setAttribute("href", window.URL.createObjectURL(data));
            link.click();
        }
        return json;
    }

    static toJSONFold(model) {
        let points = model.points;
        let vertices_coords = [];
        points.forEach((p) => {
            let xy = [p.xf, p.yf];
            vertices_coords.push(xy);
        })
        let segments = model.segments;
        let edges_vertices = [];
        segments.forEach((s) => {
            let indexes = [points.indexOf(s.p1), points.indexOf(s.p2)]
            edges_vertices.push(indexes);
        });
        let edges_assignment = [];
        segments.forEach((s) => {
            let faces = model.searchFacesWithAB(s.p1, s.p2);
            edges_assignment.push(faces.length === 1 ? "B" : "F");
        });
        let faces = model.faces;
        let faces_vertices = [];
        faces.forEach((f) => {
            let indexes = [];
            f.points.forEach((p) => {
                const q = model.addPoint(p.xf, p.yf, p.x, p.y, p.z);
                indexes.push(points.indexOf(q));
            });
            faces_vertices.push(indexes);
        });
        let faces_edges = [];
        faces.forEach((f) => {
            let indexes = [];
            f.points.forEach((p) => {
                segments.forEach((s, i) => {
                    if (s.p1 === p || s.p2 === p) indexes.push(i);
                });
            });
            faces_edges.push(indexes);
        });
        let FOLD = {
            file_spec: 1.1,
            file_creator: "OriSim3D",
            file_classes: ["singleModel"],
            frame_classes: ["creasePattern"],
            vertices_coords: vertices_coords,
            edges_vertices: edges_vertices,
            edges_assignment: edges_assignment,
            faces_vertices: faces_vertices,
            faces_edges: faces_edges
        };
        let json = JSON.stringify(FOLD, undefined, 2);

        // Cosmetic
        let reg = /\[[\n\s]*(-?\d+),[\n\s]*(-?\d+)[\n\s]*]/mg;
        json = json.replaceAll(reg, (match, g1, g2) => `[${g1},${g2}]`);
        reg = /\[\s*-?\d+(?:\s*,\s*-?\d+)*\s*]/g;
        // More cosmetics
        json = json.replaceAll(reg, (match) => {
            return match.replaceAll(/[\n\s]*/g, '');
        });

        return json;
    }

// Read fold and return model
    static jsonFoldToModel(json) {
        const fold = JSON.parse(json, reviverFold);
        const model = new Model();
        model.points = fold.vertices_coords;
        model.segments = fold.edges_vertices.map((edge) => {
            return new Segment(model.points[edge[0]], model.points[edge[1]]);
        });
        model.faces = fold.faces_vertices.map((face) => {
            return new Face(face.map((index) => model.points[index]));
        });
        // Rescale to -200, 200
        let {xMin, yMin, xMax, yMax} = model.get2DBounds();
        let width = xMax - xMin;
        let height = yMax - yMin;
        let ratio = Math.max(width, height) / 400;
        model.points.forEach((p) => {
            p.xf = (p.xf - xMin) / ratio - 200;
            p.yf = (p.yf - yMin) / ratio - 200;
            p.x = p.xf;
            p.y = p.yf;
            p.z = 0;
        });

        return model;

        function reviverFold(key, value) {
            if (key === 'frame_attributes') {
                this.is3d = (value[0] === '3D');
                return value;
            } else if (key === 'vertices_coords') {
                if (this.is3d) {
                    return value.map((xyz) => new Point(xyz[0], xyz[1], xyz[0], xyz[1], xyz[2]));
                } else {
                    return value.map((xy) => new Point(xy[0], xy[1]));
                }
            } else {
                return value;
            }
        }
    }

    static async writeFile(filename = 'OriSim3d.txt', text) {
        if (typeof Deno !== "undefined") {
            await Deno.writeTextFile(filename, text);
            return;
        }
        if (!filename.endsWith('.txt')) filename = `${filename}.txt`;
        // Save-as picker when the browser supports it
        if (globalThis.showSaveFilePicker) {
            try {
                const handle = await globalThis.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{description: 'Texte', accept: {'text/plain': ['.txt']}}],
                });
                const writable = await handle.createWritable();
                await writable.write(text);
                await writable.close();
            } catch (e) {
                if (e.name !== 'AbortError') throw e;
            }
            return;
        }
        // Download using filename
        const data = new Blob([text], {type: "text/plain"});
        const link = document.createElement("a");
        link.setAttribute("download", filename);
        link.setAttribute("href", window.URL.createObjectURL(data));
        link.click();
    }

}

// 135
