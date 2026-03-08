import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TICKER_CHIPS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'BTC-USD'];

const NAV_TILES = [
  { label: 'Analysis', desc: 'Deep-dive research on any stock or ETF', path: '/analysis' },
  { label: 'Watchlist', desc: 'Track your favorite tickers', path: '/watchlist' },
  { label: 'Portfolio', desc: 'Track P&L, allocation and benchmark', path: '/portfolio' },
  { label: 'Earnings', desc: 'Upcoming earnings and EPS history', path: '/earnings' },
  { label: 'Options', desc: 'Black-Scholes calculator and analytics', path: '/options' },
  { label: 'Screener', desc: 'Filter stocks by any metric', path: '/screener' },
  { label: 'Global Markets', desc: 'World indices and macro data', path: '/dashboard' },
  { label: 'News', desc: 'Market news and top stories', path: '/news' },
];

const PRICE_TILES = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'NASDAQ' },
  { symbol: 'DIA', label: 'Dow Jones' },
  { symbol: 'GC=F', label: 'Gold' },
  { symbol: '^VIX', label: 'VIX' },
  { symbol: 'BTC-USD', label: 'Bitcoin' },
];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [prices, setPrices] = useState({});
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/macro');
        const data = await res.json();
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(item => { map[item.symbol] = item; });
          setPrices(map);
        }
      } catch {}
    })();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const ticker = search.trim().toUpperCase();
    if (ticker) {
      navigate(`/analysis?ticker=${encodeURIComponent(ticker)}`);
    }
  };

  const handleChipClick = (ticker) => {
    navigate(`/analysis?ticker=${encodeURIComponent(ticker)}`);
  };

  // Mini stat pills for Dashboard hero tile
  const miniStats = [
    { symbol: 'SPY', label: 'S&P' },
    { symbol: 'QQQ', label: 'NDX' },
    { symbol: 'BTC-USD', label: 'BTC' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '64px 24px 48px',
      }}>
        {/* Branding */}
        <h1 style={{
          color: 'var(--gold)',
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          margin: '0 0 6px',
        }}>
          M E R I D I A N
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '0 0 4px', letterSpacing: '0.05em' }}>
          by Reach Point Research
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 24px' }}>
          Institutional-grade market intelligence. No subscription required.
        </p>

        {/* Search Bar — bigger */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px', width: '100%', maxWidth: '640px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search any ticker, ETF, or company..."
            style={{
              flex: 1,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px 24px',
              color: 'var(--text-primary)',
              fontSize: '16px',
              fontFamily: 'monospace',
              outline: 'none',
              boxShadow: searchFocused ? '0 0 0 2px rgba(240,165,0,0.3)' : 'none',
              transition: 'box-shadow 150ms ease, border-color 150ms ease',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--gold)'; setSearchFocused(true); }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; setSearchFocused(false); }}
          />
          <button type="submit" style={{
            backgroundColor: 'var(--gold)',
            border: 'none',
            borderRadius: '8px',
            padding: '16px 32px',
            color: 'var(--bg-primary)',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Search
          </button>
        </form>

        {/* Ticker Chips */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '32px', marginTop: '4px' }}>
          {TICKER_CHIPS.map(ticker => (
            <button
              key={ticker}
              onClick={() => handleChipClick(ticker)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '5px 12px',
                color: 'var(--gold)',
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.backgroundColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--bg-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--gold)'; }}
            >
              {ticker}
            </button>
          ))}
        </div>

        {/* Live Price Tiles — 6 across */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', maxWidth: '860px', width: '100%', margin: '0 auto 24px auto' }}>
          {PRICE_TILES.map(tile => {
            const data = prices[tile.symbol];
            const price = data?.price;
            const changePct = data?.changePercent ?? data?.changesPercentage ?? 0;
            const isPos = changePct >= 0;
            return (
              <div key={tile.symbol} onClick={() => navigate('/dashboard')} style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'center',
                boxShadow: 'var(--card-shadow)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {tile.label}
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '2px' }}>
                  {price != null ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '\u2014'}
                </div>
                <div style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                  {price != null ? `${isPos ? '+' : ''}${Number(changePct).toFixed(2)}%` : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Grid — Dashboard hero + 7 tiles */}
        <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto' }}>
          {/* Dashboard Hero Tile — full width */}
          <div
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #1B3A6B 0%, #0D1117 100%)',
              borderLeft: '4px solid #F0A500',
              border: '1px solid var(--border-color)',
              borderLeftWidth: '4px',
              borderLeftColor: '#F0A500',
              borderRadius: '8px',
              height: '120px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 28px',
              cursor: 'pointer',
              transition: 'filter 150ms ease',
              marginBottom: '16px',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            <div>
              <div style={{ color: 'white', fontSize: '20px', fontWeight: 700, letterSpacing: '0.02em' }}>
                DASHBOARD
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px' }}>
                Real-time market intelligence — indices, sectors, heatmap, movers
              </div>
              <div style={{ color: '#F0A500', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                Open Terminal →
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
              {miniStats.map(s => {
                const d = prices[s.symbol];
                const pct = d?.changePercent ?? d?.changesPercentage ?? null;
                const isPos = (pct || 0) >= 0;
                return (
                  <div key={s.symbol} style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    textAlign: 'center',
                    minWidth: '72px',
                  }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em' }}>{s.label}</div>
                    <div style={{ color: '#F0A500', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {d?.price != null ? `$${Number(d.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '\u2014'}
                    </div>
                    {pct != null && (
                      <div style={{ color: isPos ? '#22C55E' : '#EF4444', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace' }}>
                        {isPos ? '+' : ''}{Number(pct).toFixed(2)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Models Hero Tile — full width */}
          <div
            onClick={() => navigate('/models')}
            style={{
              background: 'linear-gradient(135deg, #1a0d2e 0%, #0D1117 100%)',
              borderLeft: '4px solid #F0A500',
              border: '1px solid var(--border-color)',
              borderLeftWidth: '4px',
              borderLeftColor: '#F0A500',
              borderRadius: '8px',
              height: '120px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 28px',
              cursor: 'pointer',
              transition: 'filter 150ms ease',
              marginBottom: '16px',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            <div>
              <div style={{ color: 'white', fontSize: '20px', fontWeight: 700, letterSpacing: '0.02em' }}>
                MODELS
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px' }}>
                Integrated DCF, LBO, 3-Statement and scenario analysis for any stock
              </div>
              <div style={{ color: '#F0A500', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                Open Models →
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {['DCF', 'LBO', '3-Statement', 'Football Field'].map(pill => (
                <div key={pill} style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                }}>{pill}</div>
              ))}
            </div>
          </div>

          {/* Remaining nav tiles — 4 columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}>
            {NAV_TILES.map(tile => (
              <div
                key={tile.label}
                onClick={() => navigate(tile.path)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px 14px',
                  height: '90px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  {tile.label}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: 1.4 }}>
                  {tile.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>
          © 2026 Reach Point Research · A Reach Point Capital Company
        </span>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>
          meridian.reachpointcapital.com
        </span>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="repeat(6, 1fr)"] { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 700px) {
          div[style*="repeat(6, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
