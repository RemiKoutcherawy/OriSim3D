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
- moveOnSegment: move points on segment s: moveOnSegment s p1 p2 p3...
- move : move points dx,dy,dz: move dx dy dz p1 p2 p3...
- adjust: move points in 3D to equal 2D length of segments: adjust p1 p2 p3...
- offset: offset by d a list of faces on faces

### Helper interprets mouse moves to make commands
- click selects point, segment, face, or marks them
- click drag from a point to a point adds a crease, or if the crease exists, adds a perpendicular crease
- click drag from a segment to a segment adds a bisector
- click drag a point rotates around a selected segment
- swipe from left to right on 2D undo
- swipe from right to left on 2D turns model
