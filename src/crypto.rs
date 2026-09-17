use aes_gcm::{
    aead::{Aead, Generate, KeyInit},
    Aes256Gcm, Key, Nonce,
};

use std::fs;
use std::path::Path;

const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;


// ============================================================
// KEY
// ============================================================

fn load_or_create_key() -> Result<Key<Aes256Gcm>, String> {
    let key_path = Path::new("secret.key");

    if key_path.exists() {
        let key_bytes =
            fs::read(key_path)
                .map_err(|error| {
                    format!(
                        "Could not read encryption key: {}",
                        error
                    )
                })?;

        return Key::<Aes256Gcm>::try_from(
            key_bytes.as_slice()
        )
        .map_err(|_| {
            "Invalid encryption key length."
                .to_string()
        });
    }

    let key = Key::<Aes256Gcm>::generate();

    fs::write(
        key_path,
        key.as_slice(),
    )
    .map_err(|error| {
        format!(
            "Could not save encryption key: {}",
            error
        )
    })?;

    println!("New encryption key created.");

    Ok(key)
}


// ============================================================
// CREATE ENCRYPTED FILE PACKAGE
// ============================================================

pub fn encrypt_file_package(
    filename: &str,
    data: &[u8],
) -> Result<Vec<u8>, String> {
    let filename_bytes =
        filename.as_bytes();

    let filename_length =
        u32::try_from(filename_bytes.len())
            .map_err(|_| {
                "Filename is too long."
                    .to_string()
            })?;

    /*
        Plaintext package format:

        [4 bytes] filename length
        [N bytes] original filename
        [8 bytes] original file size
        [remaining] original file data
    */

    let mut package = Vec::with_capacity(
        4
            + filename_bytes.len()
            + 8
            + data.len()
    );

    package.extend_from_slice(
        &filename_length.to_be_bytes()
    );

    package.extend_from_slice(
        filename_bytes
    );

    package.extend_from_slice(
        &(data.len() as u64).to_be_bytes()
    );

    package.extend_from_slice(data);

    encrypt_data(&package)
}


// ============================================================
// READ DECRYPTED FILE PACKAGE
// ============================================================

pub fn decrypt_file_package(
    encrypted_data: &[u8],
) -> Result<(String, u64, Vec<u8>), String> {
    let package =
        decrypt_data(encrypted_data)?;

    if package.len() < 12 {
        return Err(
            "Encrypted file package is invalid."
                .to_string()
        );
    }

    let filename_length =
        u32::from_be_bytes(
            package[0..4]
                .try_into()
                .map_err(|_| {
                    "Invalid filename metadata."
                        .to_string()
                })?
        ) as usize;

    let filename_end =
        4usize
            .checked_add(filename_length)
            .ok_or_else(|| {
                "Invalid filename metadata."
                    .to_string()
            })?;

    let size_end =
        filename_end
            .checked_add(8)
            .ok_or_else(|| {
                "Invalid file metadata."
                    .to_string()
            })?;

    if package.len() < size_end {
        return Err(
            "Encrypted file package is corrupted."
                .to_string()
        );
    }

    let filename =
        String::from_utf8(
            package[4..filename_end]
                .to_vec()
        )
        .map_err(|_| {
            "Filename is not valid UTF-8."
                .to_string()
        })?;

    let original_size =
        u64::from_be_bytes(
            package[filename_end..size_end]
                .try_into()
                .map_err(|_| {
                    "Invalid file size metadata."
                        .to_string()
                })?
        );

    let file_data =
        package[size_end..].to_vec();

    if file_data.len() as u64
        != original_size
    {
        return Err(
            "File size metadata does not match file data."
                .to_string()
        );
    }

    Ok((
        filename,
        original_size,
        file_data,
    ))
}


// ============================================================
// RAW ENCRYPT
// ============================================================

fn encrypt_data(
    data: &[u8],
) -> Result<Vec<u8>, String> {
    let key =
        load_or_create_key()?;

    let cipher =
        Aes256Gcm::new(&key);

    let nonce =
        Nonce::generate();

    let ciphertext =
        cipher
            .encrypt(
                &nonce,
                data,
            )
            .map_err(|_| {
                "Encryption failed."
                    .to_string()
            })?;

    let mut output =
        Vec::with_capacity(
            NONCE_SIZE + ciphertext.len()
        );

    output.extend_from_slice(
        &nonce
    );

    output.extend_from_slice(
        &ciphertext
    );

    Ok(output)
}


// ============================================================
// RAW DECRYPT
// ============================================================

fn decrypt_data(
    data: &[u8],
) -> Result<Vec<u8>, String> {
    if data.len() < NONCE_SIZE {
        return Err(
            "Encrypted data is too small."
                .to_string()
        );
    }

    let (
        nonce_bytes,
        ciphertext,
    ) = data.split_at(NONCE_SIZE);

    let key =
        load_or_create_key()?;

    if key.len() != KEY_SIZE {
        return Err(
            "Invalid encryption key length."
                .to_string()
        );
    }

    let cipher =
        Aes256Gcm::new(&key);

    let nonce =
        Nonce::try_from(nonce_bytes)
            .map_err(|_| {
                "Invalid nonce length."
                    .to_string()
            })?;

    cipher
        .decrypt(
            &nonce,
            ciphertext,
        )
        .map_err(|_| {
            "Decryption failed. Wrong key or corrupted file."
                .to_string()
        })
}