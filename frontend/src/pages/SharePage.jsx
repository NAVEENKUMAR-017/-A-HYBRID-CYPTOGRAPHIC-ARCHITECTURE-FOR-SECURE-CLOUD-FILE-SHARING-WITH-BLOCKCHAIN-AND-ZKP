/**
 * pages/SharePage.jsx
 * Share or revoke file access via Proxy Re-Encryption.
 */

import { useState } from 'react'
import { ArrowRight, Share2, ShieldOff } from 'lucide-react'
import { delegateAccess, revokeAccess } from '../utils/api'

export default function SharePage({ toast, preselectedFile, onClear }) {
  const [fileId, setFileId] = useState(preselectedFile?.file_id || '')
  const [fileName] = useState(preselectedFile?.file_name || '')
  const [receiverPub, setReceiverPub] = useState('')
  const [receiverId, setReceiverId] = useState('')
  const [receiverEth, setReceiverEth] = useState('')
  const [loading, setLoading] = useState(false)
  const [revokeMode, setRevokeMode] = useState(false)

  const privKey = localStorage.getItem('sfs_private_key') || ''
  const ethPriv = localStorage.getItem('sfs_eth_private_key') || ''

  const handleShare = async (e) => {
    e.preventDefault()
    if (!privKey || !ethPriv) return toast.error('Keys not set up (Keys tab)')
    if (!fileId || !receiverPub || !receiverId || !receiverEth) return toast.error('Fill in all fields')

    setLoading(true)
    try {
      const result = await delegateAccess({
        file_id: fileId,
        owner_private_key: privKey,
        delegate_public_key: receiverPub,
        delegate_id: receiverId,
        delegate_eth_address: receiverEth,
        eth_private_key: ethPriv,
      })
      toast.success(`Access shared with receiver. TX: ${result.tx_hash.slice(0, 12)}...`)
      resetForm()
    } catch (e) {
      toast.error('Share failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (e) => {
    e.preventDefault()
    if (!ethPriv) return toast.error('ETH private key not set (Keys tab)')
    setLoading(true)
    try {
      const result = await revokeAccess({
        file_id: fileId,
        delegate_id: receiverId,
        delegate_eth_address: receiverEth,
        eth_private_key: ethPriv,
      })
      toast.success(`Receiver access revoked. TX: ${result.tx_hash.slice(0, 12)}...`)
      resetForm()
    } catch (e) {
      toast.error('Revoke failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setReceiverPub('')
    setReceiverId('')
    setReceiverEth('')
    if (onClear) onClear()
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}><Share2 size={20} /> Share & Revoke Access</h2>
      <p style={styles.desc}>
        Proxy Re-Encryption (PRE) lets you grant another user access without re-encrypting the file or exposing your private key.
        The proxy transforms the ciphertext so only the receiver can decrypt it.
      </p>

      <div style={styles.toggle}>
        <button
          className={`btn ${!revokeMode ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setRevokeMode(false)}
        >
          <Share2 size={14} /> Share With Receiver
        </button>
        <button
          className={`btn ${revokeMode ? 'btn-danger' : 'btn-ghost'}`}
          onClick={() => setRevokeMode(true)}
        >
          <ShieldOff size={14} /> Revoke Access
        </button>
      </div>

      <form className="card" style={styles.form} onSubmit={revokeMode ? handleRevoke : handleShare}>
        <div style={styles.field}>
          <label style={styles.label}>File ID</label>
          <input
            className="input mono"
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            placeholder="UUID of file to share..."
          />
          {fileName && <span style={styles.hint}>{fileName}</span>}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Receiver Cognito User ID</label>
          <input
            className="input mono"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            placeholder="Cognito sub UUID of receiver"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Receiver Ethereum Address</label>
          <input
            className="input mono"
            value={receiverEth}
            onChange={(e) => setReceiverEth(e.target.value)}
            placeholder="0x..."
          />
        </div>

        {!revokeMode && (
          <div style={styles.field}>
            <label style={styles.label}>Receiver RSA Public Key (PEM)</label>
            <textarea
              className="input mono"
              rows={6}
              value={receiverPub}
              onChange={(e) => setReceiverPub(e.target.value)}
              placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}
            />
            <span style={styles.hint}>
              Ask the receiver to share their public key from their Keys tab.
            </span>
          </div>
        )}

        {!revokeMode && (
          <div style={styles.preInfo}>
            <div style={styles.preStep}><span style={styles.preNum}>1</span> Owner decrypts AES key with their private key</div>
            <ArrowRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <div style={styles.preStep}><span style={styles.preNum}>2</span> Re-encrypts AES key under receiver's public key</div>
            <ArrowRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <div style={styles.preStep}><span style={styles.preNum}>3</span> Blockchain records receiver access</div>
          </div>
        )}

        <button
          type="submit"
          className={`btn ${revokeMode ? 'btn-danger' : 'btn-primary'}`}
          disabled={loading}
          style={{ alignSelf: 'flex-start' }}
        >
          {loading ? <span className="spinner" /> : revokeMode ? <ShieldOff size={14} /> : <Share2 size={14} />}
          {revokeMode ? 'Revoke Receiver Access' : 'Share via PRE'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  title: { fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  desc: { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 },
  toggle: { display: 'flex', gap: 10 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '0.78rem', color: 'var(--text-secondary)' },
  hint: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  preInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '12px 14px',
  },
  preStep: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' },
  preNum: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--accent-glow)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    flexShrink: 0,
  },
}
