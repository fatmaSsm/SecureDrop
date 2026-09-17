use argon2::{
    password_hash::{
        PasswordHash,
        PasswordHasher,
        PasswordVerifier,
        SaltString,
    },
    Argon2,
};
use axum::http::{header::AUTHORIZATION, HeaderMap};
use rand::Rng;
use rand_core_06::OsRng;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::Path,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

const AUTH_FILE: &str = "auth.json";
const MIN_PASSWORD_LENGTH: usize = 8;
const SESSION_DURATION: Duration = Duration::from_secs(8 * 60 * 60);

#[derive(Clone)]
pub struct AuthState {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

struct Session {
    username: String,
    expires_at: Instant,
}

#[derive(Serialize, Deserialize)]
struct StoredAccount {
    username: String,
    password_hash: String,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn is_configured(&self) -> bool {
        Path::new(AUTH_FILE).exists()
    }

    pub fn configured_username(&self) -> Option<String> {
        read_account().ok().map(|account| account.username)
    }

    pub async fn setup(
        &self,
        username: &str,
        password: &str,
    ) -> Result<String, String> {
        if self.is_configured() {
            return Err("A local account has already been configured.".to_string());
        }

        validate_credentials(username, password)?;

        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|_| "Could not securely hash the password.".to_string())?
            .to_string();

        let account = StoredAccount {
            username: username.trim().to_string(),
            password_hash,
        };

        let json = serde_json::to_vec_pretty(&account)
            .map_err(|error| format!("Could not serialize local account: {error}"))?;

        fs::write(AUTH_FILE, json)
            .map_err(|error| format!("Could not save local account: {error}"))?;

        Ok(self.create_session(&account.username).await)
    }

    pub async fn login(
        &self,
        username: &str,
        password: &str,
    ) -> Result<String, String> {
        let account = read_account()
            .map_err(|_| "Local account is not configured correctly.".to_string())?;

        if account.username != username.trim() {
            return Err("Invalid username or password.".to_string());
        }

        let parsed_hash = PasswordHash::new(&account.password_hash)
            .map_err(|_| "Stored password hash is invalid.".to_string())?;

        if Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_err()
        {
            return Err("Invalid username or password.".to_string());
        }

        Ok(self.create_session(&account.username).await)
    }

    pub async fn username_for_headers(
        &self,
        headers: &HeaderMap,
    ) -> Option<String> {
        let token = bearer_token(headers)?;
        let mut sessions = self.sessions.write().await;

        let is_expired = sessions
            .get(token)
            .map(|session| Instant::now() > session.expires_at)
            .unwrap_or(false);

        if is_expired {
            sessions.remove(token);
            return None;
        }

        sessions.get(token).map(|session| session.username.clone())
    }

    pub async fn logout(&self, headers: &HeaderMap) {
        if let Some(token) = bearer_token(headers) {
            self.sessions.write().await.remove(token);
        }
    }

    async fn create_session(&self, username: &str) -> String {
        let mut random_bytes = [0u8; 32];
        rand::rng().fill_bytes(&mut random_bytes);

        let token = random_bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();

        self.sessions
            .write()
            .await
            .insert(
                token.clone(),
                Session {
                    username: username.to_string(),
                    expires_at: Instant::now() + SESSION_DURATION,
                },
            );

        token
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
}

fn validate_credentials(username: &str, password: &str) -> Result<(), String> {
    let username = username.trim();

    if username.len() < 2 || username.len() > 40 {
        return Err("Username must be between 2 and 40 characters.".to_string());
    }

    if username.chars().any(char::is_control) {
        return Err("Username contains unsupported characters.".to_string());
    }

    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must contain at least {MIN_PASSWORD_LENGTH} characters."
        ));
    }

    Ok(())
}

fn read_account() -> Result<StoredAccount, String> {
    let bytes = fs::read(AUTH_FILE)
        .map_err(|error| format!("Could not read local account: {error}"))?;

    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse local account: {error}"))
}
