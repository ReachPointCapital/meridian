import { useState, useCallback, useEffect, useRef } from 'react';
import { calculateOption } from '../utils/blackScholes';

export function useOptions() {
  const [inputs, setInputs] = useState({
    symbol: '',
    stockPrice: '',
    strikePrice: '',
    daysToExpiry: '',
    expiryDate: '',
    impliedVol: '',
    riskFreeRate: '5.25',
    optionType: 'call',
  });
  const [result, setResult] = useState(null);
  const debounceRef = useRef(null);

  const setField = useCallback((field, value) => {
    setInputs(prev => {
      const next = { ...prev, [field]: value };

      // Sync DTE and expiry date
      if (field === 'expiryDate' && value) {
        const expiry = new Date(value + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.max(1, Math.round((expiry - today) / 86400000));
        next.daysToExpiry = String(diff);
      } else if (field === 'daysToExpiry' && value) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(value));
        next.expiryDate = d.toISOString().split('T')[0];
      }

      return next;
    });
  }, []);

  const calculate = useCallback(() => {
    const S = parseFloat(inputs.stockPrice);
    const K = parseFloat(inputs.strikePrice);
    const T = parseFloat(inputs.daysToExpiry) / 365;
    const r = parseFloat(inputs.riskFreeRate) / 100;
    const sigma = parseFloat(inputs.impliedVol) / 100;

    if ([S, K, T, r, sigma].some(isNaN)) return;

    const call = calculateOption(S, K, T, r, sigma, 'call');
    const put = calculateOption(S, K, T, r, sigma, 'put');
    setResult({ call, put, S, K, T, r, sigma, dte: parseFloat(inputs.daysToExpiry) });
  }, [inputs]);

  // Auto-initialize IV to 30% when stockPrice is first set and IV is empty
  useEffect(() => {
    if (inputs.stockPrice && !inputs.impliedVol) {
      setInputs(prev => ({ ...prev, impliedVol: '30' }));
    }
  }, [inputs.stockPrice, inputs.impliedVol]);

  // Auto-calculate whenever all required inputs are present
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const S = parseFloat(inputs.stockPrice);
      const K = parseFloat(inputs.strikePrice);
      const T = parseFloat(inputs.daysToExpiry);
      const sigma = parseFloat(inputs.impliedVol);
      if (!isNaN(S) && !isNaN(K) && !isNaN(T) && !isNaN(sigma) && S > 0 && K > 0 && T > 0 && sigma > 0) {
        calculate();
      }
    }, 50);
    return () => clearTimeout(debounceRef.current);
  }, [inputs.stockPrice, inputs.strikePrice, inputs.daysToExpiry, inputs.impliedVol, inputs.riskFreeRate, inputs.optionType]); // eslint-disable-line react-hooks/exhaustive-deps

  return { inputs, setField, calculate, result };
}
