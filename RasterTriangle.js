// Définition d'un vecteur 3D
class Vec3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static normalize(v) {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        return new Vec3(v.x / len, v.y / len, v.z / len);
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static add(a, b) {
        return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    static subtract(a, b) {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static multiply(v, s) {
        return new Vec3(v.x * s, v.y * s, v.z * s);
    }

    static reflect(incident, normal) {
        const dot = Vec3.dot(incident, normal);
        return Vec3.subtract(incident, Vec3.multiply(normal, 2 * dot));
    }
}

// Définition d'un vertex avec position et normale
class Vertex {
    constructor(position, normal, color) {
        this.position = position;
        this.normal = normal;
        this.color = color;
    }
}

// Paramètres par défaut
let ambientIntensity = 1.0;
let diffuseIntensity = 1.0;
let specularIntensity = 1.0;
let shininess = 32;
let rotateY = 0;
let autoRotate = true;

// Récupération du canvas
const canvas = document.getElementById('phongCanvas');
const ctx = canvas.getContext('2d');

// Définition des sommets du triangle
function getTriangleVertices(rotationY) {
    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);

    return [
        new Vertex(
            new Vec3(0 * cosY + 0 * sinY, 0.8, 0 * -sinY + 0 * cosY),
            Vec3.normalize(new Vec3(0 * cosY + 1 * sinY, 0, 0 * -sinY + 1 * cosY)),
            new Vec3(1, 0, 0) // Rouge
        ),
        new Vertex(
            new Vec3(-0.8 * cosY + 0 * sinY, -0.8, -0.8 * -sinY + 0 * cosY),
            Vec3.normalize(new Vec3(-0.5 * cosY + 1 * sinY, 0, -0.5 * -sinY + 1 * cosY)),
            new Vec3(0, 1, 0) // Vert
        ),
        new Vertex(
            new Vec3(0.8 * cosY + 0 * sinY, -0.8, 0.8 * -sinY + 0 * cosY),
            Vec3.normalize(new Vec3(0.5 * cosY + 1 * sinY, 0, 0.5 * -sinY + 1 * cosY)),
            new Vec3(0, 0, 1) // Bleu
        ),
    ];
}

// Fonction pour calculer la couleur avec le shading de Phong
function calculatePhongColor(vertex, lightPosition, viewPosition) {
    // Normaliser les vecteurs nécessaires
    const normal = Vec3.normalize(vertex.normal);
    const lightDir = Vec3.normalize(Vec3.subtract(lightPosition, vertex.position));
    const viewDir = Vec3.normalize(Vec3.subtract(viewPosition, vertex.position));
    const reflectDir = Vec3.reflect(Vec3.multiply(lightDir, -1), normal);

    // Composante ambiante
    const ambient = Vec3.multiply(vertex.color, ambientIntensity);

    // Composante diffuse
    const diff = Math.max(Vec3.dot(normal, lightDir), 0);
    const diffuse = Vec3.multiply(vertex.color, diff * diffuseIntensity);

    // Composante spéculaire
    const spec = Math.pow(Math.max(Vec3.dot(viewDir, reflectDir), 0), shininess);
    const specular = Vec3.multiply(new Vec3(1, 1, 1), spec * specularIntensity);

    // Ajouter les trois composantes (ambiant, diffus, spéculaire)
    const finalColor = Vec3.add(Vec3.add(ambient, diffuse), specular);

    // Limiter les valeurs à [0, 1] pour éviter des dépassements
    return new Vec3(
        Math.min(finalColor.x, 1),
        Math.min(finalColor.y, 1),
        Math.min(finalColor.z, 1)
    );
}
// Fonction pour mettre un pixel sur le canvas
function putPixel(x, y, color, imageData) {
    const index = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
    imageData.data[index] = Math.floor(color.x * 255);     // Rouge
    imageData.data[index + 1] = Math.floor(color.y * 255); // Vert
    imageData.data[index + 2] = Math.floor(color.z * 255); // Bleu
    imageData.data[index + 3] = 255;                      // Alpha (opaque)
}

// Fonction de rasterisation pour dessiner un triangle
function drawTriangle(vertices, colors, lightPosition, viewPosition) {
    // Obtenir les limites du triangle
    const minX = Math.max(0, Math.floor(Math.min(...vertices.map((v) => v.x))));
    const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(...vertices.map((v) => v.x))));
    const minY = Math.max(0, Math.floor(Math.min(...vertices.map((v) => v.y))));
    const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...vertices.map((v) => v.y))));

    // Récupérer l'ImageData pour modifier directement les pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Parcourir chaque pixel dans les limites du triangle
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            // Déterminer si le pixel (x, y) est à l'intérieur du triangle
            const w0 = edgeFunction(vertices[1], vertices[2], { x, y });
            const w1 = edgeFunction(vertices[2], vertices[0], { x, y });
            const w2 = edgeFunction(vertices[0], vertices[1], { x, y });
            const area = edgeFunction(vertices[0], vertices[1], vertices[2]);

            if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
                // Normaliser les coordonnées barycentriques
                const b0 = w0 / area;
                const b1 = w1 / area;
                const b2 = w2 / area;

                // Interpoler les normales et positions
                const interpNormal = Vec3.add(
                    Vec3.add(Vec3.multiply(colors[0], b0), Vec3.multiply(colors[1], b1)),
                    Vec3.multiply(colors[2], b2)
                );

                const interpPosition = Vec3.add(
                    Vec3.add(Vec3.multiply(vertices[0].vertex.position, b0), Vec3.multiply(vertices[1].vertex.position, b1)),
                    Vec3.multiply(vertices[2].vertex.position, b2)
                );

                // Calculer la couleur du pixel avec le shading de Phong
                const color = calculatePhongColor(
                    { position: interpPosition, normal: interpNormal, color: interpNormal },
                    lightPosition,
                    viewPosition
                );

                // Dessiner le pixel
                putPixel(x, y, color, imageData);
            }
        }
    }

    // Appliquer les modifications à l'écran
    ctx.putImageData(imageData, 0, 0);
}

// Fonction pour calculer la "fonction de bord" d'un triangle
function edgeFunction(v0, v1, p) {
    return (p.x - v0.x) * (v1.y - v0.y) - (p.y - v0.y) * (v1.x - v0.x);
}

// Nouvelle version de renderTriangle utilisant drawTriangle
function renderTriangle() {
    if (!canvas || !ctx) return;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Obtenir les sommets du triangle avec la rotation actuelle
    const vertices = getTriangleVertices(rotateY);

    // Définir la position de la lumière (fixe dans l'espace caméra)
    const lightPosition = new Vec3(2, 2, -3);
    const viewPosition = new Vec3(0, 0, -3);

    // Convertir les coordonnées 3D en coordonnées d'écran 2D
    const screenVertices = vertices.map((vertex) => {
        const z = vertex.position.z + 3; // +3 pour déplacer le triangle devant la caméra
        const scale = 1 / Math.max(0.1, z);
        const x = (vertex.position.x * scale * canvas.width) / 2 + canvas.width / 2;
        const y = (-vertex.position.y * scale * canvas.height) / 2 + canvas.height / 2;
        return { x, y, vertex };
    });

    // Obtenir les couleurs interpolées avec le shading de Phong
    const colors = vertices.map((vertex) =>
        calculatePhongColor(vertex, lightPosition, viewPosition)
    );

    // Dessiner le triangle
    drawTriangle(screenVertices, colors, lightPosition, viewPosition);
}
// function renderTriangle() {
//     if (!canvas || !ctx) return;
//
//     // Effacer le canvas
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//
//     // Obtenir les sommets du triangle avec la rotation actuelle
//     const vertices = getTriangleVertices(rotateY);
//
//     // Définir la position de la lumière (fixe dans l'espace caméra)
//     const lightPosition = new Vec3(2, 2, -3);
//     const viewPosition = new Vec3(0, 0, -3);
//
//     // Convertir les coordonnées 3D en coordonnées d'écran 2D
//     const screenVertices = vertices.map((vertex) => {
//         const z = vertex.position.z + 3; // +3 pour déplacer le triangle devant la caméra
//         const scale = 1 / Math.max(0.1, z);
//         const x = (vertex.position.x * scale * canvas.width) / 2 + canvas.width / 2;
//         const y = (-vertex.position.y * scale * canvas.height) / 2 + canvas.height / 2;
//         return { x, y, vertex };
//     });
//
//     // Obtenir les couleurs interpolées avec le shading de Phong
//     const colors = vertices.map((vertex) =>
//         calculatePhongColor(vertex, lightPosition, viewPosition)
//     );
//
//     // Dessiner les faces du triangle écran avec un remplissage coloré
//     ctx.beginPath();
//     ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
//     ctx.lineTo(screenVertices[1].x, screenVertices[1].y);
//     ctx.lineTo(screenVertices[2].x, screenVertices[2].y);
//     ctx.closePath();
//
//     // Couleurs moyennes pour toute la face du triangle (simple approximation)
//     const avgColor = colors.reduce(
//         (acc, color) => Vec3.add(acc, color),
//         new Vec3(0, 0, 0)
//     );
//     const finalColor = Vec3.multiply(avgColor, 1 / vertices.length);
//
//     // Appliquer la couleur calculée
//     ctx.fillStyle = `rgb(
//         ${Math.floor(finalColor.x * 255)},
//         ${Math.floor(finalColor.y * 255)},
//         ${Math.floor(finalColor.z * 255)}
//     )`;
//     ctx.fill();
// }
// Fonction pour démarrer la rotation automatique
export function animate() {
    if (autoRotate) {
        rotateY += 0.02; // Vitesse de rotation
    }
    renderTriangle();
    requestAnimationFrame(animate);
}

// Initialisation et démarrage
canvas.width = 500;
canvas.height = 500;
console.log(canvas.width, canvas.height);
// Gestion des événements pour modifier les intensités
document.getElementById('ambientSlider').oninput = (e) => {
    ambientIntensity = parseFloat(e.target.value);
};
document.getElementById('diffuseSlider').oninput = (e) => {
    diffuseIntensity = parseFloat(e.target.value);
};
document.getElementById('specularSlider').oninput = (e) => {
    specularIntensity = parseFloat(e.target.value);
};
document.getElementById('shininessSlider').oninput = (e) => {
    shininess = parseInt(e.target.value, 10);
};
