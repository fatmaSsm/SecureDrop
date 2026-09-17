use rand::Rng;

use std::fs;
use std::path::{Path, PathBuf};

pub const STORAGE_FOLDER: &str = "secure_files";


// ============================================================
// STORAGE INITIALIZATION
// ============================================================

pub fn ensure_storage_folder() -> Result<(), String> {
    fs::create_dir_all(STORAGE_FOLDER)
        .map_err(|error| {
            format!(
                "Could not create storage folder: {}",
                error
            )
        })
}


// ============================================================
// PATH
// ============================================================

pub fn file_path(filename: &str) -> PathBuf {
    Path::new(STORAGE_FOLDER)
        .join(filename)
}


// ============================================================
// SAFE FILENAME
// ============================================================

pub fn is_safe_filename(name: &str) -> bool {
    let path = Path::new(name);

    path.file_name()
        .map(|file_name| {
            file_name.to_string_lossy() == name
        })
        .unwrap_or(false)
}


// ============================================================
// RANDOM STORAGE ID
// ============================================================

pub fn generate_storage_name() -> String {
    loop {
        // 16 random bytes = 128-bit random ID
        let mut random_bytes = [0u8; 16];

        rand::rng()
            .fill_bytes(&mut random_bytes);

        // Convert random bytes to hexadecimal text
        let id = random_bytes
            .iter()
            .map(|byte| format!("{:02x}", byte))
            .collect::<String>();

        let filename =
            format!("{}.enc", id);

        // Extremely unlikely collision,
        // but we still check just in case.
        if !file_path(&filename).exists() {
            return filename;
        }
    }
}