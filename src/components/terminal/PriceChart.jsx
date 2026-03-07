import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { getPriceHistory } from '../../services/polygon';
import { formatPrice } from '../../utils/formatters';

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
const COMPARE_COLORS = ['#8B5CF6', '#06B6D4', '#F59E0B', '#EC4899'];

function formatXAxis(tick, timeframe) {
  if (!tick) return '';
  const d = new Date(tick);
  if (['1D', '1W'].includes(timeframe)) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (['1M', '3M'].includes(timeframe)) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload, label, timeframe }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const dt = new Date(label || d.t);
  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      padding: '10px 14px',
      fontSize: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {['1D', '1W'].includes(timeframe)
          ? dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      {d.o != null && <div style={{ color: 'var(--text-primary)' }}>O: <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{formatPrice(d.o)}</span></div>}
      {d.h != null && <div style={{ color: 'var(--text-primary)' }}>H: <span style={{ color: 'var(--green)', fontFamily: 'monospace' }}>{formatPrice(d.h)}</span></div>}
      {d.l != null && <div style={{ color: 'var(--text-primary)' }}>L: <span style={{ color: 'var(--red)', fontFamily: 'monospace' }}>{formatPrice(d.l)}</span></div>}
      {d.c != null && <div style={{ color: 'var(--text-primary)' }}>C: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatPrice(d.c)}</span></div>}
      {d.v != null && <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'monospace' }}>Vol: {Number(d.v).toLocaleString()}</div>}
    </div>
  );
}

// Custom candlestick bar that receives x, width, and the full payload
// We use candleHigh/candleLow as the Bar dataKey range, so y and height map to the wick
// Then we draw the body (open-close) inside
function CandlestickBar(props) {
  const { x, y, width, height, payload } = props;
  if (!payload || payload.o == null || !height || !y) return null;

  const { o, h, l, c } = payload;
  const isGreen = c >= o;
  const color = isGreen ? '#22C55E' : '#EF4444';

  // y is top of wick (high), y+height is bottom (low)
  // We need to compute body position relative to wick
  const range = h - l;
  if (range <= 0) return null;

  const bodyTop = ((h - Math.max(o, c)) / range) * height;
  const bodyBottom = ((h - Math.min(o, c)) / range) * height;
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);

  const wickX = x + width / 2;

  return (
    <g>
      {/* Wick */}
      <line
        x1={wickX}
        y1={y}
        x2={wickX}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + 1}
        y={y + bodyTop}
        width={Math.max(1, width - 2)}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  );
}

export default function PriceChart({ symbol }) {
  const [timeframe, setTimeframe] = useState('1M');
  const [chartType, setChartType] = useState('line');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compareInput, setCompareInput] = useState('');
  const [compareSymbols, setCompareSymbols] = useState([]);
  const [compareData, setCompareData] = useState({});
  const [showCompare, setShowCompare] = useState(false);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await getPriceHistory(symbol, timeframe);
      // Deduplicate by date — keep last entry per calendar day for clean candlesticks
      const byDate = new Map();
      raw.forEach(bar => {
        const dateKey = new Date(bar.t).toISOString().split('T')[0];
        byDate.set(dateKey, bar);
      });
      const deduped = Array.from(byDate.values()).sort((a, b) => a.t - b.t);
      const mapped = deduped.map(bar => ({
        t: bar.t,
        o: bar.o,
        h: bar.h,
        l: bar.l,
        c: bar.c,
        v: bar.v,
        candleRange: [bar.l, bar.h],
      }));
      setData(mapped);
    } catch (e) {
      setError('Failed to load price data. Check Polygon API key.');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load compare data
  useEffect(() => {
    if (compareSymbols.length === 0) { setCompareData({}); return; }
    (async () => {
      const results = {};
      for (const sym of compareSymbols) {
        try {
          const raw = await getPriceHistory(sym, timeframe);
          results[sym] = raw;
        } catch {}
      }
      setCompareData(results);
    })();
  }, [compareSymbols, timeframe]);

  const addCompare = () => {
    const sym = compareInput.trim().toUpperCase();
    if (sym && !compareSymbols.includes(sym) && sym !== symbol && compareSymbols.length < 4) {
      setCompareSymbols([...compareSymbols, sym]);
      setShowCompare(true);
    }
    setCompareInput('');
  };

  const removeCompare = (sym) => {
    setCompareSymbols(compareSymbols.filter(s => s !== sym));
  };

  // Normalize data to % change for comparison
  const normalizedData = useMemo(() => {
    if (!showCompare || compareSymbols.length === 0 || data.length === 0) return null;
    const baseFirst = data[0]?.c;
    if (!baseFirst) return null;

    return data.map((bar, i) => {
      const point = { t: bar.t, [symbol]: ((bar.c - baseFirst) / baseFirst) * 100 };
      for (const sym of compareSymbols) {
        const symData = compareData[sym];
        if (symData && symData[i]) {
          const symFirst = symData[0]?.c;
          if (symFirst) {
            point[sym] = ((symData[i].c - symFirst) / symFirst) * 100;
          }
        }
      }
      return point;
    });
  }, [data, compareData, compareSymbols, showCompare, symbol]);

  const yDomain = useMemo(() => {
    if (data.length === 0) return ['auto', 'auto'];
    if (chartType !== 'candle') return ['auto', 'auto'];
    let min = Infinity, max = -Infinity;
    data.forEach(d => {
      if (d.l < min) min = d.l;
      if (d.h > max) max = d.h;
    });
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [data, chartType]);

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: timeframe === tf ? '2px solid var(--gold)' : '2px solid transparent',
                color: timeframe === tf ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: timeframe === tf ? 600 : 400,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Compare input */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              value={compareInput}
              onChange={e => setCompareInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCompare()}
              placeholder="Compare..."
              style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                borderRadius: '4px', padding: '3px 8px', color: 'var(--text-primary)',
                fontSize: '11px', fontFamily: 'monospace', width: '80px', outline: 'none',
              }}
            />
            {compareSymbols.map((sym, i) => (
              <span key={sym} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                backgroundColor: 'var(--bg-tertiary)', border: `1px solid ${COMPARE_COLORS[i % COMPARE_COLORS.length]}`,
                borderRadius: '4px', padding: '2px 6px', fontSize: '10px',
                color: COMPARE_COLORS[i % COMPARE_COLORS.length], fontFamily: 'monospace', fontWeight: 600,
              }}>
                {sym}
                <span onClick={() => removeCompare(sym)} style={{ cursor: 'pointer', fontSize: '12px' }}>&times;</span>
              </span>
            ))}
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          {['line', 'candle'].map(t => (
            <button
              key={t}
              onClick={() => { setChartType(t); if (t === 'candle') setShowCompare(false); }}
              style={{
                background: chartType === t ? 'var(--bg-tertiary)' : 'none',
                border: '1px solid',
                borderColor: chartType === t ? 'var(--gold)' : 'var(--border-color)',
                color: chartType === t ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: '400px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: `${20 + Math.random() * 60}px`, width: '100%' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--red)', margin: 0, fontSize: '13px' }}>{error}</p>
          <button onClick={loadData} style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            Retry
          </button>
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No chart data available.</p>
        </div>
      ) : normalizedData && showCompare && compareSymbols.length > 0 ? (
        /* Comparison mode: normalized % change */
        <ResponsiveContainer width="100%" height={370}>
          <ComposedChart data={normalizedData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={tick => formatXAxis(tick, timeframe)}
              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              axisLine={false} tickLine={false} interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              tickFormatter={v => `${Number(v).toFixed(1)}%`}
              axisLine={false} tickLine={false} width={56} orientation="right"
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                    {payload.map(p => (
                      <div key={p.dataKey} style={{ color: p.color, marginBottom: '2px' }}>
                        {p.dataKey}: {Number(p.value).toFixed(2)}%
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey={symbol} stroke="var(--gold)" strokeWidth={1.5} dot={false} />
            {compareSymbols.map((sym, i) => (
              <Line key={sym} type="monotone" dataKey={sym} stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]} strokeWidth={1.5} dot={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={tick => formatXAxis(tick, timeframe)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="price"
                domain={yDomain}
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                tickFormatter={v => `$${Number(v).toFixed(0)}`}
                axisLine={false}
                tickLine={false}
                width={56}
                orientation="right"
              />
              <Tooltip content={<CustomTooltip timeframe={timeframe} />} />
              {chartType === 'line' ? (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="c"
                  stroke="var(--gold)"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--gold)', stroke: 'var(--bg-secondary)', strokeWidth: 2 }}
                />
              ) : (
                <Bar
                  yAxisId="price"
                  dataKey="candleRange"
                  shape={<CandlestickBar />}
                  isAnimationActive={false}
                  maxBarSize={data.length > 200 ? 4 : data.length > 100 ? 6 : 8}
                  minPointSize={1}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill="transparent" />
                  ))}
                </Bar>
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Volume chart */}
          <ResponsiveContainer width="100%" height={70}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis hide />
              <Bar dataKey="v" maxBarSize={8}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.c >= d.o ? '#22C55E' : '#EF4444'} opacity={0.6} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
