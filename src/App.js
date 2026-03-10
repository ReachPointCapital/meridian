import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { X, Printer, HelpCircle } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { ProProvider } from './context/ProContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { HelmetProvider } from 'react-helmet-async';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import Account from './pages/Account';
import Navbar from './components/layout/Navbar';
import Layout from './components/layout/Layout';
import EarningsCalendar from './components/terminal/EarningsCalendar';
import OptionsCalculator from './components/terminal/OptionsCalculator';
import Dashboard from './components/dashboard/Dashboard';
import Watchlist from './components/watchlist/Watchlist';
import Portfolio from './components/portfolio/Portfolio';
import Screener from './components/screener/Screener';
import AnalysisTab from './components/analysis/AnalysisTab';
import Home from './pages/Home';
import Models from './pages/Models';
import Disclaimer from './pages/Disclaimer';
import DisclaimerModal from './components/DisclaimerModal';
import { Analytics } from '@vercel/analytics/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#F0F2F5', backgroundColor: '#0A0E1A', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#C9A84C', marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ color: '#8A95A3', fontSize: '14px', marginBottom: '20px' }}>{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button onClick={() => window.location.reload()} style={{ background: '#C9A84C', color: '#0A0E1A', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function EnvBanner() {
  return null;
}

// ── Price Alerts ──
function useAlerts() {
  const [alerts, setAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meridian_alerts') || '[]'); } catch { return []; }
  });

  const save = useCallback((next) => {
    setAlerts(next);
    localStorage.setItem('meridian_alerts', JSON.stringify(next));
  }, []);

  const addAlert = useCallback((symbol, price, direction) => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    save([...alerts, { id: Date.now(), symbol: symbol.toUpperCase(), price: Number(price), direction, triggered: false, createdAt: Date.now() }]);
  }, [alerts, save]);

  const removeAlert = useCallback((id) => {
    save(alerts.filter(a => a.id !== id));
  }, [alerts, save]);

  useEffect(() => {
    const activeAlerts = alerts.filter(a => !a.triggered);
    if (activeAlerts.length === 0) return;

    const check = async () => {
      try {
        const symbols = [...new Set(activeAlerts.map(a => a.symbol))];
        const res = await fetch(`/api/market?type=quote&symbol=${encodeURIComponent(symbols.join(','))}`);
        const data = await res.json();
        const quoteList = Array.isArray(data) ? data : [data];
        const priceMap = {};
        quoteList.forEach(q => { if (q?.symbol) priceMap[q.symbol] = q.price; });

        let changed = false;
        const next = alerts.map(a => {
          if (a.triggered) return a;
          const currentPrice = priceMap[a.symbol];
          if (currentPrice == null) return a;
          const hit = a.direction === 'above' ? currentPrice >= a.price : currentPrice <= a.price;
          if (hit) {
            changed = true;
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Meridian Alert: ${a.symbol}`, {
                body: `${a.symbol} is now $${currentPrice.toFixed(2)} (target: ${a.direction} $${a.price.toFixed(2)})`,
              });
            }
            return { ...a, triggered: true, triggeredAt: Date.now() };
          }
          return a;
        });
        if (changed) save(next);
      } catch {}
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [alerts, save]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cleanup = alerts.filter(a => {
      if (a.triggered && a.triggeredAt && Date.now() - a.triggeredAt > 86400000) return false;
      return true;
    });
    if (cleanup.length !== alerts.length) save(cleanup);
  }, [alerts, save]);

  return { alerts, addAlert, removeAlert };
}

function AlertModal({ alerts, onAdd, onRemove, onClose }) {
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState('above');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (symbol && price) {
      onAdd(symbol, price, direction);
      setSymbol('');
      setPrice('');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw',
        maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Price Alerts
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbol"
            style={{ flex: '1 0 80px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
          />
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" type="number" step="0.01"
            style={{ flex: '1 0 80px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
          />
          <select value={direction} onChange={e => setDirection(e.target.value)}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <button type="submit" style={{
            backgroundColor: 'var(--gold)', border: 'none', borderRadius: '6px', padding: '8px 16px',
            color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>
            Add
          </button>
        </form>

        {alerts.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
            No alerts set. Add a symbol and target price above.
          </p>
        ) : (
          <div>
            {alerts.map(a => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderBottom: '1px solid var(--border-color)',
              }}>
                <div>
                  <span style={{ color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>{a.symbol}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '8px' }}>
                    {a.direction === 'above' ? '>' : '<'} ${Number(a.price).toFixed(2)}
                  </span>
                  {a.triggered && <span style={{ color: 'var(--green)', fontSize: '10px', marginLeft: '6px' }}>TRIGGERED</span>}
                </div>
                <button onClick={() => onRemove(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '14px' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Keyboard Shortcuts Help Modal ──
function ShortcutsModal({ onClose }) {
  const shortcuts = [
    { key: '/', desc: 'Focus search bar' },
    { key: 'Cmd+K', desc: 'Focus search bar' },
    { key: 'Escape', desc: 'Clear search / close modal' },
    { key: 'D', desc: 'Dashboard' },
    { key: 'A', desc: 'Analysis' },
    { key: 'M', desc: 'Models' },
    { key: 'W', desc: 'Watchlist' },
    { key: 'P', desc: 'Portfolio' },
    { key: 'E', desc: 'Earnings' },
    { key: 'O', desc: 'Options' },
    { key: 'S', desc: 'Screener' },
    { key: '?', desc: 'Show this help' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '12px', padding: '24px', width: '360px', maxWidth: '90vw',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Keyboard Shortcuts
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        {shortcuts.map(s => (
          <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{s.desc}</span>
            <kbd style={{
              backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontFamily: 'monospace',
              color: 'var(--gold)',
            }}>{s.key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// Map URL paths to tab names
const PATH_TO_TAB = {
  '/dashboard': 'Dashboard',
  '/analysis': 'Analysis',
  '/models': 'Models',
  '/watchlist': 'Watchlist',
  '/portfolio': 'Portfolio',
  '/earnings': 'Earnings',
  '/options': 'Options',
  '/screener': 'Screener',
};

const TAB_TO_PATH = {
  'Dashboard': '/dashboard',
  'Analysis': '/analysis',
  'Models': '/models',
  'Watchlist': '/watchlist',
  'Portfolio': '/portfolio',
  'Earnings': '/earnings',
  'Options': '/options',
  'Screener': '/screener',
};

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialTab = PATH_TO_TAB[location.pathname] || 'Dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const mainRef = useRef(null);

  const activeAlertCount = alerts.filter(a => !a.triggered).length;

  // Sync URL to tab
  useEffect(() => {
    const tab = PATH_TO_TAB[location.pathname];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const { activeSymbol, quote: ctxQuote } = useApp();
  useEffect(() => {
    const tickerSuffix = activeSymbol && ctxQuote?.price
      ? `${activeSymbol} $${Number(ctxQuote.price).toFixed(2)} | `
      : '';
    const titles = {
      Dashboard: 'Meridian | Dashboard',
      Watchlist: 'Meridian | Watchlist',
      Portfolio: 'Meridian | Portfolio',
      Earnings: 'Meridian | Earnings',
      Options: 'Meridian | Options',
      Screener: 'Meridian | Screener',
      Models: 'Meridian | Models',
      Analysis: `${tickerSuffix}Meridian | Analysis`,
    };
    document.title = titles[activeTab] || 'Meridian';
  }, [activeTab, activeSymbol, ctxQuote]);

  const handleTabChange = useCallback((tab) => {
    const resolved = tab === 'Terminal' ? 'Dashboard' : tab;
    setActiveTab(resolved);
    const path = TAB_TO_PATH[resolved];
    if (path) navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-bar-input');
        if (searchInput) searchInput.focus();
        return;
      }

      if (e.key === 'Escape') {
        setAlertModalOpen(false);
        setShortcutsOpen(false);
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          const searchInput = document.querySelector('.search-bar-input');
          if (searchInput) searchInput.focus();
          break;
        case 'd': case 'D': handleTabChange('Dashboard'); break;
        case 'e': case 'E': handleTabChange('Earnings'); break;
        case 'o': case 'O': handleTabChange('Options'); break;
        case 'w': case 'W': handleTabChange('Watchlist'); break;
        case 't': case 'T': handleTabChange('Dashboard'); break;
        case 'a': case 'A': handleTabChange('Analysis'); break;
        case 'm': case 'M': handleTabChange('Models'); break;
        case 'p': case 'P': handleTabChange('Portfolio'); break;
        case 's': case 'S': handleTabChange('Screener'); break;
        case '?': setShortcutsOpen(true); break;
        default: break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleTabChange]);

  return (
    <>
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} alertCount={activeAlertCount} onAlertClick={() => setAlertModalOpen(true)} />
      <EnvBanner />
      <Layout>
        <div ref={mainRef}>
          {activeTab === 'Dashboard' && <Dashboard setActiveTab={handleTabChange} />}
          {activeTab === 'Watchlist' && <Watchlist setActiveTab={handleTabChange} />}
          {activeTab === 'Portfolio' && <Portfolio setActiveTab={handleTabChange} />}
          {activeTab === 'Earnings' && <EarningsCalendar setActiveTab={handleTabChange} />}
          {activeTab === 'Options' && <OptionsCalculator />}
          {activeTab === 'Screener' && <Screener setActiveTab={handleTabChange} />}
          {activeTab === 'Analysis' && <AnalysisTab setActiveTab={handleTabChange} />}
          {activeTab === 'Models' && <Models />}
        </div>

        {/* Footer */}
        <footer style={{
          marginTop: '48px',
          padding: '20px 0',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
              &copy; {new Date().getFullYear()} Reach Point Research
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setShortcutsOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <HelpCircle size={12} /> Shortcuts
            </button>
            <button onClick={() => window.print()} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Printer size={12} /> Export PDF
            </button>
            <a href="/disclaimer" style={{ color: 'var(--text-tertiary)', fontSize: '11px', textDecoration: 'none', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.target.style.opacity = '0.7'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Disclaimer
            </a>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
              Data: FMP, Polygon, Alpha Vantage, Tiingo, Yahoo Finance
            </span>
          </div>
          <div style={{ width: '100%', textAlign: 'center', marginTop: '8px' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', opacity: 0.7 }}>
              Meridian is a product of Reach Point Research, a division of{' '}
              <a href="https://reachpointcapital.com" target="_blank" rel="noreferrer" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', borderBottom: '1px solid transparent', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.target.style.borderColor = 'var(--text-tertiary)'}
                onMouseLeave={e => e.target.style.borderColor = 'transparent'}
              >Reach Point Capital LLC</a>
            </span>
          </div>
        </footer>
      </Layout>

      {alertModalOpen && (
        <AlertModal alerts={alerts} onAdd={addAlert} onRemove={removeAlert} onClose={() => setAlertModalOpen(false)} />
      )}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}

function HomeWithLayout() {
  const navigate = useNavigate();
  const handleTabChange = useCallback((tab) => {
    const path = TAB_TO_PATH[tab];
    if (path) navigate(path);
  }, [navigate]);

  return (
    <>
      <Navbar activeTab="" setActiveTab={handleTabChange} alertCount={0} onAlertClick={() => {}} />
      <Layout>
        <Home />
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <AppProvider>
              <ProProvider>
              <DisclaimerModal />
              <Routes>
                <Route path="/" element={<HomeWithLayout />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/account" element={<Account />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </ProProvider>
          </AppProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
    <Analytics />
    </HelmetProvider>
  );
}
