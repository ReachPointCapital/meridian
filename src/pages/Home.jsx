import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TICKER_CHIPS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'BTC-USD'];

const NAV_TILES = [
  { label: 'Dashboard', desc: 'Market overview, movers and sectors', path: '/dashboard' },
  { label: 'Analysis', desc: 'Deep-dive research on any stock or ETF', path: '/analysis' },
  { label: 'Watchlist', desc: 'Track your favorite tickers', path: '/watchlist' },
  { label: 'Portfolio', desc: 'Track P&L, allocation and benchmark', path: '/portfolio' },
  { label: 'Earnings', desc: 'Upcoming earnings and EPS history', path: '/earnings' },
  { label: 'Options', desc: 'Black-Scholes calculator and analytics', path: '/options' },
  { label: 'Screener', desc: 'Filter stocks by any metric', path: '/screener' },
  { label: 'Global Markets', desc: 'World indices and macro data', path: '/dashboard' },
];

const PRICE_TILES = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'NASDAQ' },
  { symbol: 'GLD', label: 'Gold' },
  { symbol: 'BTC-USD', label: 'Bitcoin' },
];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [prices, setPrices] = useState({});

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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
    }}>
      {/* Logo + Branding */}
      <img
        src="/meridian-logo-dark.jpg"
        alt="Meridian"
        style={{ width: '80px', height: 'auto', marginBottom: '20px', borderRadius: '8px' }}
      />
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
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 32px' }}>
        Institutional-grade financial research. Free.
      </p>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '12px', width: '100%', maxWidth: '480px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search any ticker..."
          style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: 'monospace',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--gold)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
        />
        <button type="submit" style={{
          backgroundColor: 'var(--gold)',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          color: 'var(--bg-primary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Search
        </button>
      </form>

      {/* Ticker Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '40px' }}>
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

      {/* Live Price Tiles */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '48px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {PRICE_TILES.map(tile => {
          const data = prices[tile.symbol];
          const price = data?.price;
          const changePct = data?.changePercent ?? data?.changesPercentage ?? 0;
          const isPos = changePct >= 0;
          return (
            <div key={tile.symbol} style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px 24px',
              minWidth: '160px',
              textAlign: 'center',
              boxShadow: 'var(--card-shadow)',
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em', marginBottom: '6px' }}>
                {tile.label}
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '4px' }}>
                {price != null ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '\u2014'}
              </div>
              <div style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                {price != null ? `${isPos ? '+' : ''}${Number(changePct).toFixed(2)}%` : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        width: '100%',
        maxWidth: '800px',
      }}>
        {NAV_TILES.map(tile => (
          <div
            key={tile.label}
            onClick={() => navigate(tile.path)}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '20px 16px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
              {tile.label}
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: 1.4 }}>
              {tile.desc}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 700px) {
          div[style*="repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
