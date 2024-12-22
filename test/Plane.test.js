import {Vector3} from "../js/Vector3.js";
import {Plane} from "../js/Plane.js";

const {test} = QUnit;

QUnit.module('Plane', () => {

    test('plane across', assert => {
        const p1 = new Vector3(10, 50, 0);
        const p2 = new Vector3(30, 50, 0);
        const plane = Plane.across(p1, p2);
        assert.strictEqual(plane.normal.x, 1, "Normal x");
        assert.strictEqual(plane.normal.y, 0, "Normal y");
        assert.strictEqual(plane.normal.z, 0, "Normal z");
        assert.strictEqual(Vector3.dot(plane.origin, plane.normal), 20, "Distance 20 ");
    });

    test('plane by', assert => {
        const p1 = new Vector3(30, 50, 0);
        const p2 = new Vector3(10, 50, 0);
        const plane = Plane.by(p1, p2);
        assert.strictEqual(plane.normal.x, 0, "Normal x");
        assert.strictEqual(plane.normal.y, 1, "Normal y");
        assert.strictEqual(plane.normal.z, 0, "Normal z");
        assert.strictEqual(Vector3.dot(plane.origin, plane.normal), 50, "Distance 50 ");
    });

    test('plane orthogonal', assert => {
        const p1 = new Vector3(10, 50, 0);
        const p2 = new Vector3(30, 50, 0);
        const pt = new Vector3(20, 0, 0);

        const plane = Plane.orthogonal(p1, p2, pt);
        assert.strictEqual(plane.normal.x, 1, "Normal x");
        assert.strictEqual(plane.normal.y, 0, "Normal y");
        assert.strictEqual(plane.normal.z, 0, "Normal z");
        assert.strictEqual(Vector3.dot(plane.origin, plane.normal), 20, "Distance 20 ");
    });

});
