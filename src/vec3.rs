use crate::point::Point;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Vec3 { x, y, z }
    }

    pub fn from_point(p: &Point) -> Self {
        Vec3 { x: p.x, y: p.y, z: p.z }
    }

    pub fn dot(u: Vec3, v: Vec3) -> f32 {
        u.x * v.x + u.y * v.y + u.z * v.z
    }

    pub fn length3d(v: Vec3) -> f32 {
        (v.x * v.x + v.y * v.y + v.z * v.z).sqrt()
    }

    pub fn scale(mut v: Vec3, s: f32) -> Vec3 {
        v.x *= s;
        v.y *= s;
        v.z *= s;
        v
    }

    pub fn add(u: Vec3, v: Vec3) -> Vec3 {
        Vec3::new(u.x + v.x, u.y + v.y, u.z + v.z)
    }

    pub fn sub(u: Vec3, v: Vec3) -> Vec3 {
        Vec3::new(u.x - v.x, u.y - v.y, u.z - v.z)
    }

    pub fn normalize(v: Vec3) -> Vec3 {
        let len = Vec3::length3d(v);
        if len != 0.0 {
            Vec3::scale(v, 1.0 / len)
        } else {
            v
        }
    }

    pub fn cross(a: Vec3, b: Vec3) -> Vec3 {
        Vec3::new(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x,
        )
    }

    pub fn closest_point(c: Vec3, a: Vec3, b: Vec3) -> Vec3 {
        let ab = Vec3::sub(b, a);
        let ac = Vec3::sub(c, a);
        let ab_dot_ab = Vec3::dot(ab, ab);
        let t = if ab_dot_ab == 0.0 { 0.0 } else { Vec3::dot(ac, ab) / ab_dot_ab };
        Vec3::add(a, Vec3::scale(ab, t))
    }

    pub fn point_line_distance(c: Vec3, a: Vec3, b: Vec3) -> f32 {
        let ac = Vec3::sub(c, a);
        let bc = Vec3::sub(c, b);
        let cross = Vec3::cross(ac, bc);
        let ab = Vec3::sub(b, a);
        let ab_len = Vec3::length3d(ab);
        if ab_len == 0.0 {
            Vec3::length3d(ac)
        } else {
            Vec3::length3d(cross) / ab_len
        }
    }

    pub fn rotate(&self, axis: &Vec3, angle: f32) -> Vec3 {
        let half_angle = angle / 2.0;
        let s = half_angle.sin();
        let q_w = half_angle.cos();
        let q_x = axis.x * s;
        let q_y = axis.y * s;
        let q_z = axis.z * s;

        let v_x = self.x;
        let v_y = self.y;
        let v_z = self.z;

        // Quaternion rotation: q * v * q^-1
        let tw_x = q_y * v_z - q_z * v_y + q_w * v_x;
        let tw_y = q_z * v_x - q_x * v_z + q_w * v_y;
        let tw_z = q_x * v_y - q_y * v_x + q_w * v_z;
        let tw_w = -q_x * v_x - q_y * v_y - q_z * v_z;

        Vec3::new(
            tw_x * q_w - tw_w * q_x - tw_y * q_z + tw_z * q_y,
            tw_y * q_w - tw_w * q_y - tw_z * q_x + tw_x * q_z,
            tw_z * q_w - tw_w * q_z - tw_x * q_y + tw_y * q_x,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_closest_point() {
        let a = Vec3::new(0.0, 0.0, 0.0);
        let p = Vec3::closest_point(a, a, a);
        assert_eq!(p, a);

        let c = Vec3::new(100.0, 0.0, 0.0);
        let p = Vec3::closest_point(c, a, a);
        assert_eq!(p, a);

        let b = Vec3::new(100.0, 100.0, 0.0);
        let c = Vec3::new(50.0, 50.0, 0.0);
        let p = Vec3::closest_point(c, a, b);
        assert_eq!(p, c);

        let a = Vec3::new(50.0, 50.0, 50.0);
        let b = Vec3::new(100.0, 100.0, 100.0);
        let c = Vec3::new(0.0, 0.0, 0.0);
        let p = Vec3::closest_point(c, a, b);
        assert_eq!(p, c);

        let a = Vec3::new(0.0, 0.0, 0.0);
        let b = Vec3::new(100.0, 0.0, 0.0);
        let c = Vec3::new(50.0, 100.0, 0.0);
        let p = Vec3::closest_point(c, a, b);
        assert_eq!(p, Vec3::new(50.0, 0.0, 0.0));
    }

    #[test]
    fn test_point_line_distance() {
        let a = Vec3::new(0.0, 0.0, 0.0);
        let d = Vec3::point_line_distance(a, a, a);
        assert_eq!(d, 0.0);

        let c = Vec3::new(100.0, 0.0, 0.0);
        let d = Vec3::point_line_distance(c, a, a);
        assert_eq!(d, 100.0);

        let b = Vec3::new(100.0, 100.0, 0.0);
        let c = Vec3::new(50.0, 50.0, 0.0);
        let d = Vec3::point_line_distance(c, a, b);
        assert_eq!(d, 0.0);

        let a = Vec3::new(50.0, 50.0, 50.0);
        let b = Vec3::new(100.0, 100.0, 100.0);
        let c = Vec3::new(0.0, 0.0, 0.0);
        let d = Vec3::point_line_distance(c, a, b);
        assert!((d - 0.0).abs() < 1e-6);

        let a = Vec3::new(0.0, 0.0, 0.0);
        let b = Vec3::new(100.0, 0.0, 0.0);
        let c = Vec3::new(50.0, 100.0, 0.0);
        let d = Vec3::point_line_distance(c, a, b);
        assert_eq!(d, 100.0);
    }

    #[test]
    fn test_dot() {
        let a = Vec3::new(2.0, 3.0, 4.0);
        let b = Vec3::new(5.0, 6.0, 7.0);
        let dot = Vec3::dot(a, b);
        assert_eq!(dot, 56.0);
    }

    #[test]
    fn test_scale() {
        let a = Vec3::new(2.0, 3.0, 4.0);
        let scaled = Vec3::scale(a, 2.0);
        assert_eq!(scaled.x, 4.0);
        assert_eq!(scaled.y, 6.0);
        assert_eq!(scaled.z, 8.0);
    }

    #[test]
    fn test_length3d() {
        let a = Vec3::new(3.0, 6.0, 6.0);
        let l = Vec3::length3d(a);
        assert_eq!(l, 9.0);
    }

    #[test]
    fn test_normalize() {
        let a = Vec3::new(3.0, 6.0, 6.0);
        let n = Vec3::normalize(a);
        assert!((Vec3::length3d(n) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_add() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(4.0, 5.0, 6.0);
        let c = Vec3::add(a, b);
        assert_eq!(c.x, 5.0);
        assert_eq!(c.y, 7.0);
        assert_eq!(c.z, 9.0);
    }

    #[test]
    fn test_sub() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(4.0, 5.0, 6.0);
        let c = Vec3::sub(a, b);
        assert_eq!(c.x, -3.0);
        assert_eq!(c.y, -3.0);
        assert_eq!(c.z, -3.0);
    }
}
