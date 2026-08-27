import {Vector3} from "./Vector3.js";

export class Plane {

    // Plane is defined by an origin point R, and a normal vector N
    // point P is on the plane if and only if RP.N = 0
    constructor(origin, normal) {
        this.origin = origin;
        this.normal = Vector3.normalize(normal);
    }

    // Plane across 2 points
    static across(p1, p2) {
        const normal = new Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        const middle = new Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
        return new Plane(middle, normal);
    }

    // Plane by 2 points on xy orthogonal to z
    static by(p1, p2) {
        // Turn 90° on the right (x,y) to (y,-x)
        const normal = new Vector3((p2.y - p1.y), -(p2.x - p1.x), 0);
        return new Plane(p1, normal);
    }

    // Plane orthogonal to a segment [p1, p2] passing by point
    static orthogonal(p1, p2, point) {
        const normal = new Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        return new Plane(point, normal);
    }

    // Plane through point containing direction [p1, p2] (crease parallel to the segment).
    // Prefer a vertical plane (normal ⊥ Z), matching Plane.by when the paper is flat.
    static parallel(p1, p2, point) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        // direction × (0,0,1) = (dy, -dx, 0)
        if (Math.abs(dx) > 1e-12 || Math.abs(dy) > 1e-12) {
            return new Plane(point, new Vector3(dy, -dx, 0));
        }
        // Segment projects to a point in xy (along Z): any vertical plane through point
        return new Plane(point, new Vector3(1, 0, 0));
    }

}
// 32
