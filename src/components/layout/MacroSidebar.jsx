import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';
import { api } from '../../services/api';
import { formatPrice, formatPercent } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

const LABEL_MAP = {
  SPY: 'S&P 500', QQQ: 'NASDAQ', DIA: 'Dow Jones',
  IWM: 'Russell 2000', VXX: 'VIX', GLD: 'Gold',
  USO: 'Oil', 'BTC-USD': 'Bitcoin',
};

function MacroItem({ item, onSelect }) {
  const positive = (item.changePercent || 0) >= 0;
  const changeColor = positive ? 'var(--green)' : 'var(--red)';

  return (
    <div
      onClick={() => onSelect && onSelect(item.symbol)}
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {item.label}
        </span>
        <span style={{
          color: changeColor,
          fontSize: '10px',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {item.changePercent != null ? formatPercent(item.changePercent) : '\u2014'}
        </span>
      </div>
      <div style={{
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'monospace',
        fontVariantNumeric: 'tabular-nums',
        marginTop: '2px',
      }}>
        {item.price != null ? formatPrice(item.price) : '\u2014'}
      </div>
    </div>
  );
}

export default function MacroSidebar() {
  const { setActiveSymbol } = useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('meridian_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const prevDataRef = useRef([]);

  const fetchData = useCallback(async () => {
    if (prevDataRef.current.length === 0) setLoading(true);
    try {
      const result = await api.macro();
      const mapped = Array.isArray(result) ? result.map(item => ({
        symbol: item.symbol,
        label: item.label || LABEL_MAP[item.symbol] || item.symbol,
        price: item.price,
        change: item.change,
        changePercent: item.changePercent,
      })) : [];
      prevDataRef.current = mapped;
      setData(mapped);
    } catch (e) {
      console.error('MacroSidebar fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('meridian_sidebar_collapsed', String(next));
    window.dispatchEvent(new Event('sidebar-toggle'));
  };

  const sidebarWidth = collapsed ? 32 : 200;

  const sidebarContent = (
    <>
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          color: 'var(--gold)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          Market Overview
        </span>
        <button
          onClick={() => setMobileOpen(false)}
          className="macro-mobile-close"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <div className="skeleton" style={{ height: '10px', width: '60%', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '14px', width: '40%' }} />
            </div>
          ))
        ) : (
          data.map(item => (
            <MacroItem key={item.symbol} item={item} onSelect={setActiveSymbol} />
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="macro-sidebar-desktop" style={{
        position: 'fixed',
        top: '56px',
        right: 0,
        width: `${sidebarWidth}px`,
        bottom: 0,
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        transition: 'width 200ms ease',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          style={{
            position: 'absolute',
            top: '50%',
            left: '-12px',
            transform: 'translateY(-50%)',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 41,
            padding: 0,
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {collapsed ? (
          <div style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            padding: '16px 0',
            color: 'var(--gold)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            cursor: 'pointer',
          }} onClick={toggleCollapse}>
            MARKET OVERVIEW
          </div>
        ) : sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        className="macro-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'var(--gold)',
          border: 'none',
          color: 'var(--bg-primary)',
          cursor: 'pointer',
          zIndex: 45,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 49,
          }}
        />
      )}

      <aside
        className="macro-sidebar-mobile"
        style={{
          position: 'fixed',
          top: '56px',
          right: mobileOpen ? 0 : '-260px',
          width: '260px',
          bottom: 0,
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          display: 'none',
          flexDirection: 'column',
          zIndex: 50,
          transition: 'right 250ms ease',
        }}
      >
        {sidebarContent}
      </aside>

      <style>{`
        @media (max-width: 1200px) {
          .macro-sidebar-desktop { display: none !important; }
          .macro-mobile-toggle { display: flex !important; }
          .macro-sidebar-mobile { display: flex !important; }
          .macro-mobile-close { display: block !important; }
        }
      `}</style>
    </>
  );
}
