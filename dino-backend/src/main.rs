mod config_options;
mod map_generator;
mod math;
mod obstacles;
mod session;
mod session_exec;
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
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message;

use crate::session_exec::ChannelData;
use crate::session_exec::SessionExecutor;

type Tx = mpsc::Sender<Message>;
type SessionExecSync = Arc<Mutex<SessionExecutor>>;

async fn handle_connection(
    session_channel: mpsc::Sender<ChannelData>,
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

    match session_channel
        .send(ChannelData::Connect {
            addr,
            tx: transmitter_tx,
            rx: receiver_rx,
        })
        .await
    {
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

    match session_channel.send(ChannelData::Disconnect(addr)).await {
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

    let session_tx_tmp = session_tx.clone();
    let session_exec_thread = std::thread::spawn(move || {
        let mut session_exec =
            SessionExecutor::new_with_channel((session_tx_tmp, session_rx), config);
        loop {
            session_exec.poll_main_channel();
            session_exec.poll_sub_channels();
            session_exec.run();
        }
    });

    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(session_tx.clone(), stream, addr));
    }

    session_exec_thread.join().unwrap();

    Ok(())
}
