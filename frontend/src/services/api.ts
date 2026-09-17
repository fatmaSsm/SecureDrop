import type { AuthResult, AuthSession, AuthStatus } from '../types/auth'
import type { SecureFile } from '../types/file'

const API_ROOT = '/api'
const TOKEN_KEY = 'securedrop.session-token'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getSessionToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setSessionToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearSessionToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

function authHeaders(): HeadersInit {
  const token = getSessionToken()
  return token
    ? { Authorization: `Bearer ${token}` }
    : {}
}

async function parseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string }
    return data.message || fallback
  } catch {
    return fallback
  }
}

async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = getSessionToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...init,
    headers,
  })
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_ROOT}/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await fetch(`${API_ROOT}/auth/status`)

  if (!response.ok) {
    throw new ApiError('Could not read local account status.', response.status)
  }

  return response.json()
}

export async function validateSession(): Promise<AuthSession> {
  const response = await fetch(`${API_ROOT}/auth/session`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new ApiError('Your local session has expired.', response.status)
  }

  return response.json()
}

async function authenticate(
  endpoint: 'setup' | 'login',
  username: string,
  password: string,
): Promise<AuthResult> {
  const response = await fetch(`${API_ROOT}/auth/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  const data = (await response.json()) as AuthResult

  if (!response.ok || !data.token) {
    throw new ApiError(data.message || 'Authentication failed.', response.status)
  }

  setSessionToken(data.token)
  return data
}

export function setupAccount(username: string, password: string) {
  return authenticate('setup', username, password)
}

export function loginAccount(username: string, password: string) {
  return authenticate('login', username, password)
}

export async function logoutAccount() {
  try {
    await authorizedFetch(`${API_ROOT}/auth/logout`, {
      method: 'POST',
    })
  } catch {
    // A local logout should still clear the browser session if the Rust service is offline.
  } finally {
    clearSessionToken()
  }
}

export async function getFiles(): Promise<SecureFile[]> {
  const response = await authorizedFetch(`${API_ROOT}/files`)

  if (!response.ok) {
    throw new ApiError(
      await parseError(response, `Could not load files (${response.status}).`),
      response.status,
    )
  }

  return response.json()
}

export async function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await authorizedFetch(`${API_ROOT}/files`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new ApiError(
      await parseError(response, `Upload failed (${response.status}).`),
      response.status,
    )
  }

  return response.json() as Promise<{
    success: boolean
    message: string
    filename: string | null
  }>
}

export async function downloadFile(file: SecureFile) {
  const response = await authorizedFetch(
    `${API_ROOT}/files/${encodeURIComponent(file.id)}/download`,
  )

  if (!response.ok) {
    throw new ApiError(
      await parseError(response, `Could not download file (${response.status}).`),
      response.status,
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function deleteFile(file: SecureFile) {
  const response = await authorizedFetch(
    `${API_ROOT}/files/${encodeURIComponent(file.id)}`,
    { method: 'DELETE' },
  )

  if (!response.ok) {
    throw new ApiError(
      await parseError(response, `Could not delete file (${response.status}).`),
      response.status,
    )
  }
}
