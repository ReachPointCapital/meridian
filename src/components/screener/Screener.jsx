import React, { useState, useEffect, useCallback } from 'react';
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { formatPrice, formatPercent, formatMarketCap, formatVolume } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

const PRESETS = [
  { key: 'most_actives', label: 'Most Active', fetcher: () => api.actives() },
  { key: 'day_gainers', label: 'Top Gainers', fetcher: () => api.gainers() },
  { key: 'day_losers', label: 'Top Losers', fetcher: () => api.losers() },
];

const PAGE_SIZE = 25;

export default function Screener({ setActiveTab }) {
  const { setActiveSymbol } = useApp();
  const [preset, setPreset] = useState('most_actives');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    minMarketCap: '',
    maxMarketCap: '',
    minPE: '',
    maxPE: '',
    minPrice: '',
    maxPrice: '',
    minChange: '',
    maxChange: '',
    minVolume: '',
    sector: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = PRESETS.find(pr => pr.key === preset);
      if (p) {
        const result = await p.fetcher();
        setData(Array.isArray(result) ? result : []);
      }
    } catch {}
    setLoading(false);
  }, [preset]);

  useEffect(() => { fetchData(); setPage(0); }, [fetchData]);

  // Apply client-side filters
  const filtered = data.filter(item => {
    if (filters.minPrice && item.price < parseFloat(filters.minPrice)) return false;
    if (filters.maxPrice && item.price > parseFloat(filters.maxPrice)) return false;
    if (filters.minChange && (item.changesPercentage || 0) < parseFloat(filters.minChange)) return false;
    if (filters.maxChange && (item.changesPercentage || 0) > parseFloat(filters.maxChange)) return false;
    if (filters.minMarketCap && (item.marketCap || 0) < parseFloat(filters.minMarketCap) * 1e9) return false;
    if (filters.maxMarketCap && (item.marketCap || 0) > parseFloat(filters.maxMarketCap) * 1e9) return false;
    if (filters.minPE && (item.pe || 0) < parseFloat(filters.minPE)) return false;
    if (filters.maxPE && (item.pe || 0) > parseFloat(filters.maxPE)) return false;
    if (filters.minVolume && (item.volume || 0) < parseFloat(filters.minVolume) * 1e6) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleNavigate = (sym) => { setActiveSymbol(sym); setActiveTab('Analysis'); };

  const filterField = (label, key, placeholder, suffix) => (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>{label}</label>
      <input value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
        type="number" placeholder={placeholder}
        style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', padding: '5px 8px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
          Stock Screener
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          Filter and discover stocks by key metrics
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px' }}>
        {/* Filter Sidebar */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', boxShadow: 'var(--card-shadow)', alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            <Filter size={14} color="var(--gold)" />
            <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Filters</span>
          </div>

          {/* Presets */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Preset Screen</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => setPreset(p.key)}
                  style={{
                    background: preset === p.key ? 'var(--bg-tertiary)' : 'none',
                    border: '1px solid',
                    borderColor: preset === p.key ? 'var(--gold)' : 'var(--border-color)',
                    color: preset === p.key ? 'var(--gold)' : 'var(--text-secondary)',
                    fontSize: '11px', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {filterField('Min Price ($)', 'minPrice', '0')}
          {filterField('Max Price ($)', 'maxPrice', '1000')}
          {filterField('Min Change (%)', 'minChange', '-10')}
          {filterField('Max Change (%)', 'maxChange', '10')}
          {filterField('Min Mkt Cap ($B)', 'minMarketCap', '1')}
          {filterField('Max Mkt Cap ($B)', 'maxMarketCap', '1000')}
          {filterField('Min P/E', 'minPE', '0')}
          {filterField('Max P/E', 'maxPE', '50')}
          {filterField('Min Volume (M)', 'minVolume', '1')}

          <button onClick={() => setFilters({ minMarketCap: '', maxMarketCap: '', minPE: '', maxPE: '', minPrice: '', maxPrice: '', minChange: '', maxChange: '', minVolume: '', sector: '' })}
            style={{ width: '100%', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', padding: '6px', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>
            Clear Filters
          </button>
        </div>

        {/* Results */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {PRESETS.find(p => p.key === preset)?.label || 'Results'}
            </span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{filtered.length} results</span>
          </div>

          {loading ? (
            <div style={{ padding: '16px' }}>
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '36px', width: '100%', marginBottom: '4px' }} />)}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Symbol', 'Company', 'Price', 'Change', 'Change %', 'Volume', 'Mkt Cap'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: i < 2 ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No results match your filters.</td></tr>
                  ) : pageData.map((item, i) => {
                    const isPos = (item.changesPercentage || 0) >= 0;
                    const chgColor = isPos ? 'var(--green)' : 'var(--red)';
                    return (
                      <tr key={item.symbol || i} onClick={() => handleNavigate(item.symbol)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color)', transition: 'background 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '8px 10px', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>{item.symbol}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '\u2014'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>{formatPrice(item.price)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: chgColor, fontFamily: 'monospace' }}>{item.change != null ? (item.change >= 0 ? '+' : '') + Number(item.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '\u2014'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: chgColor, fontFamily: 'monospace', fontWeight: 600 }}>{formatPercent(item.changesPercentage)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatVolume(item.volume)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatMarketCap(item.marketCap)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '12px' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: page === 0 ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: page >= totalPages - 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
