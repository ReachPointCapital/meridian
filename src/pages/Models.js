import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  { key: '3stmt', label: '3-Statement' },
  { key: 'ma', label: 'M&A' },
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
    { title: '3-Statement', desc: 'Linked income statement, balance sheet, and cash flow model' },
    { title: 'M&A Model', desc: 'Merger accretion/dilution analysis with synergies' },
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%' }}>
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
  const [ebitMargin] = useState(() => lastIncome.operatingIncome && lastIncome.revenue ? (lastIncome.operatingIncome / lastIncome.revenue * 100) : 20);
  const [taxRate, setTaxRate] = useState(21);
  const [shareGrowth, setShareGrowth] = useState(-1);
  const [targetPE, setTargetPE] = useState(() => quote?.pe || 20);

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

// ── 3-Statement Model ──
const STMT_TABS = [
  { key: 'is', label: 'Income Statement' },
  { key: 'bs', label: 'Balance Sheet' },
  { key: 'cf', label: 'Cash Flow' },
];

function ThreeStatementModel({ data, quote }) {
  const income = useMemo(() => Array.isArray(data.incomeStatement) ? [...data.incomeStatement].reverse() : [], [data.incomeStatement]);
  const cfRaw = useMemo(() => Array.isArray(data.cashFlow) ? [...data.cashFlow].reverse() : [], [data.cashFlow]);
  const bsRaw = useMemo(() => Array.isArray(data.balanceSheet) ? [...data.balanceSheet].reverse() : [], [data.balanceSheet]);

  const [subTab, setSubTab] = useState('is');

  const actualYears = useMemo(() => income.map(i => i.calendarYear || i.date?.substring(0, 4) || ''), [income]);
  const lastYear = parseInt(actualYears[actualYears.length - 1]) || new Date().getFullYear();
  const projYearLabels = [`${lastYear + 1}E`, `${lastYear + 2}E`, `${lastYear + 3}E`];
  const numActual = actualYears.length;
  const numProj = 3;
  const cols = `220px repeat(${numActual + numProj}, minmax(90px, 1fr))`;

  const last = income[income.length - 1] || {};
  const lastCF = cfRaw[cfRaw.length - 1] || {};
  const lastBS = useMemo(() => bsRaw[bsRaw.length - 1] || {}, [bsRaw]);

  // IS inputs
  const [revGrowth, setRevGrowth] = useState(8);
  const [cogsPct, setCogsPct] = useState(() => last.costOfRevenue && last.revenue ? (last.costOfRevenue / last.revenue * 100) : 60);
  const [rdPct, setRdPct] = useState(() => last.researchAndDevelopmentExpenses && last.revenue ? (last.researchAndDevelopmentExpenses / last.revenue * 100) : 5);
  const [smPct, setSmPct] = useState(() => last.sellingAndMarketingExpenses && last.revenue ? (last.sellingAndMarketingExpenses / last.revenue * 100) : 5);
  const [gaPct, setGaPct] = useState(() => last.generalAndAdministrativeExpenses && last.revenue ? (last.generalAndAdministrativeExpenses / last.revenue * 100) : 5);
  const [intIncome, setIntIncome] = useState(() => last.interestIncome || 0);
  const [intExpense, setIntExpense] = useState(() => Math.abs(last.interestExpense || 0));
  const [otherIncome, setOtherIncome] = useState(() => last.totalOtherIncomeExpensesNet || 0);
  const [taxRateIS, setTaxRateIS] = useState(21);
  const [sharesOut, setSharesOut] = useState(() => last.weightedAverageShsOutDil || (quote?.marketCap && quote?.price ? Math.round(quote.marketCap / quote.price) : 1e9));
  const [dpsInput, setDpsInput] = useState(0);

  // BS inputs
  const [arDays, setArDays] = useState(() => lastBS.netReceivables && last.revenue ? (lastBS.netReceivables / last.revenue * 365) : 45);
  const [invDays, setInvDays] = useState(() => lastBS.inventory && last.costOfRevenue ? (lastBS.inventory / last.costOfRevenue * 365) : 30);
  const [otherCAPct, setOtherCAPct] = useState(() => lastBS.otherCurrentAssets && last.revenue ? (lastBS.otherCurrentAssets / last.revenue * 100) : 2);
  const [intangibles, setIntangibles] = useState(() => (lastBS.goodwillAndIntangibleAssets || lastBS.goodwill || 0));
  const [otherNonCAPct, setOtherNonCAPct] = useState(() => lastBS.otherNonCurrentAssets && last.revenue ? (lastBS.otherNonCurrentAssets / last.revenue * 100) : 2);
  const [apDays, setApDays] = useState(() => lastBS.accountPayables && last.costOfRevenue ? (lastBS.accountPayables / last.costOfRevenue * 365) : 40);
  const [accruedPct, setAccruedPct] = useState(() => lastBS.otherCurrentLiabilities && last.revenue ? (lastBS.otherCurrentLiabilities / last.revenue * 100) : 3);
  const [shortTermDebt, setShortTermDebt] = useState(() => lastBS.shortTermDebt || 0);
  const [otherCLPct, setOtherCLPct] = useState(1);
  const [longTermDebt, setLongTermDebt] = useState(() => lastBS.longTermDebt || 0);
  const [deferredTaxPct, setDeferredTaxPct] = useState(() => lastBS.deferredTaxLiabilitiesNonCurrent && last.revenue ? (lastBS.deferredTaxLiabilitiesNonCurrent / last.revenue * 100) : 1);
  const [otherNonCLPct, setOtherNonCLPct] = useState(1);
  const [commonStock, setCommonStock] = useState(() => (lastBS.commonStock || 0) + (lastBS.additionalPaidInCapital || 0));
  const [treasuryStock, setTreasuryStock] = useState(() => lastBS.treasuryStock || 0);

  // CFS inputs
  const [daaPct, setDaaPct] = useState(() => lastCF.depreciationAndAmortization && last.revenue ? (Math.abs(lastCF.depreciationAndAmortization) / last.revenue * 100) : 4);
  const [sbcPct, setSbcPct] = useState(() => lastCF.stockBasedCompensation && last.revenue ? (Math.abs(lastCF.stockBasedCompensation) / last.revenue * 100) : 2);
  const [otherWC, setOtherWC] = useState(0);
  const [capexPct, setCapexPct] = useState(() => lastCF.capitalExpenditure && last.revenue ? (Math.abs(lastCF.capitalExpenditure) / last.revenue * 100) : 4);
  const [acquisitions, setAcquisitions] = useState(0);
  const [otherInvesting, setOtherInvesting] = useState(0);
  const [debtIssuance, setDebtIssuance] = useState(0);
  const [shareRepurchases, setShareRepurchases] = useState(0);
  const [otherFinancing, setOtherFinancing] = useState(0);

  const resetDefaults = () => {
    setRevGrowth(8); setTaxRateIS(21); setDpsInput(0);
    setCogsPct(last.costOfRevenue && last.revenue ? (last.costOfRevenue / last.revenue * 100) : 60);
    setRdPct(last.researchAndDevelopmentExpenses && last.revenue ? (last.researchAndDevelopmentExpenses / last.revenue * 100) : 5);
    setSmPct(last.sellingAndMarketingExpenses && last.revenue ? (last.sellingAndMarketingExpenses / last.revenue * 100) : 5);
    setGaPct(last.generalAndAdministrativeExpenses && last.revenue ? (last.generalAndAdministrativeExpenses / last.revenue * 100) : 5);
    setDaaPct(lastCF.depreciationAndAmortization && last.revenue ? (Math.abs(lastCF.depreciationAndAmortization) / last.revenue * 100) : 4);
    setCapexPct(lastCF.capitalExpenditure && last.revenue ? (Math.abs(lastCF.capitalExpenditure) / last.revenue * 100) : 4);
  };

  // Projections (IS)
  const isProj = useMemo(() => {
    const lastRev = last.revenue || 0;
    const arr = [];
    for (let y = 0; y < numProj; y++) {
      const rev = lastRev * Math.pow(1 + revGrowth / 100, y + 1);
      const cogs = rev * cogsPct / 100;
      const gp = rev - cogs;
      const rd = rev * rdPct / 100;
      const sm = rev * smPct / 100;
      const ga = rev * gaPct / 100;
      const totalOpex = cogs + rd + sm + ga;
      const ebit = rev - totalOpex;
      const pretax = ebit + intIncome - intExpense + otherIncome;
      const tax = pretax * taxRateIS / 100;
      const ni = pretax - tax;
      const eps = sharesOut > 0 ? ni / sharesOut : 0;
      const divPaid = dpsInput * sharesOut;
      arr.push({ rev, cogs, gp, rd, sm, ga, totalOpex, ebit, intIncome, intExpense: intExpense, otherIncome, pretax, tax, ni, eps, sharesOut, dps: dpsInput, divPaid });
    }
    return arr;
  }, [last.revenue, revGrowth, cogsPct, rdPct, smPct, gaPct, intIncome, intExpense, otherIncome, taxRateIS, sharesOut, dpsInput, numProj]);

  // CFS projections
  const cfsProj = useMemo(() => {
    const arr = [];
    const lastActualCash = lastBS.cashAndCashEquivalents || 0;
    let prevCash = lastActualCash;
    // Need AR/Inv/AP from last actual for change calcs
    const lastAR = lastBS.netReceivables || 0;
    const lastInv = lastBS.inventory || 0;
    const lastAP = lastBS.accountPayables || 0;

    for (let y = 0; y < numProj; y++) {
      const is = isProj[y];
      const ni = is.ni;
      const daa = is.rev * daaPct / 100;
      const sbc = is.rev * sbcPct / 100;
      const newAR = is.rev / 365 * arDays;
      const newInv = is.cogs / 365 * invDays;
      const newAP = is.cogs / 365 * apDays;
      const prevAR = y === 0 ? lastAR : isProj[y - 1].rev / 365 * arDays;
      const prevInvVal = y === 0 ? lastInv : isProj[y - 1].cogs / 365 * invDays;
      const prevAPVal = y === 0 ? lastAP : isProj[y - 1].cogs / 365 * apDays;
      const chgAR = -(newAR - prevAR);
      const chgInv = -(newInv - prevInvVal);
      const chgAP = newAP - prevAPVal;
      const cfo = ni + daa + sbc + chgAR + chgInv + chgAP + otherWC;

      const capex = -(is.rev * capexPct / 100);
      const cfi = capex + acquisitions + otherInvesting;

      const divPaid = -(is.divPaid);
      const cff = debtIssuance + divPaid + shareRepurchases + otherFinancing;

      const netChange = cfo + cfi + cff;
      const beginCash = prevCash;
      const endCash = beginCash + netChange;
      prevCash = endCash;

      arr.push({ ni, daa, sbc, chgAR, chgInv, chgAP, otherWC, cfo, capex, acquisitions, otherInvesting, cfi, debtIssuance, divPaid, shareRepurchases, otherFinancing, cff, beginCash, netChange, endCash });
    }
    return arr;
  }, [isProj, daaPct, sbcPct, arDays, invDays, apDays, otherWC, capexPct, acquisitions, otherInvesting, debtIssuance, shareRepurchases, otherFinancing, lastBS]);

  // BS projections
  const bsProj = useMemo(() => {
    const arr = [];
    const lastRE = lastBS.retainedEarnings || 0;
    let prevPPEGross = lastBS.propertyPlantEquipmentNet ? (lastBS.propertyPlantEquipmentNet + (lastBS.accumulatedDepreciation || 0)) : (lastBS.propertyPlantEquipmentNet || 0);
    let cumDep = lastBS.accumulatedDepreciation || 0;
    let prevRE = lastRE;

    for (let y = 0; y < numProj; y++) {
      const is = isProj[y];
      const cfs = cfsProj[y];
      const cash = cfs.endCash;
      const ar = is.rev / 365 * arDays;
      const inv = is.cogs / 365 * invDays;
      const otherCA = is.rev * otherCAPct / 100;
      const totalCA = cash + ar + inv + otherCA;

      const capexAbs = Math.abs(cfs.capex);
      const ppeGross = prevPPEGross + capexAbs;
      cumDep = cumDep + cfs.daa;
      const ppeNet = ppeGross - cumDep;
      const otherNonCA = is.rev * otherNonCAPct / 100;
      const totalAssets = totalCA + ppeNet + intangibles + otherNonCA;

      const ap = is.cogs / 365 * apDays;
      const accrued = is.rev * accruedPct / 100;
      const otherCL = is.rev * otherCLPct / 100;
      const totalCL = ap + accrued + shortTermDebt + otherCL;

      const deferredTax = is.rev * deferredTaxPct / 100;
      const otherNonCL = is.rev * otherNonCLPct / 100;
      const totalLiabilities = totalCL + longTermDebt + deferredTax + otherNonCL;

      const re = prevRE + is.ni - is.divPaid;
      prevRE = re;
      const totalEquity = commonStock + re + treasuryStock;
      const totalLE = totalLiabilities + totalEquity;
      const balCheck = Math.abs(totalAssets - totalLE);

      prevPPEGross = ppeGross;

      arr.push({ cash, ar, inv, otherCA, totalCA, ppeGross, cumDep, ppeNet, intangibles, otherNonCA, totalAssets, ap, accrued, shortTermDebt, otherCL, totalCL, longTermDebt, deferredTax, otherNonCL, totalLiabilities, commonStock, re, treasuryStock, totalEquity, totalLE, balCheck });
    }
    return arr;
  }, [isProj, cfsProj, arDays, invDays, otherCAPct, intangibles, otherNonCAPct, apDays, accruedPct, shortTermDebt, otherCLPct, longTermDebt, deferredTaxPct, otherNonCLPct, commonStock, treasuryStock, lastBS]);

  const valCell = (v, isNeg) => ({ ...VAL_CELL, color: isNeg ? '#f87171' : '#ffffff' });
  const goldRow = { ...DATA_ROW, backgroundColor: 'rgba(240,165,0,0.04)' };
  const goldLabel = { ...LABEL_CELL, color: '#F0A500', fontWeight: 700 };

  // Summary metrics
  const rev2025 = isProj[0]?.rev;
  const ebitdaMargin = isProj[0] ? ((isProj[0].ebit + (isProj[0].rev * daaPct / 100)) / isProj[0].rev * 100) : 0;
  const ni2025 = isProj[0]?.ni;
  const fcf2025 = cfsProj[0]?.cfo + cfsProj[0]?.cfi;

  const renderRow = (label, actuals, projVals, opts = {}) => {
    const { gold, bold, input, inputVal, inputSet, inputSuffix } = opts;
    const rowStyle = gold ? goldRow : DATA_ROW;
    const lblStyle = gold ? goldLabel : LABEL_CELL;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, ...rowStyle, fontWeight: bold ? 700 : undefined }} className="hover-row">
        <div style={lblStyle}>{label}</div>
        {actuals.map((v, i) => <div key={i} style={gold ? GOLD_CELL : valCell(v, v < 0)}>{fmtB(v)}</div>)}
        {input ? (
          <>
            <CellInput value={inputVal} onChange={inputSet} suffix={inputSuffix || '%'} />
            {projVals.slice(1).map((v, i) => <div key={i} style={gold ? GOLD_CELL : valCell(v, v < 0)}>{fmtB(v)}</div>)}
          </>
        ) : (
          projVals.map((v, i) => <div key={i} style={gold ? GOLD_CELL : valCell(v, v < 0)}>{fmtB(v)}</div>)
        )}
      </div>
    );
  };

  const renderPctRow = (label, actuals, projVals, opts = {}) => {
    const { input, inputVal, inputSet } = opts;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
        <div style={LABEL_CELL}>{label}</div>
        {actuals.map((v, i) => <div key={i} style={valCell(v, v < 0)}>{fmtPct(v)}</div>)}
        {input ? (
          <>
            <CellInput value={inputVal} onChange={inputSet} />
            {projVals.slice(1).map((v, i) => <div key={i} style={VAL_CELL}>{fmtPct(v)}</div>)}
          </>
        ) : (
          projVals.map((v, i) => <div key={i} style={valCell(v, v < 0)}>{fmtPct(v)}</div>)
        )}
      </div>
    );
  };

  const colHeaders = (
    <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
      <div style={LABEL_CELL}>Line Item</div>
      {actualYears.map(y => <div key={y} style={VAL_CELL}>{y}A</div>)}
      {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: '#93c5fd' }}>{y}</div>)}
    </div>
  );

  const sectionLabel = (text) => (
    <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
      <div style={{ ...LABEL_CELL, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{text}</div>
    </div>
  );

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {STMT_TABS.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)} style={{
              padding: '5px 14px', fontSize: '11px', fontWeight: 500, borderRadius: '20px', cursor: 'pointer', transition: 'all 150ms',
              border: 'none',
              background: subTab === t.key ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: subTab === t.key ? '#ffffff' : 'rgba(255,255,255,0.4)',
            }}>{t.label}</button>
          ))}
        </div>
        <button onClick={resetDefaults} style={{
          padding: '5px 12px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          border: '1px solid var(--border-color)', borderRadius: '4px', background: 'transparent',
          color: 'var(--text-tertiary)', cursor: 'pointer',
        }}>Reset to Defaults</button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: `Revenue (${lastYear + 1}E)`, value: fmtB(rev2025) },
          { label: 'EBITDA Margin', value: fmtPct(ebitdaMargin) },
          { label: 'Net Income', value: fmtB(ni2025) },
          { label: 'FCF', value: fmtB(fcf2025) },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'rgba(240,165,0,0.06)', borderRadius: '6px', padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ color: '#F0A500', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Income Statement */}
      {subTab === 'is' && (
        <div style={CARD}>
          <h3 style={HEADER}>Income Statement</h3>
          <div style={{ overflowX: 'auto' }}>
            {colHeaders}
            {sectionLabel('REVENUE')}
            {renderRow('Revenue', income.map(d => d.revenue), isProj.map(p => p.rev), { gold: true })}
            {renderPctRow('Revenue Growth %', income.map((d, i) => i === 0 ? null : ((d.revenue - income[i - 1].revenue) / Math.abs(income[i - 1].revenue) * 100)), isProj.map(() => revGrowth), { input: true, inputVal: revGrowth, inputSet: setRevGrowth })}

            {sectionLabel('COST STRUCTURE')}
            {renderRow('Cost of Revenue', income.map(d => d.costOfRevenue), isProj.map(p => p.cogs))}
            {renderPctRow('COGS % of Revenue', income.map(d => d.revenue ? (d.costOfRevenue / d.revenue * 100) : 0), isProj.map(() => cogsPct), { input: true, inputVal: cogsPct, inputSet: setCogsPct })}
            {renderRow('Gross Profit', income.map(d => d.grossProfit), isProj.map(p => p.gp), { gold: true })}
            {renderPctRow('Gross Margin %', income.map(d => d.revenue ? (d.grossProfit / d.revenue * 100) : 0), isProj.map(p => p.rev ? (p.gp / p.rev * 100) : 0))}
            {renderRow('R&D', income.map(d => d.researchAndDevelopmentExpenses || 0), isProj.map(p => p.rd))}
            {renderPctRow('R&D % of Revenue', income.map(d => d.revenue ? ((d.researchAndDevelopmentExpenses || 0) / d.revenue * 100) : 0), isProj.map(() => rdPct), { input: true, inputVal: rdPct, inputSet: setRdPct })}
            {renderRow('Sales & Marketing', income.map(d => d.sellingAndMarketingExpenses || 0), isProj.map(p => p.sm))}
            {renderPctRow('S&M % of Revenue', income.map(d => d.revenue ? ((d.sellingAndMarketingExpenses || 0) / d.revenue * 100) : 0), isProj.map(() => smPct), { input: true, inputVal: smPct, inputSet: setSmPct })}
            {renderRow('G&A', income.map(d => d.generalAndAdministrativeExpenses || 0), isProj.map(p => p.ga))}
            {renderPctRow('G&A % of Revenue', income.map(d => d.revenue ? ((d.generalAndAdministrativeExpenses || 0) / d.revenue * 100) : 0), isProj.map(() => gaPct), { input: true, inputVal: gaPct, inputSet: setGaPct })}
            {renderRow('Total OpEx', income.map(d => (d.costOfRevenue || 0) + (d.researchAndDevelopmentExpenses || 0) + (d.sellingAndMarketingExpenses || 0) + (d.generalAndAdministrativeExpenses || 0)), isProj.map(p => p.totalOpex))}

            {sectionLabel('PROFITABILITY')}
            {renderRow('EBIT', income.map(d => d.operatingIncome), isProj.map(p => p.ebit), { gold: true })}
            {renderPctRow('EBIT Margin %', income.map(d => d.revenue ? (d.operatingIncome / d.revenue * 100) : 0), isProj.map(p => p.rev ? (p.ebit / p.rev * 100) : 0))}
            {renderRow('Interest Income', income.map(d => d.interestIncome || 0), isProj.map(() => intIncome), { input: true, inputVal: intIncome, inputSet: setIntIncome, inputSuffix: '' })}
            {renderRow('Interest Expense', income.map(d => Math.abs(d.interestExpense || 0)), isProj.map(() => intExpense), { input: true, inputVal: intExpense, inputSet: setIntExpense, inputSuffix: '' })}
            {renderRow('Other Income/Expense', income.map(d => d.totalOtherIncomeExpensesNet || 0), isProj.map(() => otherIncome), { input: true, inputVal: otherIncome, inputSet: setOtherIncome, inputSuffix: '' })}
            {renderRow('Pre-tax Income', income.map(d => d.incomeBeforeTax), isProj.map(p => p.pretax))}
            {renderRow('Income Tax', income.map(d => d.incomeTaxExpense), isProj.map(p => p.tax))}
            {renderPctRow('Tax Rate %', income.map(d => d.incomeBeforeTax ? (d.incomeTaxExpense / d.incomeBeforeTax * 100) : 0), isProj.map(() => taxRateIS), { input: true, inputVal: taxRateIS, inputSet: setTaxRateIS })}
            {renderRow('Net Income', income.map(d => d.netIncome), isProj.map(p => p.ni), { gold: true, bold: true })}
            {renderPctRow('Net Margin %', income.map(d => d.revenue ? (d.netIncome / d.revenue * 100) : 0), isProj.map(p => p.rev ? (p.ni / p.rev * 100) : 0))}

            {sectionLabel('PER SHARE')}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Diluted Shares</div>
              {income.map((d, i) => <div key={i} style={VAL_CELL}>{d.weightedAverageShsOutDil ? (d.weightedAverageShsOutDil / 1e6).toFixed(0) + 'M' : '\u2014'}</div>)}
              <CellInput value={(sharesOut / 1e6)} onChange={v => setSharesOut(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{(sharesOut / 1e6).toFixed(0)}M</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...goldRow }} className="hover-row">
              <div style={goldLabel}>EPS (Diluted)</div>
              {income.map((d, i) => <div key={i} style={GOLD_CELL}>{d.eps != null ? fmtPS(d.eps) : '\u2014'}</div>)}
              {isProj.map((p, i) => <div key={i} style={GOLD_CELL}>{fmtPS(p.eps)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>DPS</div>
              {income.map((d, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
              <CellInput value={dpsInput} onChange={setDpsInput} suffix="" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtPS(dpsInput)}</div>)}
            </div>
            {renderRow('Dividends Paid', income.map(() => 0), isProj.map(p => p.divPaid))}
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {subTab === 'bs' && (
        <div style={CARD}>
          <h3 style={HEADER}>Balance Sheet</h3>
          <div style={{ overflowX: 'auto' }}>
            {colHeaders}

            {sectionLabel('CURRENT ASSETS')}
            {renderRow('Cash & Equivalents', bsRaw.map(d => d.cashAndCashEquivalents || 0), bsProj.map(p => p.cash), { gold: false })}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Accounts Receivable</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.netReceivables || 0)}</div>)}
              <CellInput value={arDays} onChange={setArDays} suffix=" d" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.ar)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Inventory</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.inventory || 0)}</div>)}
              <CellInput value={invDays} onChange={setInvDays} suffix=" d" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.inv)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Current Assets</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherCurrentAssets || 0)}</div>)}
              <CellInput value={otherCAPct} onChange={setOtherCAPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.otherCA)}</div>)}
            </div>
            {renderRow('Total Current Assets', bsRaw.map(d => d.totalCurrentAssets || 0), bsProj.map(p => p.totalCA), { gold: true })}

            {sectionLabel('NON-CURRENT ASSETS')}
            {renderRow('PP&E (Net)', bsRaw.map(d => d.propertyPlantEquipmentNet || 0), bsProj.map(p => p.ppeNet), { gold: true })}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Intangibles & Goodwill</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.goodwillAndIntangibleAssets || d.goodwill || 0)}</div>)}
              <CellInput value={intangibles / 1e6} onChange={v => setIntangibles(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(intangibles)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Non-Current Assets</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherNonCurrentAssets || 0)}</div>)}
              <CellInput value={otherNonCAPct} onChange={setOtherNonCAPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.otherNonCA)}</div>)}
            </div>
            {renderRow('Total Assets', bsRaw.map(d => d.totalAssets || 0), bsProj.map(p => p.totalAssets), { gold: true, bold: true })}

            {sectionLabel('CURRENT LIABILITIES')}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Accounts Payable</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.accountPayables || 0)}</div>)}
              <CellInput value={apDays} onChange={setApDays} suffix=" d" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.ap)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Accrued Expenses</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherCurrentLiabilities || 0)}</div>)}
              <CellInput value={accruedPct} onChange={setAccruedPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.accrued)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Short-term Debt</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.shortTermDebt || 0)}</div>)}
              <CellInput value={shortTermDebt / 1e6} onChange={v => setShortTermDebt(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(shortTermDebt)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Current Liabilities</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherCurrentLiabilities || 0)}</div>)}
              <CellInput value={otherCLPct} onChange={setOtherCLPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.otherCL)}</div>)}
            </div>
            {renderRow('Total Current Liabilities', bsRaw.map(d => d.totalCurrentLiabilities || 0), bsProj.map(p => p.totalCL), { gold: true })}

            {sectionLabel('NON-CURRENT LIABILITIES')}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Long-term Debt</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.longTermDebt || 0)}</div>)}
              <CellInput value={longTermDebt / 1e6} onChange={v => setLongTermDebt(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(longTermDebt)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Deferred Tax Liabilities</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.deferredTaxLiabilitiesNonCurrent || 0)}</div>)}
              <CellInput value={deferredTaxPct} onChange={setDeferredTaxPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.deferredTax)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Non-Current Liab.</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherNonCurrentLiabilities || 0)}</div>)}
              <CellInput value={otherNonCLPct} onChange={setOtherNonCLPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(bsProj[i + 1]?.otherNonCL)}</div>)}
            </div>
            {renderRow('Total Liabilities', bsRaw.map(d => d.totalLiabilities || 0), bsProj.map(p => p.totalLiabilities), { gold: true })}

            {sectionLabel('SHAREHOLDERS EQUITY')}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Common Stock & APIC</div>
              {bsRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB((d.commonStock || 0) + (d.additionalPaidInCapital || 0))}</div>)}
              <CellInput value={commonStock / 1e6} onChange={v => setCommonStock(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(commonStock)}</div>)}
            </div>
            {renderRow('Retained Earnings', bsRaw.map(d => d.retainedEarnings || 0), bsProj.map(p => p.re), { gold: true })}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Treasury Stock</div>
              {bsRaw.map((d, i) => <div key={i} style={valCell(d.treasuryStock, (d.treasuryStock || 0) < 0)}>{fmtB(d.treasuryStock || 0)}</div>)}
              <CellInput value={treasuryStock / 1e6} onChange={v => setTreasuryStock(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={valCell(treasuryStock, treasuryStock < 0)}>{fmtB(treasuryStock)}</div>)}
            </div>
            {renderRow("Total Shareholders' Equity", bsRaw.map(d => d.totalStockholdersEquity || 0), bsProj.map(p => p.totalEquity), { gold: true })}
            {renderRow('Total Liabilities & Equity', bsRaw.map(d => (d.totalLiabilities || 0) + (d.totalStockholdersEquity || 0)), bsProj.map(p => p.totalLE), { gold: true, bold: true })}

            {/* Balance check */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, height: '32px', alignItems: 'center', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ ...LABEL_CELL, fontSize: '11px', fontWeight: 700 }}>Balance Check</div>
              {actualYears.map((_, i) => <div key={i} style={VAL_CELL}></div>)}
              {bsProj.map((p, i) => (
                <div key={i} style={{ ...VAL_CELL, color: p.balCheck < 1 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '11px' }}>
                  {p.balCheck < 1 ? '\u2713 BALANCED' : `\u2717 ${fmtB(p.balCheck)}`}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Statement */}
      {subTab === 'cf' && (
        <div style={CARD}>
          <h3 style={HEADER}>Cash Flow Statement</h3>
          <div style={{ overflowX: 'auto' }}>
            {colHeaders}

            {sectionLabel('OPERATING ACTIVITIES')}
            {renderRow('Net Income', cfRaw.map(d => d.netIncome || 0), cfsProj.map(p => p.ni), { gold: false })}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Add: D&A</div>
              {cfRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(Math.abs(d.depreciationAndAmortization || 0))}</div>)}
              <CellInput value={daaPct} onChange={setDaaPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(cfsProj[i + 1]?.daa)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Add: Stock-Based Comp</div>
              {cfRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(Math.abs(d.stockBasedCompensation || 0))}</div>)}
              <CellInput value={sbcPct} onChange={setSbcPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(cfsProj[i + 1]?.sbc)}</div>)}
            </div>
            {renderRow('Chg Accounts Receivable', cfRaw.map(d => d.accountsReceivables || 0), cfsProj.map(p => p.chgAR))}
            {renderRow('Chg Inventory', cfRaw.map(d => d.inventory || 0), cfsProj.map(p => p.chgInv))}
            {renderRow('Chg Accounts Payable', cfRaw.map(d => d.accountsPayables || 0), cfsProj.map(p => p.chgAP))}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Working Capital</div>
              {cfRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherWorkingCapital || 0)}</div>)}
              <CellInput value={otherWC / 1e6} onChange={v => setOtherWC(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(otherWC)}</div>)}
            </div>
            {renderRow('Cash from Operations', cfRaw.map(d => d.operatingCashFlow || 0), cfsProj.map(p => p.cfo), { gold: true, bold: true })}

            {sectionLabel('INVESTING ACTIVITIES')}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Capital Expenditures</div>
              {cfRaw.map((d, i) => <div key={i} style={{ ...VAL_CELL, color: '#f87171' }}>{fmtB(d.capitalExpenditure)}</div>)}
              <CellInput value={capexPct} onChange={setCapexPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={{ ...VAL_CELL, color: '#f87171' }}>{fmtB(cfsProj[i + 1]?.capex)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Acquisitions</div>
              {cfRaw.map((d, i) => <div key={i} style={valCell(d.acquisitionsNet, (d.acquisitionsNet || 0) < 0)}>{fmtB(d.acquisitionsNet || 0)}</div>)}
              <CellInput value={acquisitions / 1e6} onChange={v => setAcquisitions(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(acquisitions)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Investing</div>
              {cfRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherInvestingActivites || 0)}</div>)}
              <CellInput value={otherInvesting / 1e6} onChange={v => setOtherInvesting(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(otherInvesting)}</div>)}
            </div>
            {renderRow('Cash from Investing', cfRaw.map(d => (d.capitalExpenditure || 0) + (d.acquisitionsNet || 0) + (d.otherInvestingActivites || 0)), cfsProj.map(p => p.cfi), { gold: true })}

            {sectionLabel('FINANCING ACTIVITIES')}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Debt Issuance / (Repay)</div>
              {cfRaw.map((d, i) => <div key={i} style={valCell(d.debtRepayment, (d.debtRepayment || 0) < 0)}>{fmtB((d.debtRepayment || 0) + (d.netDebtIssuance || 0))}</div>)}
              <CellInput value={debtIssuance / 1e6} onChange={v => setDebtIssuance(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(debtIssuance)}</div>)}
            </div>
            {renderRow('Dividends Paid', cfRaw.map(d => d.dividendsPaid || 0), cfsProj.map(p => p.divPaid))}
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Share Repurchases</div>
              {cfRaw.map((d, i) => <div key={i} style={valCell(d.commonStockRepurchased, (d.commonStockRepurchased || 0) < 0)}>{fmtB(d.commonStockRepurchased || 0)}</div>)}
              <CellInput value={shareRepurchases / 1e6} onChange={v => setShareRepurchases(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(shareRepurchases)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
              <div style={LABEL_CELL}>Other Financing</div>
              {cfRaw.map((d, i) => <div key={i} style={VAL_CELL}>{fmtB(d.otherFinancingActivites || 0)}</div>)}
              <CellInput value={otherFinancing / 1e6} onChange={v => setOtherFinancing(v * 1e6)} suffix="M" />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtB(otherFinancing)}</div>)}
            </div>
            {renderRow('Cash from Financing', cfRaw.map(d => d.netCashUsedProvidedByFinancingActivities || 0), cfsProj.map(p => p.cff), { gold: true })}

            {sectionLabel('CASH RECONCILIATION')}
            {renderRow('Beginning Cash', cfRaw.map((d, i) => i === 0 ? (d.cashAtBeginningOfPeriod || 0) : (cfRaw[i - 1].cashAtEndOfPeriod || 0)), cfsProj.map(p => p.beginCash))}
            {renderRow('Net Change in Cash', cfRaw.map(d => d.netChangeInCash || 0), cfsProj.map(p => p.netChange))}
            {renderRow('Ending Cash', cfRaw.map(d => d.cashAtEndOfPeriod || 0), cfsProj.map(p => p.endCash), { gold: true, bold: true })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── M&A Model ──
function MergerModel() {
  const [acqTicker, setAcqTicker] = useState('');
  const [tgtTicker, setTgtTicker] = useState('');
  const [acqData, setAcqData] = useState(null);
  const [tgtData, setTgtData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Deal inputs
  const [premium, setPremium] = useState(30);
  const [cashPct, setCashPct] = useState(50);
  const [cashIntRate, setCashIntRate] = useState(5);
  const [synY1, setSynY1] = useState(0);
  const [synY2, setSynY2] = useState(0);
  const [maTaxRate, setMaTaxRate] = useState(21);
  const [daWriteups, setDaWriteups] = useState(0);

  const stockPct = 100 - cashPct;

  const fetchCompany = useCallback(async (sym, setter) => {
    if (!sym) return;
    setLoading(true);
    try {
      const d = await api.modelData(sym);
      const q = Array.isArray(d.quote) ? d.quote[0] : d.quote;
      const p = Array.isArray(d.profile) ? d.profile[0] : d.profile;
      const inc = Array.isArray(d.incomeStatement) ? d.incomeStatement[0] : null;
      setter({ quote: q, profile: p, income: inc });
    } catch { setter(null); }
    setLoading(false);
  }, []);

  const handleAcqSearch = (e) => { e.preventDefault(); const t = acqTicker.trim().toUpperCase(); if (t) fetchCompany(t, setAcqData); };
  const handleTgtSearch = (e) => { e.preventDefault(); const t = tgtTicker.trim().toUpperCase(); if (t) fetchCompany(t, setTgtData); };

  const resetDefaults = () => { setPremium(30); setCashPct(50); setCashIntRate(5); setSynY1(0); setSynY2(0); setMaTaxRate(21); setDaWriteups(0); };

  const aq = acqData?.quote;
  const tq = tgtData?.quote;
  const ai = acqData?.income;
  const ti = tgtData?.income;

  const acqPrice = aq?.price || 0;
  const acqShares = aq?.marketCap && aq?.price ? aq.marketCap / aq.price : 0;
  const acqEPS = ai?.eps || (aq?.eps || 0);
  const acqNI = ai?.netIncome || (acqEPS * acqShares);
  const acqPE = acqEPS ? acqPrice / acqEPS : 0;

  const tgtPrice = tq?.price || 0;
  const tgtShares = tq?.marketCap && tq?.price ? tq.marketCap / tq.price : 0;
  const tgtEPS = ti?.eps || (tq?.eps || 0);
  const tgtNI = ti?.netIncome || (tgtEPS * tgtShares);

  const offerPrice = tgtPrice * (1 + premium / 100);
  const transactionValue = offerPrice * tgtShares;
  const fees = transactionValue * 0.01;
  const totalUses = transactionValue + fees;
  const cashPortion = totalUses * cashPct / 100;
  const stockPortion = totalUses * stockPct / 100;
  const newShares = acqPrice > 0 ? stockPortion / acqPrice : 0;

  // Pro forma
  const afterTaxFinCost = cashPortion * cashIntRate / 100 * (1 - maTaxRate / 100);
  const proFormaNI = acqNI + tgtNI + synY1 * 1e6 - afterTaxFinCost - daWriteups * 1e6;
  const proFormaShares = acqShares + newShares;
  const standaloneEPS = acqShares > 0 ? acqNI / acqShares : 0;
  const proFormaEPS = proFormaShares > 0 ? proFormaNI / proFormaShares : 0;
  const accDilAmt = proFormaEPS - standaloneEPS;
  const accDilPct = standaloneEPS !== 0 ? (accDilAmt / Math.abs(standaloneEPS) * 100) : 0;
  const isAccretive = accDilAmt >= 0;

  // Breakeven calcs
  const breakEvenSynergies = useMemo(() => {
    if (!acqShares || !tgtShares) return null;
    // Solve for synergies where proFormaEPS = standaloneEPS
    // acqNI + tgtNI + syn - afterTaxFin - daWU = standaloneEPS * (acqShares + newShares)
    const needed = standaloneEPS * proFormaShares - acqNI - tgtNI + afterTaxFinCost + daWriteups * 1e6;
    return needed / 1e6;
  }, [standaloneEPS, proFormaShares, acqNI, tgtNI, afterTaxFinCost, daWriteups, acqShares, tgtShares]);

  const breakEvenPremium = useMemo(() => {
    if (!acqShares || !tgtPrice || !tgtShares) return null;
    // Binary search for premium where accretion = 0
    let lo = -50, hi = 200;
    for (let iter = 0; iter < 50; iter++) {
      const mid = (lo + hi) / 2;
      const op = tgtPrice * (1 + mid / 100);
      const tv = op * tgtShares;
      const f = tv * 0.01;
      const tu = tv + f;
      const cp = tu * cashPct / 100;
      const sp = tu * stockPct / 100;
      const ns = acqPrice > 0 ? sp / acqPrice : 0;
      const atfc = cp * cashIntRate / 100 * (1 - maTaxRate / 100);
      const pfni = acqNI + tgtNI + synY1 * 1e6 - atfc - daWriteups * 1e6;
      const pfShares = acqShares + ns;
      const pfEPS = pfShares > 0 ? pfni / pfShares : 0;
      if (pfEPS > standaloneEPS) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }, [acqShares, tgtPrice, tgtShares, acqPrice, cashPct, stockPct, cashIntRate, maTaxRate, acqNI, tgtNI, synY1, daWriteups, standaloneEPS]);

  const infoRow = (label, val, opts = {}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{label}</span>
      <span style={{ color: opts.gold ? '#F0A500' : opts.color || '#ffffff', fontSize: '12px', fontWeight: opts.bold ? 700 : 400, fontFamily: 'monospace' }}>{val}</span>
    </div>
  );

  const inputRowMA = (label, val, set, suffix = '%') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input type="number" step="0.1" value={val} onChange={e => set(parseFloat(e.target.value) || 0)}
          style={{ background: 'rgba(147,197,253,0.08)', border: 'none', borderRadius: '4px', color: '#93c5fd', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
        />
        {suffix && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{suffix}</span>}
      </div>
    </div>
  );

  const searchBox = (label, value, onChange, onSubmit) => (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '60px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', flex: 1 }}>
        <Search size={12} color="var(--text-tertiary)" />
        <input value={value} onChange={e => onChange(e.target.value.toUpperCase())} placeholder="TICKER"
          style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, outline: 'none', width: '100%' }}
        />
      </div>
    </form>
  );

  // Empty state for M&A
  if (!acqData && !tgtData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Merger Model (M&A)</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>Analyze whether an acquisition is accretive or dilutive to the acquirer's EPS</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%' }}>
          <div>
            {searchBox('Acquirer', acqTicker, setAcqTicker, handleAcqSearch)}
          </div>
          <div>
            {searchBox('Target', tgtTicker, setTgtTicker, handleTgtSearch)}
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>Enter both tickers and press Enter to load data</p>
      </div>
    );
  }

  return (
    <div>
      {/* Ticker search row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {searchBox('Acquirer', acqTicker, setAcqTicker, handleAcqSearch)}
        {searchBox('Target', tgtTicker, setTgtTicker, handleTgtSearch)}
      </div>

      {loading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>Loading...</div>}

      {/* Acquirer + Target info side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={CARD}>
          <h3 style={HEADER}>Acquirer{aq ? ` — ${aq.symbol}` : ''}</h3>
          <div style={{ padding: '14px' }}>
            {aq ? (<>
              {infoRow('Share Price', fmtPS(acqPrice))}
              {infoRow('Diluted Shares', (acqShares / 1e6).toFixed(1) + 'M')}
              {infoRow('EPS (LTM)', fmtPS(acqEPS))}
              {infoRow('Net Income (LTM)', fmtB(acqNI))}
              {infoRow('P/E Multiple', fmtX(acqPE))}
            </>) : <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '12px 0' }}>Search a ticker above</div>}
          </div>
        </div>
        <div style={CARD}>
          <h3 style={HEADER}>Target{tq ? ` — ${tq.symbol}` : ''}</h3>
          <div style={{ padding: '14px' }}>
            {tq ? (<>
              {infoRow('Share Price', fmtPS(tgtPrice))}
              {infoRow('Diluted Shares', (tgtShares / 1e6).toFixed(1) + 'M')}
              {infoRow('EPS (LTM)', fmtPS(tgtEPS))}
              {infoRow('Net Income (LTM)', fmtB(tgtNI))}
              {inputRowMA('Premium %', premium, setPremium)}
              {infoRow('Offer Price', fmtPS(offerPrice), { gold: true })}
              {infoRow('Transaction Value', fmtB(transactionValue), { gold: true })}
            </>) : <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '12px 0' }}>Search a ticker above</div>}
          </div>
        </div>
      </div>

      {aq && tq && (
        <>
          {/* Deal Structure */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ ...HEADER, padding: 0, border: 'none' }}>Deal Structure</h3>
                <button onClick={resetDefaults} style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Reset</button>
              </div>
              <div style={{ padding: '14px' }}>
                {inputRowMA('% Cash', cashPct, setCashPct)}
                {infoRow('% Stock', fmtPct(stockPct))}
                {inputRowMA('Cash Interest Rate', cashIntRate, setCashIntRate)}
                {inputRowMA('Synergies Yr 1 ($M)', synY1, setSynY1, '$M')}
                {inputRowMA('Synergies Yr 2 ($M)', synY2, setSynY2, '$M')}
                {inputRowMA('Tax Rate', maTaxRate, setMaTaxRate)}
                {inputRowMA('D&A of Write-ups ($M)', daWriteups, setDaWriteups, '$M')}
                {infoRow('New Shares Issued', (newShares / 1e6).toFixed(1) + 'M')}
              </div>
            </div>

            {/* Sources & Uses */}
            <div style={CARD}>
              <h3 style={HEADER}>Sources & Uses</h3>
              <div style={{ padding: '14px' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Uses</div>
                {infoRow('Equity Purchase Price', fmtB(transactionValue))}
                {infoRow('Transaction Fees (1%)', fmtB(fees))}
                {infoRow('Total Uses', fmtB(totalUses), { gold: true, bold: true })}
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '6px' }}>Sources</div>
                {infoRow('Cash', fmtB(cashPortion))}
                {infoRow('Stock Issued', fmtB(stockPortion))}
                {infoRow('Total Sources', fmtB(cashPortion + stockPortion), { gold: true, bold: true })}
                {infoRow('Check', Math.abs(totalUses - (cashPortion + stockPortion)) < 1 ? '\u2713 Balanced' : '\u2717 Mismatch', { color: Math.abs(totalUses - (cashPortion + stockPortion)) < 1 ? '#4ade80' : '#f87171' })}
              </div>
            </div>
          </div>

          {/* Pro Forma EPS */}
          <div style={CARD}>
            <h3 style={HEADER}>Pro Forma EPS Analysis</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}></th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Standalone</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Pro Forma</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Acquirer Net Income', standalone: fmtB(acqNI), proforma: fmtB(acqNI) },
                    { label: '(+) Target Net Income', standalone: '\u2014', proforma: fmtB(tgtNI) },
                    { label: '(+) Synergies', standalone: '\u2014', proforma: fmtB(synY1 * 1e6) },
                    { label: '(-) After-tax Fin. Cost', standalone: '\u2014', proforma: fmtB(-afterTaxFinCost), neg: true },
                    { label: '(-) D&A Write-ups', standalone: '\u2014', proforma: fmtB(-daWriteups * 1e6), neg: true },
                    { label: 'Pro Forma Net Income', standalone: fmtB(acqNI), proforma: fmtB(proFormaNI), gold: true },
                    { label: '', standalone: '', proforma: '' },
                    { label: 'Acquirer Shares', standalone: (acqShares / 1e6).toFixed(1) + 'M', proforma: (acqShares / 1e6).toFixed(1) + 'M' },
                    { label: '(+) New Shares Issued', standalone: '\u2014', proforma: (newShares / 1e6).toFixed(1) + 'M' },
                    { label: 'Pro Forma Shares', standalone: (acqShares / 1e6).toFixed(1) + 'M', proforma: (proFormaShares / 1e6).toFixed(1) + 'M', gold: true },
                    { label: '', standalone: '', proforma: '' },
                    { label: 'Standalone EPS', standalone: fmtPS(standaloneEPS), proforma: '\u2014', gold: true },
                    { label: 'Pro Forma EPS', standalone: '\u2014', proforma: fmtPS(proFormaEPS), gold: true },
                  ].map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 14px', color: r.gold ? '#F0A500' : 'rgba(255,255,255,0.6)', fontWeight: r.gold ? 700 : 400, borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: r.gold ? 'monospace' : 'inherit', fontSize: r.label ? '12px' : '4px' }}>{r.label}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', color: r.gold ? '#F0A500' : '#ffffff', fontWeight: r.gold ? 700 : 400, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.standalone}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', color: r.neg ? '#f87171' : r.gold ? '#F0A500' : '#ffffff', fontWeight: r.gold ? 700 : 400, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.proforma}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Accretion / Dilution result */}
          <div style={{
            marginTop: '16px', padding: '24px', borderRadius: '12px', textAlign: 'center',
            backgroundColor: isAccretive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `2px solid ${isAccretive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              Accretion / (Dilution)
            </div>
            <div style={{ color: isAccretive ? '#22C55E' : '#EF4444', fontSize: '36px', fontWeight: 900, fontFamily: 'monospace' }}>
              {isAccretive ? 'ACCRETIVE' : 'DILUTIVE'}
            </div>
            <div style={{ color: isAccretive ? '#4ade80' : '#f87171', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>
              {accDilAmt >= 0 ? '+' : ''}{fmtPS(accDilAmt)} ({accDilPct >= 0 ? '+' : ''}{accDilPct.toFixed(1)}%)
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', textTransform: 'uppercase' }}>Standalone EPS</div>
                <div style={{ color: '#F0A500', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmtPS(standaloneEPS)}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '20px', display: 'flex', alignItems: 'center' }}>{'\u2192'}</div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', textTransform: 'uppercase' }}>Pro Forma EPS</div>
                <div style={{ color: '#F0A500', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmtPS(proFormaEPS)}</div>
              </div>
            </div>
          </div>

          {/* Breakeven */}
          <div style={{ marginTop: '16px', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Breakeven Synergies</div>
              <div style={{ color: '#F0A500', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                {breakEvenSynergies != null ? `$${breakEvenSynergies.toFixed(1)}M / year` : '\u2014'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Breakeven Premium</div>
              <div style={{ color: '#F0A500', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                {breakEvenPremium != null ? `${breakEvenPremium.toFixed(1)}%` : '\u2014'}
              </div>
            </div>
          </div>
        </>
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

  if (!ticker && activeModel !== 'ma') return <ModelsEmptyState onSearch={handleSearch} />;

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

      {activeModel === 'ma' ? (
        <MergerModel />
      ) : loading ? (
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
          {activeModel === '3stmt' && <ThreeStatementModel data={stockData} quote={quote} />}
        </>
      )}

      <style>{`
        .hover-row:hover { background-color: rgba(255,255,255,0.03) !important; }
      `}</style>
    </div>
  );
}
