import React, { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', padding: '12px 16px', color: '#ffffff', fontSize: '14px',
  outline: 'none', fontFamily: 'inherit',
}

const GOLD_BTN = {
  width: '100%', background: '#F0A500', color: '#000000', border: 'none',
  borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700,
  cursor: 'pointer', marginTop: '8px',
}

function friendlyError(msg) {
  if (!msg) return 'Something went wrong'
  if (msg.includes('Invalid login')) return 'Incorrect email or password'
  if (msg.includes('already registered')) return 'An account with this email already exists'
  if (msg.includes('at least 6')) return 'Password must be at least 8 characters'
  if (msg.includes('invalid email')) return 'Please enter a valid email address'
  return msg
}

export default function AuthModal({ onClose, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const showToast = useToast()

  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Auth is not configured'); return }
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      showToast(`Welcome back, ${email}`)
      onClose()
    } catch (err) {
      setError(friendlyError(err.message))
    }
    setLoading(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Auth is not configured'); return }
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setSuccessMsg('Check your email to confirm your account')
    } catch (err) {
      setError(friendlyError(err.message))
    }
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Auth is not configured'); return }
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw error
      setSuccessMsg('Check your email for a reset link')
    } catch (err) {
      setError(friendlyError(err.message))
    }
    setLoading(false)
  }

  const handleGoogleOAuth = async () => {
    if (!supabase) { setError('Auth is not configured'); return }
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    } catch (err) {
      setError(friendlyError(err.message))
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center',
      zIndex: 99998, overflowY: 'auto', padding: '10vh 16px 40px',
    }} onClick={onClose}>
      <div style={{
        background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', maxWidth: '440px', width: '100%', padding: '32px',
        position: 'relative', alignSelf: 'flex-start',
      }} onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
        }}><X size={18} /></button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{
              background: 'linear-gradient(135deg, #C9A84C, #E2BC5A)',
              color: '#000', fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em',
              padding: '3px 10px', borderRadius: '4px',
            }}>MERIDIAN</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>by Reach Point Research</span>
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
            Access your watchlist, portfolio, and saved models
          </p>
        </div>

        {successMsg ? (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px', padding: '16px', color: '#22c55e', fontSize: '13px',
            textAlign: 'center',
          }}>{successMsg}</div>
        ) : (
          <>
            {/* Google OAuth */}
            <button onClick={handleGoogleOAuth} disabled={loading} style={{
              width: '100%', background: '#ffffff', color: '#000000', border: 'none',
              borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px', marginBottom: '20px', opacity: loading ? 0.5 : 1,
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* Forms */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email address" disabled={loading}
                  style={{ ...INPUT_STYLE, marginBottom: '12px' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password" disabled={loading}
                  style={{ ...INPUT_STYLE, marginBottom: '4px' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <div style={{ textAlign: 'right', marginBottom: '12px' }}>
                  <span onClick={() => { setMode('forgot'); setError('') }}
                    style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer' }}
                  >Forgot password?</span>
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...GOLD_BTN, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '16px' }}>
                  Don't have an account?{' '}
                  <span onClick={() => { setMode('signup'); setError('') }} style={{ color: '#F0A500', cursor: 'pointer' }}>Create one</span>
                </p>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignUp}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email address" disabled={loading}
                  style={{ ...INPUT_STYLE, marginBottom: '12px' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password (min 8 characters)" disabled={loading}
                  style={{ ...INPUT_STYLE, marginBottom: '12px' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password" disabled={loading}
                  style={{ ...INPUT_STYLE, marginBottom: '12px' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...GOLD_BTN, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '16px' }}>
                  Already have an account?{' '}
                  <span onClick={() => { setMode('signin'); setError('') }} style={{ color: '#F0A500', cursor: 'pointer' }}>Sign in</span>
                </p>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '8px' }}>
                  By creating an account you agree to our{' '}
                  <a href="/disclaimer" style={{ color: 'rgba(255,255,255,0.4)' }}>disclaimer</a>
                </p>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgot}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email address" disabled={loading}
                  style={{ ...INPUT_STYLE, marginBottom: '12px' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...GOLD_BTN, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '16px' }}>
                  <span onClick={() => { setMode('signin'); setError('') }} style={{ color: '#F0A500', cursor: 'pointer' }}>Back to Sign In</span>
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
