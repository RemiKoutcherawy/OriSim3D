# OriSim3D
Origami simulation

Test and Coverage
```bash
deno test --coverage=cov_profile test
deno coverage cov_profile
open cov_profile/html/index.html
```

Serve index.html
```bash
deno run --allow-net --allow-read jsr:@std/http/file-server
open http://localhost:8000
```


Work in progress, any help is welcome.

### Doc for developers

1. Point.js has x,y,z coordinates in 3D, xf,yf on the crease pattern
2. Segment.js is two points references: p1,p2
3. Face.js is a list of points references: p1,p2,p3...
4. Model.js has Points, Segments, Faces with methods to manipulate them
5. Commands.js interprets text to call model methods
6. Helper.js interprets mouse click and drag to send commands

### Origami text commands :
- define: width height : d 200 200
- by3d: crease between two points in 3d (splits by a plane passing by the points): by3d p1 p2
- by2d: crease between two points in 2d crease pattern (splits by a segment passing by the points): by2d p1 p2
- across3d: crease across a face in 3d (splits by a plane across the face): across3d p1 p2
- across2d: crease across a face in 2d crease pattern (splits by a line across the face): across2d p1 p2
- perpendicular2d: crease perpendicular from a point to a segment : perpendicular2d p s
- perpendicular3d: crease perpendicular from a point to a segment : perpendicular3d p s
- bisector2d: crease bisector between two segments in 2d: bisector2d s1 s2
- bisector3d: crease bisector between two segments in 3d: bisector3d s1 s2
- bisector2dPoints: crease bisector of 3 points A B C. B is in the middle: bisector2dPoints p1 p2 p3
- bisector3dPoints: crease bisector of 3 points A B C. B is in the middle: bisector3dPoints p1 p2 p3
- splitSegment2d: split a segment in 2d by numerator denominator : splitSegment2d s n d
- rotate: rotate around 'Seg' with 'Angle' all 'Points': rotate s1 angle p1 p2 p3...
- moveOnPoint: move points on point p: moveOnPoint p p1 p2 p3...
- moveOnSegment: move point on segment s: moveOnSegment p s
- move : move points dx,dy,dz: move dx dy dz p1 p2 p3...
- adjust: move points in 3D to equal 2D length of segments: adjust p1 p2 p3...
- offset: offset by d a list of faces on faces
- flat: set z to zero for all points in 3D

### Helper interprets mouse moves to make commands
- click selects point, segment, face, or marks them
- click drag from a point to a point adds a crease, or if the crease exists, adds a perpendicular crease
- click drag from a segment to a segment adds a bisector
- click drag a point rotates around a selected segment
- swipe from left to right on 2D undo
- swipe from right to left on 2D turns model

### Commands in CommandArea 
- ss selectSegments to select without mouse
- sp selectPoints to select without mouse
- labels
- textures


## Travailler avec Junie (assistant IA)

Cette section explique comment vous adresser à Junie et comment me guider pas à pas pour créer une page HTML d’animation d’origami en 3D avec Three.js dans ce dépôt.

### Comment s’adresser à Junie
- Langue: Français ou Anglais, comme vous préférez. Vous pouvez me tutoyer ou me vouvoyer.
- Soyez explicite sur:
  - Objectif exact (ex: "Créer une page qui anime le pli central d’une grue d’origami").
  - Contexte/fichiers concernés (ex: `origami.html`, `js/View3d.js`).
  - Contraintes (ex: pas de dépendance supplémentaire, garder le style existant, compatibilité mobile).
  - Livrables attendus (ex: snippet HTML/JS prêt à coller, PR minimale, doc d’usage).
  - Niveau de granularité (ex: travailler en étapes de 10-15 minutes, micro‑commits).
- Préférez des étapes courtes et vérifiables; je proposerai un plan, puis j’implémenterai le minimum pour valider chaque étape.

### Format de demande recommandé
Copiez/collez et remplissez:

1. Contexte: …
2. Objectif: …
3. État actuel: … (liens/fichiers précis)
4. Étape suivante souhaitée: … (une seule, petite)
5. Contraintes: …
6. Critères d’acceptation: … (qu’est‑ce qui prouve que c’est bon?)
7. Fichiers à modifier/créer: …

Exemple court: « Étape 1/6: crée un squelette Three.js (scène, caméra, rendu) dans `origami_step1.html`, sans contrôles, fond gris, cube de test. Acceptation: je vois un cube qui tourne. »

### Procédure pas‑à‑pas pour une page Three.js d’origami
Voici une trame typique que nous pouvons suivre ensemble. Je peux adapter/accélérer/ralentir selon vos préférences.

1) Squelette minimal
- Fichier: nouvelle page ex: `origami_step1.html` ou utiliser `origami.html` existant.
- Inclure Three.js (CDN ou version locale si déjà dans le dépôt).
- Créer scène, caméra (PerspectiveCamera), renderer, ajouter au DOM, resize handler.
- Ajouter un objet de test (cube ou plan) et une boucle d’animation requestAnimationFrame.

2) Contrôles & navigation
- Soit OrbitControls de Three.js, soit contrôles personnalisés (drag/zoom) comme déjà présents dans `origami.html` et `js/Helper.js`.
- Définir les limites de zoom et de rotation pour un confort d’usage.

3) Représentation d’un modèle d’origami (maillage)
- Commencer par un plan (Paper) et des lignes de pli (crease pattern) visibles (LineSegments, materials wireframe/doubleSide).
- Définir Points/Segments/Faces (les concepts existent déjà: voir README et fichiers `Model`, `Helper`, `Command`).

4) Animation de pliage
- Définir les arêtes de pli (montagne/valley) et l’angle cible.
- Appliquer des rotations par face autour des arêtes concernées, en respectant la topologie (à petites étapes incrémentales pour éviter les auto‑intersections).
- Option: keyframes et easing (THREE.MathUtils.lerp, interpolation).

5) Interaction utilisateur
- Survol/selection de points/segments/faces (raycaster). Réglage du curseur (pointer) et surbrillance.
- Drag pour ajuster l’angle d’un pli, molette pour zoom.
- Voir `origami.html` pour un exemple de gestion du survol, drag, zoom déjà en place.

6) Organisation des fichiers
- HTML de démonstration: `origami.html` (existe), variantes: `crane.html`, `boat.html`.
- JS utilitaires: `js/Helper.js`, `js/View3d.js`, `js/Command.js`.
- Ajoutez de nouvelles pages d’étapes (step1/step2…) pour isoler chaque progression si besoin.

7) Validation
- Critères clairs par étape (ex: angle atteint, framerate acceptable, trajectoire correcte).
- Test manuel: ouvrir localement via le file‑server Deno (voir plus haut) et vérifier l’interaction.

### Exemples de prompts utiles
- « Étape 1/5: Crée un squelette Three.js minimal dans `origami_step1.html` avec scène/caméra/rendu et un plane 1000×1000, couleur papier. Pas d’interaction. »
- « Étape 2/5: Ajoute le raycasting pour survoler des points de pli. Critère: le curseur passe en pointer au survol. Fichiers: `origami_step2.html`. »
- « Étape 3/5: Implémente une animation de pli vallée le long d’un segment donné (p1‑p2) avec un slider. »
- « Étape 4/5: Synchronise le contour (LineSegments) avec la rotation du plan pendant le drag (comme dans `origami.html`). »
- « Étape 5/5: Ajoute un bouton Réinitialiser qui remet vue et angles à zéro. »

### Astuces
- Petit périmètre par itération = feedback rapide.
- Donnez les chemins de fichiers exacts pour que je fasse des modifications minimales et sûres.
- Précisez si vous préférez du code prêt à coller ou que je modifie directement les fichiers du dépôt.

Contexte : partir de origami.html Objectif retirer le Shader ShaderMaterial Conserver les couleurs différentes pour les faces avant et arrière. Fichier à modifier : origami.html uniquement
Fichier à modifier : origami.html uniquement. objectif : ajouter la possibilité de découper les faces en deux en partant d'un point pour aller sur un autre avec la souris.
