# SecureDrop security model

SecureDrop v1.0 is designed as a local encrypted file vault, not as an internet-facing multi-user storage service.

## What it protects

- File content is encrypted with AES-256-GCM before storage.
- Original filename and original size are packaged inside the encrypted payload.
- Stored objects use randomized identifiers rather than original filenames.
- AES-GCM provides integrity/authentication checks for encrypted packages.
- The local account password is hashed using Argon2.
- File API routes require a valid in-memory session token.
- The backend binds to `127.0.0.1` rather than exposing itself to the network by default.

## What remains visible at rest

An observer with filesystem access can still infer information such as:

- number of encrypted objects
- approximate encrypted object sizes
- filesystem timestamps
- the existence of the SecureDrop storage directory

SecureDrop v1.0 does not attempt full traffic-analysis or metadata-volume hiding.

## Key handling

The encryption key is stored locally in `secret.key`.

Do not:

- commit `secret.key` to Git
- upload it to a public repository
- lose it if you need access to existing encrypted files

Anyone who can read both the encrypted objects and `secret.key` can decrypt the vault.

## Account limitations

- One local account is supported.
- There is no password reset or recovery workflow.
- Sessions are stored in memory, expire after 8 hours, and disappear when the backend restarts.
- `auth.json` contains an Argon2 password hash, not the plaintext password.

## Host compromise

SecureDrop does not protect against an attacker or malware that already controls the machine and can read process memory, `secret.key`, `auth.json`, or decrypted downloads.

## Internet exposure

Do not expose the development server directly to the public internet. A real hosted deployment would require a broader security design including TLS, hardened authentication/session management, CSRF/origin controls, rate limiting, secure deployment secrets, logging, and multi-user authorization.
