import React, { useState, useEffect, useCallback } from 'react';
import { getIncomeStatement, getBalanceSheet, getCashFlow } from '../../services/fmp';
import { formatLargeNumber } from '../../utils/formatters';

const INCOME_ROWS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'costOfRevenue', label: 'Cost of Revenue' },
  { key: 'grossProfit', label: 'Gross Profit' },
  { key: 'grossProfitRatio', label: 'Gross Margin', pct: true },
  { key: 'researchAndDevelopmentExpenses', label: 'R&D Expenses' },
  { key: 'operatingExpenses', label: 'Operating Expenses' },
  { key: 'operatingIncome', label: 'Operating Income' },
  { key: 'operatingIncomeRatio', label: 'Operating Margin', pct: true },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'netIncome', label: 'Net Income' },
  { key: 'netIncomeRatio', label: 'Net Margin', pct: true },
  { key: 'eps', label: 'EPS' },
  { key: 'epsDiluted', label: 'EPS Diluted' },
];

const BALANCE_ROWS = [
  { key: 'totalAssets', label: 'Total Assets' },
  { key: 'totalCurrentAssets', label: 'Total Current Assets' },
  { key: 'cashAndCashEquivalents', label: 'Cash & Equivalents' },
  { key: 'totalLiabilities', label: 'Total Liabilities' },
  { key: 'totalCurrentLiabilities', label: 'Total Current Liabilities' },
  { key: 'totalDebt', label: 'Total Debt' },
  { key: 'netDebt', label: 'Net Debt' },
  { key: 'totalStockholdersEquity', label: "Total Equity" },
  { key: 'retainedEarnings', label: 'Retained Earnings' },
];

const CASHFLOW_ROWS = [
  { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
  { key: 'capitalExpenditure', label: 'CapEx' },
  { key: 'freeCashFlow', label: 'Free Cash Flow' },
  { key: 'dividendsPaid', label: 'Dividends Paid' },
  { key: 'netCashUsedForInvestingActivites', label: 'Investing Activities' },
  { key: 'netCashUsedProvidedByFinancingActivities', label: 'Financing Activities' },
];

function formatValue(val, pct) {
  if (val == null) return '\u2014';
  if (pct) return `${(Number(val) * 100).toFixed(1)}%`;
  return formatLargeNumber(val);
}

function DataTable({ rows, data, period }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No data available.</p>;
  }
  const cols = data.slice(0, period === 'annual' ? 5 : 8);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={{
              padding: '8px 12px',
              textAlign: 'left',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border-color)',
              position: 'sticky',
              left: 0,
              backgroundColor: 'var(--bg-secondary)',
              minWidth: '160px',
              fontSize: '10px',
              textTransform: 'uppercase',
            }}>
              Metric
            </th>
            {cols.map((col, i) => (
              <th key={i} style={{
                padding: '8px 12px',
                textAlign: 'right',
                color: i === 0 ? 'var(--gold)' : 'var(--text-primary)',
                fontWeight: 600,
                borderBottom: '1px solid var(--border-color)',
                minWidth: '100px',
                fontFamily: 'monospace',
                fontSize: '11px',
              }}>
                {col.date ? col.date.slice(0, 7) : col.period || '\u2014'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.key}
              style={{ backgroundColor: ri % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}
            >
              <td style={{
                padding: '8px 12px',
                color: 'var(--text-secondary)',
                position: 'sticky',
                left: 0,
                backgroundColor: ri % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
              }}>
                {row.label}
              </td>
              {cols.map((col, ci) => {
                const val = col[row.key];
                const num = typeof val === 'number' ? val : null;
                return (
                  <td key={ci} style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontVariantNumeric: 'tabular-nums',
                    color: row.pct
                      ? 'var(--text-primary)'
                      : num == null ? 'var(--text-tertiary)' : num < 0 ? 'var(--red)' : 'var(--text-primary)',
                  }}>
                    {formatValue(val, row.pct)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinancialsTab({ symbol }) {
  const [tab, setTab] = useState('income');
  const [period, setPeriod] = useState('annual');
  const [data, setData] = useState({ income: null, balance: null, cashflow: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const [income, balance, cashflow] = await Promise.all([
        getIncomeStatement(symbol, period, period === 'annual' ? 5 : 8),
        getBalanceSheet(symbol, period, period === 'annual' ? 5 : 8),
        getCashFlow(symbol, period, period === 'annual' ? 5 : 8),
      ]);
      setData({ income, balance, cashflow });
    } catch {
      setError('Failed to load financial data.');
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => { load(); }, [load]);

  const tabData = tab === 'income' ? data.income : tab === 'balance' ? data.balance : data.cashflow;
  const tabRows = tab === 'income' ? INCOME_ROWS : tab === 'balance' ? BALANCE_ROWS : CASHFLOW_ROWS;

  return (
    <div className="page-fade-in" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '16px', boxShadow: 'var(--card-shadow)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[
            { key: 'income', label: 'Income Statement' },
            { key: 'balance', label: 'Balance Sheet' },
            { key: 'cashflow', label: 'Cash Flow' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: tab === t.key ? 600 : 400,
                padding: '4px 14px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['annual', 'quarterly'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                background: period === p ? 'var(--bg-tertiary)' : 'none',
                border: '1px solid',
                borderColor: period === p ? 'var(--gold)' : 'var(--border-color)',
                color: period === p ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                textTransform: 'capitalize',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '32px', width: '100%', marginBottom: '4px' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: 'var(--red-muted)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--red)', margin: '0 0 8px', fontSize: '13px' }}>{error}</p>
          <button onClick={load} style={{ background: 'var(--red)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            Retry
          </button>
        </div>
      ) : (
        <DataTable rows={tabRows} data={tabData} period={period} />
      )}
    </div>
  );
}
