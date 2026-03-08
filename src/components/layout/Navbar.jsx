import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { usePro } from '../../context/ProContext';
import { useAuth } from '../../context/AuthContext';
import TickerSearch from '../TickerSearch';
import AuthModal from '../auth/AuthModal';

function isMarketOpen() {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = est.getDay();
  const hours = est.getHours();
  const minutes = est.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  if (day === 0 || day === 6) return false;
  return timeInMinutes >= 570 && timeInMinutes < 960;
}

function CompassMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L55 45 L50 50 L45 45 Z" fill="var(--gold)"/>
      <path d="M50 95 L55 55 L50 50 L45 55 Z" fill="var(--gold)" opacity="0.6"/>
      <path d="M5 50 L45 45 L50 50 L45 55 Z" fill="var(--gold)" opacity="0.6"/>
      <path d="M95 50 L55 45 L50 50 L55 55 Z" fill="var(--gold)"/>
      <path d="M20 20 A42 42 0 0 1 80 20" stroke="var(--gold)" strokeWidth="3" fill="none"/>
    </svg>
  );
}

export default function Navbar({ activeTab, setActiveTab, alertCount = 0, onAlertClick }) {
  const { setActiveSymbol } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { isPro, togglePro } = usePro();
  const { user, signOut } = useAuth();
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(isMarketOpen());
  const [authModal, setAuthModal] = useState(null); // 'signin' | 'signup' | null
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setOpen(isMarketOpen());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close avatar dropdown on outside click
  useEffect(() => {
    if (!avatarOpen) return;
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [avatarOpen]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });
  };

  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const nav = useNavigate();
  const handleLogoClick = () => {
    setActiveSymbol(null);
    nav('/');
  };

  const tabs = ['Dashboard', 'Analysis', 'Models', 'Watchlist', 'Portfolio', 'Earnings', 'Options', 'Screener'];

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      backgroundColor: theme === 'light' ? '#FFFFFF' : 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 100,
      gap: '16px',
    }}>
      {/* Left: Compass + Wordmark */}
      <div
        onClick={handleLogoClick}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, cursor: 'pointer' }}
      >
        <CompassMark />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            color: 'var(--gold)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}>
            MERIDIAN
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.05em' }}>
            by Reach Point Research
          </span>
        </div>
      </div>

      {/* Center: Nav Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                borderTop: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: activeTab === tab ? 600 : 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '4px 12px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { if (activeTab !== tab) e.target.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { if (activeTab !== tab) e.target.style.color = 'var(--text-secondary)'; }}
              onMouseDown={e => e.preventDefault()}
            >
              {tab}
            </button>
          ))}
        </div>
        <div style={{ width: '320px', maxWidth: '320px' }}>
          <TickerSearch
            size="sm"
            placeholder="Search ticker or company..."
            onSelect={(sym) => { setActiveSymbol(sym); setActiveTab('Analysis'); }}
          />
        </div>
      </div>

      {/* Right: Pro badge + Theme toggle + Alert badge + Market status + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          onClick={togglePro}
          style={{
            background: isPro ? 'linear-gradient(135deg, var(--gold), #E2BC5A)' : 'none',
            border: isPro ? 'none' : '1px solid var(--gold)',
            borderRadius: '4px',
            color: isPro ? 'var(--bg-primary)' : 'var(--gold)',
            cursor: 'pointer',
            padding: '3px 10px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            transition: 'all 150ms ease',
          }}
          title={isPro ? 'Pro Active (click to toggle)' : 'Upgrade to Pro'}
        >
          PRO
        </button>
        <button
          onClick={toggleTheme}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '5px 7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div
          onClick={onAlertClick}
          style={{ position: 'relative', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title="Price Alerts"
        >
          <span style={{ fontSize: '14px' }}>&#128276;</span>
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              backgroundColor: 'var(--gold)', color: 'var(--bg-primary)',
              fontSize: '9px', fontWeight: 700,
              width: '14px', height: '14px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {alertCount}
            </span>
          )}
        </div>

        {/* Auth */}
        {user ? (
          <div ref={avatarRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold), #E2BC5A)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 700,
              }}
              title={user.email}
            >
              {(user.email || '?')[0].toUpperCase()}
            </button>
            {avatarOpen && (
              <div style={{
                position: 'absolute', top: '38px', right: 0,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '8px 0', minWidth: '200px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200,
              }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={() => { setAvatarOpen(false); signOut(); }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '8px 16px', color: 'var(--text-secondary)',
                    fontSize: '12px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setAuthModal('signin')}
              style={{
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: '6px', padding: '5px 12px',
                color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500,
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthModal('signup')}
              style={{
                background: 'var(--gold)', border: 'none',
                borderRadius: '6px', padding: '5px 12px',
                color: 'var(--bg-primary)', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: open ? 'var(--green)' : 'var(--red)',
            boxShadow: open ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
          }} />
          <span style={{
            color: open ? 'var(--green)' : 'var(--red)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {open ? 'Market Open' : 'Market Closed'}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(now)}
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
            {formatDateDisplay(now)}
          </div>
        </div>
      </div>

      {authModal && <AuthModal onClose={() => setAuthModal(null)} initialMode={authModal} />}
    </nav>
  );
}
