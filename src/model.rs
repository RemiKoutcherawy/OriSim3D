use crate::point::Point;
use crate::segment::Segment;
use crate::face::Face;
use crate::plane::Plane;
use crate::vec3::Vec3;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum State {
    Run = 0,
    Anim = 1,
    Undo = 2,
    Pause = 3,
}

pub struct Model {
    pub points: Vec<Point>,
    pub segments: Vec<Segment>,
    pub faces: Vec<Face>,

    pub state: State,
    pub scale: f32,

    pub labels: bool,
    pub textures: bool,
    pub overlay: bool,
    pub lines: bool,
}

impl Default for Model {
    fn default() -> Self {
        Self::new()
    }
}

impl Model {
    pub fn new() -> Self {
        Model {
            points: Vec::new(),
            segments: Vec::new(),
            faces: Vec::new(),
            state: State::Run,
            scale: 1.0,
            labels: false,
            textures: false,
            overlay: false,
            lines: false,
        }
    }

    pub fn init(&mut self, width: f32, height: f32) {
        self.points.clear();
        self.segments.clear();
        self.faces.clear();

        // 4 points
        let p0 = Point::new(-width, -height, -width, -height, 0.0);
        let p1 = Point::new(width, -height, width, -height, 0.0);
        let p2 = Point::new(width, height, width, height, 0.0);
        let p3 = Point::new(-width, height, -width, height, 0.0);
        self.points.push(p0);
        self.points.push(p1);
        self.points.push(p2);
        self.points.push(p3);

        // 4 segments
        let s0 = Segment::new(self.points[0], self.points[1]);
        let s1 = Segment::new(self.points[1], self.points[2]);
        let s2 = Segment::new(self.points[2], self.points[3]);
        let s3 = Segment::new(self.points[3], self.points[0]);
        self.segments.push(s0);
        self.segments.push(s1);
        self.segments.push(s2);
        self.segments.push(s3);

        // 1 face
        let mut f = Face::new(vec![0, 1, 2, 3]);
        f.offset = 0.0;
        self.faces.push(f);
    }

    pub fn add_point(&mut self, xf: f32, yf: f32, x: f32, y: f32, z: f32) -> usize {
        for (i, p) in self.points.iter().enumerate() {
            if p.xf == xf && p.yf == yf && p.x == x && p.y == y && p.z == z {
                return i;
            }
        }
        let idx = self.points.len();
        self.points.push(Point::new(xf, yf, x, y, z));
        idx
    }

    pub fn add_segment(&mut self, p1_idx: usize, p2_idx: usize) -> usize {
        if let Some(idx) = self.get_segment(p1_idx, p2_idx) {
            return idx;
        }
        let idx = self.segments.len();
        self.segments.push(Segment::new(self.points[p1_idx], self.points[p2_idx]));
        idx
    }

    pub fn add_face(&mut self, point_indices: Vec<usize>) -> usize {
        for i in 0..point_indices.len() {
            let p1 = point_indices[i];
            let p2 = point_indices[(i + 1) % point_indices.len()];
            self.add_segment(p1, p2);
        }
        let idx = self.faces.len();
        self.faces.push(Face::new(point_indices));
        idx
    }

    pub fn get_segment(&self, p1_idx: usize, p2_idx: usize) -> Option<usize> {
        self.segments.iter().enumerate().find_map(|(i, s)| {
            if (s.p1.xf == self.points[p1_idx].xf && s.p1.yf == self.points[p1_idx].yf &&
                s.p2.xf == self.points[p2_idx].xf && s.p2.yf == self.points[p2_idx].yf) ||
               (s.p1.xf == self.points[p2_idx].xf && s.p1.yf == self.points[p2_idx].yf &&
                s.p2.xf == self.points[p1_idx].xf && s.p2.yf == self.points[p1_idx].yf) {
                Some(i)
            } else {
                None
            }
        })
    }

    pub fn rotate(&mut self, axis: &Vec3, angle: f32) {
        for p in &mut self.points {
            let mut v = Vec3::new(p.x, p.y, p.z);
            v = v.rotate(axis, angle);
            p.x = v.x;
            p.y = v.y;
            p.z = v.z;
        }
    }

    pub fn translate(&mut self, translation: &Vec3) {
        for p in &mut self.points {
            p.x += translation.x;
            p.y += translation.y;
            p.z += translation.z;
        }
    }

    pub fn scale_model(&mut self, factor: f32) {
        for p in &mut self.points {
            p.x *= factor;
            p.y *= factor;
            p.z *= factor;
        }
    }

    pub fn search2d(&self, xf: f32, yf: f32) -> (Vec<usize>, Vec<usize>, Vec<usize>) {
        let mut points = Vec::new();
        for (i, p) in self.points.iter().enumerate() {
            if (p.xf - xf).hypot(p.yf - yf) < 10.0 {
                points.push(i);
            }
        }
        
        let mut segments = Vec::new();
        for (i, s) in self.segments.iter().enumerate() {
            if crate::segment::Segment::distance2d(s.p1.xf, s.p1.yf, s.p2.xf, s.p2.yf, xf, yf) < 4.0 {
                segments.push(i);
            }
        }
        
        let mut faces = Vec::new();
        for (i, f) in self.faces.iter().enumerate() {
            if f.contains2d(xf, yf, &self.points) {
                faces.push(i);
            }
        }
        
        (points, segments, faces)
    }

    pub fn hover_2d_3d(&mut self, points: &[usize], segments: &[usize], faces: &[usize]) {
        for p in &mut self.points { p.hover = false; }
        for s in &mut self.segments { s.hover = false; }
        for f in &mut self.faces { f.hover = false; }
        for &idx in points { if idx < self.points.len() { self.points[idx].hover = true; } }
        for &idx in segments { if idx < self.segments.len() { self.segments[idx].hover = true; } }
        for &idx in faces { if idx < self.faces.len() { self.faces[idx].hover = true; } }
    }

    pub fn click_2d_3d(&mut self, points: &[usize], segments: &[usize], faces: &[usize]) {
        for &idx in points { if idx < self.points.len() { self.points[idx].select = (self.points[idx].select % 2) + 1; } }
        for &idx in segments { if idx < self.segments.len() { self.segments[idx].select = (self.segments[idx].select % 2) + 1; } }
        for &idx in faces { if idx < self.faces.len() { self.faces[idx].select = (self.faces[idx].select % 2) + 1; } }
    }

    pub fn move_points(&mut self, dx: f32, dy: f32, dz: f32, indices: &[usize]) {
        for &idx in indices {
            if idx < self.points.len() {
                self.points[idx].x += dx;
                self.points[idx].y += dy;
                self.points[idx].z += dz;
            }
        }
    }

    pub fn offset(&mut self, value: i32, face_indices: &[usize]) {
        if face_indices.is_empty() {
            for f in &mut self.faces { f.offset = 0.0; }
        } else {
            for &idx in face_indices {
                if idx < self.faces.len() {
                    self.faces[idx].offset = value as f32 / 10000.0;
                }
            }
        }
    }

    pub fn split_face_by_plane_3d(&mut self, face_idx: usize, plane: &Plane) {
        let mut left_indices = Vec::new();
        let mut right_indices = Vec::new();
        let mut last_inter_idx: Option<usize> = None;

        const EPSILON: f32 = 10.0;
        
        let face_points = self.faces[face_idx].points.clone();
        let mut last_idx = face_points[face_points.len() - 1];
        let mut d_last = plane.plane_to_point_signed_distance(&self.points[last_idx]);

        for &current_idx in &face_points {
            let d_current = plane.plane_to_point_signed_distance(&self.points[current_idx]);

            // last and current on the same side // 1, 2
            if d_last * d_current > EPSILON {
                if d_current < 0.0 { left_indices.push(current_idx); } else { right_indices.push(current_idx); }
            }
            // current on plane // 3 4 5
            else if d_current.abs() <= EPSILON {
                left_indices.push(current_idx);
                right_indices.push(current_idx);
                last_inter_idx = Some(current_idx);
            }
            // last on plane, current on left or right // 6 7
            else if d_last.abs() <= EPSILON {
                if d_current < 0.0 { left_indices.push(current_idx); } else { right_indices.push(current_idx); }
            }
            // last and current on different side, crossing // 8 9
            else {
                let inter_point = Face::intersection_plane_segment(plane, &Vec3::from_point(&self.points[last_idx]), &Vec3::from_point(&self.points[current_idx]));
                if let Some(mut inter) = inter_point {
                    Point::align2d_from3d(&self.points[last_idx], &self.points[current_idx], &mut inter);
                    let inter_idx = self.add_point(inter.xf, inter.yf, inter.x, inter.y, inter.z);
                    
                    left_indices.push(inter_idx);
                    right_indices.push(inter_idx);
                    if d_current < 0.0 { left_indices.push(current_idx); } else { right_indices.push(current_idx); }
                    
                    last_inter_idx = self.add_intersection_3d(inter_idx, last_idx, current_idx, last_inter_idx);
                } else {
                     if d_current < 0.0 { left_indices.push(current_idx); } else { right_indices.push(current_idx); }
                }
            }
            last_idx = current_idx;
            d_last = d_current;
        }

        let area_left = Face::area3d(&left_indices.iter().map(|&i| self.points[i]).collect::<Vec<_>>());
        let area_right = Face::area3d(&right_indices.iter().map(|&i| self.points[i]).collect::<Vec<_>>());

        if area_left > 1.0 && area_right > 1.0 {
            let offset = self.faces[face_idx].offset;
            self.faces[face_idx].points = left_indices;
            let new_face_idx = self.add_face(right_indices);
            self.faces[new_face_idx].offset = offset;
        }
    }

    pub fn split_face_by_segment_2d(&mut self, face_idx: usize, a: &Point, b: &Point) {
        let mut left_indices = Vec::new();
        let mut right_indices = Vec::new();

        const EPSILON: f32 = 1.0;
        let face_points = self.faces[face_idx].points.clone();
        let mut last_idx = face_points[face_points.len() - 1];
        let mut d_last = Face::distance2d_line_to_point(a, b, &self.points[last_idx]);

        if d_last.abs() < EPSILON && Segment::intersection_flat(a, b, &self.points[last_idx], &self.points[face_points[0]]).is_none() {
            return;
        }

        for &current_idx in &face_points {
            let d_current = Face::distance2d_line_to_point(a, b, &self.points[current_idx]);
            if d_last < -EPSILON { // Last on the left
                if d_current < -EPSILON {
                    left_indices.push(current_idx);
                } else if d_current.abs() <= EPSILON {
                    if Segment::intersection_flat(a, b, &self.points[last_idx], &self.points[current_idx]).is_none() { return; }
                    left_indices.push(current_idx);
                    right_indices.push(current_idx);
                } else if d_current > EPSILON {
                    if let Some(mut inter) = Segment::intersection_flat(a, b, &self.points[last_idx], &self.points[current_idx]) {
                        Point::align3d_from2d(&self.points[last_idx], &self.points[current_idx], &mut inter);
                        let inter_idx = self.add_point(inter.xf, inter.yf, inter.x, inter.y, inter.z);
                        left_indices.push(inter_idx);
                        right_indices.push(inter_idx);
                        self.add_intersection_2d(inter_idx, last_idx, current_idx);
                        right_indices.push(current_idx);
                    } else {
                        return;
                    }
                }
            } else if d_last.abs() <= EPSILON { // Last on the line
                if d_current < -EPSILON {
                    left_indices.push(current_idx);
                } else if d_current.abs() <= EPSILON {
                    if Segment::intersection_flat(a, b, &self.points[last_idx], &self.points[current_idx]).is_none() { return; }
                    left_indices.push(current_idx);
                    right_indices.push(current_idx);
                } else if d_current > EPSILON {
                    right_indices.push(current_idx);
                }
            } else if d_last > EPSILON { // Last on the right
                if d_current < -EPSILON {
                    if let Some(mut inter) = Segment::intersection_flat(a, b, &self.points[last_idx], &self.points[current_idx]) {
                        Point::align3d_from2d(&self.points[last_idx], &self.points[current_idx], &mut inter);
                        let inter_idx = self.add_point(inter.xf, inter.yf, inter.x, inter.y, inter.z);
                        left_indices.push(inter_idx);
                        right_indices.push(inter_idx);
                        self.add_intersection_2d(inter_idx, last_idx, current_idx);
                        left_indices.push(current_idx);
                    } else {
                        return;
                    }
                } else if d_current.abs() <= EPSILON {
                    if Segment::intersection_flat(a, b, &self.points[last_idx], &self.points[current_idx]).is_none() { return; }
                    left_indices.push(current_idx);
                    right_indices.push(current_idx);
                } else if d_current > EPSILON {
                    right_indices.push(current_idx);
                }
            }
            last_idx = current_idx;
            d_last = d_current;
        }

        let area_left = Face::area2d_flat(&left_indices.iter().map(|&i| self.points[i]).collect::<Vec<_>>());
        let area_right = Face::area2d_flat(&right_indices.iter().map(|&i| self.points[i]).collect::<Vec<_>>());

        if area_left.abs() > EPSILON && area_right.abs() > EPSILON {
            let offset = self.faces[face_idx].offset;
            self.faces[face_idx].points = left_indices;
            let new_face_idx = self.add_face(right_indices);
            self.faces[new_face_idx].offset = offset;
        }
    }

    pub fn split_all_faces_by_plane_3d(&mut self, plane: &Plane) {
        for i in (0..self.faces.len()).rev() {
            self.split_face_by_plane_3d(i, plane);
        }
    }

    pub fn split_all_faces_by_line_2d(&mut self, a: &Point, b: &Point) {
        for i in (0..self.faces.len()).rev() {
            self.split_face_by_segment_2d(i, a, b);
        }
    }

    pub fn split_cross_3d(&mut self, p1_idx: usize, p2_idx: usize) {
        let p1 = Vec3::from_point(&self.points[p1_idx]);
        let p2 = Vec3::from_point(&self.points[p2_idx]);
        let plane = Plane::across(p1, p2);
        self.split_all_faces_by_plane_3d(&plane);
    }

    pub fn split_cross_2d(&mut self, p1_idx: usize, p2_idx: usize) {
        let p1 = self.points[p1_idx];
        let p2 = self.points[p2_idx];
        let normal = (p2.yf - p1.yf, -(p2.xf - p1.xf));
        let middle = ((p1.xf + p2.xf) / 2.0, (p1.yf + p2.yf) / 2.0);
        
        let a = Point::new(middle.0 + normal.0, middle.1 + normal.1, 0.0, 0.0, 0.0);
        let b = Point::new(middle.0 - normal.0, middle.1 - normal.1, 0.0, 0.0, 0.0);
        self.split_all_faces_by_line_2d(&a, &b);
    }

    pub fn split_by_3d(&mut self, p1_idx: usize, p2_idx: usize) {
        let p1 = Vec3::from_point(&self.points[p1_idx]);
        let p2 = Vec3::from_point(&self.points[p2_idx]);
        let plane = Plane::by(p1, p2);
        self.split_all_faces_by_plane_3d(&plane);
    }

    pub fn split_by_2d(&mut self, p1_idx: usize, p2_idx: usize) {
        let p1 = self.points[p1_idx];
        let p2 = self.points[p2_idx];
        self.split_all_faces_by_line_2d(&p1, &p2);
    }

    pub fn add_intersection_3d(&mut self, inter_idx: usize, last_idx: usize, current_idx: usize, last_inter_idx: Option<usize>) -> Option<usize> {
        if let Some(segment_idx) = self.get_segment(last_idx, current_idx) {
            self.split_segment(segment_idx, last_idx, inter_idx);
        }
        self.add_segment(inter_idx, current_idx);

        if let Some(li_idx) = last_inter_idx {
            if inter_idx != li_idx {
                self.add_segment(li_idx, inter_idx);
                return None;
            }
        }
        Some(inter_idx)
    }

    pub fn add_intersection_2d(&mut self, inter_idx: usize, last_idx: usize, current_idx: usize) {
        if let Some(segment_idx) = self.get_segment(last_idx, current_idx) {
            self.split_segment(segment_idx, last_idx, inter_idx);
            self.add_segment(inter_idx, current_idx);
        }
    }

    pub fn split_segment(&mut self, segment_idx: usize, p1_idx: usize, p2_idx: usize) {
        self.segments[segment_idx].p1 = self.points[p1_idx];
        self.segments[segment_idx].p2 = self.points[p2_idx];
    }

    pub fn get_face_vertices_ccw(&self, face_idx: usize) -> Vec<usize> {
        if face_idx >= self.faces.len() {
            return Vec::new();
        }
        let face = &self.faces[face_idx];
        face.points.clone()
    }

    pub fn get_2d_bounds(&self) -> Bounds {
        let mut b = Bounds { x_min: f32::MAX, x_max: f32::MIN, y_min: f32::MAX, y_max: f32::MIN };
        for p in &self.points {
            if p.xf < b.x_min { b.x_min = p.xf; }
            if p.xf > b.x_max { b.x_max = p.xf; }
            if p.yf < b.y_min { b.y_min = p.yf; }
            if p.yf > b.y_max { b.y_max = p.yf; }
        }
        b
    }

    pub fn search_faces_with_ab(&self, p1_idx: usize, p2_idx: usize) -> Vec<usize> {
        let mut result = Vec::new();
        for (i, face) in self.faces.iter().enumerate() {
            let mut found_p1 = false;
            let mut found_p2 = false;
            for &pidx in &face.points {
                if pidx == p1_idx { found_p1 = true; }
                if pidx == p2_idx { found_p2 = true; }
            }
            if found_p1 && found_p2 {
                result.push(i);
            }
        }
        result
    }

    pub fn get_3d_bounds(&self) -> Bounds {
        let mut b = Bounds { x_min: f32::MAX, x_max: f32::MIN, y_min: f32::MAX, y_max: f32::MIN };
        for p in &self.points {
            if p.x < b.x_min { b.x_min = p.x; }
            if p.x > b.x_max { b.x_max = p.x; }
            if p.y < b.y_min { b.y_min = p.y; }
            if p.y > b.y_max { b.y_max = p.y; }
        }
        b
    }
}

pub struct Bounds {
    pub x_min: f32,
    pub x_max: f32,
    pub y_min: f32,
    pub y_max: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        assert_eq!(model.points.len(), 4, "4 points");
        assert_eq!(model.segments.len(), 4, "4 segments");
        assert_eq!(model.faces.len(), 1, "1 face");
    }

    #[test]
    fn test_rotate() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        let axis = Vec3::new(0.0, 1.0, 0.0);
        let angle = std::f32::consts::PI / 2.0;
        model.rotate(&axis, angle);
        // Après rotation de 90° autour de Y, le point (200, -200, 0) devient (0, -200, -200)
        let p1 = model.points[1];
        assert!((p1.x).abs() < 1e-5);
        assert!((p1.y + 200.0).abs() < 1e-5);
        assert!((p1.z + 200.0).abs() < 1e-5);
    }

    #[test]
    fn test_translate() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        let translation = Vec3::new(10.0, 20.0, 30.0);
        model.translate(&translation);
        let p0 = model.points[0];
        assert_eq!(p0.x, -200.0 + 10.0);
        assert_eq!(p0.y, -200.0 + 20.0);
        assert_eq!(p0.z, 0.0 + 30.0);
    }

    #[test]
    fn test_scale() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        model.scale_model(2.0);
        let p1 = model.points[1];
        assert_eq!(p1.x, 400.0);
        assert_eq!(p1.y, -400.0);
    }

    #[test]
    fn test_hover() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        model.hover_2d_3d(&[0], &[], &[]);
        assert_eq!(model.points[0].hover, true);
        assert_eq!(model.points[1].hover, false);
    }

    #[test]
    fn test_click() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        model.click_2d_3d(&[0], &[], &[]);
        assert_eq!(model.points[0].select, 1);
        model.click_2d_3d(&[0], &[], &[]);
        assert_eq!(model.points[0].select, 2);
    }

    #[test]
    fn test_bounds() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        let bounds = model.get_2d_bounds();
        assert_eq!(bounds.x_min, -200.0);
        assert_eq!(bounds.x_max, 200.0);
    }

    #[test]
    fn test_search_faces() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        let faces = model.search_faces_with_ab(0, 1);
        assert_eq!(faces.len(), 1);
        assert_eq!(faces[0], 0);
    }

    #[test]
    fn test_split_face_by_plane_3d_diagonal() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        // Plane by [0] [2] split on diagonal
        let p0 = Vec3::from_point(&model.points[0]);
        let p2 = Vec3::from_point(&model.points[2]);
        let plane = Plane::by(p0, p2);
        model.split_face_by_plane_3d(0, &plane);
        assert_eq!(model.faces.len(), 2, "Model should have 2 faces");
        assert_eq!(model.points.len(), 4, "Model should have 4 points");
        assert_eq!(model.segments.len(), 5, "Model should have 5 segments");
        assert_eq!(model.faces[0].points.len(), 3, "Face 0 should have 3 points");
        assert_eq!(model.faces[1].points.len(), 3, "Face 1 should have 3 points");
    }

    #[test]
    fn test_split_all_faces_by_plane_3d_two_diagonals() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        // Diagonal Split 0,2
        let p0 = Vec3::from_point(&model.points[0]);
        let p2 = Vec3::from_point(&model.points[2]);
        let plane1 = Plane::by(p0, p2);
        model.split_all_faces_by_plane_3d(&plane1);
        assert_eq!(model.faces.len(), 2);
        
        // Diagonal Split 1,3
        let p1 = Vec3::from_point(&model.points[1]);
        let p3 = Vec3::from_point(&model.points[3]);
        let plane2 = Plane::by(p1, p3);
        model.split_all_faces_by_plane_3d(&plane2);
        assert_eq!(model.faces.len(), 4, "Model should have 4 faces");
        assert_eq!(model.points.len(), 5, "Model should have 5 points");
        assert_eq!(model.segments.len(), 8, "Model should have 8 segments");
    }

    #[test]
    fn test_split_cross_3d() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        // Plane crossing X=0 => 2 faces, and 2 intersections
        model.split_cross_3d(0, 1);
        assert_eq!(model.faces.len(), 2, "Model should have 2 faces");
        assert_eq!(model.points.len(), 6, "Model should have 6 points");
        assert_eq!(model.segments.len(), 7, "Model should have 7 segments");
        // Plane crossing Y=0 => 4 faces, and 3 intersections
        model.split_cross_3d(1, 2);
        assert_eq!(model.faces.len(), 4, "Model should have 4 faces");
        assert_eq!(model.points.len(), 9, "Model should have 9 points");
        assert_eq!(model.segments.len(), 12, "Model should have 12 segments");
    }

    #[test]
    fn test_split_cross_2d() {
        let mut model = Model::new();
        model.init(200.0, 200.0);
        model.split_cross_2d(0, 1);
        assert_eq!(model.faces.len(), 2, "Model should have 2 faces");
        assert_eq!(model.points.len(), 6, "Model should have 6 points");
        assert_eq!(model.segments.len(), 7, "Model should have 7 segments");
        assert_eq!(model.points[4].yf, -200.0, "Point 4 should be at yf=-200");
    }
}
