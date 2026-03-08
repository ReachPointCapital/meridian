import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, RefreshCw, GripVertical } from 'lucide-react';
import { getQuotes } from '../../services/fmp';
import { formatPrice, formatPercent, formatMarketCap, formatVolume } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'TSLA', 'NVDA', 'BTC-USD'];

export default function Watchlist({ setActiveTab }) {
  const { setActiveSymbol } = useApp();
  const { user } = useAuth();
  const [tickers, setTickers] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('meridian-watchlist'));
      return stored && stored.length > 0 ? stored : DEFAULT_TICKERS;
    } catch { return DEFAULT_TICKERS; }
  });
  const [input, setInput] = useState('');
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Load watchlist from Supabase for logged-in users
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('watchlists')
        .select('ticker')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        setTickers(data.map(r => r.ticker));
      } else {
        // Migrate localStorage to Supabase on first login
        const local = JSON.parse(localStorage.getItem('meridian-watchlist') || '[]');
        if (local.length > 0) {
          const rows = local.map(t => ({ user_id: user.id, ticker: t }));
          await supabase.from('watchlists').upsert(rows, { onConflict: 'user_id,ticker' });
        }
      }
    })();
  }, [user]);

  // Persist tickers
  useEffect(() => {
    localStorage.setItem('meridian-watchlist', JSON.stringify(tickers));
  }, [tickers]);

  // Sync to Supabase when tickers change (for logged-in users)
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Delete all and re-insert to preserve order
      await supabase.from('watchlists').delete().eq('user_id', user.id);
      if (tickers.length > 0) {
        const rows = tickers.map(t => ({ user_id: user.id, ticker: t }));
        await supabase.from('watchlists').insert(rows);
      }
    })();
  }, [tickers, user]);

  const fetchAll = useCallback(async () => {
    if (tickers.length === 0) return;
    setLoading(true);
    try {
      const data = await getQuotes(tickers);
      const map = {};
      data.forEach(q => { if (q.symbol) map[q.symbol] = q; });
      setQuotes(map);
    } catch {}
    setLoading(false);
  }, [tickers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (tickers.length === 0) return;
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll, tickers.length]);

  const addTicker = () => {
    const sym = input.trim().toUpperCase();
    if (sym && !tickers.includes(sym)) {
      setTickers(prev => [...prev, sym]);
    }
    setInput('');
  };

  const removeTicker = (sym) => {
    setTickers(prev => prev.filter(t => t !== sym));
  };

  const handleNavigate = (sym) => {
    setActiveSymbol(sym);
    setActiveTab('Analysis');
  };

  // Drag reorder handlers
  const handleDragStart = (idx) => { setDragIdx(idx); };
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx) => {
    if (dragIdx == null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setTickers(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
          Watchlist
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          Track your favorite tickers
        </p>
      </div>

      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Watchlist
          </span>
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
          >
            <RefreshCw size={12} className={loading ? 'spin-animation' : ''} /> Refresh
          </button>
        </div>

        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '6px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker()}
            placeholder="Add ticker..."
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              padding: '6px 8px',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={addTicker}
            style={{
              backgroundColor: 'var(--gold)',
              border: 'none',
              borderRadius: '4px',
              color: 'var(--bg-primary)',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {tickers.length === 0 ? (
          <div style={{ padding: '60px 16px', textAlign: 'center' }}>
            <Plus size={28} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>Add tickers to build your watchlist</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['', '', 'Ticker', 'Company', 'Price', 'Chg $', 'Chg %', 'Mkt Cap', 'Volume', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '6px 10px',
                      textAlign: i < 4 ? 'left' : 'right',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border-color)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickers.map((sym, idx) => {
                  const q = quotes[sym] || {};
                  const isPos = (q.change || 0) >= 0;
                  const chgColor = isPos ? 'var(--green)' : 'var(--red)';
                  return (
                    <tr
                      key={sym}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleNavigate(sym)}
                      style={{
                        cursor: 'pointer',
                        transition: 'background 150ms ease',
                        opacity: dragIdx === idx ? 0.5 : 1,
                        borderTop: dragOverIdx === idx && dragIdx !== idx ? '2px solid var(--gold)' : 'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '8px 4px 8px 10px', width: '20px', cursor: 'grab' }} onClick={e => e.stopPropagation()}>
                        <GripVertical size={12} color="var(--text-tertiary)" />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <WatchlistLogo sym={sym} />
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>{sym}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.name || '\u2014'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {formatPrice(q.price)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: chgColor, fontFamily: 'monospace' }}>
                        {q.change != null ? (q.change >= 0 ? '+' : '') + Number(q.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '\u2014'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: chgColor, fontFamily: 'monospace' }}>
                        {formatPercent(q.changesPercentage)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {formatMarketCap(q.marketCap)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {formatVolume(q.volume)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button
                          onClick={e => { e.stopPropagation(); removeTicker(sym); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', opacity: 0.5, transition: 'opacity 150ms' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function WatchlistLogo({ sym }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div style={{
        width: '24px', height: '24px', borderRadius: '8px',
        backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--gold)', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
      }}>
        {sym[0]}
      </div>
    );
  }
  return (
    <img
      src={`https://financialmodelingprep.com/image-stock/${sym}.png`}
      alt={sym}
      style={{ width: '24px', height: '24px', borderRadius: '8px', objectFit: 'cover', backgroundColor: 'var(--bg-tertiary)' }}
      onError={() => setFailed(true)}
    />
  );
}
