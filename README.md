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
- bisector: crease bisector between two segments: bisector s1 s2
- splitSegment: split a segment in by 'ratio': split s1 ratio 0.5
- rotate: rotate around 'Seg' with 'Angle' all 'Points': rotate s1 angle p1 p2 p3...
- move: move points: move dx dy dz p1 p2 p3...
- move2d: move points on the crease pattern: move2d dx dy p1 p2 p3...
- adjust: move points in 3D to equal 2D length of segments: adjust p1 p2 p3...
- offset: offset by d a list of faces on faces: offset d p1 p2 p3...
- moveAll: toggle moving all selected points when dragging one
- adjustLinked: toggle also adjusting points linked by a segment
- writeDiagrams / diagrams: replays the recorded instruction history and exports one
  3D-view SVG diagram per step, laid out in a grid (reuses the same renderer as `svg`)

### Helper interprets mouse moves to make commands
- click selects point, segment, face, or marks them
- click drag from a point to a point adds a crease, or if the crease exists, adds a perpendicular crease
- click drag from a segment to a segment adds a bisector
- click drag a point rotates around a selected segment
- click drag an already-selected point moves it (`move` / `move2d` then `adjust` on that point and `check`); the drag line is orange
- in 2D the point slides only along an incident segment so faces stay convex
- Shift (or toggle `moveAll`) also moves the other selected points
- Alt (or toggle `adjustLinked`) also adjusts points linked by a segment
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
- moveAll
- adjustLinked
- undo ⌘+Z
- check
