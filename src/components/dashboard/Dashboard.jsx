import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  getSectorPerformance, getEconomicCalendar,
  getGainers, getLosers, getActives, getEarningsCalendar, getMacroData,
} from '../../services/fmp';
import { api } from '../../services/api';
import { formatPrice, formatPercent, formatDate, formatVolume, formatTimeAgo } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';
import { ExternalLink } from 'lucide-react';
import {
  GlobalMarketsOverview, CentralBankTracker, M2MoneySupply,
  CommoditiesDashboard, CurrencyStrengthIndex, RecentEconomicReleases,
} from '../terminal/MacroPage';
import DetailPanel from '../ui/DetailPanel';
import HeatmapCard from './HeatmapCard';

// ── Unified Market Snapshot ──
const SNAPSHOT_GROUPS = [
  {
    label: 'US INDICES',
    items: [
      { symbol: 'SPY', label: 'S&P 500' },
      { symbol: 'QQQ', label: 'NASDAQ 100' },
      { symbol: 'DIA', label: 'Dow Jones' },
      { symbol: 'IWM', label: 'Russell 2000' },
      { symbol: '^VIX', label: 'VIX' },
    ],
  },
  {
    label: 'COMMODITIES',
    items: [
      { symbol: 'GC=F', label: 'Gold' },
      { symbol: 'CL=F', label: 'WTI Oil' },
      { symbol: 'BZ=F', label: 'Brent Crude' },
      { symbol: 'SI=F', label: 'Silver' },
      { symbol: 'NG=F', label: 'Nat Gas' },
    ],
  },
  {
    label: 'DIGITAL ASSETS',
    items: [
      { symbol: 'BTC-USD', label: 'Bitcoin' },
      { symbol: 'ETH-USD', label: 'Ethereum' },
      { symbol: 'SOL-USD', label: 'Solana' },
      { symbol: 'XRP-USD', label: 'XRP' },
      { symbol: 'ADA-USD', label: 'Cardano' },
    ],
  },
];

function MarketSnapshot() {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getMacroData();
        if (Array.isArray(result)) {
          const map = {};
          result.forEach(item => { map[item.symbol] = item; });
          setPrices(map);
        }
      } catch (e) {
        console.error('MarketSnapshot error:', e);
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const renderColumn = (group) => (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{group.label}</span>
      </div>
      {loading ? (
        <div style={{ padding: '10px' }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}
        </div>
      ) : (
        <div>
          {group.items.map((item) => {
            const d = prices[item.symbol];
            const pct = d?.changePercent ?? d?.changesPercentage ?? null;
            const isPos = (pct || 0) >= 0;
            return (
              <div
                key={item.symbol}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer', transition: 'background 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ color: 'var(--gold)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{item.symbol}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: '8px' }}>{item.label}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>
                    {d?.price != null ? formatPrice(d.price) : '\u2014'}
                  </span>
                  <span style={{ color: pct != null ? (isPos ? 'var(--green)' : 'var(--red)') : 'var(--text-tertiary)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', minWidth: '55px', textAlign: 'right' }}>
                    {pct != null ? formatPercent(pct) : '\u2014'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
      {SNAPSHOT_GROUPS.map(group => (
        <React.Fragment key={group.label}>
          {renderColumn(group)}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Index Performance Panel ──
function IndexPerformancePanel() {
  const INDICES = [
    { symbol: 'SPY', label: 'S&P 500', color: '#F0A500' },
    { symbol: 'QQQ', label: 'NASDAQ 100', color: '#3B82F6' },
    { symbol: 'DIA', label: 'Dow Jones', color: '#22C55E' },
    { symbol: 'IWM', label: 'Russell 2000', color: '#A855F7' },
  ];

  const [selected, setSelected] = useState(['SPY', 'QQQ', 'DIA', 'IWM']);
  const [timeframe, setTimeframe] = useState('1M');
  const [chartData, setChartData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const results = {};
      const fetches = await Promise.allSettled(
        INDICES.map(idx => api.chart(idx.symbol, timeframe))
      );
      INDICES.forEach((idx, i) => {
        if (fetches[i].status === 'fulfilled') {
          results[idx.symbol] = fetches[i].value;
        }
      });
      setChartData(results);
      setLoading(false);
    })();
  }, [timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedData = useMemo(() => {
    if (Object.keys(chartData).length === 0) return [];
    // Find the longest array for timestamps
    let longestKey = null;
    let longestLen = 0;
    for (const sym of selected) {
      const arr = chartData[sym];
      if (arr && arr.length > longestLen) {
        longestLen = arr.length;
        longestKey = sym;
      }
    }
    if (!longestKey) return [];

    const base = chartData[longestKey];
    return base.map((bar, i) => {
      const point = { t: bar.t };
      for (const sym of selected) {
        const arr = chartData[sym];
        if (arr && arr[0] && arr[i]) {
          const first = arr[0].c;
          point[sym] = first ? ((arr[i].c - first) / first) * 100 : 0;
        }
      }
      return point;
    });
  }, [chartData, selected]);

  const toggleIndex = (sym) => {
    setSelected(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const timeframes = ['1W', '1M', '3M', '1Y'];

  // Get latest quotes for the index cards
  const latestQuotes = useMemo(() => {
    const quotes = {};
    INDICES.forEach(idx => {
      const arr = chartData[idx.symbol];
      if (arr && arr.length > 0) {
        const last = arr[arr.length - 1];
        const first = arr[0];
        quotes[idx.symbol] = {
          price: last.c,
          changePct: first.c ? ((last.c - first.c) / first.c) * 100 : 0,
        };
      }
    });
    return quotes;
  }, [chartData]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Index Performance</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {timeframes.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              background: timeframe === tf ? 'var(--bg-tertiary)' : 'none',
              border: '1px solid', borderColor: timeframe === tf ? 'var(--gold)' : 'var(--border-color)',
              color: timeframe === tf ? 'var(--gold)' : 'var(--text-secondary)',
              fontSize: '10px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
            }}>{tf}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0' }}>
        {/* Left: Chart 65% */}
        <div style={{ flex: '0 0 65%', padding: '12px', borderRight: '1px solid var(--border-color)' }}>
          {/* Toggle buttons */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {INDICES.map(idx => {
              const isActive = selected.includes(idx.symbol);
              const lastVal = normalizedData.length > 0 ? normalizedData[normalizedData.length - 1]?.[idx.symbol] : null;
              return (
                <button key={idx.symbol} onClick={() => toggleIndex(idx.symbol)} style={{
                  background: isActive ? idx.color + '22' : 'none',
                  border: `1px solid ${isActive ? idx.color : 'var(--border-color)'}`,
                  color: isActive ? idx.color : 'var(--text-tertiary)',
                  fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                }}>
                  {idx.label} {lastVal != null ? `${lastVal >= 0 ? '+' : ''}${lastVal.toFixed(2)}%` : ''}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: '280px' }} />
          ) : normalizedData.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={normalizedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => { const d = new Date(v); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }}
                  interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`}
                  axisLine={false} tickLine={false} width={48} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px' }}>
                    {payload.map(p => (
                      <div key={p.dataKey} style={{ color: p.color }}>{p.dataKey}: {Number(p.value).toFixed(2)}%</div>
                    ))}
                  </div>
                );
              }} />
              {INDICES.filter(idx => selected.includes(idx.symbol)).map(idx => (
                <Line key={idx.symbol} type="monotone" dataKey={idx.symbol} stroke={idx.color} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        </div>

        {/* Right: Index Cards 35% */}
        <div style={{ flex: '0 0 35%', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
          {INDICES.map(idx => {
            const q = latestQuotes[idx.symbol];
            const pct = q?.changePct ?? 0;
            const isPos = pct >= 0;
            return (
              <div key={idx.symbol} onClick={() => toggleIndex(idx.symbol)} style={{
                backgroundColor: selected.includes(idx.symbol) ? idx.color + '12' : 'var(--bg-primary)',
                border: `1px solid ${selected.includes(idx.symbol) ? idx.color + '44' : 'var(--border-color)'}`,
                borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', transition: 'all 150ms ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ color: idx.color, fontSize: '11px', fontWeight: 600 }}>{idx.label}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', fontFamily: 'monospace' }}>{idx.symbol}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                    {q?.price != null ? formatPrice(q.price) : '\u2014'}
                  </span>
                  <span style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {isPos ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Yield Curve Panel ──
function YieldCurvePanel() {
  const [yields, setYields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.yields();
        setYields(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Yield curve error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const is2Y = yields.find(y => y.maturity === '2Y');
  const is10Y = yields.find(y => y.maturity === '10Y');
  const inverted = is2Y && is10Y && is2Y.yield > is10Y.yield;

  // Calculate tight Y axis domain
  const yDomain = useMemo(() => {
    if (yields.length === 0) return [0, 8];
    const vals = yields.map(y => y.yield).filter(v => v != null);
    const minY = Math.min(...vals);
    const maxY = Math.max(...vals);
    return [Math.max(0, minY - 0.5), maxY + 0.5];
  }, [yields]);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Yield Curve
        </span>
        {!loading && yields.length > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
            color: inverted ? 'var(--red)' : 'var(--green)',
          }}>
            {inverted ? 'INVERTED' : 'NORMAL'}
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '16px' }}>
          <div className="skeleton" style={{ height: '120px', marginBottom: '8px' }} />
        </div>
      ) : yields.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No yield data available.</p>
      ) : (
        <div style={{ padding: '12px' }}>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={yields} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="maturity" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={yDomain} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px' }}>
                    <div style={{ color: 'var(--text-primary)' }}>{d.maturity}: {d.yield?.toFixed(3)}%</div>
                  </div>
                );
              }} />
              <Line type="monotone" dataKey="yield" stroke={inverted ? 'var(--red)' : 'var(--gold)'} strokeWidth={2} dot={{ fill: inverted ? 'var(--red)' : 'var(--gold)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '8px' }}>
            {yields.map(y => (
              <div key={y.maturity} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{y.maturity}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'monospace' }}>{y.yield?.toFixed(3)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fear & Greed Multi-Indicator Panel ──
function FearGreedPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredIndicator, setHoveredIndicator] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.fearGreed();
        setData(result);
      } catch (e) {
        console.error('Fear & Greed error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const getLabel = (score) => {
    if (score <= 25) return { text: 'EXTREME FEAR', color: '#ef4444' };
    if (score <= 45) return { text: 'FEAR', color: '#f97316' };
    if (score <= 55) return { text: 'NEUTRAL', color: '#eab308' };
    if (score <= 75) return { text: 'GREED', color: '#22c55e' };
    return { text: 'EXTREME GREED', color: '#16a34a' };
  };

  const getBarColor = (score) => {
    if (score <= 25) return '#ef4444';
    if (score <= 45) return '#f97316';
    if (score <= 55) return '#eab308';
    if (score <= 75) return '#22c55e';
    return '#16a34a';
  };

  const INDICATOR_TOOLTIPS = {
    stock_price_strength: 'Compares S&P 500 to its 125-day moving average. Above average = greed.',
    stock_price_breadth: 'Measures NYSE advancing vs declining volume. More advancers = greed.',
    market_momentum: 'Compares S&P 500 to its 125-day moving average. Above average = greed.',
    put_call_options: 'High put buying relative to calls signals fear. Low put buying signals greed.',
    junk_bond_demand: 'Investors accepting lower yields on junk bonds signals greed (risk appetite).',
    market_volatility: 'VIX measures expected S&P 500 volatility. High VIX = fear.',
    safe_haven_demand: 'Stocks outperforming Treasury bonds signals greed.',
  };

  const INDICATOR_LABELS = {
    stock_price_strength: 'Market Momentum',
    stock_price_breadth: 'Stock Breadth',
    market_momentum: 'Strength',
    put_call_options: 'Put/Call Ratio',
    junk_bond_demand: 'Junk Bond Demand',
    market_volatility: 'Volatility',
    safe_haven_demand: 'Safe Haven',
  };

  const overallScore = data?.fear_and_greed?.score ?? data?.score ?? null;
  const overallLabel = overallScore != null ? getLabel(overallScore) : null;
  const previousClose = data?.fear_and_greed?.previous_close ?? null;
  const lastUpdated = data?.fear_and_greed?.previous_1_month_date ?? null;

  const indicators = [];
  if (data) {
    const keys = [
      { key: 'stock_price_strength', abbr: 'MOMO' },
      { key: 'stock_price_breadth', abbr: 'BRDTH' },
      { key: 'put_call_options', abbr: 'PCR' },
      { key: 'junk_bond_demand', abbr: 'JUNK' },
      { key: 'safe_haven_demand', abbr: 'SAFE' },
    ];
    for (const k of keys) {
      const val = data[k.key];
      if (val && val.score != null) {
        indicators.push({ ...k, score: val.score, rating: val.rating, name: INDICATOR_LABELS[k.key] || k.key });
      }
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Fear & Greed Index</span>
      </div>
      {loading ? (
        <div style={{ padding: '16px' }}>
          <div className="skeleton" style={{ height: '48px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ height: '80px' }} />
        </div>
      ) : overallScore == null ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Unavailable</p>
      ) : (
        <div style={{ padding: '16px' }}>
          {/* Overall score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'monospace', color: overallLabel.color, lineHeight: 1 }}>
              {Math.round(overallScore)}
            </span>
            <div>
              <div style={{ color: overallLabel.color, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em' }}>{overallLabel.text}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                Overall Index{previousClose != null ? ` | Prev: ${Math.round(previousClose)}` : ''}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #16a34a)', position: 'relative', marginBottom: '0' }}>
            <div style={{
              position: 'absolute', top: '50%', left: `${overallScore}%`, transform: 'translate(-50%, -50%)',
              width: '14px', height: '14px', borderRadius: '50%', backgroundColor: overallLabel.color,
              border: '2px solid var(--bg-secondary)', boxShadow: '0 0 4px rgba(0,0,0,0.3)',
            }} />
          </div>

          {/* Sub-indicators */}
          {indicators.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', marginBottom: '12px' }}>
              {indicators.map(ind => (
                <div key={ind.key} style={{ flex: 1, textAlign: 'center', position: 'relative', cursor: 'help' }}
                  onMouseEnter={() => setHoveredIndicator(ind.key)}
                  onMouseLeave={() => setHoveredIndicator(null)}
                >
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '2px' }}>{ind.abbr}</div>
                  <div style={{ height: '60px', position: 'relative', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${ind.score}%`,
                      backgroundColor: getBarColor(ind.score),
                      borderRadius: '3px',
                      transition: 'height 600ms ease',
                    }} />
                  </div>
                  <div style={{ color: getBarColor(ind.score), fontSize: '8px', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ind.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace', fontWeight: 600, marginTop: '2px' }}>{Math.round(ind.score)}</div>

                  {/* Hover tooltip */}
                  {hoveredIndicator === ind.key && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                      backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: '6px', padding: '8px 10px', fontSize: '10px', color: 'var(--text-secondary)',
                      width: '180px', textAlign: 'left', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      marginBottom: '4px', lineHeight: 1.4,
                    }}>
                      {INDICATOR_TOOLTIPS[ind.key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Score scale legend */}
          <div style={{ display: 'flex', gap: '2px', fontSize: '8px', fontWeight: 600, letterSpacing: '0.04em', marginTop: '4px' }}>
            <span style={{ flex: 1, textAlign: 'center', padding: '3px 0', backgroundColor: '#ef444422', color: '#ef4444', borderRadius: '2px' }}>0-25 Extreme Fear</span>
            <span style={{ flex: 1, textAlign: 'center', padding: '3px 0', backgroundColor: '#f9731622', color: '#f97316', borderRadius: '2px' }}>25-45 Fear</span>
            <span style={{ flex: 1, textAlign: 'center', padding: '3px 0', backgroundColor: '#eab30822', color: '#eab308', borderRadius: '2px' }}>45-55 Neutral</span>
            <span style={{ flex: 1, textAlign: 'center', padding: '3px 0', backgroundColor: '#22c55e22', color: '#22c55e', borderRadius: '2px' }}>55-75 Greed</span>
            <span style={{ flex: 1, textAlign: 'center', padding: '3px 0', backgroundColor: '#16a34a22', color: '#16a34a', borderRadius: '2px' }}>75-100 Extreme</span>
          </div>

          {lastUpdated && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', textAlign: 'right', marginTop: '6px' }}>
              Last updated: {formatDate(lastUpdated)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Global Markets Grid ──
// ── Top Movers (with Volume on Most Active) ──
function TopMovers({ onNavigate }) {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [actives, setActives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [g, l, a] = await Promise.all([getGainers(), getLosers(), getActives()]);
        setGainers((g || []).slice(0, 5));
        setLosers((l || []).slice(0, 5));
        setActives((a || []).slice(0, 5));
      } catch (e) {
        console.error('TopMovers error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const renderColumn = (title, items, showVolume = false) => (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {loading ? (
        <div style={{ padding: '10px' }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}
        </div>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No data</p>
      ) : (
        <div>
          {items.map((item, i) => {
            const pct = item.changesPercentage;
            const isPos = (pct || 0) >= 0;
            return (
              <div
                key={item.symbol || i}
                onClick={() => onNavigate(item.symbol)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer', transition: 'background 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ color: 'var(--gold)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{item.symbol}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: '8px' }}>{(item.name || '').slice(0, 20)}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{formatPrice(item.price)}</span>
                  <span style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', minWidth: '55px', textAlign: 'right' }}>
                    {formatPercent(pct)}
                  </span>
                  {showVolume && item.volume != null && (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontFamily: 'monospace', minWidth: '48px', textAlign: 'right' }}>
                      {formatVolume(item.volume)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '0' }}>
      {renderColumn('Top Gainers', gainers)}
      {renderColumn('Top Losers', losers)}
      {renderColumn('Most Active', actives, true)}
    </div>
  );
}

// ── Section 3: Sector Heatmap ──
function SectorHeatmap() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSectorPerformance();
        setSectors(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('SectorHeatmap error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const getColor = (pct) => {
    const val = parseFloat(pct);
    if (isNaN(val)) return 'var(--bg-tertiary)';
    if (val > 0) return '#14532d';
    if (val < 0) return '#7f1d1d';
    return '#374151';
  };

  // Ensure we have 12 sectors for a clean 4×3 grid
  const displaySectors = useMemo(() => {
    const list = [...sectors];
    const names = list.map(s => (s.sector || '').toLowerCase());
    if (!names.some(n => n.includes('real estate'))) {
      list.push({ sector: 'Real Estate', changesPercentage: 0 });
    }
    if (list.length < 12 && !names.some(n => n.includes('transportation'))) {
      list.push({ sector: 'Transportation', changesPercentage: 0 });
    }
    return list.slice(0, 12);
  }, [sectors]);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sector Performance</span>
      </div>
      <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '6px' }} />)
        ) : displaySectors.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', gridColumn: '1 / -1', textAlign: 'center', padding: '16px' }}>No sector data available.</p>
        ) : displaySectors.map((s, i) => {
          const pctNum = typeof s.changesPercentage === 'number' ? s.changesPercentage : parseFloat(s.changesPercentage || '0');
          return (
            <div key={i} style={{ backgroundColor: getColor(pctNum), borderRadius: '6px', padding: '12px', height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
              <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 600 }}>{(s.sector || '').replace(/_/g, ' ')}</span>
              <span style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>
                {pctNum >= 0 ? '+' : ''}{pctNum.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Inline Article Preview (expandable dropdown under each news item) ──
function InlineArticlePreview({ url }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    api.article(url).then(data => {
      setArticle(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [url]);

  return (
    <div style={{
      padding: '12px 14px',
      backgroundColor: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      {loading ? (
        <div>
          <div className="skeleton" style={{ height: '12px', width: '90%', marginBottom: '6px' }} />
          <div className="skeleton" style={{ height: '12px', width: '70%', marginBottom: '6px' }} />
          <div className="skeleton" style={{ height: '12px', width: '50%' }} />
        </div>
      ) : article ? (
        <>
          {article.image && (
            <img src={article.image} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
              onError={e => e.target.style.display = 'none'} />
          )}
          {article.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '0 0 8px', lineHeight: 1.5 }}>
              {article.description}
            </p>
          )}
          {article.text && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: 1.5, margin: '0 0 8px', maxHeight: '120px', overflow: 'hidden' }}>
              {article.text.slice(0, 500)}{article.text.length > 500 ? '\u2026' : ''}
            </p>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--gold)', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
            Read Full Article <ExternalLink size={10} />
          </a>
        </>
      ) : (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', margin: 0 }}>Could not load preview.</p>
      )}
    </div>
  );
}

// ── News + Earnings This Week ──
function NewsAndEarnings({ onNavigate }) {
  const [news, setNews] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.generalNews();
        setNews(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('News error:', e);
      }
      setNewsLoading(false);
    })();
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const data = await getEarningsCalendar(today, thirtyDays);
        setEarnings(Array.isArray(data) ? data.slice(0, 15) : []);
      } catch (e) {
        console.error('Earnings error:', e);
      }
      setEarningsLoading(false);
    })();
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60fr 40fr', gap: '12px', marginBottom: '0' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Market News</span>
        </div>
        {newsLoading ? (
          <div style={{ padding: '12px' }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '48px', marginBottom: '8px' }} />)}
          </div>
        ) : news.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No news available.</p>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {news.map((item, i) => (
              <div key={i}>
                <div
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  style={{ display: 'block', padding: '10px 14px', borderBottom: expandedIdx === i ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms ease', backgroundColor: expandedIdx === i ? 'var(--bg-tertiary)' : 'transparent' }}
                  onMouseEnter={e => { if (expandedIdx !== i) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (expandedIdx !== i) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, marginBottom: '4px', lineHeight: 1.4 }}>{item.title}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                    {item.site || item.source} {'\u00B7'} {formatTimeAgo(item.publishedDate || item.date)}
                  </div>
                </div>
                {expandedIdx === i && <InlineArticlePreview url={item.url} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Upcoming Earnings</span>
        </div>
        {earningsLoading ? (
          <div style={{ padding: '12px' }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}
          </div>
        ) : earnings.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No upcoming earnings found.</p>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {earnings.map((row, i) => (
              <div key={`${row.symbol}-${i}`} onClick={() => onNavigate(row.symbol)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ color: 'var(--gold)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{row.symbol}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: '8px' }}>{formatDate(row.date)}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace' }}>
                  {row.epsEstimate != null ? `Est: $${Number(row.epsEstimate).toFixed(2)}` : row.epsEstimated != null ? `Est: $${Number(row.epsEstimated).toFixed(2)}` : '\u2014'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Economic Calendar ──
function EconomicCalendarPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const data = await getEconomicCalendar(today, thirtyDays);
        setEvents(Array.isArray(data) ? data.slice(0, 50) : []);
      } catch (e) {
        console.error('Economic calendar error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const impactColor = (impact) => {
    if (!impact) return { bg: '#1E2A3E', color: '#8A95A3', label: 'Low' };
    const i = impact.toLowerCase();
    if (i === 'high') return { bg: '#2D0A0A', color: '#EF4444', label: 'High' };
    if (i === 'medium') return { bg: '#2D1A00', color: '#F59E0B', label: 'Med' };
    return { bg: '#1E2A3E', color: '#8A95A3', label: 'Low' };
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Economic Calendar</span>
      </div>
      {loading ? (
        <div style={{ padding: '16px' }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '28px', width: '100%', marginBottom: '4px' }} />)}
        </div>
      ) : events.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>No upcoming events.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                {['Date', 'Time', 'Event', 'Country', 'Impact', 'Estimate', 'Previous', 'Actual'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Event' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const imp = impactColor(ev.impact);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(ev.date)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: '10px' }}>{ev.time || '\u2014'}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-primary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.event || '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ev.country || '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, backgroundColor: imp.bg, color: imp.color }}>{imp.label}</span>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{ev.estimate ?? '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{ev.previous ?? '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{ev.actual ?? '\u2014'}</td>
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

// ── IPO Calendar Panel ──
function IPOCalendarPanel() {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.ipos();
        setIpos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('IPO error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const displayIpos = expanded ? ipos : ipos.slice(0, 10);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Upcoming IPOs</span>
        {!loading && ipos.length > 0 && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{ipos.length} total</span>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '12px' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '28px', marginBottom: '4px' }} />)}
        </div>
      ) : ipos.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No upcoming IPOs this period.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {['Company', 'Ticker', 'Exchange', 'Date', 'Price Range', 'Shares'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Company' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayIpos.map((ipo, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ipo.company || ipo.name || '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>{ipo.symbol || '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ipo.exchange || '\u2014'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(ipo.date)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {ipo.priceRange || (ipo.price ? `$${ipo.price}` : '\u2014')}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {ipo.sharesOffered ? formatVolume(ipo.sharesOffered) : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ipos.length > 10 && (
            <div style={{ padding: '10px 14px', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
              <button onClick={() => setExpanded(!expanded)} style={{
                background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px',
                color: 'var(--gold)', fontSize: '11px', fontWeight: 600, padding: '5px 16px',
                cursor: 'pointer', transition: 'all 150ms ease',
              }}>
                {expanded ? 'Show Less' : `Show All ${ipos.length} IPOs`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Forex Rates Panel ──
function ForexPanel() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.forex();
        setPairs(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Forex error:', e);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Currency Exchange Rates</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '6px' }} />)}
        </div>
      ) : pairs.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No forex data.</p>
      ) : (
        <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {pairs.map((p, i) => {
            const isPos = (p.changePercent || 0) >= 0;
            return (
              <div key={i} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>{p.pair}</div>
                <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>
                  {p.rate != null ? p.rate.toFixed(4) : '\u2014'}
                </div>
                <div style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                  {p.changePercent != null ? formatPercent(p.changePercent) : '\u2014'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Most Shorted Stocks Panel ──
function MostShortedPanel({ onNavigate }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.shorts();
        setStocks(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Shorts error:', e);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Most Shorted</span>
      </div>
      {loading ? (
        <div style={{ padding: '10px' }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}
        </div>
      ) : stocks.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No data</p>
      ) : (
        <div>
          {stocks.slice(0, 8).map((s, i) => {
            const pct = s.changePercent ?? 0;
            const isPos = pct >= 0;
            return (
              <div key={s.ticker || i} onClick={() => onNavigate(s.ticker)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ color: 'var(--gold)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{s.ticker}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: '8px' }}>{(s.name || '').slice(0, 20)}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{formatPrice(s.price)}</span>
                  <span style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {formatPercent(pct)}
                  </span>
                  {s.shortPercentOfFloat != null && (
                    <span style={{ color: '#A855F7', fontSize: '10px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {(s.shortPercentOfFloat * 100).toFixed(1)}%
                    </span>
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

// ── AI Daily Brief ──
function AIDailyBrief() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.dailyBrief();
        if (data?.brief) {
          setBrief(data);
        } else if (data?.message) {
          setError(data.message);
        }
      } catch {
        setError('Failed to load daily brief');
      }
      setLoading(false);
    })();
  }, []);

  // Hide entirely if API key not configured
  if (!loading && error && (error.toLowerCase().includes('api key') || error.toLowerCase().includes('unavailable'))) return null;
  // Hide if no data and not loading
  if (!loading && !brief?.brief && !error) return null;

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: brief?.brief ? '1px solid var(--border-color)' : 'none' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>AI Market Daily Brief</span>
        {brief?.generatedAt && <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>{new Date(brief.generatedAt).toLocaleTimeString()}</span>}
      </div>
      {loading ? (
        <div style={{ padding: '8px 14px' }}>
          <div className="skeleton" style={{ height: '12px', width: '90%' }} />
        </div>
      ) : brief?.brief ? (
        <div style={{ padding: '12px 14px' }}>
          {brief.brief.split('\n\n').map((p, i) => (
            <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, margin: i === 0 ? 0 : '10px 0 0' }}>{p}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Insider Trading Feed ──
function InsiderTradingFeed({ onNavigate }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.insiderTradingFeed();
        if (Array.isArray(data)) {
          setTrades(data.slice(0, 15));
        } else if (data?.data) {
          setTrades([]);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Insider Trading Feed</span>
      </div>
      {loading ? (
        <div style={{ padding: '12px' }}>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '32px', marginBottom: '4px' }} />)}</div>
      ) : trades.length === 0 ? (
        <div style={{ padding: '12px 14px', color: 'var(--text-tertiary)', fontSize: '11px' }}>No recent insider activity.</div>
      ) : (
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {trades.map((t, i) => {
            const isBuy = (t.transactionType || '').toLowerCase().includes('buy') || (t.transactionType || '').toLowerCase().includes('purchase');
            return (
              <div key={`${t.symbol}-${t.date}-${i}`}
                onClick={() => onNavigate && onNavigate(t.symbol)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 100ms' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <span style={{ color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>{t.symbol}</span>
                  <span style={{ color: isBuy ? 'var(--green)' : 'var(--red)', fontSize: '10px', fontWeight: 600, marginLeft: '8px', textTransform: 'uppercase' }}>
                    {t.transactionType || 'N/A'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {t.value != null ? `$${Number(t.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '\u2014'}
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{t.owner}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Global Exchange Status ──
function GlobalExchangeStatus() {
  const EXCHANGES = [
    { name: 'NYSE', city: 'New York', tz: 'America/New_York', open: '09:30', close: '16:00', flag: '\ud83c\uddfa\ud83c\uddf8' },
    { name: 'NASDAQ', city: 'New York', tz: 'America/New_York', open: '09:30', close: '16:00', flag: '\ud83c\uddfa\ud83c\uddf8' },
    { name: 'LSE', city: 'London', tz: 'Europe/London', open: '08:00', close: '16:30', flag: '\ud83c\uddec\ud83c\udde7' },
    { name: 'Euronext', city: 'Paris', tz: 'Europe/Paris', open: '09:00', close: '17:30', flag: '\ud83c\uddeb\ud83c\uddf7' },
    { name: 'FSE', city: 'Frankfurt', tz: 'Europe/Berlin', open: '09:00', close: '17:30', flag: '\ud83c\udde9\ud83c\uddea' },
    { name: 'TSE', city: 'Tokyo', tz: 'Asia/Tokyo', open: '09:00', close: '15:00', flag: '\ud83c\uddef\ud83c\uddf5' },
    { name: 'SSE', city: 'Shanghai', tz: 'Asia/Shanghai', open: '09:30', close: '15:00', flag: '\ud83c\udde8\ud83c\uddf3' },
    { name: 'BSE', city: 'Mumbai', tz: 'Asia/Kolkata', open: '09:15', close: '15:30', flag: '\ud83c\uddee\ud83c\uddf3' },
    { name: 'ASX', city: 'Sydney', tz: 'Australia/Sydney', open: '10:00', close: '16:00', flag: '\ud83c\udde6\ud83c\uddfa' },
    { name: 'TSX', city: 'Toronto', tz: 'America/Toronto', open: '09:30', close: '16:00', flag: '\ud83c\udde8\ud83c\udde6' },
    { name: 'KOSPI', city: 'Seoul', tz: 'Asia/Seoul', open: '09:00', close: '15:30', flag: '\ud83c\uddf0\ud83c\uddf7' },
    { name: 'B3', city: 'São Paulo', tz: 'America/Sao_Paulo', open: '10:00', close: '17:00', flag: '\ud83c\udde7\ud83c\uddf7' },
    { name: 'SGX', city: 'Singapore', tz: 'Asia/Singapore', open: '09:00', close: '17:00', flag: '\ud83c\uddf8\ud83c\uddec' },
    { name: 'JSE', city: 'Johannesburg', tz: 'Africa/Johannesburg', open: '09:00', close: '17:00', flag: '\ud83c\uddff\ud83c\udde6' },
  ];

  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatus = (exchange) => {
    const now = new Date();
    const localStr = now.toLocaleString('en-US', { timeZone: exchange.tz });
    const local = new Date(localStr);
    const day = local.getDay();
    if (day === 0 || day === 6) return { status: 'CLOSED', color: 'var(--red)' };
    const [openH, openM] = exchange.open.split(':').map(Number);
    const [closeH, closeM] = exchange.close.split(':').map(Number);
    const mins = local.getHours() * 60 + local.getMinutes();
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;
    if (mins >= openMins && mins < closeMins) return { status: 'OPEN', color: 'var(--green)' };
    if (mins >= openMins - 60 && mins < openMins) return { status: 'PRE-MARKET', color: '#F59E0B' };
    return { status: 'CLOSED', color: 'var(--red)' };
  };

  const getLocalTime = (tz) => {
    return new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Global Exchange Status</span>
      </div>
      <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {EXCHANGES.map(ex => {
          const { status, color } = getStatus(ex);
          return (
            <div key={ex.name} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{ex.flag} {ex.name}</span>
                <span style={{ color, fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em' }}>{status}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{ex.city} &middot; {getLocalTime(ex.tz)}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', marginTop: '2px' }}>
                {ex.open} &ndash; {ex.close}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard ──
export default function Dashboard({ setActiveTab }) {
  const { setActiveSymbol } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailContent, setDetailContent] = useState(null);

  const handleNavigate = (sym) => {
    setActiveSymbol(sym);
    setActiveTab('Analysis');
  };

  const handleItemClick = (item) => {
    const symbol = item.symbol || item.ticker;
    const name = item.name || item.label || symbol;
    setDetailTitle(name);
    setDetailContent(
      <div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', marginBottom: '4px' }}>
          {item.price != null ? `$${Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (item.rate != null ? Number(item.rate).toFixed(4) : '\u2014')}
        </div>
        {(item.changePercent ?? item.changesPercentage) != null && (
          <div style={{ color: (item.changePercent ?? item.changesPercentage) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', marginBottom: '0' }}>
            {formatPercent(item.changePercent ?? item.changesPercentage)}
          </div>
        )}
        {symbol && (
          <button onClick={() => { setActiveSymbol(symbol); setActiveTab('Analysis'); setDetailOpen(false); }}
            style={{ marginTop: '12px', width: '100%', padding: '10px', backgroundColor: 'var(--gold)', color: 'var(--bg-primary)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            View Full Analysis
          </button>
        )}
      </div>
    );
    setDetailOpen(true);
  };

  return (
    <div className="page-fade-in" style={{ paddingTop: '12px' }}>
      <div style={{ marginBottom: '8px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
          Market Intelligence
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          Real-time market overview, movers, sectors, and economic events
        </p>
      </div>

      <AIDailyBrief />

      <IndexPerformancePanel />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <YieldCurvePanel />
        <FearGreedPanel />
      </div>

      <div style={{ marginTop: '12px' }}>
        <TopMovers onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <MarketSnapshot />
      </div>

      <div style={{ marginTop: '12px', width: '100%' }}>
        <HeatmapCard />
      </div>

      <div style={{ marginTop: '12px' }}>
        <SectorHeatmap />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <ForexPanel />
        <CurrencyStrengthIndex onItemClick={handleItemClick} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <MostShortedPanel onNavigate={handleNavigate} />
        <CommoditiesDashboard onItemClick={handleItemClick} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <GlobalExchangeStatus />
      </div>

      <div style={{ marginTop: '12px' }}>
        <GlobalMarketsOverview onRowClick={handleItemClick} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <CentralBankTracker onRowClick={handleItemClick} />
        <M2MoneySupply />
      </div>

      <div style={{ marginTop: '12px' }}>
        <InsiderTradingFeed onNavigate={handleNavigate} />
      </div>
      <div style={{ marginTop: '12px' }}>
        <NewsAndEarnings onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <RecentEconomicReleases onRowClick={handleItemClick} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <IPOCalendarPanel />
        <EconomicCalendarPanel />
      </div>

      {/* Detail Panel */}
      <DetailPanel open={detailOpen} onClose={() => setDetailOpen(false)} title={detailTitle}>
        {detailContent}
      </DetailPanel>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 900px) {
          div[style*="60fr 40fr"] { grid-template-columns: 1fr !important; }
          div[style*="repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
          div[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
