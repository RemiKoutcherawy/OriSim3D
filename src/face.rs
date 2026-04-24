use crate::point::Point;
use crate::vec3::Vec3;
use crate::plane::Plane;

#[derive(Clone, Debug)]
pub struct Face {
    pub points: Vec<usize>, // Indices des points dans model.points
    pub offset: f32,
    pub hover: bool,
    pub select: i32,
    pub half_edge: Option<usize>, // Index du half-edge dans model.half_edges
}

impl Face {
    pub fn new(points: Vec<usize>) -> Self {
        Face {
            points,
            offset: 0.0,
            hover: false,
            select: 0,
            half_edge: None,
        }
    }

    pub fn area2d_flat(points: &[Point]) -> f32 {
        let mut area = 0.0;
        let n = points.len();
        if n < 3 {
            return 0.0;
        }
        for i in 0..n {
            let p1 = &points[i];
            let p2 = &points[(i + 1) % n];
            area += (p1.xf * p2.yf) - (p2.xf * p1.yf);
        }
        area / 2.0
    }

    pub fn distance2d_line_to_point(p1: &Point, p2: &Point, p3: &Point) -> f32 {
        (p2.yf - p1.yf) * (p3.xf - p1.xf) - (p2.xf - p1.xf) * (p3.yf - p1.yf)
    }

    pub fn area3d(points: &[Point]) -> f32 {
        let n = points.len();
        if n < 3 {
            return 0.0;
        }
        let mut total_cross = Vec3::new(0.0, 0.0, 0.0);
        for i in 0..n {
            let p1 = Vec3::from_point(&points[i]);
            let p2 = Vec3::from_point(&points[(i + 1) % n]);
            total_cross = Vec3::add(total_cross, Vec3::cross(p1, p2));
        }
        Vec3::length3d(total_cross) / 2.0
    }

    pub fn intersection_plane_segment(plane: &Plane, a: &Vec3, b: &Vec3) -> Option<Point> {
        let u = Vec3::sub(*b, *a);
        let dot = Vec3::dot(plane.normal, u);

        if dot.abs() < 1e-6 {
            return None;
        }

        let w = Vec3::sub(*a, plane.origin);
        let fac = -Vec3::dot(plane.normal, w) / dot;

        if fac < 0.0 || fac > 1.0 {
            return None;
        }

        let intersection = Vec3::add(*a, Vec3::scale(u, fac));
        Some(Point::new(f32::NAN, f32::NAN, intersection.x, intersection.y, intersection.z))
    }

    pub fn contains2d(&self, xf: f32, yf: f32, points: &[crate::point::Point]) -> bool {
        let mut inside = false;
        let n = self.points.len();
        if n == 0 { return false; }

        for i in 0..n {
            let j = (i + n - 1) % n;
            let pi = &points[self.points[i]];
            let pj = &points[self.points[j]];

            if pi.xf == xf && pi.yf == yf {
                return true;
            }

            let intersect = ((pi.yf > yf) != (pj.yf > yf)) && 
                (xf < (pj.xf - pi.xf) * (yf - pi.yf) / (pj.yf - pi.yf) + pi.xf);
            if intersect {
                inside = !inside;
            }
        }
        inside
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_face_area2d_flat() {
        let p0 = Point::new(-100.0, -100.0, -100.0, -100.0, 0.0);
        let p1 = Point::new(100.0, -100.0, 100.0, -100.0, 0.0);
        let p2 = Point::new(100.0, 100.0, 100.0, 100.0, 0.0);
        let p3 = Point::new(-100.0, 100.0, -100.0, 100.0, 0.0);
        let points = vec![p0, p1, p2, p3];
        
        let area = Face::area2d_flat(&points);
        assert_eq!(area, 200.0 * 200.0);
    }

    #[test]
    fn test_distance2d_line_to_point() {
        let p1 = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let p2 = Point::new(100.0, 100.0, 0.0, 0.0, 0.0);
        
        // End points
        let mut d = Face::distance2d_line_to_point(&p1, &p2, &p1);
        assert_eq!(d, 0.0);
        d = Face::distance2d_line_to_point(&p1, &p2, &p2);
        assert_eq!(d, 0.0);
        
        // Apart on X
        let mut p3 = Point::new(-30.0, 0.0, 0.0, 0.0, 0.0);
        p3.xf = -30.0; p3.yf = 0.0;
        d = Face::distance2d_line_to_point(&p1, &p2, &p3);
        assert_eq!(d, -3000.0, "from p1,p2 to (-30,0) should be < 0 on the left");
        
        // Apart on Y
        p3.xf = 0.0; p3.yf = -30.0;
        d = Face::distance2d_line_to_point(&p1, &p2, &p3);
        assert_eq!(d, 3000.0, "from p1,p2 to (0,-30) should be > 0 on the right");
        
        // Apart but aligned on XY
        let mut p3_aligned = Point::new(110.0, 110.0, 0.0, 0.0, 0.0);
        p3_aligned.xf = 110.0; p3_aligned.yf = 110.0;
        d = Face::distance2d_line_to_point(&p1, &p2, &p3_aligned);
        assert_eq!(d, 0.0);
        
        // Point on the left
        let mut p3_left = Point::new(-100.0, 0.0, 0.0, 0.0, 0.0);
        p3_left.xf = -100.0; p3_left.yf = 0.0;
        d = Face::distance2d_line_to_point(&p1, &p2, &p3_left);
        assert_eq!(d, -10000.0);
        
        // Point on the right
        let mut p3_right = Point::new(100.0, 0.0, 0.0, 0.0, 0.0);
        p3_right.xf = 100.0; p3_right.yf = 0.0;
        d = Face::distance2d_line_to_point(&p1, &p2, &p3_right);
        assert_eq!(d, 10000.0);
    }

    #[test]
    fn test_face_area3d() {
        let p0 = Point::new(-100.0, -100.0, -100.0, -100.0, 0.0);
        let p1 = Point::new(100.0, -100.0, 100.0, -100.0, 0.0);
        let p2 = Point::new(100.0, 100.0, 100.0, 100.0, 0.0);
        let p3 = Point::new(-100.0, 100.0, -100.0, 100.0, 0.0);
        let points = vec![p0, p1, p2, p3];
        
        let area = Face::area3d(&points);
        assert_eq!(area, 200.0 * 200.0);
    }

    #[test]
    fn test_intersection_plane_segment() {
        let plane = Plane {
            normal: Vec3::new(0.0, 1.0, 0.0),
            origin: Vec3::new(0.0, 0.0, 0.0),
        };
        
        // Segment intersects plane
        let a = Vec3::new(0.0, -1.0, 0.0);
        let b = Vec3::new(0.0, 1.0, 0.0);
        let result = Face::intersection_plane_segment(&plane, &a, &b);
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.x, 0.0);
        assert_eq!(p.y, 0.0);
        assert_eq!(p.z, 0.0);

        // Parallel
        let a = Vec3::new(0.0, 0.0, 0.0);
        let b = Vec3::new(1.0, 0.0, 0.0);
        let result = Face::intersection_plane_segment(&plane, &a, &b);
        assert!(result.is_none());

        // Does not intersect
        let plane2 = Plane {
            normal: Vec3::new(0.0, 1.0, 0.0),
            origin: Vec3::new(0.0, 1.0, 0.0),
        };
        let a = Vec3::new(0.0, -1.0, 0.0);
        let b = Vec3::new(0.0, 0.0, 0.0);
        let result = Face::intersection_plane_segment(&plane2, &a, &b);
        assert!(result.is_none());

        // Non-axis aligned
        let a = Vec3::new(-1.0, -1.0, -1.0);
        let b = Vec3::new(1.0, 1.0, 1.0);
        let result = Face::intersection_plane_segment(&plane, &a, &b);
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.x, 0.0);
        assert_eq!(p.y, 0.0);
        assert_eq!(p.z, 0.0);
    }
}
