/**
 * pages/AuditPage.jsx
 * View immutable blockchain audit trail for files and users.
 */

import { useState, useEffect } from 'react'
import { ClipboardList, Search, Database, Activity, Clock } from 'lucide-react'
import { getFileAudit, getUserAudit, getAuditStats } from '../utils/api'

const EVENT_COLORS = {
  UPLOAD:     'badge-blue',
  SHARE:      'badge-green',
  ACCESS:     'badge-yellow',
  REVOKE:     'badge-red',
  ZKP_VERIFY: 'badge-green',
}

export default function AuditPage({ toast }) {
  const [tab,     setTab]     = useState('file')  // 'file' | 'user' | 'stats'
  const [query,   setQuery]   = useState('')
  const [records, setRecords] = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tab === 'stats') fetchStats()
  }, [tab])

  const fetchStats = async () => {
    setLoading(true)
    try { setStats(await getAuditStats()) }
    catch { toast.error('Could not load stats') }
    finally { setLoading(false) }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const data = tab === 'file'
        ? await getFileAudit(query.trim())
        : await getUserAudit(query.trim())
      setRecords(data.records || [])
      if ((data.records || []).length === 0) toast.info('No records found.')
    } catch (e) {
      toast.error('Query failed: ' + (e.response?.data?.error || e.message))
    } finally { setLoading(false) }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}><ClipboardList size={20}/> Blockchain Audit Trail</h2>
      <p style={styles.desc}>
        Every file operation is recorded immutably on the local Ethereum blockchain (Ganache).
        Records are tamper-proof — any modification invalidates all subsequent block hashes.
      </p>

      {/* Tab bar */}
      <div style={styles.tabs}>
        {['file', 'user', 'stats'].map(t => (
          <button key={t}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => { setTab(t); setRecords([]) }}>
            {t === 'file'  && <><Database size={12}/> By File ID</>}
            {t === 'user'  && <><Activity size={12}/> By ETH Address</>}
            {t === 'stats' && <><ClipboardList size={12}/> Chain Stats</>}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab !== 'stats' && (
        <form style={styles.searchRow} onSubmit={handleSearch}>
          <input className="input mono" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={tab === 'file' ? 'Enter file UUID…' : 'Enter 0x address…'}
            style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner"/> : <Search size={14}/>}
            Search
          </button>
        </form>
      )}

      {/* Stats panel */}
      {tab === 'stats' && stats && (
        <div style={styles.statsGrid}>
          <StatCard label="Total Records"   value={stats.total_records}  color="var(--accent)" />
          <StatCard label="Chain Status"    value={stats.chain_connected ? 'Connected' : 'Offline'}
            color={stats.chain_connected ? 'var(--green)' : 'var(--red)'} />
          <StatCard label="Accounts"        value={stats.accounts?.length || 0}  color="var(--yellow)" />
        </div>
      )}

      {/* Records */}
      {records.length > 0 && (
        <div style={styles.records}>
          <div style={styles.recordsHeader}>
            <span style={{ fontWeight: 600 }}>{records.length} record{records.length !== 1 ? 's' : ''}</span>
          </div>
          {records.map(r => <AuditRecord key={r.id} record={r} />)}
        </div>
      )}
    </div>
  )
}

function AuditRecord({ record }) {
  const [expanded, setExpanded] = useState(false)
  const ts = new Date(record.timestamp * 1000).toLocaleString()

  return (
    <div style={styles.record} onClick={() => setExpanded(v => !v)}>
      <div style={styles.recordMain}>
        <span className={`badge ${EVENT_COLORS[record.event_type] || 'badge-blue'}`}>
          {record.event_type}
        </span>
        <span style={styles.recordFileId} className="mono">{record.file_id?.slice(0, 22)}…</span>
        <span style={styles.recordActor} className="mono">{record.actor?.slice(0, 12)}…</span>
        <span style={styles.recordTime}><Clock size={10}/> {ts}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && (
        <div style={styles.recordDetail}>
          <DetailRow label="Record ID"   value={record.id} />
          <DetailRow label="Actor"       value={record.actor} mono />
          <DetailRow label="File Hash"   value={record.file_hash} mono />
          <DetailRow label="ZKP Hash"    value={record.zkp_proof_hash || '—'} mono />
          {record.delegate && record.delegate !== '0x0000000000000000000000000000000000000000' && (
            <DetailRow label="Receiver"  value={record.delegate} mono />
          )}
          <DetailRow label="Timestamp"   value={ts} />
          <DetailRow label="Valid"       value={record.valid ? '✓ Yes' : '✗ No'} />
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={{ ...styles.detailValue, fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
        {value}
      </span>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>{label}</div>
    </div>
  )
}

const styles = {
  page:          { display: 'flex', flexDirection: 'column', gap: 20 },
  title:         { fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  desc:          { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 },
  tabs:          { display: 'flex', gap: 8 },
  searchRow:     { display: 'flex', gap: 10 },
  statsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  records:       { display: 'flex', flexDirection: 'column', gap: 6 },
  recordsHeader: { fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0 4px' },
  record: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '12px 16px', cursor: 'pointer', transition: 'border-color 0.15s',
  },
  recordMain:    { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  recordFileId:  { fontSize: '0.78rem', color: 'var(--text-secondary)' },
  recordActor:   { fontSize: '0.78rem', color: 'var(--text-muted)' },
  recordTime:    { fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 },
  recordDetail:  { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 },
  detailRow:     { display: 'flex', gap: 12, fontSize: '0.78rem' },
  detailLabel:   { color: 'var(--text-muted)', width: 100, flexShrink: 0 },
  detailValue:   { color: 'var(--text-secondary)', wordBreak: 'break-all' },
}
