import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';
import { formatPrice, formatPercent } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

const INSTRUMENTS = [
  // US Indices
  { symbol: 'SPY', label: 'S&P 500', group: 'US INDICES' },
  { symbol: 'QQQ', label: 'NASDAQ', group: null },
  { symbol: 'DIA', label: 'Dow Jones', group: null },
  { symbol: 'IWM', label: 'Russell 2000', group: null },
  // Futures
  { symbol: 'ES=F', label: 'S&P Futures', group: 'FUTURES' },
  { symbol: 'NQ=F', label: 'Nasdaq Futures', group: null },
  { symbol: 'YM=F', label: 'Dow Futures', group: null },
  // Global
  { symbol: '^FTSE', label: 'FTSE 100', group: 'GLOBAL' },
  { symbol: '^N225', label: 'Nikkei 225', group: null },
  { symbol: '^GDAXI', label: 'DAX', group: null },
  { symbol: '^HSI', label: 'Hang Seng', group: null },
  // Commodities
  { symbol: 'GC=F', label: 'Gold', group: 'COMMODITIES' },
  { symbol: 'SI=F', label: 'Silver', group: null },
  { symbol: 'CL=F', label: 'WTI Oil', group: null },
  { symbol: 'BZ=F', label: 'Brent', group: null },
  { symbol: 'NG=F', label: 'Nat Gas', group: null },
  { symbol: 'HG=F', label: 'Copper', group: null },
  // Crypto
  { symbol: 'BTC-USD', label: 'Bitcoin', group: 'CRYPTO' },
  { symbol: 'ETH-USD', label: 'Ethereum', group: null },
  { symbol: 'SOL-USD', label: 'Solana', group: null },
  // Volatility
  { symbol: '^VIX', label: 'VIX', group: 'VOLATILITY' },
  { symbol: '^VIX9D', label: 'VIX 9D', group: null },
  { symbol: '^VVIX', label: 'VVIX', group: null },
  // FX
  { symbol: 'EURUSD=X', label: 'EUR/USD', group: 'FX' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', group: null },
  { symbol: 'USDJPY=X', label: 'USD/JPY', group: null },
  { symbol: 'USDCNY=X', label: 'USD/CNY', group: null },
  // Bonds
  { symbol: '^IRX', label: '2Y Yield', group: 'BONDS' },
  { symbol: '^FVX', label: '5Y Yield', group: null },
  { symbol: '^TNX', label: '10Y Yield', group: null },
  { symbol: '^TYX', label: '30Y Yield', group: null },
];

function MacroItem({ item, onSelect }) {
  const positive = (item.changePercent || 0) >= 0;
  const changeColor = positive ? 'var(--green)' : 'var(--red)';

  return (
    <div
      onClick={() => onSelect && onSelect(item.symbol)}
      style={{
        padding: '4px 12px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        transition: 'background 150ms ease',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.03em' }}>
        {item.label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          color: 'var(--text-primary)',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {item.price != null ? formatPrice(item.price) : '\u2014'}
        </span>
        <span style={{
          color: changeColor,
          fontSize: '9px',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '42px',
          textAlign: 'right',
        }}>
          {item.changePercent != null ? formatPercent(item.changePercent) : '\u2014'}
        </span>
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
      const symbols = INSTRUMENTS.map(i => i.symbol);
      const res = await fetch(`/api/market?type=quote&symbol=${encodeURIComponent(symbols.join(','))}`);
      const result = await res.json();
      const quoteList = Array.isArray(result) ? result : [result];
      const priceMap = {};
      quoteList.forEach(q => {
        if (q?.symbol) priceMap[q.symbol] = q;
      });

      const mapped = INSTRUMENTS.map(inst => ({
        symbol: inst.symbol,
        label: inst.label,
        group: inst.group,
        price: priceMap[inst.symbol]?.price ?? null,
        changePercent: priceMap[inst.symbol]?.changesPercentage ?? priceMap[inst.symbol]?.changePercent ?? null,
      }));
      prevDataRef.current = mapped;
      setData(mapped);
    } catch (e) {
      console.error('MacroSidebar fetch error:', e);
      // Fallback: use instrument list with null prices
      if (prevDataRef.current.length === 0) {
        setData(INSTRUMENTS.map(inst => ({ ...inst, price: null, changePercent: null })));
      }
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
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', height: '32px' }}>
              <div className="skeleton" style={{ height: '10px', width: '60%', marginBottom: '4px' }} />
              <div className="skeleton" style={{ height: '10px', width: '40%' }} />
            </div>
          ))
        ) : (
          data.map(item => (
            <React.Fragment key={item.symbol}>
              {item.group && (
                <div style={{
                  padding: '8px 12px 2px',
                  color: 'var(--gold)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  {item.group}
                </div>
              )}
              <MacroItem item={item} onSelect={setActiveSymbol} />
            </React.Fragment>
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
