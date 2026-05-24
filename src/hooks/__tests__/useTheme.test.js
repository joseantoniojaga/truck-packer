import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme.js';

// jsdom no implementa matchMedia; lo stubeamos por test con la preferencia
// que cada caso necesita.
function stubMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  globalThis.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  stubMatchMedia(false); // default: usuario prefiere light
});

describe('useTheme', () => {
  it('tema por defecto es "light" cuando no hay localStorage ni preferencia dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('tema por defecto es "dark" cuando no hay localStorage pero prefers-color-scheme:dark', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('usa el valor guardado en localStorage si existe', () => {
    globalThis.localStorage.setItem('truckpacker-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme cambia entre light y dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('dark');
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('light');
  });

  it('persiste el tema en localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    expect(globalThis.localStorage.getItem('truckpacker-theme')).toBe('dark');
    act(() => { result.current.toggleTheme(); });
    expect(globalThis.localStorage.getItem('truckpacker-theme')).toBe('light');
  });

  it('aplica el atributo data-theme al documentElement', () => {
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    act(() => { result.current.toggleTheme(); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
