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

const BORDER = '1px solid #0D1117';

export default function HeatmapCard({ onNavigate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState('mktcap');
  const [hovered, setHovered] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('/api/heatmap')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setData(d.filter(s => s.price != null && s.changePercent != null));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const rankMap = useMemo(() => {
    const rm = {};
    data.forEach((s, i) => { rm[s.symbol] = i; });
    return rm;
  }, [data]);

  const displayStocks = useMemo(() => {
    if (sortMode === 'swing') {
      return [...data].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999));
    }
    return [...data];
  }, [data, sortMode]);

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const renderCollapsed = () => {
    const sorted = [...displayStocks].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999));
    const perRow = Math.ceil(sorted.length / 3);
    const rows = [
      sorted.slice(0, perRow),
      sorted.slice(perRow, perRow * 2),
      sorted.slice(perRow * 2),
    ];
    return (
      <div style={{ padding: '4px 0 6px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', height: '18px' }}>
            {row.map((stock) => (
              <div
                key={stock.symbol}
                onMouseEnter={() => setHovered(stock)}
                onMouseLeave={() => setHovered(null)}
                onMouseMove={handleMouseMove}
                style={{
                  flex: 1,
                  backgroundColor: getHeatColor(stock.changePercent),
                  cursor: 'pointer',
                  minWidth: 0,
                  margin: 0,
                  padding: 0,
                  borderRight: BORDER,
                  borderBottom: ri < 2 ? BORDER : 'none',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderExpanded = () => {
    const isSwing = sortMode === 'swing';
    return (
      <div key={`heatmap-${sortMode}`} style={{ display: 'flex', flexWrap: 'wrap', width: '100%', alignContent: 'flex-start', margin: 0, padding: 0 }}>
        {displayStocks.map((stock) => {
          const rank = rankMap[stock.symbol] ?? 999;
          let w, h, showTicker, showPct;

          if (isSwing) {
            // Uniform cells in swing mode
            w = 64; h = 48; showTicker = true; showPct = true;
          } else {
            if (rank < 10) { w = 136; h = 88; showTicker = true; showPct = true; }
            else if (rank < 30) { w = 100; h = 72; showTicker = true; showPct = true; }
            else if (rank < 70) { w = 72; h = 56; showTicker = true; showPct = true; }
            else if (rank < 200) { w = 48; h = 40; showTicker = true; showPct = false; }
            else { w = 32; h = 28; showTicker = false; showPct = false; }
          }

          const textCol = getTextColor(stock.changePercent);

          return (
            <div
              key={stock.symbol}
              onClick={() => onNavigate && onNavigate(stock.symbol)}
              onMouseEnter={() => setHovered(stock)}
              onMouseLeave={() => setHovered(null)}
              onMouseMove={handleMouseMove}
              style={{
                width: `${w}px`,
                height: `${h}px`,
                backgroundColor: getHeatColor(stock.changePercent),
                border: BORDER,
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: showTicker ? 'flex-start' : 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                flexShrink: 0,
                boxSizing: 'border-box',
                paddingLeft: showTicker ? '3px' : 0,
                paddingRight: showTicker ? '2px' : 0,
              }}
            >
              {showTicker && (
                <div style={{
                  fontSize: w >= 136 ? '14px' : w >= 100 ? '12px' : w >= 72 ? '11px' : w >= 48 ? '9px' : '8px',
                  fontWeight: 700,
                  color: textCol,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}>
                  {stock.symbol}
                </div>
              )}
              {showPct && (
                <div style={{
                  fontSize: w >= 136 ? '12px' : w >= 100 ? '10px' : w >= 72 ? '10px' : '9px',
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
  };

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
            {hovered.price != null ? '$' + Number(hovered.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </span>
          <span style={{ marginLeft: '6px', fontWeight: 600, color: (hovered.changePercent || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
            {formatPct(hovered.changePercent)}
          </span>
        </div>
      )}
    </div>
  );
}
