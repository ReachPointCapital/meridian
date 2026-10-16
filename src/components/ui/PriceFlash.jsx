import React, { useEffect, useRef, useState } from 'react';

// 'flash-up' / 'flash-down' when a numeric value moves, '' otherwise (the animation lives in src/index.css).
export function flashDirection(prev, next) {
  if (typeof prev !== 'number' || typeof next !== 'number') return '';
  if (!Number.isFinite(prev) || !Number.isFinite(next) || prev === next) return '';
  return next > prev ? 'flash-up' : 'flash-down';
}

// Returns the flash class for ~900ms after the value changes. The first value, and a value that arrives after
// loading (null -> number), never flash.
export function usePriceFlash(value, duration = 900) {
  const previous = useRef(value);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    const direction = flashDirection(previous.current, value);
    previous.current = value;
    if (!direction) return undefined;
    setFlash(direction);
    const timer = setTimeout(() => setFlash(''), duration);
    return () => clearTimeout(timer);
  }, [value, duration]);

  return flash;
}

export default function PriceFlash({ value, children, style }) {
  const flash = usePriceFlash(value);
  return <span className={flash || undefined} style={style}>{children}</span>;
}
