use std::f32::consts::PI;

pub type InterpolatorFn = fn(f32) -> f32;

pub struct Interpolator;

impl Interpolator {
    pub const LINEAR: InterpolatorFn = linear;
    pub const ACCELERATE_DECELERATE: InterpolatorFn = accelerate_decelerate;
    pub const SPRING_OVERSHOOT: InterpolatorFn = spring_overshoot;
    pub const SPRING_BOUNCE: InterpolatorFn = spring_bounce;
    pub const GRAVITY_BOUNCE: InterpolatorFn = gravity_bounce;
    pub const BOUNCE: InterpolatorFn = bounce_interpolator;
    pub const OVERSHOOT: InterpolatorFn = overshoot;
    pub const ANTICIPATE: InterpolatorFn = anticipate;
    pub const ANTICIPATE_OVERSHOOT: InterpolatorFn = anticipate_overshoot;
}

fn linear(t: f32) -> f32 {
    t
}

fn accelerate_decelerate(t: f32) -> f32 {
    (f32::cos((t + 1.0) * PI) / 2.0) + 0.5
}

fn spring_overshoot(t: f32) -> f32 {
    if t < 0.1825 {
        return (((-237.110 * t) + 61.775) * t + 3.664) * t;
    }
    if t < 0.425 {
        return (((74.243 * t) - 72.681) * t + 21.007) * t - 0.579;
    }
    if t < 0.6875 {
        return (((-16.378 * t) + 28.574) * t - 15.913) * t + 3.779;
    }
    if t < 1.0 {
        return (((5.120 * t) - 12.800) * t + 10.468) * t - 1.788;
    }
    ((-176.823 * t) + 562.753) * t - 594.598 * t + 209.669
}

fn spring_bounce(t: f32) -> f32 {
    let x;
    if t < 0.185 {
        x = (((-94.565 * t) + 28.123) * t + 2.439) * t;
    } else if t < 0.365 {
        x = (((-3.215 * t) - 4.890) * t + 5.362) * t + 0.011;
    } else if t < 0.75 {
        x = (((5.892 * t) - 10.432) * t + 5.498) * t + 0.257;
    } else if t < 1.0 {
        x = (((1.520 * t) - 2.480) * t + 0.835) * t + 1.125;
    } else {
        x = (((-299.289 * t) + 945.190) * t - 991.734) * t + 346.834;
    }
    if x > 1.0 { 2.0 - x } else { x }
}

fn gravity_bounce(t: f32) -> f32 {
    let x;
    if t < 0.29 {
        x = (((-14.094 * t) + 9.810) * t - 0.142) * t;
    } else if t < 0.62 {
        x = (((-16.696 * t) + 21.298) * t - 6.390) * t + 0.909;
    } else if t < 0.885 {
        x = (((31.973 * t) - 74.528) * t + 56.497) * t + -12.844;
    } else if t < 1.0 {
        x = (((-37.807 * t) + 114.745) * t - 114.938) * t + 39.000;
    } else {
        x = (((-7278.029 * t) + 22213.034) * t - 22589.244) * t + 7655.239;
    }
    if x > 1.0 { 2.0 - x } else { x }
}

fn bounce_interpolator(mut t: f32) -> f32 {
    fn bounce(t: f32) -> f32 {
        t * t * 8.0
    }

    t *= 1.1226;
    if t < 0.3535 {
        bounce(t)
    } else if t < 0.7408 {
        bounce(t - 0.54719) + 0.7
    } else if t < 0.9644 {
        bounce(t - 0.8526) + 0.9
    } else {
        bounce(t - 1.0435) + 0.95
    }
}

fn overshoot(mut t: f32) -> f32 {
    let tension = 2.0;
    t -= 1.0;
    t * t * ((tension + 1.0) * t + tension) + 1.0
}

fn anticipate(t: f32) -> f32 {
    let tension = 0.0;
    t * t * ((tension + 1.0) * t - tension)
}

fn anticipate_overshoot(t: f32) -> f32 {
    let tension = 1.5;
    fn a(t: f32, s: f32) -> f32 {
        t * t * ((s + 1.0) * t - s)
    }
    fn o(t: f32, s: f32) -> f32 {
        t * t * ((s + 1.0) * t + s)
    }
    if t < 0.5 {
        0.5 * a(t * 2.0, tension)
    } else {
        0.5 * (o(t * 2.0 - 2.0, tension) + 2.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linear_interpolator() {
        let i = Interpolator::LINEAR;
        assert_eq!(i(0.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 5.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_accelerate_decelerate_interpolator() {
        let i = Interpolator::ACCELERATE_DECELERATE;
        assert_eq!((i(0.0) * 10.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 5.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_spring_overshoot_interpolator() {
        let i = Interpolator::SPRING_OVERSHOOT;
        assert_eq!((i(0.0) * 10.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 9.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_spring_bounce_interpolator() {
        let i = Interpolator::SPRING_BOUNCE;
        assert_eq!((i(0.0) * 10.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 9.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_gravity_bounce_interpolator() {
        let i = Interpolator::GRAVITY_BOUNCE;
        assert_eq!((i(0.0) * 10.0).abs().round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 10.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_bounce_interpolator() {
        let i = Interpolator::BOUNCE;
        assert_eq!((i(0.0) * 10.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 7.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_overshoot_interpolator() {
        let i = Interpolator::OVERSHOOT;
        assert_eq!((i(0.0) * 10.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 11.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_anticipate_interpolator() {
        let i = Interpolator::ANTICIPATE;
        assert_eq!((i(0.0) * 10.0).round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 1.0); 
        assert_eq!((i(0.5) * 10.0).round(), 1.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }

    #[test]
    fn test_anticipate_overshoot_interpolator() {
        let i = Interpolator::ANTICIPATE_OVERSHOOT;
        assert_eq!((i(0.0) * 10.0).abs().round(), 0.0);
        assert_eq!((i(0.5) * 10.0).round(), 5.0);
        assert_eq!((i(1.0) * 10.0).round(), 10.0);
    }
}
