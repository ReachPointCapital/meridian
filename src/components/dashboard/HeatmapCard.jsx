import React, { useState, useEffect } from 'react';

function getHeatColor(changePercent) {
  if (changePercent == null) return '#374151';
  if (changePercent <= -2) return '#7f1d1d';
  if (changePercent <= -1) return '#dc2626';
  if (changePercent < 0) return '#ef4444';
  if (changePercent === 0) return '#374151';
  if (changePercent < 1) return '#16a34a';
  if (changePercent < 2) return '#15803d';
  return '#14532d';
}

export default function HeatmapCard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredStock, setHoveredStock] = useState(null);

  useEffect(() => {
    fetch('/api/heatmap')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group by sector preserving order
  const sectorOrder = [];
  const sectors = {};
  data.forEach(stock => {
    if (!sectors[stock.sector]) {
      sectors[stock.sector] = [];
      sectorOrder.push(stock.sector);
    }
    sectors[stock.sector].push(stock);
  });

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            S&P 500 Heatmap
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', marginLeft: '8px' }}>
            Top 80 stocks · 15min delay
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '9px', color: 'var(--text-tertiary)' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#7f1d1d' }} />
          <span>-2%+</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }} />
          <span>-1%</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#374151' }} />
          <span>0</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#16a34a' }} />
          <span>+1%</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#14532d' }} />
          <span>+2%+</span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Loading heatmap...
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Heatmap data unavailable.
        </div>
      ) : (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sectorOrder.map(sectorName => {
            const stocks = sectors[sectorName];
            const sectorCap = stocks.reduce((s, st) => s + (st.marketCap || 0), 0);
            const avgChange = stocks.reduce((s, st) => s + (st.changePercent || 0), 0) / stocks.length;

            return (
              <div key={sectorName}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {sectorName}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: avgChange >= 0 ? '#22c55e' : '#ef4444' }}>
                    {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                  {stocks.map(stock => {
                    const tilePct = stock.marketCap / sectorCap * 100;
                    const minWidth = tilePct < 5 ? 36 : tilePct < 10 ? 52 : tilePct < 20 ? 72 : 100;

                    return (
                      <div
                        key={stock.symbol}
                        onMouseEnter={() => setHoveredStock(stock)}
                        onMouseLeave={() => setHoveredStock(null)}
                        style={{
                          background: getHeatColor(stock.changePercent),
                          borderRadius: '3px',
                          padding: '4px 6px',
                          minWidth: `${minWidth}px`,
                          height: '38px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                          opacity: hoveredStock && hoveredStock.symbol !== stock.symbol ? 0.7 : 1,
                          overflow: 'hidden',
                          flex: `${stock.marketCap} 0 0`,
                        }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                          {stock.symbol}
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.2, marginTop: '1px' }}>
                          {stock.changePercent != null
                            ? `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`
                            : '\u2014'
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredStock && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 14px',
          zIndex: 1000,
          fontSize: '12px',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <strong style={{ color: 'var(--gold)' }}>{hoveredStock.symbol}</strong>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>{hoveredStock.name}</span>
          <span style={{ marginLeft: '10px', fontFamily: 'monospace' }}>
            {hoveredStock.price ? `$${hoveredStock.price.toFixed(2)}` : '\u2014'}
          </span>
          <span style={{ marginLeft: '8px', fontWeight: 600, color: (hoveredStock.changePercent || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
            {hoveredStock.changePercent != null ? `${hoveredStock.changePercent >= 0 ? '+' : ''}${hoveredStock.changePercent.toFixed(2)}%` : '\u2014'}
          </span>
        </div>
      )}
    </div>
  );
}
