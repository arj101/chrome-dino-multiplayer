#[derive(Clone, Copy)]
pub struct ConfigOptions {
    pub session_exec: SessionExecConfig,
    pub session: SessionConfig,
}

#[derive(Clone, Copy)]
pub struct SessionExecConfig {
    pub max_sessions: usize,
    pub allow_multiple_inactive_sessions: bool,
    pub dummy_sessions: bool,
}

#[derive(Clone, Copy)]
pub struct SessionConfig {
    pub max_users: usize,
    pub max_username_len: usize,
}
