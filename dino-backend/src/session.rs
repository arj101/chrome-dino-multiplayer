use crate::config_options::SessionConfig;
use crate::map_generator::GameMap;
use crate::session_exec::{
    GameEvent, QueryResponseType, QueryType, RxData, TransmissionQueue, TxData,
};

use futures_channel::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio_tungstenite::tungstenite::protocol::Message;

use serde::{Deserialize, Serialize};

use uuid::Uuid;

use rustc_hash::FxHashMap;
use std::cell::Cell;
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

#[macro_export]
macro_rules! send_msg {
    ($channel:expr, $msg:expr) => {{
        #[cfg(debug_assertions)]
        let parsed = serde_json::to_string_pretty($msg).unwrap();
        #[cfg(not(debug_assertions))]
        let parsed = serde_json::to_string($msg).unwrap();

        $channel.unbounded_send(tokio_tungstenite::tungstenite::protocol::Message::Text(
            parsed,
        ))
    }};
}

pub enum MessageParseResult {
    ToTextError,
    SerdeError(serde_json::Error),
    Parsed(RxData),
}

#[macro_export]
macro_rules! parse_msg {
    ($message:expr) => {
        match $message.to_text() {
            Ok(message) => match serde_json::from_str::<RxData>(message) {
                Ok(data) => MessageParseResult::Parsed(data),
                Err(e) => MessageParseResult::SerdeError(e),
            },
            Err(_) => MessageParseResult::ToTextError,
        }
    };
}

pub struct PlayerChannel {
    pub tx: UnboundedSender<Message>,
    pub rx: UnboundedReceiver<Message>,
    pub addr: SocketAddr,
}

pub struct Session {
    session_id: Uuid,
    session_name: String,
    host_id: Uuid,
    player_data: FxHashMap<Uuid, PlayerData>,
    game_data: GameData,
    status: SessionStatus,
    timers: FxHashMap<Uuid, Rc<(SystemTime, fn(&mut Self), bool)>>,
    has_finished: bool,
    config: SessionConfig,
    addr_map: FxHashMap<SocketAddr, Uuid>,
    // channels: Rc<FxHashMap<Uuid, Rc<PlayerChannel>>>,
    receivers: Cell<FxHashMap<Uuid, UnboundedReceiver<Message>>>,
    senders: FxHashMap<Uuid, UnboundedSender<Message>>,
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
            addr_map: FxHashMap::default(),
            // channels: Rc::new(FxHashMap::default()),
            receivers: Cell::new(FxHashMap::default()),
            senders: FxHashMap::default(),
        }
    }

    /// Returns `Err` if the username is invalidated
    pub fn with_host(
        mut self,
        channel: PlayerChannel,
        username: String,
        addr: SocketAddr,
        wait_time: u64,
    ) -> Result<Self, PlayerChannel> {
        if username.len() > self.config.max_username_len {
            return Err(channel);
        }

        let host_id = Uuid::new_v4();
        self.host_id = host_id;

        self.player_data
            .insert(host_id, PlayerData::new(host_id, username, addr));

        send_msg!(
            channel.tx,
            &TxData::SessionCreationResponse {
                creation_succeeded: true,
                session_id: Some(self.session_id),
            }
        );

        send_msg!(
            channel.tx,
            &TxData::UserCreationResponse {
                creation_succeeded: true,
                user_id: Some(host_id),
            }
        );

        //5 minutes max wait time
        let id = self.set_timeout(
            |s| {
                s.launch_game();
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

    fn set_timeout(&mut self, f: fn(&mut Self), duration: Duration) -> Uuid {
        let id = Uuid::new_v4();
        self.timers
            .insert(id, Rc::new((SystemTime::now() + duration, f, false)));
        id
    }

    fn set_interval(&mut self, f: fn(&mut Self), duration: Duration) -> Uuid {
        let id = Uuid::new_v4();
        self.timers
            .insert(id, Rc::new((SystemTime::now() + duration, f, true)));
        id
    }

    fn exec_timers(&mut self) {
        let mut exec_list = vec![];
        let mut remove_list = vec![];
        for (id, rc) in &self.timers {
            if SystemTime::now() > rc.0 {
                // rc.1(self, tx);
                exec_list.push(rc.1);
                if !rc.2 {
                    remove_list.push(id.clone());
                }
            }
        }

        for f in exec_list {
            f(self);
        }
        for id in remove_list {
            self.timers.remove(&id);
        }
    }

    fn broadcast(&mut self, id: &Uuid, data: TxData) {
        //FIXME: Not works for no reason :(
        // self.player_data.values().for_each(|p| {
        //     // println!("Sending broadcast to {}", p.addr);
        //     // if p.id == id {
        //     //     return;
        //     // }
        //     tx.send_to_addr(p.addr, data.clone());
        // })
        self.senders.values().for_each(|sender| {
            send_msg!(sender, &data);
        });
    }

    fn emit(&mut self, data: TxData) {
        self.senders.values().for_each(|sender| {
            send_msg!(sender, &data);
        });

        // self.player_data
        //     .values()
        //     .for_each(|p| tx.send_to_addr(p.addr, data.clone()))
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

        self.broadcast(id, TxData::GameEvent { username, event });
    }

    #[inline(always)]
    pub fn on_broadcast_req(&mut self, id: &Uuid, pos_y: f32, pos_x: f32, tick: u64) {
        let (username, tick) = if let Some(player) = self.player_data.get_mut(&id) {
            player.curr_tick += 1;
            (player.username.clone(), player.curr_tick)
        } else {
            return;
        };

        self.broadcast(
            id,
            TxData::Broadcast {
                username,
                pos: [pos_x, pos_y],
                tick,
            },
        )
    }

    pub fn on_recv(&mut self, player_id: &Uuid, rx_data: RxData) {
        match rx_data {
            RxData::BroadcastReq { pos: [pos_x, pos_y], tick } => {
                self.on_broadcast_req(player_id, pos_y, pos_x, tick)
            }
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
            RxData::LaunchGame { user_id, .. } => self.launch_game_req(&user_id),
            RxData::Map { user_id, index, .. } => self.map_req(&user_id, index),
            // RxData::GameOver { user_id, .. } => self.user_game_over(tx, user_id, addr),
            RxData::Query { query: QueryType::SessionStatus { session_id } } => {
                if session_id == self.session_id {
                    send_msg!(self.senders.get_mut(player_id).unwrap(), &TxData::QueryResponse { query_res: QueryResponseType::SessionStatus { status: self.get_status().0, time: self.get_status().1 } });
                }
            }
            _ => println!(
                "[session] WARNING: Every other conditions should be already handled in `SessionExecutor`"
            ),
        }
    }

    pub fn user_game_over(
        &mut self,
        tx: &mut TransmissionQueue,
        user_id: &Uuid,
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

        send_msg!(
            self.senders.get(user_id).unwrap(),
            &TxData::UserGameOver {
                score,
                user_id: *user_id
            }
        );
        self.broadcast(user_id, TxData::UserGameOverBroadcast { username, score });

        let active_players = self.player_data.values().filter(|v| v.score == 0).count();
        Ok(active_players)
    }

    fn map_req(&mut self, player_id: &Uuid, idx: u32) {
        // if let None = self.player_data.get(&user_id) {
        //     println!(
        //         "[sesson] map requested by unknown user `{}` (addr: `{}`)",
        //         user_id, addr
        //     );
        //     println!("[session] still sending map bc idc")
        //     // return;
        // }
        //
        match self.status {
            _ => {
                let idx = idx as usize;
                let (from, to) = (idx as usize * 100, (idx as usize + 1) * 100 - 1); //0-99, 100-199, ..

                let map = self.game_data.map.get_map(from, to).to_vec();
                // tx.send_to_addr(addr, TxData::Map { map })
                send_msg!(self.senders.get(player_id).unwrap(), &TxData::Map { map });
            }
        }
    }

    fn launch_game_req(&mut self, user_id: &Uuid) {
        let id_mismatch = user_id != &self.host_id;
        if id_mismatch {
            println!(
                "[session] Unauthorized game launch request from  user id: `{}`.\nID mismatch: {}",
                user_id, id_mismatch,
            );
            return;
        }

        self.launch_game();
    }

    fn launch_game(&mut self) {
        if let SessionStatus::Waiting { timeout, .. } = self.status {
            self.timers.remove(&timeout);
            let duration = Duration::from_secs(4);

            self.status = SessionStatus::Countdown {
                start: SystemTime::now(),
                duration,
            };

            self.emit(TxData::GameCountdownStart {
                duration: duration.as_secs() as u32,
            });

            self.set_timeout(
                |s| {
                    s.emit(TxData::GameStart);
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
        addr: SocketAddr,
        channel: PlayerChannel,
        username: String,
    ) -> Result<(), PlayerChannel> {
        if !self.host_id.is_nil() {
            match self.status {
                SessionStatus::Waiting { .. } => (),
                _ => return Err(channel),
            }
        }

        if self.player_data.keys().len() >= self.config.max_users
            || username.len() > self.config.max_username_len
            || self.username_exists(&username)
        {
            send_msg!(
                channel.tx,
                &TxData::UserCreationResponse {
                    creation_succeeded: false,
                    user_id: None,
                }
            );
            return Err(channel);
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
        self.addr_map.insert(addr, id);

        send_msg!(
            channel.tx,
            &TxData::UserCreationResponse {
                creation_succeeded: true,
                user_id: Some(id),
            }
        );

        self.receivers.get_mut().insert(id, channel.rx);
        self.senders.insert(id, channel.tx);

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
                    if player_data.score > 0 {
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

    fn process_messages(&mut self) {
        let mut receivers = self.receivers.take();
        for (id, rx) in &mut receivers {
            while let Ok(Some(msg)) = rx.try_next() {
                let msg = parse_msg!(msg);
                if let MessageParseResult::Parsed(msg) = msg {
                    self.on_recv(&id, msg);
                }
            }
        }
        self.receivers.set(receivers);
    }

    fn curr_score(&self, start_time: Instant) -> u64 {
        let elapsed = start_time.elapsed().as_secs_f64();
        ((INITIAL_X_VEL as f64 * elapsed) + (0.5 * X_ACC as f64 * elapsed.powi(2))).round() as u64
    }

    pub fn game_loop(&mut self) -> bool {
        self.exec_timers();
        self.process_messages();

        if self.has_finished {
            return true;
        }
        if let SessionStatus::Active {
            start_time,
            max_duration,
        } = self.status
        {
            // self.game_data.sync_score = self.curr_score(start_time);
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
        addr: SocketAddr,
        user_id: Uuid,
        channel: PlayerChannel,
    ) -> Result<(), PlayerChannel> {
        if let Some(player) = self.player_data.get_mut(&user_id) {
            player.connect();
            player.addr = addr;
            self.addr_map.insert(addr, user_id);
            let result = send_msg!(channel.tx, &TxData::LoginResponse { succeeded: true });
            // tx.send_to_addr(addr, TxData::LoginResponse { succeeded: true });
            self.receivers.get_mut().insert(user_id, channel.rx);
            self.senders.insert(user_id, channel.tx);
            return Ok(());
        }
        // tx.send_to_addr(addr, TxData::LoginResponse { succeeded: false });
        Err(channel)
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

        self.addr_map.remove(&addr);
        self.receivers.get_mut().remove(&user_id);
        self.senders.remove(&user_id);

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
                    //
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
