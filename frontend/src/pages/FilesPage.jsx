/**
 * pages/FilesPage.jsx
 * Upload encrypted files + list owned and shared files.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Download,
  FileText,
  Lock,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { deleteFile, downloadFile, listFiles, uploadFile, zkpProve } from '../utils/api'

export default function FilesPage({ toast, onShareClick }) {
  const [files, setFiles] = useState([])
  const [sharedFiles, setSharedFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef()

  const getStoredCredentials = () => ({
    pubKey: localStorage.getItem('sfs_public_key') || '',
    privKey: localStorage.getItem('sfs_private_key') || '',
    ethAddr: localStorage.getItem('sfs_eth_address') || '',
    ethPriv: localStorage.getItem('sfs_eth_private_key') || '',
  })

  const pubKey = getStoredCredentials().pubKey
  const privKey = getStoredCredentials().privKey
  const ethAddr = getStoredCredentials().ethAddr
  const ethPriv = getStoredCredentials().ethPriv
  const keysReady = pubKey && privKey && ethAddr && ethPriv

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const data = await listFiles()
      setFiles(data.files || [])
      setSharedFiles(data.shared_files || [])
    } catch {
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleUpload = async (file) => {
    const { pubKey: savedPubKey, privKey: savedPrivKey, ethAddr: savedEthAddr, ethPriv: savedEthPriv } = getStoredCredentials()
    if (!(savedPubKey && savedPrivKey && savedEthAddr && savedEthPriv)) {
      return toast.error('Generate RSA keys and save your Ethereum wallet first (Keys tab)')
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('public_key', savedPubKey)
      fd.append('eth_address', savedEthAddr)
      fd.append('eth_private_key', savedEthPriv)

      const result = await uploadFile(fd)
      toast.success(`"${file.name}" uploaded. TX: ${result.tx_hash.slice(0, 12)}...`)
      fetchFiles()
    } catch (e) {
      const message =
        e.response?.data?.error ||
        (e.code === 'ERR_NETWORK'
          ? 'Could not reach the upload API. Check the backend URL and browser network access.'
          : e.message)
      toast.error('Upload failed: ' + message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return
    try {
      await deleteFile(fileId)
      toast.success(`"${fileName}" deleted.`)
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId))
    } catch {
      toast.error('Delete failed')
    }
  }

  const handleDownload = async (fileId, fileName) => {
    const { privKey: savedPrivKey, ethAddr: savedEthAddr, ethPriv: savedEthPriv } = getStoredCredentials()
    if (!savedPrivKey) return toast.error('Private key not found. Generate or restore it in the Keys tab.')
    if (!savedEthAddr || !savedEthPriv) return toast.error('Ethereum wallet not saved. Add address and private key in the Keys tab.')

    try {
      toast.info('Generating ZKP proof...')
      const proofRes = await zkpProve(savedPrivKey)

      toast.info('Decrypting file...')
      const result = await downloadFile(fileId, {
        private_key: savedPrivKey,
        eth_address: savedEthAddr,
        eth_private_key: savedEthPriv,
        zkp_proof: JSON.parse(proofRes.proof),
      })

      const bytes = Uint8Array.from(atob(result.content_b64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.file_name || fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success('File decrypted and downloaded.')
    } catch (e) {
      toast.error('Download failed: ' + (e.response?.data?.error || e.message))
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}><FileText size={20} /> My Files</h2>
        <button className="btn btn-ghost btn-sm" onClick={fetchFiles} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {!keysReady && (
        <div style={styles.warningBanner}>
          <Lock size={14} /> Generate your keys in the <strong>Keys</strong> tab before uploading files.
        </div>
      )}

      <div
        style={{ ...styles.dropZone, ...(dragOver ? styles.dropZoneActive : {}) }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
        />
        {uploading ? (
          <>
            <span className="spinner" />
            <span style={{ color: 'var(--accent)' }}>Encrypting and uploading...</span>
          </>
        ) : (
          <>
            <Upload size={22} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Drop a file here or <span style={{ color: 'var(--accent)' }}>click to browse</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Files are AES-256-GCM encrypted before upload
            </span>
          </>
        )}
      </div>

      {loading && files.length === 0 && sharedFiles.length === 0 ? (
        <div style={styles.empty}><span className="spinner" /></div>
      ) : (
        <div style={styles.sections}>
          <FileSection
            title="Owned Files"
            files={files}
            emptyText="No uploaded files yet."
            renderRow={(file) => (
              <FileRow
                key={file.file_id}
                file={file}
                onDownload={() => handleDownload(file.file_id, file.file_name)}
                onShare={() => onShareClick(file)}
                onDelete={() => handleDelete(file.file_id, file.file_name)}
              />
            )}
          />

          <FileSection
            title="Shared With Me"
            files={sharedFiles}
            emptyText="No files have been shared with you yet."
            renderRow={(file) => (
              <FileRow
                key={file.file_id}
                file={file}
                onDownload={() => handleDownload(file.file_id, file.file_name)}
                shared
              />
            )}
          />
        </div>
      )}
    </div>
  )
}

function FileSection({ title, files, emptyText, renderRow }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <span style={styles.sectionCount}>{files.length}</span>
      </div>
      {files.length === 0 ? (
        <div style={styles.sectionEmpty}>{emptyText}</div>
      ) : (
        <div style={styles.fileList}>{files.map(renderRow)}</div>
      )}
    </section>
  )
}

function FileRow({ file, onDownload, onShare, onDelete, shared = false }) {
  return (
    <div style={styles.fileRow}>
      <div style={styles.fileIcon}><FileText size={16} color="var(--accent)" /></div>
      <div style={styles.fileMeta}>
        <span style={styles.fileName}>{file.file_name}</span>
        <span style={styles.fileId} className="mono">{file.file_id.slice(0, 20)}...</span>
      </div>
      {shared && (
        <span style={styles.sharedBy} className="mono" title={file.shared_by || ''}>
          From {file.shared_by?.slice(0, 12) || 'unknown'}...
        </span>
      )}
      <span className="badge badge-green" style={{ marginLeft: 'auto', marginRight: 8 }}>
        <ShieldCheck size={10} /> {shared ? 'Shared' : 'Encrypted'}
      </span>
      <div style={styles.fileActions}>
        <button className="btn btn-ghost btn-sm" title="Download and decrypt" onClick={onDownload}>
          <Download size={13} />
        </button>
        {!shared && (
          <button className="btn btn-ghost btn-sm" title="Share via PRE" onClick={onShare}>
            <Share2 size={13} />
          </button>
        )}
        {!shared && (
          <button className="btn btn-danger btn-sm" title="Delete" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  warningBanner: {
    background: 'rgba(255,215,0,0.08)',
    border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: '0.83rem',
    color: 'var(--yellow)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: 10,
    padding: '36px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dropZoneActive: { borderColor: 'var(--accent)', background: 'var(--accent-glow)' },
  sections: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' },
  sectionCount: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '2px 8px',
    fontFamily: 'var(--font-mono)',
  },
  sectionEmpty: {
    display: 'flex',
    alignItems: 'center',
    minHeight: 48,
    color: 'var(--text-muted)',
    fontSize: '0.84rem',
  },
  fileList: { display: 'flex', flexDirection: 'column', gap: 8 },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 16px',
    transition: 'border-color 0.15s',
  },
  fileIcon: { flexShrink: 0 },
  fileMeta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  fileName: { fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileId: { fontSize: '0.72rem', color: 'var(--text-muted)' },
  sharedBy: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  fileActions: { display: 'flex', gap: 6, flexShrink: 0 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0', color: 'var(--text-muted)' },
}
