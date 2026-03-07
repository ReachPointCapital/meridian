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
  const [hovered, setHovered] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('/api/heatmap')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Build rank map (original index = market cap rank) and sort by % change desc
  const { sorted, rankMap } = useMemo(() => {
    const rm = {};
    data.forEach((s, i) => { rm[s.symbol] = i; });
    const s = [...data].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999));
    return { sorted: s, rankMap: rm };
  }, [data]);

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Collapsed: 3 equal rows of colored squares, sorted green→red
  const renderCollapsed = () => {
    const perRow = Math.ceil(sorted.length / 3);
    const rows = [
      sorted.slice(0, perRow),
      sorted.slice(perRow, perRow * 2),
      sorted.slice(perRow * 2),
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

  const renderExpanded = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px 10px' }}>
      {sorted.map((stock) => {
        const rank = rankMap[stock.symbol] ?? 999;
        let w, h, showTicker, showPct;
        if (rank < 10) {
          w = 70; h = 46; showTicker = true; showPct = true;
        } else if (rank < 30) {
          w = 52; h = 36; showTicker = true; showPct = true;
        } else if (rank < 70) {
          w = 36; h = 28; showTicker = true; showPct = false;
        } else if (rank < 150) {
          w = 24; h = 20; showTicker = false; showPct = false;
        } else {
          w = 16; h = 14; showTicker = false; showPct = false;
        }

        const textCol = getTextColor(stock.changePercent);
        const isMega = rank < 10;
        const isLarge = rank < 30;

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
              borderRadius: rank < 70 ? '3px' : '2px',
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
                fontSize: isMega ? '10px' : isLarge ? '9px' : '8px',
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
                fontSize: isMega ? '9px' : '8px',
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
      <div
        onClick={() => !loading && data.length > 0 && setExpanded(!expanded)}
        style={{
          padding: '8px 14px',
          borderBottom: expanded ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: data.length > 0 ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            S&P 500 Heatmap
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>
            {data.length} stocks · 15min delay
          </span>
        </div>
        {!loading && data.length > 0 && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: 600 }}>
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </span>
        )}
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
