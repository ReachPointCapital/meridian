import React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import PriceFlash, { flashDirection, usePriceFlash } from './PriceFlash';

describe('flashDirection', () => {
  test.each([
    [100, 101, 'flash-up'],
    [101, 100, 'flash-down'],
    [100, 100, ''],
    [null, 100, ''],
    [100, null, ''],
    [undefined, 100, ''],
    [NaN, 1, ''],
    ['100', 101, ''],
  ])('%p -> %p is %p', (prev, next, expected) => {
    expect(flashDirection(prev, next)).toBe(expected);
  });
});

describe('usePriceFlash', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('does not flash on the first render', () => {
    const { result } = renderHook(({ v }) => usePriceFlash(v), { initialProps: { v: 100 } });
    expect(result.current).toBe('');
  });

  test('flashes up when the value rises, then clears', () => {
    const { result, rerender } = renderHook(({ v }) => usePriceFlash(v), { initialProps: { v: 100 } });
    rerender({ v: 101 });
    expect(result.current).toBe('flash-up');
    act(() => { jest.advanceTimersByTime(900); });
    expect(result.current).toBe('');
  });

  test('flashes down when the value falls', () => {
    const { result, rerender } = renderHook(({ v }) => usePriceFlash(v), { initialProps: { v: 100 } });
    rerender({ v: 99.5 });
    expect(result.current).toBe('flash-down');
  });

  test('a value arriving after loading (null -> number) is not a flash', () => {
    const { result, rerender } = renderHook(({ v }) => usePriceFlash(v), { initialProps: { v: null } });
    rerender({ v: 100 });
    expect(result.current).toBe('');
  });
});

test('PriceFlash wraps its children in a span that carries the flash class', () => {
  const { container, rerender } = render(<PriceFlash value={1}>$1.00</PriceFlash>);
  expect(container.firstChild).not.toHaveClass('flash-up');
  rerender(<PriceFlash value={2}>$2.00</PriceFlash>);
  expect(container.firstChild).toHaveClass('flash-up');
  expect(container.firstChild).toHaveTextContent('$2.00');
});
