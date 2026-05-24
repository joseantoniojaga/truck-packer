import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoldRepeat } from '../useHoldRepeat.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHoldRepeat', () => {
  it('press dispara el callback una vez inmediatamente', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useHoldRepeat(cb, 150));
    act(() => { result.current.start('x'); });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('x');
    act(() => { result.current.stop(); });
  });

  it('press y mantener dispara el callback con intervalo', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useHoldRepeat(cb, 100));
    act(() => { result.current.start(42); });
    expect(cb).toHaveBeenCalledTimes(1); // disparo inmediato
    act(() => { vi.advanceTimersByTime(100); });
    expect(cb).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(100); });
    expect(cb).toHaveBeenCalledTimes(3);
    act(() => { vi.advanceTimersByTime(250); }); // dos ticks más + sobra
    expect(cb).toHaveBeenCalledTimes(5);
    // Todos los disparos con el mismo argumento
    for (const call of cb.mock.calls) expect(call[0]).toBe(42);
    act(() => { result.current.stop(); });
  });

  it('release detiene los disparos', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useHoldRepeat(cb, 100));
    act(() => { result.current.start(); });
    expect(cb).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(100); });
    expect(cb).toHaveBeenCalledTimes(2);
    act(() => { result.current.stop(); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(cb).toHaveBeenCalledTimes(2); // ya no se incrementa
  });

  it('unmount limpia el interval (no hay leaks)', () => {
    const cb = vi.fn();
    const { result, unmount } = renderHook(() => useHoldRepeat(cb, 100));
    act(() => { result.current.start(); });
    expect(cb).toHaveBeenCalledTimes(1);
    unmount();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(cb).toHaveBeenCalledTimes(1); // sin nuevos disparos post-unmount
  });

  it('si el callback cambia entre renders, se usa el último', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useHoldRepeat(cb, 100), {
      initialProps: { cb: cb1 },
    });
    act(() => { result.current.start('a'); });
    expect(cb1).toHaveBeenCalledTimes(1);
    // El caller cambia el callback antes del próximo tick.
    rerender({ cb: cb2 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(cb1).toHaveBeenCalledTimes(1); // viejo NO se llamó otra vez
    expect(cb2).toHaveBeenCalledTimes(1); // nuevo SÍ se llamó en el tick
    act(() => { result.current.stop(); });
  });
});
