use futures_channel::mpsc::{UnboundedReceiver, UnboundedSender};
use futures_util::Stream;
// use tokio::sync::mpsc::{self, UnboundedReceiver};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message as WsMessage;
use uuid::Uuid;

use rustc_hash::FxHashMap;

use std::net::SocketAddr;
use std::rc::Rc;
use std::sync::{Arc, Mutex};

use crate::config_options::{ConfigOptions, SessionConfig, SessionExecConfig};
use crate::obstacles::Obstacle;
use crate::parse_msg;
use crate::send_msg;
use crate::session::PlayerChannel;
use crate::session::Session;
use crate::session::SessionStatus;

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum QueryType {
    Sessions,
    LeaderBoard {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
    },
    SessionStatus {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
    },
}

#[derive(Serialize, Clone)]
pub enum SessionStatusSimplified {
    Waiting,
    Busy,
    Ended,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
pub enum QueryResponseType {
    Sessions {
        sessions: Vec<(Uuid, String, SessionStatusSimplified, Vec<String>)>,
    },
    LeaderBoard {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        scores: Vec<(String, u64)>,
    },
    SessionStatus {
        status: &'static str, //refers to the enum,
        time: i64,
    },
}

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
pub enum TxData {
    QueryResponse {
        #[serde(rename = "queryRes")]
        query_res: QueryResponseType,
    },

    SessionCreationResponse {
        #[serde(rename = "creationSucceeded")]
        creation_succeeded: bool,
        #[serde(rename = "sessionId")]
        session_id: Option<Uuid>,
    },

    UserCreationResponse {
        #[serde(rename = "creationSucceeded")]
        creation_succeeded: bool,
        #[serde(rename = "userId")]
        user_id: Option<Uuid>,
    },

    LoginResponse {
        succeeded: bool,
    },

    PlayerDataBroadcast {
        username: String,
        #[serde(rename = "posY")]
        pos_y: f32,
        #[serde(rename = "posX")]
        pos_x: f32,
        tick: u64,
    },

    GameCountdownStart {
        duration: u32,
    },

    GameStart,

    Map {
        map: Vec<((f64, f64), Vec<Obstacle>)>,
    },

    UserGameOverBroadcast {
        username: String,
        score: u64,
    },

    UserGameOver {
        score: u64,
        #[serde(rename = "userId")]
        user_id: Uuid,
    },

    GameEvent {
        username: String,
        event: GameEvent,
    },

    InvalidationNotice,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(tag = "type")]
pub enum GameEvent {
    Jump { pos: f32 },
    DuckStart { pos: f32 },
    DuckEnd { pos: f32 },
}

// parsed data from ChannelData::Message
#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum RxData {
    Query {
        query: QueryType,
    },

    CreateSession {
        username: String,
        #[serde(rename = "sessionName")]
        session_name: String,
        #[serde(rename = "waitTime")]
        wait_time: u64,
    },

    CreateUser {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        username: String,
    },

    Login {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        #[serde(rename = "userId")]
        user_id: Uuid,
    },

    LaunchGame {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        #[serde(rename = "userId")]
        user_id: Uuid,
    },

    BroadcastRequest {
        #[serde(rename = "posY")]
        pos_y: f32,
        #[serde(rename = "posX")]
        pos_x: f32,
        tick: u64,
    },

    ValidationData {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        #[serde(rename = "userId")]
        user_id: Uuid,
        #[serde(rename = "posX")]
        pos_x: f64,
        score: u64,
        timestamp: u64,
        #[serde(rename = "moveDir")]
        move_dir: Option<PlayerMove>,
    },

    Map {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        #[serde(rename = "userId")]
        user_id: Uuid,
        index: u32,
    },

    GameEvent {
        #[serde(rename = "userId")]
        user_id: Uuid,
        event: GameEvent,
    },

    GameOver {
        #[serde(rename = "sessionId")]
        session_id: Uuid,
        #[serde(rename = "userId")]
        user_id: Uuid,
    },
}

#[derive(Deserialize)]
pub enum PlayerMove {
    None,
    Up,
    Down,
}

pub enum ChannelData {
    Connect {
        addr: SocketAddr,
        tx: UnboundedSender<WsMessage>,
        rx: UnboundedReceiver<WsMessage>,
    },
    Message {
        addr: SocketAddr,
        msg: WsMessage,
    },
    Disconnect(SocketAddr),
}

pub struct TransmissionQueue {
    queue: Vec<(SocketAddr, TxData)>,
    closable: Vec<SocketAddr>,
}

impl TransmissionQueue {
    pub fn new() -> Self {
        Self {
            queue: Vec::with_capacity(128),
            closable: vec![],
        }
    }

    pub fn send_to_addr(&mut self, addr: SocketAddr, msg: TxData) {
        self.queue.push((addr, msg))
    }

    pub fn close_con(&mut self, addr: SocketAddr) {
        self.closable.push(addr)
    }

    fn clear_queue(&mut self) {
        self.queue.clear();
    }

    fn clear_closable(&mut self) {
        self.closable.clear();
    }
}

pub type PeerMap =
    Arc<Mutex<FxHashMap<SocketAddr, (UnboundedReceiver<WsMessage>, UnboundedSender<WsMessage>)>>>;
pub type UserSessionMap = FxHashMap<SocketAddr, Option<Uuid>>;

pub struct SessionExecutor {
    sessions: FxHashMap<Uuid, Session>,
    session_hosts: FxHashMap<SocketAddr, Uuid>, //key: host address, value: session id
    channel_rx: mpsc::Receiver<ChannelData>,
    channel_tx: mpsc::Sender<ChannelData>, //used to create new Sender<>s
    // peer_map: PeerMap,
    user_session_map: UserSessionMap,
    tx_queue: TransmissionQueue,
    closable_sessions: Vec<Uuid>,
    config: ConfigOptions,
    channels: FxHashMap<SocketAddr, PlayerChannel>,
}

impl SessionExecutor {
    pub fn new(config: ConfigOptions) -> Self {
        //FIXME: not sure what the buffer size should be
        let (channel_tx, channel_rx) = mpsc::channel(1024);

        let mut sessions = FxHashMap::default();

        if config.session_exec.dummy_sessions {
            sessions.insert(
                Uuid::new_v4(),
                Session::new("idk".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("idk2".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("id3k".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("1idk".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("id4k".to_string(), config.session),
            );
        }
        Self {
            sessions,
            session_hosts: FxHashMap::default(),
            channel_rx,
            channel_tx,
            // peer_map: PeerMap::new(Mutex::new(FxHashMap::default())),
            user_session_map: UserSessionMap::default(),
            tx_queue: TransmissionQueue::new(),
            closable_sessions: vec![],
            config,
            channels: FxHashMap::default(),
        }
    }

    pub fn new_with_channel(
        (tx, rx): (mpsc::Sender<ChannelData>, mpsc::Receiver<ChannelData>),
        config: ConfigOptions,
    ) -> Self {
        let mut sessions = FxHashMap::default();

        if config.session_exec.dummy_sessions {
            sessions.insert(
                Uuid::new_v4(),
                Session::new("idk".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("idk2".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("id3k".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("1idk".to_string(), config.session),
            );
            sessions.insert(
                Uuid::new_v4(),
                Session::new("id4k".to_string(), config.session),
            );
        }

        Self {
            sessions,
            session_hosts: FxHashMap::default(),
            channel_rx: rx,
            channel_tx: tx,
            // peer_map: PeerMap::new(Mutex::new(FxHashMap::default())),
            user_session_map: UserSessionMap::default(),
            tx_queue: TransmissionQueue::new(),
            closable_sessions: vec![],
            config,
            channels: FxHashMap::default(),
        }
    }

    pub fn get_channel_sender(&self) -> mpsc::Sender<ChannelData> {
        self.channel_tx.clone()
    }

    pub fn poll_main_channel(&mut self) {
        let mut recv_count = 0;
        while let Ok(msg) = self.channel_rx.try_recv() {
            self.process_channel_msg(msg);
            recv_count += 1;
            if recv_count >= 512 {
                //only receive maximum of 512 messages per call
                break;
            }
        }
    }

    fn process_channel_msg(&mut self, msg: ChannelData) {
        match msg {
            //this is not called anymore :)
            ChannelData::Message { addr, msg } => {
                println!("WARNING: use of deprecated message channel");
                if let Ok(msg) = msg.to_text() {
                    self.process_text_msg(addr, msg);
                }
            }
            ChannelData::Connect { addr, tx, rx } => {
                println!("[session exec] `{}` just connected.", &addr);
                // self.peer_map.lock().unwrap().insert(addr, (rx, tx));
                self.user_session_map.insert(addr, None);
                self.channels.insert(addr, PlayerChannel { tx, rx, addr });
            }
            ChannelData::Disconnect(addr) => {
                println!("[session exec] `{}` closed connection :(", addr);
                // self.peer_map.lock().unwrap().remove(&addr);
                self.channels.remove(&addr);
                // if let Some(Some(s_id)) = self.user_session_map.get(&addr) {
                //     if let Some(session) = self.sessions.get_mut(s_id) {
                //         let game_finished = session.on_user_con_close(addr);
                //         if game_finished {
                //             session.shutdown(&mut self.tx_queue);
                //         }
                //     }
                //     self.user_session_map.remove(&addr);
                // }
            }
        }
    }

    pub fn poll_sub_channels(&mut self) {
        let mut remove_list = vec![];

        let mut messages = vec![];

        for PlayerChannel { tx, rx, addr } in self.channels.values_mut() {
            const MAX_READ_COUNT: usize = 128;
            let mut read_count = 0;

            'read_loop: while read_count < MAX_READ_COUNT {
                match rx.try_next() {
                    Ok(Some(message)) => {
                        if let Ok(msg) = message.to_text() {
                            messages.push((*addr, msg.to_owned()));
                        }
                    }
                    Ok(None) => {
                        remove_list.push(*addr);
                        break 'read_loop;
                    }
                    Err(err) => break 'read_loop,
                }
                read_count += 1;
            }
        }

        for (addr, msg) in messages {
            self.process_text_msg(addr, &msg)
        }

        for addr in remove_list {
            self.channels.remove(&addr);
        }
    }

    fn process_text_msg(&mut self, addr: SocketAddr, msg: &str) {
        let rx_data: RxData = match serde_json::from_str(msg) {
            Ok(rx_data) => rx_data,
            Err(err) => {
                println!(
                    "[session_exec] Error parsing json from `{}`: `{}`",
                    addr, err
                );
                return;
            }
        };

        match &rx_data {
            RxData::Query { query } => self.handle_query(addr, query),
            RxData::CreateSession {
                // wait_time,
                username,
                session_name,
                wait_time,
            } => self.create_session(addr, *wait_time, username, session_name),
            RxData::CreateUser {
                session_id,
                username,
            } => {
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    let channel = self.channels.remove(&addr).take().unwrap();
                    match s.create_user(addr, channel, username.to_owned()) {
                        Ok(_) => {
                            self.user_session_map.insert(addr, Some(*s.id()));
                        }
                        Err(channel) => {
                            self.channels.insert(addr, channel);
                            println!("User creation failed. {} in {}", username, s.id())
                        }
                    }
                } else {
                    println!("[session_exec] `{}` requested user creation to invalid session: `{}` as `{}`", addr, session_id, username);
                }
            }
            RxData::Login {
                session_id,
                user_id,
            } => {
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    let channel = self.channels.remove(&addr).take().unwrap();
                    match s.login_user(addr, *user_id, channel) {
                        Ok(_) => {
                            self.user_session_map.insert(addr, Some(*s.id()));
                        }
                        Err(channel) => {
                            self.channels.insert(addr, channel);
                            println!("User creation failed. {} in {}", user_id, s.id())
                        }
                    }
                }
                //TODO: send back response if login doesnt succeed
            }
            _ => {} //TODO: Handle all the below cases in `Session`
                    // RxData::ValidationData { session_id, .. }
                    // | RxData::LaunchGame { session_id, .. }
                    // | RxData::Map { session_id, .. } => {
                    //     if let Some(s) = self.sessions.get_mut(&session_id) {
                    //         s.on_recv(&mut self.tx_queue, addr, rx_data);
                    //     } else {
                    //         println!(
                    //             "[session_exec] `{}` sent data to invalid session: `{}`",
                    //             addr, session_id
                    //         );
                    //     }
                    // }
                    // RxData::GameOver {
                    //     session_id,
                    //     user_id,
                    //     ..
                    // } => {
                    //     if let Some(s) = self.sessions.get_mut(&session_id) {
                    //         if let Ok(active_players) = s.user_game_over(&mut self.tx_queue, *user_id, addr)
                    //         {
                    //             self.user_session_map.remove(&addr);
                    //             self.session_hosts.remove(&addr);
                    //             if active_players <= 0 {
                    //                 println!("[session_exec] 0 active players, closing session...");
                    //                 s.shutdown(&mut self.tx_queue);
                    //             }
                    //         }
                    //     } else {
                    //         println!(
                    //             "[session_exec] `{}` sent game over message to invalid session: `{}`",
                    //             addr, session_id
                    //         );
                    //     }
                    // }
        }
    }

    fn handle_query(&mut self, addr: SocketAddr, query: &QueryType) {
        match query {
            QueryType::LeaderBoard { session_id } => {
                if self.sessions.contains_key(&session_id) {
                    send_msg!(
                        self.channels.get_mut(&addr).unwrap().tx,
                        &TxData::QueryResponse {
                            query_res: QueryResponseType::LeaderBoard {
                                session_id: *session_id,
                                scores: self.sessions.get(&session_id).unwrap().get_leaderboard(),
                            },
                        }
                    );
                } else {
                    println!(
                        "[session_exec] Invalid session `{}` queried for leaderboard by `{}`.",
                        session_id, addr
                    )
                }
            }
            QueryType::SessionStatus { session_id } => {
                if let Some(s) = self.sessions.get(session_id) {
                    let (status, duration) = s.get_status();
                    send_msg!(
                        self.channels.get_mut(&addr).unwrap().tx,
                        &TxData::QueryResponse {
                            query_res: QueryResponseType::SessionStatus {
                                status,
                                time: duration,
                            },
                        }
                    );
                }
            }

            QueryType::Sessions => {
                send_msg!(
                    self.channels.get_mut(&addr).unwrap().tx,
                    &TxData::QueryResponse {
                        query_res: QueryResponseType::Sessions {
                            sessions: self
                                .sessions
                                .keys()
                                .map(|k| {
                                    let session = self.sessions.get(k).unwrap();
                                    let status = match session.status() {
                                        SessionStatus::Waiting { .. } | SessionStatus::Uninit => {
                                            SessionStatusSimplified::Waiting
                                        }
                                        SessionStatus::Active { .. }
                                        | SessionStatus::Countdown { .. } => {
                                            SessionStatusSimplified::Busy
                                        }
                                        SessionStatus::Ended => SessionStatusSimplified::Ended,
                                    };
                                    (
                                        *k,
                                        session.name().to_owned(),
                                        status,
                                        session.get_usernames(),
                                    )
                                })
                                .collect(),
                        },
                    }
                );
            }
        }
    }

    fn create_session(
        &mut self,
        addr: SocketAddr,
        wait_time: u64,
        username: &str,
        session_name: &str,
    ) {
        if let Some(s) = self.user_session_map.get(&addr).unwrap() {
            println!("[session_exec] `{}` requested session creation as `{}` but was already in another sesssion: `{}`", addr, username, s);
            return;
        }
        if self.sessions.len() < self.config.session_exec.max_sessions
            && !self.session_hosts.contains_key(&addr)
            && username.len() <= self.config.session.max_username_len
            && (self
                .sessions
                .iter()
                .filter(|(_, s)| {
                    if let SessionStatus::Waiting { .. } = s.status() {
                        true
                    } else {
                        false
                    }
                })
                .count()
                == 0
                || self.config.session_exec.allow_multiple_inactive_sessions)
        {
            let channel = self.channels.remove(&addr).unwrap();
            match Session::new(session_name.to_owned(), self.config.session).with_host(
                channel,
                username.to_owned(),
                addr,
                wait_time,
            ) {
                Ok(session) => {
                    let id = *session.id();
                    self.session_hosts.insert(addr, id);
                    self.sessions.insert(id, session);
                    self.user_session_map.insert(addr, Some(id));
                }
                Err(channel) => {
                    self.channels.insert(addr, channel);
                }
            }
        } else {
            send_msg!(
                self.channels.get(&addr).unwrap().tx,
                &TxData::SessionCreationResponse {
                    creation_succeeded: false,
                    session_id: None,
                }
            );
        }
    }

    // fn send_tx_queue(&mut self) {
    //     let senders = self.peer_map.clone();
    //     self.tx_queue.queue.iter().for_each(move |(addr, msg)| {
    //         #[cfg(debug_assertions)]
    //         let serialized_msg = serde_json::to_string_pretty(&msg).unwrap();
    //         #[cfg(not(debug_assertions))]
    //         let serialized_msg = serde_json::to_string(&msg).unwrap();
    //
    //         let mut senders = senders.lock().unwrap();
    //         if let Some(sender) = senders.get_mut(addr) {
    //             if let Err(e) = sender.1.unbounded_send(WsMessage::Text(serialized_msg)) {
    //                 println!(
    //                     "[session_exec] Error sending message to `{}`: `{}`",
    //                     addr, e
    //                 )
    //             }
    //         } else {
    //             println!(
    //                 "[session_exec] Requested transmission to unknown address: `{}`",
    //                 addr
    //             )
    //         }
    //     });
    //
    //     self.tx_queue.clear_queue();
    // }

    // fn close_abandoned_cons(&mut self) {
    //     if self.tx_queue.closable.is_empty() {
    //         return;
    //     };
    //     let mut senders = self.peer_map.lock().unwrap();
    //     self.tx_queue.closable.iter().for_each(|addr| {
    //         if let Some(sender) = senders.get_mut(addr) {
    //             sender.1.close_channel();
    //             sender.0.close();
    //             senders.remove(addr);
    //             println!("[session_exec] closed connection from `{}`", addr);
    //         } else {
    //             println!(
    //                 "[session_exec] requested closing unknown address: `{}`",
    //                 addr
    //             );
    //         }
    //     });
    //     self.tx_queue.clear_closable();
    // }

    fn close_session(&mut self, s_id: &Uuid) {
        if let Some(session) = self.sessions.get(s_id) {
            if let Some(host_addr) = session.get_host_addr() {
                self.session_hosts.remove(&host_addr);
            }
            self.sessions.remove(&s_id);
            println!("[session exec] closed session `{}`", s_id);
        }
    }

    #[inline(always)]
    pub fn run(&mut self) {
        for (s_id, s) in &mut self.sessions {
            let game_finished = s.game_loop(&mut self.tx_queue);
            if game_finished {
                s.shutdown(&mut self.tx_queue);
                self.closable_sessions.push(*s_id);
            }
        }
        // self.send_tx_queue();
        // self.close_abandoned_cons();
        if self.closable_sessions.len() <= 0 {
            return;
        }

        for s in &self.closable_sessions.clone() {
            self.close_session(s);
        }
        self.closable_sessions.clear();
    }
}
