import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useOptions } from '../../hooks/useOptions';
import { calculateOption } from '../../utils/blackScholes';
import { api } from '../../services/api';

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: '4px', cursor: 'help' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, width: '14px', height: '14px', borderRadius: '50%', border: '1px solid var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>i</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1a1a2e', color: '#e0e0e0', fontSize: '11px', padding: '8px 10px',
          borderRadius: '6px', border: '1px solid #333', whiteSpace: 'nowrap', zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', marginBottom: '4px', maxWidth: '240px',
          lineHeight: 1.4,
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder, min, max, step, suffix, tooltip }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            padding: suffix ? '8px 32px 8px 10px' : '8px 10px',
            outline: 'none',
            fontFamily: 'inherit',
            fontVariantNumeric: 'tabular-nums',
            boxSizing: 'border-box',
            transition: 'border-color 150ms ease',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--gold)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '12px' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function GreekRow({ label, value, description }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{label}</span>
        <InfoTooltip text={description} />
      </div>
      <span style={{ color: 'var(--gold)', fontSize: '14px', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function PayoffDiagram({ result, optionType }) {
  if (!result) return null;
  const { S, K, T, r, sigma, call: callResult, put: putResult } = result;
  const premium = optionType === 'call' ? callResult.price : putResult.price;

  const points = [];
  const range = S * 0.3;
  const step = range / 40;
  for (let price = S - range; price <= S + range; price += step) {
    const atExpiry = optionType === 'call'
      ? Math.max(0, price - K) - premium
      : Math.max(0, K - price) - premium;
    const now = calculateOption(price, K, T, r, sigma, optionType).price - premium;
    points.push({
      price: parseFloat(price.toFixed(2)),
      atExpiry: parseFloat((atExpiry * 100).toFixed(2)),
      now: parseFloat((now * 100).toFixed(2)),
    });
  }

  const breakeven = optionType === 'call' ? K + premium : K - premium;
  const maxLoss = -premium * 100;
  const maxProfit = optionType === 'call' ? 'Unlimited' : ((K - premium) * 100).toFixed(0);

  return (
    <div style={{ marginTop: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
      <h3 style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
        P&L Payoff Diagram {'\u2014'} {optionType === 'call' ? 'Call' : 'Put'} (1 Contract)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="price" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => `$${v}`} />
          <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={v => `$${v}`} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', fontSize: '11px' }}>
                <div style={{ color: 'var(--text-primary)' }}>Stock: ${d.price}</div>
                <div style={{ color: 'var(--gold)' }}>Now: ${d.now}</div>
                <div style={{ color: 'var(--text-secondary)' }}>At Expiry: ${d.atExpiry}</div>
              </div>
            );
          }} />
          <ReferenceLine y={0} stroke="var(--text-tertiary)" strokeDasharray="3 3" />
          <ReferenceLine x={breakeven} stroke="var(--gold)" strokeDasharray="5 5" label={{ value: `BE: $${breakeven.toFixed(2)}`, fill: 'var(--gold)', fontSize: 10 }} />
          <ReferenceLine x={S} stroke="var(--text-tertiary)" strokeDasharray="2 2" />
          <Line type="monotone" dataKey="atExpiry" stroke="var(--text-secondary)" strokeWidth={1.5} dot={false} name="At Expiry" />
          <Line type="monotone" dataKey="now" stroke="var(--gold)" strokeWidth={2} dot={false} name="Now" />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Breakeven: <span style={{ color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 600 }}>${breakeven.toFixed(2)}</span>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Max Loss: <span style={{ color: 'var(--red)', fontFamily: 'monospace', fontWeight: 600 }}>${maxLoss.toFixed(0)}</span>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Max Profit: <span style={{ color: 'var(--green)', fontFamily: 'monospace', fontWeight: 600 }}>{maxProfit === 'Unlimited' ? 'Unlimited' : `$${maxProfit}`}</span>
        </span>
      </div>
    </div>
  );
}

function PLGrid({ result }) {
  if (!result) return null;
  const { S, K, T, r, sigma, call: callResult, put: putResult } = result;

  const priceSteps = [];
  for (let pct = 20; pct >= -20; pct -= 2.5) {
    priceSteps.push(S * (1 + pct / 100));
  }

  const timeFractions = [0, 0.25, 0.5, 0.75, 1];
  const timeLabels = ['Today', '25% DTE', '50% DTE', '75% DTE', 'Expiry'];

  const initialCallPrice = callResult.price;
  const initialPutPrice = putResult.price;

  const getPL = (price, timeFrac, optionType) => {
    const remainT = T * (1 - timeFrac);
    const opt = calculateOption(price, K, remainT, r, sigma, optionType);
    const initial = optionType === 'call' ? initialCallPrice : initialPutPrice;
    return (opt.price - initial) * 100;
  };

  const allPLs = [];
  priceSteps.forEach(price => {
    timeFractions.forEach(tf => {
      allPLs.push(getPL(price, tf, 'call'));
    });
  });
  const maxPL = Math.max(...allPLs.map(Math.abs));

  const getCellColor = (pl) => {
    if (maxPL === 0) return 'transparent';
    const ratio = pl / maxPL;
    if (ratio > 0.05) return `rgba(5, 46, 22, ${Math.min(1, ratio + 0.3)})`;
    if (ratio < -0.05) return `rgba(45, 10, 10, ${Math.min(1, Math.abs(ratio) + 0.3)})`;
    return 'transparent';
  };

  const getTextColor = (pl) => {
    if (pl > 0) return 'var(--green)';
    if (pl < 0) return 'var(--red)';
    return 'var(--text-secondary)';
  };

  return (
    <div style={{ marginTop: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
      <h3 style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
        P&L Scenarios {'\u2014'} Call (1 Contract)
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>
                Stock Price
              </th>
              {timeLabels.map(l => (
                <th key={l} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priceSteps.map((price, pi) => (
              <tr key={pi}>
                <td style={{
                  padding: '5px 10px',
                  color: Math.abs(price - S) < 0.01 ? 'var(--gold)' : 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: Math.abs(price - S) < 0.01 ? 700 : 400,
                  borderBottom: '1px solid var(--border-color)',
                  whiteSpace: 'nowrap',
                }}>
                  ${price.toFixed(2)}
                  {Math.abs(price - S) < 0.01 && <span style={{ color: 'var(--gold)', fontSize: '9px', marginLeft: '4px' }}>Current</span>}
                </td>
                {timeFractions.map((tf, ti) => {
                  const pl = getPL(price, tf, 'call');
                  return (
                    <td key={ti} style={{
                      padding: '5px 10px',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontVariantNumeric: 'tabular-nums',
                      color: getTextColor(pl),
                      backgroundColor: getCellColor(pl),
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      {pl >= 0 ? '+' : ''}{pl.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OptionsCalculator() {
  const { inputs, setField, calculate, result } = useOptions();
  const [loadingPrice, setLoadingPrice] = useState(false);

  const fetchPrice = async () => {
    if (!inputs.symbol) return;
    setLoadingPrice(true);
    try {
      const q = await api.quote(inputs.symbol.toUpperCase());
      const quote = Array.isArray(q) ? q[0] : q;
      if (quote?.price) {
        setField('stockPrice', quote.price.toFixed(2));
        setField('symbol', inputs.symbol.toUpperCase());
        // Auto-set strike to nearest round
        if (!inputs.strikePrice) {
          setField('strikePrice', (Math.round(quote.price / 5) * 5).toFixed(2));
        }
        // Auto-set DTE if empty
        if (!inputs.daysToExpiry) {
          setField('daysToExpiry', '30');
        }
      }
    } catch {}
    setLoadingPrice(false);
  };

  // Auto-calculate after price fetch fills inputs
  useEffect(() => {
    if (inputs.stockPrice && inputs.strikePrice && inputs.daysToExpiry && inputs.impliedVol) {
      calculate();
    }
  }, [inputs.stockPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const expiryDateDisplay = inputs.daysToExpiry
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(inputs.daysToExpiry));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      })()
    : null;

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
          Options Calculator
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
          Black-Scholes pricing with full Greeks
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', alignItems: 'start' }}>
        {/* Input Panel */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
          <h3 style={{ color: 'var(--gold)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Inputs
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Symbol
              <InfoTooltip text="Enter a stock ticker symbol and click Get Price to fetch the current market price" />
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={inputs.symbol}
                onChange={e => setField('symbol', e.target.value.toUpperCase())}
                placeholder="AAPL"
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  padding: '8px 10px',
                  outline: 'none',
                  fontFamily: 'monospace',
                  transition: 'border-color 150ms ease',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                onKeyDown={e => e.key === 'Enter' && fetchPrice()}
              />
              <button
                onClick={fetchPrice}
                disabled={loadingPrice}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {loadingPrice ? '\u2026' : 'Get Price'}
              </button>
            </div>
          </div>

          <InputField label="Stock Price" tooltip="Current market price of the underlying stock" value={inputs.stockPrice} onChange={v => setField('stockPrice', v)} type="number" placeholder="0.00" step="0.01" suffix="$" />
          <InputField label="Strike Price" tooltip="The price at which the option can be exercised" value={inputs.strikePrice} onChange={v => setField('strikePrice', v)} type="number" placeholder="0.00" step="0.01" suffix="$" />
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Expiry Date
              <InfoTooltip text="The date the option contract expires. Auto-syncs with Days to Expiration." />
            </label>
            <input
              type="date"
              value={inputs.expiryDate}
              onChange={e => setField('expiryDate', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                padding: '8px 10px',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 150ms ease',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--gold)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>
          <InputField
            label={`Days to Expiration${expiryDateDisplay ? ` (${expiryDateDisplay})` : ''}`}
            tooltip="Number of calendar days until expiration. Syncs with expiry date."
            value={inputs.daysToExpiry}
            onChange={v => setField('daysToExpiry', v)}
            type="number"
            placeholder="30"
            min="1"
          />

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Implied Volatility: {inputs.impliedVol ? `${inputs.impliedVol}%` : '\u2014'}
              <InfoTooltip text="Expected annualized volatility. Higher IV = higher option premiums. Typically 15-60% for most stocks." />
            </label>
            <input
              type="range"
              min="1"
              max="200"
              step="0.5"
              value={inputs.impliedVol || 30}
              onChange={e => setField('impliedVol', e.target.value)}
              style={{ width: '100%', accentColor: 'var(--gold)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>1%</span>
              <input
                type="number"
                value={inputs.impliedVol}
                onChange={e => setField('impliedVol', e.target.value)}
                style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--gold)', fontSize: '12px', width: '50px', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }}
                min="1"
                max="200"
              />
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>200%</span>
            </div>
          </div>

          <InputField label="Risk-Free Rate" tooltip="Annualized risk-free interest rate, typically the 10-year Treasury yield" value={inputs.riskFreeRate} onChange={v => setField('riskFreeRate', v)} type="number" step="0.01" suffix="%" />

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Option Type
            </label>
            <div style={{ display: 'flex', gap: '0', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              {['call', 'put'].map(t => (
                <button
                  key={t}
                  onClick={() => setField('optionType', t)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: 'none',
                    backgroundColor: inputs.optionType === t ? 'var(--gold)' : 'var(--bg-primary)',
                    color: inputs.optionType === t ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={calculate}
            style={{
              width: '100%',
              backgroundColor: 'var(--gold)',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--bg-primary)',
              fontSize: '13px',
              fontWeight: 700,
              padding: '10px',
              cursor: 'pointer',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--gold)'}
          >
            Calculate
          </button>
        </div>

        {/* Results Panel */}
        <div>
          {!result ? (
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '48px',
              textAlign: 'center',
              boxShadow: 'var(--card-shadow)',
            }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>
                Enter inputs and click Calculate to see pricing and Greeks.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: 'var(--card-shadow)',
              }}>
                <h3 style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                  Option Prices
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'var(--green-muted)', border: '1px solid #16623A', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--green)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Call Price</div>
                    <div style={{ color: 'var(--green)', fontSize: '32px', fontFamily: 'monospace', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      ${result.call.price.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'var(--red-muted)', border: '1px solid #7F1D1D', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--red)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Put Price</div>
                    <div style={{ color: 'var(--red)', fontSize: '32px', fontFamily: 'monospace', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      ${result.put.price.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Intrinsic Value: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      ${(inputs.optionType === 'call' ? result.call : result.put).intrinsicValue.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Time Value: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      ${(inputs.optionType === 'call' ? result.call : result.put).timeValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--card-shadow)' }}>
                <h3 style={{ color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Greeks {'\u2014'} {inputs.optionType === 'call' ? 'Call' : 'Put'}
                </h3>
                {(() => {
                  const g = inputs.optionType === 'call' ? result.call : result.put;
                  return (
                    <>
                      <GreekRow label="Delta (\u0394)" value={g.delta.toFixed(4)} description="Price change per $1 move in the underlying stock. Calls: 0 to 1, Puts: -1 to 0." />
                      <GreekRow label="Gamma (\u0393)" value={g.gamma.toFixed(4)} description="Rate of change in Delta per $1 move. Highest for at-the-money options near expiry." />
                      <GreekRow label="Theta (\u0398)" value={`${g.theta.toFixed(4)}/day`} description="Daily time decay. The amount the option loses per day, all else equal. Always negative for long options." />
                      <GreekRow label="Vega (\u03BD)" value={g.vega.toFixed(4)} description="Price change per 1% increase in implied volatility. Highest for at-the-money, long-dated options." />
                      <GreekRow label="Rho (\u03C1)" value={g.rho.toFixed(4)} description="Price change per 1% increase in interest rates. Small effect for short-dated options." />
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      <PayoffDiagram result={result} optionType={inputs.optionType} />
      <PLGrid result={result} />
    </div>
  );
}
