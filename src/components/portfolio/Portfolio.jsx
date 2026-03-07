import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Trash2, Download, Upload } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { getQuotes } from '../../services/fmp';
import { formatPrice } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

const PIE_COLORS = ['#C9A84C', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#EAB308'];

function loadPortfolio() {
  try { return JSON.parse(localStorage.getItem('meridian-portfolio') || '[]'); } catch { return []; }
}
function savePortfolio(txns) { localStorage.setItem('meridian-portfolio', JSON.stringify(txns)); }

export default function Portfolio({ setActiveTab }) {
  const { setActiveSymbol } = useApp();
  const [transactions, setTransactions] = useState(loadPortfolio);
  const [quotes, setQuotes] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', shares: '', price: '', date: new Date().toISOString().split('T')[0], type: 'buy' });

  // Save on change
  useEffect(() => { savePortfolio(transactions); }, [transactions]);

  // Get unique symbols
  const symbols = useMemo(() => [...new Set(transactions.map(t => t.symbol))], [transactions]);

  // Fetch quotes
  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      const data = await getQuotes(symbols);
      const map = {};
      data.forEach(q => { if (q.symbol) map[q.symbol] = q; });
      setQuotes(map);
    } catch {}
  }, [symbols]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  // Compute holdings
  const holdings = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!map[t.symbol]) map[t.symbol] = { symbol: t.symbol, shares: 0, costBasis: 0 };
      if (t.type === 'buy') {
        map[t.symbol].costBasis += t.shares * t.price;
        map[t.symbol].shares += t.shares;
      } else {
        map[t.symbol].shares -= t.shares;
        map[t.symbol].costBasis -= t.shares * t.price;
      }
    });
    return Object.values(map).filter(h => h.shares > 0).map(h => {
      const q = quotes[h.symbol] || {};
      const currentPrice = q.price || 0;
      const marketValue = h.shares * currentPrice;
      const avgCost = h.shares > 0 ? h.costBasis / h.shares : 0;
      const pl = marketValue - h.costBasis;
      const plPct = h.costBasis > 0 ? (pl / h.costBasis) * 100 : 0;
      return { ...h, currentPrice, marketValue, avgCost, pl, plPct, name: q.name || h.symbol };
    });
  }, [transactions, quotes]);

  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  // Allocation data for pie chart
  const allocationData = holdings.map(h => ({
    name: h.symbol,
    value: h.marketValue,
    pct: totalValue > 0 ? (h.marketValue / totalValue * 100) : 0,
  }));

  const addTransaction = () => {
    if (!form.symbol || !form.shares || !form.price) return;
    setTransactions(prev => [...prev, {
      id: Date.now(),
      symbol: form.symbol.toUpperCase(),
      shares: parseFloat(form.shares),
      price: parseFloat(form.price),
      date: form.date,
      type: form.type,
    }]);
    setForm({ symbol: '', shares: '', price: '', date: new Date().toISOString().split('T')[0], type: 'buy' });
    setShowAdd(false);
  };

  const deleteTransaction = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'meridian-portfolio.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data)) setTransactions(data);
        } catch {}
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const isPlPos = totalPL >= 0;

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
          Portfolio Tracker
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          Track your holdings, P&L, and allocation
        </p>
      </div>

      {/* Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Portfolio Value', value: formatPrice(totalValue), color: 'var(--text-primary)' },
          { label: 'Total Cost', value: formatPrice(totalCost), color: 'var(--text-secondary)' },
          { label: 'Total P&L', value: `${isPlPos ? '+' : ''}${formatPrice(totalPL)}`, color: isPlPos ? 'var(--green)' : 'var(--red)' },
          { label: 'Return', value: `${isPlPos ? '+' : ''}${totalPLPct.toFixed(2)}%`, color: isPlPos ? 'var(--green)' : 'var(--red)' },
        ].map(item => (
          <div key={item.label} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '16px' }}>
        {/* Holdings Table */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Holdings</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setShowAdd(true)} style={{ backgroundColor: 'var(--gold)', border: 'none', borderRadius: '4px', color: 'var(--bg-primary)', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
          {holdings.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '0 0 12px' }}>No holdings yet. Add a transaction to get started.</p>
              <button onClick={() => setShowAdd(true)} style={{ backgroundColor: 'var(--gold)', border: 'none', borderRadius: '6px', color: 'var(--bg-primary)', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                Add Transaction
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Symbol', 'Shares', 'Avg Cost', 'Price', 'Value', 'P&L', 'P&L %'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const isPos = h.pl >= 0;
                    const plColor = isPos ? 'var(--green)' : 'var(--red)';
                    return (
                      <tr key={h.symbol}
                        onClick={() => { setActiveSymbol(h.symbol); setActiveTab('Terminal'); }}
                        style={{ cursor: 'pointer', transition: 'background 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '8px 10px', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>{h.symbol}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{h.shares.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatPrice(h.avgCost)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>{formatPrice(h.currentPrice)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatPrice(h.marketValue)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: plColor, fontFamily: 'monospace' }}>{isPos ? '+' : ''}{formatPrice(h.pl)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: plColor, fontFamily: 'monospace', fontWeight: 600 }}>{isPos ? '+' : ''}{h.plPct.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocation Donut */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: 'var(--card-shadow)', padding: '16px' }}>
          <div style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>Allocation</div>
          {allocationData.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.name}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatPrice(d.value)} ({d.pct.toFixed(1)}%)</div>
                      </div>
                    );
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div>
                {allocationData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>{d.name}</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace' }}>{d.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaction Log */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Transaction Log</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={exportData} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', padding: '3px 8px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={10} /> Export
            </button>
            <button onClick={importData} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', padding: '3px 8px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Upload size={10} /> Import
            </button>
          </div>
        </div>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No transactions yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {['Date', 'Type', 'Symbol', 'Shares', 'Price', 'Total', ''].map((h, i) => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: i < 3 ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...transactions].reverse().map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '11px' }}>{t.date}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: t.type === 'buy' ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>{t.type}</span>
                    </td>
                    <td style={{ padding: '6px 10px', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>{t.symbol}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{t.shares}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatPrice(t.price)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatPrice(t.shares * t.price)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <button onClick={() => deleteTransaction(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAdd(false)}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Add Transaction</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', gap: '0', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
              {['buy', 'sell'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ flex: 1, padding: '8px', border: 'none', backgroundColor: form.type === t ? (t === 'buy' ? 'var(--green)' : 'var(--red)') : 'var(--bg-primary)', color: form.type === t ? '#000' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
            {[
              { label: 'Symbol', key: 'symbol', type: 'text', placeholder: 'AAPL' },
              { label: 'Shares', key: 'shares', type: 'number', placeholder: '10' },
              { label: 'Price per Share', key: 'price', type: 'number', placeholder: '150.00' },
              { label: 'Date', key: 'date', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '10px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: f.key === 'symbol' ? e.target.value.toUpperCase() : e.target.value }))}
                  type={f.type} placeholder={f.placeholder}
                  style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', padding: '8px 10px', outline: 'none', fontFamily: f.key === 'symbol' ? 'monospace' : 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={addTransaction} style={{ width: '100%', backgroundColor: 'var(--gold)', border: 'none', borderRadius: '6px', color: 'var(--bg-primary)', fontSize: '13px', fontWeight: 700, padding: '10px', cursor: 'pointer', marginTop: '8px' }}>
              Add {form.type === 'buy' ? 'Buy' : 'Sell'} Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
