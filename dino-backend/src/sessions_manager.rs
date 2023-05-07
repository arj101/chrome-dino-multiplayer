use crate::map_generator::GameMap;
use crate::send_msg;
use crate::session::Session;
use crate::{config_options::ConfigOptions, session_exec::ChannelData,};
use futures_channel::mpsc::{self, UnboundedReceiver, UnboundedSender};
use futures_util::join;
use rustc_hash::FxHashMap;
use std::cmp::Eq;
use std::fmt::{Arguments, Debug, Formatter};
use std::hash::Hash;
use std::net::SocketAddr;
use std::pin::Pin;
use std::{
    future::Future,
    process::Output,
    task::{Context, Poll},
};
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

///A structure which can both iterate and find elements cheaply with only removing elements being
///expensive
pub struct Pool<K, T> {
    items: Vec<(K, T)>,
    indices: FxHashMap<K, usize>,
}

impl<K, T> Debug for Pool<K, T>
where
    T: Debug,
    K: Debug,
{
    fn fmt(&self, formatter: &mut Formatter) -> Result<(), std::fmt::Error> {
        formatter.write_fmt(format_args!(
            "Pool{{{} }}",
            self.items
                .iter()
                .map(|(key, value)| format!(" {key:?} -> {value:?}"))
                .collect::<String>()
        ))
    }
}

impl<K, T> Pool<K, T>
where
    K: Clone + Eq + Hash,
{
    pub fn new() -> Self {
        Self {
            items: vec![],
            indices: FxHashMap::default(),
        }
    }

    pub fn push(&mut self, key: K, value: T) {
        self.items.push((key.clone(), value));
        self.indices.insert(key, self.items.len() - 1);
    }

    pub fn pop(&mut self, key: &K) -> Option<(K, T)> {
        let mut filtered = self.items.iter().enumerate().filter(|(_, (x, _))| x == key);
        if let Some((idx, _)) = filtered.next() {
            let removed_elt = self.items.swap_remove(idx);
            let idx = self.indices.remove(key).unwrap();
            if let None = self.items.get(idx) {
                return Some(removed_elt);
            }

            let swapped_elt = &self.items[idx];
            self.indices.insert(swapped_elt.0.clone(), idx);

            return Some(removed_elt);
        }

        None
    }

    pub fn items(&mut self) -> &mut Vec<(K, T)> {
        &mut self.items
    }

    pub fn items_ref(&self) -> &Vec<(K, T)> {
        &self.items
    }

    pub fn get(&self, key: &K) -> Option<&T> {
        if let Some(index) = self.indices.get(key) {
            if let Some((_, val)) = self.items.get(*index) {
                return Some(&val);
            }
        }

        None
    }

    pub fn get_mut(&mut self, key: &K) -> Option<&mut T> {
        if let Some(index) = self.indices.get(key) {
            if let Some((_, val)) = self.items.get_mut(*index) {
                return Some(val);
            }
        }

        None
    }
}

type Rx = UnboundedReceiver<Message>;
type Tx = UnboundedSender<Message>;

pub struct SessionNetworkResources {
    receivers: Pool<Uuid, Rx>,
    senders: Pool<Uuid, Tx>,
}

impl SessionNetworkResources {
    pub fn new() -> Self {
        Self {
            receivers: Pool::new(),
            senders: Pool::new(),
        }
    }

    pub fn push_channel(&mut self, id: Uuid, rx: Rx, tx: Tx) {
        self.receivers.push(id.clone(), rx);
        self.senders.push(id.clone(), tx);
    }

    pub fn pop_channel(&mut self, id: &Uuid) -> Option<(Rx, Tx)> {
        let rx = self.receivers.pop(id);
        let tx = self.senders.pop(id);

        if let Some((_, rx)) = rx {
            Some((rx, tx.unwrap().1))
        } else {
            None
        }
    }

    #[inline(always)]
    pub fn emit(&mut self, message: Message) {
        self.senders.items().iter().for_each(|(_, sender)| {
            let _ = sender.unbounded_send(message.clone());
        });
    }

    #[inline(always)]
    pub fn tx(&mut self, id: &Uuid) -> &mut Tx {
        self.senders.get_mut(id).unwrap()
    }

    #[inline(always)]
    pub fn rxs(&mut self) -> &mut Vec<(Uuid, Rx)> {
        self.receivers.items()
    }
}

use crate::session::PlayerData;

pub struct SessionState {
    pub net: SessionNetworkResources,
    pub map: GameMap,
    pub player_data: FxHashMap<Uuid, PlayerData>,
    pub session_id: Uuid,
    pub session_name: String,
    pub host_id: Uuid,
    pub config: SessionConfig,
    pub status: SessionStatus,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            net: SessionNetworkResources::new(),
            map: GameMap::new(0.0, 0.0, 0.0, 0.0),
            player_data: FxHashMap::default(),
            session_id: Uuid::default(),
            session_name: String::default(),
            host_id: Uuid::default(),
            config: SessionConfig {
                max_username_len: 0,
                max_users: 0,
            },
            status: SessionStatus::Uninit,
        }
    }
}

#[inline]
fn process_global_messages(
    global_rx: &mut mpsc::Receiver<ChannelData>,
    sessions: &mut Pool<Uuid, (Session, SessionState)>,
    global_channels: &mut Pool<SocketAddr, (Rx, Tx)>,
    config: &ConfigOptions,
) {
    const MAX_READ_COUNT_GLOBAL: u32 = 32;
    let mut read_count = 0;

    while let Ok(Some(message)) = global_rx.try_next() {
        match message {
            ChannelData::Connect { addr, tx, rx } => {
                global_channels.push(addr, (rx, tx));
                println!("{addr} connected");
            }
            ChannelData::Disconnect(addr) => {
                global_channels.pop(&addr);
            }
        }

        read_count += 1;
        if read_count >= MAX_READ_COUNT_GLOBAL {
            break;
        }
    }

    const MAX_READ_COUNT_SESSION_LOCAL: u32 = 64;
    let mut read_count;

    let mut msgs = vec![];

    for (addr, (rx, tx)) in global_channels.items() {
        read_count = 0;

        'read_loop: while let Ok(Some(msg)) = rx.try_next() {
            use crate::session::MessageParseResult;
            let msg = crate::parse_msg!(msg);
            match msg {
                MessageParseResult::ToTextError | MessageParseResult::SerdeError(_) => {
                    continue 'read_loop
                }
                MessageParseResult::Parsed(msg) => msgs.push((*addr, msg)),
            }

            read_count += 1;
            if read_count >= MAX_READ_COUNT_SESSION_LOCAL {
                break 'read_loop;
            }
        }
    }

    use crate::session::PlayerChannel;
    use crate::session_exec::RxData;
    for (addr, msg) in msgs {
        match msg {
            RxData::Login {
                session_id,
                user_id,
            } => {
                if let None = sessions.get_mut(&session_id) {
                    continue;
                }
                if let Some((session, res)) = sessions.get_mut(&session_id) {
                    let (addr, (rx, tx)) = global_channels.pop(&addr).unwrap();
                    if let Err(PlayerChannel { addr, rx, tx }) =
                        session.login_user(res, addr, user_id, PlayerChannel { addr, rx, tx })
                    {
                        global_channels.push(addr, (rx, tx));
                    }
                }
            }
            RxData::CreateSession {
                session_name,
                username,
                wait_time,
            } => {
                // if sessions.items_ref().len() >= config.session_exec.max_sessions
                //     || username.len() > config.session.max_username_len
                //     || (sessions
                //         .items_ref()
                //         .iter()
                //         .filter(|(_, (session, _))| {
                //             if let SessionStatus::Waiting { .. } = session.status() {
                //                 true
                //             } else {
                //                 false
                //             }
                //         })
                //         .count()
                //         > 0
                //         && !config.session_exec.allow_multiple_inactive_sessions)
                // {
                //     continue;
                // }
                if let Some((session, state)) = create_session(
                    session_name,
                    username,
                    wait_time,
                    &addr,
                    global_channels,
                    config.session,
                ) {
                    sessions.push(state.session_id, (session, state));
                }
            }
            RxData::CreateUser {
                session_id,
                username,
            } => {
                if let Some((session, resources)) = sessions.get_mut(&session_id) {
                    let (addr, (rx, tx)) = global_channels.pop(&addr).unwrap();
                    match session.create_user(
                        resources,
                        addr,
                        PlayerChannel { addr, rx, tx },
                        username,
                    ) {
                        Err(PlayerChannel { tx, rx, addr }) => global_channels.push(addr, (rx, tx)),
                        _ => (),
                    }
                }
            }
            RxData::Query { query } => process_query(
                query,
                sessions,
                &mut global_channels.get_mut(&addr).unwrap().1,
            ),
            _ => println!("[UNHANDLED MESSAGE CASE TRIGGERED]"),
        }
    }
}
use crate::config_options::SessionConfig;
use crate::session::PlayerChannel;
use crate::session::SessionStatus;
use crate::session_exec::QueryResponseType;
use crate::session_exec::QueryType;
use crate::session_exec::SessionStatusSimplified;
use crate::session_exec::TxData;

fn create_session(
    session_name: String,
    username: String,
    wait_time: u64,
    addr: &SocketAddr,
    channels: &mut Pool<SocketAddr, (Rx, Tx)>,
    config: SessionConfig,
) -> Option<(Session, SessionState)> {
    println!("creating session by {username}, {addr} - {session_name}");
    let (addr, (rx, tx)) = channels.pop(addr).unwrap();

    let mut resources = SessionState::default();
    match Session::new(&mut resources, session_name, config).with_host(
        &mut resources,
        PlayerChannel { addr, rx, tx },
        username,
        addr,
        wait_time,
    ) {
        Ok(session) => Some((session, resources)),
        Err(PlayerChannel { tx, rx, addr }) => {
            channels.push(addr, (rx, tx));
            None
        }
    }
}

fn process_query(
    query: QueryType,
    sessions: &mut Pool<Uuid, (Session, SessionState)>,
    tx: &mut Tx,
) {
    match query {
        QueryType::LeaderBoard { session_id } => {
            if let Some((session, state)) = sessions.get(&session_id) {
                let _ = send_msg!(
                    tx,
                    &TxData::QueryResponse {
                        query_res: QueryResponseType::LeaderBoard {
                            session_id,
                            scores: session.get_leaderboard(state),
                        }
                    }
                );
            }
        }
        QueryType::SessionStatus { session_id } => {
            if let Some((session, state)) = sessions.get(&session_id) {
                let (status, duration) = session.get_status(state);
                let _ = send_msg!(
                    tx,
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
            let _ = send_msg!(
                tx,
                &TxData::QueryResponse {
                    query_res: QueryResponseType::Sessions {
                        sessions: sessions
                            .items_ref()
                            .iter()
                            .map(|(id, (session, state))| {
                                let status = match state.status {
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
                                    *id,
                                    state.session_name.to_owned(),
                                    status,
                                    state
                                        .player_data
                                        .iter()
                                        .map(|(_, p)| p.username().to_owned())
                                        .collect(),
                                )
                            })
                            .collect()
                    }
                }
            );
        }
    }
}

pub fn start(channel_rx: mpsc::Receiver<ChannelData>, config: ConfigOptions) {
    let mut global_rx = channel_rx;
    // let mut session_exec = SessionExecutor::new_with_channel(channel_rx, config);

    let mut sessions: Pool<Uuid, (Session, SessionState)> = Pool::new();
    let mut global_channels: Pool<SocketAddr, (Rx, Tx)> = Pool::new();

    loop {
        process_global_messages(&mut global_rx, &mut sessions, &mut global_channels, &config);
        for (_, (session, res)) in sessions.items() {
            session.game_loop(res);
        }
    }
}
