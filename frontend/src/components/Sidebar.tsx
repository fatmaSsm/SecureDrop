import {
  Files,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

export type SectionId = 'overview' | 'vault' | 'security'

type SidebarProps = {
  activeSection: SectionId
  onNavigate: (section: SectionId) => void
  onUpload: () => void
  isApiOnline: boolean | null
  username: string
  onLogout: () => void
}

const navigation = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'vault' as const, label: 'Files', icon: Files },
  { id: 'security' as const, label: 'Security', icon: ShieldCheck },
]

function Sidebar({
  activeSection,
  onNavigate,
  onUpload,
  isApiOnline,
  username,
  onLogout,
}: SidebarProps) {
  const initial = username.trim().charAt(0).toUpperCase() || 'U'

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="brand-mark"><ShieldCheck size={19} /></div>
        <div>
          <div className="brand-name">SecureDrop</div>
          <div className="brand-subtitle">Private vault</div>
        </div>
      </div>

      <div className="sidebar-section-label">Workspace</div>
      <nav className="sidebar-nav">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = item.id === activeSection

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`sidebar-nav-item ${active ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-upload-card">
        <div>
          <span className="sidebar-upload-kicker">Quick action</span>
          <strong>Protect a new file</strong>
          <p>Encrypt before it reaches disk.</p>
        </div>
        <button type="button" onClick={onUpload}>Upload file</button>
      </div>

      <div className="sidebar-spacer" />

      <div className="service-state">
        <span className={`service-dot ${isApiOnline ? 'online' : isApiOnline === false ? 'offline' : ''}`} />
        <div>
          <strong>{isApiOnline === null ? 'Checking service' : isApiOnline ? 'Local service ready' : 'Service offline'}</strong>
          <span>127.0.0.1:3000</span>
        </div>
      </div>

      <div className="account-card">
        <div className="account-avatar">{initial}</div>
        <div className="account-copy">
          <strong>{username}</strong>
          <span><UserRound size={11} /> Local account</span>
        </div>
        <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
