// Importation de la classe à tester
import {View3dSoft} from '../js/View3dSoft.js';
import {Model} from '../js/Model.js';

// Mock de canvas pour les tests
function createCanvasMock(width, height) {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    getContext: () => ({
      getImageData: () => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
      putImageData: () => {
      },
    }),
  };
}

// Test : Initialisation
Deno.test("View3dSoft - Initialisation", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  if (view3dSoft.model !== model) {
    throw new Error("La propriété `model` n'est pas correctement initialisée.");
  }
  if (view3dSoft.canvas !== canvasMock) {
    throw new Error("La propriété `canvas` n'est pas correctement initialisée.");
  }
  if (!Array.isArray(view3dSoft.depthBuffer) || view3dSoft.depthBuffer.length !== 800 * 600) {
    throw new Error("Le tampon de profondeur (depthBuffer) n'est pas initialisé correctement.");
  }
});

// Test : putPixel
Deno.test("View3dSoft - putPixel insère un pixel correctement", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  const testColor = { r: 255, g: 0, b: 0 };
  view3dSoft.putPixel(0, 0, testColor);

  const offset = 4 * (
      canvasMock.width / 2 + canvasMock.width * (canvasMock.height / 2 - 1)
  );
  const pixelData = view3dSoft.canvasBuffer.data;

  if (pixelData[offset] !== testColor.r || pixelData[offset + 1] !== testColor.g ||
      pixelData[offset + 2] !== testColor.b || pixelData[offset + 3] !== 255) {
    throw new Error("Le pixel inséré n'a pas la bonne couleur ou transparence.");
  }
});

// Test : putPixel hors limites
Deno.test("View3dSoft - putPixel hors limites", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  const initialData = [...view3dSoft.canvasBuffer.data];
  view3dSoft.putPixel(-1000, -1000, { r: 0, g: 255, b: 0 });

  const unchanged = view3dSoft.canvasBuffer.data.every((val, i) => val === initialData[i]);
  if (!unchanged) {
    throw new Error("Le tampon d'image a été modifié pour des coordonnées hors limites.");
  }
});

// Test : Mise à jour du tampon de profondeur
Deno.test("View3dSoft - Mise à jour du tampon de profondeur", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  const x = 10, y = 10, invZ = 0.5;
  const updated = view3dSoft.updateDepthBufferIfCloser(x, y, invZ);
  const depthIndex = x + canvasMock.width * y;

  if (!updated || view3dSoft.depthBuffer[depthIndex] !== invZ) {
    throw new Error("Le tampon de profondeur ne s'est pas mis à jour correctement.");
  }
});

// Test : Problème de profondeur (invZ éloigné)
Deno.test("View3dSoft - Problème de profondeur (invZ éloigné)", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  const x = 20, y = 20, invZ = 0.8, fartherInvZ = 0.3;
  view3dSoft.updateDepthBufferIfCloser(x, y, invZ);
  const notUpdated = view3dSoft.updateDepthBufferIfCloser(x, y, fartherInvZ);
  const depthIndex = x + canvasMock.width * y;

  if (notUpdated || view3dSoft.depthBuffer[depthIndex] !== invZ) {
    throw new Error("Le tampon de profondeur a été modifié incorrectement pour un objet plus éloigné.");
  }
});

// Test : Effacement du tampon de profondeur
Deno.test("View3dSoft - Effacer le tampon de profondeur", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  view3dSoft.clearAll();

  if (view3dSoft.depthBuffer.length !== 800 * 600 ||
      view3dSoft.depthBuffer.some(value => value !== undefined)) {
    throw new Error("Le tampon de profondeur n'a pas été correctement effacé.");
  }
});

// Test : Redimensionnement du canvas
Deno.test("View3dSoft - Redimensionnement du canvas", () => {
  const canvasMock = createCanvasMock(800, 600);
  const model = new Model();
  const view3dSoft = new View3dSoft(model, canvasMock);

  canvasMock.clientWidth = 400;
  canvasMock.clientHeight = 300;
  globalThis.dispatchEvent(new Event('resize'));

  if (view3dSoft.canvas.width !== 400 || view3dSoft.canvas.height !== 300 ||
      view3dSoft.depthBuffer.length !== 400 * 300) {
    throw new Error("Le redimensionnement du canvas et du tampon de profondeur a échoué.");
  }
});
