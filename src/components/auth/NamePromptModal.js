import React, { useEffect, useId, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { markNamePromptSkipped } from '../../lib/auth'

// Asked once after a first sign-in. Closing it any way other than saving counts as "skip" and is remembered,
// so it does not come back on every visit.
export default function NamePromptModal({ onClose, userId }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const titleId = useId()

  const skip = () => { markNamePromptSkipped(userId); onClose() }

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') { markNamePromptSkipped(userId); onClose() } }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [userId, onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !supabase) return
    setLoading(true)
    try {
      await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    } catch { /* the name is a nicety: fail quietly and let them in */ }
    setLoading(false)
    onClose()
  }

  return (
    <div onClick={skip} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(3,6,14,0.72)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'center', zIndex: 99999, overflowY: 'auto', padding: '10vh 16px 40px',
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 24px 80px rgba(2,6,18,0.55)',
        borderRadius: 'var(--radius-lg)', maxWidth: '400px', width: '100%', padding: '32px',
        alignSelf: 'flex-start', textAlign: 'center', animation: 'fadeIn 220ms ease both',
      }}>
        <div aria-hidden="true" style={{ fontSize: '32px', marginBottom: '12px' }}>&#128075;</div>
        <h2 id={titleId} style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>
          Welcome to Meridian
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px' }}>What should we call you?</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="first-name" className="sr-only">First name</label>
          <input id="first-name" name="given-name" type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="First name" autoComplete="given-name" autoFocus disabled={loading}
            className="auth-field" style={{ marginBottom: '16px' }} />
          <button type="submit" disabled={loading || !name.trim()} className="auth-btn">
            {loading ? 'Saving…' : 'Get started →'}
          </button>
        </form>
        <button type="button" onClick={skip} className="auth-link"
          style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '16px' }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
