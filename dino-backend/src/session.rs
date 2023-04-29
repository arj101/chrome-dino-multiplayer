use crate::config_options::SessionConfig;
use crate::map_generator::GameMap;
use crate::session_exec::{GameEvent, RxData, TransmissionQueue, TxData};

use futures_channel::mpsc::UnboundedSender;
use tokio_tungstenite::tungstenite::protocol::Message;

use serde::{Deserialize, Serialize};

use uuid::Uuid;

use rustc_hash::FxHashMap;
use std::net::SocketAddr;
use std::rc::Rc;
use std::sync::{Arc, Mutex};
use std::time::{self, Duration, Instant, SystemTime};

pub const X_ACC: f32 = 0.3;
pub const INITIAL_X_VEL: f32 = 8.0;
pub const GRAVITY: f32 = -60.0;
pub const JUMP_VEL: f32 = 15.0;

#[derive(PartialEq)]
pub enum SessionStatus {
    Uninit,
    Waiting {
        start_time: SystemTime,
        timeout: Uuid,
        duration: Duration,
    },
    Countdown {
        start: SystemTime,
        duration: Duration,
    },
    Active {
        start_time: Instant,
        max_duration: Duration,
    },
    Ended,
}

pub struct Session {
    session_id: Uuid,
    session_name: String,
    host_id: Uuid,
    player_data: FxHashMap<Uuid, PlayerData>,
    game_data: GameData,
    status: SessionStatus,
    timers: FxHashMap<Uuid, Rc<(SystemTime, fn(&mut Self, &mut TransmissionQueue), bool)>>,
    has_finished: bool,
    config: SessionConfig,
}

impl Session {
    pub fn new(session_name: String, config: SessionConfig) -> Self {
        Self {
            session_id: Uuid::new_v4(),
            session_name,
            host_id: Uuid::nil(),
            player_data: FxHashMap::default(),
            game_data: GameData {
                map: GameMap::new(INITIAL_X_VEL, X_ACC, GRAVITY, JUMP_VEL),
                sync_score: 0,
            },
            status: SessionStatus::Uninit,
            timers: FxHashMap::default(),
            has_finished: false,
            config,
        }
    }

    /// Returns `Err` if the username is invalidated
    pub fn with_host(
        mut self,
        tx: &mut TransmissionQueue,
        username: String,
        addr: SocketAddr,
        wait_time: u64,
    ) -> Result<Self, ()> {
        if username.len() > self.config.max_username_len {
            return Err(());
        }

        let host_id = Uuid::new_v4();
        self.host_id = host_id;

        self.player_data
            .insert(host_id, PlayerData::new(host_id, username, addr));

        tx.send_to_addr(
            addr,
            TxData::SessionCreationResponse {
                creation_succeeded: true,
                session_id: Some(self.session_id),
            },
        );

        tx.send_to_addr(
            addr,
            TxData::UserCreationResponse {
                creation_succeeded: true,
                user_id: Some(host_id),
            },
        );

        //5 minutes max wait time
        let id = self.set_timeout(
            |s, tx| {
                s.launch_game(tx);
                let _ = s.game_data.map.get_map(0, 99);
            },
            Duration::from_secs(wait_time), //TODO: change wait time back to 5 minutes
        );
        self.status = SessionStatus::Waiting {
            start_time: SystemTime::now(),
            timeout: id,
            duration: Duration::from_secs(wait_time),
        };

        Ok(self)
    }

    pub fn id(&self) -> &Uuid {
        &self.session_id
    }

    pub fn name(&self) -> &str {
        &self.session_name
    }

    pub fn status(&self) -> &SessionStatus {
        &self.status
    }

    fn set_timeout(
        &mut self,
        f: fn(&mut Self, &mut TransmissionQueue),
        duration: Duration,
    ) -> Uuid {
        let id = Uuid::new_v4();
        self.timers
            .insert(id, Rc::new((SystemTime::now() + duration, f, false)));
        id
    }

    fn set_interval(
        &mut self,
        f: fn(&mut Self, &mut TransmissionQueue),
        duration: Duration,
    ) -> Uuid {
        let id = Uuid::new_v4();
        self.timers
            .insert(id, Rc::new((SystemTime::now() + duration, f, true)));
        id
    }

    fn exec_timers(&mut self, tx: &mut TransmissionQueue) {
        let timers = self.timers.clone();
        for (id, rc) in timers {
            if SystemTime::now() > rc.0 {
                rc.1(self, tx);
                if !rc.2 {
                    self.timers.remove(&id);
                }
            }
        }
    }

    fn broadcast(
        &mut self,
        tx: &mut TransmissionQueue,
        rx_addr: SocketAddr,
        id: Uuid,
        data: TxData,
    ) {
        //FIXME: Not works for no reason :(
        self.player_data.values().for_each(|p| {
            // println!("Sending broadcast to {}", p.addr);
            // if p.id == id {
            //     return;
            // }
            tx.send_to_addr(p.addr, data.clone());
        })
    }

    fn emit(&mut self, tx: &mut TransmissionQueue, data: TxData) {
        self.player_data
            .values()
            .for_each(|p| tx.send_to_addr(p.addr, data.clone()))
    }

    pub fn host_addr(&self) -> &SocketAddr {
        &self.player_data.get(&self.host_id).unwrap().addr
    }

    pub fn on_game_event(
        &mut self,
        tx: &mut TransmissionQueue,
        addr: SocketAddr,
        id: &Uuid,
        event: GameEvent,
    ) {
        let username = if let Some(player) = self.player_data.get_mut(&id) {
            player.username.clone()
        } else {
            return;
        };

        self.broadcast(tx, addr, *id, TxData::GameEvent { username, event });
    }

    #[inline(always)]
    pub fn on_broadcast_req(
        &mut self,
        tx: &mut TransmissionQueue,
        addr: SocketAddr,
        id: Uuid,
        pos_y: f32,
        pos_x: f32,
        tick: u64,
    ) {
        let (username, tick) = if let Some(player) = self.player_data.get_mut(&id) {
            if addr != player.addr  { //|| tick < player.curr_tick
                return;
            }
            player.curr_tick += 1;
            (player.username.clone(), player.curr_tick)
        } else {
            return;
        };

        self.broadcast(
            tx,
            addr,
            id,
            TxData::PlayerDataBroadcast {
                username,
                pos_y,
                pos_x,
                tick,
            },
        )
    }

    pub fn on_recv(&mut self, tx: &mut TransmissionQueue, addr: SocketAddr, rx_data: RxData) {
        match rx_data {
            RxData::ValidationData {
                session_id,
                user_id,
                pos_x,
                score,
                timestamp,
                move_dir,
            } => {
                if let None = self.player_data.get(&user_id) {
                    return;
                };
                //TODO: validation code
            }
            RxData::LaunchGame { user_id, .. } => self.launch_game_req(tx, addr, user_id),
            RxData::Map { user_id, index, .. } => self.map_req(tx, addr, user_id, index),
            // RxData::GameOver { user_id, .. } => self.user_game_over(tx, user_id, addr),
            _ => unreachable!(
                "[session] Every other conditions should be already handled in `SessionExecutor`"
            ),
        }
    }

    pub fn user_game_over(
        &mut self,
        tx: &mut TransmissionQueue,
        user_id: Uuid,
        addr: SocketAddr,
    ) -> Result<usize, ()> {
        let score = if let SessionStatus::Active { start_time, .. } = self.status {
            self.curr_score(start_time)
        } else {
            return Err(());
        };

        let username = if let Some(player) = self.player_data.get_mut(&user_id) {
            if addr != player.addr {
                return Err(());
            }
            player.score = score;
            player.username.clone()
        } else {
            return Err(());
        };

        tx.send_to_addr(
            addr,
            TxData::UserGameOver {
                score: score,
                user_id,
            },
        );
        self.broadcast(
            tx,
            addr,
            user_id,
            TxData::UserGameOverBroadcast { username, score },
        );

        let active_players = self.player_data.values().filter(|v| v.score == 0).count();
        Ok(active_players)
    }

    fn map_req(&mut self, tx: &mut TransmissionQueue, addr: SocketAddr, user_id: Uuid, idx: u32) {
        if let None = self.player_data.get(&user_id) {
            println!(
                "[sesson] map requested by unknown user `{}` (addr: `{}`)",
                user_id, addr
            );
            println!("[session] still sending map bc idc")
            // return;
        }

        match self.status {
            _ => {
                let idx = idx as usize;
                let (from, to) = (idx as usize * 100, (idx as usize + 1) * 100 - 1); //0-99, 100-199, ..

                let map = self.game_data.map.get_map(from, to).to_vec();
                tx.send_to_addr(addr, TxData::Map { map })
            }
            _ => {
                println!(
                    "[session] map requested by `{}`(username: `{}`, addr: {}) while session is not active.",
                    user_id, self.player_data.get(&user_id).unwrap().username, addr
                )
            }
        }
    }

    fn launch_game_req(&mut self, tx: &mut TransmissionQueue, addr: SocketAddr, user_id: Uuid) {
        let id_mismatch = user_id != self.host_id;
        let addr_mismatch = addr != self.player_data.get(&self.host_id).unwrap().addr;
        if id_mismatch || addr_mismatch {
            println!(
                "[session] Unauthorized game launch request from `{}` (user id: `{}`).\nID mismatch: {}, address mismatch: {}",
                addr, user_id, id_mismatch, addr_mismatch,
            );
            return;
        }

        self.launch_game(tx);
    }

    fn launch_game(&mut self, tx: &mut TransmissionQueue) {
        if let SessionStatus::Waiting { timeout, .. } = self.status {
            self.timers.remove(&timeout);
            let duration = Duration::from_secs(4);

            self.status = SessionStatus::Countdown {
                start: SystemTime::now(),
                duration,
            };

            self.emit(
                tx,
                TxData::GameCountdownStart {
                    duration: duration.as_secs() as u32,
                },
            );

            self.set_timeout(
                |s, tx| {
                    s.emit(tx, TxData::GameStart);
                    s.status = SessionStatus::Active {
                        start_time: Instant::now(),
                        max_duration: Duration::from_secs(30 * 60),
                    };
                    println!("[session] Game just started!");
                },
                Duration::from_secs(3),
            );
        }
    }

    pub fn create_user(
        &mut self,
        tx: &mut TransmissionQueue,
        addr: SocketAddr,
        username: String,
    ) -> Result<(), ()> {
        if !self.host_id.is_nil() {
            match self.status {
                SessionStatus::Waiting { .. } => (),
                _ => return Err(()),
            }
        }

        if self.player_data.keys().len() >= self.config.max_users
            || username.len() > self.config.max_username_len
            || self.username_exists(&username)
        {
            tx.send_to_addr(
                addr,
                TxData::UserCreationResponse {
                    creation_succeeded: false,
                    user_id: None,
                },
            );
            return Err(());
        }

        let id = Uuid::new_v4();
        if self.host_id.is_nil() {
            self.host_id = id;
            self.status = SessionStatus::Waiting {
                start_time: SystemTime::now(),
                timeout: Uuid::nil(),
                duration: Duration::MAX,
            };
        };
        self.player_data.insert(
            id,
            PlayerData {
                id,
                username,
                score: 0,
                addr,
                status: PlayerStatus::Connected,
                curr_tick: 0,
            },
        );
        tx.send_to_addr(
            addr,
            TxData::UserCreationResponse {
                creation_succeeded: true,
                user_id: Some(id),
            },
        );

        Ok(())
    }

    fn username_exists(&self, username: &str) -> bool {
        if let Some(_) = self.player_data.values().find(|d| &d.username == username) {
            true
        } else {
            false
        }
    }

    pub fn get_leaderboard(&self) -> Vec<(String, u64)> {
        let mut leaderboard: Vec<(String, u64)> = self
            .player_data
            .keys()
            .map(|k| {
                let player_data = self.player_data.get(k).unwrap();

                (
                    player_data.username.clone(),
                    if (player_data.score > 0) {
                        player_data.score
                    } else {
                        self.game_data.sync_score
                    },
                )
            })
            .collect();

        leaderboard.sort_by_key(|d| d.1);
        leaderboard
    }

    pub fn get_status(&self) -> (&'static str, i64) {
        match self.status {
            SessionStatus::Waiting {
                start_time,
                duration,
                ..
            } => (
                "Waiting",
                duration.as_secs() as i64
                    - SystemTime::elapsed(&start_time).unwrap().as_secs() as i64,
            ),
            SessionStatus::Active { start_time, .. } => {
                ("Active", Instant::elapsed(&start_time).as_secs() as i64)
            }
            SessionStatus::Countdown { start, duration } => (
                "Countdown",
                duration.as_secs() as i64 - SystemTime::elapsed(&start).unwrap().as_secs() as i64,
            ),
            SessionStatus::Uninit => ("Uninit", 0),
            SessionStatus::Ended => ("Ended", 0),
        }
    }

    pub fn get_usernames(&self) -> Vec<String> {
        self.player_data
            .keys()
            .map(|k| self.player_data.get(k).unwrap().username.clone())
            .collect()
    }

    pub fn get_host_addr(&self) -> Option<SocketAddr> {
        if let Some(player) = &self.player_data.get(&self.host_id) {
            Some(player.addr)
        } else {
            None
        }
    }

    fn curr_score(&self, start_time: Instant) -> u64 {
        let elapsed = start_time.elapsed().as_secs_f64();
        ((INITIAL_X_VEL as f64 * elapsed) + (0.5 * X_ACC as f64 * elapsed.powi(2))).round() as u64
    }

    pub fn game_loop(&mut self, tx: &mut TransmissionQueue) -> bool {
        self.exec_timers(tx);
        if self.has_finished {
            return true;
        }
        if let SessionStatus::Active {
            start_time,
            max_duration,
        } = self.status
        {
            self.game_data.sync_score = self.curr_score(start_time);
            if start_time.elapsed() > max_duration {
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn login_user(
        &mut self,
        tx: &mut TransmissionQueue,
        addr: SocketAddr,
        user_id: Uuid,
    ) -> Result<(), ()> {
        if let Some(player) = self.player_data.get_mut(&user_id) {
            player.connect();
            player.addr = addr;
            tx.send_to_addr(addr, TxData::LoginResponse { succeeded: true });
            return Ok(());
        }
        tx.send_to_addr(addr, TxData::LoginResponse { succeeded: false });
        Err(())
    }

    pub fn on_user_con_close(&mut self, addr: SocketAddr) -> bool {
        let user_id = if let Some(id) = self
            .player_data
            .values()
            .filter(|p| p.addr == addr)
            .map(|p| p.id)
            .next()
        {
            id
        } else {
            return false;
        };

        let start_time = match self.status {
            SessionStatus::Active { start_time, .. } => start_time,
            SessionStatus::Countdown { .. } | SessionStatus::Waiting { .. } => {
                let player_data = self.player_data.get_mut(&user_id).unwrap();
                println!(
                    "[session] `{}` (id: `{}`, addr: `{}`) just closed connection.",
                    player_data.username, player_data.id, player_data.addr
                );
                player_data.disconnect();
                return false;
            }
            _ => return false,
        };

        let curr_score = self.curr_score(start_time);
        if let Some(player) = self.player_data.get_mut(&user_id) {
            player.score = curr_score;
            println!(
                "[session] `{}` (id: `{}`, addr: `{}`) just closed connection. Final score: `{}`",
                player.username, player.id, player.addr, player.score
            );
            player.disconnect();
            //   self.set_timeout(
            //     |s, tx| {
            //       if let Some(player) = s.player_data.get_mut(&user_id) {
            //         println!("[session] One minute past last connection from `{}`(`{}`), removing user...", player.addr, player.id);
            //       s.player_data.remove(&user_id);
            // }

            //}
            //, Duration::from_secs(60)
            //);
            return self.player_data.is_empty();
        }

        false
    }

    pub fn shutdown(&mut self, tx: &mut TransmissionQueue) {
        self.player_data
            .values()
            .for_each(|player| tx.close_con(player.addr));
        self.has_finished = true;
        println!("[session] `{}` shutting down...", self.id());
    }
}

pub struct GameData {
    map: GameMap,
    sync_score: u64, //score of every player is same until they lose. This will be the highest score.
}

pub enum PlayerStatus {
    Connected,
    Disconnected,
}

pub struct PlayerData {
    id: Uuid,
    username: String,
    score: u64, //when the player loses, this score gets out of sync w/ sync_score
    addr: SocketAddr,
    status: PlayerStatus,
    curr_tick: u64, //a monotonic counter (counted by client and server separately) to keep chronological order of broadcast requests
}

impl PlayerData {
    fn new(id: Uuid, username: String, addr: SocketAddr) -> Self {
        Self {
            id,
            username,
            addr,
            score: 0,
            status: PlayerStatus::Connected,
            curr_tick: 0,
        }
    }
    pub fn disconnect(&mut self) {
        self.status = PlayerStatus::Disconnected
    }
    pub fn connect(&mut self) {
        self.status = PlayerStatus::Connected
    }
}
