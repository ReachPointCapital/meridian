import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../services/api';

export default function SearchBar({ onSelect, large }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await api.search(q);
      const list = Array.isArray(data) ? data.slice(0, 8) : [];
      setResults(list);
      setOpen(list.length > 0);
      setHighlighted(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (item) => {
    const sym = item.symbol || item.ticker;
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect && onSelect(sym);
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && query) {
        onSelect && onSelect(query.toUpperCase());
        setQuery('');
        setOpen(false);
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
      if (results[highlighted]) select(results[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: large ? '100%' : '320px', maxWidth: large ? '560px' : '320px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: large ? '10px' : '6px',
        padding: large ? '10px 16px' : '6px 10px',
        transition: 'border-color 150ms ease',
      }}
        onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--gold)'}
        onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
      >
        <Search size={large ? 18 : 14} color="var(--text-secondary)" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="search-bar-input"
          placeholder="Search ticker or company..."
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: large ? '16px' : '13px',
            flex: 1,
            fontFamily: 'inherit',
          }}
        />
        {loading && (
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--border-color)', borderTopColor: 'var(--gold)', animation: 'spin 0.6s linear infinite' }} />
        )}
        {query && !loading && (
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <X size={14} color="var(--text-secondary)" />
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          zIndex: 200,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {results.map((r, i) => (
            <div
              key={r.symbol || i}
              onClick={() => select(r)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: i === highlighted ? 'var(--bg-tertiary)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--border-color)' : 'none',
                transition: 'background 100ms ease',
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  backgroundColor: 'var(--gold)',
                  color: 'var(--bg-primary)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                }}>
                  {r.symbol}
                </span>
                <span style={{ color: 'var(--text-primary)', fontSize: '12px' }}>
                  {r.name || r.companyName}
                </span>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.05em' }}>
                {r.exchange || r.exchangeShortName || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
