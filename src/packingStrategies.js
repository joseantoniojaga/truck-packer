// Strategy Pattern para el cálculo de loads por estrategia de empaque.
//
// Cada estrategia es un objeto con la interfaz:
//   { key, label, icon, desc, execute(items, trailer, mode) -> items_with_load }
//
// execute recibe items con shape { id, name, color, ancho, alto, fondo, inv }
// y devuelve el mismo arreglo con el campo `load` asignado.
//
// Agregar una estrategia nueva = exportar un objeto más y meterlo en
// PACKING_STRATEGIES. NO requiere tocar packing.js (Open/Closed).

import { fullPack, getCounts } from './packing.js';

// Helper privado: las cuatro estrategias "simples" comparten esta receta —
// llenar todo al inventario, correr fullPack con el sortFn dado, y devolver
// los loads efectivos según lo que cupó.
function runSortStrategy(items, trailer, mode, sortFn) {
  const result = items.map(it => ({ ...it, load: it.inv }));
  const { placed } = fullPack(result, trailer, mode, sortFn);
  const counts = getCounts(placed);
  return items.map(it => ({ ...it, load: counts[it.id] || 0 }));
}

export const maxPiecesStrategy = {
  key: "max_pieces",
  label: "Máx piezas",
  icon: "🔢",
  desc: "Mayor número de muebles",
  execute(items, trailer, mode) {
    return runSortStrategy(items, trailer, mode, (a, b) => a.vol - b.vol);
  },
};

export const maxVolumeStrategy = {
  key: "max_volume",
  label: "Máx volumen",
  icon: "📦",
  desc: "Llena al máximo",
  execute(items, trailer, mode) {
    return runSortStrategy(items, trailer, mode, (a, b) => b.vol - a.vol);
  },
};

export const bigFirstStrategy = {
  key: "big_first",
  label: "Grandes primero",
  icon: "🛋️",
  desc: "Prioriza grandes",
  execute(items, trailer, mode) {
    return runSortStrategy(items, trailer, mode,
      (a, b) => Math.max(b.ancho, b.alto, b.fondo) - Math.max(a.ancho, a.alto, a.fondo));
  },
};

export const flatFirstStrategy = {
  key: "flat_first",
  label: "Planos primero",
  icon: "📐",
  desc: "Apila lo plano",
  execute(items, trailer, mode) {
    return runSortStrategy(items, trailer, mode,
      (a, b) => Math.min(a.ancho, a.alto, a.fondo) - Math.min(b.ancho, b.alto, b.fondo));
  },
};

export const balancedStrategy = {
  key: "balanced",
  label: "Balanceado",
  icon: "⚖️",
  desc: "Reparte entre todos",
  execute(items, trailer, mode) {
    // Paso 1: cuota equitativa. Búsqueda binaria del k máximo tal que TODOS
    // los tipos quepan simultáneamente con load = min(k, inv). Forzar la
    // misma cuota a todos es lo que da el carácter "balanceado": ningún
    // tipo monopoliza el camión.
    const result = items.map(it => ({ ...it, load: 0 }));
    const maxInv = Math.max(...items.map(it => it.inv));
    let lo = 0, hi = maxInv;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      for (const r of result) r.load = Math.min(mid, r.inv);
      const { placed } = fullPack(result, trailer, mode);
      const c = getCounts(placed);
      const allFit = result.every(r => (c[r.id] || 0) >= r.load);
      if (allFit) lo = mid;
      else hi = mid - 1;
    }
    for (const r of result) r.load = Math.min(lo, r.inv);

    // Paso 2: ajuste fino. Para tipos con holgura (inv > load), búsqueda
    // binaria de cuántos más caben sin sacar a los demás. La cuota
    // equitativa ya dejó al sistema cerca del óptimo.
    for (const r of result) {
      if (r.load >= r.inv) continue;
      let plo = r.load, phi = r.inv;
      while (plo < phi) {
        const mid = Math.ceil((plo + phi) / 2);
        r.load = mid;
        const { placed } = fullPack(result, trailer, mode);
        const c = getCounts(placed);
        const ok = result.every(x => (c[x.id] || 0) >= x.load);
        if (ok) plo = mid;
        else phi = mid - 1;
      }
      r.load = plo;
    }
    return result;
  },
};

// Orden de aparición en la UI (panel de estrategias).
export const PACKING_STRATEGIES = [
  maxPiecesStrategy,
  maxVolumeStrategy,
  bigFirstStrategy,
  flatFirstStrategy,
  balancedStrategy,
];

export function getStrategy(key) {
  return PACKING_STRATEGIES.find(s => s.key === key) || null;
}
