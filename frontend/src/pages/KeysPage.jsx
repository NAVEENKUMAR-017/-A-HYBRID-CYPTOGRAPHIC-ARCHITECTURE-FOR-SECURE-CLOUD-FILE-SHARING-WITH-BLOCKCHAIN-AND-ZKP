/**
 * pages/KeysPage.jsx
 * Generate RSA key pair + set Ethereum wallet address for blockchain txs.
 */

import { useState } from 'react'
import { KeyRound, Eye, EyeOff, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { generateKeys } from '../utils/api'

export default function KeysPage({ toast }) {
  const [loading,    setLoading]    = useState(false)
  const [pubKey,     setPubKey]     = useState(localStorage.getItem('sfs_public_key')  || '')
  const [privKey,    setPrivKey]    = useState(localStorage.getItem('sfs_private_key') || '')
  const [ethAddr,    setEthAddr]    = useState(localStorage.getItem('sfs_eth_address') || '')
  const [ethPriv,    setEthPriv]    = useState(localStorage.getItem('sfs_eth_private_key') || '')
  const [showPriv,   setShowPriv]   = useState(false)
  const [showEthPriv,setShowEthPriv]= useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const data = await generateKeys()
      setPubKey(data.public_key)
      setPrivKey(data.private_key)
      localStorage.setItem('sfs_public_key',  data.public_key)
      localStorage.setItem('sfs_private_key', data.private_key)
      toast.success('RSA-2048 key pair generated and saved locally.')
    } catch (e) {
      toast.error('Key generation failed: ' + (e.response?.data?.error || e.message))
    } finally { setLoading(false) }
  }

  const saveEth = () => {
    localStorage.setItem('sfs_eth_address',     ethAddr)
    localStorage.setItem('sfs_eth_private_key', ethPriv)
    toast.success('Ethereum credentials saved.')
  }

  const downloadKey = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const hasBothKeys = pubKey && privKey

  return (
    <div style={styles.page}>
      <h2 style={styles.title}><KeyRound size={20} /> Key Management</h2>
      <p style={styles.desc}>
        Your RSA-2048 key pair encrypts/decrypts file AES keys. Your Ethereum wallet signs blockchain audit transactions.
        <strong style={{ color: 'var(--red)' }}> Keys are stored only in your browser — never on the server.</strong>
      </p>

      {/* ── RSA Keys ── */}
      <section className="card" style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>RSA-2048 Key Pair</span>
          {hasBothKeys && <span className="badge badge-green"><CheckCircle2 size={11}/> Generated</span>}
        </div>

        <div style={styles.row}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? <span className="spinner"/> : <RefreshCw size={14}/>}
            {hasBothKeys ? 'Regenerate Keys' : 'Generate Key Pair'}
          </button>
          {hasBothKeys && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadKey(pubKey,  'public_key.pem')}>
                <Download size={13}/> Public Key
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadKey(privKey, 'private_key.pem')}>
                <Download size={13}/> Private Key
              </button>
            </>
          )}
        </div>

        {hasBothKeys && (
          <div style={styles.keyBoxes}>
            <KeyBox label="Public Key (PEM)" value={pubKey} mono />
            <KeyBox
              label="Private Key (PEM) — keep secret"
              value={privKey}
              mono
              secret
              show={showPriv}
              onToggle={() => setShowPriv(v => !v)}
            />
          </div>
        )}

        {!hasBothKeys && (
          <div style={styles.warning}>
            <AlertTriangle size={14} color="var(--yellow)" />
            No keys found. Generate a key pair before uploading files.
          </div>
        )}
      </section>

      {/* ── Ethereum Wallet ── */}
      <section className="card" style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Ethereum Wallet (Ganache)</span>
          {ethAddr && <span className="badge badge-blue">Set</span>}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Copy an address and private key from your running Ganache instance.
          These sign audit trail transactions on the local blockchain.
        </p>

        <div style={styles.ethFields}>
          <div style={{ flex: 1 }}>
            <label style={styles.fieldLabel}>Wallet Address (0x…)</label>
            <input className="input mono" value={ethAddr}
              onChange={e => setEthAddr(e.target.value)} placeholder="0xAbCd..." />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.fieldLabel}>Private Key</label>
            <div style={{ position: 'relative' }}>
              <input className="input mono" type={showEthPriv ? 'text' : 'password'} value={ethPriv}
                onChange={e => setEthPriv(e.target.value)} placeholder="0x..." style={{ paddingRight: 38 }} />
              <button style={styles.eyeBtn} onClick={() => setShowEthPriv(v => !v)} type="button">
                {showEthPriv ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={saveEth}>
          Save Wallet
        </button>
      </section>
    </div>
  )
}

function KeyBox({ label, value, mono, secret, show, onToggle }) {
  const display = secret && !show ? '•'.repeat(40) : value
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</label>
        {secret && (
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            onClick={onToggle}>
            {show ? <EyeOff size={13}/> : <Eye size={13}/>}
          </button>
        )}
      </div>
      <pre style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4,
        padding: '10px 12px', fontSize: '0.7rem', color: secret && !show ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        maxHeight: 120, overflowY: 'auto',
      }}>
        {display}
      </pre>
    </div>
  )
}

const styles = {
  page:   { display: 'flex', flexDirection: 'column', gap: 24 },
  title:  { fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  desc:   { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 },
  section:{ display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:  { fontWeight: 600, fontSize: '0.95rem' },
  row:    { display: 'flex', gap: 10, flexWrap: 'wrap' },
  keyBoxes:{ display: 'flex', flexDirection: 'column', gap: 14 },
  warning:{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--yellow)' },
  ethFields:{ display: 'flex', gap: 16, flexWrap: 'wrap' },
  fieldLabel:{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 },
  eyeBtn:{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
           background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' },
}
