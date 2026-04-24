use crate::vec3::Vec3;
use crate::point::Point;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Plane {
    pub origin: Vec3,
    pub normal: Vec3,
}

impl Plane {
    // Plane is defined by an origin point R, and a normal vector N
    pub fn new(origin: Vec3, normal: Vec3) -> Self {
        Plane {
            origin,
            normal: Vec3::normalize(normal),
        }
    }

    // Plane across 2 points
    pub fn across(p1: Vec3, p2: Vec3) -> Self {
        let normal = Vec3::sub(p2, p1);
        let middle = Vec3::scale(Vec3::add(p1, p2), 0.5);
        Plane::new(middle, normal)
    }

    // Plane by 2 points on xy orthogonal to z
    pub fn by(p1: Vec3, p2: Vec3) -> Self {
        // Turn 90° on the right (x,y) to (y,-x)
        let normal = Vec3::new(p2.y - p1.y, -(p2.x - p1.x), 0.0);
        Plane::new(p1, normal)
    }

    // Plane orthogonal to a segment [p1, p2] passing by point
    pub fn orthogonal(p1: Vec3, p2: Vec3, point: Vec3) -> Self {
        let normal = Vec3::sub(p2, p1);
        Plane::new(point, normal)
    }

    pub fn plane_to_point_signed_distance(&self, p: &Point) -> f32 {
        let v = Vec3::sub(Vec3::from_point(p), self.origin);
        Vec3::dot(v, self.normal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_across() {
        let p1 = Vec3::new(10.0, 50.0, 0.0);
        let p2 = Vec3::new(30.0, 50.0, 0.0);
        let plane = Plane::across(p1, p2);
        assert_eq!(plane.normal.x, 1.0);
        assert_eq!(plane.normal.y, 0.0);
        assert_eq!(plane.normal.z, 0.0);
        assert_eq!(Vec3::dot(plane.origin, plane.normal), 20.0);
    }

    #[test]
    fn test_by() {
        let p1 = Vec3::new(30.0, 50.0, 0.0);
        let p2 = Vec3::new(10.0, 50.0, 0.0);
        let plane = Plane::by(p1, p2);
        assert_eq!(plane.normal.x, 0.0);
        assert_eq!(plane.normal.y, 1.0);
        assert_eq!(plane.normal.z, 0.0);
        assert_eq!(Vec3::dot(plane.origin, plane.normal), 50.0);
    }

    #[test]
    fn test_orthogonal() {
        let p1 = Vec3::new(10.0, 50.0, 0.0);
        let p2 = Vec3::new(30.0, 50.0, 0.0);
        let pt = Vec3::new(20.0, 0.0, 0.0);
        let plane = Plane::orthogonal(p1, p2, pt);
        assert_eq!(plane.normal.x, 1.0);
        assert_eq!(plane.normal.y, 0.0);
        assert_eq!(plane.normal.z, 0.0);
        assert_eq!(Vec3::dot(plane.origin, plane.normal), 20.0);
    }
}
