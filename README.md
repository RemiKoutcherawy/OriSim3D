# OriSim3D
Origami simulation

Test and Coverage
```bash
deno test --allow-read --allow-write --coverage=cov_profile test
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
- by: crease between two points
- across: crease across a face
- perpendicular: crease perpendicular from a point to a segment: perpendicular p1 s1
- parallel: crease between a point and a segment (fold bringing the line onto the point): parallel2d / parallel3d s1 p1
- bisector: crease bisector between two segments: bisector s1 s2
- splitSegment: split a segment in by 'ratio': split s1 ratio 0.5
- rotate: rotate around 'Seg' with 'Angle' all 'Points': rotate s1 angle p1 p2 p3...
- move: move points: move dx dy dz p1 p2 p3...
- adjust: move points in 3D to equal 2D length of segments: adjust p1 p2 p3...
- offset: offset by d a list of faces on faces: offset d p1 p2 p3...
- order: order a list of faces front to back, nearest the viewer first, taking into
  account whether each face's normal points to the front or the back: order f1 f0 f3
- writeDiagrams / diagrams: replays the recorded instruction history and exports one
  3D-view SVG diagram per step, laid out in a grid (reuses the same renderer as `svg`)
- mountain / valley: mark crease types (FOLD M/V) on segments: valley s4

### Helper interprets mouse moves to make commands

Goal: capture an origami diagram (PDF/GIF instructions — fold, fold along the
diagonal, unfold...) with the mouse in as few, as predictable gestures as
possible. Two gesture families, kept deliberately separate:

**Creasing** — draws a new line on the pattern, doesn't fold anything:
- drag point → point, point → segment, or segment → segment scores a crease
- the plain drag runs a line directly through what you dragged (point → point:
  the line through both points; point → segment: perpendicular to the segment)
- holding Ctrl/Cmd instead makes the two dragged things coincide once folded
  (point → point: the crease that brings one point onto the other; point →
  segment: the crease that brings the segment's line onto the point)
- segment → segment always creases their bisector (only one sensible meaning)
- drag direction sets mountain/valley: dragging toward the bottom of the
  screen creases a valley, toward the top a mountain (shown live in the drag
  arrow's color, and as dashed/dash-dot lines in the 2d crease pattern)
- dragging across a face with no axis armed (see below) and no dragged point/
  segment splits whatever existing creases it crosses, to create landmark
  points to crease between

**Folding** — actually rotates paper, never guessed:
- clicking a crease arms it as the sole fold axis (never auto-detected); a
  second click on it disarms it
- once an axis is armed, dragging on a face that borders it folds that face
  (plus any other already-selected faces, for compound multi-layer folds)
  around the axis — one drag, no need to select the face first
- the axis stays armed after folding, so folding the other side along the
  same crease (very common in diagrams) is just a second plain drag
- dragging on a face with no axis armed never folds — it only scores/selects

**Selection**:
- click toggles a point/segment/face (the whole coincident stack, for a
  folded pile of overlapping layers)
- Ctrl/Cmd+click targets only the exact one under the cursor — needed to pick
  one specific layer out of a stack (petal/squash/reverse folds)
- selected faces accumulate to co-rotate on the next fold-drag; selected
  points feed `adjust` (double-click) or drag-to-move in 3d
- click drag an already-selected point in 3d moves it (`t … m dx dy dz pN`
  then `adjust` on other selected points); the drag line is orange
- undo via ⌘/Ctrl+Z

### Console de commandes (menu Édition → Console)

- Affiche/masque la zone de texte en bas de l'écran
- Entrée : exécute la ligne courante ; ⌘/Ctrl+Z : undo
- Les commandes exécutées (souris ou menu) sont recopiées dans la console

### Commands in the CommandArea 
- ss selectSegments to select without a mouse
- sp selectPoints to select without a mouse
- labels
- textures
- overlay
- edges
- lines
- undo ⌘+Z
- check
