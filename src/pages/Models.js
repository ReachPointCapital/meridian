import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import TickerSearch from '../components/TickerSearch';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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
  backgroundColor: 'var(--row-section-bg)',
  borderBottom: '1px solid var(--row-border)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const DATA_ROW = {
  display: 'grid',
  height: '32px',
  alignItems: 'center',
  borderBottom: '1px solid var(--row-border)',
  fontSize: '12px',
  fontFamily: 'monospace',
  transition: 'background 100ms',
};

const LABEL_CELL = {
  paddingLeft: '16px',
  color: 'var(--text-label)',
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
  color: 'var(--input-text)',
  backgroundColor: 'var(--input-bg)',
};

const GOLD_CELL = {
  ...VAL_CELL,
  color: 'var(--gold)',
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
          color: 'var(--input-text)',
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
  { key: 'master', label: 'MASTER' },
  { key: 'dcf', label: 'DCF' },
  { key: 'eps', label: 'EPS' },
  { key: 'lbo', label: 'LBO' },
  { key: 'comps', label: 'Comps' },
  { key: '3stmt', label: '3-Statement' },
  { key: 'ma', label: 'M&A' },
];

// ── Scenario Presets ──
const SCENARIOS = [
  { name: 'Bear', description: 'Recession scenario with margin compression and multiple contraction',
    revGrowth: -2, grossMargin: 35, ebitdaMargin: 15, netMargin: 8, taxRate: 25,
    daaPct: 5, capexPct: 3, nwcPct: 2, riskFree: 5.0, erp: 7.0, beta: 1.4,
    preTaxDebt: 7.0, debtPct: 40, termGrowth: 1.5, entryMultiple: 8, exitMultiple: 8,
    lboDebtPct: 50, intRate: 9, targetPE: 12 },
  { name: 'Conservative', description: 'Below-trend growth with cautious assumptions',
    revGrowth: 3, grossMargin: 38, ebitdaMargin: 20, netMargin: 12, taxRate: 23,
    daaPct: 5, capexPct: 4, nwcPct: 1.5, riskFree: 4.5, erp: 6.0, beta: 1.2,
    preTaxDebt: 6.0, debtPct: 35, termGrowth: 2.0, entryMultiple: 10, exitMultiple: 10,
    lboDebtPct: 55, intRate: 8, targetPE: 16 },
  { name: 'Base', description: 'Consensus estimates reflecting current market conditions',
    revGrowth: 8, grossMargin: 42, ebitdaMargin: 25, netMargin: 15, taxRate: 21,
    daaPct: 5, capexPct: 4, nwcPct: 1, riskFree: 4.3, erp: 5.5, beta: 1.0,
    preTaxDebt: 5.0, debtPct: 30, termGrowth: 2.5, entryMultiple: 12, exitMultiple: 12,
    lboDebtPct: 60, intRate: 7, targetPE: 20 },
  { name: 'Bull', description: 'Above-trend growth with margin expansion',
    revGrowth: 15, grossMargin: 48, ebitdaMargin: 30, netMargin: 20, taxRate: 19,
    daaPct: 4, capexPct: 5, nwcPct: 0.5, riskFree: 3.8, erp: 5.0, beta: 0.9,
    preTaxDebt: 4.5, debtPct: 25, termGrowth: 3.0, entryMultiple: 14, exitMultiple: 16,
    lboDebtPct: 65, intRate: 6, targetPE: 25 },
  { name: 'Aggressive', description: 'Hyper-growth with significant multiple expansion',
    revGrowth: 25, grossMargin: 55, ebitdaMargin: 35, netMargin: 25, taxRate: 18,
    daaPct: 3, capexPct: 6, nwcPct: 0, riskFree: 3.5, erp: 4.5, beta: 0.8,
    preTaxDebt: 4.0, debtPct: 20, termGrowth: 3.5, entryMultiple: 16, exitMultiple: 20,
    lboDebtPct: 70, intRate: 5.5, targetPE: 35 },
  { name: 'Custom', description: 'User-defined assumptions — all inputs manually configured',
    revGrowth: 8, grossMargin: 42, ebitdaMargin: 25, netMargin: 15, taxRate: 21,
    daaPct: 5, capexPct: 4, nwcPct: 1, riskFree: 4.3, erp: 5.5, beta: 1.0,
    preTaxDebt: 5.0, debtPct: 30, termGrowth: 2.5, entryMultiple: 12, exitMultiple: 12,
    lboDebtPct: 60, intRate: 7, targetPE: 20 },
];

const defaultScenario = () => ({ ...SCENARIOS[2] });

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
        <p style={{ color: 'var(--text-faint)', fontSize: '14px', margin: 0 }}>Build institutional-grade valuation models for any stock</p>
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
            backgroundColor: 'var(--row-section-bg)', borderRadius: '8px', padding: '16px',
          }}>
            <div style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{d.title}</div>
            <div style={{ color: 'var(--text-faint)', fontSize: '11px', lineHeight: 1.4 }}>{d.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DCF Model ──
function DCFModel({ data, quote }) {
  const income = Array.isArray(data.incomeStatement) ? data.incomeStatement : [];
  const cf = Array.isArray(data.cashFlow) ? data.cashFlow : [];
  const bs = Array.isArray(data.balanceSheet) ? data.balanceSheet : [];

  const lastIncome = income[income.length - 1] || {};
  const lastCF = cf[cf.length - 1] || {};

  // Assumptions
  const [revGrowth, setRevGrowth] = useState(8);
  const [grossMargin, setGrossMargin] = useState(() => lastIncome.grossProfit && lastIncome.revenue ? (lastIncome.grossProfit / lastIncome.revenue * 100) : 40);
  const [ebitdaMargin, setEbitdaMargin] = useState(() => lastIncome.ebitda && lastIncome.revenue ? (lastIncome.ebitda / lastIncome.revenue * 100) : 25);
  const [ebitMargin] = useState(() => lastIncome.ebit && lastIncome.revenue ? (lastIncome.ebit / lastIncome.revenue * 100) : 20);
  const [netMargin, setNetMargin] = useState(() => lastIncome.netIncome && lastIncome.revenue ? (lastIncome.netIncome / lastIncome.revenue * 100) : 15);
  const [taxRate, setTaxRate] = useState(21);
  const [daaPct, setDaaPct] = useState(() => lastCF.depreciationAndAmortization && lastIncome.revenue ? Math.abs(lastCF.depreciationAndAmortization) / lastIncome.revenue * 100 : 5);
  const [capexPct, setCapexPct] = useState(() => lastCF.capitalExpenditure && lastIncome.revenue ? Math.abs(lastCF.capitalExpenditure) / lastIncome.revenue * 100 : 4);
  const [nwcPct, setNwcPct] = useState(1);
  const [riskFree, setRiskFree] = useState(4.3);
  const [erp, setErp] = useState(5.5);
  const [beta, setBeta] = useState(() => data.keyStats?.beta || 1.0);
  const [preTaxDebt, setPreTaxDebt] = useState(5.0);
  const [debtPct, setDebtPct] = useState(() => {
    const b = bs[bs.length - 1] || {};
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
  const netDebt = (bs[bs.length - 1]?.totalDebt || 0) - (bs[bs.length - 1]?.cashAndCashEquivalents || 0);
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

  const actualYears = income.map(i => String(i.year || ''));
  const projYearLabels = [];
  const lastYear = parseInt(actualYears[actualYears.length - 1]) || new Date().getFullYear();
  for (let i = 1; i <= projYears; i++) projYearLabels.push(`${lastYear + i}E`);

  const cols = `220px repeat(${actualYears.length + projYears}, minmax(90px, 1fr))`;

  const valCell = (v, isNeg) => ({ ...VAL_CELL, color: isNeg ? 'var(--accent-red)' : 'var(--text-strong)' });

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
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: 'var(--input-text)' }}>{y}</div>)}
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
            {income.map((d, i) => <div key={i} style={valCell(d.ebit, d.ebit < 0)}>{fmtB(d.ebit)}</div>)}
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
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: 'var(--input-text)' }}>{y}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>EBIT</div>
            {income.map((d, i) => <div key={i} style={valCell(d.ebit, d.ebit < 0)}>{fmtB(d.ebit)}</div>)}
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
              return <div key={i} style={VAL_CELL}>{fmtB(d.ebit * (1 - tr))}</div>;
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
            {cf.map((d, i) => <div key={i} style={{ ...VAL_CELL, color: 'var(--accent-red)' }}>{fmtB(d.capitalExpenditure)}</div>)}
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

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW, backgroundColor: 'var(--gold-row-bg)' }} className="hover-row">
            <div style={{ ...LABEL_CELL, color: 'var(--gold)', fontWeight: 700 }}>Free Cash Flow (FCFF)</div>
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
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--row-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.label}</span>
                <input type="number" step="0.1" value={r.val} onChange={e => r.set(parseFloat(e.target.value) || 0)}
                  style={{ background: 'var(--input-bg)', border: 'none', borderRadius: '4px', color: 'var(--input-text)', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
                />
              </div>
            ))}
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--row-section-bg)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Cost of Equity</span><span style={{ color: 'var(--gold)' }}>{costEquity.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>After-tax Cost of Debt</span><span style={{ color: 'var(--gold)' }}>{afterTaxDebt.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ color: 'var(--text-label)', fontSize: '13px', fontWeight: 600 }}>WACC</span>
                <span style={{ color: 'var(--gold)', fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' }}>{wacc.toFixed(2)}%</span>
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
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--row-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.label}</span>
                {r.input ? (
                  <input type="number" step="0.1" value={r.inputVal} onChange={e => r.inputSet(parseFloat(e.target.value) || 0)}
                    style={{ background: 'var(--input-bg)', border: 'none', borderRadius: '4px', color: 'var(--input-text)', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
                  />
                ) : (
                  <span style={{ color: r.gold ? 'var(--gold)' : 'var(--text-strong)', fontSize: '12px', fontWeight: r.gold ? 700 : 400, fontFamily: 'monospace' }}>{r.val}</span>
                )}
              </div>
            ))}

            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--gold-subtle-bg)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Implied Share Price</div>
              <div style={{ color: 'var(--gold)', fontSize: '32px', fontWeight: 900, fontFamily: 'monospace' }}>{fmtPS(impliedPrice)}</div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-faint)' }}>
                Current: {fmtPS(currentPrice)} |{' '}
                <span style={{ color: upside >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</span>
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
                <th style={{ padding: '6px 10px', color: 'var(--text-faint)', fontSize: '10px', textAlign: 'left', borderBottom: '1px solid var(--row-border)' }}>WACC \ TGR</th>
                {sensGrowths.map(g => (
                  <th key={g} style={{ padding: '6px 10px', color: g === termGrowth ? 'var(--gold)' : 'var(--text-faint)', textAlign: 'right', borderBottom: '1px solid var(--row-border)', fontSize: '10px' }}>{g.toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensWaccs.map((w, wi) => (
                <tr key={w}>
                  <td style={{ padding: '6px 10px', color: w === wacc ? 'var(--gold)' : 'var(--text-faint)', fontWeight: w === wacc ? 700 : 400, borderBottom: '1px solid var(--row-border)' }}>{w.toFixed(1)}%</td>
                  {sensTable[wi].map((price, gi) => {
                    const isCenter = wi === 2 && gi === 2;
                    return (
                      <td key={gi} style={{
                        padding: '6px 10px', textAlign: 'right',
                        color: price >= currentPrice ? 'var(--accent-green)' : 'var(--accent-red)',
                        fontWeight: isCenter ? 700 : 400,
                        backgroundColor: isCenter ? 'var(--gold-active-bg)' : 'transparent',
                        borderBottom: '1px solid var(--row-border)',
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
  const income = Array.isArray(data.incomeStatement) ? data.incomeStatement : [];
  const lastIncome = income[income.length - 1] || {};

  const [revGrowth, setRevGrowth] = useState(8);
  const [grossMargin, setGrossMargin] = useState(() => lastIncome.grossProfit && lastIncome.revenue ? (lastIncome.grossProfit / lastIncome.revenue * 100) : 40);
  const [ebitMargin] = useState(() => lastIncome.ebit && lastIncome.revenue ? (lastIncome.ebit / lastIncome.revenue * 100) : 20);
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

  const actualYears = income.map(i => String(i.year || ''));
  const lastYear = parseInt(actualYears[actualYears.length - 1]) || new Date().getFullYear();
  const projYearLabels = Array.from({ length: projYears }, (_, i) => `${lastYear + i + 1}E`);
  const cols = `220px repeat(${actualYears.length + projYears}, minmax(90px, 1fr))`;
  const valCell = (v, isNeg) => ({ ...VAL_CELL, color: isNeg ? 'var(--accent-red)' : 'var(--text-strong)' });
  const currentPrice = quote?.price || 0;

  return (
    <div>
      <div style={CARD}>
        <h3 style={HEADER}>Income Statement</h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
            <div style={LABEL_CELL}>Line Item</div>
            {actualYears.map(y => <div key={y} style={VAL_CELL}>{y}A</div>)}
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: 'var(--input-text)' }}>{y}</div>)}
          </div>

          {[
            { label: 'Revenue', key: 'revenue', proj: p => p.rev },
            { label: 'Gross Profit', key: 'grossProfit', proj: p => p.gp },
            { label: 'EBIT', key: 'ebit', proj: p => p.ebit },
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
            {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: 'var(--input-text)' }}>{y}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Diluted Shares (M)</div>
            {income.map((d, i) => <div key={i} style={VAL_CELL}>{d.weightedAverageShsOutDil ? (d.weightedAverageShsOutDil / 1e6).toFixed(0) + 'M' : '\u2014'}</div>)}
            <CellInput value={shareGrowth} onChange={setShareGrowth} />
            {projected.slice(1).map((p, i) => <div key={i} style={VAL_CELL}>{(p.shares / 1e6).toFixed(0)}M</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW, backgroundColor: 'var(--gold-row-bg)' }} className="hover-row">
            <div style={{ ...LABEL_CELL, color: 'var(--gold)', fontWeight: 700 }}>EPS (Diluted)</div>
            {income.map((d, i) => <div key={i} style={GOLD_CELL}>{d.eps != null ? fmtPS(d.eps) : '\u2014'}</div>)}
            {projected.map((p, i) => <div key={i} style={GOLD_CELL}>{fmtPS(p.eps)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Target P/E Multiple</div>
            {actualYears.map((_, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
            <CellInput value={targetPE} onChange={setTargetPE} suffix="x" />
            {projYearLabels.slice(1).map((_, i) => <div key={i} style={VAL_CELL}>{fmtX(targetPE)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW, backgroundColor: 'var(--gold-row-bg)' }} className="hover-row">
            <div style={{ ...LABEL_CELL, color: 'var(--gold)', fontWeight: 700 }}>Implied Price</div>
            {actualYears.map((_, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
            {projected.map((p, i) => <div key={i} style={GOLD_CELL}>{fmtPS(p.impliedPrice)}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, ...DATA_ROW }} className="hover-row">
            <div style={LABEL_CELL}>Implied Upside %</div>
            {actualYears.map((_, i) => <div key={i} style={VAL_CELL}>{'\u2014'}</div>)}
            {projected.map((p, i) => {
              const up = currentPrice > 0 ? ((p.impliedPrice - currentPrice) / currentPrice * 100) : 0;
              return <div key={i} style={{ ...VAL_CELL, color: up >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>{up >= 0 ? '+' : ''}{up.toFixed(1)}%</div>;
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
  const lastIncome = income[income.length - 1] || {};

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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--row-border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{label}</span>
      <input type="number" step="0.1" value={val} onChange={e => set(parseFloat(e.target.value) || 0)}
        style={{ background: 'var(--input-bg)', border: 'none', borderRadius: '4px', color: 'var(--input-text)', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
      />
    </div>
  );

  const outputRow = (label, val, gold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--row-border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{label}</span>
      <span style={{ color: gold ? 'var(--gold)' : 'var(--text-strong)', fontSize: '12px', fontWeight: gold ? 700 : 400, fontFamily: 'monospace' }}>{val}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div style={CARD}>
        <h3 style={HEADER}>LBO Inputs</h3>
        <div style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Transaction</div>
          {outputRow('Entry Price', fmtPS(entryPrice))}
          {inputRow('Entry EV/EBITDA', entryMultiple, setEntryMultiple, 'x')}
          {inputRow('Transaction Fees %', fees, setFees)}
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Financing</div>
          {inputRow('Debt / Total Cap %', debtPct, setDebtPct)}
          {inputRow('Interest Rate %', intRate, setIntRate)}
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Operations</div>
          {inputRow('Revenue Growth %/yr', revGrowth, setRevGrowth)}
          {inputRow('EBITDA Margin %', ebitdaMarginInput, setEbitdaMarginInput)}
          {inputRow('Capex % of Revenue', capexPct, setCapexPct)}
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Exit</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--row-border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Exit Year</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[3, 4, 5].map(y => (
                <button key={y} onClick={() => setExitYear(y)} style={{
                  padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  border: exitYear === y ? '1px solid var(--gold)' : '1px solid var(--border-color)',
                  background: exitYear === y ? 'var(--gold-active-bg)' : 'transparent',
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
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Year-by-Year</div>
          {years.map(yr => (
            <div key={yr.y} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px', borderBottom: '1px solid var(--row-border)' }}>
              <span style={{ color: 'var(--text-faint)' }}>Y{yr.y}</span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>EBITDA {fmtB(yr.ebitda)}</span>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'monospace' }}>Debt {fmtB(yr.debtBalance)}</span>
            </div>
          ))}
          <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '8px' }}>Exit</div>
          {outputRow('Exit EV', fmtB(exitEV), true)}
          {outputRow('Exit Equity Value', fmtB(exitEquity), true)}
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--gold-subtle-bg)', borderRadius: '8px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>MOIC</div>
              <div style={{ color: 'var(--gold)', fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' }}>{moic.toFixed(2)}x</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>IRR</div>
              <div style={{ color: irr >= 20 ? 'var(--accent-green)' : irr >= 15 ? 'var(--gold)' : 'var(--accent-red)', fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' }}>{irr.toFixed(1)}%</div>
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

  useEffect(() => {
    if (!quote?.symbol) { setLoading(false); return; }
    (async () => {
      try {
        // Fetch peers list from model-data endpoint
        const peerData = await api.peers(quote.symbol);
        const peersList = Array.isArray(peerData.peers) ? (peerData.peers[0]?.peersList || []).slice(0, 5) : [];
        if (peersList.length) {
          const res = await api.quotes(peersList);
          setPeerQuotes(Array.isArray(res) ? res : []);
        }
      } catch {}
      setLoading(false);
    })();
  }, [quote?.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const allRows = [
    ...(quote ? [{ ...quote, _isSubject: true, name: quote.name }] : []),
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

  const COL = { padding: '8px 12px', borderBottom: '1px solid var(--row-border)', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' };
  const HEAD = { ...COL, color: 'var(--text-faint)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' };

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
                  borderLeft: r._isSubject ? '3px solid var(--gold)' : 'none',
                  backgroundColor: r._isSubject ? 'var(--gold-row-bg)' : 'transparent',
                }}>
                  <td style={{ ...COL, textAlign: 'left', color: 'var(--text-primary)', fontWeight: r._isSubject ? 700 : 400, fontFamily: 'inherit' }}>{r.name || r.symbol}</td>
                  <td style={{ ...COL, textAlign: 'left', color: 'var(--gold)', fontWeight: 600 }}>{r.symbol}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-primary)' }}>{formatPrice(r.price)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatMarketCap(r.marketCap)}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.pe != null ? r.pe.toFixed(1) : '\u2014'}</td>
                  <td style={{ ...COL, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.priceToBook != null ? r.priceToBook.toFixed(1) : '\u2014'}</td>
                  <td style={{ ...COL, textAlign: 'right', color: (r.changesPercentage || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{r.changesPercentage != null ? `${r.changesPercentage >= 0 ? '+' : ''}${r.changesPercentage.toFixed(2)}%` : '\u2014'}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'var(--gold-subtle-bg)' }}>
                <td style={{ ...COL, textAlign: 'left', color: 'var(--gold)', fontWeight: 700, fontFamily: 'inherit' }}>MEDIAN</td>
                <td style={COL}></td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--gold)' }}>{medians.price != null ? formatPrice(medians.price) : '\u2014'}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--gold)' }}>{medians.marketCap != null ? formatMarketCap(medians.marketCap) : '\u2014'}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--gold)' }}>{medians.pe != null ? medians.pe.toFixed(1) : '\u2014'}</td>
                <td style={{ ...COL, textAlign: 'right', color: 'var(--gold)' }}>{medians.priceToBook != null ? medians.priceToBook.toFixed(1) : '\u2014'}</td>
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
  const income = useMemo(() => Array.isArray(data.incomeStatement) ? data.incomeStatement : [], [data.incomeStatement]);
  const cfRaw = useMemo(() => Array.isArray(data.cashFlow) ? data.cashFlow : [], [data.cashFlow]);
  const bsRaw = useMemo(() => Array.isArray(data.balanceSheet) ? data.balanceSheet : [], [data.balanceSheet]);

  const [subTab, setSubTab] = useState('is');

  const actualYears = useMemo(() => income.map(i => String(i.year || '')), [income]);
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

  const valCell = (v, isNeg) => ({ ...VAL_CELL, color: isNeg ? 'var(--accent-red)' : 'var(--text-strong)' });
  const goldRow = { ...DATA_ROW, backgroundColor: 'var(--gold-row-bg)' };
  const goldLabel = { ...LABEL_CELL, color: 'var(--gold)', fontWeight: 700 };

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
      {projYearLabels.map(y => <div key={y} style={{ ...VAL_CELL, color: 'var(--input-text)' }}>{y}</div>)}
    </div>
  );

  const sectionLabel = (text) => (
    <div style={{ display: 'grid', gridTemplateColumns: cols, ...SECTION_ROW }}>
      <div style={{ ...LABEL_CELL, color: 'var(--text-muted)', fontWeight: 600 }}>{text}</div>
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
              background: subTab === t.key ? 'var(--bg-tertiary)' : 'transparent',
              color: subTab === t.key ? 'var(--text-strong)' : 'var(--text-faint)',
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
          <div key={s.label} style={{ backgroundColor: 'var(--gold-subtle-bg)', borderRadius: '6px', padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-faint)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
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
            {renderRow('EBIT', income.map(d => d.ebit), isProj.map(p => p.ebit), { gold: true })}
            {renderPctRow('EBIT Margin %', income.map(d => d.revenue ? (d.ebit / d.revenue * 100) : 0), isProj.map(p => p.rev ? (p.ebit / p.rev * 100) : 0))}
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
                <div key={i} style={{ ...VAL_CELL, color: p.balCheck < 1 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700, fontSize: '11px' }}>
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
              {cfRaw.map((d, i) => <div key={i} style={{ ...VAL_CELL, color: 'var(--accent-red)' }}>{fmtB(d.capitalExpenditure)}</div>)}
              <CellInput value={capexPct} onChange={setCapexPct} />
              {projYearLabels.slice(1).map((_, i) => <div key={i} style={{ ...VAL_CELL, color: 'var(--accent-red)' }}>{fmtB(cfsProj[i + 1]?.capex)}</div>)}
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
      const [finRes, quoteRes] = await Promise.allSettled([
        api.modelFinancials(sym),
        api.quote(sym),
      ]);
      const fin = finRes.status === 'fulfilled' ? finRes.value : null;
      const q = quoteRes.status === 'fulfilled' ? (Array.isArray(quoteRes.value) ? quoteRes.value[0] : quoteRes.value) : null;
      const inc = fin?.incomeStatement ? fin.incomeStatement[fin.incomeStatement.length - 1] : null;
      setter({ quote: q, income: inc });
    } catch { setter(null); }
    setLoading(false);
  }, []);


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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--row-border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{label}</span>
      <span style={{ color: opts.gold ? 'var(--gold)' : opts.color || 'var(--text-strong)', fontSize: '12px', fontWeight: opts.bold ? 700 : 400, fontFamily: 'monospace' }}>{val}</span>
    </div>
  );

  const inputRowMA = (label, val, set, suffix = '%') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--row-border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input type="number" step="0.1" value={val} onChange={e => set(parseFloat(e.target.value) || 0)}
          style={{ background: 'var(--input-bg)', border: 'none', borderRadius: '4px', color: 'var(--input-text)', textAlign: 'right', width: '80px', padding: '4px 8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
        />
        {suffix && <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>{suffix}</span>}
      </div>
    </div>
  );

  const searchBox = (label, onSelectFn) => (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '60px' }}>{label}</span>
      <div style={{ flex: 1 }}>
        <TickerSearch
          size="sm"
          placeholder={`Search ${label.toLowerCase()}...`}
          onSelect={onSelectFn}
        />
      </div>
    </div>
  );

  // Empty state for M&A
  if (!acqData && !tgtData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Merger Model (M&A)</h2>
          <p style={{ color: 'var(--text-faint)', fontSize: '13px', margin: 0 }}>Analyze whether an acquisition is accretive or dilutive to the acquirer's EPS</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%' }}>
          <div>
            {searchBox('Acquirer', (sym) => { fetchCompany(sym, setAcqData); })}
          </div>
          <div>
            {searchBox('Target', (sym) => { fetchCompany(sym, setTgtData); })}
          </div>
        </div>
        <p style={{ color: 'var(--text-faint)', fontSize: '11px' }}>Enter both tickers and press Enter to load data</p>
      </div>
    );
  }

  return (
    <div>
      {/* Ticker search row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {searchBox('Acquirer', (sym) => { fetchCompany(sym, setAcqData); })}
        {searchBox('Target', (sym) => { fetchCompany(sym, setTgtData); })}
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
                <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Uses</div>
                {infoRow('Equity Purchase Price', fmtB(transactionValue))}
                {infoRow('Transaction Fees (1%)', fmtB(fees))}
                {infoRow('Total Uses', fmtB(totalUses), { gold: true, bold: true })}
                <div style={{ color: 'var(--text-faint)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px', marginBottom: '6px' }}>Sources</div>
                {infoRow('Cash', fmtB(cashPortion))}
                {infoRow('Stock Issued', fmtB(stockPortion))}
                {infoRow('Total Sources', fmtB(cashPortion + stockPortion), { gold: true, bold: true })}
                {infoRow('Check', Math.abs(totalUses - (cashPortion + stockPortion)) < 1 ? '\u2713 Balanced' : '\u2717 Mismatch', { color: Math.abs(totalUses - (cashPortion + stockPortion)) < 1 ? 'var(--accent-green)' : 'var(--accent-red)' })}
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
                    <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--row-border)' }}></th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--row-border)' }}>Standalone</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid var(--row-border)' }}>Pro Forma</th>
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
                      <td style={{ padding: '6px 14px', color: r.gold ? 'var(--gold)' : 'var(--text-muted)', fontWeight: r.gold ? 700 : 400, borderBottom: '1px solid var(--row-border)', fontFamily: r.gold ? 'monospace' : 'inherit', fontSize: r.label ? '12px' : '4px' }}>{r.label}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', color: r.gold ? 'var(--gold)' : 'var(--text-strong)', fontWeight: r.gold ? 700 : 400, borderBottom: '1px solid var(--row-border)' }}>{r.standalone}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', color: r.neg ? 'var(--accent-red)' : r.gold ? 'var(--gold)' : 'var(--text-strong)', fontWeight: r.gold ? 700 : 400, borderBottom: '1px solid var(--row-border)' }}>{r.proforma}</td>
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
            <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              Accretion / (Dilution)
            </div>
            <div style={{ color: isAccretive ? 'var(--green)' : 'var(--red)', fontSize: '36px', fontWeight: 900, fontFamily: 'monospace' }}>
              {isAccretive ? 'ACCRETIVE' : 'DILUTIVE'}
            </div>
            <div style={{ color: isAccretive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>
              {accDilAmt >= 0 ? '+' : ''}{fmtPS(accDilAmt)} ({accDilPct >= 0 ? '+' : ''}{accDilPct.toFixed(1)}%)
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase' }}>Standalone EPS</div>
                <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmtPS(standaloneEPS)}</div>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '20px', display: 'flex', alignItems: 'center' }}>{'\u2192'}</div>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase' }}>Pro Forma EPS</div>
                <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmtPS(proFormaEPS)}</div>
              </div>
            </div>
          </div>

          {/* Breakeven */}
          <div style={{ marginTop: '16px', padding: '14px 18px', backgroundColor: 'var(--row-section-bg)', borderRadius: '8px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Breakeven Synergies</div>
              <div style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                {breakEvenSynergies != null ? `$${breakEvenSynergies.toFixed(1)}M / year` : '\u2014'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Breakeven Premium</div>
              <div style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                {breakEvenPremium != null ? `${breakEvenPremium.toFixed(1)}%` : '\u2014'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Master Integrated Model ──
function MasterModel({ data, quote }) {
  const income = Array.isArray(data.incomeStatement) ? data.incomeStatement : [];
  const bs = Array.isArray(data.balanceSheet) ? data.balanceSheet : [];
  const lastIncome = income[income.length - 1] || {};
  const lastBS = bs[bs.length - 1] || {};

  const [scenarioIndex, setScenarioIndex] = useState(2);
  const [assumptions, setAssumptions] = useState(() => defaultScenario());
  const [userOverrides, setUserOverrides] = useState({});
  const [showOverrides, setShowOverrides] = useState(false);
  const [previousScenario, setPreviousScenario] = useState(null);
  useEffect(() => {
    if (scenarioIndex === 5) {
      setShowOverrides(true);
    } else {
      setShowOverrides(false);
    }
  }, [scenarioIndex]);

  const applyScenario = (idx) => {
    setScenarioIndex(idx);
    if (idx < 5) {
      setPreviousScenario(null);
      const base = { ...SCENARIOS[idx] };
      Object.keys(userOverrides).forEach(k => { base[k] = userOverrides[k]; });
      setAssumptions(base);
    } else {
      // Custom — keep current assumptions
      setAssumptions(prev => ({ ...prev }));
    }
  };

  const handleOverride = (key, val) => {
    if (scenarioIndex < 5) {
      setPreviousScenario(SCENARIOS[scenarioIndex].name);
      setScenarioIndex(5);
    }
    setUserOverrides(prev => ({ ...prev, [key]: val }));
    setAssumptions(prev => ({ ...prev, [key]: val }));
  };

  const clearOverrides = () => {
    setUserOverrides({});
    setPreviousScenario(null);
    setScenarioIndex(2);
    setAssumptions({ ...SCENARIOS[2] });
  };

  const overrideKeys = Object.keys(userOverrides);

  // ── Integrated Calculations ──
  const lastRev = lastIncome.revenue || 0;
  const projYears = 5;
  const currentPrice = quote?.price || 0;
  const sharesOut = quote?.marketCap && quote?.price ? Math.round(quote.marketCap / quote.price) : 1;
  const netDebt = (lastBS.totalDebt || 0) - (lastBS.cashAndCashEquivalents || 0);

  // 3-Statement + DCF outputs
  const outputs = useMemo(() => {
    const a = assumptions;
    const projected = [];
    for (let y = 0; y < projYears; y++) {
      const rev = lastRev * Math.pow(1 + a.revGrowth / 100, y + 1);
      const gp = rev * a.grossMargin / 100;
      const ebitda = rev * a.ebitdaMargin / 100;
      const ebit = ebitda - rev * a.daaPct / 100;
      const ni = rev * a.netMargin / 100;
      const nopat = ebit * (1 - a.taxRate / 100);
      const daa = rev * a.daaPct / 100;
      const capex = rev * a.capexPct / 100;
      const nwc = rev * a.nwcPct / 100;
      const fcff = nopat + daa - capex - nwc;
      const eps = sharesOut > 0 ? ni / sharesOut : 0;
      projected.push({ rev, gp, ebitda, ebit, ni, nopat, daa, capex, nwc, fcff, eps });
    }

    // WACC
    const costEquity = a.riskFree + a.beta * a.erp;
    const afterTaxDebt = a.preTaxDebt * (1 - a.taxRate / 100);
    const equityPct = 100 - a.debtPct;
    const wacc = (costEquity * equityPct / 100) + (afterTaxDebt * a.debtPct / 100);

    // DCF
    const pvFCFs = projected.map((p, i) => p.fcff / Math.pow(1 + wacc / 100, i + 1));
    const totalPvFCF = pvFCFs.reduce((s, v) => s + v, 0);
    const terminalFCF = projected[projYears - 1].fcff * (1 + a.termGrowth / 100);
    const terminalValue = wacc > a.termGrowth ? terminalFCF / ((wacc - a.termGrowth) / 100) : 0;
    const pvTerminal = terminalValue / Math.pow(1 + wacc / 100, projYears);
    const ev = totalPvFCF + pvTerminal;
    const equityValue = ev - netDebt;
    const dcfPrice = sharesOut > 0 ? equityValue / sharesOut : 0;

    // LBO
    const lastEbitda = lastIncome.ebitda || lastRev * a.ebitdaMargin / 100;
    const purchaseEV = lastEbitda * a.entryMultiple;
    const totalLboDebt = purchaseEV * a.lboDebtPct / 100;
    const equityContrib = purchaseEV - totalLboDebt;
    let debtBalance = totalLboDebt;
    for (let y = 1; y <= 5; y++) {
      const revY = lastRev * Math.pow(1 + a.revGrowth / 100, y);
      const ebitdaY = revY * a.ebitdaMargin / 100;
      const capexY = revY * a.capexPct / 100;
      const interest = debtBalance * a.intRate / 100;
      const fcfY = ebitdaY - capexY - interest;
      const paydown = Math.min(fcfY * 0.5, debtBalance);
      debtBalance = Math.max(0, debtBalance - paydown);
    }
    const exitEbitda = lastRev * Math.pow(1 + a.revGrowth / 100, 5) * a.ebitdaMargin / 100;
    const exitEV = exitEbitda * a.exitMultiple;
    const exitEquity = exitEV - debtBalance;
    const moic = equityContrib > 0 ? exitEquity / equityContrib : 0;
    const irr = equityContrib > 0 ? (Math.pow(Math.max(0, moic), 1 / 5) - 1) * 100 : 0;

    // Comps implied
    const fwdEPS = projected[0]?.eps || 0;
    const compsPrice = fwdEPS * a.targetPE;

    // Year 5 outputs
    const y5 = projected[projYears - 1];

    return {
      projected, wacc, costEquity, dcfPrice, ev, equityValue, totalPvFCF, pvTerminal,
      moic, irr, exitEV, exitEquity, purchaseEV, equityContrib,
      compsPrice, fwdEPS,
      y5Rev: y5.rev, y5EBITDA: y5.ebitda, y5NI: y5.ni, y5EPS: y5.eps, y5FCF: y5.fcff,
    };
  }, [assumptions, lastRev, sharesOut, netDebt, lastIncome.ebitda, projYears]);

  const dcfUpside = currentPrice > 0 ? ((outputs.dcfPrice - currentPrice) / currentPrice * 100) : 0;
  const compsUpside = currentPrice > 0 ? ((outputs.compsPrice - currentPrice) / currentPrice * 100) : 0;

  // Football field data
  const fiftyTwoLow = quote?.yearLow || currentPrice * 0.7;
  const fiftyTwoHigh = quote?.yearHigh || currentPrice * 1.3;

  const footballData = useMemo(() => {
    // Compute all scenario prices for ranges
    const scenarioPrices = SCENARIOS.map(sc => {
      const a = sc;
      const proj = [];
      for (let y = 0; y < 5; y++) {
        const rev = lastRev * Math.pow(1 + a.revGrowth / 100, y + 1);
        const ebitda = rev * a.ebitdaMargin / 100;
        const ebit = ebitda - rev * a.daaPct / 100;
        const ni = rev * a.netMargin / 100;
        const nopat = ebit * (1 - a.taxRate / 100);
        const daa = rev * a.daaPct / 100;
        const capex = rev * a.capexPct / 100;
        const nwc = rev * a.nwcPct / 100;
        const fcff = nopat + daa - capex - nwc;
        proj.push({ fcff, ni, ebitda });
      }
      const ce = a.riskFree + a.beta * a.erp;
      const atd = a.preTaxDebt * (1 - a.taxRate / 100);
      const w = (ce * (100 - a.debtPct) / 100) + (atd * a.debtPct / 100);
      const pvs = proj.map((p, i) => p.fcff / Math.pow(1 + w / 100, i + 1));
      const tpv = pvs.reduce((s, v) => s + v, 0);
      const tf = proj[4].fcff * (1 + a.termGrowth / 100);
      const tv = w > a.termGrowth ? tf / ((w - a.termGrowth) / 100) : 0;
      const pvt = tv / Math.pow(1 + w / 100, 5);
      const dcf = sharesOut > 0 ? (tpv + pvt - netDebt) / sharesOut : 0;
      const eps = sharesOut > 0 ? proj[0].ni / sharesOut : 0;
      const comp = eps * a.targetPE;
      return { dcf, comp, y5Ebitda: proj[4].ebitda };
    });

    const dcfPrices = scenarioPrices.map(s => s.dcf);
    const compPrices = scenarioPrices.map(s => s.comp);

    // LBO range: bear/base/bull using current assumptions with exit multiple variation
    const a = assumptions;
    const y5Ebitda = scenarioPrices[2]?.y5Ebitda || 0; // base scenario Y5 EBITDA
    const lboBearEV = y5Ebitda * Math.max(1, a.exitMultiple - 2);
    const lboBearEquity = Math.max(0, lboBearEV - Math.abs(netDebt));
    const lboBearPrice = sharesOut > 0 ? lboBearEquity / sharesOut : 0;
    const lboBaseEV = y5Ebitda * a.exitMultiple;
    const lboBaseEquity = Math.max(0, lboBaseEV - Math.abs(netDebt));
    const lboBasePrice = sharesOut > 0 ? lboBaseEquity / sharesOut : 0;
    const lboBullEV = y5Ebitda * (a.exitMultiple + 2);
    const lboBullEquity = Math.max(0, lboBullEV - Math.abs(netDebt) * 0.7);
    const lboBullPrice = sharesOut > 0 ? lboBullEquity / sharesOut : 0;
    const lboValid = lboBasePrice > 0 && isFinite(lboBasePrice);

    const result = [
      { name: 'DCF', base: [Math.min(...dcfPrices), Math.max(...dcfPrices)] },
    ];
    if (lboValid) {
      result.push({ name: 'LBO', base: [Math.min(lboBearPrice, lboBasePrice), Math.max(lboBullPrice, lboBasePrice)] });
    }
    result.push(
      { name: 'Comps', base: [Math.min(...compPrices), Math.max(...compPrices)] },
      { name: '52W Range', base: [fiftyTwoLow, fiftyTwoHigh] },
    );
    return result;
  }, [lastRev, sharesOut, netDebt, fiftyTwoLow, fiftyTwoHigh, assumptions]);

  // Scenario comparison
  const computeScenarioRow = useCallback((a) => {
    const proj = [];
    for (let y = 0; y < 5; y++) {
      const rev = lastRev * Math.pow(1 + a.revGrowth / 100, y + 1);
      const ebitda = rev * a.ebitdaMargin / 100;
      const ebit = ebitda - rev * a.daaPct / 100;
      const ni = rev * a.netMargin / 100;
      const nopat = ebit * (1 - a.taxRate / 100);
      const daa = rev * a.daaPct / 100;
      const capex = rev * a.capexPct / 100;
      const nwc = rev * a.nwcPct / 100;
      const fcff = nopat + daa - capex - nwc;
      proj.push({ rev, ebitda, ni, fcff });
    }
    const ce = a.riskFree + a.beta * a.erp;
    const atd = a.preTaxDebt * (1 - a.taxRate / 100);
    const w = (ce * (100 - a.debtPct) / 100) + (atd * a.debtPct / 100);
    const pvs = proj.map((p, i) => p.fcff / Math.pow(1 + w / 100, i + 1));
    const tpv = pvs.reduce((s, v) => s + v, 0);
    const tf = proj[4].fcff * (1 + a.termGrowth / 100);
    const tv = w > a.termGrowth ? tf / ((w - a.termGrowth) / 100) : 0;
    const pvt = tv / Math.pow(1 + w / 100, 5);
    const dcfP = sharesOut > 0 ? (tpv + pvt - netDebt) / sharesOut : 0;
    const eps = sharesOut > 0 ? proj[0].ni / sharesOut : 0;
    const compP = eps * a.targetPE;
    const up = currentPrice > 0 ? ((dcfP - currentPrice) / currentPrice * 100) : 0;
    return {
      name: a.name, revGrowth: a.revGrowth, ebitdaMargin: a.ebitdaMargin,
      y5Rev: proj[4].rev, y5EBITDA: proj[4].ebitda, y5FCF: proj[4].fcff,
      wacc: w, dcfPrice: dcfP, compsPrice: compP, upside: up,
    };
  }, [lastRev, sharesOut, netDebt, currentPrice]);

  const scenarioComparison = useMemo(() => {
    const rows = SCENARIOS.slice(0, 5).map(sc => computeScenarioRow(sc));
    // Custom column uses current assumptions
    const customRow = computeScenarioRow({ ...assumptions, name: 'Custom' });
    rows.push(customRow);
    return rows;
  }, [computeScenarioRow, assumptions]);

  const OVERRIDE_FIELDS = [
    { key: 'revGrowth', label: 'Rev Growth %', min: -20, max: 40, step: 0.5 },
    { key: 'grossMargin', label: 'Gross Margin %', min: 10, max: 80, step: 0.5 },
    { key: 'ebitdaMargin', label: 'EBITDA Margin %', min: 5, max: 60, step: 0.5 },
    { key: 'netMargin', label: 'Net Margin %', min: -10, max: 40, step: 0.5 },
    { key: 'taxRate', label: 'Tax Rate %', min: 10, max: 35, step: 0.5 },
    { key: 'capexPct', label: 'Capex % Rev', min: 0, max: 15, step: 0.5 },
    { key: 'daaPct', label: 'D&A % Rev', min: 0, max: 15, step: 0.5 },
    { key: 'nwcPct', label: 'NWC % Rev', min: -5, max: 10, step: 0.5 },
    { key: 'riskFree', label: 'Risk-Free %', min: 1, max: 8, step: 0.1 },
    { key: 'erp', label: 'Equity RP %', min: 3, max: 10, step: 0.1 },
    { key: 'beta', label: 'Beta', min: 0.3, max: 2.5, step: 0.05 },
    { key: 'termGrowth', label: 'Terminal Gr %', min: 0, max: 5, step: 0.1 },
    { key: 'entryMultiple', label: 'Entry EV/EBITDA', min: 4, max: 25, step: 0.5 },
    { key: 'exitMultiple', label: 'Exit EV/EBITDA', min: 4, max: 30, step: 0.5 },
    { key: 'targetPE', label: 'Target P/E', min: 5, max: 50, step: 0.5 },
    { key: 'intRate', label: 'LBO Int Rate %', min: 3, max: 15, step: 0.25 },
  ];

  const scenarioColors = ['var(--accent-red)', '#f59e0b', 'var(--gold)', 'var(--accent-green)', '#a855f7', '#9ca3af'];
  const barColorMap = { 'DCF': 'var(--gold)', 'LBO': '#6366f1', 'Comps': '#3b82f6', '52W Range': 'var(--text-tertiary)' };

  return (
    <div>
      {/* Scenario Slider */}
      <div style={CARD}>
        <h3 style={HEADER}>Scenario Analysis</h3>
        <div style={{ padding: '20px 24px' }}>
          {/* Slider track */}
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <input
              type="range" min={0} max={5} step={1} value={scenarioIndex}
              onChange={e => applyScenario(Number(e.target.value))}
              style={{
                width: '100%', height: '6px', appearance: 'none', WebkitAppearance: 'none',
                background: 'linear-gradient(to right, #dc2626, #f59e0b, #F0A500, #4ade80, #a855f7, #6b7280)',
                borderRadius: '3px', outline: 'none', cursor: 'pointer',
              }}
            />
          </div>
          {/* Position labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            {SCENARIOS.map((s, i) => (
              <button key={s.name} onClick={() => applyScenario(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                fontSize: '11px', fontWeight: scenarioIndex === i ? 700 : 400,
                color: scenarioIndex === i ? (i === 5 ? '#ffffff' : scenarioColors[i]) : 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: scenarioIndex === i ? `2px solid ${i === 5 ? '#ffffff' : scenarioColors[i]}` : '2px solid transparent',
              }}>{s.name}</button>
            ))}
          </div>
          {/* Description */}
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: scenarioIndex === 5 ? '8px' : '12px', fontStyle: 'italic' }}>
            {SCENARIOS[scenarioIndex].description}
            {previousScenario && scenarioIndex === 5 && (
              <span style={{ color: 'var(--text-faint)', fontSize: '11px', marginLeft: '8px' }}>
                (Modified from {previousScenario})
              </span>
            )}
          </div>
          {/* Reset to Base button for Custom */}
          {scenarioIndex === 5 && (
            <button onClick={clearOverrides} style={{
              fontSize: '11px', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer',
              backgroundColor: 'var(--row-section-bg)', color: 'var(--gold)',
              border: '1px solid var(--border-color)', fontWeight: 600, marginBottom: '12px',
            }}>Reset to Base</button>
          )}
          {/* Override pills */}
          {overrideKeys.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Overrides:</span>
              {overrideKeys.map(k => {
                const field = OVERRIDE_FIELDS.find(f => f.key === k);
                return (
                  <span key={k} style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                    backgroundColor: 'var(--gold-active-bg)', color: 'var(--gold)', fontWeight: 600,
                  }}>{field?.label || k}: {userOverrides[k]}</span>
                );
              })}
              <button onClick={clearOverrides} style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer',
                backgroundColor: 'var(--row-section-bg)', color: 'var(--accent-red)',
                border: '1px solid var(--border-color)', fontWeight: 600,
              }}>Clear All</button>
            </div>
          )}
        </div>
      </div>

      {/* Assumption Override Panel */}
      <div style={{ ...CARD, marginTop: '12px' }}>
        <div onClick={() => setShowOverrides(!showOverrides)} style={{
          ...HEADER, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {showOverrides ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {scenarioIndex === 5 ? (
            <div>
              <span>{'\u2699'} Custom Scenario — Adjust All Assumptions</span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, letterSpacing: 'normal', textTransform: 'none', marginTop: '2px' }}>
                All inputs are fully editable. Changes update the model in real time.
              </div>
            </div>
          ) : (
            'Assumption Overrides'
          )}
        </div>
        {showOverrides && (
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {OVERRIDE_FIELDS.map(f => (
              <div key={f.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: userOverrides[f.key] != null ? 'var(--gold)' : 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-strong)', fontFamily: 'monospace' }}>{assumptions[f.key]}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={assumptions[f.key]}
                  onChange={e => handleOverride(f.key, parseFloat(e.target.value))}
                  style={{ width: '100%', height: '4px', appearance: 'none', WebkitAppearance: 'none',
                    background: userOverrides[f.key] != null
                      ? 'linear-gradient(to right, var(--gold-muted), var(--gold))'
                      : 'var(--border-color)',
                    borderRadius: '2px', outline: 'none', cursor: 'pointer',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-Column Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Projected Financials */}
        <div style={CARD}>
          <h3 style={HEADER}>Projected Financials (Y5)</h3>
          <div style={{ padding: '16px' }}>
            {[
              { label: 'Revenue', val: fmtB(outputs.y5Rev) },
              { label: 'EBITDA', val: fmtB(outputs.y5EBITDA) },
              { label: 'Net Income', val: fmtB(outputs.y5NI) },
              { label: 'EPS', val: fmtPS(outputs.y5EPS) },
              { label: 'Free Cash Flow', val: fmtB(outputs.y5FCF), gold: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--row-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.label}</span>
                <span style={{ color: r.gold ? 'var(--gold)' : 'var(--text-strong)', fontSize: '12px', fontWeight: r.gold ? 700 : 400, fontFamily: 'monospace' }}>{r.val}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', padding: '6px 0', borderBottom: '1px solid var(--row-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Rev Growth</span>
              <span style={{ color: 'var(--text-strong)', fontSize: '12px', fontFamily: 'monospace' }}>{fmtPct(assumptions.revGrowth)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>EBITDA Margin</span>
              <span style={{ color: 'var(--text-strong)', fontSize: '12px', fontFamily: 'monospace' }}>{fmtPct(assumptions.ebitdaMargin)}</span>
            </div>
          </div>
        </div>

        {/* Valuation Summary */}
        <div style={CARD}>
          <h3 style={HEADER}>Valuation Summary</h3>
          <div style={{ padding: '16px' }}>
            {[
              { label: 'WACC', val: fmtPct(outputs.wacc) },
              { label: 'Enterprise Value', val: fmtB(outputs.ev), gold: true },
              { label: 'Equity Value', val: fmtB(outputs.equityValue), gold: true },
              { label: 'PV of FCFs', val: fmtB(outputs.totalPvFCF) },
              { label: 'PV of Terminal', val: fmtB(outputs.pvTerminal) },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--row-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.label}</span>
                <span style={{ color: r.gold ? 'var(--gold)' : 'var(--text-strong)', fontSize: '12px', fontWeight: r.gold ? 700 : 400, fontFamily: 'monospace' }}>{r.val}</span>
              </div>
            ))}
            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--gold-subtle-bg)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>DCF Implied Price</div>
              <div style={{ color: 'var(--gold)', fontSize: '28px', fontWeight: 900, fontFamily: 'monospace' }}>{fmtPS(outputs.dcfPrice)}</div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-faint)' }}>
                Current: {fmtPS(currentPrice)} |{' '}
                <span style={{ color: dcfUpside >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>{dcfUpside >= 0 ? '+' : ''}{dcfUpside.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Return Metrics */}
        <div style={CARD}>
          <h3 style={HEADER}>Return Metrics</h3>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--gold-subtle-bg)', borderRadius: '8px' }}>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>MOIC</div>
                <div style={{ color: 'var(--gold)', fontSize: '22px', fontWeight: 700, fontFamily: 'monospace' }}>{outputs.moic.toFixed(2)}x</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>IRR</div>
                <div style={{ color: outputs.irr >= 20 ? 'var(--accent-green)' : outputs.irr >= 15 ? 'var(--gold)' : 'var(--accent-red)', fontSize: '22px', fontWeight: 700, fontFamily: 'monospace' }}>{outputs.irr.toFixed(1)}%</div>
              </div>
            </div>
            {[
              { label: 'Purchase EV', val: fmtB(outputs.purchaseEV) },
              { label: 'Exit EV', val: fmtB(outputs.exitEV), gold: true },
              { label: 'Exit Equity', val: fmtB(outputs.exitEquity), gold: true },
              { label: 'Comps Price (Fwd P/E)', val: fmtPS(outputs.compsPrice) },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--row-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.label}</span>
                <span style={{ color: r.gold ? 'var(--gold)' : 'var(--text-strong)', fontSize: '12px', fontWeight: r.gold ? 700 : 400, fontFamily: 'monospace' }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Comps Upside</span>
              <span style={{ color: compsUpside >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{compsUpside >= 0 ? '+' : ''}{compsUpside.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Football Field Chart */}
      <div style={CARD}>
        <h3 style={HEADER}>Valuation Range (Football Field)</h3>
        <div style={{ padding: '16px' }}>
          <ResponsiveContainer width="100%" height={footballData.length * 50 + 40}>
            <BarChart data={footballData} layout="vertical" margin={{ left: 60, right: 30, top: 10, bottom: 10 }}>
              <XAxis type="number" domain={['auto', 'auto']} tickFormatter={v => `$${v.toFixed(0)}`}
                tick={{ fill: 'var(--text-faint)', fontSize: 10 }} axisLine={{ stroke: 'var(--row-border)' }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={65}
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value) => {
                  if (Array.isArray(value)) return [`$${value[0].toFixed(2)} - $${value[1].toFixed(2)}`, 'Range'];
                  return [`$${value.toFixed(2)}`, ''];
                }}
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px' }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--text-secondary)' }}
              />
              <Bar dataKey="base" barSize={20} radius={[4, 4, 4, 4]}>
                {footballData.map((entry, i) => <Cell key={i} fill={barColorMap[entry.name] || 'var(--text-tertiary)'} fillOpacity={0.6} />)}
              </Bar>
              {currentPrice > 0 && (
                <ReferenceLine x={currentPrice} stroke="var(--gold)" strokeWidth={2} strokeDasharray="4 4"
                  label={{ value: `Current $${currentPrice.toFixed(2)}`, fill: 'var(--gold)', fontSize: 10, position: 'top' }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scenario Comparison Table */}
      <div style={CARD}>
        <h3 style={HEADER}>Scenario Comparison</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--row-border)' }}>Metric</th>
                {scenarioComparison.map((s, i) => (
                  <th key={s.name} style={{
                    padding: '8px 12px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: scenarioIndex === i && i === 5 ? '2px solid #ffffff' : '1px solid var(--row-border)',
                    color: scenarioIndex === i ? (i === 5 ? '#ffffff' : scenarioColors[i]) : 'var(--text-faint)',
                    fontWeight: scenarioIndex === i ? 700 : 600,
                    backgroundColor: scenarioIndex === i ? 'var(--gold-active-bg)' : 'transparent',
                    position: 'relative',
                  }}>
                    {scenarioIndex === i && (
                      <div style={{ position: 'absolute', top: '-2px', left: '50%', transform: 'translateX(-50%)', fontSize: '7px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: i === 5 ? 'rgba(255,255,255,0.15)' : 'var(--gold-active-bg)', color: i === 5 ? '#ffffff' : scenarioColors[i], letterSpacing: '0.08em' }}>ACTIVE</div>
                    )}
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Rev Growth %', fn: d => fmtPct(d.revGrowth) },
                { label: 'EBITDA Margin %', fn: d => fmtPct(d.ebitdaMargin) },
                { label: 'Y5 Revenue', fn: d => fmtB(d.y5Rev) },
                { label: 'Y5 EBITDA', fn: d => fmtB(d.y5EBITDA) },
                { label: 'Y5 FCF', fn: d => fmtB(d.y5FCF) },
                { label: 'WACC', fn: d => fmtPct(d.wacc) },
                { label: 'DCF Price', fn: d => fmtPS(d.dcfPrice), gold: true },
                { label: 'Comps Price', fn: d => fmtPS(d.compsPrice) },
                { label: 'Upside %', fn: d => `${d.upside >= 0 ? '+' : ''}${d.upside.toFixed(1)}%`, color: d => d.upside >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
              ].map(row => (
                <tr key={row.label}>
                  <td style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '11px', borderBottom: '1px solid var(--row-border)', fontFamily: 'inherit' }}>{row.label}</td>
                  {scenarioComparison.map((d, i) => (
                    <td key={i} style={{
                      padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid var(--row-border)',
                      color: row.color ? row.color(d) : row.gold ? 'var(--gold)' : 'var(--text-strong)',
                      fontWeight: row.gold ? 700 : 400,
                      backgroundColor: scenarioIndex === i ? 'var(--gold-active-bg)' : 'transparent',
                    }}>{row.fn(d)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--gold);
          cursor: pointer;
          border: 2px solid var(--bg-primary);
          box-shadow: 0 0 4px rgba(201,168,76,0.4);
        }
      `}</style>
    </div>
  );
}

// ── Main Models Page ──
export default function Models() {
  const { activeSymbol, setActiveSymbol } = useApp();
  const [ticker, setTicker] = useState(activeSymbol || '');
  const [stockData, setStockData] = useState(null);
  const [quote, setQuote] = useState(null);
  const [activeModel, setActiveModel] = useState('master');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (activeSymbol && activeSymbol !== ticker) setTicker(activeSymbol);
  }, [activeSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    try {
      const [finData, quoteData] = await Promise.allSettled([
        api.modelFinancials(ticker),
        api.quote(ticker),
      ]);
      const fin = finData.status === 'fulfilled' ? finData.value : null;
      const q = quoteData.status === 'fulfilled' ? (Array.isArray(quoteData.value) ? quoteData.value[0] : quoteData.value) : null;
      if (fin) setStockData(fin);
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
  };

  if (!ticker && activeModel !== 'ma') return <ModelsEmptyState onSearch={handleSearch} />;

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
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{quote?.name || ticker}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace' }}>{formatPrice(quote?.price)}</span>
              </>
            )}
            {!quote && !loading && <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Financial Models</span>}
          </div>

          <div style={{ maxWidth: '260px', width: '260px' }}>
            <TickerSearch
              size="sm"
              placeholder="Change ticker..."
              onSelect={(symbol) => handleSearch(symbol)}
            />
          </div>
        </div>

        {/* Model tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
          {MODEL_TABS.map(t => {
            const isMaster = t.key === 'master';
            const isActive = activeModel === t.key;
            return (
              <button key={t.key} onClick={() => setActiveModel(t.key)} style={{
                padding: '6px 16px', fontSize: '12px', fontWeight: isMaster ? 700 : 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 150ms',
                borderRadius: '4px',
                border: isMaster
                  ? (isActive ? '1px solid var(--gold)' : '1px solid var(--gold-muted)')
                  : (isActive ? '1px solid var(--gold)' : '1px solid var(--border-color)'),
                background: isMaster
                  ? (isActive ? 'var(--gold)' : 'var(--gold-active-bg)')
                  : (isActive ? 'var(--gold-active-bg)' : 'transparent'),
                color: isMaster
                  ? (isActive ? 'var(--bg-primary)' : 'var(--gold)')
                  : (isActive ? 'var(--gold)' : 'var(--text-tertiary)'),
              }}>{t.label}</button>
            );
          })}
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
          {activeModel === 'master' && <MasterModel data={stockData} quote={quote} />}
          {activeModel === 'dcf' && <DCFModel data={stockData} quote={quote} />}
          {activeModel === 'eps' && <EPSModel data={stockData} quote={quote} />}
          {activeModel === 'lbo' && <LBOModel data={stockData} quote={quote} />}
          {activeModel === 'comps' && <CompsModel data={stockData} quote={quote} />}
          {activeModel === '3stmt' && <ThreeStatementModel data={stockData} quote={quote} />}
        </>
      )}

      <style>{`
        .hover-row:hover { background-color: var(--row-hover-bg) !important; }
      `}</style>
    </div>
  );
}
