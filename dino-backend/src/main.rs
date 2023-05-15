mod config_options;
mod map_generator;
mod math;
mod obstacles;
mod session;
mod session_exec;
mod validator;
use std::{
    io::{Error as IoError, ErrorKind},
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio_rustls::rustls::{self, Certificate, PrivateKey};
use tokio_rustls::TlsAcceptor;

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

use rustls_pemfile::{certs, rsa_private_keys};

const MESSAGE_CHANNEL_CAPACITY: usize = 2048;

async fn handle_connection(
    session_channel: mpsc::Sender<ChannelData>,
    acceptor: TlsAcceptor,
    raw_stream: TcpStream,
    addr: SocketAddr,
) {
    println!("Incoming TCP connection from: {}", addr);

    let stream = acceptor.accept(raw_stream).await.expect("failed to create tls stream");
    let ws_stream = tokio_tungstenite::accept_async(stream)
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
        use session_exec::RxData;
        if let Ok(msg) = msg.to_text() {
            match serde_json::from_str::<RxData>(msg) {
                Ok(msg) => match receiver_tx.unbounded_send(msg) {
                    Err(err) => println!("Failed sending message to session executor: {}", err),
                    _ => (),
                },
                Err(err) => {
                    #[cfg(debug_assertions)]
                    println!("Error parsing incoming message: {err:?}")
                }
            }
        }
        future::ok(())
    });

    let recv_from_session_exec = transmitter_rx
        .map(|tx_data| Ok(Message::Text(serde_json::to_string(&tx_data).unwrap())))
        .forward(outgoing);

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

use std::fs::File;
use std::io::{self, BufReader};
use std::path::Path;

fn load_certs(path: &Path) -> io::Result<Vec<Certificate>> {
    certs(&mut BufReader::new(File::open(path)?))
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid cert"))
        .map(|mut certs| certs.drain(..).map(Certificate).collect())
}

fn load_keys(path: &Path) -> io::Result<Vec<PrivateKey>> {
    rustls_pemfile::pkcs8_private_keys(&mut BufReader::new(File::open(path)?))
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid key"))
        .map(|mut keys| keys.drain(..).map(PrivateKey).collect())
}

#[tokio::main]
async fn main() -> Result<(), IoError> {
    let port = std::env::var("PORT")
        .unwrap_or("8080".to_string())
        .parse::<usize>();
    let ip = std::env::var("IP_ADDR").unwrap_or("127.0.0.1".to_string());
    let addr = &format!("{}:{}", ip, port.unwrap_or(8080));
    let server_config = ConfigOptions {
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

    let cert_path = std::env::var("SSL_CERT_PATH").unwrap_or("../../certs/cert.pem".to_owned());
    let cert_path = Path::new(&cert_path);
    let key_path = std::env::var("SSL_KEY_PATH").unwrap_or("../../certs/key.pem".to_owned());
    let key_path = Path::new(&key_path);

    let certs = load_certs(cert_path)?;
    let mut keys = load_keys(key_path)?;



    let tls_config = rustls::ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(certs, keys.remove(0))
        .map_err(|err| io::Error::new(io::ErrorKind::InvalidInput, err))?;
    let acceptor = TlsAcceptor::from(Arc::new(tls_config));
    // let state = PeerMap::new(Mutex::new(HashMap::new()));
    let try_socket = TcpListener::bind(addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", addr);

    //FIXME: not sure what the buffer size should be;
    let session_exec_channel = mpsc::channel(2048);
    let (session_tx, session_rx) = session_exec_channel;
    let session_exec_thread = tokio::task::spawn_blocking(move || {
        let mut session_exec = SessionExecutor::new_with_channel(session_rx, server_config);
        loop {
            session_exec.poll_main_channel();
            session_exec.poll_sub_channels();
            session_exec.run();
        }
    });

    while let Ok((stream, addr)) = listener.accept().await {
        let acceptor = acceptor.clone();
        tokio::spawn(handle_connection(session_tx.clone(), acceptor, stream, addr));
           
    }

    futures_util::join!(session_exec_thread);

    Ok(())
}
