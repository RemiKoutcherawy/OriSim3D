class TestAdjustMethods {
    // Adjust list of points 3d
    static adjustList(list) {
        let max = 100;
        for (let i = 0; max > 0.0001 && i < 200; i++) {
            max = 0;
            for (let j = 0; j < list.length; j++) {
                const point = list[j];
                const d = this.adjust(point);
                if (Math.abs(d) > max) {
                    max = Math.abs(d);
                }
            }
        }
        return max;
    }

    // Adjust one point 3d with 2d length of segments
    static adjust(point) {
        // Take all segments containing point p
        const segments = searchSegmentsOnePoint(point);
        let max = 1.0;
        // 'Kaczmarz' method or Verlet integration
        // Iterate while length difference between 2d and 3d is > 1e-3
        for (let i = 0; max > 0.01 && i < 200; i++) {
            max = 0;
            // Iterate over all segments
            // Pm is the medium point
            const pm = new Vector3(0, 0, 0);
            for (let j = 0; j < segments.length; j++) {
                const s = segments[j];
                const lg3d = Segment.length3d(s) / this.scale;
                const lg2d = Segment.length2d(s); // Should not change
                const d = lg2d - lg3d;
                if (Math.abs(d) > max) {
                    max = Math.abs(d);
                }
                // Move B = A + AB * r with r = l2d / l3d
                // AB * r is based on length 3d to match length 2d
                const r = lg2d / lg3d;
                if (s.p2 === point) {
                    // move p2
                    pm.x += s.p1.x + (s.p2.x - s.p1.x) * r;
                    pm.y += s.p1.y + (s.p2.y - s.p1.y) * r;
                    pm.z += s.p1.z + (s.p2.z - s.p1.z) * r;
                } else if (s.p1 === point) {
                    // move p1
                    pm.x += s.p2.x + (s.p1.x - s.p2.x) * r;
                    pm.y += s.p2.y + (s.p1.y - s.p2.y) * r;
                    pm.z += s.p2.z + (s.p1.z - s.p2.z) * r;
                }
            }
            // Set Point with average position taking all segments
            if (segments.length !== 0) {
                point.x = pm.x / segments.length;
                point.y = pm.y / segments.length;
                point.z = pm.z / segments.length;
            }
        }
        return max;
    }

    static kaczmarz3D(points, initialGuess, maxIterations = 100, lambda = 0.5, tolerance = 1e-6) {
        let [x, y, z] = initialGuess;
        const n = points.length;
        for (let iter = 0; iter < maxIterations; iter++) {
            let maxDelta = 0;
            for (let i = 0; i < n; i++) {
                const p = points[i];
                const dx = x - p.x;
                const dy = y - p.y;
                const dz = z - p.z;
                const Di = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (Di === 0) continue; // Éviter la division par zéro
                const residual = p.distance - Di;
                const normSquared = (dx * dx + dy * dy + dz * dz) / (Di * Di);
                if (normSquared === 0) continue;
                const step = (lambda * residual) / normSquared;
                x += step * dx / Di;
                y += step * dy / Di;
                z += step * dz / Di;
                maxDelta = Math.max(maxDelta, Math.abs(step));
            }
            if (maxDelta < tolerance) break;
        }
        return [x, y, z];
    }

    static adjustPointWeightedAverage(p, neighbors) {
        let adjustedPoint = {x: 0, y: 0, z: 0};
        let totalWeight = 0;

        neighbors.forEach(neighbor => {
            const distance = Math.sqrt(
                (neighbor.x - p.x) ** 2 +
                (neighbor.y - p.y) ** 2 +
                (neighbor.z - p.z) ** 2
            );

            const weight = 1 / (distance + 1e-6); // Avoid division by zero
            totalWeight += weight;

            adjustedPoint.x += neighbor.x * weight;
            adjustedPoint.y += neighbor.y * weight;
            adjustedPoint.z += neighbor.z * weight;
        });

        // Normalize by total weight
        adjustedPoint.x /= totalWeight;
        adjustedPoint.y /= totalWeight;
        adjustedPoint.z /= totalWeight;

        return adjustedPoint;
    }

    static adjustPointSpringSystem(p, neighbors, targetDistances) {
        let adjustedPoint = {...p};

        neighbors.forEach((neighbor, index) => {
            const dx = neighbor.x - p.x;
            const dy = neighbor.y - p.y;
            const dz = neighbor.z - p.z;

            const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
            const correctionFactor = (distance - targetDistances[index]) / distance;

            adjustedPoint.x += dx * correctionFactor;
            adjustedPoint.y += dy * correctionFactor;
            adjustedPoint.z += dz * correctionFactor;
        });

        return adjustedPoint;
    }

    static adjustPointOptimization(p, neighbors, targetDistances) {
        const adjustedPoint = {...p};

        const costFunction = (point) => {
            let cost = 0;
            neighbors.forEach((neighbor, index) => {
                const distance = Math.sqrt(
                    (neighbor.x - point.x) ** 2 +
                    (neighbor.y - point.y) ** 2 +
                    (neighbor.z - point.z) ** 2
                );
                const targetDistance = targetDistances[index];
                cost += (distance - targetDistance) ** 2;
            });
            return cost;
        };

        // Gradient descent optimization
        const learningRate = 0.1;
        for (let i = 0; i < 100; i++) {
            const grad = {x: 0, y: 0, z: 0};
            neighbors.forEach((neighbor, index) => {
                const dx = neighbor.x - adjustedPoint.x;
                const dy = neighbor.y - adjustedPoint.y;
                const dz = neighbor.z - adjustedPoint.z;

                const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
                const targetDistance = targetDistances[index];
                const error = distance - targetDistance;

                grad.x += (2 * error * dx) / distance;
                grad.y += (2 * error * dy) / distance;
                grad.z += (2 * error * dz) / distance;
            });

            adjustedPoint.x -= learningRate * grad.x;
            adjustedPoint.y -= learningRate * grad.y;
            adjustedPoint.z -= learningRate * grad.z;
        }

        return adjustedPoint;
    }

    static adjustPointProjection(p, neighbors, targetDistances) {
        let adjustedPoint = {...p};

        neighbors.forEach((neighbor, index) => {
            const dx = neighbor.x - p.x;
            const dy = neighbor.y - p.y;
            const dz = neighbor.z - p.z;
            console.log(index, neighbor);
            const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
            const targetDistance = targetDistances[index];
            const scale = targetDistance / distance;

            adjustedPoint.x += dx * (scale - 1);
            adjustedPoint.y += dy * (scale - 1);
            adjustedPoint.z += dz * (scale - 1);
        });

        return adjustedPoint;
    }
}

class Segment {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }
}

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
    }

    static distance3d(p1, p2) {
        return Math.sqrt(
            (p1.x - p2.x) ** 2 +
            (p1.y - p2.y) ** 2 +
            (p1.z - p2.z) ** 2
        );
    }

    static distance2d(p1, p2) {
        return Math.sqrt(
            (p1.x - p2.x) ** 2 +
            (p1.y - p2.y) ** 2
        );
    }
}

const neighbors = [
    new Vector3(-300, -400, 6),
    new Vector3(300, -400, 6),
    new Vector3(300, 400, 6),
    new Vector3(-300, 400, 6),
]
let p = new Vector3(100, 100, 100);
let goal = new Vector3(0, 0, 0);
console.log('neighbors:', neighbors);
console.log('p:', p);
let targetDistances = neighbors.map(neighbor => Vector3.distance2d(new Vector3(), neighbor))
console.log(targetDistances);
console.log('adjustPointSpringSystem', TestAdjustMethods.adjustPointSpringSystem(p, neighbors, targetDistances));
console.log('adjustPointOptimization', TestAdjustMethods.adjustPointOptimization(p, neighbors, targetDistances));
console.log('adjustPointProjection', TestAdjustMethods.adjustPointProjection(p, neighbors,  targetDistances));
