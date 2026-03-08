import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import AuthModal from './AuthModal'

export default function GuestGate({ children, feature = 'this feature' }) {
  const { user } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  if (user) return children

  return (
    <>
      <div style={{
        position: 'relative', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
          {children}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,26,0.7)', backdropFilter: 'blur(2px)',
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Sign in to access {feature}
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '16px' }}>
            Free account required
          </p>
          <button
            onClick={() => setShowAuth(true)}
            style={{
              background: 'var(--gold)', color: 'var(--bg-primary)', border: 'none',
              borderRadius: '6px', padding: '8px 20px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </div>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}
