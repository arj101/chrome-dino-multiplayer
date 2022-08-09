use crate::math;

use crate::obstacles::Obstacle;
use crate::obstacles::{obstacle_size, random_cactus, TALLEST_CACTUS};
use rand::prelude::*;
use rand::rngs::ThreadRng;

pub struct GameMap {
    map: Vec<((f64, f64), Vec<Obstacle>)>,
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

    fn random_cactus(&mut self) -> Obstacle {
        random_cactus(&mut self.rng)
    }

    fn add_random_cactus(&mut self, p_grouping: f32) {
        let is_grouping = self.rng.gen::<f32>() <= p_grouping;
        let x_vel = self.vel_at_pos(self.pos);

        let jump_distance = math::jump_distance_c_acc(x_vel, self.acc, self.jump_vel, self.g);
        let margin = jump_distance / 5.0 + self.rng.gen::<f32>() * jump_distance / 2.0;

        let (obs, x_at_height) = if is_grouping {
            let range = math::x_above_jump_height_c_acc(
                self.vel_at_pos(self.pos + margin as f64),
                self.acc,
                obstacle_size(&TALLEST_CACTUS).1,
                self.jump_vel,
                self.g,
            );

            let obss = self.gen_obs_group(range);

            (obss, range.0)
        } else {
            let obs = self.random_cactus();

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

        self.map.push(((obs_pos, 0.0), obs));
        self.pos += (margin + jump_distance) as f64;
    }

    fn add_bird(&mut self) {
        let x_vel = self.vel_at_pos(self.pos);

        let jump_distance = math::jump_distance_c_acc(x_vel, self.acc, self.jump_vel, self.g);
        let margin = jump_distance / 5.0 + self.rng.gen::<f32>() * jump_distance / 5.0;

        let bird_y = 0.5 + self.rng.gen::<f32>() / 1.5;
        let clearance_height = obstacle_size(&Obstacle::Bird1).1 + bird_y;
        let x_at_height = math::x_above_jump_height_c_acc(
            x_vel,
            self.acc,
            clearance_height,
            self.jump_vel,
            self.g,
        )
        .0;

        let bird_x = self.pos + (margin + x_at_height) as f64;

        self.map
            .push(((bird_x, bird_y as f64), [Obstacle::Bird1].to_vec()));
        self.pos += (margin + jump_distance) as f64;
    }

    fn gen_map(&mut self, len: usize) {
        let new_len = self.map.len() + len;
        let mut x_vel = self.vel_at_pos(self.pos);
        while self.map.len() < new_len {
            let add_obs = self.rng.gen::<f32>() > 0.25;
            let jump_distance = math::jump_distance_c_acc(x_vel, self.acc, self.jump_vel, self.g);
            let margin = jump_distance / 5.0 + self.rng.gen::<f32>() * jump_distance / 2.0;

            if !add_obs {
                self.pos += (margin + jump_distance) as f64;
                x_vel = self.vel_at_pos(self.pos);
                continue;
            }
            let is_cactus = self.rng.gen::<f32>() > 0.5;

            if is_cactus {
                self.add_random_cactus(0.5);
            } else {
                self.add_bird();
            }
            x_vel = self.vel_at_pos(self.pos)
        }
        self.pos +=
            (math::jump_distance_c_acc(x_vel, self.acc, self.jump_vel, self.g) / 2.0) as f64;
    }

    fn gen_obs_group(&mut self, range: (f32, f32)) -> Vec<Obstacle> {
        let mut group: Vec<Obstacle> = vec![self.random_cactus()];
        let mut curr_pos = range.0 + obstacle_size(&group[0]).0;

        while curr_pos < range.1 {
            let cactus = self.random_cactus();
            if curr_pos + obstacle_size(&cactus).0 > range.1 {
                break;
            }
            curr_pos += obstacle_size(&cactus).0;
            group.push(cactus);
            if self.rng.gen::<f32>() > 0.4 {
                break;
            }
        }

        group
    }

    pub fn get_map(&mut self, from: usize, to: usize) -> &[((f64, f64), Vec<Obstacle>)] {
        if to >= self.map.len() {
            self.gen_map(to + 1 - self.map.len())
        }

        &self.map[from..to + 1]
    }
}
