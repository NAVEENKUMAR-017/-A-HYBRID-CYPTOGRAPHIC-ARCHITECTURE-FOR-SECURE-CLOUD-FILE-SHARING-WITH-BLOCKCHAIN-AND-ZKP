/**
 * pages/AuthPage.jsx
 * Login / Register / Confirm with AWS Cognito
 */

import { useState } from 'react'
import { Lock, Mail, KeyRound, ShieldCheck } from 'lucide-react'
import { signIn, signUp, confirmSignUp } from '../utils/cognito'
import { useAuth } from '../utils/AuthContext'

export default function AuthPage() {
  const { login } = useAuth()
  const [mode, setMode]       = useState('login')   // 'login' | 'register' | 'confirm'
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const result = await signIn(email, password)
      login({
        idToken:  result.idToken,
        userId:   result.idToken ? parseJwt(result.idToken).sub : '',
        email,
      })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signUp(email, password)
      setMode('confirm')
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  const handleConfirm = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await confirmSignUp(email, code)
      setMode('login')
    } catch (err) {
      setError(err.message || 'Confirmation failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={styles.page}>
      {/* Grid background */}
      <div style={styles.grid} />

      <div style={styles.box}>
        {/* Logo */}
        <div style={styles.logo}>
          <ShieldCheck size={28} color="var(--accent)" strokeWidth={1.5} />
          <span style={styles.logoText}>SecureShare</span>
        </div>

        <p style={styles.subtitle}>
          {mode === 'login'    && 'Sign in to your encrypted workspace'}
          {mode === 'register' && 'Create your secure account'}
          {mode === 'confirm'  && 'Enter the verification code sent to your email'}
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={styles.form}>
            <Field icon={<Mail size={15}/>} label="Email">
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </Field>
            <Field icon={<Lock size={15}/>} label="Password">
              <input className="input" type="password" value={password}
                onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
            </Field>
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            <p style={styles.switchText}>
              No account?{' '}
              <button type="button" style={styles.link} onClick={() => { setMode('register'); setError('') }}>
                Register
              </button>
            </p>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={styles.form}>
            <Field icon={<Mail size={15}/>} label="Email">
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </Field>
            <Field icon={<Lock size={15}/>} label="Password">
              <input className="input" type="password" value={password}
                onChange={e => setPass(e.target.value)} placeholder="Min 8 characters" required />
            </Field>
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
            <p style={styles.switchText}>
              Already registered?{' '}
              <button type="button" style={styles.link} onClick={() => { setMode('login'); setError('') }}>
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* Confirm form */}
        {mode === 'confirm' && (
          <form onSubmit={handleConfirm} style={styles.form}>
            <Field icon={<KeyRound size={15}/>} label="Verification Code">
              <input className="input" type="text" value={code}
                onChange={e => setCode(e.target.value)} placeholder="123456" required />
            </Field>
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Verify & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon} {label}
      </label>
      {children}
    </div>
  )
}

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])) } catch { return {} }
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    opacity: 0.4,
  },
  box: {
    position: 'relative', zIndex: 1,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '36px 40px',
    width: 400,
    display: 'flex', flexDirection: 'column', gap: 20,
    boxShadow: '0 0 60px rgba(0,212,255,0.05)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoText: { fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' },
  subtitle: { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 },
  errorBox: {
    background: 'var(--red-dim)', border: '1px solid rgba(255,68,85,0.3)',
    borderRadius: 6, padding: '10px 14px', fontSize: '0.82rem', color: 'var(--red)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  submitBtn: { width: '100%', justifyContent: 'center', marginTop: 4 },
  switchText: { fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' },
  link: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.82rem' },
}
