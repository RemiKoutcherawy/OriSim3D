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
- adjust: move points in 3D to equal 2D length of segments: adjust p1 p2 p3...
- offset: offset by d a list of faces on faces: offset d p1 p2 p3...

### Helper interprets mouse moves to make commands
- click selects point, segment, face, or marks them
- click drag from a point to a point adds a crease, or if the crease exists, adds a perpendicular crease
- click drag from a segment to a segment adds a bisector
- click drag a point rotates around a selected segment
- swipe from left to right on 2D undo
- swipe from right to left on 2D turns model

### Outside reverse fold (pli renversé extérieur)

Example: menu **Pli renversé**, or `models/reverse-outside.txt`.

The fold wraps a two-layer flap *around* the packet (the two flap faces sandwich the body). An inside reverse fold uses the same creases but the opposite rotation sign, so the flap tucks *between* the layers.

**Geometry after a vertical book fold of a 400×400 square** (`d 200 200`):

| Id | Role |
| --- | --- |
| p0 p3 / p1 p2 | Open edges, stacked in 3D on the left |
| p4 p5 | Spine ends (bottom / top); s6 is the spine |
| p6 | Midpoint of the spine (`split s6 0.5`) |
| s8 p3–p6 | Reverse crease on the front layer |
| s9 p6–p2 | Reverse crease on the back layer (created together by `by3d p6 p3`) |
| f1 / f0 | Body faces (left / right) |
| f2 / f3 | Flap triangles (front / back), sharing p5 and p6 |

**Steps and suggested mouse gestures**

1. **Vertical book fold** — 2D: drag p0 onto p1 (the bottom edge already exists, so this emits `across2d` = the vertical midline). Click f0, type `o -1 f0`. Click s6 then p1 and p2, drag to 180°.
2. **45° crease through both layers** — type `split s6 0.5` (or drag across the spine only). 3D: drag p6 to p3 → `by3d p6 p3` cuts both stacked layers.
3. **Open** — select s6, p1, p2, drag about +40° (right layer toward +z).
4. **Wrap outside** — select s8 and p5, drag to **−180°**. p5 travels through −z, around the back of the packet, and lands at (−200, 0, 0). The opposite sign (+180°) is the inside reverse fold (through the gap).
5. **Close** — select s6, p1, p2, drag back to 0°.
6. **Layering** — `o 0` then `o 2 f3` / `o -1 f0` / `o -2 f2` so the flap triangles wrap around the body. `check` highlights any 2D/3D length mismatch.

### Commands in the CommandArea 
- ss selectSegments to select without a mouse
- sp selectPoints to select without a mouse
- labels
- textures
- overlay
- undo ⌘+Z
- check
