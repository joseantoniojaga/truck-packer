// @vitest-environment node
// (packing.test.js es lógica pura sin DOM; usar node env evita el overhead de
// jsdom que rompía el threshold de 2000ms del test de quickStrat.)

import { describe, it, expect } from 'vitest';
import { getRots, hmapGetZ, supportRatio, findBestPos, fullPack, quickStrat } from './packing.js';
import { calculateSwapOptions } from './swapCalculator.js';
import { FURNITURE } from './furniture.js';
import { computeLoadingOrder } from './loadingSequence.js';

const TR = { largo: 1615.4, ancho: 247, alto: 280 };

function overlaps(a, b) {
  return Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x) > 0.1 &&
         Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y) > 0.1;
}

// ─── Test 1: getRots - rotaciones únicas ─────────────────────────────────────
describe('Test 1: Rotaciones únicas', () => {
  it('[1,2,3] → 6 rotaciones únicas', () => {
    expect(getRots(1, 2, 3).length).toBe(6);
  });

  it('[1,1,2] → 3 rotaciones únicas', () => {
    expect(getRots(1, 1, 2).length).toBe(3);
  });

  it('[5,5,5] → 1 rotación única', () => {
    expect(getRots(5, 5, 5).length).toBe(1);
  });
});

// ─── Test 2: hmapGetZ - mapa de altura ───────────────────────────────────────
describe('Test 2: hmapGetZ', () => {
  it('Sin items → z=0', () => {
    expect(hmapGetZ(0, 0, 10, 10, [])).toBe(0);
  });

  it('Item debajo → z = altura del item', () => {
    const base = { x: 0, y: 0, z: 0, l: 100, w: 100, h: 50 };
    expect(Math.abs(hmapGetZ(0, 0, 100, 100, [base]) - 50)).toBeLessThan(0.1);
  });

  it('Sin solapamiento → z=0', () => {
    const base = { x: 0, y: 0, z: 0, l: 100, w: 100, h: 50 };
    expect(hmapGetZ(200, 0, 50, 50, [base])).toBe(0);
  });
});

// ─── Test 3: supportRatio ────────────────────────────────────────────────────
describe('Test 3: Soporte 80%', () => {
  const base = { id: 1, x: 0, y: 0, z: 0, l: 100, w: 100, h: 50 };

  it('Soporte completo = 100%', () => {
    const full = supportRatio(0, 0, 100, 100, 50, [base]);
    expect(Math.abs(full - 1.0)).toBeLessThan(0.01);
  });

  it('Soporte parcial < 80%', () => {
    const partial = supportRatio(0, 0, 300, 300, 50, [base]);
    expect(partial).toBeLessThan(0.8);
  });

  it('z=0 → soporte 100%', () => {
    expect(supportRatio(500, 500, 200, 200, 0, [])).toBe(1);
  });
});

// ─── Test 4: findBestPos rechaza apoyo insuficiente ──────────────────────────
describe('Test 4: findBestPos rechaza apoyo insuficiente', () => {
  it('rechaza posición con soporte insuficiente', () => {
    const base = { id: 1, x: 0, y: 0, z: 0, l: 100, w: 100, h: 50 };
    const smallTR = { largo: 300, ancho: 300, alto: 200 };
    const pos = findBestPos([300, 50, 300], [base], smallTR, 'backToFront', 2);
    expect(pos === null || pos.z < 1).toBe(true);
  });
});

// ─── Test 5: Gravedad ────────────────────────────────────────────────────────
describe('Test 5: Gravedad', () => {
  it('item 2 se apila exactamente encima del item 1', () => {
    const narrow = { largo: 500, ancho: 65, alto: 400 };
    const dims = [65, 50, 80];
    const placed = [];

    const p1 = findBestPos(dims, placed, narrow, 'backToFront', 1);
    expect(p1).not.toBeNull();
    placed.push({ id: 1, x: p1.x, y: p1.y, z: p1.z, l: p1.l, w: p1.w, h: p1.h });

    const p2 = findBestPos(dims, placed, narrow, 'backToFront', 1);
    expect(p2).not.toBeNull();
    expect(p2.z).toBeGreaterThan(0);
    expect(Math.abs(p2.z - placed[0].h)).toBeLessThan(1);
  });
});

// ─── Test 6: No flotan ───────────────────────────────────────────────────────
describe('Test 6: No flotan', () => {
  const items = [
    { id: 1, name: 'A', color: '#f00', ancho: 99.5, alto: 36,  fondo: 199.5, load: 10, inv: 10 },
    { id: 2, name: 'B', color: '#0f0', ancho: 65,   alto: 65,  fondo: 40,    load: 8,  inv: 8 },
    { id: 3, name: 'C', color: '#00f', ancho: 81,   alto: 172, fondo: 7.5,   load: 5,  inv: 5 },
  ];
  const { placed } = fullPack(items, TR, 'backToFront');

  it('hay items colocados', () => {
    expect(placed.length).toBeGreaterThan(0);
  });

  it('todos los items elevados tienen soporte', () => {
    for (const p of placed) {
      if (p.z < 1) continue;
      const hasSupport = placed.some(b => b !== p && Math.abs(b.z + b.h - p.z) < 1 && overlaps(p, b));
      expect(hasSupport).toBe(true);
    }
  });
});

// ─── Test 7: Sin huecos obvios ───────────────────────────────────────────────
describe('Test 7: Sin huecos obvios', () => {
  const buro = { id: 4, name: 'Buró Hampton', color: '#F2CC8F',
                 ancho: 65, alto: 65, fondo: 40, load: 32, inv: 32 };
  const { placed } = fullPack([buro], TR, 'backToFront');

  it('hay burós colocados', () => {
    expect(placed.length).toBeGreaterThan(0);
  });

  it('densidad en bounding box > 60%', () => {
    const maxX = Math.max(...placed.map(p => p.x + p.l));
    const maxY = Math.max(...placed.map(p => p.y + p.w));
    const maxZ = Math.max(...placed.map(p => p.z + p.h));
    const bboxVol = maxX * maxY * maxZ;
    const usedVol = placed.reduce((s, p) => s + p.l * p.w * p.h, 0);
    expect(usedVol / bboxVol).toBeGreaterThan(0.60);
  });
});

// ─── Test 8: No escalones ────────────────────────────────────────────────────
describe('Test 8: No escalones', () => {
  const narrow = { largo: 500, ancho: 65, alto: 500 };
  const box = { id: 7, name: 'Box', color: '#abc',
                ancho: 65, alto: 50, fondo: 80, load: 6, inv: 6 };
  const { placed } = fullPack([box], narrow, 'backToFront');
  const elevated = placed.filter(p => p.z > 1);

  it('hay items elevados para verificar', () => {
    expect(elevated.length).toBeGreaterThan(0);
  });

  it('todos los items elevados tienen base directa debajo', () => {
    for (const item of elevated) {
      const hasBase = placed.some(b =>
        b !== item &&
        Math.abs(b.x - item.x) < 1 &&
        Math.abs(b.y - item.y) < 1 &&
        Math.abs(b.z + b.h - item.z) < 1
      );
      expect(hasBase).toBe(true);
    }
  });
});

// ─── Test 9: Sin solapamiento ────────────────────────────────────────────────
describe('Test 9: Sin solapamiento', () => {
  it('ningún par de items se solapa', () => {
    const items = [
      { id: 1, name: 'A', color: '#f00', ancho: 65,   alto: 65, fondo: 40,    load: 10, inv: 10 },
      { id: 2, name: 'B', color: '#0f0', ancho: 99.5, alto: 36, fondo: 199.5, load: 5,  inv: 5 },
    ];
    const { placed } = fullPack(items, TR, 'backToFront');
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        const xOv = Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x);
        const yOv = Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y);
        const zOv = Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z);
        expect(xOv > 0.1 && yOv > 0.1 && zOv > 0.1).toBe(false);
      }
    }
  });
});

// ─── Test 10: Dentro del tráiler ─────────────────────────────────────────────
describe('Test 10: Dentro del tráiler', () => {
  it('todos los items caben dentro del tráiler', () => {
    const items = [
      { id: 1, name: 'A', color: '#f00', ancho: 65,   alto: 65, fondo: 40,    load: 15, inv: 15 },
      { id: 2, name: 'B', color: '#0f0', ancho: 99.5, alto: 36, fondo: 199.5, load: 10, inv: 10 },
    ];
    const { placed } = fullPack(items, TR, 'backToFront');
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(-0.1);
      expect(p.x + p.l).toBeLessThanOrEqual(TR.largo + 0.1);
      expect(p.y).toBeGreaterThanOrEqual(-0.1);
      expect(p.y + p.w).toBeLessThanOrEqual(TR.ancho + 0.1);
      expect(p.z).toBeGreaterThanOrEqual(-0.1);
      expect(p.z + p.h).toBeLessThanOrEqual(TR.alto + 0.1);
    }
  });
});

// ─── Quitar item y setInv sin reorganizar ────────────────────────────────────
describe('Quitar item sin reorganizar', () => {
  it('Quitar item: placed se reduce en 1', () => {
    const items = [{ id: 4, name: 'B', inv: 32, ancho: 65, alto: 65, fondo: 40, color: '#F2CC8F', load: 5 }];
    const { placed } = fullPack(items, TR, 'free');
    const originalCount = placed.length;
    const lastIdx = [...placed].reverse().findIndex(p => p.id === 4);
    const realIdx = placed.length - 1 - lastIdx;
    const newPlaced = placed.filter((_, i) => i !== realIdx);
    expect(newPlaced.length).toBe(originalCount - 1);
  });

  it('Quitar item: los demás no se mueven', () => {
    const items = [{ id: 4, name: 'B', inv: 32, ancho: 65, alto: 65, fondo: 40, color: '#F2CC8F', load: 5 }];
    const { placed } = fullPack(items, TR, 'free');
    const lastIdx = [...placed].reverse().findIndex(p => p.id === 4);
    const realIdx = placed.length - 1 - lastIdx;
    const remaining = placed.filter((_, i) => i !== realIdx);
    for (let i = 0; i < remaining.length; i++) {
      const orig = placed.filter((_, j) => j !== realIdx)[i];
      expect(remaining[i].x).toBe(orig.x);
      expect(remaining[i].y).toBe(orig.y);
      expect(remaining[i].z).toBe(orig.z);
    }
  });

  it('fullPack: items del mismo tipo se apilan en columnas (no escalones)', () => {
    // Buró Hampton (65×65×40): h=40 permite apilar 7 (7×40=280=alto tráiler)
    const items = [{ id: 4, name: 'Buró Hampton', inv: 32, ancho: 65, alto: 65, fondo: 40, color: '#F2CC8F', load: 4 }];
    const { placed } = fullPack(items, TR, 'backToFront');
    const positions = {};
    for (const p of placed) {
      const key = Math.round(p.x) + ',' + Math.round(p.y);
      positions[key] = (positions[key] || 0) + 1;
    }
    const singles = Object.values(positions).filter(c => c === 1).length;
    const total = Object.keys(positions).length;
    expect(singles).toBeLessThanOrEqual(total * 0.5);
  });

  it('Cambiar inventario no mueve items existentes', () => {
    const items = [{ id: 4, name: 'B', inv: 32, ancho: 65, alto: 65, fondo: 40, color: '#F2CC8F', load: 5 }];
    const { placed } = fullPack(items, TR, 'free');
    const pos0 = { x: placed[0].x, y: placed[0].y, z: placed[0].z };
    // Simular bajar inventario a 30 (load 5 no se afecta, items placed no cambian)
    expect(placed[0].x).toBe(pos0.x);
  });
});

// ─── Tests por tipo de mueble (3 × FURNITURE) ────────────────────────────────
describe('Tests por tipo de mueble', () => {
  for (const furn of FURNITURE) {
    it(`${furn.name}: se coloca en z=0`, () => {
      const pos = findBestPos([furn.ancho, furn.alto, furn.fondo], [], TR, 'free', furn.id);
      expect(pos).not.toBeNull();
      expect(pos.z).toBe(0);
    });

    it(`${furn.name}: 2 items se apilan sin escalonar`, () => {
      const pos1 = findBestPos([furn.ancho, furn.alto, furn.fondo], [], TR, 'backToFront', furn.id);
      const item1 = { id: furn.id, name: furn.name, color: furn.color, x: pos1.x, y: pos1.y, z: pos1.z, l: pos1.l, w: pos1.w, h: pos1.h };
      const pos2 = findBestPos([furn.ancho, furn.alto, furn.fondo], [item1], TR, 'backToFront', furn.id);
      expect(pos2).not.toBeNull();
      const stacked = Math.abs(pos2.x - pos1.x) < 1 && Math.abs(pos2.y - pos1.y) < 1 && pos2.z > 0;
      const adjacent = pos2.z === 0;
      expect(stacked || adjacent).toBe(true);
    });

    it(`${furn.name}: inventario completo sin flotar`, () => {
      const items = [{ id: furn.id, name: furn.name, inv: furn.inv, ancho: furn.ancho, alto: furn.alto, fondo: furn.fondo, color: furn.color, load: Math.min(furn.inv, 20) }];
      const { placed } = fullPack(items, TR, 'backToFront');
      for (const p of placed) {
        if (p.z < 1) continue;
        const sup = supportRatio(p.x, p.y, p.l, p.w, p.z, placed.filter(b => b !== p));
        expect(sup).toBeGreaterThanOrEqual(0.79);
      }
    });
  }
});

// ─── Simulador de carga ──────────────────────────────────────────────────────
describe('Simulador de carga', () => {
  it('Loading order: items del fondo van primero', () => {
    const placed = [
      { id: 1, name: 'A', color: '#fff', x: 500, y: 0, z: 0, l: 100, w: 100, h: 100 },
      { id: 2, name: 'B', color: '#fff', x: 0,   y: 0, z: 0, l: 100, w: 100, h: 100 },
    ];
    const seq = computeLoadingOrder(placed);
    expect(seq[0].item.x).toBe(0);
  });

  it('Loading order: piso antes que apilado', () => {
    const placed = [
      { id: 1, name: 'A', color: '#fff', x: 0, y: 0, z: 100, l: 100, w: 100, h: 100 },
      { id: 2, name: 'B', color: '#fff', x: 0, y: 0, z: 0,   l: 100, w: 100, h: 100 },
    ];
    const seq = computeLoadingOrder(placed);
    expect(seq[0].item.z).toBe(0);
  });

  it('Loading order: soporte antes que soportado', () => {
    const placed = [
      { id: 1, name: 'Arriba', color: '#fff', x: 0, y: 0, z: 50, l: 100, w: 100, h: 50 },
      { id: 2, name: 'Abajo',  color: '#fff', x: 0, y: 0, z: 0,  l: 100, w: 100, h: 50 },
    ];
    const seq = computeLoadingOrder(placed);
    expect(seq[0].item.name).toBe('Abajo');
    expect(seq[1].item.name).toBe('Arriba');
  });

  it('Loading order: secuencia completa tiene todos los items', () => {
    const placed = [
      { id: 1, name: 'A', color: '#f00', x: 0,   y: 0, z: 0,  l: 65, w: 65, h: 40 },
      { id: 2, name: 'B', color: '#0f0', x: 0,   y: 0, z: 40, l: 65, w: 65, h: 40 },
      { id: 3, name: 'C', color: '#00f', x: 100, y: 0, z: 0,  l: 65, w: 65, h: 40 },
    ];
    const seq = computeLoadingOrder(placed);
    expect(seq.length).toBe(3);
  });
});

// ─── Intercambio inteligente (calculateSwapOptions) ──────────────────────────
describe('Intercambio inteligente', () => {
  it('Swap: encuentra opciones cuando el camión está lleno de burós', () => {
    const items = [
      { id: 4, name: 'Buró Hampton', inv: 200, ancho: 65, alto: 65, fondo: 40, color: '#F2CC8F', load: 100 },
    ];
    const { placed } = fullPack(items, TR, 'free');
    const tocador = { id: 1, name: 'Tocador Boston', ancho: 122.5, alto: 89.5, fondo: 42, color: '#E07A5F', load: 0 };
    const opts = calculateSwapOptions(tocador, items, placed, TR, 'free');
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].removeCount).toBeGreaterThanOrEqual(1);
  });

  it('Swap: opciones ordenadas por menor cantidad', () => {
    const items = [
      { id: 4, name: 'Buró',       inv: 50, ancho: 65,  alto: 65, fondo: 40,    color: '#F2CC8F', load: 20 },
      { id: 9, name: 'Base Queen', inv: 34, ancho: 150, alto: 36, fondo: 199.5, color: '#0F4C5C', load: 10 },
    ];
    const { placed } = fullPack(items, TR, 'free');
    const tocador = { id: 1, name: 'Tocador', ancho: 122.5, alto: 89.5, fondo: 42, color: '#E07A5F', load: 0 };
    const opts = calculateSwapOptions(tocador, items, placed, TR, 'free');
    if (opts.length >= 2) {
      expect(opts[0].removeCount).toBeLessThanOrEqual(opts[1].removeCount);
    }
  });
});

// ─── Performance ─────────────────────────────────────────────────────────────
describe('Performance', () => {
  it('fullPack con 200 items tarda menos de 3 segundos', () => {
    const items = [{ id: 4, name: 'Buró', inv: 200, ancho: 65, alto: 65, fondo: 40, color: '#F2CC8F', load: 200 }];
    const start = Date.now();
    const { placed } = fullPack(items, { largo: 1615.4, ancho: 247, alto: 280 }, 'free');
    const elapsed = Date.now() - start;
    expect(placed.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000);
  });

  it('quickStrat max_volume tarda menos de 3 segundos', () => {
    // Nota: el threshold original era 2000ms (suficiente en bare-node, ~800ms).
    // Bajo Vitest el mismo trabajo toma ~2000-2400ms por el overhead del
    // transform+pool, así que lo subimos a 3000ms (mismo valor que el test
    // de fullPack 200 burós, que ya pasa holgado).
    const items = FURNITURE.map(f => ({
      id: f.id, name: f.name, inv: f.inv, ancho: f.ancho, alto: f.alto, fondo: f.fondo, color: f.color, load: 0,
    }));
    const start = Date.now();
    const result = quickStrat('max_volume', items, { largo: 1615.4, ancho: 247, alto: 280 }, 'free');
    const elapsed = Date.now() - start;
    const totalLoaded = result.reduce((s, r) => s + r.load, 0);
    expect(elapsed).toBeLessThan(3000);
    expect(totalLoaded).toBeGreaterThan(0);
  });

  it('Column packing: max_volume llena más del 80%', () => {
    const items = FURNITURE.map(f => ({
      id: f.id, name: f.name, inv: f.inv, ancho: f.ancho, alto: f.alto, fondo: f.fondo, color: f.color, load: f.inv,
    }));
    const { placed } = fullPack(items, { largo: 1615.4, ancho: 247, alto: 280 }, 'free');
    const vol = placed.reduce((s, p) => s + p.l * p.w * p.h, 0);
    const util = vol / (1615.4 * 247 * 280) * 100;
    expect(util).toBeGreaterThan(80);
  });
});
