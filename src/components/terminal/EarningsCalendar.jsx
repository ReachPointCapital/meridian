import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X as XIcon } from 'lucide-react';
import { useEarnings } from '../../hooks/useEarnings';
import { useApp } from '../../context/AppContext';
import { formatDate, formatPrice } from '../../utils/formatters';

function getDateRange(filter) {
  const now = new Date();
  const pad = (d) => d.toISOString().split('T')[0];
  const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; };

  switch (filter) {
    case 'thisWeek': {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const end = addDays(start, 6);
      return [pad(start), pad(end)];
    }
    case 'nextWeek': {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() + (7 - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)));
      const end = addDays(start, 6);
      return [pad(start), pad(end)];
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return [pad(start), pad(end)];
    }
    case '30days': {
      return [pad(now), pad(addDays(now, 30))];
    }
    default:
      // default: today to 14 days out
      return [pad(now), pad(addDays(now, 14))];
  }
}

function getDayName(dateStr) {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function SurpriseBadge({ actual, estimate }) {
  if (actual == null || estimate == null) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{'\u2014'}</span>;
  }
  const surprise = estimate !== 0 ? ((actual - estimate) / Math.abs(estimate)) * 100 : 0;
  const beat = surprise >= 0;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      backgroundColor: beat ? 'var(--green-muted)' : 'var(--red-muted)',
      color: beat ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${beat ? '#16623A' : '#7F1D1D'}`,
    }}>
      {beat ? '+' : ''}{surprise.toFixed(1)}%
    </span>
  );
}

const PAGE_SIZE = 50;

export default function EarningsCalendar({ setActiveTab }) {
  const [filter, setFilter] = useState('default');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { setActiveSymbol } = useApp();

  const [from, to] = getDateRange(filter);
  const { data, loading, error, refetch } = useEarnings(from, to);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(d =>
      (d.symbol || '').toLowerCase().includes(q) ||
      (d.company || d.name || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleRowClick = (symbol) => {
    setActiveSymbol(symbol);
    if (setActiveTab) setActiveTab('Analysis');
  };

  const handleExpand30Days = () => {
    setFilter('30days');
    setPage(0);
  };

  const filters = [
    { key: 'default', label: 'Next 2 Weeks' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'nextWeek', label: 'Next Week' },
    { key: 'month', label: 'This Month' },
    { key: '30days', label: 'Next 30 Days' },
  ];

  // Determine row background color based on beat/miss
  const getRowBg = (row) => {
    const actual = row.epsActual ?? row.eps;
    const estimate = row.epsEstimate ?? row.epsEstimated;
    if (actual == null) return 'transparent'; // upcoming
    if (estimate == null) return 'transparent';
    if (actual >= estimate) return 'rgba(34,197,94,0.06)'; // beat
    return 'rgba(239,68,68,0.06)'; // miss
  };

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
          Earnings Calendar
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          Upcoming earnings releases with EPS estimates and actuals
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(0); }}
              style={{
                background: filter === f.key ? 'var(--bg-tertiary)' : 'none',
                border: '1px solid',
                borderColor: filter === f.key ? 'var(--gold)' : 'var(--border-color)',
                color: filter === f.key ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: '11px',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '5px 10px',
          flex: '0 0 240px',
        }}>
          <Search size={13} color="var(--text-secondary)" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Filter by ticker or company..."
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', width: '100%', fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <XIcon size={12} color="var(--text-secondary)" />
            </button>
          )}
        </div>

        {/* Count */}
        {!loading && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
            {filtered.length} earnings report{filtered.length !== 1 ? 's' : ''} this period
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        {loading ? (
          <div style={{ padding: '16px' }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '36px', width: '100%', marginBottom: '4px' }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', marginBottom: '12px' }}>{error}</p>
            <button onClick={refetch} style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Company', 'Ticker', 'Date', 'Day', 'EPS Est.', 'EPS Actual', 'Surprise %', 'Time'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: h === 'Company' ? 'left' : 'right',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                      <div>No earnings data available. Try expanding the date range.</div>
                      {filter !== '30days' && (
                        <button onClick={handleExpand30Days} style={{
                          marginTop: '12px', background: 'var(--gold)', border: 'none',
                          color: 'var(--bg-primary)', padding: '6px 16px', borderRadius: '4px',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        }}>
                          Load Next 30 Days
                        </button>
                      )}
                    </td>
                  </tr>
                ) : pageData.map((row, i) => {
                  const epsActual = row.epsActual ?? row.eps;
                  const epsEstimate = row.epsEstimate ?? row.epsEstimated;
                  const timeLabel = row.time === 'bmo' ? 'BMO' : row.time === 'amc' ? 'AMC' : row.time === 'unknown' ? '\u2014' : row.time || '\u2014';
                  return (
                    <tr
                      key={`${row.symbol}-${row.date}-${i}`}
                      onClick={() => handleRowClick(row.symbol)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 150ms ease',
                        backgroundColor: getRowBg(row),
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = getRowBg(row)}
                    >
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.company || row.name || '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.symbol}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(row.date)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                        {getDayName(row.date)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {epsEstimate != null ? formatPrice(epsEstimate) : '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {epsActual != null ? formatPrice(epsActual) : '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <SurpriseBadge actual={epsActual} estimate={epsEstimate} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        {timeLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: page === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {page + 1} of {totalPages} {'\u00B7'} {filtered.length} results
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: page >= totalPages - 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
