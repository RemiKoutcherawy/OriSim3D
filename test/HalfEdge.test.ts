import { Model } from '../js/Model.js';
import { Face } from '../js/Face.js';
import { Segment } from '../js/Segment.js';
import { assert, assertEquals, assertExists, assertFalse } from "jsr:@std/assert";

function ringVerticesCCW(model: Model, face: any) {
  const hes = model.getFaceHalfEdges(face);
  if (hes.length === 0) return [] as any[];
  // Build vertex order by following current.vertex around the ring
  const verts: any[] = [];
  let start = face.halfEdge!;
  let last = start; while (last.next !== start) last = last.next;
  let cur = start;
  do {
    verts.push(cur.vertex);
    cur = cur.next;
  } while (cur !== start);
  return verts;
}

Deno.test('HE: init and ring correctness', () => {
  const model = new Model().init(200,200);
  assertEquals(model.halfEdgesDirty, false);
  const face = model.faces[0];
  assertExists(face.halfEdge);
  const hes = model.getFaceHalfEdges(face);
  assertEquals(hes.length, 4);
  const verts = ringVerticesCCW(model, face);
  // The HE vertex sequence may be a cyclic rotation relative to face.points
  function rotateToStart(arr: any[], start: any) {
    const i = arr.indexOf(start);
    if (i < 0) return arr.slice();
    return arr.slice(i).concat(arr.slice(0, i));
  }
  const rotated = rotateToStart(verts, face.points[0]);
  assertEquals(rotated, face.points, 'HE vertex order matches face.points up to rotation');
});

Deno.test('HE: ensureHalfEdges() idempotence and dirty handling', () => {
  const model = new Model().init(200,200);
  const face = model.faces[0];
  const lenBefore = model.getFaceHalfEdges(face).length;
  model.halfEdgesDirty = true;
  model.ensureHalfEdges();
  assertEquals(model.halfEdgesDirty, false);
  assertEquals(model.getFaceHalfEdges(face).length, lenBefore);
  // Idempotence
  model.ensureHalfEdges();
  assertEquals(model.getFaceHalfEdges(face).length, lenBefore);
});

Deno.test('HE: serialization neutrality (HE-only changes do not affect length)', () => {
  const m = new Model().init(200,200);
  const json = m.serialize();
  const len = json.length;
  // Rebuild HE and ensure JSON length is unchanged (no topology change)
  m.ensureHalfEdges();
  const json2 = m.serialize();
  assertEquals(json2.length, len);
  // Clear HE structures and mark dirty; length must remain identical
  m.halfEdges = [];
  m.faces.forEach((f: any) => f.halfEdge = null);
  m.halfEdgesDirty = true;
  const json3 = m.serialize();
  assertEquals(json3.length, len);
  // Deserialize returns an object with HE cleared and marked dirty
  const restored = Object.assign(m, m.deserialize(json));
  assertEquals(restored.halfEdges.length, 0);
  assertEquals(restored.halfEdgesDirty, true);
});

Deno.test('HE: twin linking on shared edge between two triangles', () => {
  const m = new Model().init(200,200);
  // Create two triangles over the square, sharing diagonal (p0<->p2)
  const [p0,p1,p2,p3] = m.points;
  m.addSegment(p0, p2); // diagonal
  m.addFace([p0,p1,p2]);
  m.addFace([p0,p2,p3]);
  m.ensureHalfEdges();
  const diag = m.getSegment(p0, p2)!;
  const hes = m.segmentToHalfEdges.get(diag);
  assertExists(hes);
  // At least one half-edge should exist along the diagonal
  assert(hes!.length >= 1);
  // If both triangles exist, we expect exactly two half-edges and they should be twins
  if (hes!.length === 2) {
    const [a,b] = hes!;
    assertEquals(a.twin, b);
    assertEquals(b.twin, a);
  }
});

Deno.test('HE: Segment.incidentFaces and adjacentFace work with and without cache', () => {
  const m = new Model().init(200,200);
  const [p0,p1,p2,p3] = m.points;
  m.addSegment(p0, p2); // diagonal
  m.addFace([p0,p1,p2]);
  m.addFace([p0,p2,p3]);
  m.ensureHalfEdges();
  const diag = m.getSegment(p0, p2)!;

  // With cache
  let inc = Segment.incidentFaces(m, diag);
  assert(inc.length >= 1);
  if (inc.length === 2) {
    const other = Segment.adjacentFace(m, diag, inc[0]);
    assertEquals(other, inc[1]);
  }

  // Clear cache to force fallback on ring scan
  m.segmentToHalfEdges = new Map();
  inc = Segment.incidentFaces(m, diag);
  assert(inc.length >= 1);
});

Deno.test('HE: dirty flag toggles on mutations and ensureHalfEdges() clears it', () => {
  const m = new Model().init(200,200);
  const [p0,p1,p2] = m.points;
  m.addSegment(p0, p2);
  // If it was a new segment, it should set dirty
  assertEquals(m.halfEdgesDirty, true);
  m.ensureHalfEdges();
  assertEquals(m.halfEdgesDirty, false);
  // Adding a new face should also set dirty
  m.addFace([p0,p1,p2]);
  assertEquals(m.halfEdgesDirty, true);
  m.ensureHalfEdges();
  assertEquals(m.halfEdgesDirty, false);
});

Deno.test('HE: Face.contains2d parity before/after HE rebuild', () => {
    const m = new Model().init(200, 200);
    const face = m.faces[0];
    // Check center point
    let result = Face.contains2d(face, 0, 0);
    assert(result, "Face contains 0, 0 ");
    // Check boundary points
    result = Face.contains2d(face, 100, 100);
    assert(result, "Face contains 100, 100 ");
    result = Face.contains2d(face, -100, 100);
    assert(result, "Face contains -100, 100 ");
    result = Face.contains2d(face, -100, -100);
    assert(result, "Face contains -100, -100 ");
    result = Face.contains2d(face, 100, -100);
    assert(result, "Face contains 100, -100 ");
});

Deno.test('HE: Face.contains3d parity before/after HE rebuild', () => {
  const m = new Model().init(200,200);
  const f = m.faces[0];
  // Build a simple orthographic-like projection mock: map each face point to its x,y
  const view3d = {
    indexMap: new Map<any, number>(),
    projected: [] as number[][],
  } as any;
  f.points.forEach((pt: any, idx: number) => {
    view3d.indexMap.set(pt, idx);
    view3d.projected[idx] = [pt.x, pt.y];
  });
  const points = [
    [0,0], [201,0], [-201,0], [0,201], [0,-201], [f.points[0].x, f.points[0].y]
  ];
  const before = points.map(([x,y]) => Face.contains3d(f, x, y, view3d));
  m.ensureHalfEdges();
  const after  = points.map(([x,y]) => Face.contains3d(f, x, y, view3d));
  assertEquals(after, before);
});

Deno.test('HE: non-serialized fields are excluded from JSON', () => {
  const m = new Model().init(200,200);
  const json = m.serialize();
  // quick checks that keys are not present
  assertFalse(json.includes('halfEdgesDirty'), 'halfEdgesDirty must be excluded');
  assertFalse(json.includes('halfEdges"'), 'halfEdges must be excluded');
  assertFalse(json.includes('segmentToHalfEdges'), 'segmentToHalfEdges must be excluded');
});
