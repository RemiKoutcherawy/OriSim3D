use crate::point::Point;
use crate::vec3::Vec3;

#[derive(Clone, Copy, Debug)]
pub struct Segment {
    pub p1: Point,
    pub p2: Point,
    pub hover: bool,
    pub select: i32,
}

impl Segment {
    pub fn new(p1: Point, p2: Point) -> Self { Segment { p1, p2, hover: false, select: 0, } }
    // 2d distance from Segment to Point
    pub fn distance2d(x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) -> f32 {
        let l2 = (x1 - x2).powi(2) + (y1 - y2).powi(2);
        if l2 == 0.0 {
            return ((x - x1).powi(2) + (y - y1).powi(2)).sqrt();
        }
        let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
        if t < 0.0 {
            return ((x - x1).powi(2) + (y - y1).powi(2)).sqrt();
        }
        if t > 1.0 {
            return ((x - x2).powi(2) + (y - y2).powi(2)).sqrt();
        }
        let projection_x = x1 + t * (x2 - x1);
        let projection_y = y1 + t * (y2 - y1);
        ((x - projection_x).powi(2) + (y - projection_y).powi(2)).sqrt()
    }
    // Area counter clock wise, CCW, gives 2d signed distance between Point and Segment in 3d
    pub fn ccw(a: &Point, b: &Point, c: &Point) -> f32 {
        (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x)
    }
    // Area CounterClockWise, CCW, gives 2d signed distance between Point and Segment in 2d Crease pattern
    pub fn ccw_flat(a: &Point, b: &Point, c: &Point) -> f32 {
        (a.xf - c.xf) * (b.yf - c.yf) - (a.yf - c.yf) * (b.xf - c.xf)
    }
    // 2d intersection between two segments ab and cd
    pub fn intersection_flat(a: &Point, b: &Point, c: &Point, d: &Point) -> Option<Point> {
        fn collinear(a: &Point, b: &Point, c: &Point, d: &Point) -> Option<Point> {
            let ab_len_sq = (b.xf - a.xf).powi(2) + (b.yf - a.yf).powi(2);
            let cd_len_sq = (d.xf - c.xf).powi(2) + (d.yf - c.yf).powi(2);
            if ab_len_sq == 0.0 {
                if cd_len_sq == 0.0 {
                    return if a.xf == c.xf && a.yf == c.yf { Some(*a) } else { None };
                }
                // project 'a' on 'cd'
                // This is a bit simplified compared to JS, but matches logic
                let t = ((a.xf - c.xf) * (d.xf - c.xf) + (a.yf - c.yf) * (d.yf - c.yf)) / cd_len_sq;
                if t < 0.0 || t > 1.0 {
                    return None;
                }
                // Check if it's really on the line
                let proj_x = c.xf + t * (d.xf - c.xf);
                let proj_y = c.yf + t * (d.yf - c.yf);
                if (proj_x - a.xf).abs() < 1e-6 && (proj_y - a.yf).abs() < 1e-6 {
                    return Some(*a);
                }
                return None;
            }
            let tc = ((c.xf - a.xf) * (b.xf - a.xf) + (c.yf - a.yf) * (b.yf - a.yf)) / ab_len_sq;
            let td = ((d.xf - a.xf) * (b.xf - a.xf) + (d.yf - a.yf) * (b.yf - a.yf)) / ab_len_sq;
            if tc < 0.0 {
                if td < 0.0 {
                    None
                } else if td > 1.0 {
                    Some(*a)
                } else {
                    Some(*d)
                }
            } else if tc > 1.0 {
                if td > 1.0 {
                    None
                } else {
                    Some(*d)
                }
            } else {
                Some(*c)
            }
        }
        let a1 = Self::ccw_flat(a, b, d);
        let a2 = Self::ccw_flat(a, b, c);
        if a1 * a2 <= 0.0 {
            let a3 = Self::ccw_flat(c, d, a);
            let a4 = a3 + a2 - a1;
            if a3 * a4 <= 0.0 {
                if (a3 - a4).abs() < 1e-10 {
                    return collinear(a, b, c, d);
                } else {
                    let t = a3 / (a3 - a4);
                    let mut p = Point::default();
                    p.xf = a.xf + t * (b.xf - a.xf);
                    p.yf = a.yf + t * (b.yf - a.yf);
                    return Some(p);
                }
            }
        }
        None
    }

    pub fn intersection2d_basic_flat(a: &Point, b: &Point, c: &Point, d: &Point) -> Option<Point> {
        let v1_x = b.xf - a.xf;
        let v1_y = b.yf - a.yf;
        let v2_x = d.xf - c.xf;
        let v2_y = d.yf - c.yf;
        let det = -v2_x * v1_y + v1_x * v2_y;
        if det.abs() < 1e-10 {
            return None;
        }
        let s = (-v1_y * (a.xf - c.xf) + v1_x * (a.yf - c.yf)) / det;
        let t = (v2_x * (a.yf - c.yf) - v2_y * (a.xf - c.xf)) / det;
        if s >= 0.0 && s <= 1.0 && t >= 0.0 && t <= 1.0 {
            let mut p = Point::default();
            p.xf = a.xf + t * v1_x;
            p.yf = a.yf + t * v1_y;
            return Some(p);
        }
        None
    }

    pub fn intersection2d_lines(a: &Point, b: &Point, c: &Point, d: &Point) -> Option<Point> {
        let v1_x = b.xf - a.xf;
        let v1_y = b.yf - a.yf;
        let v2_x = d.xf - c.xf;
        let v2_y = d.yf - c.yf;
        let determinant = -v2_x * v1_y + v1_x * v2_y;
        if determinant.abs() < 1e-10 {
            return None;
        }
        let t = (v2_x * (a.yf - c.yf) - v2_y * (a.xf - c.xf)) / determinant;
        let mut p = Point::default();
        p.xf = a.xf + t * v1_x;
        p.yf = a.yf + t * v1_y;
        Some(p)
    }

    pub fn distance_to_segment(a: &Point, b: &Point, c: &Point, d: &Point) -> f32 {
        let closest = Self::closest_segment(a, b, c, d);
        let pq = Vec3::sub(closest.1, closest.0);
        Vec3::length3d(pq)
    }

    pub fn closest_segment(a: &Point, b: &Point, c: &Point, d: &Point) -> (Vec3, Vec3) {
        let epsilon = 1e-6;
        let ab = Vec3::new(b.x - a.x, b.y - a.y, b.z - a.z);
        let cd = Vec3::new(d.x - c.x, d.y - c.y, d.z - c.z);
        let ca = Vec3::new(a.x - c.x, a.y - c.y, a.z - c.z);
        let aa = Vec3::dot(ab, ab);
        let ee = Vec3::dot(cd, cd);
        let ff = Vec3::dot(cd, ca);

        let mut s;
        let mut t;

        if aa < epsilon && ee < epsilon {
            return (Vec3::new(a.x, a.y, a.z), Vec3::new(c.x, c.y, c.z));
        } else {
            if aa < epsilon {
                s = 0.0;
                t = ff / ee;
                t = t.clamp(0.0, 1.0);
            } else {
                let cc = Vec3::dot(ab, ca);
                if ee < epsilon {
                    t = 0.0;
                    s = -cc / aa;
                    s = s.clamp(0.0, 1.0);
                } else {
                    let bb = Vec3::dot(ab, cd);
                    let denominator = aa * ee - bb * bb;
                    if denominator != 0.0 {
                        s = (bb * ff - cc * ee) / denominator;
                        s = s.clamp(0.0, 1.0);
                    } else {
                        s = 0.0;
                    }
                    t = (bb * s + ff) / ee;
                    if t < 0.0 {
                        t = 0.0;
                        s = (-cc / aa).clamp(0.0, 1.0);
                    } else if t > 1.0 {
                        t = 1.0;
                        s = ((bb - cc) / aa).clamp(0.0, 1.0);
                    }
                }
            }
            let p = Vec3::add(Vec3::new(a.x, a.y, a.z), Vec3::scale(ab, s));
            let q = Vec3::add(Vec3::new(c.x, c.y, c.z), Vec3::scale(cd, t));
            (p, q)
        }
    }

    pub fn length3d(s: &Segment) -> f32 {
        ((s.p1.x - s.p2.x).powi(2) + (s.p1.y - s.p2.y).powi(2) + (s.p1.z - s.p2.z).powi(2)).sqrt()
    }

    pub fn length2d(s: &Segment) -> f32 {
        ((s.p1.xf - s.p2.xf).powi(2) + (s.p1.yf - s.p2.yf).powi(2)).sqrt()
    }

    pub fn project2d(s: &Segment, p: &Point) -> Option<Point> {
        let l2 = (s.p2.xf - s.p1.xf).powi(2) + (s.p2.yf - s.p1.yf).powi(2);
        if l2 == 0.0 { return None; }
        let t = ((p.xf - s.p1.xf) * (s.p2.xf - s.p1.xf) + (p.yf - s.p1.yf) * (s.p2.yf - s.p1.yf)) / l2;
        if t < 0.0 || t > 1.0 {
            return None;
        }
        let mut res = Point::default();
        res.xf = s.p1.xf + t * (s.p2.xf - s.p1.xf);
        res.yf = s.p1.yf + t * (s.p2.yf - s.p1.yf);
        Some(res)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distance2d() {
        let p1 = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let p2 = Point::new(100.0, 100.0, 0.0, 0.0, 0.0);
        // End points
        assert_eq!(Segment::distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p1.xf, p1.yf), 0.0);
        assert_eq!(Segment::distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p2.xf, p2.yf), 0.0);
        // Apart on X
        let p3 = Point::new(-30.0, 0.0, 0.0, 0.0, 0.0);
        assert_eq!(Segment::distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p3.xf, p3.yf), 30.0);
        // Apart on Y
        let p4 = Point::new(0.0, -30.0, 0.0, 0.0, 0.0);
        assert_eq!(Segment::distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p4.xf, p4.yf), 30.0);
        // Apart and aligned
        let p5 = Point::new(110.0, 110.0, 0.0, 0.0, 0.0);
        let d = Segment::distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p5.xf, p5.yf);
        let expected = (10.0f32.powi(2) + 10.0f32.powi(2)).sqrt();
        assert!((d - expected).abs() < 1e-6);
        // 3,4,5
        let p6 = Point::new(-30.0, -40.0, 0.0, 0.0, 0.0);
        assert_eq!(Segment::distance2d(p1.xf, p1.yf, p2.xf, p2.yf, p6.xf, p6.yf), 50.0);
    }

    #[test]
    fn test_ccw() {
        let v1 = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let v2 = Point::new(0.0, 0.0, 10.0, 10.0, 0.0);
        assert_eq!(Segment::ccw(&v1, &v2, &v1), 0.0);
        assert_eq!(Segment::ccw(&v1, &v2, &v2), 0.0);
        let v3 = Point::new(0.0, 0.0, -30.0, 0.0, 0.0);
        assert_eq!(Segment::ccw(&v1, &v2, &v3), 300.0);
        let v4 = Point::new(0.0, 0.0, 30.0, 0.0, 0.0);
        assert_eq!(Segment::ccw(&v1, &v2, &v4), -300.0);
    }

    #[test]
    fn test_ccw_flat() {
        let v1 = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let v2 = Point::new(10.0, 10.0, 0.0, 0.0, 0.0);
        assert_eq!(Segment::ccw_flat(&v1, &v2, &v1), 0.0);
        let v3 = Point::new(30.0, 0.0, 0.0, 0.0, 0.0);
        assert_eq!(Segment::ccw_flat(&v1, &v2, &v3), -300.0);
    }

    #[test]
    fn test_intersection_flat() {
        let a = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let b = Point::new(100.0, 100.0, 0.0, 0.0, 0.0);
        let c = Point::new(100.0, 0.0, 0.0, 0.0, 0.0);
        let d = Point::new(0.0, 100.0, 0.0, 0.0, 0.0);
        let inter = Segment::intersection_flat(&a, &b, &c, &d).unwrap();
        assert_eq!(inter.xf, 50.0);
        assert_eq!(inter.yf, 50.0);
        // T shape
        let d2 = Point::new(50.0, 50.0, 0.0, 0.0, 0.0);
        let inter2 = Segment::intersection_flat(&a, &b, &c, &d2).unwrap();
        assert_eq!(inter2.xf, 50.0);
        assert_eq!(inter2.yf, 50.0);
        // Disjoint
        let d3 = Point::new(50.0, 40.0, 0.0, 0.0, 0.0);
        assert!(Segment::intersection_flat(&a, &b, &c, &d3).is_none());
    }

    #[test]
    fn test_intersection2d_lines() {
        let a = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let b = Point::new(10.0, 0.0, 0.0, 0.0, 0.0);
        let c = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let d = Point::new(0.0, 10.0, 0.0, 0.0, 0.0);
        let inter = Segment::intersection2d_lines(&a, &b, &c, &d).unwrap();
        assert_eq!(inter.xf, 0.0);
        assert_eq!(inter.yf, 0.0);
    }

    #[test]
    fn test_distance_to_segment() {
        let a = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let b = Point::new(0.0, 0.0, 10.0, 0.0, 0.0);
        let c = Point::new(0.0, 0.0, 5.0, 10.0, 0.0);
        let d = Point::new(0.0, 0.0, 5.0, 5.0, 0.0);
        assert_eq!(Segment::distance_to_segment(&a, &b, &c, &d), 5.0);
    }

    #[test]
    fn test_length3d() {
        let seg = Segment::new(
            Point::new(0.0, 0.0, 0.0, 0.0, 0.0),
            Point::new(0.0, 0.0, 10.0, 0.0, 0.0)
        );
        assert_eq!(Segment::length3d(&seg), 10.0);
    }

    #[test]
    fn test_length2d() {
        let seg = Segment::new(
            Point::new(0.0, 0.0, 0.0, 0.0, 0.0),
            Point::new(10.0, 0.0, 0.0, 0.0, 0.0)
        );
        assert_eq!(Segment::length2d(&seg), 10.0);
    }

    #[test]
    fn test_project2d() {
        let a = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let b = Point::new(100.0, 0.0, 0.0, 0.0, 0.0);
        let s = Segment::new(a, b);
        let p = Point::new(50.0, 100.0, 0.0, 0.0, 0.0);
        
        let project = Segment::project2d(&s, &p).unwrap();
        assert_eq!(project.xf, 50.0);
        assert_eq!(project.yf, 0.0);
    }
}
