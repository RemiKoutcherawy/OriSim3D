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
                    edges: command.model.edges,
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
        } else {
            const data = new Blob([json], { type: "application/json" });
            const link = document.createElement("a");
            link.setAttribute("download", filename);
            link.setAttribute("href", globalThis.URL.createObjectURL(data));
            link.click();
        }
        return json;
    }

    // Export current 3D view as SVG (projected xCanvas, yCanvas edges)
    static async writeSVG(model, filename = 'OriSim3d.svg', view3d = null) {
        if (view3d) {
            view3d.updateCanvasCoords();
        }
        let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
        for (const p of model.points) {
            if (p.xCanvas == null || p.yCanvas == null) continue;
            xMin = Math.min(xMin, p.xCanvas);
            yMin = Math.min(yMin, p.yCanvas);
            xMax = Math.max(xMax, p.xCanvas);
            yMax = Math.max(yMax, p.yCanvas);
        }
        if (!Number.isFinite(xMin)) {
            throw new Error('writeSVG: no projected canvas coordinates (call with view3d or set xCanvas/yCanvas)');
        }
        const pad = 10;
        const width = Math.max(xMax - xMin, 1) + 2 * pad;
        const height = Math.max(yMax - yMin, 1) + 2 * pad;
        const lines = model.segments.map((s) => {
            if (s.p1.xCanvas == null || s.p2.xCanvas == null) return '';
            const x1 = (s.p1.xCanvas - xMin + pad).toFixed(2);
            const y1 = (s.p1.yCanvas - yMin + pad).toFixed(2);
            const x2 = (s.p2.xCanvas - xMin + pad).toFixed(2);
            const y2 = (s.p2.yCanvas - yMin + pad).toFixed(2);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }).filter(Boolean).join('\n  ');
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" fill="none" stroke="#111" stroke-width="1">
  ${lines}
</svg>
`;
        if (!filename.endsWith('.svg')) filename = `${filename}.svg`;
        if (typeof Deno !== "undefined") {
            await Deno.writeTextFile(filename, svg);
        } else {
            const data = new Blob([svg], {type: 'image/svg+xml'});
            const link = document.createElement('a');
            link.setAttribute('download', filename);
            link.setAttribute('href', globalThis.URL.createObjectURL(data));
            link.click();
        }
        return svg;
    }

    static toJSONFold(model) {
        const points = model.points;
        const vertices_coords = [];
        points.forEach((p) => {
            const xy = [p.xf, p.yf];
            vertices_coords.push(xy);
        })
        const segments = model.segments;
        const edges_vertices = [];
        segments.forEach((s) => {
            const indexes = [points.indexOf(s.p1), points.indexOf(s.p2)]
            edges_vertices.push(indexes);
        });
        const edges_assignment = [];
        segments.forEach((s) => {
            const faces = model.searchFacesWithAB(s.p1, s.p2);
            edges_assignment.push(faces.length === 1 ? "B" : "F");
        });
        const faces = model.faces;
        const faces_vertices = [];
        faces.forEach((f) => {
            const indexes = [];
            f.points.forEach((p) => {
                indexes.push(points.indexOf(p));
            });
            faces_vertices.push(indexes);
        });
        const faces_edges = [];
        faces.forEach((f) => {
            const indexes = [];
            const len = f.points.length;
            for (let i = 0; i < len; i++) {
                const p1 = f.points[i];
                const p2 = f.points[(i + 1) % len];
                const edgeIndex = segments.findIndex((s) => (s.p1 === p1 && s.p2 === p2) || (s.p1 === p2 && s.p2 === p1));
                if (edgeIndex !== -1) {
                    indexes.push(edgeIndex);
                }
            }
            faces_edges.push(indexes);
        });
        const FOLD = {
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
        json = json.replaceAll(reg, (_match, g1, g2) => `[${g1},${g2}]`);
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
        // Rescale crease-pattern coords to roughly [-200, 200]
        const {xMin, yMin, xMax, yMax} = model.get2DBounds();
        const width = xMax - xMin;
        const height = yMax - yMin;
        const ratio = Math.max(width, height) / 400 || 1;
        const is3d = !!(fold.is3d || (Array.isArray(fold.frame_attributes) && fold.frame_attributes.includes('3D')));
        model.points.forEach((p) => {
            const xf = (p.xf - xMin) / ratio - 200;
            const yf = (p.yf - yMin) / ratio - 200;
            if (is3d) {
                p.x = (p.x - xMin) / ratio - 200;
                p.y = (p.y - yMin) / ratio - 200;
                p.z = p.z / ratio;
                p.xf = xf;
                p.yf = yf;
            } else {
                p.xf = xf;
                p.yf = yf;
                p.x = xf;
                p.y = yf;
                p.z = 0;
            }
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
        link.setAttribute("href", globalThis.URL.createObjectURL(data));
        link.click();
    }

}

// 135
