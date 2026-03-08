import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
  borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px',
  outline: 'none', fontFamily: 'inherit',
}

const LABEL_STYLE = {
  display: 'block', color: 'var(--text-secondary)', fontSize: '11px',
  fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px', padding: '24px',
}

const SECTION_TITLE = {
  fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
  fontWeight: 700, letterSpacing: '0.15em', marginBottom: '16px',
}

const GOLD_BTN = {
  background: 'var(--gold)', color: 'var(--bg-primary)', border: 'none',
  borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer',
}

function SaveButton({ loading, onClick, label = 'Save Changes', loadingLabel = 'Saving...' }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ ...GOLD_BTN, opacity: loading ? 0.6 : 1, marginTop: '16px' }}>
      {loading ? loadingLabel : label}
    </button>
  )
}

export default function Account() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const showToast = useToast()

  // Profile
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Danger
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [signingOutAll, setSigningOutAll] = useState(false)

  const isEmailProvider = user?.app_metadata?.provider === 'email'

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    const meta = user.user_metadata || {}
    const full = meta.full_name || ''
    const parts = full.split(' ')
    setFirstName(parts[0] || '')
    setLastName(parts.slice(1).join(' ') || '')
    setDisplayName(meta.display_name || '')
  }, [user])

  if (authLoading || !user) return null

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  const currentDisplayName = user?.user_metadata?.display_name
    || user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'User'

  const avatarLetter = currentDisplayName[0].toUpperCase()

  const handleProfileSave = async () => {
    if (!supabase) return
    setProfileSaving(true)
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          display_name: displayName.trim() || undefined,
        },
      })
      showToast('Profile updated')
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error')
    }
    setProfileSaving(false)
  }

  const handleEmailUpdate = async () => {
    if (!supabase || !newEmail.trim()) return
    setEmailSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) throw error
      showToast('Confirmation sent to new email address')
      setNewEmail('')
    } catch (err) {
      showToast(err.message || 'Failed to update email', 'error')
    }
    setEmailSaving(false)
  }

  const handlePasswordUpdate = async () => {
    if (!supabase) return
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      showToast('Password updated')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err.message || 'Failed to update password', 'error')
    }
    setPasswordSaving(false)
  }

  const handleSignOutAll = async () => {
    if (!supabase) return
    setSigningOutAll(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      showToast('Signed out of all devices')
    } catch (err) {
      showToast(err.message || 'Failed to sign out', 'error')
    }
    setSigningOutAll(false)
  }

  const handleDeleteAccount = async () => {
    if (!supabase) return
    try {
      const { error } = await supabase.rpc('delete_user')
      if (error) throw error
      showToast('Account deleted')
    } catch (err) {
      showToast('Account deletion requires a server-side function. Contact support.', 'error')
    }
    setShowDeleteConfirm(false)
  }

  const focusBorder = (e) => { e.target.style.borderColor = 'var(--gold)' }
  const blurBorder = (e) => { e.target.style.borderColor = 'var(--border-color)' }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold), #E2BC5A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px', color: 'var(--bg-primary)',
          fontSize: '24px', fontWeight: 900,
        }}>
          {avatarLetter}
        </div>
        <div style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700 }}>
          {currentDisplayName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>
          {user.email}
        </div>
        {memberSince && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>
            Member since {memberSince}
          </div>
        )}
      </div>

      {/* Profile */}
      <div style={{ ...CARD_STYLE, marginTop: '32px' }}>
        <div style={SECTION_TITLE}>Profile</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>First Name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              style={INPUT_STYLE} onFocus={focusBorder} onBlur={blurBorder} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              style={INPUT_STYLE} onFocus={focusBorder} onBlur={blurBorder} />
          </div>
        </div>
        <div>
          <label style={LABEL_STYLE}>Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="What shows in the navbar"
            style={INPUT_STYLE} onFocus={focusBorder} onBlur={blurBorder} />
        </div>
        <SaveButton loading={profileSaving} onClick={handleProfileSave} />
      </div>

      {/* Email */}
      <div style={{ ...CARD_STYLE, marginTop: '16px' }}>
        <div style={SECTION_TITLE}>Email Address</div>
        <div style={{ marginBottom: '12px' }}>
          <label style={LABEL_STYLE}>Current Email</label>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '10px 0' }}>
            {user.email}
          </div>
        </div>
        <div>
          <label style={LABEL_STYLE}>New Email</label>
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            placeholder="new@email.com"
            style={INPUT_STYLE} onFocus={focusBorder} onBlur={blurBorder} />
        </div>
        <SaveButton loading={emailSaving} onClick={handleEmailUpdate}
          label="Update Email" loadingLabel="Sending..." />
      </div>

      {/* Password */}
      <div style={{ ...CARD_STYLE, marginTop: '16px' }}>
        <div style={SECTION_TITLE}>Change Password</div>
        {isEmailProvider ? (
          <>
            <div style={{ marginBottom: '12px' }}>
              <label style={LABEL_STYLE}>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                style={INPUT_STYLE} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={INPUT_STYLE} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
            {passwordError && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>{passwordError}</div>
            )}
            <SaveButton loading={passwordSaving} onClick={handlePasswordUpdate}
              label="Update Password" loadingLabel="Updating..." />
          </>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>
            You signed in with Google &mdash; password management is handled by Google.
          </p>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{
        ...CARD_STYLE, marginTop: '16px',
        borderColor: 'rgba(127,29,29,0.3)',
        background: 'rgba(127,29,29,0.1)',
      }}>
        <div style={{ ...SECTION_TITLE, color: 'rgba(239,68,68,0.5)' }}>Danger Zone</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSignOutAll}
            disabled={signingOutAll}
            style={{
              background: 'none', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', padding: '10px 16px',
              color: '#ef4444', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', opacity: signingOutAll ? 0.6 : 1,
            }}
          >
            {signingOutAll ? 'Signing out...' : 'Sign Out of All Devices'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              background: 'none', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', padding: '10px 16px',
              color: '#ef4444', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '100%',
            textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#ef4444', fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>
              Delete Account?
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 24px' }}>
              Are you sure? This cannot be undone. All your data including watchlists and notes will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  background: 'none', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '10px 20px',
                  color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                style={{
                  background: '#ef4444', border: 'none',
                  borderRadius: '8px', padding: '10px 20px',
                  color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
