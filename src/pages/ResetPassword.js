import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase, INITIAL_URL } from '../lib/supabase'
import { friendlyAuthError, looksLikeRecoveryLink, UNAVAILABLE_MESSAGE } from '../lib/auth'
import { isAuthReachable } from '../lib/authHealth'
import { useToast } from '../components/Toast'

const VERIFY_TIMEOUT_MS = 8000

export default function ResetPassword() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shown, setShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 'verifying' -> 'ready' (a valid recovery link) | 'invalid' (expired, reused or opened by hand) | 'unavailable'
  const [status, setStatus] = useState('verifying')

  useEffect(() => {
    if (!supabase) { setStatus('invalid'); return undefined }
    let alive = true

    // The recovery event can fire before this page mounts (Supabase handles the link as the app starts), so
    // also accept an existing session when the page was opened from a recovery link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (alive && event === 'PASSWORD_RECOVERY') setStatus('ready')
    })
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data?.session && looksLikeRecoveryLink(INITIAL_URL)) setStatus('ready')
    })
    isAuthReachable().then((ok) => { if (alive && !ok) setStatus('unavailable') })
    // Never sit on "Verifying…" forever
    const timer = setTimeout(() => { if (alive) setStatus((s) => (s === 'verifying' ? 'invalid' : s)) }, VERIFY_TIMEOUT_MS)

    return () => { alive = false; clearTimeout(timer); subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabase) return
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      showToast('Password updated')
      navigate('/dashboard', { replace: true })
      return
    } catch (err) {
      setError(friendlyAuthError(err))
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '10vh 16px 40px' }}>
      <main style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)',
        borderRadius: 'var(--radius-lg)', maxWidth: '440px', width: '100%', padding: '32px', alignSelf: 'flex-start',
        animation: 'fadeIn 280ms ease both',
      }}>
        <div style={{ marginBottom: '22px' }}>
          <span style={{
            display: 'inline-block', marginBottom: '16px',
            background: 'linear-gradient(135deg, var(--gold), var(--gold-hover))', color: 'var(--bg-primary)',
            fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em', padding: '3px 10px', borderRadius: '4px',
          }}>MERIDIAN</span>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, margin: '0 0 4px' }}>Set a new password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Choose a password you haven't used before</p>
        </div>

        {status === 'verifying' && (
          <div role="status" style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            Verifying your reset link…
          </div>
        )}

        {(status === 'invalid' || status === 'unavailable') && (
          <div>
            <div role="alert" style={{
              background: 'var(--red-muted)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)',
              borderRadius: 'var(--radius-md)', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px',
              lineHeight: 1.5, marginBottom: '16px',
            }}>
              {status === 'unavailable'
                ? UNAVAILABLE_MESSAGE
                : 'This reset link is invalid or has expired. Request a new one to continue.'}
            </div>
            <button type="button" className="auth-btn" onClick={() => navigate('/login')}>Back to sign in</button>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <label htmlFor="new-password" className="sr-only">New password</label>
              <input id="new-password" name="new-password" type={shown ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="New password (min 8 characters)"
                autoComplete="new-password" minLength={8} required disabled={loading} autoFocus
                className="auth-field" style={{ paddingRight: '44px' }} />
              <button type="button" onClick={() => setShown(s => !s)} aria-label={shown ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none',
                  border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex',
                }}>
                {shown ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
              <input id="confirm-password" name="confirm-password" type={shown ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password"
                autoComplete="new-password" required disabled={loading} className="auth-field" />
            </div>
            {error && <div role="alert" style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
            <button type="submit" disabled={loading} className="auth-btn">
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
