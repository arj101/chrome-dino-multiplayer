/// `uy` - y axis velocity, set it to a high value to simulate high acceleration
///
/// `g`  - gravity, obviously (negative sign is not implicit) (constant)
///
/// **Note: this function might return negative value as its unbounded**
pub fn jump_time(uy: f32, g: f32) -> f32 {
    // s = ut + 1/2at^2
    // s = 0 (displacement when you reach the ground again is 0)
    // u = uy
    // t = ?
    // a = g
    // 0 = uy * t + 1/2gt^2
    // -1/2g * t * t = uy * t
    // -1/2g  * t = ( uy * t ) / t =  uy
    // t = uy / (-1/2g)
    // t =
    -(2.0 * uy) / g
}

/// **Calculates time reaching and leaving height `h`**
///
/// `uy` - y axis velocity
///
/// `g` - gravity (sign is not implicit) (constant)
///
/// **Note: this function is unbounded.**
/// **Returns `NaN` if `h` is above max height.**
pub fn jump_time_above_height(h: f32, uy: f32, g: f32) -> (f32, f32) {
    // 1/2at^2 + ut - s = 0
    // 1/2gt^2 + uy*t - h = 0
    //
    // [refer to `jump_height_at_x` for explanation]
    //
    //       -uy +- sqrt(uy^2 + 2 * g * h)
    // t = ----------------------------------
    //                   g
    //

    let t1 = (-uy + (uy.powi(2) + 2.0 * g * h).sqrt()) / g;
    let t2 = (-uy - (uy.powi(2) + 2.0 * g * h).sqrt()) / g;

    (t1, t2)
}

/// **Calculates x position reaching and leaving height `h` during constant velocity
///
///  Initial x position is assumed to be zero
///
/// `ux` - x velocity
///
/// `uy` - y velocity
///
/// `g` - gravity (sign is not implicit) (constant)
pub fn x_above_jump_height_c_v(ux: f32, h: f32, uy: f32, g: f32) -> (f32, f32) {
    let (t1, t2) = jump_time_above_height(h, uy, g);

    (t1 * ux, t2 * ux)
}

/// **Calculates x position reaching and leaving height `h` during constant acceleration
///
///  Initial x position is assumed to be zero
///
/// `ux` - initial x velocity
///
/// `ax` - x acceleration (constant)
///
/// `uy` - y velocity
///
/// `g` - gravity (sign is not implicit) (constant)
pub fn x_above_jump_height_c_acc(ux: f32, ax: f32, h: f32, uy: f32, g: f32) -> (f32, f32) {
    let (t1, t2) = jump_time_above_height(h, uy, g);

    let s = |t: f32| ux * t + 0.5 * ax * t.powi(2);

    (s(t1), s(t2))
}

/// **Calculates jump height at time `t`**
///
/// `uy` - y axis velocity
///
/// `g`  - gravity (sign is not implicit) (constant)
///
/// **Note: this function might return negative value as its unbounded**
pub fn jump_height_at_t(t: f32, uy: f32, g: f32) -> f32 {
    // s = ut + 1/2at^2
    uy * t + 0.5 * g * t.powi(2)
}

/// `uy` - y axis velocity, set it to a high value to simulate high acceleration
///
/// `g`  - gravity (negative sign is not implicit) (constant)
pub fn jump_height(uy: f32, g: f32) -> f32 {
    let t = jump_time(uy, g) * 0.5;
    jump_height_at_t(t, uy, g)
}

/// **Calculates jump height at an x position during constant acceleration in both axes**
///
/// `px` - x position, initial position is assumed to be zero.
///
/// `ux` - intial velocity in the x axis
///
/// `ax` - x axis acceleration (constant)
///
/// `uy` - y axis velocity
///
/// `g`  - gravity (negative sign is not implicit) (constant)
///
/// **Note: this function might return negative value as its unbounded**
pub fn jump_height_at_x(px: f32, ux: f32, ax: f32, uy: f32, g: f32) -> f32 {
    // s = 1/2at^2 + ut
    // s = px
    // u = ux
    // t = ?
    // a = ax
    //
    // 2nd degree equation:  ax^2 + bx + c = 0
    //
    //                             -b +- sqrt(b^2 - 4ac)
    //                       x = -------------------------
    //                                      2a
    //
    // 1/2at^2 + ut - s = 0
    //
    //      -u + sqrt(u^2 + 2as)
    // t = ----------------------
    //              a

    let t = (-ux + (ux.powi(2) + 2.0 * ax * px).sqrt()) / ax;
    jump_height_at_t(t, uy, g)
}

/// Same as `jump_height_at_x` but with constant velocity
pub fn jump_height_at_x_c_v(px: f32, ux: f32, uy: f32, g: f32) -> f32 {
    let t = px / ux;
    jump_height_at_t(t, uy, g)
}

/// **Calculates jump distance during constant velocity in the x axis**
///
/// `ux` - x axis velocity (constant)
///
/// `uy` - y axis velocity, set it to a high value to simulate high acceleration
///
/// `g`  - gravity (negative sign is not implicit) (constant)
///
/// **Note: this function might return negative value as its unbounded**
pub fn jump_distance_c_v(ux: f32, uy: f32, g: f32) -> f32 {
    // distance = speed * time
    ux * jump_time(uy, g)
}

/// **Calculates jump distance during constant acceleration in both axes**
///
/// `ux` - initial x axis velocity
///
/// `ax` - x axis acceleration (constant)
///
/// `uy` - y axis velocity, set it to a high value to simulate high acceleration
///
/// `g`  - gravity (negative sign is not implicit) (constant)
///
/// **Note: this function might return negative value as its unbounded**
pub fn jump_distance_c_acc(ux: f32, ax: f32, uy: f32, g: f32) -> f32 {
    // s = ut + 1/2at^2
    let t = jump_time(uy, g);
    // u = ux
    // a = ax
    // s =
    ux * t + 0.5 * ax * t * t
}

#[test]
fn jump_test() {
    // this test will always pass LOL
    let uy = 20.0; //y velocity
    let g = -10.0; //gravity
    let ux = 5.0; //x velocity
    let ax = 2.0; //acceleration
    println!("jump time: {}", jump_time(uy, g));
    println!("jump height: {}", jump_height(uy, g));
    println!(
        "jump height at x: {} ",
        jump_height_at_x(5.0, ux, ax, uy, g)
    );
    println!(
        "jump distance at constant vel: {}",
        jump_distance_c_v(ux, uy, g)
    );
    println!(
        "jump distance at constant acc: {}",
        jump_distance_c_acc(ux, ax, uy, g)
    );
    println!(
        "jump time above height: {:?}",
        jump_time_above_height(10.0, uy, g)
    );
    println!(
        "jump x above height constant vel: {:?}",
        x_above_jump_height_c_v(ux, 10.0, uy, g)
    );
    println!(
        "jump x above height constant acc: {:?}",
        x_above_jump_height_c_acc(ux, ax, 10.0, uy, g)
    );
    assert!(true) //e
}

#[test]
fn jump_graph_c_acc() {
    use std::io::prelude::*;

    let uy = 20.0;
    let g = -10.0;
    let ux = 5.0;
    let ax = 2.0;
    let distance = jump_distance_c_acc(ux, ax, uy, g);
    let mut file = std::fs::File::create("graph_c_acc.csv").unwrap();
    let mut content = "x, y, h\n".to_owned();
    let ch = 10.0;
    let (xh1, xh2) = x_above_jump_height_c_acc(ux, ax, ch, uy, g);
    for i in 0..101 {
        let x = distance * (i as f32 / 100.0);
        let h = jump_height_at_x(x, ux, ax, uy, g);
        content.push_str(&format!(
            "{}, {}, {}\n",
            x,
            h,
            if x >= xh1 && x <= xh2 { ch } else { 0.0 }
        ));
    }
    file.write_all(content.as_bytes());
    assert!(true)
}

#[test]
fn jump_graph_c_v() {
    use std::io::prelude::*;

    let uy = 20.0;
    let g = -10.0;
    let ux = 5.0;
    let ax = 2.0;
    let distance = jump_distance_c_v(ux, uy, g);
    let mut file = std::fs::File::create("graph_c_v.csv").unwrap();
    let mut content = "x, y, h\n".to_owned();
    let ch = 15.0;
    let (xh1, xh2) = x_above_jump_height_c_v(ux, ch, uy, g);
    for i in 0..101 {
        let x = distance * (i as f32 / 100.0);
        let h = jump_height_at_x_c_v(x, ux, uy, g);
        content.push_str(&format!(
            "{}, {}, {}\n",
            x,
            h,
            if x >= xh1 && x <= xh2 { ch } else { 0.0 }
        ));
    }
    file.write_all(content.as_bytes());
    assert!(true)
}
