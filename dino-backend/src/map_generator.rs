use crate::math;

use rand::prelude::*;
use rand::rngs::ThreadRng;
use serde::Serialize;

// sizes are relative to the dino. 1 unit = 1 dino height

#[derive(Clone, Copy, Serialize, PartialEq, Debug)]
pub enum CactusType {
    Short,
    Tall,
}


#[derive(Clone, Copy, Serialize, Debug)]
pub enum Obstacle {
    Cactus(CactusType),
    Padding,
}

pub fn obstacle_size(obs: &Obstacle) -> (f32, f32) {
    match obs {
        &Obstacle::Cactus(CactusType::Short) => (0.25, 0.6),
        &Obstacle::Cactus(CactusType::Tall) => (0.4, 0.9),
        &Obstacle::Padding => (0.0, 0.0),
    }
}

pub fn tallest_cactus() -> CactusType {
    CactusType::Tall
}

pub struct GameMap {
    map: Vec<(f64, Vec<Obstacle>)>,
    pos: f64,
    u: f32,
    acc: f32,
    g: f32,
    jump_vel: f32,
    rng: ThreadRng,
}

impl GameMap {
    pub fn new(initial_x_vel: f32, x_acc: f32, gravity: f32, jump_vel: f32) -> Self {
        Self {
            map: vec![],
            pos: 4.0, //initial padding
            rng: thread_rng(),
            u: initial_x_vel,
            acc: x_acc,
            g: gravity,
            jump_vel,
        }
    }

    fn vel_at_pos(&self, x: f64) -> f32 {
        //v^2 = u^2 + 2as
        (self.u.powi(2) + 2.0 * self.acc * x as f32).sqrt() as f32
    }

    fn random_cactus(&mut self) -> CactusType {
        match self.rng.gen_range(0..=1) {
            0 => CactusType::Short,
            _ => CactusType::Tall,
        }
    }

    fn gen_map(&mut self, len: usize) {
        let new_len = self.map.len() + len;
        while self.map.len() < new_len {
            let jump_distance = math::jump_distance_c_acc(self.u, self.acc, self.jump_vel, self.g);
            let margin = 0.5 + self.rng.gen::<f32>() * 3.0;

            let is_grouping = self.rng.gen::<f32>() > 0.5;

            let (obs, x_at_height) = if is_grouping {
                let range = math::x_above_jump_height_c_acc(
                    self.vel_at_pos(self.pos + margin as f64),
                    self.acc,
                    obstacle_size(&Obstacle::Cactus(tallest_cactus())).1,
                    self.jump_vel,
                    self.g
                );

                let obss = self.gen_obs_group(range);

                (obss, range.0)
            } else {
                let obs = Obstacle::Cactus(self.random_cactus());
            
                let x_at_height = math::x_above_jump_height_c_acc(
                    self.vel_at_pos(self.pos + margin as f64),
                    self.acc,
                    obstacle_size(&obs).1,
                    self.jump_vel,
                    self.g,
                )
                .0;

                (vec![obs], x_at_height)
            };

            let obs_pos = self.pos + (x_at_height + margin) as f64;

            self.map.push((obs_pos, obs));
            self.pos += (margin + jump_distance) as f64;
        }
        self.pos +=
            (math::jump_distance_c_acc(self.u, self.acc, self.jump_vel, self.g) / 2.0) as f64;
    }

    fn gen_obs_group(&mut self, range: (f32, f32)) -> Vec<Obstacle> {
        let mut group: Vec<Obstacle> = vec![Obstacle::Cactus(self.random_cactus())];
        let mut curr_pos = range.0 + obstacle_size(&group[0]).0;

        while curr_pos < range.1 {
            let cactus = Obstacle::Cactus(self.random_cactus());
            if curr_pos + obstacle_size(&cactus).0 > range.1 { break }
            curr_pos +=  obstacle_size(&cactus).0;
            group.push(cactus);
            if self.rng.gen::<f32>() > 0.4 { break }
        }

        group
    }

    pub fn get_map(&mut self, from: usize, to: usize) -> &[(f64, Vec<Obstacle>)] {
        if to >= self.map.len() {
            self.gen_map(to + 1 - self.map.len())
        }

        &self.map[from..to + 1]
    }
}
