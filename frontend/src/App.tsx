import { useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronRight,
  Copy,
  Database,
  EyeOff,
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  Files,
  Fingerprint,
  HardDrive,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import AuthScreen from './components/AuthScreen'
import CustomCursor from './components/CustomCursor'
import DeleteModal from './components/DeleteModal'
import Sidebar from './components/Sidebar'
import type { SectionId } from './components/Sidebar'
import ThemeToggle from './components/ThemeToggle'
import type { Theme } from './components/ThemeToggle'
import ToastContainer from './components/ToastContainer'
import UploadModal from './components/UploadModal'
import SortDropdown from './components/SortDropdown'
import {
  ApiError,
  checkApiHealth,
  clearSessionToken,
  deleteFile,
  downloadFile,
  getAuthStatus,
  getFiles,
  getSessionToken,
  logoutAccount,
  validateSession,
} from './services/api'
import type { AuthStatus } from './types/auth'
import type { SecureFile } from './types/file'
import type { ToastData, ToastType } from './types/toast'

type AuthPhase = 'checking' | 'guest' | 'authenticated'
type FileFilter = 'All' | 'TXT' | 'PDF' | 'Images' | 'Code' | 'Archives' | 'Documents' | 'Other'
type SortMode = 'name' | 'size-desc' | 'size-asc' | 'type'

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('securedrop.theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking')
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [username, setUsername] = useState('')
  const [isApiOnline, setIsApiOnline] = useState<boolean | null>(null)

  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<SecureFile | null>(null)
  const [search, setSearch] = useState('')
  const [fileFilter, setFileFilter] = useState<FileFilter>('All')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [files, setFiles] = useState<SecureFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('securedrop.theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#0b1015' : '#f3f6f8')
  }, [theme])

  const removeToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const showToast = (type: ToastType, title: string, message?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, type, title, message }])
    window.setTimeout(() => removeToast(id), 4000)
  }

  const initializeAuth = async () => {
    setAuthPhase('checking')

    try {
      const online = await checkApiHealth()
      setIsApiOnline(online)

      if (!online) {
        setAuthPhase('guest')
        return
      }

      const status = await getAuthStatus()
      setAuthStatus(status)

      if (status.configured && getSessionToken()) {
        try {
          const session = await validateSession()
          if (session.authenticated && session.username) {
            setUsername(session.username)
            setAuthPhase('authenticated')
            return
          }
        } catch {
          clearSessionToken()
        }
      }

      setAuthPhase('guest')
    } catch {
      setIsApiOnline(false)
      setAuthPhase('guest')
    }
  }

  useEffect(() => {
    void initializeAuth()
  }, [])

  const expireSession = async () => {
    clearSessionToken()
    setFiles([])
    setUsername('')
    try {
      setAuthStatus(await getAuthStatus())
    } catch {
      setIsApiOnline(false)
    }
    setAuthPhase('guest')
  }

  const loadFiles = async () => {
    try {
      const data = await getFiles()
      setFiles(data)
      setIsApiOnline(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await expireSession()
        return
      }
      setIsApiOnline(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (authPhase !== 'authenticated') return

    setIsLoading(true)
    void loadFiles()

    const interval = window.setInterval(async () => {
      const online = await checkApiHealth()
      setIsApiOnline(online)
      if (online) void loadFiles()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [authPhase])

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase()

    return [...files]
      .filter((file) => {
        const matchesSearch = !query || file.name.toLowerCase().includes(query)
        const matchesType = fileFilter === 'All' || getFileCategory(file.name) === fileFilter
        return matchesSearch && matchesType
      })
      .sort((a, b) => {
        if (sortMode === 'size-desc') return b.size_bytes - a.size_bytes
        if (sortMode === 'size-asc') return a.size_bytes - b.size_bytes
        if (sortMode === 'type') return getFileExtension(a.name).localeCompare(getFileExtension(b.name))
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
  }, [files, search, fileFilter, sortMode])

  const totalSize = files.reduce((sum, file) => sum + file.size_bytes, 0)
  const recentFiles = files.slice(0, 4)
  const typeStats = useMemo(() => getTypeStats(files), [files])

  const handleDownload = async (file: SecureFile) => {
    try {
      setDownloadingId(file.id)
      await downloadFile(file)
      showToast('success', 'Download ready', `${file.name} was decrypted and downloaded.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await expireSession()
        return
      }
      showToast('error', 'Download failed', error instanceof Error ? error.message : 'Could not download file.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!fileToDelete) return
    const file = fileToDelete

    try {
      setDeletingId(file.id)
      await deleteFile(file)
      setFiles((current) => current.filter((item) => item.id !== file.id))
      setFileToDelete(null)
      showToast('success', 'File deleted', `${file.name} was permanently removed from your vault.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await expireSession()
        return
      }
      showToast('error', 'Delete failed', error instanceof Error ? error.message : 'Could not delete file.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopyId = async (file: SecureFile) => {
    try {
      await navigator.clipboard.writeText(file.id)
      showToast('info', 'Storage ID copied', file.id)
    } catch {
      showToast('error', 'Could not copy ID')
    }
  }

  const handleLogout = async () => {
    await logoutAccount()
    setFiles([])
    setUsername('')
    try {
      setAuthStatus(await getAuthStatus())
    } catch {
      setIsApiOnline(false)
    }
    setAuthPhase('guest')
    showToast('info', 'Signed out', 'Your local session has ended.')
  }

  const navigate = (section: SectionId) => {
    setActiveSection(section)
    setIsMobileNavOpen(false)
  }

  if (authPhase === 'checking') {
    return (
      <>
        <CustomCursor />
        <BootScreen
          theme={theme}
          onThemeToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
        />
      </>
    )
  }

  if (authPhase === 'guest') {
    return (
      <>
        <CustomCursor />
        <AuthScreen
          status={authStatus}
          serviceAvailable={isApiOnline === true}
          theme={theme}
          onThemeToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
          onAuthenticated={(name) => {
            setUsername(name)
            setAuthStatus({ configured: true, username: name })
            setAuthPhase('authenticated')
          }}
          onRetry={() => void initializeAuth()}
        />
      </>
    )
  }

  const sectionTitle = activeSection === 'overview' ? 'Overview' : activeSection === 'vault' ? 'Files' : 'Security'

  return (
    <div className="app-frame app-backdrop">
      <CustomCursor />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={(filename) => {
          showToast('success', 'File secured', `${filename} was encrypted and added to your vault.`)
          void loadFiles()
        }}
        onUploadError={(message) => showToast('error', 'Upload failed', message)}
      />

      <DeleteModal
        file={fileToDelete}
        isDeleting={deletingId !== null}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => void handleDelete()}
      />

      <div className="desktop-sidebar">
        <Sidebar
          activeSection={activeSection}
          onNavigate={navigate}
          onUpload={() => setIsUploadOpen(true)}
          isApiOnline={isApiOnline}
          username={username}
          onLogout={() => void handleLogout()}
        />
      </div>

      {isMobileNavOpen && (
        <div className="mobile-nav-layer">
          <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setIsMobileNavOpen(false)} />
          <div className="mobile-nav-panel">
            <button type="button" className="mobile-nav-close" onClick={() => setIsMobileNavOpen(false)}><X size={16} /></button>
            <Sidebar
              activeSection={activeSection}
              onNavigate={navigate}
              onUpload={() => {
                setIsMobileNavOpen(false)
                setIsUploadOpen(true)
              }}
              isApiOnline={isApiOnline}
              username={username}
              onLogout={() => void handleLogout()}
            />
          </div>
        </div>
      )}

      <main className="workspace-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-menu-button" onClick={() => setIsMobileNavOpen(true)} aria-label="Open navigation"><Menu size={17} /></button>
            <div>
              <div className="breadcrumbs"><span>SecureDrop</span><ChevronRight size={11} /><span>{sectionTitle}</span></div>
              <strong>{sectionTitle}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="header-service">
              <span className={`service-dot ${isApiOnline ? 'online' : isApiOnline === false ? 'offline' : ''}`} />
              <span>{isApiOnline === null ? 'Checking' : isApiOnline ? 'Connected' : 'Offline'}</span>
            </div>
            <ThemeToggle theme={theme} onToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} />
            <button type="button" className="primary-action top-upload" onClick={() => setIsUploadOpen(true)}><Plus size={14} /> Upload file</button>
          </div>
        </header>

        <div className="workspace-scroll">
          {activeSection === 'overview' && (
            <Overview
              files={files}
              isLoading={isLoading}
              totalSize={totalSize}
              recentFiles={recentFiles}
              typeStats={typeStats}
              username={username}
              onOpenFiles={() => setActiveSection('vault')}
              onUpload={() => setIsUploadOpen(true)}
            />
          )}

          {activeSection === 'vault' && (
            <Vault
              files={files}
              filteredFiles={filteredFiles}
              search={search}
              setSearch={setSearch}
              fileFilter={fileFilter}
              setFileFilter={setFileFilter}
              sortMode={sortMode}
              setSortMode={setSortMode}
              isLoading={isLoading}
              downloadingId={downloadingId}
              deletingId={deletingId}
              onDownload={handleDownload}
              onDelete={setFileToDelete}
              onCopyId={handleCopyId}
              onUpload={() => setIsUploadOpen(true)}
            />
          )}

          {activeSection === 'security' && (
            <Security files={files} username={username} onCopyId={handleCopyId} />
          )}
        </div>
      </main>
    </div>
  )
}

type OverviewProps = {
  files: SecureFile[]
  isLoading: boolean
  totalSize: number
  recentFiles: SecureFile[]
  typeStats: TypeStat[]
  username: string
  onOpenFiles: () => void
  onUpload: () => void
}

function Overview({ files, isLoading, totalSize, recentFiles, typeStats, username, onOpenFiles, onUpload }: OverviewProps) {
  return (
    <div className="page-wrap overview-page">
      <section className="overview-hero">
        <div className="hero-copy">
          <span className="eyebrow">LOCAL PRIVATE STORAGE</span>
          <h1>Good to see you, {username}.</h1>
          <p>
            Keep sensitive files in one calm, local workspace. SecureDrop encrypts file content and original metadata before storage.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-action" onClick={onUpload}><Plus size={14} /> Protect a file</button>
            <button type="button" className="secondary-action" onClick={onOpenFiles}>Browse vault <ArrowRight size={13} /></button>
          </div>
        </div>

        <div className="hero-status-card">
          <div className="hero-status-top"><span className="hero-status-icon"><ShieldCheck size={18} /></span><div><strong>Vault ready</strong><span>Authenticated encryption is active</span></div></div>
          <div className="status-table"><StatusRow label="Cipher" value="AES-256-GCM" /><StatusRow label="Account" value="Argon2 protected" /><StatusRow label="Storage IDs" value="Randomized" /><StatusRow label="Location" value="Local filesystem" /></div>
        </div>
      </section>

      <section className="metric-grid">
        <Metric accent="blue" icon={Files} label="Protected files" value={isLoading ? '—' : files.length.toString()} note="Encrypted objects in this vault" />
        <Metric accent="green" icon={HardDrive} label="Stored data" value={isLoading ? '—' : formatFileSize(totalSize)} note="Original file size total" />
        <Metric accent="warm" icon={LockKeyhole} label="Upload policy" value="100 MB" note="Maximum size per file" />
      </section>

      <section className="overview-grid">
        <div className="panel recent-panel">
          <div className="panel-heading"><div><h3>Recent files</h3><p>Files currently available in your encrypted vault.</p></div><button type="button" onClick={onOpenFiles}>View all <ArrowRight size={12} /></button></div>
          {isLoading ? <LoadingRows /> : recentFiles.length === 0 ? <EmptyState onUpload={onUpload} /> : recentFiles.map((file) => <RecentRow key={file.id} file={file} />)}
        </div>

        <div className="panel storage-panel">
          <div className="panel-heading"><div><h3>Storage profile</h3><p>File count by type. Colors stay consistent across the vault.</p></div></div>
          {typeStats.length === 0 ? <div className="empty-mini">No file data yet</div> : <StorageProfile files={files} stats={typeStats} />}
        </div>
      </section>
    </div>
  )
}

type VaultProps = {
  files: SecureFile[]
  filteredFiles: SecureFile[]
  search: string
  setSearch: (value: string) => void
  fileFilter: FileFilter
  setFileFilter: (value: FileFilter) => void
  sortMode: SortMode
  setSortMode: (value: SortMode) => void
  isLoading: boolean
  downloadingId: string | null
  deletingId: string | null
  onDownload: (file: SecureFile) => Promise<void>
  onDelete: (file: SecureFile) => void
  onCopyId: (file: SecureFile) => Promise<void>
  onUpload: () => void
}

function Vault({ files, filteredFiles, search, setSearch, fileFilter, setFileFilter, sortMode, setSortMode, isLoading, downloadingId, deletingId, onDownload, onDelete, onCopyId, onUpload }: VaultProps) {
  const filters: FileFilter[] = ['All', 'TXT', 'PDF', 'Images', 'Documents', 'Code', 'Archives', 'Other']

  return (
    <div className="page-wrap">
      <div className="page-title-row">
        <div><span className="eyebrow">ENCRYPTED FILE MANAGER</span><h1>Files</h1><p>{files.length} encrypted {files.length === 1 ? 'object' : 'objects'} stored locally.</p></div>
        <button type="button" className="primary-action" onClick={onUpload}><Plus size={14} /> Upload file</button>
      </div>

      <div className="vault-toolbar">
        <div className="search-field"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by filename" /></div>
        <SortDropdown value={sortMode} onChange={setSortMode} />
      </div>

      <div className="filter-row">
        {filters.map((filter) => <button key={filter} type="button" className={fileFilter === filter ? 'active' : ''} onClick={() => setFileFilter(filter)}>{filter}</button>)}
      </div>

      <div className="file-table panel">
        <div className="file-table-head"><span>File</span><span>Size</span><span>Protection</span><span>Actions</span></div>
        {isLoading ? <LoadingRows /> : filteredFiles.length === 0 ? <EmptyState onUpload={onUpload} message={search || fileFilter !== 'All' ? 'No files match these filters.' : undefined} /> : filteredFiles.map((file) => (
          <div key={file.id} className="file-row">
            <div className="file-cell-main"><FileIcon filename={file.name} /><div><strong title={file.name}>{file.name}</strong><span>{getFileExtension(file.name)} · ID {shortFileId(file.id)}</span></div></div>
            <span className="file-size">{formatFileSize(file.size_bytes)}</span>
            <div className="protection-cell"><ShieldCheck size={13} /><div><strong>Encrypted</strong><span>AES-256-GCM</span></div></div>
            <div className="file-actions">
              <button type="button" title="Copy storage ID" onClick={() => void onCopyId(file)}><Copy size={14} /></button>
              <button type="button" title="Download and decrypt" disabled={downloadingId === file.id} onClick={() => void onDownload(file)}>{downloadingId === file.id ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}</button>
              <button type="button" className="danger" title="Delete" disabled={deletingId === file.id} onClick={() => onDelete(file)}>{deletingId === file.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="table-footnote"><span>Original names appear only after local metadata decryption.</span><span>{filteredFiles.length} shown · 100 MB max upload</span></div>
    </div>
  )
}

function Security({ files, username, onCopyId }: { files: SecureFile[]; username: string; onCopyId: (file: SecureFile) => Promise<void> }) {
  return (
    <div className="page-wrap security-page">
      <div className="page-title-row"><div><span className="eyebrow">SECURITY MODEL</span><h1>Security</h1><p>A factual view of what SecureDrop protects and where its limits are.</p></div></div>

      <div className="security-grid">
        <SecurityItem accent="blue" icon={ShieldCheck} title="Authenticated encryption" value="AES-256-GCM" description="File bytes and packaged metadata are encrypted before storage. GCM detects tampering with the encrypted object." />
        <SecurityItem accent="green" icon={KeyRound} title="Local account" value="Argon2" description={`The local account “${username}” uses an Argon2 password hash. The plaintext password is never written to auth.json.`} />
        <SecurityItem accent="cyan" icon={Fingerprint} title="Opaque storage IDs" value="128-bit random IDs" description="Encrypted files are stored under randomized .enc identifiers rather than their original names." />
        <SecurityItem accent="warm" icon={HardDrive} title="Storage model" value="Local filesystem" description="Encrypted objects, account data and the encryption key remain on the machine running the Rust backend." />
      </div>

      <div className="panel protection-flow">
        <div className="panel-heading"><div><h3>File protection flow</h3><p>What happens during a successful upload.</p></div></div>
        <div className="flow-grid"><FlowStep number="01" title="Receive" text="Rust accepts the multipart upload and validates filename and size." /><ArrowRight size={15} /><FlowStep number="02" title="Encrypt" text="Filename, original size and file bytes are packaged and encrypted." /><ArrowRight size={15} /><FlowStep number="03" title="Store" text="Only the encrypted package is written under a randomized .enc ID." /></div>
      </div>

      <div className="panel at-rest-panel">
        <div className="panel-heading"><div><div className="heading-with-icon"><Database size={14} /><h3>At-rest storage view</h3></div><p>Compare what you see in the interface with what exists on disk.</p></div><span className="object-count">{files.length} encrypted {files.length === 1 ? 'object' : 'objects'}</span></div>
        {files.length === 0 ? <div className="empty-mini roomy">Upload a file to see how user-facing metadata differs from its encrypted storage identity.</div> : (
          <div className="storage-object-list">
            {files.map((file, index) => (
              <div key={file.id} className="storage-object-row">
                <div className="storage-user-view"><div className="storage-view-label"><span>User view</span><small>#{String(index + 1).padStart(2, '0')}</small></div><div className="storage-file-card"><FileIcon filename={file.name} /><div><strong>{file.name}</strong><span>{getFileExtension(file.name)} · {formatFileSize(file.size_bytes)}</span></div></div><p>Metadata is decrypted locally so the app can display the original filename.</p></div>
                <div className="storage-disk-view"><div className="storage-view-label"><span>Stored on disk</span><button type="button" onClick={() => void onCopyId(file)}><Copy size={12} /> Copy ID</button></div><div className="encrypted-id-box"><code>{file.id}</code><span><EyeOff size={12} /> Original filename hidden at rest</span></div><p>The API never exposes raw ciphertext bytes; the filesystem contains the opaque AES-GCM encrypted object.</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="scope-card">
        <div><strong>Scope of SecureDrop v1.0</strong><p>This release adds a single local account and authenticated sessions. It does not provide cloud synchronization, remote password recovery, multi-user authorization, or protection from a compromised machine that can read the local encryption key.</p></div>
        <ShieldCheck size={20} />
      </div>
    </div>
  )
}

function StorageProfile({ files, stats }: { files: SecureFile[]; stats: TypeStat[] }) {
  return (
    <>
      <div className="storage-chart-row">
        <div className="donut-chart" style={{ background: getDonutBackground(stats) }} aria-label="File type distribution chart"><div><strong>{files.length}</strong><span>files</span></div></div>
        <div className="chart-legend">{stats.slice(0, 6).map((item) => <div key={item.label}><span style={{ backgroundColor: item.color }} /><strong>{item.label}</strong><small>{Math.round(item.rawPercentage)}%</small></div>)}</div>
      </div>
      <div className="profile-bars">{stats.slice(0, 6).map((item) => <div key={item.label}><div><span>{item.label}</span><small>{item.count} {item.count === 1 ? 'file' : 'files'}</small></div><div className="profile-track"><span style={{ width: `${item.percentage}%`, backgroundColor: item.color }} /></div></div>)}</div>
    </>
  )
}

function Metric({ accent, icon: Icon, label, value, note }: { accent: 'blue' | 'green' | 'warm'; icon: ElementType; label: string; value: string; note: string }) {
  return <div className={`metric-card ${accent}`}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><div className="metric-icon"><Icon size={16} /></div></div>
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="status-row"><span>{label}</span><strong>{value}</strong></div>
}

function RecentRow({ file }: { file: SecureFile }) {
  return <div className="recent-row"><div className="recent-main"><FileIcon filename={file.name} /><div><strong>{file.name}</strong><span>{getFileExtension(file.name)} · {shortFileId(file.id)}</span></div></div><div className="recent-meta"><span>{formatFileSize(file.size_bytes)}</span><span className="encrypted-label"><LockKeyhole size={11} /> Encrypted</span></div></div>
}

function FileIcon({ filename }: { filename: string }) {
  const ext = getFileExtension(filename)
  let Icon = FileText
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(ext)) Icon = FileImage
  else if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) Icon = FileArchive
  else if (['JS', 'TS', 'TSX', 'JSX', 'RS', 'PY', 'JAVA', 'CPP', 'C', 'HTML', 'CSS', 'JSON'].includes(ext)) Icon = FileCode2
  const category = getFileCategory(filename)
  const color = TYPE_COLORS[category] ?? TYPE_COLORS.Other
  return <div className="file-icon" style={{ color, borderColor: `${color}55`, backgroundColor: `${color}16` }}><Icon size={16} /></div>
}

function SecurityItem({ accent, icon: Icon, title, value, description }: { accent: 'blue' | 'green' | 'cyan' | 'warm'; icon: ElementType; title: string; value: string; description: string }) {
  return <div className={`security-item ${accent}`}><div className="security-item-top"><span><Icon size={16} /></span><div><small>{title}</small><strong>{value}</strong></div></div><p>{description}</p></div>
}

function FlowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flow-step"><span>{number}</span><strong>{title}</strong><p>{text}</p></div>
}

function EmptyState({ onUpload, message }: { onUpload: () => void; message?: string }) {
  return <div className="empty-state"><div><Files size={17} /></div><strong>{message ?? 'No encrypted files yet.'}</strong>{!message && <button type="button" onClick={onUpload}>Upload your first file</button>}</div>
}

function LoadingRows() {
  return <div className="loading-rows"><LoaderCircle size={15} className="animate-spin" /><span>Loading vault…</span></div>
}

function BootScreen({ theme, onThemeToggle }: { theme: Theme; onThemeToggle: () => void }) {
  return <div className="boot-screen app-backdrop"><ThemeToggle theme={theme} onToggle={onThemeToggle} compact /><div className="boot-mark"><ShieldCheck size={23} /></div><strong>SecureDrop</strong><span><LoaderCircle size={13} className="animate-spin" /> Connecting to local vault…</span></div>
}

type TypeStat = {
  label: FileFilter
  count: number
  percentage: number
  rawPercentage: number
  color: string
}

const TYPE_COLORS: Record<FileFilter, string> = {
  All: '#7B8793',
  TXT: '#4387D1',
  PDF: '#C18C47',
  Images: '#3FB08A',
  Code: '#687EE0',
  Archives: '#915FC4',
  Documents: '#489AB2',
  Other: '#87939E',
}

function getFileCategory(filename: string): FileFilter {
  const ext = getFileExtension(filename)
  if (ext === 'TXT' || ext === 'MD') return 'TXT'
  if (ext === 'PDF') return 'PDF'
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(ext)) return 'Images'
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return 'Archives'
  if (['JS', 'TS', 'TSX', 'JSX', 'RS', 'PY', 'JAVA', 'CPP', 'C', 'HTML', 'CSS', 'JSON'].includes(ext)) return 'Code'
  if (['DOC', 'DOCX', 'ODT', 'RTF', 'XLS', 'XLSX', 'PPT', 'PPTX'].includes(ext)) return 'Documents'
  return 'Other'
}

function getTypeStats(files: SecureFile[]): TypeStat[] {
  if (files.length === 0) return []
  const counts = new Map<FileFilter, number>()

  for (const file of files) {
    const label = getFileCategory(file.name)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, count]) => {
      const rawPercentage = (count / files.length) * 100
      return { label, count, rawPercentage, percentage: Math.max(8, rawPercentage), color: TYPE_COLORS[label] }
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function getDonutBackground(stats: TypeStat[]) {
  let cursor = 0
  const slices = stats.map((item) => {
    const start = cursor
    cursor += item.rawPercentage
    return `${item.color} ${start}% ${cursor}%`
  })
  return `conic-gradient(${slices.join(', ')})`
}

function getFileExtension(filename: string) {
  const parts = filename.split('.')
  return parts.length < 2 ? 'FILE' : parts.pop()?.toUpperCase() || 'FILE'
}

function shortFileId(id: string) {
  return id.replace('.enc', '').slice(0, 8)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default App
