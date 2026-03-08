import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ExternalLink, ChevronDown, ChevronUp, Plus, Bell } from 'lucide-react';
import { useStockData } from '../../hooks/useStockData';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import {
  formatPrice, formatChange, formatPercent, formatMarketCap,
  formatVolume, formatDate,
} from '../../utils/formatters';

function StatCard({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
    }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
        {value || '\u2014'}
      </div>
    </div>
  );
}

function PriceTargetBar({ symbol, currentPrice }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!symbol) return;
    api.analyst(symbol).then(d => setData(d)).catch(() => {});
  }, [symbol]);

  if (!data || data.targetLowPrice == null || data.targetHighPrice == null || !currentPrice) return null;

  const low = data.targetLowPrice;
  const high = data.targetHighPrice;
  const mean = data.targetMeanPrice;
  const range = high - low;
  if (range <= 0) return null;

  const pricePct = Math.min(100, Math.max(0, ((currentPrice - low) / range) * 100));
  const meanPct = mean != null ? Math.min(100, Math.max(0, ((mean - low) / range) * 100)) : null;

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analyst Price Target</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{data.numberOfAnalysts || ''} analysts</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: 'var(--red)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>{formatPrice(low)}</span>
        {mean != null && <span style={{ color: 'var(--gold)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>Mean: {formatPrice(mean)}</span>}
        <span style={{ color: 'var(--green)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>{formatPrice(high)}</span>
      </div>
      <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '4px',
          background: 'linear-gradient(90deg, var(--red), var(--gold), var(--green))',
          width: '100%', opacity: 0.3,
        }} />
        {meanPct != null && (
          <div style={{
            position: 'absolute', top: '50%', left: `${meanPct}%`, transform: 'translate(-50%, -50%)',
            width: '2px', height: '16px', backgroundColor: 'var(--gold)', borderRadius: '1px',
          }} />
        )}
        <div style={{
          position: 'absolute', top: '50%', left: `${pricePct}%`, transform: 'translate(-50%, -50%)',
          width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--text-primary)',
          border: '2px solid var(--bg-secondary)', boxShadow: '0 0 4px rgba(0,0,0,0.3)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>Bear</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>Current: {formatPrice(currentPrice)}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>Bull</span>
      </div>
    </div>
  );
}

function SkeletonBlock({ width = '100%', height = '16px', style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, ...style }} />
  );
}

function LogoWithFallback({ src, symbol, size = 48 }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--gold)', fontSize: `${size * 0.35}px`, fontWeight: 700, fontFamily: 'monospace',
      }}>
        {(symbol || '?')[0]}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={symbol}
      style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain', backgroundColor: 'transparent', borderRadius: '4px' }}
      onError={() => setFailed(true)}
    />
  );
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: 'var(--card-shadow)',
  marginBottom: '16px',
};

const SECTION_HEADER = {
  color: 'var(--gold)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  margin: 0,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-color)',
};

// ── Analyst Ratings Mini ──
function AnalystRatingsMini({ symbol }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!symbol) return;
    api.analyst(symbol).then(d => setData(d)).catch(() => {});
  }, [symbol]);

  if (!data) return null;

  const { strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0 } = data;
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return null;

  const bullish = strongBuy + buy;
  const bearish = sell + strongSell;
  let consensus = data.recommendation || 'Hold';
  if (consensus === 'none') {
    consensus = 'Hold';
    if (bullish > total * 0.6) consensus = 'Buy';
    if (bullish > total * 0.8) consensus = 'Strong Buy';
    if (bearish > total * 0.6) consensus = 'Sell';
    if (bearish > total * 0.8) consensus = 'Strong Sell';
  }

  const consensusColor = consensus.toLowerCase().includes('buy') ? 'var(--green)' : consensus.toLowerCase().includes('sell') ? 'var(--red)' : 'var(--gold)';
  const fd = data;

  const segments = [
    { label: 'Strong Buy', count: strongBuy, color: '#22c55e' },
    { label: 'Buy', count: buy, color: '#4ade80' },
    { label: 'Hold', count: hold, color: '#eab308' },
    { label: 'Sell', count: sell, color: '#f97316' },
    { label: 'Strong Sell', count: strongSell, color: '#ef4444' },
  ];

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Analyst Ratings</h3>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{
            backgroundColor: consensusColor + '22', color: consensusColor,
            fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '4px',
            border: `1px solid ${consensusColor}44`,
          }}>
            {consensus}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
            {total} analyst{total !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', height: '16px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
          {segments.map(s => s.count > 0 ? (
            <div key={s.label} style={{
              width: `${(s.count / total) * 100}%`, backgroundColor: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: '#000', minWidth: '14px',
            }}>
              {s.count}
            </div>
          ) : null)}
        </div>

        {fd.targetMeanPrice != null && (
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginTop: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Target: <span style={{ color: 'var(--gold)', fontWeight: 600, fontFamily: 'monospace' }}>{formatPrice(fd.targetMeanPrice)}</span>
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>
              Low: {formatPrice(fd.targetLowPrice)} | High: {formatPrice(fd.targetHighPrice)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Peers / Similar Companies with price/change ──
function PeersSection({ profile, symbol }) {
  const { setActiveSymbol } = useApp();
  const peers = (profile?.peersList || profile?.peers || []).filter(p => p !== symbol).slice(0, 12);
  const [peerQuotes, setPeerQuotes] = useState({});

  useEffect(() => {
    if (peers.length === 0) return;
    (async () => {
      try {
        const data = await api.quotes(peers);
        const map = {};
        (Array.isArray(data) ? data : [data]).forEach(q => { if (q?.symbol) map[q.symbol] = q; });
        setPeerQuotes(map);
      } catch {}
    })();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (peers.length === 0) return null;

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Similar Companies</h3>
      <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {peers.map(peer => {
          const q = peerQuotes[peer];
          const pct = q?.changesPercentage ?? q?.changePercent;
          const isPos = (pct || 0) >= 0;
          return (
            <button
              key={peer}
              onClick={() => setActiveSymbol(peer)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--gold)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                transition: 'all 150ms ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--bg-primary)'; }}
            >
              {peer}
              {q?.price != null && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 400 }}>{formatPrice(q.price)}</span>
              )}
              {pct != null && (
                <span style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontSize: '10px', fontWeight: 600 }}>
                  {isPos ? '+' : ''}{Number(pct).toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Insider Trading Feed ──
function InsiderTradingFeed({ symbol }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setTrades([]);
    setLoading(false);
  }, [symbol]);

  if (loading) return null;
  if (trades.length === 0) return null;

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>Insider Trading</h3>
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {trades.map((t, i) => {
          const isBuy = (t.transactionType || '').toLowerCase().includes('purchase') ||
                        (t.transactionType || '').toLowerCase().includes('buy') ||
                        (t.acquistionOrDisposition || '').toUpperCase() === 'A';
          return (
            <div key={i} style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500 }}>
                  {t.reportingName || t.ownerName || 'Unknown'}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginTop: '2px' }}>
                  {t.typeOfOwner || t.ownerType || ''} {t.transactionDate ? `\u2022 ${t.transactionDate}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  color: isBuy ? 'var(--green)' : 'var(--red)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}>
                  {isBuy ? 'BUY' : 'SELL'}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace' }}>
                  {t.securitiesTransacted != null ? Number(t.securitiesTransacted).toLocaleString() : ''} shares
                </div>
                {t.price != null && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontFamily: 'monospace' }}>
                    @ {formatPrice(t.price)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DCF Valuation ──
function DCFValuation({ quote, profile }) {
  if (!quote || !profile) return null;

  const price = quote.price;
  const eps = quote.eps;
  const growthRate = profile.growthRate || 0.08;

  if (eps == null || eps <= 0) return null;

  // Simple DCF: project EPS forward 5 years at growth rate, discount at 10%
  const discountRate = 0.10;
  const terminalMultiple = 15;
  let dcfValue = 0;
  let projectedEPS = eps;

  for (let y = 1; y <= 5; y++) {
    projectedEPS *= (1 + growthRate);
    dcfValue += projectedEPS / Math.pow(1 + discountRate, y);
  }
  // Terminal value
  const terminalValue = (projectedEPS * terminalMultiple) / Math.pow(1 + discountRate, 5);
  dcfValue += terminalValue;

  const upside = ((dcfValue - price) / price) * 100;
  const upsideColor = upside >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div style={CARD_STYLE}>
      <h3 style={SECTION_HEADER}>DCF Estimate</h3>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Intrinsic Value
            </div>
            <div style={{ color: 'var(--gold)', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace' }}>
              {formatPrice(dcfValue)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Current Price
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace' }}>
              {formatPrice(price)}
            </div>
          </div>
        </div>
        <div style={{
          padding: '8px 12px',
          backgroundColor: upsideColor + '15',
          border: `1px solid ${upsideColor}33`,
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            {upside >= 0 ? 'Upside' : 'Downside'} Potential
          </span>
          <span style={{ color: upsideColor, fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
            {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
          </span>
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginTop: '8px' }}>
          Assumptions: {(growthRate * 100).toFixed(0)}% growth, 10% discount, 15x terminal multiple
        </div>
      </div>
    </div>
  );
}

export default function OverviewPanel({ symbol, onAddWatchlist, onAddAlert }) {
  const { quote, profile, loading, error, refetch } = useStockData(symbol);
  const [descExpanded, setDescExpanded] = useState(false);

  if (loading) {
    return (
      <div style={{ padding: '20px 0' }}>
        <SkeletonBlock width="300px" height="32px" style={{ marginBottom: '12px' }} />
        <SkeletonBlock width="180px" height="48px" style={{ marginBottom: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} height="52px" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--red-muted)',
        border: '1px solid #7F1D1D',
        borderRadius: '8px',
        marginBottom: '16px',
      }}>
        <p style={{ color: 'var(--red)', margin: '0 0 8px' }}>{error}</p>
        <button
          onClick={refetch}
          style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!quote || !profile) return null;

  const change = quote.change ?? 0;
  const changePct = quote.changesPercentage ?? 0;
  const isPositive = change >= 0;
  const changeColor = isPositive ? 'var(--green)' : 'var(--red)';
  const price = quote.price;

  // 52-week range from quote endpoint
  const low52 = quote.yearLow;
  const high52 = quote.yearHigh;
  const rangePercent = low52 && high52 && high52 !== low52
    ? Math.min(100, Math.max(0, ((price - low52) / (high52 - low52)) * 100))
    : 50;

  const desc = profile.description || '';
  const shortDesc = desc.length > 300 ? desc.slice(0, 300) + '\u2026' : desc;

  // Dividend yield: from quote (Yahoo returns it directly as percentage)
  const divYield = quote.dividendYield ?? profile.dividendYield ?? profile.lastDiv;
  const dividendYield = divYield != null
    ? `${Number(divYield).toFixed(2)}%`
    : '\u2014';

  const beta = quote.beta ?? profile.beta;

  const forwardPE = quote.forwardPE ?? profile.forwardPE;
  const priceToBook = quote.priceToBook ?? profile.priceToBook;

  const stats = [
    { label: 'Market Cap', value: formatMarketCap(quote.marketCap) },
    { label: 'P/E Ratio', value: quote.pe != null ? Number(quote.pe).toFixed(2) : '\u2014' },
    { label: 'EPS (TTM)', value: quote.eps != null ? `$${Number(quote.eps).toFixed(2)}` : '\u2014' },
    { label: '52W High', value: formatPrice(quote.yearHigh) },
    { label: '52W Low', value: formatPrice(quote.yearLow) },
    { label: 'Volume', value: formatVolume(quote.volume) },
    { label: 'Avg Volume', value: formatVolume(quote.avgVolume) },
    { label: 'Beta', value: beta != null ? Number(beta).toFixed(2) : '\u2014' },
    { label: 'Dividend Yield', value: dividendYield },
    { label: 'Open', value: formatPrice(quote.open) },
    { label: 'Prev Close', value: formatPrice(quote.previousClose) },
    { label: '50D Avg', value: formatPrice(quote.priceAvg50) },
    { label: 'Forward P/E', value: forwardPE != null ? Number(forwardPE).toFixed(2) : '\u2014' },
    { label: 'Price/Book', value: priceToBook != null ? Number(priceToBook).toFixed(2) : '\u2014' },
    { label: '200D Avg', value: formatPrice(quote.priceAvg200) },
  ];

  const logoUrl = `https://financialmodelingprep.com/image-stock/${symbol}.png`;

  return (
    <div className="page-fade-in" style={{ marginBottom: '16px' }}>
      {/* Top: name, ticker, price, change */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <LogoWithFallback src={logoUrl} symbol={symbol} size={48} />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>
            {profile.companyName || quote.name || symbol}
          </h1>
          <span style={{
            backgroundColor: 'var(--gold)',
            color: 'var(--bg-primary)',
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
          }}>
            {symbol}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            {profile.exchangeShortName || quote.exchange || ''}
          </span>
          {onAddWatchlist && (
            <button onClick={onAddWatchlist}
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Plus size={11} /> Watchlist
            </button>
          )}
          {onAddAlert && (
            <button onClick={onAddAlert}
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Bell size={11} /> Alert
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{
            color: 'var(--text-primary)',
            fontSize: '40px',
            fontWeight: 700,
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {formatPrice(price)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPositive ? <TrendingUp size={18} color={changeColor} /> : <TrendingDown size={18} color={changeColor} />}
            <span style={{ color: changeColor, fontSize: '18px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatChange(change)}
            </span>
            <span style={{ color: changeColor, fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
              ({formatPercent(changePct)})
            </span>
          </div>
        </div>

        {/* 52W Range bar */}
        <div style={{ marginTop: '10px', maxWidth: '340px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>52W: {formatPrice(low52)}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{formatPrice(high52)}</span>
          </div>
          <div style={{ height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${rangePercent}%`,
              background: `linear-gradient(90deg, var(--gold-muted), var(--gold))`,
              borderRadius: '2px',
            }} />
            {/* Gold dot at current price */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${rangePercent}%`,
              transform: 'translate(-50%, -50%)',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--gold)',
              border: '2px solid var(--bg-primary)',
              boxShadow: '0 0 4px var(--gold)',
            }} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '6px',
        marginBottom: '16px',
      }}>
        {stats.map(s => <StatCard key={s.label} label={s.label} value={s.value} />)}
      </div>

      {/* Price Target Range Bar */}
      <PriceTargetBar symbol={symbol} currentPrice={price} />

      {/* Company Info */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: 'var(--card-shadow)',
        marginBottom: '16px',
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 12px' }}>
          {descExpanded ? desc : shortDesc}
          {desc.length > 300 && (
            <button
              onClick={() => setDescExpanded(d => !d)}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '12px', padding: '0 0 0 6px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
            >
              {descExpanded ? (<><ChevronUp size={12} /> Less</>) : (<><ChevronDown size={12} /> More</>)}
            </button>
          )}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {profile.sector && (
            <span style={{ border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: '11px', padding: '2px 10px', borderRadius: '12px' }}>
              {profile.sector}
            </span>
          )}
          {profile.industry && (
            <span style={{ border: '1px solid var(--gold-muted)', color: 'var(--gold-muted)', fontSize: '11px', padding: '2px 10px', borderRadius: '12px' }}>
              {profile.industry}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '12px' }}>
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ExternalLink size={11} /> {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {profile.fullTimeEmployees && (
            <span style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{Number(profile.fullTimeEmployees).toLocaleString()}</span> employees
            </span>
          )}
          {profile.city && profile.state && (
            <span style={{ color: 'var(--text-secondary)' }}>
              {profile.city}, {profile.state}
            </span>
          )}
          {profile.ipoDate && (
            <span style={{ color: 'var(--text-secondary)' }}>
              IPO: <span style={{ color: 'var(--text-primary)' }}>{formatDate(profile.ipoDate)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Terminal Additions: 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <AnalystRatingsMini symbol={symbol} />
          <DCFValuation quote={quote} profile={profile} />
        </div>
        <div>
          <PeersSection profile={profile} symbol={symbol} />
          <InsiderTradingFeed symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
