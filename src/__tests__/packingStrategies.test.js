// @vitest-environment node
// (Lógica pura sin DOM; node env evita el overhead de jsdom.)

import { describe, it, expect } from 'vitest';
import {
  PACKING_STRATEGIES,
  getStrategy,
  maxVolumeStrategy,
} from '../packingStrategies.js';
import { quickStrat } from '../packing.js';

const TR = { largo: 1615.4, ancho: 247, alto: 280 };

const sampleItems = () => ([
  { id: 1, name: 'A', color: '#fff', ancho: 65,   alto: 65, fondo: 40,    inv: 10 },
  { id: 2, name: 'B', color: '#000', ancho: 99.5, alto: 36, fondo: 199.5, inv: 5  },
]);

describe('PACKING_STRATEGIES', () => {
  it('contiene las 5 estrategias esperadas, en el orden esperado', () => {
    const keys = PACKING_STRATEGIES.map(s => s.key);
    expect(keys).toEqual(['max_pieces', 'max_volume', 'big_first', 'flat_first', 'balanced']);
  });

  it('cada estrategia tiene los campos requeridos (key, label, icon, desc, execute)', () => {
    for (const s of PACKING_STRATEGIES) {
      expect(s).toHaveProperty('key');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('icon');
      expect(s).toHaveProperty('desc');
      expect(s).toHaveProperty('execute');
      expect(typeof s.key).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(typeof s.icon).toBe('string');
      expect(typeof s.desc).toBe('string');
      expect(typeof s.execute).toBe('function');
    }
  });
});

describe('getStrategy', () => {
  it('devuelve la estrategia correcta para una key válida', () => {
    const s = getStrategy('max_volume');
    expect(s).not.toBeNull();
    expect(s.key).toBe('max_volume');
    expect(s).toBe(maxVolumeStrategy);
  });

  it('devuelve null para una key inexistente', () => {
    expect(getStrategy('nonexistent')).toBeNull();
    expect(getStrategy('')).toBeNull();
  });
});

describe('quickStrat — error handling', () => {
  it('lanza Error con mensaje claro para una key inexistente', () => {
    expect(() => quickStrat('nonexistent', sampleItems(), TR, 'free'))
      .toThrow('Unknown strategy: nonexistent');
  });
});

describe('Strategy.execute — sanity', () => {
  it('maxVolumeStrategy.execute devuelve items con load asignado', () => {
    const items = sampleItems();
    const result = maxVolumeStrategy.execute(items, TR, 'free');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(items.length);
    for (const r of result) {
      expect(r).toHaveProperty('load');
      expect(typeof r.load).toBe('number');
      expect(r.load).toBeGreaterThanOrEqual(0);
      expect(r.load).toBeLessThanOrEqual(r.inv);
    }
  });
});
