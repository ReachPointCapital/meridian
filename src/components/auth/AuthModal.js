import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError, interpretSignUp, isNetworkError, UNAVAILABLE_MESSAGE } from '../../lib/auth'
import { isAuthReachable } from '../../lib/authHealth'
import { useToast } from '../Toast'

const NOT_CONFIGURED_MESSAGE = 'Sign-in is not set up for this site yet.'

const TITLES = { signin: 'Sign in', signup: 'Create account', forgot: 'Reset password' }

function Field({ id, label, type = 'text', value, onChange, autoComplete, placeholder, disabled, autoFocus, minLength }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id} name={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} placeholder={placeholder || label} disabled={disabled}
        autoFocus={autoFocus} minLength={minLength} required className="auth-field"
        inputMode={type === 'email' ? 'email' : undefined} autoCapitalize="none" spellCheck={false}
      />
    </div>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete, placeholder, disabled, minLength }) {
  const [shown, setShown] = useState(false)
  return (
    <div style={{ marginBottom: '12px', position: 'relative' }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id} name={id} type={shown ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} placeholder={placeholder || label} disabled={disabled}
        minLength={minLength} required className="auth-field" style={{ paddingRight: '44px' }}
        autoCapitalize="none" spellCheck={false}
      />
      <button
        type="button" onClick={() => setShown(s => !s)} aria-label={shown ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-tertiary)',
          display: 'flex',
        }}
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export default function AuthModal({ onClose, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [reachable, setReachable] = useState(null) // null = still checking
  const showToast = useToast()
  const titleId = useId()
  const dialogRef = useRef(null)

  // Is the auth server there at all? (A paused or deleted project makes every sign-in fail.)
  useEffect(() => {
    let alive = true
    isAuthReachable().then(ok => { if (alive) setReachable(ok) })
    return () => { alive = false }
  }, [])

  // Escape closes; Tab stays inside the dialog; focus returns to where it was when the dialog closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus()
    }
  }, [onClose])

  const notConfigured = !supabase
  const unavailable = notConfigured || reachable === false
  const banner = notConfigured ? NOT_CONFIGURED_MESSAGE : reachable === false ? UNAVAILABLE_MESSAGE : ''
  const blocked = loading || unavailable

  const switchMode = (next) => { setMode(next); setError(''); setSuccessMsg('') }

  const fail = (err) => {
    setError(friendlyAuthError(err))
    if (isNetworkError(err)) setReachable(false)
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    if (blocked) return
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) throw err
      showToast('Welcome back')
      onClose()
      return
    } catch (err) {
      fail(err)
    }
    setLoading(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (blocked) return
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(), password, options: { emailRedirectTo: window.location.origin },
      })
      if (err) throw err
      const outcome = interpretSignUp(data)
      if (outcome === 'signed-in') { showToast('Account created. Welcome to Meridian'); onClose(); return }
      if (outcome === 'exists') setError(friendlyAuthError({ code: 'user_already_exists' }))
      else setSuccessMsg('Check your email to confirm your account, then sign in.')
    } catch (err) {
      fail(err)
    }
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (blocked) return
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (err) throw err
      setSuccessMsg('If that email has an account, a reset link is on its way.')
    } catch (err) {
      fail(err)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    if (blocked) return
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: window.location.origin },
    })
    if (err) fail(err)
  }

  const errorBox = error && (
    <div role="alert" style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '10px' }}>{error}</div>
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(3,6,14,0.72)', backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center', zIndex: 99998, overflowY: 'auto', padding: '10vh 16px 40px',
      }}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 24px 80px rgba(2,6,18,0.55)',
          borderRadius: 'var(--radius-lg)', maxWidth: '440px', width: '100%', padding: '32px',
          position: 'relative', alignSelf: 'flex-start', animation: 'fadeIn 220ms ease both',
        }}
      >
        <button
          type="button" onClick={onClose} aria-label="Close"
          style={{
            position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', padding: '6px',
            color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex',
          }}
        ><X size={18} /></button>

        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{
              background: 'linear-gradient(135deg, var(--gold), var(--gold-hover))', color: 'var(--bg-primary)',
              fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em', padding: '3px 10px', borderRadius: '4px',
            }}>MERIDIAN</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>by Reach Point Research</span>
          </div>
          <h2 id={titleId} style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, margin: '0 0 4px' }}>
            {TITLES[mode]}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            Access your watchlist, portfolio, and saved models
          </p>
        </div>

        {banner && (
          <div role="alert" style={{
            display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '18px', padding: '12px 14px',
            background: 'var(--red-muted)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.45,
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: '2px' }} />
            <span>{banner}</span>
          </div>
        )}

        {successMsg ? (
          <div role="status" style={{
            background: 'var(--green-muted)', border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)',
            borderRadius: 'var(--radius-md)', padding: '16px', color: 'var(--green)', fontSize: '14px', textAlign: 'center',
          }}>{successMsg}</div>
        ) : (
          <>
            <button
              type="button" onClick={handleGoogle} disabled={blocked}
              style={{
                width: '100%', background: '#ffffff', color: '#1f2937', border: 'none', borderRadius: 'var(--radius-md)',
                padding: '12px', fontSize: '14px', fontWeight: 600, cursor: blocked ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px',
                opacity: blocked ? 0.55 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }} aria-hidden="true">
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            {mode === 'signin' && (
              <form onSubmit={handleSignIn}>
                <Field id="auth-email" label="Email address" type="email" value={email} onChange={setEmail}
                  autoComplete="email" disabled={blocked} autoFocus />
                <PasswordField id="auth-password" label="Password" value={password} onChange={setPassword}
                  autoComplete="current-password" disabled={blocked} />
                <div style={{ textAlign: 'right', marginBottom: '12px', marginTop: '-4px' }}>
                  <button type="button" className="auth-link" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                    onClick={() => switchMode('forgot')}>Forgot password?</button>
                </div>
                {errorBox}
                <button type="submit" disabled={blocked} className="auth-btn">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '18px', marginBottom: 0 }}>
                  Don't have an account?{' '}
                  <button type="button" className="auth-link" onClick={() => switchMode('signup')}>Create one</button>
                </p>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignUp}>
                <Field id="auth-email" label="Email address" type="email" value={email} onChange={setEmail}
                  autoComplete="email" disabled={blocked} autoFocus />
                <PasswordField id="auth-password" label="Password" placeholder="Password (min 8 characters)" value={password}
                  onChange={setPassword} autoComplete="new-password" disabled={blocked} minLength={8} />
                <PasswordField id="auth-confirm" label="Confirm password" value={confirmPassword}
                  onChange={setConfirmPassword} autoComplete="new-password" disabled={blocked} />
                {errorBox}
                <button type="submit" disabled={blocked} className="auth-btn">
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '18px', marginBottom: 0 }}>
                  Already have an account?{' '}
                  <button type="button" className="auth-link" onClick={() => switchMode('signin')}>Sign in</button>
                </p>
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px', marginTop: '10px', marginBottom: 0 }}>
                  By creating an account you agree to our{' '}
                  <a href="/disclaimer" style={{ color: 'var(--text-secondary)' }}>disclaimer</a>
                </p>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgot}>
                <Field id="auth-email" label="Email address" type="email" value={email} onChange={setEmail}
                  autoComplete="email" disabled={blocked} autoFocus />
                {errorBox}
                <button type="submit" disabled={blocked} className="auth-btn">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '18px', marginBottom: 0 }}>
                  <button type="button" className="auth-link" onClick={() => switchMode('signin')}>Back to sign in</button>
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
