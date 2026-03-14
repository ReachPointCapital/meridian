import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../../services/api';
import { formatPrice, formatPercent } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';
import SearchBar from './SearchBar';
import DetailPanel from '../ui/DetailPanel';

// ── Hero Bar (scrolling ticker, auto-refresh 60s) ──
function HeroBar({ onItemClick }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.macro();
        setData(Array.isArray(result) ? result : []);
      } catch {}
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (data.length === 0) return null;
  const doubled = [...data, ...data];

  return (
    <div style={{
      overflow: 'hidden', marginBottom: '20px', borderBottom: '1px solid var(--border-color)',
      padding: '8px 0',
    }}>
      <div style={{
        display: 'flex', gap: '32px', animation: 'scrollTicker 30s linear infinite',
        width: 'max-content',
      }}>
        {doubled.map((item, i) => {
          const isPos = (item.changePercent ?? item.changesPercentage ?? 0) >= 0;
          return (
            <span
              key={`${item.symbol}-${i}`}
              onClick={() => onItemClick && onItemClick(item)}
              style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '12px', cursor: 'pointer' }}
            >
              <span style={{ color: 'var(--gold)', fontWeight: 600, fontFamily: 'monospace' }}>{item.label || item.symbol}</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatPrice(item.price)}</span>
              <span style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace', fontWeight: 600 }}>
                {formatPercent(item.changePercent ?? item.changesPercentage)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Global Markets Overview ──
function GlobalMarketsOverview({ onRowClick }) {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.globalIndices();
        setIndices(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '16px' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Global Markets Overview</span>
      </div>
      {loading ? (
        <div style={{ padding: '16px' }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}
        </div>
      ) : indices.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Global indices data temporarily unavailable
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Index', 'Region', 'Price', 'Change', 'Change %', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Index' || h === 'Region' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indices.map((idx) => {
                const isPos = (idx.changePercent || 0) >= 0;
                return (
                  <tr key={idx.symbol} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms' }}
                    onClick={() => onRowClick && onRowClick(idx)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{idx.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.05em' }}>{idx.region}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>{idx.price != null ? formatPrice(idx.price) : '\u2014'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: isPos ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>{idx.change != null ? (idx.change >= 0 ? '+' : '') + Number(idx.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '\u2014'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: isPos ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace', fontWeight: 600 }}>{idx.changePercent != null ? formatPercent(idx.changePercent) : '\u2014'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', backgroundColor: idx.marketState === 'REGULAR' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: idx.marketState === 'REGULAR' ? 'var(--green)' : 'var(--red)' }}>
                        {idx.marketState === 'REGULAR' ? 'OPEN' : 'CLOSED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Central Bank Tracker (FRED API) ──
function CentralBankTracker({ onRowClick }) {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.centralBanks();
        if (data?.message) {
          setError(data.message);
          setBanks([]);
        } else if (Array.isArray(data)) {
          setBanks(data);
        } else {
          setBanks([]);
        }
      } catch {
        setError('Failed to load central bank rates');
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '16px' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Central Bank Policy Rates</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px' }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}</div>
      ) : error ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>{error}</div>
      ) : banks.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Central bank rate data temporarily unavailable
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Central Bank', 'Country', 'Policy Rate'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Central Bank' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {banks.map(b => (
                <tr key={b.name} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onClick={() => onRowClick && onRowClick(b)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{b.name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '10px' }}>{b.country}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 700 }}>
                    {b.rate != null ? `${Number(b.rate).toFixed(2)}%` : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── M2 Money Supply (FRED API) ──
function M2MoneySupply() {
  const [m2FullData, setM2FullData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [m2Timeframe, setM2Timeframe] = useState('3Y');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.m2();
        if (data?.message) {
          setError(data.message);
        } else if (Array.isArray(data)) {
          setM2FullData(data);
        }
      } catch {
        setError('Failed to load M2 data');
      }
      setLoading(false);
    })();
  }, []);

  const m2DisplayData = useMemo(() => {
    if (!m2FullData || m2FullData.length === 0) return [];
    const limits = { '1Y': 12, '3Y': 36, '5Y': 60, '10Y': 120 };
    const limit = limits[m2Timeframe] || 36;
    return m2FullData.map(s => ({
      ...s,
      data: s.data.slice(-limit),
    }));
  }, [m2FullData, m2Timeframe]);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '16px' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>M2 Money Supply</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {['1Y', '3Y', '5Y', '10Y'].map(period => (
            <button
              key={period}
              onClick={() => setM2Timeframe(period)}
              style={{
                background: m2Timeframe === period ? '#F0A500' : 'transparent',
                color: m2Timeframe === period ? '#000000' : 'rgba(255,255,255,0.4)',
                fontSize: '10px', fontWeight: '600',
                padding: '2px 8px', borderRadius: '4px',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '12px' }}><div className="skeleton" style={{ height: '120px' }} /></div>
      ) : error ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>{error}</div>
      ) : m2FullData.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          M2 money supply data temporarily unavailable
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: m2DisplayData.length > 1 ? '1fr 1fr' : '1fr', gap: '12px', padding: '12px' }}>
          {m2DisplayData.map(s => (
            <div key={s.seriesId}>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 600 }}>{s.name}</span>
                {s.data.length > 0 && (
                  <span style={{ color: 'var(--gold)', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', marginLeft: '8px' }}>
                    {Number(s.data[s.data.length - 1].value).toLocaleString()}
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={s.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)} />
                  <Tooltip formatter={(v) => [Number(v).toLocaleString(), s.unit]} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Global Yield Curves (US only — real data) ──
function GlobalYieldCurves() {
  const [yields, setYields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.yields();
        setYields(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (!loading && yields.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', marginBottom: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
        Yield curve data temporarily unavailable
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', boxShadow: 'var(--card-shadow)', marginBottom: '16px' }}>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>US Treasury Yield Curve</span>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: '140px' }} />
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={yields} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="maturity" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Yield']} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px' }} />
            <Line type="monotone" dataKey="yield" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: 'var(--gold)' }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Commodities Dashboard ──
function CommoditiesDashboard({ onItemClick }) {
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.commodities();
        setCommodities(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const grouped = {};
    commodities.forEach(c => {
      if (!grouped[c.category]) grouped[c.category] = [];
      grouped[c.category].push(c);
    });
    return grouped;
  }, [commodities]);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '16px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Commodities Dashboard</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '6px' }} />)}
        </div>
      ) : commodities.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Commodities data temporarily unavailable
        </div>
      ) : (
        <div style={{ padding: '12px' }}>
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '12px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{cat}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {items.map(c => {
                  const isPos = (c.changePercent || 0) >= 0;
                  return (
                    <div key={c.symbol} onClick={() => onItemClick && onItemClick(c)}
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', padding: '10px', cursor: 'pointer', transition: 'background 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 500, marginBottom: '4px' }}>{c.name}</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '2px' }}>
                        {c.price != null ? formatPrice(c.price) : '\u2014'}
                      </div>
                      <div style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                        {c.changePercent != null ? formatPercent(c.changePercent) : '\u2014'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Currency Strength Index ──
function CurrencyStrengthIndex({ onItemClick }) {
  const [forex, setForex] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.forex();
        setForex(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '16px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Currency Strength Index</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px' }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '28px', marginBottom: '6px' }} />)}</div>
      ) : forex.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Forex data temporarily unavailable
        </div>
      ) : (
        <div style={{ padding: '12px' }}>
          {forex.map((pair, i) => {
            const changePercent = pair.changesPercentage ?? pair.changePercent ?? null;
            const isPos = (changePercent ?? 0) >= 0;
            // Center bar at 50%, scale by change percent
            const barWidth = changePercent != null ? Math.max(0, Math.min(100, 50 + changePercent * 10)) : 50;
            const displayRate = pair.rate ?? pair.price;
            return (
              <div key={pair.ticker || pair.pair || pair.symbol || i}
                onClick={() => onItemClick && onItemClick(pair)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < forex.length - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', width: '80px' }}>{pair.ticker || pair.pair || pair.symbol}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', width: '70px', textAlign: 'right' }}>
                  {displayRate != null ? Number(displayRate).toFixed(4) : '\u2014'}
                </span>
                <div style={{ flex: 1, height: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', backgroundColor: 'var(--border-color)' }} />
                  <div style={{
                    position: 'absolute',
                    left: isPos ? '50%' : `${barWidth}%`,
                    width: `${Math.abs(barWidth - 50)}%`,
                    height: '100%',
                    backgroundColor: isPos ? 'var(--green)' : 'var(--red)',
                    borderRadius: '7px',
                    transition: 'all 300ms ease',
                  }} />
                </div>
                <span style={{ color: changePercent != null ? (isPos ? 'var(--green)' : 'var(--red)') : 'var(--text-tertiary)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', width: '60px', textAlign: 'right' }}>
                  {changePercent != null ? formatPercent(changePercent) : '\u2014'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Recent Economic Releases ──
function RecentEconomicReleases({ onRowClick }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Try dedicated FRED-based releases endpoint first
        let released = [];
        try {
          const fredResult = await api.economicReleases();
          if (Array.isArray(fredResult) && fredResult.length > 0) {
            console.log('[RecentEcon UI] FRED releases:', fredResult.length);
            released = fredResult.slice(0, 15);
          }
        } catch {}
        // Fallback to economic calendar endpoint
        if (released.length === 0) {
          const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
          const today = new Date().toISOString().split('T')[0];
          const result = await api.economicCalendar(fourteenDaysAgo, today);
          console.log('[RecentEcon UI] calendar received:', Array.isArray(result) ? `${result.length} events` : typeof result);
          released = (Array.isArray(result) ? result : [])
            .filter(e => e.actual != null && e.actual !== '' && e.date <= today)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 15);
        }
        setData(released);
      } catch (e) {
        console.error('[RecentEcon UI] fetch error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const fmtDate = (d) => {
    if (!d) return '\u2014';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const impactStyle = (impact) => {
    if (!impact) return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)', label: 'LOW' };
    const i = impact.toLowerCase();
    if (i === 'high') return { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'HIGH' };
    if (i === 'medium') return { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'MED' };
    return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)', label: 'LOW' };
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '16px' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Recent Economic Releases</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px' }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}</div>
      ) : data.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          No data for this period
        </div>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {data.map((evt, i) => {
            const imp = impactStyle(evt.impact);
            return (
              <div key={`${evt.event}-${evt.date}-${i}`}
                onClick={() => onRowClick && onRowClick(evt)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 100ms' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {evt.country && <span style={{ fontSize: '10px' }}>{evt.country}</span>}
                    <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.event}</span>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{fmtDate(evt.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--gold)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{evt.actual ?? '\u2014'}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: '4px' }}>
                      {evt.estimate != null ? `(est: ${evt.estimate})` : ''}
                    </span>
                  </div>
                  <span style={{ display: 'inline-block', padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: 700, backgroundColor: imp.bg, color: imp.color, letterSpacing: '0.04em' }}>
                    {imp.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Export sub-components for reuse in Dashboard
export { HeroBar, GlobalMarketsOverview, CentralBankTracker, M2MoneySupply, GlobalYieldCurves, CommoditiesDashboard, CurrencyStrengthIndex, RecentEconomicReleases };

// ── Main MacroPage Component ──
export default function MacroPage({ setActiveTab }) {
  const { setActiveSymbol } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailContent, setDetailContent] = useState(null);

  const handleSearch = (sym) => {
    setActiveSymbol(sym);
    setActiveTab('Analysis');
  };

  const openDetail = (title, content) => {
    setDetailTitle(title);
    setDetailContent(content);
    setDetailOpen(true);
  };

  const handleItemClick = (item) => {
    const symbol = item.symbol || item.ticker;
    const name = item.name || item.label || symbol;
    openDetail(name, (
      <div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', marginBottom: '4px' }}>
          {item.price != null ? formatPrice(item.price) : (item.rate != null ? Number(item.rate).toFixed(4) : '\u2014')}
        </div>
        {(item.changePercent ?? item.changesPercentage) != null && (
          <div style={{ color: (item.changePercent ?? item.changesPercentage) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', marginBottom: '16px' }}>
            {formatPercent(item.changePercent ?? item.changesPercentage)}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          {Object.entries(item).filter(([k]) => !['symbol', 'label', 'price', 'change', 'changePercent', 'changesPercentage'].includes(k)).map(([k, v]) => (
            v != null && (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{typeof v === 'number' ? v.toLocaleString() : String(v)}</span>
              </div>
            )
          ))}
        </div>
        {symbol && (
          <button onClick={() => { setActiveSymbol(symbol); setActiveTab('Analysis'); setDetailOpen(false); }}
            style={{ marginTop: '16px', width: '100%', padding: '10px', backgroundColor: 'var(--gold)', color: 'var(--bg-primary)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            View Full Analysis
          </button>
        )}
      </div>
    ));
  };

  return (
    <div className="page-fade-in">
      {/* Header + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
            Global Macro Terminal
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            Real-time global market intelligence
          </p>
        </div>
        <SearchBar onSelect={handleSearch} />
      </div>

      {/* Hero scrolling ticker */}
      <HeroBar onItemClick={handleItemClick} />

      {/* Global Markets */}
      <GlobalMarketsOverview onRowClick={handleItemClick} />

      {/* Central Banks + M2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '0' }}>
        <CentralBankTracker onRowClick={handleItemClick} />
        <M2MoneySupply />
      </div>

      {/* Yield Curve */}
      <GlobalYieldCurves />

      {/* Commodities + Currency */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '0' }}>
        <CommoditiesDashboard onItemClick={handleItemClick} />
        <CurrencyStrengthIndex onItemClick={handleItemClick} />
      </div>

      {/* Recent Economic Releases */}
      <RecentEconomicReleases onRowClick={handleItemClick} />

      {/* Detail Panel */}
      <DetailPanel open={detailOpen} onClose={() => setDetailOpen(false)} title={detailTitle}>
        {detailContent}
      </DetailPanel>
    </div>
  );
}
