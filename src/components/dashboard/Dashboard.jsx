import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import {
  getSectorPerformance, getEconomicCalendar,
  getGainers, getLosers, getActives, getEarningsCalendar, getMacroData,
} from '../../services/fmp';
import { api } from '../../services/api';
import { formatPrice, formatPercent, formatDate, formatVolume, formatTimeAgo } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { ExternalLink, Maximize2, Minimize2, Plus, X } from 'lucide-react';
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

function MarketSnapshot({ onNavigate }) {
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
                onClick={() => onNavigate && onNavigate(item.symbol)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer', transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '1'; }}
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
const CUSTOM_COLORS = ['#00bcd4', '#9c27b0', '#ff5722', '#4caf50', '#e91e63'];

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

  // Draggable divider
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(65);
  const [handleHovered, setHandleHovered] = useState(false);

  // Fullscreen
  const sectionRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Custom tickers
  const [customTickers, setCustomTickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meridian-custom-tickers')) || []; } catch { return []; }
  });
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [addInput, setAddInput] = useState('');
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  // Persist custom tickers
  useEffect(() => {
    localStorage.setItem('meridian-custom-tickers', JSON.stringify(customTickers));
  }, [customTickers]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      sectionRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Close popover on Escape or click outside
  useEffect(() => {
    if (!showAddPopover) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowAddPopover(false); };
    const onClick = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setShowAddPopover(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [showAddPopover]);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (showAddPopover && inputRef.current) inputRef.current.focus();
  }, [showAddPopover]);

  // Fetch data for all symbols (indices + custom)
  const allSymbols = useMemo(() => [
    ...INDICES.map(i => i.symbol),
    ...customTickers,
  ], [customTickers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      setLoading(true);
      const results = {};
      const fetches = await Promise.allSettled(
        allSymbols.map(sym => api.chart(sym, timeframe))
      );
      allSymbols.forEach((sym, i) => {
        if (fetches[i].status === 'fulfilled') {
          results[sym] = fetches[i].value;
        }
      });
      setChartData(results);
      setLoading(false);
    })();
  }, [timeframe, allSymbols]); // eslint-disable-line react-hooks/exhaustive-deps

  // All renderable items (indices + custom)
  const allItems = useMemo(() => [
    ...INDICES,
    ...customTickers.map((sym, i) => ({ symbol: sym, label: sym, color: CUSTOM_COLORS[i % CUSTOM_COLORS.length] })),
  ], [customTickers]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedData = useMemo(() => {
    if (Object.keys(chartData).length === 0) return [];
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

  const latestQuotes = useMemo(() => {
    const quotes = {};
    allItems.forEach(idx => {
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
  }, [chartData, allItems]);

  // Draggable divider handler
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const startX = e.clientX;
    const startWidth = chartWidth;
    const onMove = (moveEvent) => {
      const containerWidth = container.getBoundingClientRect().width;
      const delta = moveEvent.clientX - startX;
      const newPct = Math.min(85, Math.max(30, startWidth + (delta / containerWidth * 100)));
      setChartWidth(newPct);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [chartWidth]);

  // Add custom ticker
  const addCustomTicker = (ticker) => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    if (customTickers.includes(sym) || INDICES.some(i => i.symbol === sym)) return;
    setCustomTickers(prev => [...prev, sym]);
    setSelected(prev => [...prev, sym]);
    setAddInput('');
    setShowAddPopover(false);
  };

  const removeCustomTicker = (sym) => {
    setCustomTickers(prev => prev.filter(s => s !== sym));
    setSelected(prev => prev.filter(s => s !== sym));
  };

  const tabBtnStyle = (active) => ({
    background: active ? 'var(--bg-tertiary)' : 'none',
    border: '1px solid', borderColor: active ? 'var(--gold)' : 'var(--border-color)',
    color: active ? 'var(--gold)' : 'var(--text-secondary)',
    fontSize: '10px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
  });

  return (
    <div ref={sectionRef} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Index Performance</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {timeframes.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={tabBtnStyle(timeframe === tf)}>{tf}</button>
          ))}
          <button onClick={() => setShowAddPopover(!showAddPopover)} style={{
            background: showAddPopover ? 'var(--bg-tertiary)' : 'none',
            border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
            fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            <Plus size={10} /> Add
          </button>
          <button onClick={toggleFullscreen} style={{
            background: 'none', border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}>
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
        {/* Add ticker popover */}
        {showAddPopover && (
          <div ref={popoverRef} style={{
            position: 'absolute', top: '100%', right: '60px', zIndex: 60,
            backgroundColor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '8px', marginTop: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            <form onSubmit={(e) => { e.preventDefault(); addCustomTicker(addInput); }}>
              <input
                ref={inputRef}
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                placeholder="Ticker (e.g. AAPL)"
                style={{
                  width: '200px', backgroundColor: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px', padding: '6px 10px', fontSize: '12px', color: 'white', outline: 'none',
                }}
              />
            </form>
            {customTickers.length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                Added: {customTickers.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={containerRef} style={{ display: 'flex' }}>
        {/* Left: Chart */}
        <div style={{ width: `${chartWidth}%`, padding: '12px', minWidth: 0 }}>
          {/* Toggle buttons */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {allItems.map(idx => {
              const isActive = selected.includes(idx.symbol);
              const isCustom = customTickers.includes(idx.symbol);
              const lastVal = normalizedData.length > 0 ? normalizedData[normalizedData.length - 1]?.[idx.symbol] : null;
              return (
                <button key={idx.symbol} onClick={() => toggleIndex(idx.symbol)} style={{
                  background: isActive ? idx.color + '22' : 'none',
                  border: `1px solid ${isActive ? idx.color : 'var(--border-color)'}`,
                  color: isActive ? idx.color : 'var(--text-tertiary)',
                  fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {idx.label} {lastVal != null ? `${lastVal >= 0 ? '+' : ''}${lastVal.toFixed(2)}%` : ''}
                  {isCustom && (
                    <span onClick={(e) => { e.stopPropagation(); removeCustomTicker(idx.symbol); }}
                      style={{ marginLeft: '2px', opacity: 0.6, cursor: 'pointer', display: 'inline-flex' }}>
                      <X size={10} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '280px' }} />
          ) : normalizedData.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={isFullscreen ? window.innerHeight - 200 : 280}>
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
              {allItems.filter(idx => selected.includes(idx.symbol)).map(idx => (
                <Line key={idx.symbol} type="monotone" dataKey={idx.symbol} stroke={idx.color} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleDragStart}
          onMouseEnter={() => setHandleHovered(true)}
          onMouseLeave={() => setHandleHovered(false)}
          style={{
            width: '6px', cursor: 'col-resize', flexShrink: 0,
            backgroundColor: handleHovered ? 'rgba(240,165,0,0.4)' : 'rgba(255,255,255,0.05)',
            borderRadius: '2px', transition: 'background 0.15s',
          }}
        />

        {/* Right: Index Cards */}
        <div style={{ width: `${100 - chartWidth - 0.5}%`, minWidth: '160px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', overflowY: 'auto' }}>
          {allItems.map(idx => {
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

      <style>{`
        :fullscreen { background: #0D1117; padding: 24px; display: flex; flex-direction: column; }
      `}</style>
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
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
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
        <div style={{ padding: '16px', flex: 1 }}>
          <div className="skeleton" style={{ height: '100%', minHeight: '120px' }} />
        </div>
      ) : yields.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px', flex: 1 }}>No yield data available.</p>
      ) : (
        <div style={{ padding: '12px', display: 'flex', gap: '16px', alignItems: 'stretch', flex: 1, minHeight: '200px' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yields} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="maturity" hide />
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
                <Line type="monotone" dataKey="yield" stroke={inverted ? 'var(--red)' : 'var(--gold)'} strokeWidth={2} dot={{ fill: inverted ? 'var(--red)' : 'var(--gold)', r: 4 }}>
                  <LabelList dataKey="maturity" position="top" offset={8} style={{ fill: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 500 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ width: '120px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Term</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Yield</span>
            </div>
            {yields.map(y => (
              <div key={y.maturity} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{y.maturity}</span>
                <span style={{ color: '#F0A500', fontSize: '12px', fontFamily: 'monospace' }}>{y.yield?.toFixed(3)}%</span>
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
  const { theme } = useTheme();
  const lt = theme === 'light';
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

  const INDICATOR_TOOLTIPS = {
    stock_price_strength: { title: 'Market Momentum', desc: 'Compares the S&P 500 to its 125-day moving average. High values mean the market is trading well above its trend \u2014 a sign of bullish momentum.' },
    stock_price_breadth: { title: 'Stock Breadth', desc: 'Measures how many stocks are advancing vs declining on the NYSE. Broad participation in rallies signals healthy market sentiment.' },
    market_momentum: { title: 'Market Momentum', desc: 'Compares the S&P 500 to its 125-day moving average. High values mean the market is trading well above its trend \u2014 a sign of bullish momentum.' },
    put_call_options: { title: 'Put/Call Ratio', desc: 'Tracks options market activity. A high put/call ratio means traders are buying more downside protection \u2014 a sign of fear. Low values signal complacency or greed.' },
    junk_bond_demand: { title: 'Junk Bond Demand', desc: 'Measures the yield spread between investment-grade and high-yield bonds. Tight spreads mean investors are willing to take risk \u2014 a greed signal.' },
    market_volatility: { title: 'Volatility', desc: 'VIX measures expected S&P 500 volatility. High VIX = fear.' },
    safe_haven_demand: { title: 'Safe Haven Demand', desc: 'Compares returns of stocks vs Treasury bonds. When investors pile into bonds over stocks, it signals fear. Stock outperformance signals greed.' },
    overall: { title: 'Overall Index', desc: 'A composite of all 5 indicators, equally weighted. Ranges from 0 (Extreme Fear) to 100 (Extreme Greed). Historically, extreme fear can signal buying opportunities.' },
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

  // Build 6 component cards (5 indicators + Overall)
  const componentCards = [
    ...indicators,
    ...(overallScore != null ? [{ key: 'overall', name: 'Overall', score: overallScore }] : []),
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Fear & Greed Index</span>
      </div>
      {loading ? (
        <div style={{ padding: '16px', flex: 1 }}>
          <div className="skeleton" style={{ height: '48px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ height: '80px' }} />
        </div>
      ) : overallScore == null ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px', flex: 1 }}>Unavailable</p>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {/* TOP ROW: Score + Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '48px', fontWeight: 900, color: lt ? '#111827' : '#ffffff', fontFamily: 'monospace', lineHeight: 1 }}>
              {Math.round(overallScore)}
            </span>
            <div>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: '9999px',
                backgroundColor: overallLabel.color, color: 'white', fontSize: '14px', fontWeight: 700,
              }}>
                {overallLabel.text}
              </span>
              <div style={{ color: lt ? '#6b7280' : 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '4px' }}>
                Overall Index{previousClose != null ? ` · Prev: ${Math.round(previousClose)}` : ''}
              </div>
            </div>
          </div>

          {/* GRADIENT BAR */}
          <div>
            <div style={{ position: 'relative', width: '100%', height: '8px', borderRadius: '9999px', background: 'linear-gradient(to right, #7f1d1d, #dc2626, #f59e0b, #16a34a, #14532d)' }}>
              <div style={{
                position: 'absolute', left: `${overallScore}%`, top: '-4px', transform: 'translateX(-50%)',
                width: '2px', height: '16px', backgroundColor: lt ? '#111827' : '#ffffff', borderRadius: '1px',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              {['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'].map(z => (
                <span key={z} style={{ color: lt ? '#9ca3af' : 'rgba(255,255,255,0.3)', fontSize: '9px' }}>{z}</span>
              ))}
            </div>
          </div>

          {/* COMPONENTS GRID */}
          {componentCards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
              {componentCards.map(ind => {
                const tip = INDICATOR_TOOLTIPS[ind.key];
                return (
                  <div key={ind.key}
                    onMouseEnter={() => setHoveredIndicator(ind.key)}
                    onMouseLeave={() => setHoveredIndicator(null)}
                    style={{ backgroundColor: lt ? '#f3f4f6' : 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '8px', position: 'relative', cursor: 'help' }}
                  >
                    <div style={{ color: lt ? '#6b7280' : 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                      {ind.name}<span style={{ opacity: lt ? 0.5 : 0.3, fontSize: '9px', marginLeft: '3px', color: lt ? '#9ca3af' : undefined }}>ⓘ</span>
                    </div>
                    <div style={{ color: lt ? '#111827' : '#ffffff', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '4px' }}>
                      {Math.round(ind.score)}
                    </div>
                    <div style={{ width: '100%', height: '4px', borderRadius: '9999px', backgroundColor: lt ? '#e5e7eb' : 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ width: `${ind.score}%`, height: '100%', backgroundColor: '#F0A500', borderRadius: '9999px', transition: 'width 600ms ease' }} />
                    </div>
                    {hoveredIndicator === ind.key && tip && (
                      <div style={{
                        position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                        width: '200px', backgroundColor: lt ? '#ffffff' : '#1a1f2e', border: `1px solid ${lt ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px', padding: '10px 12px', zIndex: 50, pointerEvents: 'none',
                        boxShadow: lt ? '0 4px 12px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.4)',
                      }}>
                        <div style={{ color: lt ? '#111827' : '#ffffff', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>{tip.title}</div>
                        <div style={{ color: lt ? '#6b7280' : 'rgba(255,255,255,0.5)', fontSize: '10px', lineHeight: 1.5 }}>{tip.desc}</div>
                        <div style={{
                          position: 'absolute', bottom: '-4px', left: '50%',
                          width: '8px', height: '8px', backgroundColor: lt ? '#ffffff' : '#1a1f2e',
                          border: `1px solid ${lt ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`, borderTop: 'none', borderLeft: 'none',
                          transform: 'translateX(-50%) rotate(45deg)',
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
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
const SECTOR_ETF_MAP = {
  'technology': 'XLK', 'healthcare': 'XLV', 'financials': 'XLF', 'energy': 'XLE',
  'consumer discretionary': 'XLY', 'consumer staples': 'XLP', 'industrials': 'XLI',
  'materials': 'XLB', 'real estate': 'XLRE', 'utilities': 'XLU', 'communication services': 'XLC',
  'financial services': 'XLF', 'basic materials': 'XLB',
};

function SectorHeatmap({ onNavigate }) {
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

  // 11 sectors (no Transportation), 4-column grid
  const displaySectors = useMemo(() => {
    const list = sectors.filter(s => !(s.sector || '').toLowerCase().includes('transportation'));
    const names = list.map(s => (s.sector || '').toLowerCase());
    if (!names.some(n => n.includes('real estate'))) {
      list.push({ sector: 'Real Estate', changesPercentage: 0 });
    }
    return list.slice(0, 11);
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
            <div key={i} onClick={() => { const etf = SECTOR_ETF_MAP[(s.sector || '').toLowerCase()]; if (etf && onNavigate) onNavigate(etf); }}
              style={{ backgroundColor: getColor(pctNum), borderRadius: '6px', padding: '12px', height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'opacity 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
        const fourteenDays = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        const data = await getEarningsCalendar(today, fourteenDays);
        console.log('[Earnings UI] received:', Array.isArray(data) ? `${data.length} earnings` : typeof data);
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
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', borderBottom: expandedIdx === i ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms ease', backgroundColor: expandedIdx === i ? 'var(--bg-tertiary)' : 'transparent' }}
                  onMouseEnter={e => { if (expandedIdx !== i) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (expandedIdx !== i) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, marginBottom: '4px', lineHeight: 1.4 }}>{item.title}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                      {item.site || item.source} {'\u00B7'} {formatTimeAgo(item.publishedDate || item.date)}
                    </div>
                  </div>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ flexShrink: 0, marginLeft: '8px', marginTop: '2px', color: 'var(--text-tertiary)', opacity: 0.6, transition: 'opacity 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                      <ExternalLink size={12} />
                    </a>
                  )}
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
            {earnings.map((row, i) => {
              const timeLabel = row.time === 'bmo' ? 'BMO' : row.time === 'amc' ? 'AMC' : '\u2014';
              return (
                <div key={`${row.symbol}-${i}`} onClick={() => onNavigate(row.symbol)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 150ms ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ color: 'var(--gold)', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{row.symbol}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      {(row.name && row.name !== row.symbol) ? row.name.slice(0, 20) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{formatDate(row.date)}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace', minWidth: '70px', textAlign: 'right' }}>
                      {row.epsEstimate != null ? `Est: $${Number(row.epsEstimate).toFixed(2)}` : row.epsEstimated != null ? `Est: $${Number(row.epsEstimated).toFixed(2)}` : '\u2014'}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', minWidth: '24px', textAlign: 'right' }}>{timeLabel}</span>
                  </div>
                </div>
              );
            })}
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
        const fourteenDays = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        const data = await getEconomicCalendar(today, fourteenDays);
        console.log('[EconCal UI] received:', Array.isArray(data) ? `${data.length} events` : typeof data);
        // Filter to upcoming only (date >= today)
        const upcoming = (Array.isArray(data) ? data : []).filter(e => e.date >= today);
        setEvents(upcoming.slice(0, 50));
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
function ForexPanel({ onNavigate }) {
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
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0', height: '100%', boxSizing: 'border-box' }}>
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
              <div key={i} onClick={() => onNavigate && onNavigate(p.symbol)}
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', marginBottom: '0', height: '100%', boxSizing: 'border-box' }}>
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
          {stocks.slice(0, 11).map((s, i) => {
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


// ── Global Exchange Status ──
const EXCHANGE_INDEX_MAP = {
  'NYSE': '^NYA', 'NASDAQ': '^IXIC', 'LSE': '^FTSE', 'Euronext': '^FCHI', 'FSE': '^GDAXI',
  'TSE': '^N225', 'SSE': '^SSEC', 'BSE': '^BSESN', 'ASX': '^AXJO', 'TSX': '^GSPTSE',
  'KOSPI': '^KS11', 'B3': '^BVSP', 'SGX': '^STI', 'JSE': '^JN0U.JO',
};

function GlobalExchangeStatus({ onNavigate }) {
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
            <div key={ex.name} onClick={() => { const idx = EXCHANGE_INDEX_MAP[ex.name]; if (idx && onNavigate) onNavigate(idx); }}
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', cursor: 'pointer', transition: 'opacity 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', alignItems: 'stretch' }}>
        <YieldCurvePanel />
        <FearGreedPanel />
      </div>

      <div style={{ marginTop: '12px' }}>
        <TopMovers onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <MarketSnapshot onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px', width: '100%' }}>
        <HeatmapCard onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <SectorHeatmap onNavigate={handleNavigate} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', alignItems: 'stretch' }}>
        <ForexPanel onNavigate={handleNavigate} />
        <CurrencyStrengthIndex onItemClick={(item) => handleNavigate(item.symbol || item.ticker)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', alignItems: 'stretch' }}>
        <CommoditiesDashboard onItemClick={(item) => handleNavigate(item.symbol)} />
        <MostShortedPanel onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <GlobalExchangeStatus onNavigate={handleNavigate} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <GlobalMarketsOverview onRowClick={(item) => handleNavigate(item.symbol)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <CentralBankTracker onRowClick={handleItemClick} />
        <M2MoneySupply />
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
