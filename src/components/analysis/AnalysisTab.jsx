import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../../services/api';
import { getPriceHistory } from '../../services/polygon';
import { useApp } from '../../context/AppContext';
import { formatPrice, formatMarketCap, formatPercent, formatDividendYield } from '../../utils/formatters';
import { calculateRSI, checkCrossSignal, calculateMACD, volumeTrend, pricePosition } from '../../utils/technicals';
import { Search, TrendingUp, TrendingDown, Minus, AlertTriangle, Copy, Check, Save, ExternalLink } from 'lucide-react';
import ProGate from '../common/ProGate';
import InfoTooltip from '../ui/InfoTooltip';
import PriceChart from '../terminal/PriceChart';
import NewsFeed from '../terminal/NewsFeed';

const CARD_STYLE = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: 'var(--card-shadow)',
  marginBottom: '16px',
};

const SECTION_HEADER = {
  color: 'var(--gold)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  margin: 0,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-color)',
};

function SkeletonBlock({ width = '100%', height = '16px', style = {} }) {
  return <div className="skeleton" style={{ width, height, borderRadius: '4px', ...style }} />;
}

// ── Valuation scoring ──
function scorePE(pe) { if (pe == null) return 3; if (pe < 10) return 5; if (pe < 15) return 4; if (pe < 20) return 3; if (pe < 30) return 2; return 1; }
function scorePB(pb) { if (pb == null) return 3; if (pb < 1) return 5; if (pb < 2) return 4; if (pb < 3) return 3; if (pb < 5) return 2; return 1; }
function scorePEG(peg) { if (peg == null) return 3; if (peg < 0.5) return 5; if (peg < 1) return 4; if (peg < 1.5) return 3; if (peg < 2) return 2; return 1; }
function scoreDY(dy) { if (dy == null) return 3; if (dy > 4) return 5; if (dy > 2.5) return 4; if (dy > 1) return 3; if (dy > 0) return 2; return 1; }
function scoreColor(s) { if (s >= 4) return '#22c55e'; if (s >= 3) return '#4ade80'; if (s >= 2) return '#eab308'; return '#ef4444'; }
function scoreLabel(a) { if (a >= 4) return 'Deep Value'; if (a >= 3) return 'Undervalued'; if (a >= 2) return 'Fair Value'; return 'Overvalued'; }
function fmt(v) { return v == null || isNaN(v) ? '\u2014' : Number(v).toFixed(2); }

// ── Recent searches helpers ──
const RECENT_KEY = 'meridian_recent_analysis';
function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentSearch(symbol, name, price, changePct) {
  const recent = getRecentSearches().filter(r => r.symbol !== symbol);
  recent.unshift({ symbol, name, price, changePct });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

// ── Search Bar ──
function AnalysisSearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await api.search(query);
        const list = Array.isArray(data) ? data.slice(0, 8) : [];
        setResults(list);
        setOpen(list.length > 0);
        setHighlighted(0);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (sym) => { onSearch(sym); setOpen(false); setQuery(''); };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && query) { onSearch(query.toUpperCase()); setOpen(false); setQuery(''); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[highlighted]) select(results[highlighted].symbol); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
        <Search size={16} color="var(--text-tertiary)" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search any ticker..."
          style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0 0 8px 8px', zIndex: 50, maxHeight: '280px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => select(r.symbol)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', transition: 'background 100ms', backgroundColor: i === highlighted ? 'var(--bg-tertiary)' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={() => setHighlighted(i)}>
              <span style={{ backgroundColor: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace' }}>{r.symbol}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '11px' }}>{r.name || ''}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: 'auto' }}>{r.exchange || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty State with Trending, Sectors, Recent Searches ──
const POPULAR_TICKERS = ['AAPL','MSFT','GOOGL','META','AMZN','NVDA','TSLA','BRK-B','JPM','V','SPY','QQQ','GLD','BTC-USD','ETH-USD','^VIX'];

const SECTOR_ETFS = [
  { label: 'Technology', ticker: 'XLK' },
  { label: 'Healthcare', ticker: 'XLV' },
  { label: 'Financials', ticker: 'XLF' },
  { label: 'Energy', ticker: 'XLE' },
  { label: 'Consumer Disc.', ticker: 'XLY' },
  { label: 'Consumer Staples', ticker: 'XLP' },
  { label: 'Industrials', ticker: 'XLI' },
  { label: 'Materials', ticker: 'XLB' },
  { label: 'Real Estate', ticker: 'XLRE' },
  { label: 'Utilities', ticker: 'XLU' },
  { label: 'Comm. Services', ticker: 'XLC' },
];

function EmptyState({ onSearch }) {
  const [recent, setRecent] = useState(getRecentSearches());
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [heroQuery, setHeroQuery] = useState('');
  const [heroFocused, setHeroFocused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [gainers, losers, actives] = await Promise.allSettled([
          api.gainers(), api.losers(), api.actives(),
        ]);
        const g = (gainers.status === 'fulfilled' && Array.isArray(gainers.value) ? gainers.value : []).slice(0, 2);
        const l = (losers.status === 'fulfilled' && Array.isArray(losers.value) ? losers.value : []).slice(0, 2);
        const a = (actives.status === 'fulfilled' && Array.isArray(actives.value) ? actives.value : []).slice(0, 2);
        setTrending([
          ...g.map(t => ({ ...t, badge: 'TOP GAINER' })),
          ...l.map(t => ({ ...t, badge: 'TOP LOSER' })),
          ...a.map(t => ({ ...t, badge: 'MOST ACTIVE' })),
        ]);
      } catch {}
      setTrendingLoading(false);
    })();
  }, []);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    const ticker = heroQuery.trim().toUpperCase();
    if (ticker) onSearch(ticker);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '32px', maxWidth: '860px', margin: '0 auto' }}>
      {/* 1. Header */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>Analysis</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Deep-dive any stock, ETF, commodity, or index</p>
      </div>

      {/* 2. Hero Search */}
      <form onSubmit={handleHeroSearch} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '580px' }}>
        <input
          value={heroQuery}
          onChange={e => setHeroQuery(e.target.value)}
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
            boxShadow: heroFocused ? '0 0 0 2px rgba(240,165,0,0.3)' : 'none',
            transition: 'box-shadow 150ms ease, border-color 150ms ease',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--gold)'; setHeroFocused(true); }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; setHeroFocused(false); }}
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

      {/* 3. Popular to Analyze chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '680px' }}>
        {POPULAR_TICKERS.map(sym => (
          <button key={sym} onClick={() => onSearch(sym)} style={{
            backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px',
            color: 'var(--gold)', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
            padding: '6px 14px', cursor: 'pointer', transition: 'all 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.backgroundColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--bg-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--gold)'; }}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* 4. Trending Today */}
      <div style={{ width: '100%' }}>
        <div style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>Trending Today</div>
        {trendingLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '8px' }} />)}
          </div>
        ) : trending.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {trending.map((t, i) => {
              const chg = t.changesPercentage ?? t.change_percentage ?? 0;
              const pctNum = typeof chg === 'string' ? parseFloat(chg) : chg;
              const isPos = pctNum >= 0;
              return (
                <div key={`${t.symbol}-${i}`} onClick={() => onSearch(t.symbol)} style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                >
                  <div style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{t.symbol}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>{t.name || t.companyName || ''}</div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{formatPrice(t.price)}</div>
                  <div style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {isPos ? '+' : ''}{typeof pctNum === 'number' ? pctNum.toFixed(2) : pctNum}%
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', marginTop: '6px', textTransform: 'uppercase' }}>{t.badge}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>No trending data available</div>
        )}
      </div>

      {/* 5. Sectors */}
      <div style={{ width: '100%' }}>
        <div style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>Sectors</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {SECTOR_ETFS.map(s => (
            <button key={s.ticker} onClick={() => onSearch(s.ticker)} style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              cursor: 'pointer',
              transition: 'background 150ms ease',
              textAlign: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
            >
              <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500 }}>{s.label}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>{s.ticker}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Recently Analyzed */}
      {recent.length > 0 && (
        <div style={{ ...CARD_STYLE, width: '100%', textAlign: 'left' }}>
          <div style={{ ...SECTION_HEADER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Recently Analyzed</span>
            <button onClick={clearRecent} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              fontSize: '10px', cursor: 'pointer', padding: '0', transition: 'color 150ms',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >
              Clear
            </button>
          </div>
          <div>
            {recent.map((r) => (
              <div key={r.symbol} onClick={() => onSearch(r.symbol)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', marginRight: '10px' }}>{r.symbol}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{r.name || ''}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {r.price && <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', marginRight: '8px' }}>{formatPrice(r.price)}</span>}
                  {r.changePct != null && (
                    <span style={{ color: r.changePct >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {formatPercent(r.changePct)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Company Profile ──
function CompanySnapshot({ quote, profile }) {
  const [descExpanded, setDescExpanded] = useState(false);
  if (!quote) return null;

  const logoUrl = profile?.image || null;
  const description = profile?.description || '';
  const shortDesc = description.length > 300 ? description.slice(0, 300) + '...' : description;

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Company Profile</h3>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          {logoUrl && (
            <div style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
              <img src={logoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>
                {profile?.companyName || quote.name || quote.symbol}
              </h2>
              <span style={{ backgroundColor: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace' }}>
                {quote.symbol}
              </span>
              {quote.exchange && <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{quote.exchange}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {profile?.sector && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(234,179,8,0.1)', color: 'var(--gold)', border: '1px solid rgba(234,179,8,0.2)' }}>{profile.sector}</span>}
              {profile?.industry && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>{profile.industry}</span>}
            </div>
          </div>
        </div>

        {description && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
              {descExpanded ? description : shortDesc}
            </p>
            {description.length > 300 && (
              <button onClick={() => setDescExpanded(!descExpanded)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '11px', padding: '4px 0', cursor: 'pointer' }}>
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
          {profile?.ceo && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>CEO</span>
              <span style={{ color: 'var(--text-primary)' }}>{profile.ceo}</span>
            </div>
          )}
          {profile?.fullTimeEmployees && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Employees</span>
              <span style={{ color: 'var(--text-primary)' }}>{Number(profile.fullTimeEmployees).toLocaleString()}</span>
            </div>
          )}
          {(profile?.city || profile?.state || profile?.country) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Headquarters</span>
              <span style={{ color: 'var(--text-primary)' }}>{[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {profile?.ipoDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>IPO Date</span>
              <span style={{ color: 'var(--text-primary)' }}>{profile.ipoDate}</span>
            </div>
          )}
          {profile?.website && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Website</span>
              <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {profile.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Analysis Price Chart (uses full PriceChart from terminal) ──
function AnalysisPriceChart({ symbol }) {
  return <PriceChart symbol={symbol} />;
}

// ── Valuation Scorecard ──
function ValuationScorecard({ quote, analyst }) {
  const pe = quote?.pe;
  const pb = quote?.priceToBook;
  const peg = analyst?.pegRatio;
  const dy = quote?.dividendYield;

  const metrics = [
    { name: 'P/E Ratio', value: pe, score: scorePE(pe) },
    { name: 'Price/Book', value: pb, score: scorePB(pb) },
    { name: 'PEG Ratio', value: peg, score: scorePEG(peg) },
    { name: 'Div Yield %', value: dy, score: scoreDY(dy) },
  ];
  const avgScore = metrics.reduce((s, m) => s + m.score, 0) / metrics.length;

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Valuation Scorecard <InfoTooltip text="Composite score based on P/E, P/B, PEG ratio, and dividend yield" /></h3>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '12px 16px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, fontFamily: 'monospace', color: scoreColor(avgScore), lineHeight: 1 }}>{avgScore.toFixed(1)}</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: scoreColor(avgScore) }}>{scoreLabel(avgScore)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Composite score (1-5)</div>
          </div>
        </div>
        {metrics.map(m => (
          <div key={m.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', flex: 1 }}>{m.name}</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', width: '80px', textAlign: 'right' }}>{fmt(m.value)}</span>
            <div style={{ width: '32px', height: '20px', borderRadius: '4px', marginLeft: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: scoreColor(m.score) + '22', color: scoreColor(m.score), fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>{m.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analyst Consensus ──
function AnalystConsensus({ analyst }) {
  if (!analyst) return null;
  const { strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0 } = analyst;
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return null;

  const consensus = analyst.recommendation || 'hold';
  const consensusLabel = consensus.charAt(0).toUpperCase() + consensus.slice(1).replace('_', ' ');
  const consensusColor = consensus.includes('buy') ? 'var(--green)' : consensus.includes('sell') ? 'var(--red)' : 'var(--gold)';

  const segments = [
    { label: 'Strong Buy', count: strongBuy, color: '#22c55e' },
    { label: 'Buy', count: buy, color: '#4ade80' },
    { label: 'Hold', count: hold, color: '#eab308' },
    { label: 'Sell', count: sell, color: '#f97316' },
    { label: 'Strong Sell', count: strongSell, color: '#ef4444' },
  ];

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Analyst Consensus</h3>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ backgroundColor: consensusColor + '22', color: consensusColor, fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '4px', border: `1px solid ${consensusColor}44` }}>{consensusLabel}</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{analyst.numberOfAnalysts || total} analysts</span>
        </div>
        <div style={{ display: 'flex', height: '20px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
          {segments.map(s => s.count > 0 ? (
            <div key={s.label} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#000', minWidth: '16px' }}>{s.count}</div>
          ) : null)}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {segments.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: s.color }} />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{s.label} ({s.count})</span>
            </div>
          ))}
        </div>
        {analyst.targetMeanPrice != null && (() => {
          const low = analyst.targetLowPrice || analyst.targetMeanPrice * 0.7;
          const high = analyst.targetHighPrice || analyst.targetMeanPrice * 1.3;
          const range = high - low;
          const meanPos = range > 0 ? ((analyst.targetMeanPrice - low) / range) * 100 : 50;
          return (
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Bear</div>
                  <div style={{ color: 'var(--red)', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{formatPrice(low)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Mean Target</div>
                  <div style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{formatPrice(analyst.targetMeanPrice)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Bull</div>
                  <div style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{formatPrice(high)}</div>
                </div>
              </div>
              {/* Horizontal bar */}
              <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', position: 'relative', background: 'linear-gradient(90deg, var(--red) 0%, var(--gold) 50%, var(--green) 100%)' }}>
                <div style={{ position: 'absolute', top: '50%', left: `${Math.max(2, Math.min(98, meanPos))}%`, transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--gold)', border: '2px solid var(--bg-primary)', boxShadow: '0 0 6px var(--gold)' }} />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Earnings History Chart ──
function EarningsHistoryChart({ earnings }) {
  if (!earnings || earnings.length === 0) return null;
  const data = [...earnings].reverse().map(e => ({
    quarter: e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '',
    actual: e.epsActual,
    estimate: e.epsEstimate,
    surprise: e.surprisePercent,
  }));

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Earnings History</h3>
      <div style={{ padding: '16px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="quarter" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px' }}>
                  <div style={{ color: 'var(--text-primary)' }}>Actual: ${d.actual?.toFixed(2)}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Est: ${d.estimate?.toFixed(2)}</div>
                  {d.surprise != null && <div style={{ color: d.surprise >= 0 ? 'var(--green)' : 'var(--red)' }}>Surprise: {d.surprise >= 0 ? '+' : ''}{d.surprise.toFixed(1)}%</div>}
                </div>
              );
            }} />
            <Bar dataKey="estimate" fill="var(--border-color)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="actual" fill="var(--gold)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px', fontSize: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--gold)', display: 'inline-block' }} /> Actual</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--border-color)', display: 'inline-block' }} /> Estimate</span>
        </div>
      </div>
    </div>
  );
}

// ── Revenue & Income Trend ──
function RevenueTrend({ financials }) {
  if (!financials?.income || financials.income.length === 0) return null;
  const data = [...financials.income].reverse().map(f => ({
    period: f.date ? new Date(f.date).getFullYear() : '',
    revenue: f.revenue,
    netIncome: f.netIncome,
  }));

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Revenue & Net Income Trend</h3>
      <div style={{ padding: '16px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => v >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px' }}>
                  <div style={{ color: 'var(--text-primary)' }}>Revenue: {formatMarketCap(d.revenue)}</div>
                  <div style={{ color: d.netIncome >= 0 ? 'var(--green)' : 'var(--red)' }}>Net Income: {formatMarketCap(d.netIncome)}</div>
                </div>
              );
            }} />
            <Line type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: 'var(--gold)' }} />
            <Line type="monotone" dataKey="netIncome" stroke="var(--green)" strokeWidth={2} dot={{ r: 3, fill: 'var(--green)' }} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px', fontSize: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--gold)', display: 'inline-block' }} /> Revenue</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--green)', display: 'inline-block' }} /> Net Income</span>
        </div>
      </div>
    </div>
  );
}

// ── Technical Indicators ──
function TechnicalIndicators({ technicals, quote }) {
  const { rsi, cross, macd, volume, position } = technicals;
  const rsiColor = rsi.value == null ? 'var(--text-tertiary)' : rsi.value > 70 ? 'var(--red)' : rsi.value < 30 ? 'var(--green)' : 'var(--gold)';
  const crossColor = cross.signal === 'Golden Cross' ? 'var(--green)' : cross.signal === 'Death Cross' ? 'var(--red)' : 'var(--text-secondary)';
  const macdColor = macd.label === 'Bullish' ? 'var(--green)' : 'var(--red)';
  const volColor = volume.label === 'Above Average' ? 'var(--green)' : volume.label === 'Below Average' ? 'var(--red)' : 'var(--text-secondary)';

  // RSI semicircle gauge parameters
  const rsiVal = rsi.value ?? 50;
  const rsiAngle = (rsiVal / 100) * 180; // 0-180 degrees
  const rsiR = 50;
  const rsiCx = 60;
  const rsiCy = 55;
  const needleX = rsiCx + (rsiR - 8) * Math.cos(Math.PI - (rsiAngle * Math.PI / 180));
  const needleY = rsiCy - (rsiR - 8) * Math.sin(rsiAngle * Math.PI / 180);

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Technical Indicators <InfoTooltip text="RSI, MACD, and SMA signals computed from 1-year price history" /></h3>
      <div style={{ padding: '16px' }}>
        {/* RSI Semicircle Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
          <svg width="120" height="65" viewBox="0 0 120 65">
            {/* Background arc */}
            <path d={`M ${rsiCx - rsiR} ${rsiCy} A ${rsiR} ${rsiR} 0 0 1 ${rsiCx + rsiR} ${rsiCy}`} fill="none" stroke="var(--border-color)" strokeWidth="8" />
            {/* Colored segments: green (0-30), gold (30-70), red (70-100) */}
            <path d={`M ${rsiCx - rsiR} ${rsiCy} A ${rsiR} ${rsiR} 0 0 1 ${rsiCx + rsiR * Math.cos(Math.PI - (54 * Math.PI / 180))} ${rsiCy - rsiR * Math.sin(54 * Math.PI / 180)}`} fill="none" stroke="var(--green)" strokeWidth="8" opacity="0.4" />
            <path d={`M ${rsiCx + rsiR * Math.cos(Math.PI - (54 * Math.PI / 180))} ${rsiCy - rsiR * Math.sin(54 * Math.PI / 180)} A ${rsiR} ${rsiR} 0 0 1 ${rsiCx + rsiR * Math.cos(Math.PI - (126 * Math.PI / 180))} ${rsiCy - rsiR * Math.sin(126 * Math.PI / 180)}`} fill="none" stroke="var(--gold)" strokeWidth="8" opacity="0.4" />
            <path d={`M ${rsiCx + rsiR * Math.cos(Math.PI - (126 * Math.PI / 180))} ${rsiCy - rsiR * Math.sin(126 * Math.PI / 180)} A ${rsiR} ${rsiR} 0 0 1 ${rsiCx + rsiR} ${rsiCy}`} fill="none" stroke="var(--red)" strokeWidth="8" opacity="0.4" />
            {/* Needle */}
            <line x1={rsiCx} y1={rsiCy} x2={needleX} y2={needleY} stroke={rsiColor} strokeWidth="2" strokeLinecap="round" />
            <circle cx={rsiCx} cy={rsiCy} r="3" fill={rsiColor} />
            {/* Labels */}
            <text x={rsiCx - rsiR - 2} y={rsiCy + 10} fill="var(--text-tertiary)" fontSize="8" textAnchor="middle">0</text>
            <text x={rsiCx} y={rsiCy - rsiR - 2} fill="var(--text-tertiary)" fontSize="8" textAnchor="middle">50</text>
            <text x={rsiCx + rsiR + 2} y={rsiCy + 10} fill="var(--text-tertiary)" fontSize="8" textAnchor="middle">100</text>
          </svg>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>RSI (14)</div>
            <div style={{ color: rsiColor, fontSize: '20px', fontWeight: 700, fontFamily: 'monospace' }}>{rsi.value != null ? rsi.value.toFixed(1) : '\u2014'}</div>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: rsiColor + '22', color: rsiColor }}>{rsi.label}</span>
          </div>
        </div>

        {[
          { label: '50/200 SMA', value: null, badge: cross.signal, color: crossColor, sub: `50: ${cross.sma50 != null ? formatPrice(cross.sma50) : '\u2014'} | 200: ${cross.sma200 != null ? formatPrice(cross.sma200) : '\u2014'}` },
          { label: 'MACD (12, 26, 9)', value: null, badge: macd.label, color: macdColor, sub: `MACD: ${macd.macd ?? '\u2014'} | Signal: ${macd.signal ?? '\u2014'}` },
          { label: 'Volume Trend', value: volume.ratio != null ? `${volume.ratio.toFixed(2)}x` : null, badge: volume.label, color: volColor, sub: null },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{row.label}</div>
              {row.sub && <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginTop: '2px' }}>{row.sub}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {row.value && <span style={{ color: row.color, fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{row.value}</span>}
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: row.color + '22', color: row.color }}>{row.badge}</span>
            </div>
          </div>
        ))}
        {/* 52-week range */}
        <div style={{ padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>52-Week Range</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{position.toFixed(1)}%</span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px', width: `${position}%`, background: 'linear-gradient(90deg, var(--gold-muted), var(--gold))' }} />
            <div style={{ position: 'absolute', top: '50%', left: `${position}%`, transform: 'translate(-50%, -50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--gold)', border: '2px solid var(--bg-primary)', boxShadow: '0 0 4px var(--gold)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{formatPrice(quote?.yearLow)}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{formatPrice(quote?.yearHigh)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overall Signal ──
function OverallSignal({ technicals, valuation }) {
  const signals = [];
  if (technicals.rsi.label === 'Oversold') signals.push({ type: 'bullish', label: 'RSI Oversold' });
  if (technicals.rsi.label === 'Overbought') signals.push({ type: 'bearish', label: 'RSI Overbought' });
  if (technicals.cross.signal === 'Golden Cross') signals.push({ type: 'bullish', label: 'Golden Cross' });
  if (technicals.cross.signal === 'Death Cross') signals.push({ type: 'bearish', label: 'Death Cross' });
  if (technicals.macd.label === 'Bullish') signals.push({ type: 'bullish', label: 'MACD Bullish' });
  if (technicals.macd.label === 'Bearish') signals.push({ type: 'bearish', label: 'MACD Bearish' });
  if (technicals.volume.label === 'Above Average') signals.push({ type: 'bullish', label: 'Volume Above Avg' });
  if (technicals.volume.label === 'Below Average') signals.push({ type: 'bearish', label: 'Volume Below Avg' });
  if (valuation >= 3.5) signals.push({ type: 'bullish', label: 'Undervalued' });
  else if (valuation <= 2) signals.push({ type: 'bearish', label: 'Overvalued' });

  const bullish = signals.filter(s => s.type === 'bullish').length;
  const bearish = signals.filter(s => s.type === 'bearish').length;
  const total = signals.length;

  let overall = 'NEUTRAL', overallColor = 'var(--gold)', OverallIcon = Minus;
  if (bullish > bearish && bullish >= 3) { overall = 'BULLISH'; overallColor = 'var(--green)'; OverallIcon = TrendingUp; }
  else if (bearish > bullish && bearish >= 3) { overall = 'BEARISH'; overallColor = 'var(--red)'; OverallIcon = TrendingDown; }

  const bgGradient = overall === 'BULLISH'
    ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(10,14,26,0) 100%)'
    : overall === 'BEARISH'
    ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(10,14,26,0) 100%)'
    : 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(10,14,26,0) 100%)';

  return (
    <div style={{ ...CARD_STYLE, background: bgGradient, borderLeft: `3px solid ${overallColor}` }}>
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <OverallIcon size={36} color={overallColor} />
          <div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: overallColor, letterSpacing: '0.08em', lineHeight: 1 }}>{overall}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '4px' }}>
              {bullish}/{total} bullish · {bearish}/{total} bearish
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end', maxWidth: '400px' }}>
          {signals.map((s, i) => (
            <span key={i} style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', backgroundColor: s.type === 'bullish' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: s.type === 'bullish' ? 'var(--green)' : 'var(--red)', border: `1px solid ${s.type === 'bullish' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Expanded Auto-Generated Thesis ──
function AutoThesis({ quote, analyst, technicals, valuation, profile, financials }) {
  if (!quote) return null;
  const name = profile?.companyName || quote.name || quote.symbol;
  const price = formatPrice(quote.price);

  // Summary paragraph
  const summaryParts = [`${name} (${quote.symbol}) is currently trading at ${price}`];
  if (profile?.sector) summaryParts.push(`in the ${profile.sector} sector`);
  if (quote.marketCap) summaryParts.push(`with a market cap of ${formatMarketCap(quote.marketCap)}`);
  if (quote.pe) summaryParts.push(`at a P/E ratio of ${Number(quote.pe).toFixed(1)}x`);
  if (quote.beta) summaryParts.push(`and a beta of ${Number(quote.beta).toFixed(2)}`);
  const summary = summaryParts.join(', ') + '.';

  // Additional summary info
  let analystSummary = '';
  if (analyst?.recommendation) {
    analystSummary += ` Analyst consensus is "${analyst.recommendation}"`;
    if (analyst.targetMeanPrice) analystSummary += ` with a mean price target of ${formatPrice(analyst.targetMeanPrice)}`;
    analystSummary += '.';
  }
  if (analyst?.revenueGrowth != null) {
    analystSummary += ` Revenue growth: ${(analyst.revenueGrowth * 100).toFixed(1)}%.`;
  }
  if (analyst?.earningsGrowth != null) {
    analystSummary += ` Earnings growth: ${(analyst.earningsGrowth * 100).toFixed(1)}%.`;
  }

  // Bull points
  const bullPoints = [];
  if (analyst?.targetMeanPrice && quote.price && analyst.targetMeanPrice > quote.price) {
    const upside = ((analyst.targetMeanPrice - quote.price) / quote.price * 100);
    bullPoints.push(`${upside.toFixed(0)}% upside to mean analyst target of ${formatPrice(analyst.targetMeanPrice)}`);
  }
  if (analyst?.revenueGrowth != null && analyst.revenueGrowth > 0.05) {
    bullPoints.push(`Strong revenue growth of ${(analyst.revenueGrowth * 100).toFixed(1)}%`);
  }
  if (analyst?.earningsGrowth != null && analyst.earningsGrowth > 0.05) {
    bullPoints.push(`Earnings growth of ${(analyst.earningsGrowth * 100).toFixed(1)}%`);
  }
  if (technicals?.rsi?.label === 'Oversold') bullPoints.push('RSI indicates oversold conditions — potential reversal signal');
  if (analyst?.recommendation?.includes('buy')) {
    const total = (analyst.strongBuy || 0) + (analyst.buy || 0) + (analyst.hold || 0) + (analyst.sell || 0) + (analyst.strongSell || 0);
    bullPoints.push(`Analyst consensus is ${analyst.recommendation} (${total} analysts)`);
  }
  if (quote.yearHigh && quote.price && quote.price < quote.yearHigh * 0.85) {
    bullPoints.push(`${((1 - quote.price / quote.yearHigh) * 100).toFixed(0)}% below 52-week high of ${formatPrice(quote.yearHigh)}`);
  }
  if (technicals?.cross?.signal === 'Golden Cross') bullPoints.push('50/200 SMA golden cross — bullish trend signal');
  if (technicals?.macd?.label === 'Bullish') bullPoints.push('MACD showing bullish momentum');
  if (valuation >= 3.5) bullPoints.push(`Attractive valuation score of ${valuation.toFixed(1)}/5`);
  if (analyst?.pegRatio != null && analyst.pegRatio < 1 && analyst.pegRatio > 0) {
    bullPoints.push(`Low PEG ratio of ${analyst.pegRatio.toFixed(2)} suggests undervalued relative to growth`);
  }
  if (quote.dividendYield != null && quote.dividendYield > 2) {
    bullPoints.push(`Dividend yield of ${Number(quote.dividendYield).toFixed(2)}%`);
  }

  // Bear points
  const bearPoints = [];
  if (quote.pe != null && quote.pe > 50) {
    bearPoints.push(`High P/E ratio of ${Number(quote.pe).toFixed(0)}x — premium valuation`);
  }
  if (analyst?.targetMeanPrice && quote.price && quote.price > analyst.targetMeanPrice) {
    bearPoints.push(`Trading ${(((quote.price - analyst.targetMeanPrice) / analyst.targetMeanPrice) * 100).toFixed(1)}% above mean analyst target`);
  }
  if (technicals?.rsi?.label === 'Overbought') bearPoints.push('RSI indicates overbought conditions');
  if (technicals?.macd?.label === 'Bearish') bearPoints.push('MACD bearish crossover — momentum declining');
  if (quote.beta != null && quote.beta > 2) {
    bearPoints.push(`High beta of ${Number(quote.beta).toFixed(2)} — significant volatility risk`);
  }
  if (analyst?.revenueGrowth != null && analyst.revenueGrowth < 0) {
    bearPoints.push(`Revenue declining ${(analyst.revenueGrowth * 100).toFixed(1)}%`);
  }
  if (analyst?.earningsGrowth != null && analyst.earningsGrowth < 0) {
    bearPoints.push(`Earnings declining ${(analyst.earningsGrowth * 100).toFixed(1)}%`);
  }
  if (technicals?.cross?.signal === 'Death Cross') bearPoints.push('50/200 SMA death cross — bearish trend');
  if (valuation <= 2) bearPoints.push(`Stretched valuation score of ${valuation.toFixed(1)}/5`);
  if (technicals?.volume?.label === 'Below Average') bearPoints.push('Trading volume below average — weak conviction');

  // Valuation context
  let valuationContext = '';
  if (quote.pe != null) {
    valuationContext = `At a P/E of ${Number(quote.pe).toFixed(1)}x, ${quote.symbol} trades `;
    if (quote.pe > 30) valuationContext += 'at a significant premium to the S&P 500 average of ~22x.';
    else if (quote.pe > 22) valuationContext += 'above the S&P 500 average of ~22x.';
    else if (quote.pe > 15) valuationContext += 'roughly in line with market averages.';
    else valuationContext += 'at a discount to the S&P 500 average of ~22x.';
    if (analyst?.pegRatio != null) {
      valuationContext += ` PEG ratio of ${analyst.pegRatio.toFixed(2)} ${analyst.pegRatio < 1 ? 'suggests potential undervaluation relative to growth' : analyst.pegRatio > 2 ? 'indicates the stock may be overpriced for its growth rate' : 'is in a reasonable range'}.`;
    }
  }

  // Price target analysis
  let priceTargetAnalysis = '';
  if (analyst && analyst.targetMeanPrice != null) {
    const total = (analyst.strongBuy || 0) + (analyst.buy || 0) + (analyst.hold || 0) + (analyst.sell || 0) + (analyst.strongSell || 0);
    if (total > 0) {
      priceTargetAnalysis = `Of ${total} analysts covering ${quote.symbol}, ${analyst.strongBuy || 0} rate it Strong Buy, ${analyst.buy || 0} Buy, ${analyst.hold || 0} Hold, ${analyst.sell || 0} Sell, and ${analyst.strongSell || 0} Strong Sell.`;
      const upside = quote.price ? ((analyst.targetMeanPrice - quote.price) / quote.price * 100) : 0;
      priceTargetAnalysis += ` The mean price target of ${formatPrice(analyst.targetMeanPrice)} implies ${upside >= 0 ? upside.toFixed(1) + '% upside' : Math.abs(upside).toFixed(1) + '% downside'} from current levels`;
      if (analyst.targetHighPrice) priceTargetAnalysis += `, with a bull case of ${formatPrice(analyst.targetHighPrice)}`;
      if (analyst.targetLowPrice) priceTargetAnalysis += ` and bear case of ${formatPrice(analyst.targetLowPrice)}`;
      priceTargetAnalysis += '.';
    }
  }

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Investment Thesis</h3>
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 4px' }}>
          {summary}
        </p>
        {analystSummary && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 12px' }}>
            {analystSummary}
          </p>
        )}

        {(bullPoints.length > 0 || bearPoints.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            {bullPoints.length > 0 && (
              <div style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ color: 'var(--green)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>BULL CASE</div>
                {bullPoints.map((p, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, marginBottom: '4px', display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {bearPoints.length > 0 && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ color: 'var(--red)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>BEAR CASE</div>
                {bearPoints.map((p, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, marginBottom: '4px', display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--red)', flexShrink: 0 }}>✗</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {valuationContext && (
          <>
            <div style={{ color: 'var(--gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>VALUATION CONTEXT</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, margin: '0 0 12px' }}>{valuationContext}</p>
          </>
        )}

        {priceTargetAnalysis && (
          <>
            <div style={{ color: 'var(--gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>PRICE TARGET ANALYSIS</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>{priceTargetAnalysis}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── User Notes ──
function UserNotes({ symbol }) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`thesis_${symbol}`) || '';
    setNotes(stored);
    setExpanded(stored.length > 0);
    setSaved(false);
  }, [symbol]);

  const handleSave = () => { localStorage.setItem(`thesis_${symbol}`, notes); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleExport = () => { navigator.clipboard.writeText(`${symbol} Notes:\n${notes}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); };

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Your Notes</h3>
      <div style={{ padding: '16px' }}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Write your notes..."
          rows={expanded ? 6 : 2}
          style={{ width: '100%', resize: 'vertical', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease' }}
          onFocus={e => { e.target.style.borderColor = 'var(--gold)'; setExpanded(true); }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; if (!notes.trim()) setExpanded(false); }} />
        {expanded && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={handleSave} style={{ backgroundColor: 'var(--gold)', border: 'none', borderRadius: '6px', padding: '8px 16px', color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saved ? <><Check size={12} /> Saved!</> : <><Save size={12} /> Save</>}
            </button>
            <button onClick={handleExport} style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Export</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expanded Key Risks ──
function KeyRisks({ quote, analyst, technicals, profile, financials }) {
  const risks = [];

  if (quote?.pe > 100) risks.push({ label: 'Extreme Valuation', desc: `P/E of ${quote.pe?.toFixed(0)}x is ${(quote.pe/22).toFixed(1)}x the market average`, severity: 'High' });
  else if (quote?.pe > 40) risks.push({ label: 'Valuation Premium', desc: `P/E of ${quote.pe?.toFixed(1)}x trades at significant premium`, severity: 'Medium' });
  else if (quote?.pe != null && quote.pe < 0) risks.push({ label: 'Negative Earnings', desc: 'Company is currently unprofitable — P/E ratio is negative', severity: 'High' });

  if (quote?.beta > 2) risks.push({ label: 'Extreme Volatility', desc: `Beta of ${quote.beta?.toFixed(2)} — moves ${quote.beta?.toFixed(1)}x market swings`, severity: 'High' });
  else if (quote?.beta > 1.5) risks.push({ label: 'High Volatility', desc: `Beta of ${quote.beta?.toFixed(2)} indicates elevated market sensitivity`, severity: 'Medium' });

  if (technicals?.rsi?.value > 75) risks.push({ label: 'Severely Overbought', desc: `RSI of ${technicals.rsi.value?.toFixed(0)} signals potential near-term pullback`, severity: 'High' });
  else if (technicals?.rsi?.value > 70) risks.push({ label: 'Overbought', desc: `RSI of ${technicals.rsi.value?.toFixed(0)} approaching overbought territory`, severity: 'Medium' });

  if (technicals?.macd?.label === 'Bearish') risks.push({ label: 'Bearish MACD', desc: 'MACD crossed below signal line — bearish momentum signal', severity: 'Medium' });

  if (analyst?.targetMeanPrice && quote?.price > analyst.targetMeanPrice) {
    risks.push({ label: 'Above Analyst Target', desc: `Trading ${(((quote.price - analyst.targetMeanPrice) / analyst.targetMeanPrice) * 100).toFixed(1)}% above mean analyst price target of ${formatPrice(analyst.targetMeanPrice)}`, severity: 'High' });
  }

  const sellCount = (analyst?.sell || 0) + (analyst?.strongSell || 0);
  const buyCount = (analyst?.buy || 0) + (analyst?.strongBuy || 0);
  if (sellCount > buyCount && sellCount > 0) risks.push({ label: 'Negative Analyst Sentiment', desc: `${sellCount} sell ratings vs ${buyCount} buy ratings among covering analysts`, severity: 'High' });

  if (technicals?.cross?.signal === 'Death Cross') risks.push({ label: 'Below Key Moving Averages', desc: 'Death cross pattern — 50-day MA below 200-day MA indicates downtrend', severity: 'Medium' });

  if (quote?.volume && quote?.avgVolume && quote.volume < quote.avgVolume * 0.5) {
    risks.push({ label: 'Low Volume', desc: 'Trading volume significantly below average — weak conviction', severity: 'Low' });
  }

  if (analyst?.shortRatio != null && analyst.shortRatio > 5) {
    risks.push({ label: 'High Short Interest', desc: `Short ratio of ${analyst.shortRatio.toFixed(1)} days to cover`, severity: 'Medium' });
  } else if (analyst?.shortRatio != null && analyst.shortRatio > 3) {
    risks.push({ label: 'Elevated Short Interest', desc: `Short ratio of ${analyst.shortRatio.toFixed(1)} days to cover`, severity: 'Low' });
  }

  if (analyst?.revenueGrowth != null && analyst.revenueGrowth < -0.05) {
    risks.push({ label: 'Revenue Decline', desc: `Revenue declining ${(analyst.revenueGrowth * 100).toFixed(1)}% — potential structural weakness`, severity: 'High' });
  } else if (analyst?.revenueGrowth != null && analyst.revenueGrowth < 0) {
    risks.push({ label: 'Slowing Revenue', desc: `Revenue growth of ${(analyst.revenueGrowth * 100).toFixed(1)}% — near stagnation`, severity: 'Medium' });
  }

  if (analyst?.earningsGrowth != null && analyst.earningsGrowth < -0.1) {
    risks.push({ label: 'Earnings Contraction', desc: `Earnings declining ${(analyst.earningsGrowth * 100).toFixed(1)}%`, severity: 'High' });
  }

  if (quote?.yearHigh && quote?.price && quote.price >= quote.yearHigh * 0.98) {
    risks.push({ label: 'Near 52-Week High', desc: 'Trading near 52-week high — limited upside without new catalysts', severity: 'Low' });
  }

  if (quote?.priceToBook != null && quote.priceToBook > 10) {
    risks.push({ label: 'High Price-to-Book', desc: `P/B of ${quote.priceToBook.toFixed(1)}x — significant premium to book value`, severity: 'Medium' });
  }

  if (analyst?.pegRatio != null && analyst.pegRatio > 2.5) {
    risks.push({ label: 'Expensive vs Growth', desc: `PEG of ${analyst.pegRatio.toFixed(2)} — overpriced relative to earnings growth`, severity: 'Medium' });
  }

  const latestIncome = financials?.income?.[0];
  if (latestIncome?.netIncome != null && latestIncome?.revenue != null && latestIncome.revenue > 0) {
    const margin = (latestIncome.netIncome / latestIncome.revenue) * 100;
    if (margin < 0) risks.push({ label: 'Negative Net Margin', desc: `Net margin of ${margin.toFixed(1)}% — company is losing money`, severity: 'High' });
    else if (margin < 5) risks.push({ label: 'Thin Margins', desc: `Net margin of ${margin.toFixed(1)}% — limited profitability buffer`, severity: 'Medium' });
  }

  const latestBalance = financials?.balance?.[0];
  if (latestBalance?.totalDebt != null && latestBalance?.totalStockholdersEquity != null && latestBalance.totalStockholdersEquity > 0) {
    const debtToEquity = latestBalance.totalDebt / latestBalance.totalStockholdersEquity;
    if (debtToEquity > 3) risks.push({ label: 'Heavy Leverage', desc: `Debt-to-equity of ${debtToEquity.toFixed(1)}x — high balance sheet risk`, severity: 'High' });
    else if (debtToEquity > 1.5) risks.push({ label: 'Elevated Leverage', desc: `Debt-to-equity of ${debtToEquity.toFixed(1)}x`, severity: 'Medium' });
  }

  if (profile?.sector === 'Technology' || profile?.sector === 'Communication Services') {
    risks.push({ label: 'Regulatory Risk', desc: 'Tech/comms sector faces increasing regulatory scrutiny globally', severity: 'Low' });
  }

  if (quote?.marketCap != null && quote.marketCap < 2e9) {
    risks.push({ label: 'Small Cap Risk', desc: 'Market cap under $2B — higher volatility and liquidity risk', severity: 'Medium' });
  }

  // Sort by severity
  risks.sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  if (risks.length === 0) return null;

  const severityStyles = {
    High: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: 'rgba(239,68,68,0.25)', badge: '#ef4444' },
    Medium: { bg: 'rgba(234,179,8,0.12)', color: '#eab308', border: 'rgba(234,179,8,0.25)', badge: '#eab308' },
    Low: { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', badge: '#3B82F6' },
  };

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Key Risks</h3>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {risks.map((r, i) => {
          const s = severityStyles[r.severity] || severityStyles.Low;
          return (
            <div key={i} style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <AlertTriangle size={12} color={s.color} />
                <span style={{ color: s.color, fontSize: '12px', fontWeight: 600 }}>{r.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', backgroundColor: s.badge + '22', color: s.badge, letterSpacing: '0.06em' }}>
                  {r.severity.toUpperCase()}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Comparable Companies ──
function ComparableCompanies({ symbol, profile, quote }) {
  const { setActiveSymbol } = useApp();
  const [peerQuotes, setPeerQuotes] = useState([]);
  const [loading, setLoading] = useState(false);

  const peers = profile?.peersList || profile?.peers || [];

  useEffect(() => {
    if (!peers.length) return;
    setLoading(true);
    api.quotes(peers.slice(0, 8))
      .then(data => setPeerQuotes(Array.isArray(data) ? data : []))
      .catch(() => setPeerQuotes([]))
      .finally(() => setLoading(false));
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!peers.length) return null;

  const rows = peerQuotes.filter(q => q && q.symbol);

  const median = (arr, fn) => {
    const vals = arr.map(fn).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
    if (!vals.length) return null;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  };

  const COL = { fontSize: '11px', padding: '6px 10px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
  const HEAD = { ...COL, color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Comparable Companies</h3>
      {loading ? (
        <div style={{ padding: '16px' }}><SkeletonBlock width="100%" height="120px" /></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: '12px' }}>No peer data available</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...HEAD, textAlign: 'left' }}>Ticker</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Price</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Change%</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Market Cap</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>P/E</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Div Yield</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.symbol} style={{ cursor: 'pointer' }} onClick={() => setActiveSymbol(q.symbol)}>
                  <td style={{ ...COL, textAlign: 'left' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '11px' }}>{q.symbol}</span>
                  </td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-primary)' }}>{formatPrice(q.price)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: q.changesPercentage >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPercent(q.changesPercentage)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatMarketCap(q.marketCap)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{q.pe != null ? q.pe.toFixed(1) : '—'}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatDividendYield(q.dividendYield)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'rgba(234,179,8,0.06)' }}>
                <td style={{ ...COL, textAlign: 'left', fontWeight: 700, color: 'var(--gold)', fontSize: '10px' }}>MEDIAN</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatPrice(median(rows, r => r.price))}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatPercent(median(rows, r => r.changesPercentage))}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatMarketCap(median(rows, r => r.marketCap))}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{median(rows, r => r.pe) != null ? median(rows, r => r.pe).toFixed(1) : '—'}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatDividendYield(median(rows, r => r.dividendYield))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Short Interest ──
function ShortInterestSection({ analyst }) {
  if (!analyst) return null;
  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Short Interest</h3>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Short Ratio (Days to Cover)</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{analyst.shortRatio != null ? analyst.shortRatio.toFixed(2) : '—'}</span>
        </div>
        {analyst.shortPercentOfFloat != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Short % of Float</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{(analyst.shortPercentOfFloat * 100).toFixed(2)}%</span>
          </div>
        )}
        {analyst.shortOutstanding != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Shares Short</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{formatMarketCap(analyst.shortOutstanding)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dividend Analysis ──
function DividendAnalysis({ quote }) {
  if (!quote) return null;
  const dy = quote.dividendYield;
  const annualDiv = quote.annualDividend ?? quote.lastDiv ?? quote.dividend;
  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Dividend Analysis</h3>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Dividend Yield</span>
          <span style={{ color: dy ? 'var(--green)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>{formatDividendYield(dy)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Annual Dividend / Share</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{annualDiv != null ? '$' + Number(annualDiv).toFixed(2) : '—'}</span>
        </div>
        {quote.payoutRatio != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Payout Ratio</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{(quote.payoutRatio * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ownership Structure ──
function OwnershipSection({ analyst, quote }) {
  const instOwn = analyst?.institutionalOwnership ?? quote?.institutionalOwnership;
  const insiderOwn = analyst?.insiderOwnership ?? quote?.insiderOwnership;
  const floatShares = analyst?.floatShares ?? quote?.floatShares;
  const sharesOut = analyst?.sharesOutstanding ?? quote?.sharesOutstanding;

  // Hide section if no useful data
  if (instOwn == null && insiderOwn == null && floatShares == null && sharesOut == null) return null;

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Ownership Structure</h3>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {instOwn != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Institutional %</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
              {(instOwn < 1 ? instOwn * 100 : instOwn).toFixed(1)}%
            </span>
          </div>
        )}
        {insiderOwn != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Insider %</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
              {(insiderOwn < 1 ? insiderOwn * 100 : insiderOwn).toFixed(2)}%
            </span>
          </div>
        )}
        {sharesOut != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Shares Outstanding</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{formatMarketCap(sharesOut).replace('$', '')}</span>
          </div>
        )}
        {floatShares != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Float</span>
            <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{formatMarketCap(floatShares).replace('$', '')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Insider Activity ──
function InsiderActivity({ symbol }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.insiderTrading(symbol)
      .then(data => setTrades(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (!loading && trades.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <h3 style={SECTION_HEADER}>Insider Activity</h3>
        <div style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '12px' }}>No recent insider activity</div>
      </div>
    );
  }

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Insider Activity</h3>
      {loading ? (
        <div style={{ padding: '12px' }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '28px', marginBottom: '4px' }} />)}</div>
      ) : (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {trades.map((t, i) => {
            const isBuy = (t.transactionType || '').toLowerCase().includes('buy') || (t.transactionType || '').toLowerCase().includes('purchase') || (t.transactionType || '').toLowerCase() === 'p-purchase';
            return (
              <div key={`${t.filingDate || t.transactionDate}-${i}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '11px' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.reportingName || t.reportingCik || 'Unknown'}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                    {t.filingDate || t.transactionDate} {'\u00B7'} <span style={{ color: isBuy ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{t.transactionType || 'N/A'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {t.securitiesTransacted != null && (
                    <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{Number(t.securitiesTransacted).toLocaleString()} shares</div>
                  )}
                  {t.price != null && (
                    <div style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: '10px' }}>@ {formatPrice(t.price)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Financial Models ──
const MODEL_INPUT = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  padding: '6px 10px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'monospace',
  outline: 'none',
  width: '100px',
};

const MODEL_TAB = (active) => ({
  padding: '6px 14px',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: '4px',
  border: active ? '1px solid var(--gold)' : '1px solid var(--border-color)',
  background: active ? 'rgba(234,179,8,0.12)' : 'var(--bg-primary)',
  color: active ? 'var(--gold)' : 'var(--text-tertiary)',
  cursor: 'pointer',
  letterSpacing: '0.04em',
});

const MODEL_ROW = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid var(--border-color)',
};

const MODEL_LABEL = { color: 'var(--text-tertiary)', fontSize: '11px' };
const MODEL_VALUE = { color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' };

function DCFModel({ quote, analyst }) {
  const eps = quote?.eps ?? 0;
  const defaultGrowth = analyst?.growthRate ? (analyst.growthRate * 100).toFixed(1) : '8';
  const [growthRate, setGrowthRate] = useState(parseFloat(defaultGrowth));
  const [discountRate, setDiscountRate] = useState(10);
  const [terminalMultiple, setTerminalMultiple] = useState(15);

  const years = [1, 2, 3, 4, 5];
  const projectedEps = years.map(y => eps * Math.pow(1 + growthRate / 100, y));
  const pvEps = projectedEps.map((e, i) => e / Math.pow(1 + discountRate / 100, i + 1));
  const totalPV = pvEps.reduce((a, b) => a + b, 0);
  const terminalValue = (projectedEps[4] * terminalMultiple) / Math.pow(1 + discountRate / 100, 5);
  const impliedPrice = totalPV + terminalValue;
  const currentPrice = quote?.price ?? 0;
  const upside = currentPrice > 0 ? ((impliedPrice - currentPrice) / currentPrice * 100) : 0;

  const SLIDER_STYLE = { width: '100%', accentColor: 'var(--gold)', cursor: 'pointer', height: '4px' };
  const SLIDER_CONTAINER = { flex: 1, minWidth: '160px' };
  const SLIDER_LABEL = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={SLIDER_CONTAINER}>
          <div style={SLIDER_LABEL}>
            <span style={MODEL_LABEL}>Growth Rate</span>
            <span style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{growthRate.toFixed(1)}%</span>
          </div>
          <input type="range" min="-10" max="40" step="0.5" value={growthRate} onChange={e => setGrowthRate(parseFloat(e.target.value))} style={SLIDER_STYLE} />
        </div>
        <div style={SLIDER_CONTAINER}>
          <div style={SLIDER_LABEL}>
            <span style={MODEL_LABEL}>Discount Rate</span>
            <span style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{discountRate.toFixed(1)}%</span>
          </div>
          <input type="range" min="4" max="20" step="0.5" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value))} style={SLIDER_STYLE} />
        </div>
        <div style={SLIDER_CONTAINER}>
          <div style={SLIDER_LABEL}>
            <span style={MODEL_LABEL}>Terminal Multiple</span>
            <span style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{terminalMultiple.toFixed(0)}x</span>
          </div>
          <input type="range" min="5" max="40" step="1" value={terminalMultiple} onChange={e => setTerminalMultiple(parseFloat(e.target.value))} style={SLIDER_STYLE} />
        </div>
      </div>

      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Projected EPS</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '10px', borderBottom: '1px solid var(--border-color)' }}>Year</th>
              {years.map(y => <th key={y} style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '10px', borderBottom: '1px solid var(--border-color)' }}>Y{y}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>EPS</td>
              {projectedEps.map((e, i) => <td key={i} style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>${e.toFixed(2)}</td>)}
            </tr>
            <tr>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>PV(EPS)</td>
              {pvEps.map((e, i) => <td key={i} style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${e.toFixed(2)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Sum of PV(EPS)</div>
          <div style={MODEL_VALUE}>${totalPV.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>PV(Terminal Value)</div>
          <div style={MODEL_VALUE}>${terminalValue.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Implied Share Price</div>
          <div style={{ ...MODEL_VALUE, color: 'var(--gold)' }}>${impliedPrice.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Upside / Downside</div>
          <div style={{ ...MODEL_VALUE, color: upside >= 0 ? 'var(--green)' : 'var(--red)' }}>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function LBOModel({ quote }) {
  const currentPE = quote?.pe ?? 15;
  const currentEps = quote?.eps ?? 0;
  const [entryMultiple, setEntryMultiple] = useState(parseFloat(currentPE.toFixed(1)) || 15);
  const [exitMultiple, setExitMultiple] = useState(20);
  const [debtPct, setDebtPct] = useState(60);
  const [interestRate, setInterestRate] = useState(6);

  const entryPrice = currentEps * entryMultiple;
  const equityPct = 100 - debtPct;
  const equityPerShare = entryPrice * (equityPct / 100);
  const debtPerShare = entryPrice * (debtPct / 100);

  // Simple 5-year LBO: assume EPS grows 5% annually, debt paid down linearly
  const holdingPeriod = 5;
  const epsGrowth = 0.05;
  const exitEps = currentEps * Math.pow(1 + epsGrowth, holdingPeriod);
  const exitPrice = exitEps * exitMultiple;
  const totalInterest = debtPerShare * (interestRate / 100) * holdingPeriod;
  const equityReturn = exitPrice - equityPerShare - totalInterest;
  const moic = equityPerShare > 0 ? (equityReturn + equityPerShare) / equityPerShare : 0;
  const irr = equityPerShare > 0 ? (Math.pow(moic, 1 / holdingPeriod) - 1) * 100 : 0;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={MODEL_LABEL}>
          Entry Multiple
          <input type="number" value={entryMultiple} onChange={e => setEntryMultiple(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px' }} />
        </label>
        <label style={MODEL_LABEL}>
          Exit Multiple
          <input type="number" value={exitMultiple} onChange={e => setExitMultiple(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px' }} />
        </label>
        <label style={MODEL_LABEL}>
          Debt %
          <input type="number" value={debtPct} onChange={e => setDebtPct(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px', width: '60px' }} />
        </label>
        <label style={MODEL_LABEL}>
          Interest %
          <input type="number" value={interestRate} onChange={e => setInterestRate(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px', width: '60px' }} />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div style={MODEL_ROW}>
          <span style={MODEL_LABEL}>Entry Price (EPS x Multiple)</span>
          <span style={MODEL_VALUE}>${entryPrice.toFixed(2)}</span>
        </div>
        <div style={MODEL_ROW}>
          <span style={MODEL_LABEL}>Equity Per Share ({equityPct}%)</span>
          <span style={MODEL_VALUE}>${equityPerShare.toFixed(2)}</span>
        </div>
        <div style={MODEL_ROW}>
          <span style={MODEL_LABEL}>Debt Per Share ({debtPct}%)</span>
          <span style={MODEL_VALUE}>${debtPerShare.toFixed(2)}</span>
        </div>
        <div style={MODEL_ROW}>
          <span style={MODEL_LABEL}>Exit EPS (5% growth, {holdingPeriod}yr)</span>
          <span style={MODEL_VALUE}>${exitEps.toFixed(2)}</span>
        </div>
        <div style={MODEL_ROW}>
          <span style={MODEL_LABEL}>Exit Price</span>
          <span style={MODEL_VALUE}>${exitPrice.toFixed(2)}</span>
        </div>
        <div style={MODEL_ROW}>
          <span style={MODEL_LABEL}>Total Interest Cost</span>
          <span style={{ ...MODEL_VALUE, color: 'var(--red)' }}>-${totalInterest.toFixed(2)}</span>
        </div>
        <div style={{ ...MODEL_ROW, borderBottom: 'none' }}>
          <span style={MODEL_LABEL}>MOIC</span>
          <span style={{ ...MODEL_VALUE, color: moic >= 2 ? 'var(--green)' : moic >= 1 ? 'var(--gold)' : 'var(--red)' }}>{moic.toFixed(2)}x</span>
        </div>
        <div style={{ ...MODEL_ROW, borderBottom: 'none' }}>
          <span style={MODEL_LABEL}>Estimated IRR</span>
          <span style={{ ...MODEL_VALUE, color: irr >= 20 ? 'var(--green)' : irr >= 10 ? 'var(--gold)' : 'var(--red)' }}>{irr.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function ThreeStatementModel({ financials }) {
  const [subTab, setSubTab] = useState('income');

  const incomeData = financials?.income?.slice(0, 3)?.reverse() || [];
  const balanceData = financials?.balance?.slice(0, 3)?.reverse() || [];
  const cashflowData = financials?.cashflow?.slice(0, 3)?.reverse() || [];

  const fmtNum = (v) => {
    if (v == null || isNaN(v)) return '\u2014';
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v < 0 ? '-' : '') + '$' + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (v < 0 ? '-' : '') + '$' + (abs / 1e3).toFixed(1) + 'K';
    return '$' + v.toFixed(0);
  };

  const fiscal = (item) => item?.date?.substring(0, 4) || item?.calendarYear || '\u2014';

  const incomeRows = [
    { label: 'Revenue', key: 'revenue' },
    { label: 'Cost of Revenue', key: 'costOfRevenue' },
    { label: 'Gross Profit', key: 'grossProfit' },
    { label: 'Operating Expenses', key: 'operatingExpenses' },
    { label: 'Operating Income', key: 'operatingIncome' },
    { label: 'Net Income', key: 'netIncome' },
    { label: 'EPS', key: 'eps' },
  ];

  const balanceRows = [
    { label: 'Total Assets', key: 'totalAssets' },
    { label: 'Total Liabilities', key: 'totalLiabilities' },
    { label: 'Total Equity', key: 'totalStockholdersEquity' },
    { label: 'Cash & Equivalents', key: 'cashAndCashEquivalents' },
    { label: 'Total Debt', key: 'totalDebt' },
    { label: 'Net Debt', key: 'netDebt' },
  ];

  const cashflowRows = [
    { label: 'Operating Cash Flow', key: 'operatingCashFlow' },
    { label: 'Capital Expenditure', key: 'capitalExpenditure' },
    { label: 'Free Cash Flow', key: 'freeCashFlow' },
    { label: 'Dividends Paid', key: 'dividendsPaid' },
    { label: 'Share Repurchase', key: 'commonStockRepurchased' },
  ];

  const datasets = { income: incomeData, balance: balanceData, cashflow: cashflowData };
  const rowDefs = { income: incomeRows, balance: balanceRows, cashflow: cashflowRows };
  const data = datasets[subTab];
  const rows = rowDefs[subTab];

  const TH = { textAlign: 'right', padding: '4px 10px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '10px', borderBottom: '1px solid var(--border-color)', letterSpacing: '0.04em' };
  const TD = { textAlign: 'right', padding: '5px 10px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[{ key: 'income', label: 'Income Statement' }, { key: 'balance', label: 'Balance Sheet' }, { key: 'cashflow', label: 'Cash Flow' }].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={MODEL_TAB(subTab === t.key)}>{t.label}</button>
        ))}
      </div>

      {data.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>No data available</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left' }}>Item</th>
                {data.map((d, i) => <th key={i} style={TH}>{fiscal(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td style={{ ...TD, textAlign: 'left', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>{r.label}</td>
                  {data.map((d, i) => (
                    <td key={i} style={{ ...TD, color: d[r.key] < 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                      {r.key === 'eps' ? (d[r.key] != null ? '$' + Number(d[r.key]).toFixed(2) : '\u2014') : fmtNum(d[r.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MergerModel({ quote }) {
  const [targetTicker, setTargetTicker] = useState('');
  const [premium, setPremium] = useState(30);
  const [targetData, setTargetData] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);

  const fetchTarget = useCallback(async () => {
    if (!targetTicker) return;
    setTargetLoading(true);
    try {
      const data = await api.analysis(targetTicker).catch(() => null);
      setTargetData(data);
    } catch {
      setTargetData(null);
    } finally {
      setTargetLoading(false);
    }
  }, [targetTicker]);

  const acquirerPE = quote?.pe ?? 0;
  const targetQuote = targetData?.quote;
  const targetPE = targetQuote?.pe ?? 0;
  const targetPrice = targetQuote?.price ?? 0;
  const targetEps = targetQuote?.eps ?? 0;
  const offerPrice = targetPrice * (1 + premium / 100);
  const offerPE = targetEps > 0 ? offerPrice / targetEps : 0;

  const isAccretive = acquirerPE > 0 && offerPE > 0 && acquirerPE > offerPE;
  const accretionPct = acquirerPE > 0 && offerPE > 0 ? ((acquirerPE - offerPE) / acquirerPE * 100) : 0;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={MODEL_LABEL}>
          Acquirer
          <input type="text" value={quote?.symbol || ''} disabled style={{ ...MODEL_INPUT, marginLeft: '8px', opacity: 0.6 }} />
        </label>
        <label style={MODEL_LABEL}>
          Target Ticker
          <input
            type="text"
            value={targetTicker}
            onChange={e => setTargetTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && fetchTarget()}
            placeholder="e.g. XYZ"
            style={{ ...MODEL_INPUT, marginLeft: '8px', textTransform: 'uppercase' }}
          />
        </label>
        <button onClick={fetchTarget} style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--gold)', background: 'rgba(234,179,8,0.12)', color: 'var(--gold)', cursor: 'pointer' }}>
          Analyze
        </button>
        <label style={MODEL_LABEL}>
          Premium %
          <input type="number" value={premium} onChange={e => setPremium(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px', width: '60px' }} />
        </label>
      </div>

      {targetLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Loading target data...</div>}

      {targetData && targetQuote && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={MODEL_ROW}>
            <span style={MODEL_LABEL}>Acquirer P/E ({quote?.symbol})</span>
            <span style={MODEL_VALUE}>{acquirerPE.toFixed(1)}x</span>
          </div>
          <div style={MODEL_ROW}>
            <span style={MODEL_LABEL}>Target P/E ({targetTicker})</span>
            <span style={MODEL_VALUE}>{targetPE.toFixed(1)}x</span>
          </div>
          <div style={MODEL_ROW}>
            <span style={MODEL_LABEL}>Target Price</span>
            <span style={MODEL_VALUE}>${targetPrice.toFixed(2)}</span>
          </div>
          <div style={MODEL_ROW}>
            <span style={MODEL_LABEL}>Offer Price ({premium}% premium)</span>
            <span style={{ ...MODEL_VALUE, color: 'var(--gold)' }}>${offerPrice.toFixed(2)}</span>
          </div>
          <div style={MODEL_ROW}>
            <span style={MODEL_LABEL}>Implied Offer P/E</span>
            <span style={MODEL_VALUE}>{offerPE.toFixed(1)}x</span>
          </div>
          <div style={{ ...MODEL_ROW, borderBottom: 'none', marginTop: '4px' }}>
            <span style={{ ...MODEL_LABEL, fontWeight: 600 }}>Accretion / Dilution</span>
            <span style={{ ...MODEL_VALUE, color: isAccretive ? 'var(--green)' : 'var(--red)', fontSize: '13px' }}>
              {isAccretive ? 'Accretive' : 'Dilutive'} ({accretionPct >= 0 ? '+' : ''}{accretionPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      {!targetData && !targetLoading && (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '12px 0' }}>
          Enter a target ticker and click Analyze to see accretion/dilution based on P/E comparison.
        </div>
      )}
    </div>
  );
}

function FCFDCFModel({ quote, financials }) {
  const cfData = financials?.cashflow || [];
  const latestCF = cfData[0] || {};
  const fcf = latestCF.freeCashFlow ?? 0;
  const sharesOut = quote?.marketCap && quote?.price ? Math.round(quote.marketCap / quote.price) : 1e9;

  const [fcfGrowth, setFcfGrowth] = useState(10);
  const [discountRate, setDiscountRate] = useState(10);
  const [terminalGrowth, setTerminalGrowth] = useState(3);

  const years = [1, 2, 3, 4, 5];
  const projFCF = years.map(y => fcf * Math.pow(1 + fcfGrowth / 100, y));
  const pvFCF = projFCF.map((f, i) => f / Math.pow(1 + discountRate / 100, i + 1));
  const sumPV = pvFCF.reduce((a, b) => a + b, 0);
  const terminalFCF = projFCF[4] * (1 + terminalGrowth / 100);
  const terminalValue = terminalFCF / ((discountRate - terminalGrowth) / 100);
  const pvTerminal = terminalValue / Math.pow(1 + discountRate / 100, 5);
  const enterpriseValue = sumPV + pvTerminal;
  const impliedPerShare = sharesOut > 0 ? enterpriseValue / sharesOut : 0;
  const currentPrice = quote?.price ?? 0;
  const upside = currentPrice > 0 ? ((impliedPerShare - currentPrice) / currentPrice * 100) : 0;

  const fmtB = (v) => {
    if (v == null || isNaN(v)) return '\u2014';
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v < 0 ? '-' : '') + '$' + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(1) + 'M';
    return '$' + v.toFixed(0);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginBottom: '4px' }}>
        Based on latest Free Cash Flow: {fmtB(fcf)}
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={MODEL_LABEL}>FCF Growth % <input type="number" value={fcfGrowth} onChange={e => setFcfGrowth(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px' }} /></label>
        <label style={MODEL_LABEL}>WACC % <input type="number" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px' }} /></label>
        <label style={MODEL_LABEL}>Terminal Growth % <input type="number" value={terminalGrowth} onChange={e => setTerminalGrowth(parseFloat(e.target.value) || 0)} style={{ ...MODEL_INPUT, marginLeft: '8px' }} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>PV of FCFs</div>
          <div style={MODEL_VALUE}>{fmtB(sumPV)}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>PV of Terminal</div>
          <div style={MODEL_VALUE}>{fmtB(pvTerminal)}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Enterprise Value</div>
          <div style={{ ...MODEL_VALUE, color: 'var(--gold)' }}>{fmtB(enterpriseValue)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Implied Price/Share</div>
          <div style={{ ...MODEL_VALUE, color: 'var(--gold)' }}>${impliedPerShare.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Upside / Downside</div>
          <div style={{ ...MODEL_VALUE, color: upside >= 0 ? 'var(--green)' : 'var(--red)' }}>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function FinancialModels({ quote, profile, financials, analyst }) {
  const [activeModel, setActiveModel] = useState('dcf');

  const tabs = [
    { key: 'dcf', label: 'DCF (EPS)' },
    { key: 'fcfDcf', label: 'DCF (FCF)' },
    { key: 'lbo', label: 'LBO' },
    { key: 'threeStatement', label: '3-Statement' },
    { key: 'merger', label: 'Merger' },
  ];

  const titles = { dcf: 'DCF Model (EPS)', fcfDcf: 'DCF Model (FCF)', lbo: 'LBO Model', threeStatement: '3-Statement Model', merger: 'Merger Model' };

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Financial Models <InfoTooltip text="Interactive DCF, LBO, 3-Statement, and M&A models with adjustable inputs" /></h3>
      <div style={{ display: 'flex', gap: '6px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveModel(t.key)} style={MODEL_TAB(activeModel === t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <ProGate title={titles[activeModel]}>
        {activeModel === 'dcf' && <DCFModel quote={quote} analyst={analyst} />}
        {activeModel === 'fcfDcf' && <FCFDCFModel quote={quote} financials={financials} />}
        {activeModel === 'lbo' && <LBOModel quote={quote} />}
        {activeModel === 'threeStatement' && <ThreeStatementModel financials={financials} />}
        {activeModel === 'merger' && <MergerModel quote={quote} />}
      </ProGate>
    </div>
  );
}

// ── Key Stats Grid ──
function KeyStatsGrid({ quote, analyst }) {
  if (!quote) return null;
  const stats = [
    { label: 'Market Cap', value: formatMarketCap(quote.marketCap), tip: 'Total market value of outstanding shares' },
    { label: 'P/E Ratio', value: fmt(quote.pe), tip: 'Price divided by earnings per share (TTM)' },
    { label: 'Forward P/E', value: fmt(quote.forwardPE), tip: 'Price divided by estimated future EPS' },
    { label: 'EPS (TTM)', value: quote.eps != null ? `$${Number(quote.eps).toFixed(2)}` : '\u2014', tip: 'Earnings per share over trailing 12 months' },
    { label: 'Price/Book', value: fmt(quote.priceToBook), tip: 'Price divided by book value per share' },
    { label: 'PEG Ratio', value: fmt(analyst?.pegRatio), tip: 'P/E ratio divided by earnings growth rate. <1 may indicate undervaluation' },
    { label: 'Beta', value: fmt(quote.beta), tip: 'Measure of volatility relative to the market. >1 = more volatile' },
    { label: 'Div Yield', value: formatDividendYield(quote.dividendYield), tip: 'Annual dividend as a percentage of share price' },
    { label: '52W High', value: formatPrice(quote.yearHigh), tip: 'Highest price in the last 52 weeks' },
    { label: '52W Low', value: formatPrice(quote.yearLow), tip: 'Lowest price in the last 52 weeks' },
    { label: '50D Avg', value: formatPrice(quote.priceAvg50), tip: '50-day simple moving average price' },
    { label: '200D Avg', value: formatPrice(quote.priceAvg200), tip: '200-day simple moving average price' },
    { label: 'Volume', value: quote.volume ? Number(quote.volume).toLocaleString() : '\u2014', tip: 'Number of shares traded today' },
    { label: 'Avg Volume', value: quote.avgVolume ? Number(quote.avgVolume).toLocaleString() : '\u2014', tip: 'Average daily trading volume' },
    { label: 'Open', value: formatPrice(quote.open), tip: 'Opening price for the current trading session' },
    { label: 'Prev Close', value: formatPrice(quote.previousClose), tip: 'Closing price from the previous trading session' },
    { label: 'Day High', value: formatPrice(quote.high), tip: 'Highest price during the current session' },
    { label: 'Day Low', value: formatPrice(quote.low), tip: 'Lowest price during the current session' },
    { label: 'Enterprise Value', value: analyst?.enterpriseValue ? formatMarketCap(analyst.enterpriseValue) : '\u2014', tip: 'Market cap + debt - cash. True cost to acquire the company' },
    { label: 'Revenue Growth', value: analyst?.revenueGrowth != null ? `${(analyst.revenueGrowth * 100).toFixed(1)}%` : '\u2014', tip: 'Year-over-year revenue growth rate' },
    { label: 'Earnings Growth', value: analyst?.earningsGrowth != null ? `${(analyst.earningsGrowth * 100).toFixed(1)}%` : '\u2014', tip: 'Year-over-year earnings growth rate' },
    { label: 'Target Mean', value: analyst?.targetMeanPrice ? formatPrice(analyst.targetMeanPrice) : '\u2014', tip: 'Average analyst price target' },
    { label: 'Short Ratio', value: fmt(analyst?.shortRatio), tip: 'Days to cover short positions based on average volume' },
    { label: 'Analysts', value: analyst?.numberOfAnalysts || '\u2014', tip: 'Number of analysts covering this stock' },
  ];

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Key Statistics <InfoTooltip text="Fundamental metrics sourced from Yahoo Finance in real-time" /></h3>
      <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0' }}>
        {stats.map(s => (
          <div key={s.label} className="tooltip-container" style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', cursor: 'help', position: 'relative' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.05em', marginBottom: '2px' }}>{s.label}</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{s.value}</div>
            <span className="tooltip-text">{s.tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──
export default function AnalysisTab() {
  const { activeSymbol, setActiveSymbol } = useApp();
  const [analysisSymbol, setAnalysisSymbol] = useState(activeSymbol || '');
  const [analysisData, setAnalysisData] = useState(null);
  const [technicals, setTechnicals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback((sym) => {
    setAnalysisSymbol(sym);
    setActiveSymbol(sym);
  }, [setActiveSymbol]);

  useEffect(() => {
    if (activeSymbol && activeSymbol !== analysisSymbol) {
      setAnalysisSymbol(activeSymbol);
    }
  }, [activeSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!analysisSymbol) return;
    setLoading(true);
    setError(null);
    setAnalysisData(null);
    setTechnicals(null);

    try {
      const [analysis, priceData] = await Promise.all([
        api.analysis(analysisSymbol).catch(() => null),
        getPriceHistory(analysisSymbol, '1Y').catch(() => []),
      ]);
      setAnalysisData(analysis);

      if (analysis?.quote) {
        addRecentSearch(
          analysisSymbol,
          analysis.profile?.companyName || analysis.quote.name,
          analysis.quote.price,
          analysis.quote.changesPercentage
        );
      }

      const rsi = calculateRSI(priceData);
      const cross = checkCrossSignal(priceData);
      const macd = calculateMACD(priceData);
      const volume = volumeTrend(priceData);
      const q = analysis?.quote;
      const price = q?.price ?? (priceData.length > 0 ? priceData[priceData.length - 1].c : null);
      const position = pricePosition(price, q?.yearHigh, q?.yearLow);
      setTechnicals({ rsi, cross, macd, volume, position });
    } catch (e) {
      console.error('Analysis fetch error:', e);
      setError('Failed to load analysis data.');
    } finally {
      setLoading(false);
    }
  }, [analysisSymbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quote = analysisData?.quote;
  const profile = analysisData?.profile;
  const analyst = analysisData?.analyst;
  const earnings = analysisData?.earnings;
  const financials = analysisData?.financials;

  const valScores = [scorePE(quote?.pe), scorePB(quote?.priceToBook), scorePEG(analyst?.pegRatio), scoreDY(quote?.dividendYield)];
  const valAvg = valScores.reduce((a, b) => a + b, 0) / valScores.length;

  return (
    <div className="page-fade-in">
      {/* Row 1: Sticky top bar with search + company info */}
      <div style={{
        position: 'sticky', top: '56px', zIndex: 50,
        backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)',
        padding: '12px 0', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {quote && (
              <>
                <span style={{ backgroundColor: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', fontFamily: 'monospace' }}>{quote.symbol}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{profile?.companyName || quote.name}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>{formatPrice(quote.price)}</span>
                <span style={{ color: (quote.change ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>
                  {(quote.change ?? 0) >= 0 ? '+' : ''}{Number(quote.change ?? 0).toFixed(2)} ({formatPercent(quote.changesPercentage)})
                </span>
                {profile?.sector && <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{profile.sector} {profile.industry ? `\u00B7 ${profile.industry}` : ''}</span>}
                <button onClick={() => {
                  try {
                    const stored = JSON.parse(localStorage.getItem('meridian-watchlist') || '[]');
                    if (!stored.includes(quote.symbol)) {
                      stored.push(quote.symbol);
                      localStorage.setItem('meridian-watchlist', JSON.stringify(stored));
                    }
                  } catch {}
                }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', color: 'var(--text-secondary)', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + Watchlist
                </button>
              </>
            )}
            {!quote && <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Analysis</span>}
          </div>
          <AnalysisSearchBar onSearch={handleSearch} />
        </div>
      </div>

      {!analysisSymbol ? (
        <EmptyState onSearch={handleSearch} />
      ) : loading ? (
        <div>{[1, 2, 3].map(i => (<div key={i} style={{ ...CARD_STYLE, padding: '16px' }}><SkeletonBlock width="40%" height="14px" style={{ marginBottom: '16px' }} /><SkeletonBlock width="100%" height="24px" style={{ marginBottom: '8px' }} /><SkeletonBlock width="80%" height="16px" /></div>))}</div>
      ) : error ? (
        <div style={{ padding: '20px', backgroundColor: 'var(--red-muted)', border: '1px solid #7F1D1D', borderRadius: '8px' }}>
          <p style={{ color: 'var(--red)', margin: '0 0 8px', fontSize: '13px' }}>{error}</p>
          <button onClick={fetchData} style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      ) : (
        <>
          {/* Row 2: Price chart */}
          <AnalysisPriceChart symbol={analysisSymbol} />

          {/* Row 3: Key stats grid (24+ stats in 2 rows) */}
          <KeyStatsGrid quote={quote} analyst={analyst} />

          {/* Row 4: Company profile + analyst consensus (55/45 split) */}
          <div style={{ display: 'grid', gridTemplateColumns: '55fr 45fr', gap: '16px' }}>
            <CompanySnapshot quote={quote} profile={profile} />
            <AnalystConsensus analyst={analyst} />
          </div>

          {/* Row 5: Overall Signal banner (full width) */}
          {technicals && <OverallSignal technicals={technicals} valuation={valAvg} />}

          {/* Row 5b: Technical indicators + valuation (2 columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {technicals ? <TechnicalIndicators technicals={technicals} quote={quote} /> : <div />}
            <ValuationScorecard quote={quote} analyst={analyst} />
          </div>

          {/* Row 6: Earnings history + revenue trend (2 columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <EarningsHistoryChart earnings={earnings} />
            <RevenueTrend financials={financials} />
          </div>

          {/* Row 7: Comparable companies (full width) */}
          <ComparableCompanies symbol={analysisSymbol} profile={profile} quote={quote} />

          {/* Row 8: Short interest + insider activity + dividend (3 columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <ShortInterestSection analyst={analyst} />
            <InsiderActivity symbol={analysisSymbol} />
            <DividendAnalysis quote={quote} />
          </div>

          {/* Row 9: Ownership (full width) */}
          <OwnershipSection analyst={analyst} quote={quote} />

          {/* Row 10: Investment thesis + risks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <AutoThesis quote={quote} analyst={analyst} technicals={technicals} valuation={valAvg} profile={profile} financials={financials} />
            <KeyRisks quote={quote} analyst={analyst} technicals={technicals} profile={profile} financials={financials} />
          </div>

          {/* Row 11: News feed (full width) */}
          <NewsFeed symbol={analysisSymbol} />

          {/* Row 12: Financial models (full width) */}
          <FinancialModels quote={quote} profile={profile} financials={financials} analyst={analyst} />

          {/* User notes */}
          <UserNotes symbol={analysisSymbol} />
        </>
      )}

      <style>{`
        @media (max-width: 1100px) {
          div[style*="grid-template-columns: 1fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="repeat(6, 1fr)"] { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 55fr 45fr"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 1fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="repeat(6, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
