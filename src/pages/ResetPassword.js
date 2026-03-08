import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', padding: '12px 16px', color: '#ffffff', fontSize: '14px',
  outline: 'none', fontFamily: 'inherit',
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      showToast('Password updated successfully')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0A0E1A',
      display: 'flex', justifyContent: 'center', padding: '10vh 16px 40px',
    }}>
      <div style={{
        background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', maxWidth: '440px', width: '100%', padding: '32px',
        alignSelf: 'flex-start',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{
              background: 'linear-gradient(135deg, #C9A84C, #E2BC5A)',
              color: '#000', fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em',
              padding: '3px 10px', borderRadius: '4px',
            }}>MERIDIAN</span>
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>
            Set New Password
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
            Enter your new password below
          </p>
        </div>

        {!ready ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            Verifying reset link...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="New password (min 8 characters)" disabled={loading}
              style={{ ...INPUT_STYLE, marginBottom: '12px' }}
              onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password" disabled={loading}
              style={{ ...INPUT_STYLE, marginBottom: '12px' }}
              onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', background: '#F0A500', color: '#000000', border: 'none',
              borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', marginTop: '8px', opacity: loading ? 0.6 : 1,
            }}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
