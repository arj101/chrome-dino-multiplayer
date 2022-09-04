use futures_channel::mpsc::UnboundedSender;
use futures_util::Stream;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message as WsMessage;

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use std::sync::{Arc, Mutex};
use std::{collections::HashMap, net::SocketAddr};

use crate::config_options::{ConfigOptions, SessionConfig, SessionExecConfig};
use crate::obstacles::Obstacle;
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
        state: u32, //refers to the enum,
        time: u64,
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

    InvalidationNotice,
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
        #[serde(rename = "userId")]
        user_id: Uuid,
        #[serde(rename = "posY")]
        pos_y: f32,
        #[serde(rename = "posX")]
        pos_x: f32,
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

pub type PeerMap = Arc<Mutex<HashMap<SocketAddr, UnboundedSender<WsMessage>>>>;
pub type UserSessionMap = HashMap<SocketAddr, Option<Uuid>>;

pub struct SessionExecutor {
    sessions: HashMap<Uuid, Session>,
    session_hosts: HashMap<SocketAddr, Uuid>, //key: host address, value: session id
    channel_rx: mpsc::Receiver<ChannelData>,
    channel_tx: mpsc::Sender<ChannelData>, //used to create new Sender<>s
    peer_map: PeerMap,
    user_session_map: UserSessionMap,
    tx_queue: TransmissionQueue,
    closable_sessions: Vec<Uuid>,
    config: ConfigOptions,
}

impl SessionExecutor {
    pub fn new(config: ConfigOptions) -> Self {
        //FIXME: not sure what the buffer size should be
        let (channel_tx, channel_rx) = mpsc::channel(1024);

        let mut sessions = HashMap::new();

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
            session_hosts: HashMap::new(),
            channel_rx,
            channel_tx,
            peer_map: PeerMap::new(Mutex::new(HashMap::new())),
            user_session_map: UserSessionMap::new(),
            tx_queue: TransmissionQueue::new(),
            closable_sessions: vec![],
            config,
        }
    }

    pub fn new_with_channel(
        (tx, rx): (mpsc::Sender<ChannelData>, mpsc::Receiver<ChannelData>),
        config: ConfigOptions,
    ) -> Self {
        let mut sessions = HashMap::new();

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
            session_hosts: HashMap::new(),
            channel_rx: rx,
            channel_tx: tx,
            peer_map: PeerMap::new(Mutex::new(HashMap::new())),
            user_session_map: UserSessionMap::new(),
            tx_queue: TransmissionQueue::new(),
            closable_sessions: vec![],
            config,
        }
    }

    pub fn get_channel_sender(&self) -> mpsc::Sender<ChannelData> {
        self.channel_tx.clone()
    }

    pub fn poll_channel(&mut self) {
        let mut recv_count = 0;
        while let Ok(msg) = self.channel_rx.try_recv() {
            self.process_channel_msg(msg);
            recv_count += 1;
            if recv_count >= 50 {
                //only receive maximum of 50 messages per call
                break;
            }
        }
    }

    fn process_channel_msg(&mut self, msg: ChannelData) {
        match msg {
            ChannelData::Connect { addr, tx } => {
                println!("[session exec] `{}` just connected.", &addr);
                self.peer_map.lock().unwrap().insert(addr, tx);
                self.user_session_map.insert(addr, None);
            }
            ChannelData::Message { addr, msg } => {
                if let Ok(msg) = msg.to_text() {
                    self.process_text_msg(addr, msg);
                }
            }
            ChannelData::Disconnect(addr) => {
                println!("[session exec] `{}` closed connection :(", addr);
                self.peer_map.lock().unwrap().remove(&addr);
                if let Some(Some(s_id)) = self.user_session_map.get(&addr) {
                    if let Some(session) = self.sessions.get_mut(s_id) {
                        let game_finished = session.on_user_con_close(addr);
                        if game_finished {
                            session.shutdown(&mut self.tx_queue);
                        }
                    }
                    self.user_session_map.remove(&addr);
                }
            }
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
                    if let Some(s_id) = self.user_session_map.get(&addr).unwrap() {
                        println!("[session_exec] `{}` requested user creation to `{}` (as `{}`), but was already in session`{}`.", addr, s.id(),  username, s_id);
                    } else {
                        if let Ok(_) = s.create_user(&mut self.tx_queue, addr, username.to_owned())
                        {
                            self.user_session_map.insert(addr, Some(*s.id()));
                        } else {
                            println!("User creation failed. {} in {}", username, s.id());
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
                    if let Some(s_id) = self.user_session_map.get(&addr).unwrap() {
                        println!("[session_exec] `{}` requested login to `{}` but was already in session `{}`", addr, session_id, s_id)
                    } else {
                        if let Ok(_) = s.login_user(&mut self.tx_queue, addr, *user_id) {
                            self.user_session_map.insert(addr, Some(*s.id()));
                        }
                    }
                }
            }
            RxData::ValidationData { session_id, .. }
            | RxData::LaunchGame { session_id, .. }
            | RxData::Map { session_id, .. } => {
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    s.on_recv(&mut self.tx_queue, addr, rx_data);
                } else {
                    println!(
                        "[session_exec] `{}` sent data to invalid session: `{}`",
                        addr, session_id
                    );
                }
            }
            RxData::GameOver {
                session_id,
                user_id,
                ..
            } => {
                if let Some(s) = self.sessions.get_mut(&session_id) {
                    if let Ok(active_players) = s.user_game_over(&mut self.tx_queue, *user_id, addr)
                    {
                        self.user_session_map.remove(&addr);
                        self.session_hosts.remove(&addr);
                        if active_players <= 0 {
                            println!("[session_exec] 0 active players, closing session...");
                            s.shutdown(&mut self.tx_queue);
                        }
                    }
                } else {
                    println!(
                        "[session_exec] `{}` sent game over message to invalid session: `{}`",
                        addr, session_id
                    );
                }
            }
            RxData::BroadcastRequest {
                user_id,
                pos_y,
                pos_x,
            } => {
                if let Some(Some(session_id)) = self.user_session_map.get(&addr) {
                    if let Some(s) = self.sessions.get_mut(session_id) {
                        s.on_broadcast_req(&mut self.tx_queue, addr, *user_id, *pos_y, *pos_x)
                    }
                } else {
                    println!(
                        "[session_exec] `{}` requested broadcast while not being in any session.",
                        addr,
                    )
                }
            }
        }
    }

    fn handle_query(&mut self, addr: SocketAddr, query: &QueryType) {
        match query {
            QueryType::LeaderBoard { session_id } => {
                if self.sessions.contains_key(&session_id) {
                    self.tx_queue.send_to_addr(
                        addr,
                        TxData::QueryResponse {
                            query_res: QueryResponseType::LeaderBoard {
                                session_id: *session_id,
                                scores: self.sessions.get(&session_id).unwrap().get_leaderboard(),
                            },
                        },
                    )
                } else {
                    println!(
                        "[session_exec] Invalid session `{}` queried for leaderboard by `{}`.",
                        session_id, addr
                    )
                }
            }
            QueryType::SessionStatus { session_id } => {
                todo!();
                // if let Some(s) = self.sessions.get(session_id) {
                //self.tx_queue.send_to_addr(
                //  addr, TxData::QueryResponse { query_res: QueryResponseType::SessionStatus {
                //                            status: s.status(),

                //}}
                //)
                // }
            }

            QueryType::Sessions => self.tx_queue.send_to_addr(
                addr,
                TxData::QueryResponse {
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
                },
            ),
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
            let new_session = Session::new(session_name.to_owned(), self.config.session)
                .with_host(&mut self.tx_queue, username.to_owned(), addr, wait_time)
                .unwrap();
            let id = *new_session.id();
            self.session_hosts.insert(addr, id);
            self.sessions.insert(id, new_session);
            self.user_session_map.insert(addr, Some(id));
        } else {
            self.tx_queue.send_to_addr(
                addr,
                TxData::SessionCreationResponse {
                    creation_succeeded: false,
                    session_id: None,
                },
            )
        }
    }

    fn send_tx_queue(&mut self) {
        let senders = self.peer_map.clone();
        self.tx_queue.queue.par_iter().for_each(move |(addr, msg)| {
            #[cfg(debug_assertions)]
            let serialized_msg = serde_json::to_string_pretty(&msg).unwrap();
            #[cfg(not(debug_assertions))]
            let serialized_msg = serde_json::to_string(&msg).unwrap();

            let mut senders = senders.lock().unwrap();
            if let Some(sender) = senders.get_mut(addr) {
                if let Err(e) = sender.unbounded_send(WsMessage::Text(serialized_msg)) {
                    println!(
                        "[session_exec] Error sending message to `{}`: `{}`",
                        addr, e
                    )
                }
            } else {
                println!(
                    "[session_exec] Requested transmission to unknown address: `{}`",
                    addr
                )
            }
        });

        // I forgor this at first and it sent the same message over and over :skull:
        self.tx_queue.clear_queue();
    }

    fn close_abandoned_cons(&mut self) {
        let mut senders = self.peer_map.lock().unwrap();
        self.tx_queue.closable.iter().for_each(|addr| {
            if let Some(sender) = senders.get_mut(addr) {
                sender.close_channel();
                senders.remove(addr);
                println!("[session_exec] closed connection from `{}`", addr);
            } else {
                println!(
                    "[session_exec] requested closing unknown address: `{}`",
                    addr
                );
            }
        });
        self.tx_queue.clear_closable();
    }

    fn close_session(&mut self, s_id: Uuid) {
        if let Some(session) = self.sessions.get(&s_id) {
            if let Some(host_addr) = session.get_host_addr() {
                self.session_hosts.remove(&host_addr);
            }
            self.sessions.remove(&s_id);
            println!("[session exec] closed session `{}`", s_id);
        }
    }

    pub fn run(&mut self) {
        for (s_id, s) in &mut self.sessions {
            let game_finished = s.game_loop(&mut self.tx_queue);
            if game_finished {
                s.shutdown(&mut self.tx_queue);
                self.closable_sessions.push(*s_id);
            }
        }
        self.send_tx_queue();
        self.close_abandoned_cons();
        if self.closable_sessions.len() <= 0 {
            return;
        }

        for s in self.closable_sessions.clone() {
            self.close_session(s);
        }
        self.closable_sessions.clear();
    }
}
