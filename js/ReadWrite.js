// Input and Output
import {Point} from "./Point.js";
import {Segment} from "./Segment.js";
import {Model} from "./Model.js";
import {Face} from "./Face.js";

export class ReadWrite {

    static chooseFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = e => {
                resolve(e.target.files[0])
            };
            input.onabort = () => {
                reject("abort")
            };
            input.oncancel = () => {
                reject("cancel")
            };
            input.click();
        });
    }

    // Read with FileReader return text or null
    static async readFileAsText(file) {
        if (typeof Deno !== "undefined") {
            return await Deno.readTextFile(file);
        }
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onabort = () => reject(new Error("abort"));
            reader.onerror = (event) => reject((event.target).error);
            return reader.readAsText(file);
        });
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
                if (points.indexOf(p) === -1) {
                    p = model.addPoint(p.xf, p.yf, p.x, p.y, p.z);
                }
                indexes.push(points.indexOf(p));
            });
            faces_vertices.push(indexes);
        });
        let faces_edges = [];
        faces.forEach((f) => {
            let indexes = [];
            f.points.forEach((p) => {
                segments.forEach((s, i) => {
                    s.p1 === p ? indexes.push(i) : null;
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
        reg = /\[(:?[\n\s]*(-?\d+),?)+[\n\s]*]/mg;
        // More cosmetics
        json = json.replaceAll(reg, (match) => {
            return match.replaceAll(/[\n\s]*/g, '');
        });

        return json;
    }

// Read fold and return model
    static jsonFoldToModel(json) {
        let fold = JSON.parse(json, reviverFold);
        // Convert to Model
        let model = new Model();
        model.points = JSON.parse(JSON.stringify(fold.vertices_coords)); // Deep copy
        // model.points = (fold.vertices_coords).splice(0); // Deep copy another way
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

    // Read with fs or fetch return text or null
    static async readFileAsTextPolyfill(filename) {
        let text = null;
        if (typeof process === 'object') {
            await import('fs')
                .then(fs => {
                    text = fs.readFileSync('./'+filename, 'utf-8');
                })
                .catch(e => console.log("Error reading with readFileSync:" + filename + ' ' + e));
        } else if (typeof fetch !== 'undefined') {
            await fetch('../' + filename)
                .then((r) => r.text())
                .then(r => text = r)
                .catch(e => console.log("Error reading with fetch:" + filename + ' ' + e));
        } else if (typeof XMLHttpRequest !== 'undefined') {
            const request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState === XMLHttpRequest.DONE && request.status === 200) {
                    const type = request.getResponseHeader("Content-Type");
                    if (type.match(/^text/)) { // Make sure response is text
                        text = request.responseText;
                    }
                } else if (request.readyState !== XMLHttpRequest.OPENED) {
                    console.log("Error ? state:" + request.readyState + " status:" + request.status);
                }
            };
            // XMLHttpRequest.open(method, url, async)
            // Here async = false ! => Warning from Firefox, Chrome,
            request.open('GET', filename, false);
            request.send(null);
        }
        if (text === null) {
            console.log("Error reading in ReadWrite.js: " + filename);
        }
        return text;
    }

    static async writeFile(filename, text) {
        // Download
        const data = new Blob([text], {type: "text/plain"});
        const link = document.createElement("a");
        link.setAttribute("download", filename);
        link.setAttribute("href", window.URL.createObjectURL(data));
        link.click();
    }

}

// 135
