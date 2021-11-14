mod map_generator;
mod math;
mod session;
mod session_exec;
mod validator;

use std::{
    io::Error as IoError,
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use futures_channel::mpsc::unbounded;
use futures_util::{future, pin_mut, stream::TryStreamExt, SinkExt, StreamExt};

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

    // Insert the write part of this peer to the peer map.
    let (tx, rx) = unbounded();
    // peer_map.lock().unwrap().insert(addr, tx);

    match session_channel
        .send(ChannelData::Connect { addr, tx })
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
        println!(
            "Received a message from {}: {}",
            addr,
            msg.to_text().unwrap()
        );
        // session_channel.send(ChannelData::Message(msg));
        match session_channel.try_send(ChannelData::Message { addr, msg }) {
            Err(err) => panic!("Failed sending message to session executor: {}", err),
            _ => (),
        }
        future::ok(())
    });

    let recv_from_session_exec = rx.map(Ok).forward(outgoing);

    pin_mut!(broadcast_incoming, recv_from_session_exec);
    future::select(broadcast_incoming, recv_from_session_exec).await;

    match session_channel.send(ChannelData::Disconnect(addr)).await {
        Err(err) => panic!(
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
    let addr = "127.0.0.1:8080";

    // let state = PeerMap::new(Mutex::new(HashMap::new()));
    let try_socket = TcpListener::bind(addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", addr);

    //FIXME: not sure what the buffer size should be;
    let session_exec_channel = mpsc::channel(2048);
    let (session_tx, session_rx) = session_exec_channel;

    let session_tx_tmp = session_tx.clone();
    let session_exec_thread = std::thread::spawn(move || {
        let mut session_exec = SessionExecutor::new_with_channel((session_tx_tmp, session_rx));
        loop {
            session_exec.poll_channel();
            session_exec.run();
        }
    });

    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(session_tx.clone(), stream, addr));
    }

    session_exec_thread.join().unwrap();

    Ok(())
}
