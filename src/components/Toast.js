import React, { useState, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(() => {})

let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{
        position: 'fixed', bottom: '20px', right: '20px',
        zIndex: 100000, display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const borderColor = t.type === 'error' ? 'var(--red)' : t.type === 'info' ? 'var(--gold)' : 'var(--green)'
          return (
            <div key={t.id} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: '6px', padding: '10px 16px', fontSize: '12px',
              color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              animation: 'toastSlideIn 200ms ease-out',
              pointerEvents: 'auto', maxWidth: '320px',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
