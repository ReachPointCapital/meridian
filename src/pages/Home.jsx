import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import TickerSearch from '../components/TickerSearch';
import { formatPct } from '../utils/format';
import { formatQuoteValue } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import PriceFlash from '../components/ui/PriceFlash';

const TICKER_CHIPS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'BTC-USD'];

const NAV_TILES = [
  { label: 'Analysis', desc: 'Deep-dive research on any stock or ETF', path: '/analysis' },
  { label: 'Watchlist', desc: 'Track your favorite tickers', path: '/watchlist' },
  { label: 'Portfolio', desc: 'Track P&L, allocation and benchmark', path: '/portfolio' },
  { label: 'Earnings', desc: 'Upcoming earnings and EPS history', path: '/earnings' },
  { label: 'Options', desc: 'Black-Scholes calculator and analytics', path: '/options' },
  { label: 'Screener', desc: 'Filter stocks by any metric', path: '/screener' },
  { label: 'Global Markets', desc: 'World indices and macro data', path: '/dashboard' },
  { label: 'News', desc: 'Market news and top stories', path: '/dashboard' },
];

// Real index levels, not the SPY/QQQ/DIA ETF prices (an ETF price is ~1/10 of the index and was labelled as the index)
const PRICE_TILES = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^NDX', label: 'NASDAQ 100' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: 'GC=F', label: 'Gold' },
  { symbol: '^VIX', label: 'VIX' },
  { symbol: 'BTC-USD', label: 'Bitcoin' },
];

export default function Home() {
  const navigate = useNavigate();
  const { setActiveSymbol } = useApp();
  const [prices, setPrices] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const symbols = PRICE_TILES.map(t => t.symbol).join(',');
        const res = await fetch(`/api/market?type=quote&symbol=${encodeURIComponent(symbols)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(item => { map[item.symbol] = item; });
          setPrices(map);
        }
      } catch {}
    })();
  }, []);

  // The Analysis page reads the active symbol from the app context (it ignores ?ticker=), so set it before navigating.
  const openAnalysis = (symbol) => {
    setActiveSymbol(symbol);
    navigate('/analysis');
  };
  const handleChipClick = openAnalysis;

  // Mini stat pills for Dashboard hero tile
  const miniStats = [
    { symbol: '^GSPC', label: 'S&P' },
    { symbol: '^NDX', label: 'NDX' },
    { symbol: 'BTC-USD', label: 'BTC' },
  ];

  return (
    <>
    <Helmet>
      <title>Meridian — Free Hedge Fund-Grade Financial Terminal | Reach Point Research</title>
      <meta name="description" content="Institutional-grade market intelligence. Real-time stock analysis, DCF & LBO models, S&P 500 heatmap, earnings calendar, screener, and more. No subscription required." />
    </Helmet>
    <div style={{
      minHeight: '100vh',
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
        position: 'relative',
      }}>
        <div className="hero-glow" aria-hidden="true" />
        {/* Branding */}
        <h1 className="gradient-text" style={{
          fontSize: 'clamp(30px, 7vw, 46px)',
          fontWeight: 800,
          letterSpacing: '0.28em',
          paddingLeft: '0.28em', /* balances the trailing letter-space so the word is truly centred */
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          margin: '0 0 8px',
        }}>
          Meridian
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '0 0 4px', letterSpacing: '0.05em' }}>
          by Reach Point Research
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 24px' }}>
          Institutional-grade market intelligence. No subscription required.
        </p>

        {/* Search Bar */}
        <div style={{ width: '100%', maxWidth: '640px', marginBottom: '16px' }}>
          <TickerSearch
            size="lg"
            placeholder="Search any ticker, ETF, or company..."
            onSelect={openAnalysis}
          />
        </div>

        {/* Ticker Chips */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '32px', marginTop: '4px' }}>
          {TICKER_CHIPS.map(ticker => (
            <button
              key={ticker}
              onClick={() => handleChipClick(ticker)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
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
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', maxWidth: '860px', width: '100%', margin: '0 auto 24px auto' }}>
          {PRICE_TILES.map(tile => {
            const data = prices[tile.symbol];
            const price = data?.price;
            const changePct = data?.changePercent ?? data?.changesPercentage ?? 0;
            const isPos = changePct >= 0;
            return (
              <div key={tile.symbol} className="lift" onClick={() => navigate('/dashboard')} style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
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
                  <PriceFlash value={price}>{formatQuoteValue(tile.symbol, price)}</PriceFlash>
                </div>
                <div style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                  {price != null ? `${isPos ? '+' : ''}${formatPct(changePct, 2)}` : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Grid — Dashboard hero + 7 tiles */}
        <div style={{ maxWidth: '860px', width: '100%', margin: '0 auto' }}>
          {/* Dashboard Hero Tile — full width */}
          <div
            className="hero-tile"
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #1F4396 0%, #12306B 38%, #0F1A33 100%)',
              borderLeft: '4px solid var(--gold)',
              border: '1px solid var(--border-color)',
              borderLeftWidth: '4px',
              borderLeftColor: 'var(--gold)',
              borderRadius: 'var(--radius-md)',
              minHeight: '120px',
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
              <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '13px', marginTop: '4px' }}>
                Real-time market intelligence — indices, sectors, heatmap, movers
              </div>
              <div style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                Open Terminal →
              </div>
            </div>
            <div className="home-hero-extras" style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
              {miniStats.map(s => {
                const d = prices[s.symbol];
                const pct = d?.changePercent ?? d?.changesPercentage ?? null;
                const isPos = (pct || 0) >= 0;
                return (
                  <div key={s.symbol} style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    textAlign: 'center',
                    minWidth: '72px',
                  }}>
                    <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em' }}>{s.label}</div>
                    <div style={{ color: 'var(--gold)', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      {formatQuoteValue(s.symbol, d?.price)}
                    </div>
                    {pct != null && (
                      <div style={{ color: isPos ? '#2EE6A6' : '#FF6B87', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace' }}>
                        {isPos ? '+' : ''}{formatPct(pct, 2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Models Hero Tile — full width */}
          <div
            className="hero-tile"
            onClick={() => navigate('/models')}
            style={{
              background: 'linear-gradient(135deg, #3B2A7A 0%, #241A52 38%, #0F1A33 100%)',
              borderLeft: '4px solid var(--gold)',
              border: '1px solid var(--border-color)',
              borderLeftWidth: '4px',
              borderLeftColor: 'var(--gold)',
              borderRadius: 'var(--radius-md)',
              minHeight: '120px',
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
              <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '13px', marginTop: '4px' }}>
                Integrated DCF, LBO, 3-Statement and scenario analysis for any stock
              </div>
              <div style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                Open Models →
              </div>
            </div>
            <div className="home-hero-extras" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {['DCF', 'LBO', '3-Statement', 'Football Field'].map(pill => (
                <div key={pill} style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.74)',
                }}>{pill}</div>
              ))}
            </div>
          </div>

          {/* Remaining nav tiles — 4 columns */}
          <div className="stagger" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}>
            {NAV_TILES.map(tile => (
              <div
                key={tile.label}
                className="lift"
                onClick={() => navigate(tile.path)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
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
        borderTop: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
          © 2026 Reach Point Research · A Reach Point Capital Company
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
          meridian.reachpointcapital.com
        </span>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="repeat(6, 1fr)"] { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 700px) {
          .home-hero-extras { display: none !important; }
          div[style*="repeat(6, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
    </>
  );
}
