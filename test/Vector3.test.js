// npm test
// qunit test/Vector3.test.js

import {Vector3} from "../js/Vector3.js";

const {test} = QUnit;

QUnit.module('Vector3', () => {

    test('Vector3.closestPoint', assert => {
        let a, b, c, p;

        // Degenerate into one point 0,0,0 = 'a' Closest point c is (a,a)
        a = new Vector3(0, 0, 0);
        p = Vector3.closestPoint(a, a, a);
        assert.deepEqual(p, a, "A and AB degenerate to same point");

        // Segment degenerates, point c is at y=100
        c = new Vector3(100, 0, 0);
        p = Vector3.closestPoint(c, a, a);
        assert.deepEqual(p, a, "AB degenerate, C separate point");

        // Point C is on AB
        b = new Vector3(100, 100, 0);
        c = new Vector3(50, 50, 0);
        p = Vector3.closestPoint(c, a, b);
        assert.deepEqual(p, c, "Point C is on segment AB");

        // Point C is aligned with AB
        a = new Vector3(50, 50, 50);
        b = new Vector3(100, 100, 100);
        c = new Vector3(0, 0, 0);
        p = Vector3.closestPoint(c, a, b);
        assert.deepEqual(p, c);

        // Point C is not aligned on AB
        a = new Vector3(0, 0, 0);
        b = new Vector3(100, 0, 0);
        c = new Vector3(50, 100, 0);
        p = Vector3.closestPoint(c, a, b);
        assert.deepEqual(p, new Vector3(50, 0, 0));
    });

    test('Vector3.pointLineDistance', assert => {
        let a, b, c, d;

        // Degenerate into one point 0,0,0 = 'a' Closest point c is (a,a)
        a = new Vector3(0, 0, 0);
        d = Vector3.pointLineDistance(a, a, a);
        assert.deepEqual(d, 0, "C and AB degenerate to same point");

        // Segment degenerates, point c is at y=100
        c = new Vector3(100, 0, 0);
        d = Vector3.pointLineDistance(c, a, a);
        assert.deepEqual(d, 100, "AB degenerate, C separate point");

        // Point C is on AB
        b = new Vector3(100, 100, 0);
        c = new Vector3(50, 50, 0);
        d = Vector3.pointLineDistance(c, a, b);
        assert.deepEqual(d, 0, "Point C is on segment AB");

        // Point C is aligned with AB at 50
        a = new Vector3(50, 50, 50);
        b = new Vector3(100, 100, 100);
        c = new Vector3(0, 0, 0);
        d = Vector3.pointLineDistance(c, a, b);
        assert.deepEqual(d, 0);

        // Point C is not aligned on AB
        a = new Vector3(0, 0, 0);
        b = new Vector3(100, 0, 0);
        c = new Vector3(50, 100, 0);
        d = Vector3.pointLineDistance(c, a, b);
        assert.deepEqual(d, 100);
    });

    test('Vector3.dot(v)', assert => {
        let a = new Vector3(2, 3, 4);
        let b = new Vector3(5, 6, 7);
        let dot = Vector3.dot(a, b);
        assert.deepEqual(dot, 56, "Dot (2,3,4).(5,6,7) should be 2*5+3*6+4*7=56");
    });

    test('Vector3.scale(v)', assert => {
        let a = new Vector3(2, 3, 4);
        Vector3.scale(a,2);
        assert.deepEqual(a.x, 4, "(2,3,4) Scale 2 should give (4,6,8)");
        assert.deepEqual(a.y, 6, "(2,3,4) Scale 2 should give (4,6,8)");
        assert.deepEqual(a.z, 8, "(2,3,4) Scale 2 should give (4,6,8)");
    });

    test('Vector3.length3d(v)', assert => {
        const a = new Vector3(3, 6, 6);
        const l = Vector3.length3d(a);
        assert.deepEqual(l, 9, "(3,6,6) length3d 9+36+36=81 81=9*9");
    });

    test('Vector3.normalize(v)', assert => {
        const a = new Vector3(3, 6, 6);
        const n = Vector3.normalize(a);
        assert.deepEqual(Vector3.length3d(n), 1, "(3,6,6) normalize");
    });

    test('Vector3.add(u,v)', assert => {
        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c= Vector3.add(a,b);
        assert.deepEqual(c.x, 5, "1+4 = 5");
        assert.deepEqual(c.y, 7, "2+5 = 7");
        assert.deepEqual(c.z, 9, "3+6 = 9");
    });

    test('Vector3.sub(u,v)', assert => {
        const a = new Vector3(1, 2, 3);
        const b = new Vector3(4, 5, 6);
        const c = Vector3.sub(a,b);
        assert.deepEqual(c.x, -3, "1-4 = -3");
        assert.deepEqual(c.y, -3, "2-5 = -3");
        assert.deepEqual(c.y, -3, "3-6 = -3");
    });

});
// 124
