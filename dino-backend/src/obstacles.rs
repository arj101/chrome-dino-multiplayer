use rand::rngs::ThreadRng;
use rand::Rng;
use serde::Serialize;

#[derive(Clone, Copy, Serialize, PartialEq, Debug)]
pub enum Obstacle {
    Bird2,
    CactusSmall5,
    DinoGameOver1,
    Ground,
    CactusBig1,
    DinoDuck2,
    CactusBig2,
    Cloud,
    DinoGameOver2,
    DinoJump,
    CactusSmall2,
    CactusSmall4,
    DinoRun1,
    DinoDuck1,
    CactusSmall6,
    Bird1,
    CactusBigPair,
    DinoRun2,
    CactusSmall1,
    CactusSmall3,
    CactusBigSmall,
}

pub fn obstacle_size(obstacle: &Obstacle) -> (f32, f32) {
    match obstacle {
      Obstacle::Bird2 => (0.9787234 as f32, 0.85106385 as f32),
      Obstacle::Cloud => (0.9787234 as f32, 0.28723404 as f32),
      Obstacle::CactusSmall1 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoRun2 => (0.9361702 as f32, 1 as f32),
      Obstacle::DinoRun1 => (0.9361702 as f32, 1 as f32),
      Obstacle::Bird1 => (0.9787234 as f32, 0.85106385 as f32),
      Obstacle::CactusSmall6 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoGameOver2 => (0.9361702 as f32, 1 as f32),
      Obstacle::Ground => (25.531916 as f32, 0.25531915 as f32),
      Obstacle::CactusBig1 => (0.5319149 as f32, 1.0638298 as f32),
      Obstacle::CactusBig2 => (0.5319149 as f32, 1.0638298 as f32),
      Obstacle::CactusSmall3 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::CactusSmall5 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoGameOver1 => (0.9361702 as f32, 1 as f32),
      Obstacle::CactusSmall2 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoDuck2 => (1.2553191 as f32, 0.63829786 as f32),
      Obstacle::DinoJump => (0.9361702 as f32, 1 as f32),
      Obstacle::CactusBigPair => (1.0425532 as f32, 1.0638298 as f32),
      Obstacle::CactusBigSmall => (1.5957447 as f32, 1.0638298 as f32),
      Obstacle::CactusSmall4 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoDuck1 => (1.2553191 as f32, 0.63829786 as f32),
    }
}

pub fn random_cactus(rng: &mut ThreadRng) -> Obstacle {
    match rng.gen_range(0..=9) {
        0 => Obstacle::CactusSmall5,
        1 => Obstacle::CactusBig1,
        2 => Obstacle::CactusBig2,
        3 => Obstacle::CactusSmall2,
        4 => Obstacle::CactusSmall4,
        5 => Obstacle::CactusSmall6,
        6 => Obstacle::CactusBigPair,
        7 => Obstacle::CactusSmall1,
        8 => Obstacle::CactusSmall3,
        9 => Obstacle::CactusBigSmall,
        _ => unreachable!(),
    }
}

pub const TALLEST_CACTUS: Obstacle = Obstacle::CactusBig1;
