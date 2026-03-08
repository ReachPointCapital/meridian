import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { formatPrice, formatMarketCap } from '../utils/formatters';

// ── Helpers ──
const fmtB = (v) => {
  if (v == null || isNaN(v)) return '\u2014';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v < 0 ? '-' : '') + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (v < 0 ? '-' : '') + '$' + (abs / 1e3).toFixed(1) + 'K';
  return '$' + Number(v).toFixed(0);
};

const fmtPct = (v) => {
  if (v == null || isNaN(v)) return '\u2014';
  return Number(v).toFixed(1) + '%';
};

const fmtPS = (v) => {
  if (v == null || isNaN(v)) return '\u2014';
  return '$' + Number(v).toFixed(2);
};

const fmtX = (v) => {
  if (v == null || isNaN(v)) return '\u2014';
  return Number(v).toFixed(1) + 'x';
};

const CARD = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: 'var(--card-shadow)',
  marginBottom: '16px',
};

const HEADER = {
  color: 'var(--gold)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  margin: 0,
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-color)',
};

const SECTION_ROW = {
  display: 'grid',
  height: '28px',
  alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
};

const DATA_ROW = {
  display: 'grid',
  height: '32px',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: '12px',
  fontFamily: 'monospace',
  transition: 'background 100ms',
};

const LABEL_CELL = {
  paddingLeft: '16px',
  color: 'rgba(255,255,255,0.7)',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  position: 'sticky',
  left: 0,
  backgroundColor: 'var(--bg-secondary)',
  zIndex: 5,
  width: '220px',
  minWidth: '220px',
};

const VAL_CELL = {
  textAlign: 'right',
  paddingRight: '12px',
  minWidth: '90px',
  whiteSpace: 'nowrap',
};

const INPUT_CELL = {
  ...VAL_CELL,
  color: '#93c5fd',
  backgroundColor: 'rgba(147,197,253,0.08)',
};

const GOLD_CELL = {
  ...VAL_CELL,
  color: '#F0A500',
  fontWeight: 700,
};

// ── Spreadsheet Input ──
function CellInput({ value, onChange, suffix = '%' }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => { if (!editing) setLocalVal(String(value)); }, [value, editing]);

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        style={{ ...INPUT_CELL, cursor: 'text' }}
      >
        {Number(localVal).toFixed(1)}{suffix}
      </div>
    );
  }

  return (
    <div style={INPUT_CELL}>
      <input
        type="number"
        step="0.1"
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={() => { setEditing(false); onChange(parseFloat(localVal) || 0); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(parseFloat(localVal) || 0); } }}
        autoFocus
        style={{
          border: 'none',
          borderBottom: '2px solid var(--gold)',
          background: 'transparent',
          color: '#93c5fd',
          textAlign: 'right',
          width: '100%',
          fontFamily: 'monospace',
          fontSize: '12px',
          outline: 'none',
          padding: '0 0 1px 0',
        }}
      />
    </div>
  );
}

// ── Model Tabs ──
const MODEL_TABS = [
  { key: 'dcf', label: 'DCF' },
  { key: 'eps', label: 'EPS' },
  { key: 'lbo', label: 'LBO' },
  { key: 'comps', label: 'Comps' },
];

// ── Popular Tickers ──
const POPULAR = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'SPY', 'QQQ'];

// ── Empty State ──
function ModelsEmptyState({ onSearch }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const t = query.trim().toUpperCase();
    if (t) onSearch(t);
  };

  const descriptions = [
    { title: 'DCF Model', desc: 'Discounted cash flow with WACC builder and sensitivity analysis' },
    { title: 'EPS Model', desc: 'Earnings-per-share projections with implied valuation' },
    { title: 'LBO Model', desc: 'Leveraged buyout returns with MOIC and IRR' },
    { title: 'Comps Model', desc: 'Comparable company analysis with median benchmarks' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '32px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>Financial Models</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Build institutional-grade valuation models for any stock</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '580px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search any ticker, ETF, or company..."
          style={{
            flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '8px', padding: '16px 24px', color: 'var(--text-primary)',
            fontSize: '16px', fontFamily: 'monospace', outline: 'none',
            boxShadow: focused ? '0 0 0 2px rgba(240,165,0,0.3)' : 'none',
            transition: 'box-shadow 150ms ease, border-color 150ms ease',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--gold)'; setFocused(true); }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; setFocused(false); }}
        />
        <button type="submit" style={{
          backgroundColor: 'var(--gold)', border: 'none', borderRadius: '8px',
          padding: '16px 32px', color: 'var(--bg-primary)', fontSize: '15px',
          fontWeight: 600, cursor: 'pointer',
        }}>Search</button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {POPULAR.map(sym => (
          <button key={sym} onClick={() => onSearch(sym)} style={{
            backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            borderRadius: '6px', color: 'var(--gold)', fontSize: '12px', fontWeight: 600,
            fontFamily: 'monospace', padding: '6px 14px', cursor: 'pointer', transition: 'all 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.backgroundColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--bg-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--gold)'; }}
          >{sym}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', width: '100%' }}>
        {descriptions.map(d => (
          <div key={d.title} style={{
            backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{d.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', lineHeight: 1.4 }}>{d.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DCF Model ──
function DCFModel({ data, quote }) {
  const income = Array.isArray(data.incomeStatement) ? [...data.incomeStatement].reverse() : [];
  const cf = Array.isArray(data.cashFlow) ? [...data.cashFlow].reverse() : [];
  const bs = Array.isArray(data.balanceSheet) ? data.balanceSheet : [];

  const lastIncome = income[income.length - 1] || {};
  const lastCF = cf[cf.length - 1] || {};

  // Assumptions
  const [revGrowth, setRevGrowth] = useState(8);
  const [grossMargin, setGrossMargin] = useState(() => lastIncome.grossProfit && lastIncome.revenue ? (lastIncome.grossProfit / lastIncome.revenue * 100) : 40);
  const [ebitdaMargin, setEbitdaMargin] = useState(() => lastIncome.ebitda && lastIncome.revenue ? (lastIncome.ebitda / lastIncome.revenue * 100) : 25);
  const [ebitMargin, setEbitMargin] = useState(() => lastIncome.operatingIncome && lastIncome.revenue ? (lastIncome.operatingIncome / lastIncome.revenue * 100) : 20);
  const [netMargin, setNetMargin] = useState(() => lastIncome.netIncome && lastIncome.revenue ? (lastIncome.netIncome / lastIncome.revenue * 100) : 15);
  const [taxRate, setTaxRate] = useState(21);
  const [daaPct, setDaaPct] = useState(() => lastCF.depreciationAndAmortization && lastIncome.revenue ? Math.abs(lastCF.depreciationAndAmortization) / lastIncome.revenue * 100 : 5);
  const [capexPct, setCapexPct] = useState(() => lastCF.capitalExpenditure && lastIncome.revenue ? Math.abs(lastCF.capitalExpenditure) / lastIncome.revenue * 100 : 4);
  const [nwcPct, setNwcPct] = useState(1);
  const [riskFree, setRiskFree] = useState(4.3);
  const [erp, setErp] = useState(5.5);
  const [beta, setBeta] = useState(() => {
    const p = Array.isArray(data.profile) ? data.profile[0] : data.profile;
    return p?.beta || 1.0;
  });
  const [preTaxDebt, setPreTaxDebt] = useState(5.0);
  const [debtPct, setDebtPct] = useState(() => {
    const b = bs[0] || {};
    const totalDebt = b.totalDebt || 0;
    const mktCap = quote?.marketCap || 1;
    return Math.min(80, Math.max(0, totalDebt / (totalDebt + mktCap) * 100));
  });
  const [termGrowth, setTermGrowth] = useState(2.5);

  // Projections
  const lastRev = lastIncome.revenue || 0;
  const projYears = 5;
  const projected = [];
  for (let y = 0; y < projYears; y++) {
    const rev = lastRev * Math.pow(1 + revGrowth / 100, y + 1);
    const gp = rev * grossMargin / 100;
    const ebitda = rev * ebitdaMargin / 100;
    const ebit = rev * ebitMargin / 100;
    const ni = rev * netMargin / 100;
    const nopat = ebit * (1 - taxRate / 100);
    const daa = rev * daaPct / 100;
    const capex = rev * capexPct / 100;
    const nwc = rev * nwcPct / 100;
    const fcff = nopat + daa - capex - nwc;
    projected.push({ rev, gp, ebitda, ebit, ni, nopat, daa, capex, nwc, fcff });
  }

  // WACC
  const costEquity = riskFree + beta * erp;
  const afterTaxDebt = preTaxDebt * (1 - taxRate / 100);
  const equityPct = 100 - debtPct;
  const wacc = (costEquity * equityPct / 100) + (afterTaxDebt * debtPct / 100);

  // DCF Valuation
  const pvFCFs = projected.map((p, i) => p.fcff / Math.pow(1 + wacc / 100, i + 1));
  const totalPvFCF = pvFCFs.reduce((a, b) => a + b, 0);
  const terminalFCF = projected[projYears - 1].fcff * (1 + termGrowth / 100);
  const terminalValue = wacc > termGrowth ? terminalFCF / ((wacc - termGrowth) / 100) : 0;
  const pvTerminal = terminalValue / Math.pow(1 + wacc / 100, projYears);
  const ev = totalPvFCF + pvTerminal;
  const netDebt = (bs[0]?.totalDebt || 0) - (bs[0]?.cashAndCashEquivalents || 0);
  const equityValue = ev - netDebt;
  const sharesOut = quote?.marketCap && quote?.price ? Math.round(quote.marketCap / quote.price) : 1;
  const impliedPrice = sharesOut > 0 ? equityValue / sharesOut : 0;
  const currentPrice = quote?.price || 0;
  const upside = currentPrice > 0 ? ((impliedPrice - currentPrice) / currentPrice * 100) : 0;

  // Sensitivity
  const sensWaccs = [-1, -0.5, 0, 0.5, 1].map(d => wacc + d);
  const sensGrowths = [-1, -0.5, 0, 0.5, 1].map(d => termGrowth + d);
  const sensTable = sensWaccs.map(w => sensGrowths.map(g => {
    const tv = w > g ? (projected[projYears - 1].fcff * (1 + g / 100)) / ((w - g) / 100) : 0;
    const pvTv = tv / Math.pow(1 + w / 100, projYears);
    const eqVal = totalPvFCF + pvTv - netDebt;
    return sharesOut > 0 ? eqVal / sharesOut : 0;
  }));

  const actualYears = income.map(i => i.calendarYear || i.date?.substring(0, 4) || '');
  const projYearLabels = [];
  const lastYear = parseInt(actualYears[actualYears.length - 1]) || new Date().getFullYear();
  for (let i = 1; i <= projYears; i++) projYearLabels.push(`${lastYear + i}E`);

  const cols = `220px repeat(${actualYears.length + projYears}, minmax(90px, 1fr))`;

  const valCell = (v, isNeg) => ({ ...VAL_CELL, color: isNeg ? '#f87171' : '#ffffff' });

  return (
    <div>
      {/* Income Statement Section */}
      <div style={CARD}>
        <h3 style={HEADER}>Income Statement</h3>
        <div style={{ overflowX: 'auto' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
            <div style={LABEL_CELL}>Line Item</div>
            {actualYears.map(y => <div key={y} style={VAL_CELL}>{y}A</div>)}
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: '#93c5fd' }}>{y}</div>)}
          </div>

          {/* Revenue */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Revenue</div>
            {income.map((d, i) => <div key={i} style={valCell(d.revenue, d.revenue < 0)}>{fmtB(d.revenue)}</div>)}
            {projected.map((p, i) => <div key={i} style={valCell(p.rev)}>{fmtB(p.rev)}</div>)}
          </div>

          {/* Revenue Growth */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Revenue Growth %</div>
            {income.map((d, i) => {
              if (i === 0) return <div key={i} style={VAL_CELL}>{'\u2014'}</div>;
              const prev = income[i - 1].revenue;
              const g = prev ? ((d.revenue - prev) / Math.abs(prev)) * 100 : 0;
              return <div key={i} style={valCell(g, g < 0)}>{fmtPct(g)}</div>;
            })}
            <CellInput value={revGrowth} onChange={setRevGrowth} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(revGrowth)}</div>)}
          </div>

          {/* Gross Profit */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Gross Profit</div>
            {income.map((d, i) => <div key={i} style={valCell(d.grossProfit, d.grossProfit < 0)}>{fmtB(d.grossProfit)}</div>)}
            {projected.map((p, i) => <div key={i} style={valCell(p.gp)}>{fmtB(p.gp)}</div>)}
          </div>

          {/* Gross Margin */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Gross Margin %</div>
            {income.map((d, i) => {
              const m = d.revenue ? (d.grossProfit / d.revenue * 100) : 0;
              return <div key={i} style={VAL_CELL}>{fmtPct(m)}</div>;
            })}
            <CellInput value={grossMargin} onChange={setGrossMargin} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(grossMargin)}</div>)}
          </div>

          {/* EBITDA */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>EBITDA</div>
            {income.map((d, i) => <div key={i} style={valCell(d.ebitda, d.ebitda < 0)}>{fmtB(d.ebitda)}</div>)}
            {projected.map((p, i) => <div key={i} style={valCell(p.ebitda)}>{fmtB(p.ebitda)}</div>)}
          </div>

          {/* EBITDA Margin */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>EBITDA Margin %</div>
            {income.map((d, i) => {
              const m = d.revenue ? (d.ebitda / d.revenue * 100) : 0;
              return <div key={i} style={VAL_CELL}>{fmtPct(m)}</div>;
            })}
            <CellInput value={ebitdaMargin} onChange={setEbitdaMargin} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(ebitdaMargin)}</div>)}
          </div>

          {/* EBIT */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>EBIT (Operating Income)</div>
            {income.map((d, i) => <div key={i} style={valCell(d.operatingIncome, d.operatingIncome < 0)}>{fmtB(d.operatingIncome)}</div>)}
            {projected.map((p, i) => <div key={i} style={valCell(p.ebit)}>{fmtB(p.ebit)}</div>)}
          </div>

          {/* Net Income */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Net Income</div>
            {income.map((d, i) => <div key={i} style={valCell(d.netIncome, d.netIncome < 0)}>{fmtB(d.netIncome)}</div>)}
            {projected.map((p, i) => <div key={i} style={valCell(p.ni, p.ni < 0)}>{fmtB(p.ni)}</div>)}
          </div>

          {/* Net Margin */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Net Margin %</div>
            {income.map((d, i) => {
              const m = d.revenue ? (d.netIncome / d.revenue * 100) : 0;
              return <div key={i} style={valCell(m, m < 0)}>{fmtPct(m)}</div>;
            })}
            <CellInput value={netMargin} onChange={setNetMargin} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(netMargin)}</div>)}
          </div>
        </div>
      </div>

      {/* FCF Bridge */}
      <div style={CARD}>
        <h3 style={HEADER}>Free Cash Flow Bridge</h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
            <div style={LABEL_CELL}>Line Item</div>
            {actualYears.map(y => <div key={y} style={VAL_CELL}>{y}A</div>)}
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: '#93c5fd' }}>{y}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>EBIT</div>
            {income.map((d, i) => <div key={i} style={valCell(d.operatingIncome, d.operatingIncome < 0)}>{fmtB(d.operatingIncome)}</div>)}
            {projected.map((p, i) => <div key={i} style={VAL_CELL}>{fmtB(p.ebit)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Tax Rate %</div>
            {income.map((d, i) => {
              const tr = d.incomeTaxExpense && d.incomeBeforeTax ? (d.incomeTaxExpense / d.incomeBeforeTax * 100) : 0;
              return <div key={i} style={VAL_CELL}>{fmtPct(Math.abs(tr))}</div>;
            })}
            <CellInput value={taxRate} onChange={setTaxRate} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(taxRate)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>NOPAT</div>
            {income.map((d, i) => {
              const tr = d.incomeTaxExpense && d.incomeBeforeTax ? Math.abs(d.incomeTaxExpense / d.incomeBeforeTax) : 0.21;
              return <div key={i} style={VAL_CELL}>{fmtB(d.operatingIncome * (1 - tr))}</div>;
            })}
            {projected.map((p, i) => <div key={i} style={VAL_CELL}>{fmtB(p.nopat)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>D&A</div>
            {cf.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(Math.abs(d.depreciationAndAmortization || 0))}</div>)}
            {income.length > cf.length && Array.from({ length: income.length - cf.length }).map((_, i) => <div key={`pad-${i}`} style={VAL_CELL}>{'\u2014'}</div>)}
            <CellInput value={daaPct} onChange={setDaaPct} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(daaPct)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Capex</div>
            {cf.map((d, i) => <div key={i} style={{ ...VAL_CELL, color: '#f87171' }}>{fmtB(d.capitalExpenditure)}</div>)}
            {income.length > cf.length && Array.from({ length: income.length - cf.length }).map((_, i) => <div key={`pad-${i}`} style={VAL_CELL}>{'\u2014'}</div>)}
            <CellInput value={capexPct} onChange={setCapexPct} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(capexPct)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Change in Working Capital</div>
            {cf.map((d, i) => <div key={i} style={valCell(d.changeInWorkingCapital, (d.changeInWorkingCapital || 0) < 0)}>{fmtB(d.changeInWorkingCapital)}</div>)}
            {income.length > cf.length && Array.from({ length: income.length - cf.length }).map((_, i) => <div key={`pad-${i}`} style={VAL_CELL}>{'\u2014'}</div>)}
            <CellInput value={nwcPct} onChange={setNwcPct} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(nwcPct)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW, backgroundColor: 'rgba(240,165,0,0.04)' }} className="hover-row">
            <div style={{ ...LABEL_CELL, color: '#F0A500', fontWeight: 700 }}>Free Cash Flow (FCFF)</div>
            {cf.map((d, i) => <div key={i} style={GOLD_CELL}>{fmtB(d.freeCashFlow)}</div>)}
            {income.length > cf.length && Array.from({ length: income.length - cf.length }).map((_, i) => <div key={`pad-${i}`} style={GOLD_CELL}>{'\u2014'}</div>)}
            {projected.map((p, i) => <div key={i} style={GOLD_CELL}>{fmtB(p.fcff)}</div>)}
          </div>
        </div>
      </div>

      {/* WACC Builder + DCF Valuation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* WACC */}
        <div style={CARD}>
          <h3 style={HEADER}>WACC Builder</h3>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Risk-Free Rate %', val: riskFree, set: setRiskFree },
              { label: 'Equity Risk Premium %', val: erp, set: setErp },
              { label: 'Beta', val: beta, set: setBeta },
              { label: 'Pre-tax Cost of Debt %', val: preTaxDebt, set: setPreTaxDebt },
              { label: 'Tax Rate %', val: taxRate, set: setTaxRate },
              { label: 'Debt / (Debt + Equity) %', val: debtPct, set: setDebtPct },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{r.label}</span>
                <input type="number" step="0.1" value={r.val} onChange={e => r.set(parseFloat(e.target.value) || 0)}
                  style={{ background: 'rgba(147,197,253,0.08)', border: 'none', borderRadius: '4px', color: '#93c5fd', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
                />
              </div>
            ))}
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                <span>Cost of Equity</span><span style={{ color: '#F0A500' }}>{costEquity.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                <span>After-tax Cost of Debt</span><span style={{ color: '#F0A500' }}>{afterTaxDebt.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600 }}>WACC</span>
                <span style={{ color: '#F0A500', fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' }}>{wacc.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Valuation */}
        <div style={CARD}>
          <h3 style={HEADER}>DCF Valuation</h3>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: 'PV of FCFs (5yr)', val: fmtB(totalPvFCF), gold: true },
              { label: 'Terminal Growth %', input: true, inputVal: termGrowth, inputSet: setTermGrowth },
              { label: 'Terminal Value', val: fmtB(terminalValue), gold: false },
              { label: 'PV of Terminal Value', val: fmtB(pvTerminal), gold: true },
              { label: 'Enterprise Value', val: fmtB(ev), gold: true },
              { label: 'Net Debt', val: fmtB(netDebt), gold: false },
              { label: 'Equity Value', val: fmtB(equityValue), gold: true },
              { label: 'Shares Outstanding', val: sharesOut.toLocaleString(), gold: false },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{r.label}</span>
                {r.input ? (
                  <input type="number" step="0.1" value={r.inputVal} onChange={e => r.inputSet(parseFloat(e.target.value) || 0)}
                    style={{ background: 'rgba(147,197,253,0.08)', border: 'none', borderRadius: '4px', color: '#93c5fd', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
                  />
                ) : (
                  <span style={{ color: r.gold ? '#F0A500' : '#ffffff', fontSize: '12px', fontWeight: r.gold ? 700 : 400, fontFamily: 'monospace' }}>{r.val}</span>
                )}
              </div>
            ))}

            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(240,165,0,0.06)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Implied Share Price</div>
              <div style={{ color: '#F0A500', fontSize: '32px', fontWeight: 900, fontFamily: 'monospace' }}>{fmtPS(impliedPrice)}</div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                Current: {fmtPS(currentPrice)} |{' '}
                <span style={{ color: upside >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity */}
      <div style={CARD}>
        <h3 style={HEADER}>Sensitivity: Implied Price vs WACC & Terminal Growth</h3>
        <div style={{ overflowX: 'auto', padding: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>WACC \ TGR</th>
                {sensGrowths.map(g => (
                  <th key={g} style={{ padding: '6px 10px', color: g === termGrowth ? '#F0A500' : 'rgba(255,255,255,0.4)', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }}>{g.toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensWaccs.map((w, wi) => (
                <tr key={w}>
                  <td style={{ padding: '6px 10px', color: w === wacc ? '#F0A500' : 'rgba(255,255,255,0.4)', fontWeight: w === wacc ? 700 : 400, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{w.toFixed(1)}%</td>
                  {sensTable[wi].map((price, gi) => {
                    const isCenter = wi === 2 && gi === 2;
                    return (
                      <td key={gi} style={{
                        padding: '6px 10px', textAlign: 'right',
                        color: price >= currentPrice ? '#4ade80' : '#f87171',
                        fontWeight: isCenter ? 700 : 400,
                        backgroundColor: isCenter ? 'rgba(240,165,0,0.1)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}>{fmtPS(price)}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── EPS Model ──
function EPSModel({ data, quote }) {
  const income = Array.isArray(data.incomeStatement) ? [...data.incomeStatement].reverse() : [];
  const lastIncome = income[income.length - 1] || {};

  const [revGrowth, setRevGrowth] = useState(8);
  const [grossMargin, setGrossMargin] = useState(() => lastIncome.grossProfit && lastIncome.revenue ? (lastIncome.grossProfit / lastIncome.revenue * 100) : 40);
  const [ebitMargin, setEbitMargin] = useState(() => lastIncome.operatingIncome && lastIncome.revenue ? (lastIncome.operatingIncome / lastIncome.revenue * 100) : 20);
  const [taxRate, setTaxRate] = useState(21);
  const [shareGrowth, setShareGrowth] = useState(-1);
  const [targetPE, setTargetPE] = useState(() => quote?.pe || 20);
  const [dps, setDps] = useState(0);

  const lastRev = lastIncome.revenue || 0;
  const lastShares = lastIncome.weightedAverageShsOutDil || (quote?.marketCap && quote?.price ? quote.marketCap / quote.price : 1e9);
  const projYears = 5;
  const projected = [];
  for (let y = 0; y < projYears; y++) {
    const rev = lastRev * Math.pow(1 + revGrowth / 100, y + 1);
    const gp = rev * grossMargin / 100;
    const ebit = rev * ebitMargin / 100;
    const interest = lastIncome.interestExpense || 0;
    const pretax = ebit - Math.abs(interest);
    const ni = pretax * (1 - taxRate / 100);
    const shares = lastShares * Math.pow(1 + shareGrowth / 100, y + 1);
    const eps = shares > 0 ? ni / shares : 0;
    const impliedPrice = eps * targetPE;
    projected.push({ rev, gp, ebit, interest, pretax, ni, shares, eps, impliedPrice });
  }

  const actualYears = income.map(i => i.calendarYear || i.date?.substring(0, 4) || '');
  const lastYear = parseInt(actualYears[actualYears.length - 1]) || new Date().getFullYear();
  const projYearLabels = Array.from({ length: projYears }, (_, i) => `${lastYear + i + 1}E`);
  const cols = `220px repeat(${actualYears.length + projYears}, minmax(90px, 1fr))`;
  const valCell = (v, isNeg) => ({ ...VAL_CELL, color: isNeg ? '#f87171' : '#ffffff' });
  const currentPrice = quote?.price || 0;

  return (
    <div>
      <div style={CARD}>
        <h3 style={HEADER}>Income Statement</h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
            <div style={LABEL_CELL}>Line Item</div>
            {actualYears.map(y => <div key={y} style={VAL_CELL}>{y}A</div>)}
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: '#93c5fd' }}>{y}</div>)}
          </div>

          {[
            { label: 'Revenue', key: 'revenue', proj: p => p.rev },
            { label: 'Gross Profit', key: 'grossProfit', proj: p => p.gp },
            { label: 'EBIT', key: 'operatingIncome', proj: p => p.ebit },
            { label: 'Net Income', key: 'netIncome', proj: p => p.ni },
          ].map(row => (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>{row.label}</div>
              {income.map((d, i) => <div key={i} style={valCell(d[row.key], (d[row.key] || 0) < 0)}>{fmtB(d[row.key])}</div>)}
              {projected.map((p, i) => <div key={i} style={VAL_CELL}>{fmtB(row.proj(p))}</div>)}
            </div>
          ))}

          {/* Input rows */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Revenue Growth %</div>
            {income.map((d, i) => {
              if (i === 0) return <div key={i} style={VAL_CELL}>{'\u2014'}</div>;
              const g = income[i - 1].revenue ? ((d.revenue - income[i - 1].revenue) / Math.abs(income[i - 1].revenue)) * 100 : 0;
              return <div key={i} style={valCell(g, g < 0)}>{fmtPct(g)}</div>;
            })}
            <CellInput value={revGrowth} onChange={setRevGrowth} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(revGrowth)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Gross Margin %</div>
            {income.map((d, i) => <div key={i} style={VAL_CELL}>{fmtPct(d.revenue ? d.grossProfit / d.revenue * 100 : 0)}</div>)}
            <CellInput value={grossMargin} onChange={setGrossMargin} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(grossMargin)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Tax Rate %</div>
            {income.map((d, i) => {
              const tr = d.incomeBeforeTax ? Math.abs(d.incomeTaxExpense / d.incomeBeforeTax * 100) : 0;
              return <div key={i} style={VAL_CELL}>{fmtPct(tr)}</div>;
            })}
            <CellInput value={taxRate} onChange={setTaxRate} />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPct(taxRate)}</div>)}
          </div>
        </div>
      </div>

      {/* Per Share */}
      <div style={CARD}>
        <h3 style={HEADER}>Per Share Analysis</h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
            <div style={LABEL_CELL}>Line Item</div>
            {actualYears.map(y => <div key={y} style={VAL_CELL}>{y}A</div>)}
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: '#93c5fd' }}>{y}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Diluted Shares (M)</div>
            {income.map((d, i) => <div key={i} style={VAL_CELL}>{d.weightedAverageShsOutDil ? (d.weightedAverageShsOutDil / 1e6).toFixed(0) + 'M' : '\u2014'}</div>)}
            <CellInput value={shareGrowth} onChange={setShareGrowth} />
            {projected.slice(1).map((p, i) => <div key={i} style={VAL_CELL}>{(p.shares / 1e6).toFixed(0)}M</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW, backgroundColor: 'rgba(240,165,0,0.04)' }} className="hover-row">
            <div style={{ ...LABEL_CELL, color: '#F0A500', fontWeight: 700 }}>EPS (Diluted)</div>
            {income.map((d, i) => <div key={i} style={GOLD_CELL}>{d.eps != null ? fmtPS(d.eps) : '\u2014'}</div>)}
            {projected.map((p, i) => <div key={i} style={GOLD_CELL}>{fmtPS(p.eps)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Target P/E Multiple</div>
            {actualYears.map((_, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
            <CellInput value={targetPE} onChange={setTargetPE} suffix="x" />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtX(targetPE)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW, backgroundColor: 'rgba(240,165,0,0.04)' }} className="hover-row">
            <div style={{ ...LABEL_CELL, color: '#F0A500', fontWeight: 700 }}>Implied Price</div>
            {actualYears.map((_, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
            {projected.map((p, i) => <div key={i} style={GOLD_CELL}>{fmtPS(p.impliedPrice)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Implied Upside %</div>
            {actualYears.map((_, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
            {projected.map((p, i) => {
              const up = currentPrice > 0 ? ((p.impliedPrice - currentPrice) / currentPrice * 100) : 0;
              return <div key={i} style={{ ...VAL_CELL, color: up >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{up >= 0 ? '+' : ''}{up.toFixed(1)}%</div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LBO Model ──
function LBOModel({ data, quote }) {
  const income = Array.isArray(data.incomeStatement) ? data.incomeStatement : [];
  const lastIncome = income[0] || {};

  const [entryPrice] = useState(quote?.price || 100);
  const [entryMultiple, setEntryMultiple] = useState(12);
  const [fees, setFees] = useState(2);
  const [debtPct, setDebtPct] = useState(60);
  const [intRate, setIntRate] = useState(7);
  const [revGrowth, setRevGrowth] = useState(5);
  const [ebitdaMarginInput, setEbitdaMarginInput] = useState(() => lastIncome.ebitda && lastIncome.revenue ? (lastIncome.ebitda / lastIncome.revenue * 100) : 25);
  const [capexPct, setCapexPct] = useState(4);
  const [exitYear, setExitYear] = useState(5);
  const [exitMultiple, setExitMultiple] = useState(14);

  const lastRev = lastIncome.revenue || 0;
  const lastEbitda = lastIncome.ebitda || lastRev * ebitdaMarginInput / 100;
  const purchaseEV = lastEbitda * entryMultiple;
  const totalFees = purchaseEV * fees / 100;
  const totalDebt = (purchaseEV + totalFees) * debtPct / 100;
  const equityContrib = purchaseEV + totalFees - totalDebt;

  const years = [];
  let debtBalance = totalDebt;
  for (let y = 1; y <= exitYear; y++) {
    const rev = lastRev * Math.pow(1 + revGrowth / 100, y);
    const ebitda = rev * ebitdaMarginInput / 100;
    const capex = rev * capexPct / 100;
    const interest = debtBalance * intRate / 100;
    const fcf = ebitda - capex - interest;
    const debtPaydown = Math.min(fcf * 0.5, debtBalance);
    debtBalance = Math.max(0, debtBalance - debtPaydown);
    years.push({ y, rev, ebitda, capex, interest, fcf, debtBalance });
  }

  const exitEbitda = years[exitYear - 1]?.ebitda || 0;
  const exitEV = exitEbitda * exitMultiple;
  const exitEquity = exitEV - (years[exitYear - 1]?.debtBalance || 0);
  const moic = equityContrib > 0 ? exitEquity / equityContrib : 0;
  const irr = equityContrib > 0 ? (Math.pow(moic, 1 / exitYear) - 1) * 100 : 0;

  const inputRow = (label, val, set, suffix = '%') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{label}</span>
      <input type="number" step="0.1" value={val} onChange={e => set(parseFloat(e.target.value) || 0)}
        style={{ background: 'rgba(147,197,253,0.08)', border: 'none', borderRadius: '4px', color: '#93c5fd', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
      />
    </div>
  );

  const outputRow = (label, val, gold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{label}</span>
      <span style={{ color: gold ? '#F0A500' : '#ffffff', fontSize: '12px', fontWeight: gold ? 700 : 400, fontFamily: 'monospace' }}>{val}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div style={CARD}>
        <h3 style={HEADER}>LBO Inputs</h3>
        <div style={{ padding: '16px' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Transaction</div>
          {outputRow('Entry Price', fmtPS(entryPrice))}
          {inputRow('Entry EV/EBITDA', entryMultiple, setEntryMultiple, 'x')}
          {inputRow('Transaction Fees %', fees, setFees)}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Financing</div>
          {inputRow('Debt / Total Cap %', debtPct, setDebtPct)}
          {inputRow('Interest Rate %', intRate, setIntRate)}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Operations</div>
          {inputRow('Revenue Growth %/yr', revGrowth, setRevGrowth)}
          {inputRow('EBITDA Margin %', ebitdaMarginInput, setEbitdaMarginInput)}
          {inputRow('Capex % of Revenue', capexPct, setCapexPct)}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Exit</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Exit Year</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[3, 4, 5].map(y => (
                <button key={y} onClick={() => setExitYear(y)} style={{
                  padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  border: exitYear === y ? '1px solid var(--gold)' : '1px solid var(--border-color)',
                  background: exitYear === y ? 'rgba(234,179,8,0.12)' : 'transparent',
                  color: exitYear === y ? 'var(--gold)' : 'var(--text-tertiary)',
                }}>{y}yr</button>
              ))}
            </div>
          </div>
          {inputRow('Exit EV/EBITDA', exitMultiple, setExitMultiple, 'x')}
        </div>
      </div>

      <div style={CARD}>
        <h3 style={HEADER}>LBO Returns</h3>
        <div style={{ padding: '16px' }}>
          {outputRow('Purchase EV', fmtB(purchaseEV), true)}
          {outputRow('Total Debt', fmtB(totalDebt))}
          {outputRow('Equity Contribution', fmtB(equityContrib))}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Year-by-Year</div>
          {years.map(yr => (
            <div key={yr.y} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Y{yr.y}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>EBITDA {fmtB(yr.ebitda)}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>Debt {fmtB(yr.debtBalance)}</span>
            </div>
          ))}
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Exit</div>
          {outputRow('Exit EV', fmtB(exitEV), true)}
          {outputRow('Exit Equity Value', fmtB(exitEquity), true)}
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(240,165,0,0.06)', borderRadius: '8px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>MOIC</div>
              <div style={{ color: '#F0A500', fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' }}>{moic.toFixed(2)}x</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>IRR</div>
              <div style={{ color: irr >= 20 ? '#4ade80' : irr >= 15 ? '#eab308' : '#f87171', fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' }}>{irr.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Comps Model ──
function CompsModel({ data, quote }) {
  const [peerQuotes, setPeerQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const profile = Array.isArray(data.profile) ? data.profile[0] : data.profile;
  const peers = Array.isArray(data.peers) ? (data.peers[0]?.peersList || []).slice(0, 5) : [];

  useEffect(() => {
    if (!peers.length) { setLoading(false); return; }
    (async () => {
      try {
        const res = await api.quotes(peers);
        setPeerQuotes(Array.isArray(res) ? res : []);
      } catch {}
      setLoading(false);
    })();
  }, [peers.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const allRows = [
    ...(quote ? [{ ...quote, _isSubject: true, name: profile?.companyName || quote.name }] : []),
    ...peerQuotes.filter(q => q && q.symbol),
  ];

  const median = (arr, fn) => {
    const vals = arr.map(fn).filter(v => v != null && !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return null;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  };

  const peerOnly = allRows.filter(r => !r._isSubject);
  const medians = {
    price: median(peerOnly, r => r.price),
    marketCap: median(peerOnly, r => r.marketCap),
    pe: median(peerOnly, r => r.pe),
    priceToBook: median(peerOnly, r => r.priceToBook),
  };

  const COL = { padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' };
  const HEAD = { ...COL, color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={CARD}>
      <h3 style={HEADER}>Comparable Companies</h3>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>Loading peer data...</div>
      ) : allRows.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>No comparable company data available</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...HEAD, textAlign: 'left' }}>Company</th>
                <th style={{ ...HEAD, textAlign: 'left' }}>Ticker</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Price</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Mkt Cap</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>P/E</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>P/B</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Chg %</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map(r => (
                <tr key={r.symbol} style={{
                  borderLeft: r._isSubject ? '3px solid #F0A500' : 'none',
                  backgroundColor: r._isSubject ? 'rgba(240,165,0,0.04)' : 'transparent',
                }}>
                  <td style={{ ...COL, textAlign: 'left', color: 'var(--text-primary)', fontWeight: r._isSubject ? 700 : 400, fontFamily: 'inherit' }}>{r.name || r.symbol}</td>
                  <td style={{ ...COL, textAlign: 'left', color: 'var(--gold)', fontWeight: 600 }}>{r.symbol}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-primary)' }}>{formatPrice(r.price)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatMarketCap(r.marketCap)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.pe != null ? r.pe.toFixed(1) : '\u2014'}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.priceToBook != null ? r.priceToBook.toFixed(1) : '\u2014'}</td>
                  <td style={{ ...COL, textAlign: 'right', color: (r.changesPercentage || 0) >= 0 ? '#4ade80' : '#f87171' }}>{r.changesPercentage != null ? `${r.changesPercentage >= 0 ? '+' : ''}${r.changesPercentage.toFixed(2)}%` : '\u2014'}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'rgba(234,179,8,0.06)' }}>
                <td style={{ ...COL, textAlign: 'left', color: '#eab308', fontWeight: 700, fontFamily: 'inherit' }}>MEDIAN</td>
                <td style={COL}></td>
                <td style={{ ...COL, textAlign: 'right', color: '#eab308' }}>{medians.price != null ? formatPrice(medians.price) : '\u2014'}</td>
                <td style={{ ...COL, textAlign: 'right', color: '#eab308' }}>{medians.marketCap != null ? formatMarketCap(medians.marketCap) : '\u2014'}</td>
                <td style={{ ...COL, textAlign: 'right', color: '#eab308' }}>{medians.pe != null ? medians.pe.toFixed(1) : '\u2014'}</td>
                <td style={{ ...COL, textAlign: 'right', color: '#eab308' }}>{medians.priceToBook != null ? medians.priceToBook.toFixed(1) : '\u2014'}</td>
                <td style={COL}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Models Page ──
export default function Models() {
  const { activeSymbol, setActiveSymbol } = useApp();
  const [ticker, setTicker] = useState(activeSymbol || '');
  const [stockData, setStockData] = useState(null);
  const [quote, setQuote] = useState(null);
  const [activeModel, setActiveModel] = useState('dcf');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    if (activeSymbol && activeSymbol !== ticker) setTicker(activeSymbol);
  }, [activeSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    try {
      const data = await api.modelData(ticker);
      setStockData(data);
      const q = Array.isArray(data.quote) ? data.quote[0] : data.quote;
      setQuote(q);
    } catch (e) {
      console.error('Model data fetch failed:', e);
    }
    setLoading(false);
  }, [ticker]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (sym) => {
    setTicker(sym);
    setActiveSymbol(sym);
    setSearchQuery('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const t = searchQuery.trim().toUpperCase();
    if (t) handleSearch(t);
  };

  if (!ticker) return <ModelsEmptyState onSearch={handleSearch} />;

  const profile = stockData ? (Array.isArray(stockData.profile) ? stockData.profile[0] : stockData.profile) : null;

  return (
    <div className="page-fade-in">
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: '56px', zIndex: 50,
        backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)',
        padding: '12px 0', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {quote && (
              <>
                <span style={{ backgroundColor: 'var(--gold)', color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', fontFamily: 'monospace' }}>{ticker}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{profile?.companyName || quote?.name || ticker}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>{formatPrice(quote?.price)}</span>
              </>
            )}
            {!quote && !loading && <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Financial Models</span>}
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
              <Search size={14} color="var(--text-tertiary)" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Change ticker..."
                style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit', width: '140px' }}
              />
            </div>
          </form>
        </div>

        {/* Model tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
          {MODEL_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveModel(t.key)} style={{
              padding: '6px 16px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'all 150ms',
              borderRadius: '4px',
              border: activeModel === t.key ? '1px solid var(--gold)' : '1px solid var(--border-color)',
              background: activeModel === t.key ? 'rgba(234,179,8,0.12)' : 'transparent',
              color: activeModel === t.key ? 'var(--gold)' : 'var(--text-tertiary)',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '200px', marginBottom: '16px', borderRadius: '8px' }} />
          ))}
        </div>
      ) : !stockData ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Failed to load data for {ticker}</div>
      ) : (
        <>
          {activeModel === 'dcf' && <DCFModel data={stockData} quote={quote} />}
          {activeModel === 'eps' && <EPSModel data={stockData} quote={quote} />}
          {activeModel === 'lbo' && <LBOModel data={stockData} quote={quote} />}
          {activeModel === 'comps' && <CompsModel data={stockData} quote={quote} />}
        </>
      )}

      <style>{`
        .hover-row:hover { background-color: rgba(255,255,255,0.03) !important; }
      `}</style>
    </div>
  );
}
