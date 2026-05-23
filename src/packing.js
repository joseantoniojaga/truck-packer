import { SUPPORT_RATIO_THRESHOLD, GEOMETRIC_TOLERANCE, HEIGHT_TOLERANCE, SCORE_WEIGHTS } from './constants.js';
import { getStrategy } from './packingStrategies.js';

export function fmtV(c) {
  return c >= 1e6 ? (c/1e6).toFixed(2) + " m³" : Math.round(c).toLocaleString("es-MX") + " cm³";
}

export function getCounts(p) {
  const m = {};
  for (const x of p) m[x.id] = (m[x.id] || 0) + 1;
  return m;
}

export function getRots(a, b, c) {
  const s = new Set(), r = [];
  const d = [a, b, c];
  for (const p of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
    const k = `${d[p[0]]}-${d[p[1]]}-${d[p[2]]}`;
    if (!s.has(k)) { s.add(k); r.push({ l: d[p[0]], w: d[p[1]], h: d[p[2]] }); }
  }
  return r;
}

// Recorre todos los items colocados. Se usa para addOne (colocación incremental)
// donde no existe un grid de alturas precalculado.
export function hmapGetZ(x, y, l, w, placed) {
  let maxZ = 0;
  for (const p of placed) {
    if (Math.min(x+l, p.x+p.l) - Math.max(x, p.x) > GEOMETRIC_TOLERANCE &&
        Math.min(y+w, p.y+p.w) - Math.max(y, p.y) > GEOMETRIC_TOLERANCE) {
      if (p.z + p.h > maxZ) maxZ = p.z + p.h;
    }
  }
  return maxZ;
}

export function supportRatio(x, y, l, w, z, placed) {
  if (z < 1) return 1;
  let supported = 0;
  const area = l * w;
  for (const p of placed) {
    if (Math.abs(p.z + p.h - z) > HEIGHT_TOLERANCE) continue;
    const ox = Math.max(0, Math.min(x+l, p.x+p.l) - Math.max(x, p.x));
    const oy = Math.max(0, Math.min(y+w, p.y+p.w) - Math.max(y, p.y));
    supported += ox * oy;
  }
  return area > 0 ? supported / area : 0;
}

// itemId: when set, items of the same type at the same (x,y) get a stacking bonus
//         (SCORE_WEIGHTS.SAME_TYPE_BONUS).
export function findBestPos(dims, placed, trailer, mode = "backToFront", itemId = null) {
  const rs = getRots(...dims);

  // Priorizar la rotación que ya usan items del mismo tipo
  const sameType = placed.filter(p => p.id === itemId);
  if (sameType.length > 0) {
    const rotCounts = {};
    for (const p of sameType) {
      const key = [p.l, p.w, p.h].sort((a, b) => b - a).join('-');
      rotCounts[key] = (rotCounts[key] || 0) + 1;
    }
    const mostCommonKey = Object.entries(rotCounts).sort((a, b) => b[1] - a[1])[0][0];
    const matchIdx = rs.findIndex(r => [r.l, r.w, r.h].sort((a, b) => b - a).join('-') === mostCommonKey);
    if (matchIdx > 0) {
      const [match] = rs.splice(matchIdx, 1);
      rs.unshift(match);
    }
  }

  const xs = new Set([0]);
  const ys = new Set([0]);
  for (const p of placed) {
    xs.add(p.x);
    xs.add(p.x + p.l);
    ys.add(p.y);
    ys.add(p.y + p.w);
  }
  for (const rot of rs) {
    for (const p of placed) {
      xs.add(p.x - rot.l);   // nuevo item justo a la izquierda del existente
      xs.add(p.x + p.l);
      ys.add(p.y - rot.w);   // nuevo item justo antes del existente
      ys.add(p.y + p.w);
    }
    xs.add(trailer.largo - rot.l);
    ys.add(trailer.ancho - rot.w);
  }
  const xArr = [...xs].filter(x => x >= -GEOMETRIC_TOLERANCE && x <= trailer.largo + GEOMETRIC_TOLERANCE);
  const yArr = [...ys].filter(y => y >= -GEOMETRIC_TOLERANCE && y <= trailer.ancho + GEOMETRIC_TOLERANCE);
  let best = null;
  for (const rot of rs) {
    for (const x of xArr) {
      if (x + rot.l > trailer.largo + GEOMETRIC_TOLERANCE) continue;
      for (const y of yArr) {
        if (y + rot.w > trailer.ancho + GEOMETRIC_TOLERANCE) continue;
        const z = hmapGetZ(x, y, rot.l, rot.w, placed);
        if (z + rot.h > trailer.alto + GEOMETRIC_TOLERANCE) continue;
        if (z > 1 && supportRatio(x, y, rot.l, rot.w, z, placed) < SUPPORT_RATIO_THRESHOLD) continue;
        const sameTypeAtXY = itemId !== null &&
          placed.some(p => p.id === itemId && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5);
        const sameRotation = sameType.some(p =>
          Math.abs(p.l - rot.l) < 0.5 && Math.abs(p.w - rot.w) < 0.5 && Math.abs(p.h - rot.h) < 0.5
        );
        let score = mode === "backToFront"
          ? x * SCORE_WEIGHTS.X_BACK_TO_FRONT + z * SCORE_WEIGHTS.Z_BACK_TO_FRONT + y
          : z * SCORE_WEIGHTS.Z_FREE + x * SCORE_WEIGHTS.X_FREE + y;
        if (sameTypeAtXY) score += SCORE_WEIGHTS.SAME_TYPE_BONUS;
        if (sameRotation) score += SCORE_WEIGHTS.SAME_ROTATION_BONUS;
        if (!best || score < best.score) {
          best = { x, y, z, l: rot.l, w: rot.w, h: rot.h, score };
        }
      }
    }
  }
  return best;
}

// Column packing: avanza por el tráiler de fondo a frente, llenando cada
// sección con un bloque uniforme (nW × nH) del tipo cuya rotación maximiza
// la densidad en esa sección transversal. Una segunda pasada con findBestPos
// rellena los huecos con items individuales.
//
// sortFn opcional: orden de prioridad para elegir tipos. Por defecto, mayor
// volumen primero.
export function fullPack(items, trailer, mode = "backToFront", sortFn) {
  const placed = [];
  const types = [...items].filter(it => it.load > 0)
    .map(it => ({ ...it, vol: it.ancho * it.alto * it.fondo, remaining: it.load }));

  if (sortFn) types.sort(sortFn);
  else types.sort((a, b) => b.vol - a.vol || a.id - b.id);

  let curX = 0;

  while (curX < trailer.largo) {
    let bestType = null;
    let bestRot = null;
    let bestScore = 0;
    let bestCount = 0;
    let bestLayout = null;

    // Para cada tipo y rotación, calcular cuántos caben en esta sección
    // transversal (ancho × alto). Gana la combinación que coloca más
    // VOLUMEN por unidad de avance en x = perSection × rot.w × rot.h
    // (equivalente a la utilización de la sección transversal). Usar
    // sólo el count favorece rotaciones planas con muchos items pero
    // mala utilización; ponderar por área cross-section corrige eso.
    for (const type of types) {
      if (type.remaining <= 0) continue;
      const rots = getRots(type.ancho, type.alto, type.fondo);
      for (const rot of rots) {
        if (curX + rot.l > trailer.largo + GEOMETRIC_TOLERANCE) continue;
        if (rot.w > trailer.ancho + GEOMETRIC_TOLERANCE) continue;
        if (rot.h > trailer.alto + GEOMETRIC_TOLERANCE) continue;

        const nW = Math.floor(trailer.ancho / rot.w);
        const nH = Math.floor(trailer.alto / rot.h);
        const perSection = Math.min(nW * nH, type.remaining);
        const score = perSection * rot.w * rot.h;

        if (score > bestScore) {
          bestScore = score;
          bestCount = perSection;
          bestType = type;
          bestRot = rot;
          bestLayout = { nW, nH };
        }
      }
    }

    if (!bestType || bestCount === 0) {
      // Nada forma bloque en esta sección: intentar UN item individual
      // y avanzar si tampoco cabe.
      let filled = false;
      for (const type of types) {
        if (type.remaining <= 0) continue;
        const pos = findBestPos(
          [type.ancho, type.alto, type.fondo],
          placed, trailer, mode, type.id
        );
        if (pos && pos.x >= curX - 1) {
          placed.push({ id: type.id, name: type.name, color: type.color,
            x: pos.x, y: pos.y, z: pos.z, l: pos.l, w: pos.w, h: pos.h });
          type.remaining--;
          filled = true;
          break;
        }
      }
      if (!filled) curX += 10;
      continue;
    }

    // Colocar el bloque (apilamiento por columnas, soporte por construcción)
    let count = 0;
    const { nW, nH } = bestLayout;
    for (let wi = 0; wi < nW && count < bestType.remaining; wi++) {
      for (let hi = 0; hi < nH && count < bestType.remaining; hi++) {
        const y = wi * bestRot.w;
        const z = hi * bestRot.h;
        if (y + bestRot.w > trailer.ancho + GEOMETRIC_TOLERANCE) continue;
        if (z + bestRot.h > trailer.alto + GEOMETRIC_TOLERANCE) continue;
        placed.push({
          id: bestType.id, name: bestType.name, color: bestType.color,
          x: curX, y, z,
          l: bestRot.l, w: bestRot.w, h: bestRot.h
        });
        count++;
      }
    }
    bestType.remaining -= count;
    curX += bestRot.l;
  }

  // Segunda pasada: rellenar huecos con items individuales (findBestPos)
  for (const type of types) {
    while (type.remaining > 0) {
      const pos = findBestPos(
        [type.ancho, type.alto, type.fondo],
        placed, trailer, mode, type.id
      );
      if (!pos) break;
      placed.push({ id: type.id, name: type.name, color: type.color,
        x: pos.x, y: pos.y, z: pos.z, l: pos.l, w: pos.w, h: pos.h });
      type.remaining--;
    }
  }

  return { placed };
}

// Wrapper que delega en el Strategy Pattern (ver src/packingStrategies.js).
// Mantiene la firma histórica `quickStrat(key, items, trailer, mode)` para no
// romper a los importadores (App.jsx y tests). Toda la lógica específica de
// cada estrategia vive en su objeto correspondiente; agregar una nueva no
// requiere modificar este archivo (Open/Closed Principle).
export function quickStrat(key, items, trailer, mode) {
  const strategy = getStrategy(key);
  if (!strategy) throw new Error("Unknown strategy: " + key);
  return strategy.execute(items, trailer, mode);
}
