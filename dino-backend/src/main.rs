mod config_options;
mod map_generator;
mod math;
mod obstacles;
mod session;
// mod session_exec;
mod sessions_manager;
mod validator;

use std::{
    io::Error as IoError,
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use config_options::{ConfigOptions, SessionConfig, SessionExecConfig};

use futures_channel::mpsc::unbounded;
use futures_util::{future, pin_mut, stream::TryStreamExt, StreamExt};

use tokio::net::{TcpListener, TcpStream};
// use tokio::sync::mpsc;
use futures_channel::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message;

mod session_exec {
    use crate::Message;
    use std::net::SocketAddr;
    use uuid::Uuid;
    use crate::obstacles::Obstacle;
    use serde::{Deserialize, Serialize};

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

        Broadcast {
            username: String,
            pos: [f32; 2],
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

        BroadcastReq {
            pos: [f32; 2],
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
            tx: futures_channel::mpsc::UnboundedSender<Message>,
            rx: futures_channel::mpsc::UnboundedReceiver<Message>,
        },
        Disconnect(SocketAddr),
    }
}

use crate::session_exec::ChannelData;
// use crate::session_exec::SessionExecutor;

type Tx = mpsc::Sender<Message>;
/* type SessionExecSync = Arc<Mutex<SessionExecutor>>; */

const MESSAGE_CHANNEL_CAPACITY: usize = 2048;

async fn handle_connection(
    mut session_channel: mpsc::Sender<ChannelData>,
    raw_stream: TcpStream,
    addr: SocketAddr,
) {
    println!("Incoming TCP connection from: {}", addr);

    let ws_stream = tokio_tungstenite::accept_async(raw_stream)
        .await
        .expect("Error during the websocket handshake occurred");
    println!("WebSocket connection established: {}", addr);

    //the main channel (session_channel) is used to send channels over to the individual sessions
    //so they can directly communicate with connection handlers without SessionExecutor being in
    //the middle

    // Insert the write part of this peer to the peer map.
    let (transmitter_tx, transmitter_rx) = unbounded(); //from the perspective of `Session`
    let (receiver_tx, receiver_rx) = unbounded();
    // peer_map.lock().unwrap().insert(addr, tx);

    match session_channel.try_send(ChannelData::Connect {
        addr,
        tx: transmitter_tx,
        rx: receiver_rx,
    }) {
        Err(err) => panic!(
            "Failed to send `{}`'s connect message to session executor: {}",
            &addr, err
        ),
        Ok(_) => println!(
            "Succesfully sent `{}'s` connect message to session executor.",
            &addr
        ),
    }

    let (outgoing, incoming) = ws_stream.split();

    let broadcast_incoming = incoming.try_for_each(|msg| {
        #[cfg(debug)]
        println!(
            "Received a message from {}: {}",
            addr,
            msg.to_text().unwrap()
        );
        // session_channel.send(ChannelData::Message(msg));
        match receiver_tx.unbounded_send(msg) {
            Err(err) => println!("Failed sending message to session executor: {}", err),
            _ => (),
        }
        future::ok(())
    });

    let recv_from_session_exec = transmitter_rx.map(Ok).forward(outgoing);

    pin_mut!(broadcast_incoming, recv_from_session_exec);
    future::select(broadcast_incoming, recv_from_session_exec).await;

    match session_channel.try_send(ChannelData::Disconnect(addr)) {
        Err(err) => println!(
            "Failed to send `{}`s disconnect message to session executor: {}",
            &addr, err
        ),
        Ok(_) => println!(
            "Succesfully sent `{}`'s disconnect message to session executor.",
            &addr
        ),
    }

    // peer_map.lock().unwrap().remove(&addr);
}

#[tokio::main]
async fn main() -> Result<(), IoError> {
    let port = std::env::var("PORT")
        .unwrap_or("8080".to_string())
        .parse::<usize>();
    let ip = std::env::var("IP_ADDR").unwrap_or("127.0.0.1".to_string());
    let addr = &format!("{}:{}", ip, port.unwrap_or(8080));
    let config = ConfigOptions {
        session: SessionConfig {
            max_users: 20,
            max_username_len: 15,
        },
        session_exec: SessionExecConfig {
            max_sessions: 10,
            allow_multiple_inactive_sessions: true,
            dummy_sessions: false,
        },
    };

    // let state = PeerMap::new(Mutex::new(HashMap::new()));
    let try_socket = TcpListener::bind(addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", addr);

    //FIXME: not sure what the buffer size should be;
    let session_exec_channel = mpsc::channel(2048);
    let (session_tx, session_rx) = session_exec_channel;

    // let session_exec_thread = std::thread::spawn(move || {
    //     let mut session_exec =
    //         SessionExecutor::new_with_channel((session_tx_tmp, session_rx), config);
    //     loop {
    //         session_exec.poll_main_channel();
    //         session_exec.poll_sub_channels();
    //         session_exec.run();
    //     }
    // });
    tokio::task::spawn_blocking(move || sessions_manager::start(session_rx, config));

    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(session_tx.clone(), stream, addr));
    }

    // session_exec_thread.join().unwrap();

    Ok(())
}
