export type AuthStatus = {
  configured: boolean
  username: string | null
}

export type AuthSession = {
  authenticated: boolean
  username: string | null
}

export type AuthResult = {
  success: boolean
  message: string
  username: string | null
  token: string | null
}
