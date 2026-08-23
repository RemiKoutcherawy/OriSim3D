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
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" fill="none" stroke="#111" stroke-width="1">
  ${polygons}
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

    static toJSONFold(model, {includeFoldedFrame = true} = {}) {
        const points = model.points;
        const vertices_coords = points.map((p) => [p.xf, p.yf]);
        const segments = model.segments;
        const edges_vertices = segments.map((s) => [points.indexOf(s.p1), points.indexOf(s.p2)]);
        const edges_assignment = segments.map((s) => {
            const faces = model.searchFacesWithAB(s.p1, s.p2);
            if (faces.length <= 1) return 'B';
            const a = s.assignment || 'U';
            return a === 'B' ? 'U' : a;
        });
        const faces_vertices = model.faces.map((f) => f.points.map((p) => points.indexOf(p)));
        const faces_edges = model.faces.map((f) => {
            const indexes = [];
            const len = f.points.length;
            for (let i = 0; i < len; i++) {
                const p1 = f.points[i];
                const p2 = f.points[(i + 1) % len];
                const edgeIndex = segments.findIndex((s) => (s.p1 === p1 && s.p2 === p2) || (s.p1 === p2 && s.p2 === p1));
                if (edgeIndex !== -1) indexes.push(edgeIndex);
            }
            return indexes;
        });
        const FOLD = {
            file_spec: 1.1,
            file_creator: 'OriSim3D',
            file_classes: ['singleModel'],
            frame_classes: ['creasePattern'],
            frame_attributes: ['2D'],
            vertices_coords,
            edges_vertices,
            edges_assignment,
            faces_vertices,
            faces_edges,
        };
        const has3d = points.some((p) => Math.abs(p.z) > 1e-9 || Math.abs(p.x - p.xf) > 1e-9 || Math.abs(p.y - p.yf) > 1e-9);
        if (includeFoldedFrame && has3d) {
            FOLD.file_frames = [{
                frame_classes: ['foldedForm'],
                frame_attributes: ['3D'],
                frame_inherit: true,
                frame_parent: 0,
                vertices_coords: points.map((p) => [p.x, p.y, p.z]),
            }];
        }
        let json = JSON.stringify(FOLD, undefined, 2);
        return ReadWrite.compactJsonNumberArrays(json);
    }

    // Collapse whitespace inside leaf number arrays for readable .fold files
    static compactJsonNumberArrays(json) {
        let previous;
        do {
            previous = json;
            json = json.replaceAll(/\[([^[\]]*)]/g, (match, inner) => {
                const trimmed = inner.trim();
                if (!trimmed) return '[]';
                const parts = trimmed.split(',');
                if (!parts.every((part) => /^-?\d+(?:\.\d+)?$/.test(part.trim()))) {
                    return match;
                }
                return `[${parts.map((part) => part.trim()).join(',')}]`;
            });
        } while (json !== previous);
        return json;
    }

    // Crease-pattern SVG fragment (xf/yf), Y flipped like View2d
    static creasePatternSVGContent(model, {pad = 10, showLabels = false} = {}) {
        const {xMin, yMin, xMax, yMax} = model.get2DBounds();
        const width = Math.max(xMax - xMin, 1) + 2 * pad;
        const height = Math.max(yMax - yMin, 1) + 2 * pad;
        const tx = (xf) => (xf - xMin + pad).toFixed(2);
        const ty = (yf) => (yMax - yf + pad).toFixed(2);
        const faces = model.faces.map((f) => {
            const pts = f.points.map((p) => `${tx(p.xf)},${ty(p.yf)}`).join(' ');
            return `<polygon points="${pts}" fill="#cce4ff" stroke="none"/>`;
        }).join('\n  ');
        const lines = model.segments.map((s) => {
            const color = Segment.strokeStyle(s.assignment);
            const dash = Segment.isDashed(s.assignment) ? ' stroke-dasharray="8 6"' : '';
            return `<line x1="${tx(s.p1.xf)}" y1="${ty(s.p1.yf)}" x2="${tx(s.p2.xf)}" y2="${ty(s.p2.yf)}" stroke="${color}" stroke-width="2"${dash}/>`;
        }).join('\n  ');
        let labels = '';
        if (showLabels) {
            labels = model.segments.map((s, i) => {
                const xc = (s.p1.xf + s.p2.xf) / 2;
                const yc = (s.p1.yf + s.p2.yf) / 2;
                return `<text x="${tx(xc)}" y="${ty(yc)}" font-size="12" fill="#111">${i}${s.assignment && s.assignment !== 'U' && s.assignment !== 'B' ? s.assignment : ''}</text>`;
            }).join('\n  ');
        }
        return {width, height, body: `${faces}\n  ${lines}\n  ${labels}`};
    }

    static creasePatternSVG(model, options = {}) {
        const {width, height, body} = ReadWrite.creasePatternSVGContent(model, options);
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}">
  ${body}
</svg>
`;
    }

    // Multi-step diagram SVG from a command script (instant replay)
    static parsePlaybookSteps(text) {
        return String(text ?? '')
            .split(/\r?\n/)
            .map((line) => line.replace(/(:?\/\/|<!--).*/, '').trim())
            .filter(Boolean);
    }

    static async writeDiagrams(scriptText, filename = 'OriSim3d-diagrams.svg') {
        const {Command} = await import('./Command.js');
        const steps = ReadWrite.parsePlaybookSteps(scriptText);
        const model = new Model().init(200, 200);
        const command = new Command(model);
        command.instantReplay = true;
        const pageW = 420;
        const pageH = 460;
        const pages = [];
        for (let i = 0; i < steps.length; i++) {
            command.command(steps[i]);
            command.drain();
            const {body} = ReadWrite.creasePatternSVGContent(model, {pad: 16});
            const caption = steps[i].replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
            pages.push(`<g transform="translate(0, ${i * pageH})">
  <rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#fff" stroke="#ccc"/>
  <text x="16" y="28" font-size="14" font-family="sans-serif" fill="#333">Step ${i + 1}/${steps.length}</text>
  <text x="16" y="48" font-size="11" font-family="monospace" fill="#555">${caption}</text>
  <g transform="translate(10, 60)">${body}</g>
</g>`);
        }
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${Math.max(pages.length, 1) * pageH}" viewBox="0 0 ${pageW} ${Math.max(pages.length, 1) * pageH}">
${pages.join('\n')}
</svg>
`;
        if (!filename.endsWith('.svg')) filename = `${filename}.svg`;
        if (typeof Deno !== 'undefined') {
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

// Read fold and return model
    static jsonFoldToModel(json) {
        const raw = typeof json === 'string' ? JSON.parse(json) : json;
        const is3dKey = Array.isArray(raw.frame_attributes) && raw.frame_attributes.includes('3D');
        const model = new Model();
        model.points = (raw.vertices_coords || []).map((xy) => {
            if (is3dKey && xy.length >= 3) {
                return new Point(xy[0], xy[1], xy[0], xy[1], xy[2]);
            }
            return new Point(xy[0], xy[1]);
        });
        const assignments = raw.edges_assignment || [];
        model.segments = (raw.edges_vertices || []).map((edge, i) => {
            return new Segment(model.points[edge[0]], model.points[edge[1]], assignments[i] || 'U');
        });
        model.faces = (raw.faces_vertices || []).map((face) => {
            return new Face(face.map((index) => model.points[index]));
        });
        // Optional foldedForm child frame (inherited mesh, 3D coords)
        const folded = Array.isArray(raw.file_frames)
            ? raw.file_frames.find((f) =>
                Array.isArray(f.frame_classes) && f.frame_classes.includes('foldedForm') && Array.isArray(f.vertices_coords))
            : null;
        let is3d = is3dKey;
        if (folded?.vertices_coords?.length === model.points.length) {
            folded.vertices_coords.forEach((xyz, i) => {
                const p = model.points[i];
                p.x = xyz[0];
                p.y = xyz[1];
                p.z = xyz[2] ?? 0;
            });
            is3d = true;
        }
        // Rescale crease-pattern coords to roughly [-200, 200]
        const {xMin, yMin, xMax, yMax} = model.get2DBounds();
        const width = xMax - xMin;
        const height = yMax - yMin;
        const ratio = Math.max(width, height) / 400 || 1;
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
    }

    static async downloadText(filename, text, mime = 'text/plain') {
        if (typeof Deno !== 'undefined') {
            await Deno.writeTextFile(filename, text);
            return;
        }
        const data = new Blob([text], {type: mime});
        const link = document.createElement('a');
        link.setAttribute('download', filename);
        link.setAttribute('href', globalThis.URL.createObjectURL(data));
        link.click();
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
