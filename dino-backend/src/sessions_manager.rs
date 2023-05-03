use crate::session::Session;
use crate::{config_options::ConfigOptions, session_exec::ChannelData, SessionExecutor};
use std::pin::Pin;
use std::{
    future::Future,
    process::Output,
    task::{Context, Poll},
};
use futures_util::join;
use rustc_hash::FxHashMap;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;



pub fn start(channel_rx: mpsc::Receiver<ChannelData>, config: ConfigOptions) {
    let mut session_exec = SessionExecutor::new_with_channel(channel_rx, config);
    //
    // let mut sessions: Vec<Session> = Vec::new();
    // let mut session_idxs: FxHashMap<Uuid, usize> = FxHashMap::default();

    loop {
        session_exec.poll_main_channel();
        session_exec.poll_sub_channels();
        session_exec.run();
    }

}
