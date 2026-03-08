import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { getStockNews } from '../../services/fmp';
import { api } from '../../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Math.floor((now - then) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sourceInitial(source) {
  return (source || '?').charAt(0).toUpperCase();
}

const SOURCE_COLORS = ['#C9A84C', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316'];
function getSourceColor(source) {
  let hash = 0;
  for (let i = 0; i < (source || '').length; i++) hash += source.charCodeAt(i);
  return SOURCE_COLORS[hash % SOURCE_COLORS.length];
}

function SourceAvatar({ site, url }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const domain = (() => {
    try { return new URL(url || '').hostname; } catch { return null; }
  })();

  if (domain && !faviconFailed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt={site}
        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', backgroundColor: 'var(--bg-tertiary)', flexShrink: 0 }}
        onError={() => setFaviconFailed(true)}
      />
    );
  }

  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '50%',
      backgroundColor: getSourceColor(site),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#0A0E1A', fontWeight: 700, fontSize: '14px', flexShrink: 0,
    }}>
      {sourceInitial(site)}
    </div>
  );
}

function NewsItem({ item, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const handleExpand = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (summary) return;
    // Try to fetch article summary
    if (item.url) {
      setLoadingSummary(true);
      try {
        const data = await api.article(item.url);
        if (data?.text) {
          setSummary(data.text.slice(0, 500) + (data.text.length > 500 ? '...' : ''));
        } else {
          setSummary(item.text || 'No preview available.');
        }
      } catch {
        setSummary(item.text || 'No preview available.');
      }
      setLoadingSummary(false);
    } else {
      setSummary(item.text || 'No preview available.');
    }
  };

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-color)' }}>
      <div
        onClick={handleExpand}
        style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 8px',
          borderRadius: '4px',
          transition: 'background 150ms ease',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Source icon */}
        <SourceAvatar site={item.site} url={item.url} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <p style={{
              color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, margin: 0,
              lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.title}
            </p>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
              {expanded ? <ChevronUp size={12} color="var(--text-tertiary)" /> : <ChevronDown size={12} color="var(--text-tertiary)" />}
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', padding: '2px' }}>
                <ExternalLink size={12} color="var(--text-tertiary)" />
              </a>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{item.site}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{'\u00B7'}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{timeAgo(item.publishedDate)}</span>
          </div>
        </div>
      </div>

      {/* Expandable dropdown */}
      {expanded && (
        <div style={{
          padding: '0 8px 12px 56px',
          animation: 'fadeIn 150ms ease',
        }}>
          {loadingSummary ? (
            <div className="skeleton" style={{ height: '48px', borderRadius: '6px' }} />
          ) : (
            <p style={{
              color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, margin: 0,
              backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', padding: '10px 12px',
            }}>
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewsFeed({ symbol }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showing, setShowing] = useState(10);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStockNews(symbol, 30);
      setNews(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load news.');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
      <h3 style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>News</h3>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '12px', width: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div style={{ backgroundColor: 'var(--red-muted)', border: '1px solid #7F1D1D', borderRadius: '8px', padding: '16px' }}>
      <p style={{ color: 'var(--red)', margin: '0 0 8px', fontSize: '13px' }}>{error}</p>
      <button onClick={load} style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
        Retry
      </button>
    </div>
  );

  const visible = news.slice(0, showing);

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
      <h3 style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 4px' }}>
        Latest News {'\u2014'} {symbol}
      </h3>

      {news.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
          No recent news for this ticker.
        </p>
      ) : (
        <>
          {visible.map((item, i) => (
            <NewsItem key={item.url || i} item={item} isLast={i === visible.length - 1} />
          ))}

          {showing < news.length && (
            <button
              onClick={() => setShowing(s => s + 10)}
              style={{
                display: 'block', width: '100%', marginTop: '12px', padding: '8px',
                background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px',
                color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
