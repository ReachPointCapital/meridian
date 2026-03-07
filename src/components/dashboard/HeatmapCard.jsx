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

  const renderCollapsed = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px 10px' }}>
      {sorted.map((stock) => (
        <div
          key={stock.symbol}
          onMouseEnter={() => setHovered(stock)}
          onMouseLeave={() => setHovered(null)}
          onMouseMove={handleMouseMove}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '2px',
            backgroundColor: getHeatColor(stock.changePercent),
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );

  const renderExpanded = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px 10px' }}>
      {sorted.map((stock) => {
        const rank = rankMap[stock.symbol] ?? 99;
        let minW, minH, showTicker, showPct;
        if (rank < 10) {
          minW = 80; minH = 52; showTicker = true; showPct = true;
        } else if (rank < 30) {
          minW = 56; minH = 40; showTicker = true; showPct = true;
        } else if (rank < 60) {
          minW = 40; minH = 32; showTicker = true; showPct = false;
        } else {
          minW = 28; minH = 24; showTicker = false; showPct = false;
        }

        const textCol = getTextColor(stock.changePercent);

        return (
          <div
            key={stock.symbol}
            onMouseEnter={() => setHovered(stock)}
            onMouseLeave={() => setHovered(null)}
            onMouseMove={handleMouseMove}
            style={{
              minWidth: `${minW}px`,
              minHeight: `${minH}px`,
              flex: rank < 10 ? '1 1 80px' : rank < 30 ? '1 1 56px' : rank < 60 ? '0 1 40px' : '0 0 28px',
              maxWidth: rank < 10 ? '120px' : rank < 30 ? '80px' : rank < 60 ? '56px' : '36px',
              backgroundColor: getHeatColor(stock.changePercent),
              borderRadius: '3px',
              padding: showTicker ? '4px 6px' : '2px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {showTicker && (
              <div style={{ fontSize: rank < 10 ? '11px' : '10px', fontWeight: 700, color: textCol, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stock.symbol}
              </div>
            )}
            {showPct && (
              <div style={{ fontSize: rank < 10 ? '10px' : '9px', color: textCol, opacity: 0.8, marginTop: '2px', lineHeight: 1, fontFamily: 'monospace' }}>
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
            Top 100 · 15min delay
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
