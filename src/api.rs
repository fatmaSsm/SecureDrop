use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::fs;
use tower_http::services::{ServeDir, ServeFile};

use crate::{auth::AuthState, storage};

const MAX_FILE_SIZE: usize = 100 * 1024 * 1024;
const MAX_REQUEST_SIZE: usize = MAX_FILE_SIZE + 1024 * 1024;

#[derive(Clone)]
struct AppState {
    auth: AuthState,
}

#[derive(Serialize)]
struct ApiResponse {
    success: bool,
    message: String,
    filename: Option<String>,
}

#[derive(Serialize)]
struct FileInfo {
    id: String,
    name: String,
    size_bytes: u64,
    is_encrypted: bool,
}

#[derive(Deserialize)]
struct AuthRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct AuthStatusResponse {
    configured: bool,
    username: Option<String>,
}

#[derive(Serialize)]
struct AuthResponse {
    success: bool,
    message: String,
    username: Option<String>,
    token: Option<String>,
}

#[derive(Serialize)]
struct SessionResponse {
    authenticated: bool,
    username: Option<String>,
}

pub fn create_router() -> Router {
    let state = AppState {
        auth: AuthState::new(),
    };

    let frontend = ServeDir::new("frontend/dist")
        .fallback(ServeFile::new("frontend/dist/index.html"));

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/status", get(auth_status))
        .route("/api/auth/setup", post(auth_setup))
        .route("/api/auth/login", post(auth_login))
        .route("/api/auth/logout", post(auth_logout))
        .route("/api/auth/session", get(auth_session))
        .route("/api/files", get(list_files).post(upload_file))
        .route("/api/files/{name}/download", get(download_file))
        .route("/api/files/{name}", delete(delete_file))
        .fallback_service(frontend)
        .layer(DefaultBodyLimit::max(MAX_REQUEST_SIZE))
        .with_state(state)
}

async fn health() -> Json<ApiResponse> {
    Json(ApiResponse {
        success: true,
        message: "SecureDrop API is running.".to_string(),
        filename: None,
    })
}

async fn auth_status(
    State(state): State<AppState>,
) -> Json<AuthStatusResponse> {
    Json(AuthStatusResponse {
        configured: state.auth.is_configured(),
        username: state.auth.configured_username(),
    })
}

async fn auth_setup(
    State(state): State<AppState>,
    Json(request): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<AuthResponse>)> {
    match state.auth.setup(&request.username, &request.password).await {
        Ok(token) => Ok(Json(AuthResponse {
            success: true,
            message: "Local SecureDrop account created.".to_string(),
            username: Some(request.username.trim().to_string()),
            token: Some(token),
        })),
        Err(message) => Err((
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                message,
                username: None,
                token: None,
            }),
        )),
    }
}

async fn auth_login(
    State(state): State<AppState>,
    Json(request): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<AuthResponse>)> {
    match state.auth.login(&request.username, &request.password).await {
        Ok(token) => Ok(Json(AuthResponse {
            success: true,
            message: "Signed in successfully.".to_string(),
            username: Some(request.username.trim().to_string()),
            token: Some(token),
        })),
        Err(message) => Err((
            StatusCode::UNAUTHORIZED,
            Json(AuthResponse {
                success: false,
                message,
                username: None,
                token: None,
            }),
        )),
    }
}

async fn auth_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<SessionResponse>, (StatusCode, Json<SessionResponse>)> {
    if let Some(username) = state.auth.username_for_headers(&headers).await {
        return Ok(Json(SessionResponse {
            authenticated: true,
            username: Some(username),
        }));
    }

    Err((
        StatusCode::UNAUTHORIZED,
        Json(SessionResponse {
            authenticated: false,
            username: None,
        }),
    ))
}

async fn auth_logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<ApiResponse> {
    state.auth.logout(&headers).await;

    Json(ApiResponse {
        success: true,
        message: "Signed out.".to_string(),
        filename: None,
    })
}

async fn list_files(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<FileInfo>>, (StatusCode, Json<ApiResponse>)> {
    require_auth(&state, &headers).await?;

    let entries = fs::read_dir(storage::STORAGE_FOLDER).map_err(|error| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Could not read storage folder: {error}"),
        )
    })?;

    let mut files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| {
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Could not read directory entry: {error}"),
            )
        })?;

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let storage_name = entry.file_name().to_string_lossy().to_string();
        if !storage_name.ends_with(".enc") {
            continue;
        }

        let encrypted_data = match fs::read(&path) {
            Ok(data) => data,
            Err(_) => continue,
        };

        let (original_name, original_size, _file_data) =
            match crate::crypto::decrypt_file_package(&encrypted_data) {
                Ok(package) => package,
                Err(_) => continue,
            };

        files.push(FileInfo {
            id: storage_name,
            name: original_name,
            size_bytes: original_size,
            is_encrypted: true,
        });
    }

    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(Json(files))
}

async fn upload_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<ApiResponse>), (StatusCode, Json<ApiResponse>)> {
    require_auth(&state, &headers).await?;

    while let Some(field) = multipart.next_field().await.map_err(|error| {
        api_error(
            StatusCode::BAD_REQUEST,
            format!("Could not read multipart data: {error}"),
        )
    })? {
        let file_name = match field.file_name() {
            Some(name) => name.to_string(),
            None => continue,
        };

        if !storage::is_safe_filename(&file_name) {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "Invalid filename.".to_string(),
            ));
        }

        let data = field.bytes().await.map_err(|error| {
            api_error(
                StatusCode::BAD_REQUEST,
                format!("Could not read uploaded file: {error}"),
            )
        })?;

        if data.len() > MAX_FILE_SIZE {
            return Err(api_error(
                StatusCode::PAYLOAD_TOO_LARGE,
                "File is too large. Maximum size is 100 MB.".to_string(),
            ));
        }

        let encrypted_data = crate::crypto::encrypt_file_package(&file_name, &data)
            .map_err(|message| api_error(StatusCode::INTERNAL_SERVER_ERROR, message))?;

        let storage_name = storage::generate_storage_name();
        let file_path = storage::file_path(&storage_name);

        fs::write(&file_path, encrypted_data).map_err(|error| {
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Could not save encrypted file: {error}"),
            )
        })?;

        return Ok((
            StatusCode::CREATED,
            Json(ApiResponse {
                success: true,
                message: "File encrypted and stored successfully.".to_string(),
                filename: Some(file_name),
            }),
        ));
    }

    Err(api_error(
        StatusCode::BAD_REQUEST,
        "No file was uploaded.".to_string(),
    ))
}

async fn download_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<(
    [(header::HeaderName, String); 2],
    Vec<u8>,
), (StatusCode, Json<ApiResponse>)> {
    require_auth(&state, &headers).await?;
    validate_storage_id(&name)?;

    let file_path = storage::file_path(&name);
    if !file_path.exists() {
        return Err(api_error(StatusCode::NOT_FOUND, "File not found.".to_string()));
    }

    let encrypted_data = fs::read(&file_path).map_err(|error| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Could not read encrypted file: {error}"),
        )
    })?;

    let (original_name, _original_size, decrypted_data) =
        crate::crypto::decrypt_file_package(&encrypted_data)
            .map_err(|message| api_error(StatusCode::INTERNAL_SERVER_ERROR, message))?;

    let safe_name = sanitize_download_filename(&original_name);
    let content_disposition = format!("attachment; filename=\"{safe_name}\"");

    Ok((
        [
            (header::CONTENT_TYPE, "application/octet-stream".to_string()),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        decrypted_data,
    ))
}

async fn delete_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<(StatusCode, Json<ApiResponse>), (StatusCode, Json<ApiResponse>)> {
    require_auth(&state, &headers).await?;
    validate_storage_id(&name)?;

    let file_path = storage::file_path(&name);
    if !file_path.exists() {
        return Err(api_error(StatusCode::NOT_FOUND, "File not found.".to_string()));
    }

    fs::remove_file(&file_path).map_err(|error| {
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Could not delete file: {error}"),
        )
    })?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            message: "File deleted successfully.".to_string(),
            filename: Some(name),
        }),
    ))
}

async fn require_auth(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<String, (StatusCode, Json<ApiResponse>)> {
    state
        .auth
        .username_for_headers(headers)
        .await
        .ok_or_else(|| {
            api_error(
                StatusCode::UNAUTHORIZED,
                "Authentication required.".to_string(),
            )
        })
}

fn validate_storage_id(
    name: &str,
) -> Result<(), (StatusCode, Json<ApiResponse>)> {
    if !storage::is_safe_filename(name) || !name.ends_with(".enc") {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "Invalid encrypted file ID.".to_string(),
        ));
    }

    Ok(())
}

fn sanitize_download_filename(name: &str) -> String {
    name.chars()
        .map(|character| match character {
            '\r' | '\n' | '"' | '\\' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect()
}

fn api_error(
    status: StatusCode,
    message: String,
) -> (StatusCode, Json<ApiResponse>) {
    (
        status,
        Json(ApiResponse {
            success: false,
            message,
            filename: None,
        }),
    )
}
