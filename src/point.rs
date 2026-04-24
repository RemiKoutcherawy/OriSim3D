use std::f32;

#[derive(Clone, Copy, Debug)]
pub struct Point {
    pub xf: f32, pub yf: f32,
    pub x: f32, pub y: f32, pub z: f32,
    // Helper
    pub hover: bool,
    pub select: i32,
    // xCanvas projected point in overlay
    pub x_canvas: Option<f32>,
    pub y_canvas: Option<f32>,
}

impl Default for Point {
    fn default() -> Self { Self::new(0.0, 0.0, 0.0, 0.0, 0.0) }
}
impl Point {
    pub fn new(xf: f32, yf: f32, x: f32, y: f32, z: f32) -> Self {
        Point {
            xf, yf,
            x, y, z,
            hover: false,
            select: 0,
            x_canvas: None,
            y_canvas: None,
        }
    }

    // Adjust point i 2d coords on segment ab
    pub fn align2d_from3d(a: &Point, b: &Point, i: &mut Point) {
        // Length from a to i in 3d
        let ai = ((i.x - a.x).powi(2) + (i.y - a.y).powi(2) + (i.z - a.z).powi(2)).sqrt();
        // Length from a to b in 3d
        let ab = ((b.x - a.x).powi(2) + (b.y - a.y).powi(2) + (b.z - a.z).powi(2)).sqrt();
        
        if ab != 0.0 {
            // Ratio t from
            let t = ai / ab;
            // Set 2d to the same ratio
            i.xf = a.xf + t * (b.xf - a.xf);
            i.yf = a.yf + t * (b.yf - a.yf);
        }
    }

    // Adjust point i 3d coords on segment ab
    pub fn align3d_from2d(a: &Point, b: &Point, i: &mut Point) {
        // Length from a to i in 2d
        let ai = ((i.xf - a.xf).powi(2) + (i.yf - a.yf).powi(2)).sqrt();
        // Length from a to b in 2d
        let ab = ((b.xf - a.xf).powi(2) + (b.yf - a.yf).powi(2)).sqrt();
        
        if ab != 0.0 {
            // Ratio t from
            let t = ai / ab;
            // Set 3d to the same ratio
            i.x = a.x + t * (b.x - a.x);
            i.y = a.y + t * (b.y - a.y);
            i.z = a.z + t * (b.z - a.z);
        }
    }

    // Distance
    pub fn distance2d(a: &Point, b: &Point) -> f32 {
        ((b.xf - a.xf).powi(2) + (b.yf - a.yf).powi(2)).sqrt()
    }

    // Normalize as if Vector 2d
    pub fn normalise(a: &Point) -> (f32, f32) {
        let length = (a.xf * a.xf + a.yf * a.yf).sqrt();
        if length != 0.0 {
            (a.xf / length, a.yf / length)
        } else {
            (0.0, 0.0)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_align2d_from3d() {
        let a = Point::new(0.0, 0.0, 0.0, 0.0, 0.0);
        let b = Point::new(10.0, 10.0, 10.0, 0.0, 0.0);
        let mut i = Point::new(0.0, 0.0, 5.0, 0.0, 0.0);
        Point::align2d_from3d(&a, &b, &mut i);
        assert_eq!(i.xf, 5.0);
        assert_eq!(i.yf, 5.0);
    }
    #[test]
    fn test_align3d_from2d() {
        let p0 = Point::new(-100.0, -100.0, -100.0, -100.0, 0.0);
        let p1 = Point::new(100.0, -100.0, 100.0, -100.0, 0.0);
        // p is on segment p0 p1, with wrong x, y, z
        let mut p = Point::new(50.0, -100.0, 0.0, 0.0, 100.0);
        Point::align3d_from2d(&p0, &p1, &mut p);
        assert_eq!(p.x, 50.0, "x should be 50");
        assert_eq!(p.y, -100.0, "y should be -100");
        assert_eq!(p.z, 0.0, "z should be 0");
        // degenerated case p is on endpoint
        let mut p = Point::new(100.0, -100.0, 0.0, 0.0, 100.0);
        Point::align3d_from2d(&p0, &p1, &mut p);
        assert_eq!(p.x, 100.0, "x should be 100");
        assert_eq!(p.y, -100.0, "y should be -100");
        assert_eq!(p.z, 0.0, "z should be 0");
    }
    #[test]
    fn test_distance2d() {
        let a = Point::new(0.0, 0.0, 0.0, 0.0, 100.0);
        let b = Point::new(30.0, 40.0, 0.0, 0.0, 100.0);
        let d = Point::distance2d(&a, &b);
        assert_eq!(d, 50.0, "distance should be 50");
    }
    #[test]
    fn test_normalise() {
        let p = Point::new(3.0, 4.0, 0.0, 0.0, 0.0);
        let (nx, ny) = Point::normalise(&p);
        assert_eq!(nx, 0.6);
        assert_eq!(ny, 0.8);
    }
}
