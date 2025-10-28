export class HalfEdge {
    constructor(vertex, face) {
        this.vertex = vertex;  // The vertex this half-edge points to
        this.face = face;      // The face this half-edge belongs to
        this.next = null;      // The next half-edge around the face
        this.twin = null;      // The twin half-edge (going in opposite direction)
        this.segment = null;   // Reference to the original segment
    }
}
