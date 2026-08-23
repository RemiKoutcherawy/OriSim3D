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

    static async writeFold(model, filename = 'OriSim3d.fold') {
        const json = this.toJSONFold(model);
        if (typeof Deno !== "undefined") {
            await Deno.writeTextFile(filename, json);
            return json;
        }
        if (!filename.endsWith('.fold')) filename = `${filename}.fold`;
        if (globalThis.showSaveFilePicker) {
            try {
                const handle = await globalThis.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{description: 'FOLD', accept: {'application/json': ['.fold', '.json']}}],
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
            } catch (e) {
                if (e.name !== 'AbortError') throw e;
            }
            return json;
        }
        const data = new Blob([json], { type: "application/json" });
        const link = document.createElement("a");
        link.setAttribute("download", filename);
        link.setAttribute("href", globalThis.URL.createObjectURL(data));
        link.click();
        return json;
    }

    // Face fill color for SVG export (View3d front/back tints when view3d is available)
    /**
     * @param {{ points: import('./Point.js').Point[] }} face
     * @param {number} index
     * @param {{ modelView?: Float32Array } | null} [view3d]
     */
    static svgFaceFillColor(face, index, view3d) {
        if (view3d?.modelView) {
            const n = Model.normal(face);
            const mv = view3d.modelView;
            const nx = mv[0] * n[0] + mv[4] * n[1] + mv[8] * n[2];
            const ny = mv[1] * n[0] + mv[5] * n[1] + mv[9] * n[2];
            const nz = mv[2] * n[0] + mv[6] * n[1] + mv[10] * n[2];
            const nLen = Math.hypot(nx, ny, nz) || 1;
            const nv = [nx / nLen, ny / nLen, nz / nLen];
            const front = nv[2] > 0;
            const lightLen = Math.hypot(0.1, 0.1, 0.75);
            const directional = (nv[0] * 0.1 + nv[1] * 0.1 + nv[2] * 0.75) / lightLen;
            const lighting = Math.max(0, front ? 0.1 + directional : 0.1 - directional);
            const base = front ? [0x70, 0xAC, 0xF3] : [0xFF, 0xFF, 0x00];
            const channel = (c) => Math.round(Math.min(255, c * lighting)).toString(16).padStart(2, '0');
            return `#${channel(base[0])}${channel(base[1])}${channel(base[2])}`;
        }
        const hue = Math.round((index * 137.508) % 360);
        return `hsl(${hue}, 70%, 80%)`;
    }

    static svgFaceDepth(face, view3d) {
        if (view3d?.modelView) {
            const mv = view3d.modelView;
            let z = 0;
            for (const p of face.points) {
                z += mv[2] * p.x + mv[6] * p.y + mv[10] * p.z + mv[14];
            }
            return z / face.points.length;
        }
        let z = 0;
        for (const p of face.points) {
            z += p.z;
        }
        return z / face.points.length;
    }

    // Pure render of the current xCanvas/yCanvas projection to SVG polygons+lines and their
    // bounds. Shared by writeSVG (single 3D view) and writeDiagrams (one 3D view per step).
    /**
     * @param {import('./Model.js').Model} model
     * @param {{ modelView?: Float32Array } | null} [view3d]
     */
    static buildSVG(model, view3d = null) {
        let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
        for (const p of model.points) {
            if (p.xCanvas == null || p.yCanvas == null) continue;
            xMin = Math.min(xMin, p.xCanvas);
            yMin = Math.min(yMin, p.yCanvas);
            xMax = Math.max(xMax, p.xCanvas);
            yMax = Math.max(yMax, p.yCanvas);
        }
        if (!Number.isFinite(xMin)) {
            throw new Error('buildSVG: no projected canvas coordinates (call with view3d or set xCanvas/yCanvas)');
        }
        const pad = 10;
        const width = Math.max(xMax - xMin, 1) + 2 * pad;
        const height = Math.max(yMax - yMin, 1) + 2 * pad;
        const toSvg = (p) => `${(p.xCanvas - xMin + pad).toFixed(2)},${(p.yCanvas - yMin + pad).toFixed(2)}`;
        const faces = [...model.faces].sort((a, b) =>
            ReadWrite.svgFaceDepth(a, view3d) - ReadWrite.svgFaceDepth(b, view3d));
        const polygons = faces.map((f, index) => {
            const pts = f.points;
            if (!pts?.length || pts.some(p => p.xCanvas == null || p.yCanvas == null)) return '';
            const points = pts.map(toSvg).join(' ');
            const fill = ReadWrite.svgFaceFillColor(f, index, view3d);
            return `<polygon points="${points}" fill="${fill}" stroke="none"/>`;
        }).filter(Boolean).join('\n  ');
        const lines = model.segments.map((s) => {
            if (s.p1.xCanvas == null || s.p2.xCanvas == null) return '';
            const x1 = (s.p1.xCanvas - xMin + pad).toFixed(2);
            const y1 = (s.p1.yCanvas - yMin + pad).toFixed(2);
            const x2 = (s.p2.xCanvas - xMin + pad).toFixed(2);
            const y2 = (s.p2.yCanvas - yMin + pad).toFixed(2);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }).filter(Boolean).join('\n  ');
        return {width, height, content: `${polygons}\n  ${lines}`};
    }

    // Export current 3D view as SVG (projected xCanvas, yCanvas faces and edges)
    /**
     * @param {import('./Model.js').Model} model
     * @param {string} [filename]
     * @param {{ modelView?: Float32Array, updateCanvasCoords?: () => void } | null} [view3d]
     */
    static async writeSVG(model, filename = 'OriSim3d.svg', view3d = null) {
        if (view3d?.updateCanvasCoords) {
            view3d.updateCanvasCoords();
        }
        const {width, height, content} = ReadWrite.buildSVG(model, view3d);
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" fill="none" stroke="#111" stroke-width="1">
  ${content}
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

    // Simple orthographic (x,y) -> canvas projection for a model with no live WebGL view,
    // e.g. a headless step snapshot from Command.replaySteps. y is flipped (SVG y grows down).
    // Looks straight down world z, so it pairs with the identity view3d used for face colors.
    static projectOrtho(model) {
        for (const p of model.points) {
            p.xCanvas = p.x;
            p.yCanvas = -p.y;
        }
    }

    // Identity modelView: front/back face tinting (svgFaceFillColor) matches world-space z,
    // consistent with projectOrtho looking straight down z.
    static ORTHO_VIEW3D = {
        modelView: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    };

    // Lay out a sequence of Model snapshots as a grid of 3D-view SVG cells, one cell per step:
    // reuses buildSVG (the same renderer as writeSVG) so both stay in sync, including the
    // same front/back blue/yellow face tinting instead of an arbitrary rainbow fallback.
    static diagramsToSVG(models, {cols = 4, cellSize = 220, pad = 12} = {}) {
        const rows = Math.max(1, Math.ceil(models.length / cols));
        const width = cols * cellSize;
        const height = rows * cellSize;
        const cells = models.map((model, i) => {
            ReadWrite.projectOrtho(model);
            const {width: w, height: h, content} = ReadWrite.buildSVG(model, ReadWrite.ORTHO_VIEW3D);
            const scale = (cellSize - 2 * pad) / Math.max(w, h);
            const col = i % cols, row = Math.floor(i / cols);
            const ox = col * cellSize + (cellSize - w * scale) / 2;
            const oy = row * cellSize + (cellSize - h * scale) / 2;
            const label = `<text x="${col * cellSize + 4}" y="${row * cellSize + 16}" font-size="12" stroke="none" fill="#333">${i + 1}</text>`;
            return `<g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${scale.toFixed(4)})" stroke-width="${(1 / scale).toFixed(3)}">\n    ${content}\n  </g>\n  ${label}`;
        }).join('\n  ');
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="#111" stroke-width="1">
  ${cells}
</svg>
`;
    }

    // Export a sequence of Model snapshots (one per folding instruction) as a single SVG:
    // one 3D-view diagram per step, the same rendering writeSVG uses for the live view.
    static async writeDiagrams(models, filename = 'OriSim3d-diagrams.svg') {
        const svg = ReadWrite.diagramsToSVG(models);
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
        // Valid FOLD crease assignments; anything else (or missing) stays 'U' unassigned
        const VALID_ASSIGNMENTS = new Set(['M', 'V', 'B', 'F', 'U']);
        model.segments = fold.edges_vertices.map((edge, i) => {
            const segment = new Segment(model.points[edge[0]], model.points[edge[1]]);
            const assignment = fold.edges_assignment?.[i]?.toUpperCase?.();
            if (assignment && VALID_ASSIGNMENTS.has(assignment)) segment.assignment = assignment;
            return segment;
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
