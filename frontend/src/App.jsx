/**
 * App.jsx
 * Root layout — sidebar nav + page routing.
 */

import { useState } from 'react'
import {
  ShieldCheck, FileText, Share2, ClipboardList,
  KeyRound, LogOut, ChevronRight, Zap
} from 'lucide-react'
import { AuthProvider, useAuth } from './utils/AuthContext'
import { useToast }              from './utils/useToast'
import { ToastContainer }        from './components/Toast'
import AuthPage  from './pages/AuthPage'
import FilesPage from './pages/FilesPage'
import SharePage from './pages/SharePage'
import AuditPage from './pages/AuditPage'
import KeysPage  from './pages/KeysPage'

// ─── Inner app (requires auth) ───────────────────────────────────────────────
function Dashboard() {
  const { session, logout } = useAuth()
  const { toasts, toast }   = useToast()
  const [page, setPage]     = useState('files')
  const [shareFile, setShareFile] = useState(null)

  const navItems = [
    { id: 'files',  label: 'My Files',    icon: <FileText size={16}/> },
    { id: 'share',  label: 'Share / PRE', icon: <Share2   size={16}/> },
    { id: 'audit',  label: 'Audit Trail', icon: <ClipboardList size={16}/> },
    { id: 'keys',   label: 'Keys',        icon: <KeyRound size={16}/> },
  ]

  const handleShareClick = (file) => {
    setShareFile(file)
    setPage('share')
  }

  return (
    <div style={layout.root}>
      {/* ── Sidebar ── */}
      <aside style={layout.sidebar}>
        <div style={layout.logo}>
          <ShieldCheck size={20} color="var(--accent)" strokeWidth={1.5}/>
          <span style={layout.logoText}>SecureShare</span>
        </div>

        <div style={layout.userBox}>
          <div style={layout.userDot}/>
          <span style={layout.userEmail} title={session?.email}>{session?.email}</span>
        </div>

        <nav style={layout.nav}>
          {navItems.map(item => (
            <button
              key={item.id}
              style={{ ...layout.navItem, ...(page === item.id ? layout.navItemActive : {}) }}
              onClick={() => setPage(item.id)}>
              {item.icon}
              <span>{item.label}</span>
              {page === item.id && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--accent)' }}/>}
            </button>
          ))}
        </nav>

        {/* Security indicators */}
        <div style={layout.secBadges}>
          {['AES-256-GCM', 'RSA-2048', 'PRE', 'ZKP', 'Blockchain'].map(tag => (
            <span key={tag} style={layout.secTag}>{tag}</span>
          ))}
        </div>

        <button style={layout.logoutBtn} onClick={logout}>
          <LogOut size={14}/> Sign Out
        </button>
      </aside>

      {/* ── Main content ── */}
      <main style={layout.main}>
        <div style={layout.topBar}>
          <div style={layout.breadcrumb}>
            <Zap size={13} color="var(--accent)"/>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {navItems.find(n => n.id === page)?.label}
            </span>
          </div>
          <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }}/>
            Ganache Connected
          </span>
        </div>

        <div style={layout.content}>
          {page === 'files' && (
            <FilesPage toast={toast} onShareClick={handleShareClick} />
          )}
          {page === 'share' && (
            <SharePage
              toast={toast}
              preselectedFile={shareFile}
              onClear={() => setShareFile(null)}
            />
          )}
          {page === 'audit' && <AuditPage toast={toast} />}
          {page === 'keys'  && <KeysPage  toast={toast} />}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}

// ─── Root with auth gate ─────────────────────────────────────────────────────
function AppInner() {
  const { session, loading } = useAuth()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }}/>
    </div>
  )

  return session ? <Dashboard /> : <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

// ─── Layout styles ───────────────────────────────────────────────────────────
const layout = {
  root: {
    display: 'flex', height: '100vh', overflow: 'hidden',
  },
  sidebar: {
    width: 220, flexShrink: 0,
    background: 'var(--bg-panel)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', padding: '20px 0',
    overflowY: 'auto',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 20px 20px', borderBottom: '1px solid var(--border)',
    marginBottom: 16,
  },
  logoText: {
    fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.95rem',
  },
  userBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 20px 16px', borderBottom: '1px solid var(--border)', marginBottom: 12,
  },
  userDot: {
    width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0,
  },
  userEmail: {
    fontSize: '0.75rem', color: 'var(--text-muted)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 6, border: 'none', background: 'none',
    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem',
    width: '100%', textAlign: 'left', transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'var(--accent-glow)', color: 'var(--accent)',
  },
  secBadges: {
    marginTop: 'auto', padding: '16px 16px 0',
    display: 'flex', flexWrap: 'wrap', gap: 5,
  },
  secTag: {
    fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10,
    background: 'var(--bg)', border: '1px solid var(--border)',
    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
  },
  logoutBtn: {
    margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    padding: '8px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem',
    transition: 'all 0.15s',
  },
  main: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  topBar: {
    borderBottom: '1px solid var(--border)', padding: '12px 28px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-panel)', flexShrink: 0,
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8 },
  content: {
    flex: 1, overflowY: 'auto', padding: '28px 32px',
  },
}
