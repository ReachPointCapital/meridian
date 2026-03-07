import React, { useState, useEffect, useMemo } from 'react';

function getHeatColor(pct) {
  if (pct == null) return '#374151';
  if (pct <= -3) return '#7f1d1d';
  if (pct <= -2) return '#991b1b';
  if (pct <= -1) return '#b91c1c';
  if (pct <= -0.5) return '#dc2626';
  if (pct < 0.5) return '#374151';
  if (pct < 1) return '#166534';
  if (pct < 2) return '#15803d';
  if (pct < 3) return '#16a34a';
  return '#14532d';
}

function getTextColor(pct) {
  if (pct != null && pct >= 3) return '#4ade80';
  return 'white';
}

function formatPct(pct) {
  if (pct == null) return '—';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export default function HeatmapCard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState('mktcap'); // 'mktcap' | 'swing'
  const [hovered, setHovered] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('/api/heatmap')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          // Filter to only stocks with valid data
          setData(d.filter(s => s.price != null && s.changePercent != null));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build rank map and sorted arrays for both modes
  const { displayed, rankMap } = useMemo(() => {
    const rm = {};
    data.forEach((s, i) => { rm[s.symbol] = i; });

    let ordered;
    if (sortMode === 'mktcap') {
      // Keep original market cap order
      ordered = [...data];
    } else {
      // Sort by absolute % change descending (biggest movers first)
      ordered = [...data].sort((a, b) =>
        Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)
      );
    }
    return { displayed: ordered, rankMap: rm };
  }, [data, sortMode]);

  // For collapsed view, always sort green→red
  const collapsedSorted = useMemo(() => {
    return [...data].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999));
  }, [data]);

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Collapsed: 3 equal rows of colored squares, sorted green→red
  const renderCollapsed = () => {
    const perRow = Math.ceil(collapsedSorted.length / 3);
    const rows = [
      collapsedSorted.slice(0, perRow),
      collapsedSorted.slice(perRow, perRow * 2),
      collapsedSorted.slice(perRow * 2),
    ];
    return (
      <div style={{ padding: '4px 10px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', height: '18px', gap: '1px' }}>
            {row.map((stock) => (
              <div
                key={stock.symbol}
                onMouseEnter={() => setHovered(stock)}
                onMouseLeave={() => setHovered(null)}
                onMouseMove={handleMouseMove}
                style={{
                  flex: 1,
                  backgroundColor: getHeatColor(stock.changePercent),
                  borderRadius: '1px',
                  cursor: 'pointer',
                  minWidth: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const getCellSize = (stock) => {
    // In swing mode, rank by absolute move; in mktcap mode, rank by original index
    const rank = sortMode === 'swing'
      ? displayed.indexOf(stock)
      : (rankMap[stock.symbol] ?? 999);

    if (rank < 10) return { w: 70, h: 46, showTicker: true, showPct: true };
    if (rank < 30) return { w: 52, h: 36, showTicker: true, showPct: true };
    if (rank < 70) return { w: 36, h: 28, showTicker: true, showPct: false };
    if (rank < 150) return { w: 24, h: 20, showTicker: false, showPct: false };
    return { w: 16, h: 14, showTicker: false, showPct: false };
  };

  const renderExpanded = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px 10px' }}>
      {displayed.map((stock) => {
        const { w, h, showTicker, showPct } = getCellSize(stock);
        const textCol = getTextColor(stock.changePercent);

        return (
          <div
            key={stock.symbol}
            onMouseEnter={() => setHovered(stock)}
            onMouseLeave={() => setHovered(null)}
            onMouseMove={handleMouseMove}
            style={{
              width: `${w}px`,
              height: `${h}px`,
              backgroundColor: getHeatColor(stock.changePercent),
              borderRadius: w >= 36 ? '3px' : '2px',
              padding: showTicker ? '3px 4px' : '0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {showTicker && (
              <div style={{
                fontSize: w >= 70 ? '10px' : w >= 52 ? '9px' : '8px',
                fontWeight: 700,
                color: textCol,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {stock.symbol}
              </div>
            )}
            {showPct && (
              <div style={{
                fontSize: w >= 70 ? '9px' : '8px',
                color: textCol,
                opacity: 0.8,
                marginTop: '1px',
                lineHeight: 1,
                fontFamily: 'monospace',
              }}>
                {formatPct(stock.changePercent)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const tabStyle = (active) => ({
    background: active ? '#F0A500' : 'none',
    color: active ? '#000' : 'rgba(255,255,255,0.4)',
    border: active ? '1px solid #F0A500' : '1px solid rgba(255,255,255,0.2)',
    fontSize: '10px',
    fontWeight: active ? 600 : 400,
    padding: '2px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    lineHeight: 1.4,
  });

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        borderBottom: expanded ? '1px solid var(--border-color)' : 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            S&P 500 Heatmap
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>
            {data.length} stocks · 15min delay
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!loading && data.length > 0 && expanded && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setSortMode('mktcap'); }} style={tabStyle(sortMode === 'mktcap')}>Mkt Cap</button>
              <button onClick={(e) => { e.stopPropagation(); setSortMode('swing'); }} style={tabStyle(sortMode === 'swing')}>Daily Swing</button>
            </>
          )}
          {!loading && data.length > 0 && (
            <span
              onClick={() => setExpanded(!expanded)}
              style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', marginLeft: '4px' }}
            >
              {expanded ? '▲ Collapse' : '▼ Expand'}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
          Loading heatmap…
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
          Heatmap data unavailable.
        </div>
      ) : expanded ? renderExpanded() : renderCollapsed()}

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'fixed',
          left: mousePos.x + 12,
          top: mousePos.y - 30,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '4px 8px',
          zIndex: 1000,
          fontSize: '11px',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          fontFamily: 'monospace',
        }}>
          <strong style={{ color: 'var(--gold)' }}>{hovered.symbol}</strong>
          <span style={{ marginLeft: '6px' }}>
            {hovered.price != null ? `$${hovered.price.toFixed(2)}` : '—'}
          </span>
          <span style={{ marginLeft: '6px', fontWeight: 600, color: (hovered.changePercent || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
            {formatPct(hovered.changePercent)}
          </span>
        </div>
      )}
    </div>
  );
}
