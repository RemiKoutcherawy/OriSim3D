# Half-Edge Data Structure in OriSim3D

This document describes the half-edge data structure implemented in OriSim3D.

## Overview

The half-edge data structure is a way to represent a mesh that makes it easy to navigate between adjacent faces, edges, and vertices. Each edge in the mesh is represented by two half-edges going in opposite directions.

## Classes

### HalfEdge

The `HalfEdge` class represents a half-edge in the mesh. Each half-edge has:
- A reference to the vertex it points to
- A reference to the face it belongs to
- A reference to the next half-edge around the face
- A reference to the twin half-edge (going in the opposite direction)
- A reference to the original segment (for backward compatibility)

### Face

The `Face` class has been updated to include a reference to one of its half-edges. This allows for easy traversal of the face's boundary.

### Model

The `Model` class has been updated to maintain a list of half-edges alongside the existing points, segments, and faces. It includes methods to:
- Create half-edges for a face
- Connect twin half-edges
- Update the half-edge structure when faces are split

## Usage

The half-edge data structure is used internally by the Model class. You can access it through the following properties and methods:

- `model.halfEdges`: An array of all half-edges in the model
- `face.halfEdge`: A reference to one of the half-edges of a face
- `halfEdge.vertex`: The vertex the half-edge points to
- `halfEdge.face`: The face the half-edge belongs to
- `halfEdge.next`: The next half-edge around the face
- `halfEdge.twin`: The twin half-edge (going in the opposite direction)
- `halfEdge.segment`: The original segment

## Example

To traverse the boundary of a face:

```javascript
let halfEdge = face.halfEdge;
do {
    const vertex = halfEdge.vertex;
    // Do something with the vertex
    halfEdge = halfEdge.next;
} while (halfEdge !== face.halfEdge);
```

To find adjacent faces:

```javascript
const adjacentFaces = [];
let halfEdge = face.halfEdge;
do {
    if (halfEdge.twin && halfEdge.twin.face !== face) {
        adjacentFaces.push(halfEdge.twin.face);
    }
    halfEdge = halfEdge.next;
} while (halfEdge !== face.halfEdge);
```
