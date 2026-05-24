// Setup global para Vitest + React Testing Library.
//
// - jest-dom: matchers extra (toBeInTheDocument, toHaveAttribute, etc.).
// - cleanup automático del DOM tras cada test para evitar fugas entre cases.
// - mock de localStorage en memoria, reinicializado antes de cada test
//   para que los archivos que persistan en él lo hagan en estado limpio.

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
  key(i) { return Object.keys(this.store)[i] ?? null; }
  get length() { return Object.keys(this.store).length; }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// jsdom no implementa matchMedia; lo stubeamos con prefer-light por default.
// Tests específicos (useTheme.test) lo sobreescriben con su propio stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
