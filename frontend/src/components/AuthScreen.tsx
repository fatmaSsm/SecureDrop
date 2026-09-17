import { useEffect, useState } from 'react'
import type { ElementType, FormEvent } from 'react'
import {
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
  LogIn,
} from 'lucide-react'

import { loginAccount, setupAccount } from '../services/api'
import type { AuthStatus } from '../types/auth'
import ThemeToggle from './ThemeToggle'
import type { Theme } from './ThemeToggle'

type AuthMode = 'setup' | 'login'

type AuthScreenProps = {
  status: AuthStatus | null
  serviceAvailable: boolean
  theme: Theme
  onThemeToggle: () => void
  onAuthenticated: (username: string) => void
  onRetry: () => void
}

function AuthScreen({
  status,
  serviceAvailable,
  theme,
  onThemeToggle,
  onAuthenticated,
  onRetry,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(() =>
    status?.configured === true ? 'login' : 'setup',
  )
  const [username, setUsername] = useState(status?.username ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSetup = mode === 'setup'
  const setupBlocked = status?.configured === true
  const loginBlocked = status?.configured === false

  useEffect(() => {
    if (status?.configured === true) {
      setMode('login')
    } else if (status?.configured === false) {
      setMode('setup')
    }

    if (status?.username) {
      setUsername(status.username)
    }
  }, [status?.configured, status?.username])

  const changeMode = (nextMode: AuthMode) => {
    if (nextMode === 'setup' && setupBlocked) return
    if (nextMode === 'login' && loginBlocked) return

    setMode(nextMode)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!serviceAvailable) {
      setError('Start the Rust service first, then press Retry.')
      return
    }

    if (isSetup && setupBlocked) {
      setError('This vault already has a local account. Sign in instead.')
      return
    }

    if (!isSetup && loginBlocked) {
      setError('No local account exists yet. Create one first.')
      return
    }

    if (isSetup && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = isSetup
        ? await setupAccount(username, password)
        : await loginAccount(username, password)

      if (!result.username) {
        throw new Error('The local account response did not include a username.')
      }

      onAuthenticated(result.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authenticate.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page app-backdrop">
      <div className="auth-topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={20} /></div>
          <div>
            <div className="brand-name">SecureDrop</div>
            <div className="brand-subtitle">Private encrypted vault</div>
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} compact />
      </div>

      <div className="auth-layout">
        <section className="auth-intro">
          <div className="eyebrow">LOCAL-FIRST FILE SECURITY</div>
          <h1>A quiet place for files you would rather keep private.</h1>
          <p>
            SecureDrop keeps its claims simple: the Rust service encrypts file content and metadata
            before storage, and your local account controls access to the vault interface.
          </p>

          <div className="auth-points">
            <TrustPoint icon={LockKeyhole} title="AES-256-GCM" text="Authenticated encryption for stored file packages." />
            <TrustPoint icon={HardDrive} title="Local storage" text="Encrypted objects stay on the machine running SecureDrop." />
            <TrustPoint icon={KeyRound} title="Local account" text="Your password is verified with Argon2 and is never stored as plaintext." />
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-icon">
              {isSetup ? <UserPlus size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div>
              <h2>{isSetup ? 'Create your local account' : 'Welcome back'}</h2>
              <p>
                {isSetup
                  ? 'Create the account that will unlock this local vault.'
                  : 'Sign in to open your encrypted vault.'}
              </p>
            </div>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={isSetup}
              className={isSetup ? 'active' : ''}
              disabled={setupBlocked}
              title={setupBlocked ? 'A local account already exists for this vault.' : 'Create a local account'}
              onClick={() => changeMode('setup')}
            >
              <UserPlus size={15} />
              Create account
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={!isSetup}
              className={!isSetup ? 'active' : ''}
              disabled={loginBlocked}
              title={loginBlocked ? 'Create the first local account before signing in.' : 'Sign in'}
              onClick={() => changeMode('login')}
            >
              <LogIn size={15} />
              Sign in
            </button>
          </div>

          {status?.configured === true && (
            <div className="auth-mode-note">
              A local account already exists for this vault. Use the saved username to sign in.
            </div>
          )}

          {status?.configured === false && (
            <div className="auth-mode-note">
              This is the first run. Create one local account before opening the vault.
            </div>
          )}

          {!serviceAvailable && (
            <div className="service-warning">
              <div>
                <strong>Local service is offline</strong>
                <span>Run <code>cargo run</code> in the project root, then press Retry.</span>
              </div>
              <button type="button" onClick={onRetry}>Retry</button>
            </div>
          )}

          <form onSubmit={submit} className="auth-form">
            <label>
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder={isSetup ? 'Choose a username' : 'Your username'}
                required
                minLength={2}
                maxLength={40}
              />
            </label>

            <label>
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  placeholder={isSetup ? 'At least 8 characters' : 'Enter your password'}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {isSetup && (
              <label>
                <span>Confirm password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  required
                  minLength={8}
                />
              </label>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button
              className="primary-action auth-submit"
              type="submit"
              disabled={isSubmitting || !serviceAvailable}
            >
              {isSubmitting
                ? 'Please wait…'
                : isSetup
                  ? 'Create account & open vault'
                  : 'Open my vault'}
            </button>
          </form>

          <div className="auth-footnote">
            {isSetup
              ? 'There is no password recovery in v1.0. Keep your password and local encryption key safe.'
              : 'Sessions are local, expire after 8 hours, and are cleared when the Rust service restarts.'}
          </div>
        </section>
      </div>
    </div>
  )
}

function TrustPoint({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return (
    <div className="trust-point">
      <div className="trust-icon"><Icon size={16} /></div>
      <div><strong>{title}</strong><span>{text}</span></div>
    </div>
  )
}

export default AuthScreen
