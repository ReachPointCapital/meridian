import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, Menu, ChevronDown, Settings, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { usePro } from '../../context/ProContext';
import { useAuth } from '../../context/AuthContext';
import TickerSearch from '../TickerSearch';
import AuthModal from '../auth/AuthModal';
import NamePromptModal from '../auth/NamePromptModal';
import { hasSkippedNamePrompt } from '../../lib/auth';

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
  const { user, signOut, loading: authLoading } = useAuth();
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(isMarketOpen());
  const [authModal, setAuthModal] = useState(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1100);
  const [isPhone, setIsPhone] = useState(window.innerWidth < 720);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [prevUser, setPrevUser] = useState(null);
  const avatarRef = useRef(null);
  const navMenuRef = useRef(null);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setOpen(isMarketOpen());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Responsive resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1100);
      setIsPhone(window.innerWidth < 720);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
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

  // Close nav dropdown on outside click
  useEffect(() => {
    if (!navOpen) return;
    const handler = (e) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target)) setNavOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [navOpen]);

  // Detect new email user (no full_name) and show name prompt
  useEffect(() => {
    if (!user || prevUser?.id === user.id) return;
    setPrevUser(user);
    const fullName = user.user_metadata?.full_name;
    if (!fullName && !hasSkippedNamePrompt(user.id)) {
      setShowNamePrompt(true);
    }
  }, [user, prevUser]);

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

  const handleNavTab = useCallback((tab) => {
    setActiveTab(tab);
    setNavOpen(false);
  }, [setActiveTab]);

  const tabs = ['Dashboard', 'Analysis', 'Models', 'Watchlist', 'Portfolio', 'Earnings', 'Options', 'Screener'];

  // User display name helpers
  const fullName = user?.user_metadata?.full_name || '';
  const displayName = user?.user_metadata?.display_name
    || user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'User';
  const avatarLetter = displayName[0].toUpperCase();

  const menuChipStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '7px 12px',
    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
  };

  return (
    <>
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      // frosted glass: the page glow shows faintly through the bar
      backgroundColor: 'color-mix(in srgb, var(--bg-primary) 82%, transparent)',
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isPhone ? '0 12px' : '0 20px',
      zIndex: 100,
      gap: isPhone ? '8px' : '16px',
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
          {!isPhone && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.05em' }}>
              by Reach Point Research
            </span>
          )}
        </div>
      </div>

      {/* Center: Nav Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'center' }}>
        {isNarrow ? (
          /* Hamburger dropdown for narrow screens */
          <div ref={navMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setNavOpen(!navOpen)}
              style={{
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '12px', fontWeight: 500,
              }}
            >
              <Menu size={16} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {activeTab || 'Menu'}
              </span>
              <ChevronDown size={12} style={{ transform: navOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>
            {navOpen && (
              <div style={{
                ...(isPhone
                  ? { position: 'fixed', top: '60px', left: '12px', right: '12px', maxHeight: 'calc(100vh - 76px)', overflowY: 'auto' }
                  : { position: 'absolute', top: '42px', left: 0 }),
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', zIndex: 200,
                minWidth: isPhone ? 0 : '200px', boxShadow: '0 16px 40px rgba(2,6,18,0.5)',
              }}>
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleNavTab(tab)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'none', border: 'none',
                      padding: '12px 24px',
                      color: activeTab === tab ? 'var(--gold)' : 'var(--text-secondary)',
                      fontSize: '12px', fontWeight: activeTab === tab ? 600 : 400,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {tab}
                  </button>
                ))}
                {isPhone && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <TickerSearch
                      size="sm"
                      placeholder="Search ticker or company..."
                      onSelect={(sym) => { setActiveSymbol(sym); handleNavTab('Analysis'); }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button onClick={toggleTheme} style={menuChipStyle}>
                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                      </button>
                      <button onClick={() => { setNavOpen(false); if (onAlertClick) onAlertClick(); }} style={menuChipStyle}>
                        <Bell size={14} /> Alerts{alertCount > 0 ? ` (${alertCount})` : ''}
                      </button>
                      {!authLoading && !user && (
                        <button onClick={() => { setNavOpen(false); setAuthModal('signup'); }} style={{ ...menuChipStyle, color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                          Create account
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Full tab bar for wide screens */
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
        )}
        {!isPhone && (
          <div style={{ width: isNarrow ? '200px' : '320px', maxWidth: '320px' }}>
            <TickerSearch
              size="sm"
              placeholder="Search ticker or company..."
              onSelect={(sym) => { setActiveSymbol(sym); setActiveTab('Analysis'); }}
            />
          </div>
        )}
      </div>

      {/* Right: Pro badge + Theme toggle + Alert badge + Auth + Market status + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? '8px' : '12px', flexShrink: 0 }}>
        {!isPhone && (
        <>
        <button
          onClick={togglePro}
          style={{
            background: isPro ? 'linear-gradient(135deg, var(--gold), var(--gold-hover))' : 'none',
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
            borderRadius: 'var(--radius-sm)',
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

        <button
          type="button"
          onClick={onAlertClick}
          aria-label="Price alerts"
          style={{ position: 'relative', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)' }}
          title="Price Alerts"
        >
          <Bell size={16} aria-hidden="true" />
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
        </button>
        </>
        )}

        {/* Auth section */}
        {authLoading ? null : user ? (
          <div ref={avatarRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isNarrow && (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                Hi, {displayName}
              </span>
            )}
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold), var(--gold-hover))',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 700,
              }}
              title={user.email}
            >
              {avatarLetter}
            </button>
            {avatarOpen && (
              <div style={{
                position: 'absolute', top: '38px', right: 0,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', padding: '8px 0', minWidth: '200px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200,
              }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  {fullName && (
                    <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>
                      {fullName}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={() => { setAvatarOpen(false); nav('/account'); }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '8px 16px', color: 'var(--text-secondary)',
                    fontSize: '12px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Settings size={14} /> Account Settings
                </button>
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
                borderRadius: 'var(--radius-sm)', padding: '5px 12px',
                color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500,
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Sign In
            </button>
            {!isPhone && (
              <button
                onClick={() => setAuthModal('signup')}
                style={{
                  background: 'var(--gold)', border: 'none',
                  borderRadius: 'var(--radius-sm)', padding: '5px 12px',
                  color: 'var(--bg-primary)', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign Up
              </button>
            )}
          </div>
        )}

        {!isNarrow && (
          <>
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
          </>
        )}
      </div>

    </nav>
    {/* Dialogs sit beside the nav, not inside it: the nav's backdrop-filter would otherwise become their containing
        block and shrink their full-screen overlay to the height of the bar. */}
    {authModal && <AuthModal onClose={() => setAuthModal(null)} initialMode={authModal} />}
    {showNamePrompt && <NamePromptModal userId={user?.id} onClose={() => setShowNamePrompt(false)} />}
    </>
  );
}
