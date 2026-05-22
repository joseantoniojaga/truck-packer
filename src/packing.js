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
    if (Math.min(x+l, p.x+p.l) - Math.max(x, p.x) > 0.1 &&
        Math.min(y+w, p.y+p.w) - Math.max(y, p.y) > 0.1) {
      if (p.z + p.h > maxZ) maxZ = p.z + p.h;
    }
  }
  return maxZ;
}

// ─── Height map incremental (grid de alturas) ────────────────────────────────
// fullPack mantiene un grid de alturas que se actualiza al colocar cada item,
// evitando recorrer todos los items colocados en cada consulta.
export const HR = 5; // resolución del grid en cm

export function hmapUpdate(hmap, item, cols, rows, HR) {
  const x0 = Math.floor(item.x / HR);
  const x1 = Math.min(Math.ceil((item.x + item.l) / HR), cols);
  const y0 = Math.floor(item.y / HR);
  const y1 = Math.min(Math.ceil((item.y + item.w) / HR), rows);
  const top = item.z + item.h;
  for (let xi = x0; xi < x1; xi++)
    for (let yi = y0; yi < y1; yi++)
      if (top > hmap[xi * rows + yi]) hmap[xi * rows + yi] = top;
}

export function hmapQueryMax(hmap, x, y, l, w, cols, rows, HR) {
  const x0 = Math.floor(x / HR);
  const x1 = Math.min(Math.ceil((x + l) / HR), cols);
  const y0 = Math.floor(y / HR);
  const y1 = Math.min(Math.ceil((y + w) / HR), rows);
  let maxZ = 0;
  for (let xi = x0; xi < x1; xi++)
    for (let yi = y0; yi < y1; yi++)
      if (hmap[xi * rows + yi] > maxZ) maxZ = hmap[xi * rows + yi];
  return maxZ;
}

export function supportRatio(x, y, l, w, z, placed) {
  if (z < 1) return 1;
  let supported = 0;
  const area = l * w;
  for (const p of placed) {
    if (Math.abs(p.z + p.h - z) > 2) continue;
    const ox = Math.max(0, Math.min(x+l, p.x+p.l) - Math.max(x, p.x));
    const oy = Math.max(0, Math.min(y+w, p.y+p.w) - Math.max(y, p.y));
    supported += ox * oy;
  }
  return area > 0 ? supported / area : 0;
}

// itemId: when set, items of the same type at the same (x,y) get a -5e7 stacking bonus
// hctx: cuando se pasa {hmap, cols, rows, HR}, usa el grid de alturas precalculado
//       y limita el número de posiciones candidatas (usado por fullPack).
export function findBestPos(dims, placed, trailer, mode = "backToFront", itemId = null, hctx = null) {
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
  let xArr = [...xs].filter(x => x >= -0.1 && x <= trailer.largo + 0.1);
  let yArr = [...ys].filter(y => y >= -0.1 && y <= trailer.ancho + 0.1);
  // Con grid: limitar candidatos para evitar explosión cuadrática
  if (hctx) {
    xArr = [...xs].filter(x => x >= 0 && x <= trailer.largo).sort((a,b) => a-b).slice(0, 50);
    yArr = [...ys].filter(y => y >= 0 && y <= trailer.ancho).sort((a,b) => a-b).slice(0, 20);
  }
  let best = null;
  for (const rot of rs) {
    for (const x of xArr) {
      if (x + rot.l > trailer.largo + 0.1) continue;
      for (const y of yArr) {
        if (y + rot.w > trailer.ancho + 0.1) continue;
        const z = hctx
          ? hmapQueryMax(hctx.hmap, x, y, rot.l, rot.w, hctx.cols, hctx.rows, hctx.HR)
          : hmapGetZ(x, y, rot.l, rot.w, placed);
        if (z + rot.h > trailer.alto + 0.1) continue;
        if (z > 1 && supportRatio(x, y, rot.l, rot.w, z, placed) < 0.8) continue;
        const sameTypeAtXY = itemId !== null &&
          placed.some(p => p.id === itemId && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5);
        const sameRotation = sameType.some(p =>
          Math.abs(p.l - rot.l) < 0.5 && Math.abs(p.w - rot.w) < 0.5 && Math.abs(p.h - rot.h) < 0.5
        );
        let score = mode === "backToFront"
          ? x * 1e8 + z * 1e4 + y
          : z * 1e6 + x * 1e3 + y;
        if (sameTypeAtXY) score -= 5e7;
        if (sameRotation) score -= 3e7;
        if (!best || score < best.score) {
          best = { x, y, z, l: rot.l, w: rot.w, h: rot.h, score };
        }
      }
    }
  }
  return best;
}

export function fullPack(items, trailer, mode = "backToFront") {
  const placed = [];
  const cols = Math.ceil(trailer.largo / HR);
  const rows = Math.ceil(trailer.ancho / HR);
  const hmap = new Float32Array(cols * rows);
  const hctx = { hmap, cols, rows, HR };
  const types = [...items].filter(it => it.load > 0)
    .map(it => ({ ...it, vol: it.ancho * it.alto * it.fondo }))
    .sort((a, b) => b.vol - a.vol || a.id - b.id);
  for (const type of types) {
    let rem = type.load;
    while (rem > 0) {
      const pos = findBestPos([type.ancho, type.alto, type.fondo], placed, trailer, mode, type.id, hctx);
      if (!pos) break;
      const item = { id: type.id, name: type.name, color: type.color,
        x: pos.x, y: pos.y, z: pos.z, l: pos.l, w: pos.w, h: pos.h };
      placed.push(item);
      hmapUpdate(hmap, item, cols, rows, HR);
      rem--;
    }
  }
  return { placed };
}
