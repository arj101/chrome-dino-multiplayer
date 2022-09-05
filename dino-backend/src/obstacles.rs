use rand::rngs::ThreadRng;
use rand::Rng;
use serde::Serialize;

#[derive(Clone, Copy, Serialize, PartialEq, Debug)]
pub enum Obstacle {
    Bird1,
    Bird2,
    CactusBig1,
    CactusBig2,
    CactusBigPair,
    CactusBigSmall,
    CactusSmall1,
    CactusSmall2,
    CactusSmall3,
    CactusSmall4,
    CactusSmall5,
    CactusSmall6,
    Cloud,
    DinoDuck1,
    DinoDuck2,
    DinoGameOver1,
    DinoGameOver2,
    DinoJump,
    DinoRun1,
    DinoRun2,
    Ground,
}

pub fn obstacle_size(obstacle: &Obstacle) -> (f32, f32) {
    match obstacle {
      Obstacle::DinoGameOver2 => (0.9361702 as f32, 1 as f32),
      Obstacle::CactusSmall1 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoRun2 => (0.9361702 as f32, 1 as f32),
      Obstacle::CactusSmall3 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoGameOver1 => (0.9361702 as f32, 1 as f32),
      Obstacle::DinoRun1 => (0.9361702 as f32, 1 as f32),
      Obstacle::DinoJump => (0.9361702 as f32, 1 as f32),
      Obstacle::CactusSmall6 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::CactusBigSmall => (1.5957447 as f32, 1.0638298 as f32),
      Obstacle::DinoDuck1 => (1.2553191 as f32, 0.63829786 as f32),
      Obstacle::CactusSmall5 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::DinoDuck2 => (1.2553191 as f32, 0.63829786 as f32),
      Obstacle::CactusBigPair => (1.0425532 as f32, 1.0638298 as f32),
      Obstacle::Ground => (25.531916 as f32, 0.25531915 as f32),
      Obstacle::CactusBig2 => (0.5319149 as f32, 1.0638298 as f32),
      Obstacle::CactusSmall2 => (0.3617021 as f32, 0.7446808 as f32),
      Obstacle::Cloud => (0.9787234 as f32, 0.28723404 as f32),
      Obstacle::Bird2 => (0.9787234 as f32, 0.85106385 as f32),
      Obstacle::CactusBig1 => (0.5319149 as f32, 1.0638298 as f32),
      Obstacle::Bird1 => (0.9787234 as f32, 0.85106385 as f32),
      Obstacle::CactusSmall4 => (0.3617021 as f32, 0.7446808 as f32),
    }
}

pub fn random_cactus(rng: &mut ThreadRng) -> Obstacle {
    match rng.gen_range(0..=9) {
        0 => Obstacle::CactusBig1,
        1 => Obstacle::CactusBig2,
        2 => Obstacle::CactusBigPair,
        3 => Obstacle::CactusBigSmall,
        4 => Obstacle::CactusSmall1,
        5 => Obstacle::CactusSmall2,
        6 => Obstacle::CactusSmall3,
        7 => Obstacle::CactusSmall4,
        8 => Obstacle::CactusSmall5,
        9 => Obstacle::CactusSmall6,
        _ => unreachable!(),
    }
}

pub const TALLEST_CACTUS: Obstacle = Obstacle::CactusBig1;
