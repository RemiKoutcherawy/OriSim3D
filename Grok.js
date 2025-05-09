export class Mat4 {
    constructor() {
        return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    }
    static identity() {
        return [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];
    }
    static vec4(x = 0, y = 0, z = 0, w = 1) {
        return new Vertex4(x, y, z, w);
    }
    static multiply(a, b) {
        const result = Mat4.identity();
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i][j] =
                    a[i][0] * b[0][j] +
                    a[i][1] * b[1][j] +
                    a[i][2] * b[2][j] +
                    a[i][3] * b[3][j];
            }
        }
        return result;
    }
    static MultiplyMV(mat, vec) {
        const result = Mat4.vec4();
        for (let i = 0; i < 4; i++) {
            result[i] =
                mat[i][0] * vec[0] +
                mat[i][1] * vec[1] +
                mat[i][2] * vec[2] +
                mat[i][3] * vec[3];
        }
        return result;
    }
    static MultiplyMM4(matA, matB) {
        let result = new Mat4();
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    result[i][j] += matA[i][k] * matB[k][j];
                }
            }
        }
        return result;
    }
    static translate(tx, ty, tz) {
        return [
            [1, 0, 0, tx],
            [0, 1, 0, ty],
            [0, 0, 1, tz],
            [0, 0, 0,  1]
        ];
    }
    static rotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [
            [1, 0,  0, 0],
            [0, c, -s, 0],
            [0, s,  c, 0],
            [0, 0,  0, 1]
        ];
    }
    static rotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [
            [ c, 0, s, 0],
            [ 0, 1, 0, 0],
            [-s, 0, c, 0],
            [ 0, 0, 0, 1]
        ];
    }
    static rotateZ(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [
            [c, -s, 0, 0],
            [s,  c, 0, 0],
            [0,  0, 1, 0],
            [0,  0, 0, 1]
        ];
    }
    static scale(sx, sy, sz) {
        return [
            [sx, 0,  0,  0],
            [0,  sy, 0,  0],
            [0,  0,  sz, 0],
            [0,  0,  0,  1]
        ];
    }
    static perspective(fov, aspect, near, far) {
        const f = 1 / Math.tan(fov / 2);
        const nf = 1 / (near - far);
        return [
            [f / aspect, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (far + near) * nf, 2 * far * near * nf],
            [0, 0, -1, 0]
        ];
    }
}
class Vertex4 {
    constructor(x, y, z, w = 1) {this.x = x;this.y = y;this.z = z;this.w = w;}
    add(v) {return new Vertex4(this.x + v.x, this.y + v.y, this.z + v.z);}
    sub(v) {return new Vertex4(this.x - v.x, this.y - v.y, this.z - v.z, this.w - v.w);}
    mul(n) {return new Vertex4(this.x * n, this.y * n, this.z * n, this.w);}
    dot(vec) {return this.x * vec.x + this.y * vec.y + this.z * vec.z;}
    cross(v2) {return new Vertex4(this.y * v2.z - this.z * v2.y, this.z * v2.x - this.x * v2.z, this.x * v2.y - this.y * v2.x);}
    length() {return Math.sqrt(this.dot(this));}
}
const point = Mat4.vec4(1, 0, 0, 1);
const translation = Mat4.translate(2, 3, 4);
const rotation = Mat4.rotateZ(Math.PI / 4); // 45 degrés
const combined = Mat4.multiply(translation, rotation);
const transformedPoint = Mat4.MultiplyMV(combined, point);
console.log(transformedPoint); // [x', y', z', w]
