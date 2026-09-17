mod api;
mod auth;
mod crypto;
mod storage;

#[tokio::main]
async fn main() {
    storage::ensure_storage_folder()
        .expect("Could not initialize storage.");

    let app = api::create_router();

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Could not bind SecureDrop to 127.0.0.1:3000.");

    println!("SecureDrop running at http://127.0.0.1:3000");
    println!("API health: http://127.0.0.1:3000/api/health");

    axum::serve(listener, app)
        .await
        .expect("SecureDrop server stopped unexpectedly.");
}
