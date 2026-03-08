import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', padding: '12px 16px', color: '#ffffff', fontSize: '14px',
  outline: 'none', fontFamily: 'inherit',
}

export default function NamePromptModal({ onClose }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !supabase) return
    setLoading(true)
    try {
      await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    } catch {}
    setLoading(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center',
      zIndex: 99999, overflowY: 'auto', padding: '10vh 16px 40px',
    }} onClick={onClose}>
      <div style={{
        background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', maxWidth: '400px', width: '100%', padding: '32px',
        alignSelf: 'flex-start', textAlign: 'center',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#128075;</div>
        <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
          Welcome to Meridian
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 24px' }}>
          What should we call you?
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="First Name" autoFocus disabled={loading}
            style={{ ...INPUT_STYLE, marginBottom: '16px' }}
            onFocus={e => e.target.style.borderColor = 'rgba(240,165,0,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <button type="submit" disabled={loading || !name.trim()} style={{
            width: '100%', background: '#F0A500', color: '#000000', border: 'none',
            borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', opacity: loading || !name.trim() ? 0.6 : 1,
          }}>
            {loading ? 'Saving...' : 'Get Started \u2192'}
          </button>
        </form>
        <p
          onClick={onClose}
          style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '16px', cursor: 'pointer' }}
        >
          Skip for now
        </p>
      </div>
    </div>
  )
}
