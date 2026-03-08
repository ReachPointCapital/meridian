import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function TickerSearch({ onSelect, placeholder, defaultValue, autoFocus, size = 'lg' }) {
  const { theme } = useTheme();
  const lt = theme === 'light';
  const [query, setQuery] = useState(defaultValue || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        const list = Array.isArray(data) ? data.slice(0, 7) : [];
        setResults(list);
        setOpen(list.length > 0);
        setHighlighted(0);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        handleSelect({ symbol: query.trim().toUpperCase() });
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlighted]) {
        handleSelect(results[highlighted]);
      } else if (query.trim()) {
        handleSelect({ symbol: query.trim().toUpperCase() });
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = (result) => {
    setQuery(result.symbol);
    setOpen(false);
    setResults([]);
    onSelect(result.symbol);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Type badge colors
  const typeBadge = (type) => {
    const map = {
      EQUITY: { label: 'Stock', color: '#F0A500' },
      ETF: { label: 'ETF', color: '#3b82f6' },
      CRYPTOCURRENCY: { label: 'Crypto', color: '#a855f7' },
      INDEX: { label: 'Index', color: '#6b7280' },
      MUTUALFUND: { label: 'Fund', color: '#10b981' },
    };
    return map[type] || { label: type || '—', color: '#6b7280' };
  };

  const isLarge = size === 'lg';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: lt ? (open ? '#ffffff' : 'rgba(0,0,0,0.04)') : (open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.05)'),
        border: open
          ? (lt ? '1px solid #b45309' : '1px solid rgba(240,165,0,0.4)')
          : (lt ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)'),
        borderRadius: '8px',
        padding: isLarge ? '12px 16px' : '6px 12px',
        gap: '10px',
        boxShadow: open ? (lt ? '0 0 0 2px rgba(180,83,9,0.12)' : '0 0 0 2px rgba(240,165,0,0.15)') : 'none',
        transition: 'all 0.15s',
      }}>
        <Search size={isLarge ? 18 : 14} style={{ color: lt ? '#9ca3af' : 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder || 'Search any ticker or company...'}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: lt ? '#111827' : '#ffffff',
            fontSize: isLarge ? '15px' : '13px',
            fontFamily: 'inherit',
          }}
        />
        {loading && (
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            border: lt ? '2px solid rgba(180,83,9,0.2)' : '2px solid rgba(240,165,0,0.3)',
            borderTop: lt ? '2px solid #b45309' : '2px solid #F0A500',
            animation: 'tickerSearchSpin 0.6s linear infinite',
            flexShrink: 0,
          }} />
        )}
        {query && !loading && (
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <X size={14} color={lt ? '#9ca3af' : 'rgba(255,255,255,0.3)'} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: lt ? '#ffffff' : '#13181f',
          border: lt ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          zIndex: 1000,
          overflow: 'hidden',
          boxShadow: lt ? '0 8px 32px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {results.map((r, i) => {
            const badge = typeBadge(r.type);
            return (
              <div
                key={r.symbol}
                onMouseDown={() => handleSelect(r)}
                onMouseEnter={() => setHighlighted(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px',
                  background: highlighted === i
                    ? (lt ? '#f9fafb' : 'rgba(240,165,0,0.08)')
                    : 'transparent',
                  cursor: 'pointer',
                  borderBottom: i < results.length - 1
                    ? (lt ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)')
                    : 'none',
                  transition: 'background 0.1s',
                }}
              >
                {/* Ticker */}
                <div style={{
                  minWidth: '52px',
                  fontSize: '13px', fontWeight: 700,
                  color: lt ? '#b45309' : '#F0A500',
                  fontFamily: 'monospace',
                }}>
                  {r.symbol}
                </div>
                {/* Company name */}
                <div style={{
                  flex: 1, fontSize: '12px',
                  color: lt ? '#374151' : 'rgba(255,255,255,0.7)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.name || r.symbol}
                </div>
                {/* Type badge */}
                <div style={{
                  fontSize: '9px', fontWeight: 600,
                  color: badge.color,
                  border: `1px solid ${badge.color}40`,
                  borderRadius: '4px', padding: '1px 5px',
                  flexShrink: 0,
                }}>
                  {badge.label}
                </div>
                {/* Exchange */}
                {r.exchange && (
                  <div style={{
                    fontSize: '9px',
                    color: lt ? '#9ca3af' : 'rgba(255,255,255,0.25)',
                    flexShrink: 0, minWidth: '30px', textAlign: 'right',
                  }}>
                    {r.exchange}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes tickerSearchSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
