use crate::obstacles::Obstacle;
use crate::session::SessionStatus;
use std::collections::HashMap;
use std::error::Error;
use std::time::Duration;
use std::{rc::Rc, time::SystemTime};
use uuid::Uuid;

pub struct SessionPhysicsConfig {
    pub initial_vel: f32,
    pub x_acc: f32,
    pub gravity: f32,
    pub jump_vel: f32,
}

pub struct AntiCheatConfig {
    pub physics: SessionPhysicsConfig,
    pub map: Vec<((f64, f64), Vec<Obstacle>)>,
    pub map_req_segment_length: usize,
}

pub enum PlayerEvent {
    PositionBroadcast {
        x: f64,
        y: f32,
    },
    Jump {
        x: f64,
        t: u128,
    },
    Duck {
        x: f64,
        t: u128,
    },
    GameOverBroadcast {
        x: f64,
        t: u128,
    },
    SpeedUp {
        x: f64,
        t: u128,
        speed_up_factor: f32,
    },
}

pub enum SessionEvent {
    CountdownStart,
    GameStart,
    GameEnd,
}

pub struct AntiCheat {
    config: AntiCheatConfig,
    timers: HashMap<Uuid, Rc<(SystemTime, fn(&mut Self))>>,
    players: HashMap<Uuid, Vec<(u128, PlayerEvent)>>,
    session_events: Vec<SessionEvent>,
}

impl AntiCheat {
    pub fn new(config: AntiCheatConfig) -> Self {
        Self {
            config,
            timers: HashMap::new(),
            players: HashMap::new(),
            session_events: Vec::new(),
        }
    }

    pub fn register_player(&mut self, id: Uuid) -> Result<(), &'static str> {
        if self.players.contains_key(&id) {
            return Err("Duplicate player");
        }

        self.players.insert(id, Vec::new());

        Ok(())
    }

    pub fn register_player_event(
        &mut self,
        id: Uuid,
        event: PlayerEvent,
        elapsed_time: u128,
    ) -> Result<(), &'static str> {
        if !self.players.contains_key(&id) {
            return Err("No such registered player");
        }

        self.players
            .get_mut(&id)
            .unwrap()
            .push((elapsed_time, event));

        Ok(())
    }

    fn set_timeout(&mut self, f: fn(&mut Self), duration: Duration) -> Uuid {
        let id = Uuid::new_v4();
        self.timers
            .insert(id, Rc::new((SystemTime::now() + duration, f)));

        id
    }

    fn exec_timers(&mut self) {
        let timers = self.timers.clone();
        for (id, rc) in timers {
            if SystemTime::now() > rc.0 {
                rc.1(self);
                self.timers.remove(&id);
            }
        }
    }

    fn get_nearest_event(&self, timestamp: u128, player_id: &Uuid) -> Option<&PlayerEvent> {
        let events = if let Some(evts) = self.players.get(player_id) {
            evts
        } else {
            return None;
        };

        let target = timestamp;

        let mut start = 0usize;
        let mut end = events.len();
        let find_middle = |start, end| f64::floor((start as f64 + end as f64) / 2.0) as usize;
        let mut middle = find_middle(start, end);

        let mut found = false;

        let mut nearest_dist = u128::MAX;
        let mut nearest_idx = Option::<usize>::None;

        let dist_to_idx = |v1: u128, idx: usize| {
            let v2 = events[idx].0;
            v1.max(v2) - v1.min(v2)
        };
        loop {
            if start > end {
                return None;
            }
            let middle_timestamp = events[middle].0;
            //prevents underflow
            nearest_dist = dist_to_idx(timestamp, middle);
            nearest_idx = Some(middle);

            if middle_timestamp == timestamp {
                break;
            }

            if timestamp > middle_timestamp {
                start = middle + 1;
                if dist_to_idx(timestamp, find_middle(start, end)) > nearest_dist {
                    break;
                }
            } else if middle >= 1 {
                end = middle - 1;
                if dist_to_idx(timestamp, find_middle(start, end)) > nearest_dist {
                    break;
                }
            } else {
                break;
            }
        }

        if let Some(idx) = nearest_idx {
            Some(&events[idx].1)
        } else {
            None
        }
    }

    ///main loop of the game play validator!
    pub fn run(&mut self) {
        self.exec_timers()
    }
}
