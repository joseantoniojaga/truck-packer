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
export function findBestPos(dims, placed, trailer, mode = "backToFront", itemId = null) {
  const rs = getRots(...dims);
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
  const xArr = [...xs].filter(x => x >= -0.1 && x <= trailer.largo + 0.1);
  const yArr = [...ys].filter(y => y >= -0.1 && y <= trailer.ancho + 0.1);
  let best = null;
  for (const rot of rs) {
    for (const x of xArr) {
      if (x + rot.l > trailer.largo + 0.1) continue;
      for (const y of yArr) {
        if (y + rot.w > trailer.ancho + 0.1) continue;
        const z = hmapGetZ(x, y, rot.l, rot.w, placed);
        if (z + rot.h > trailer.alto + 0.1) continue;
        if (z > 1 && supportRatio(x, y, rot.l, rot.w, z, placed) < 0.8) continue;
        const sameTypeAtXY = itemId !== null &&
          placed.some(p => p.id === itemId && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5);
        let score = mode === "backToFront"
          ? x * 1e8 + z * 1e4 + y
          : z * 1e6 + x * 1e3 + y;
        if (sameTypeAtXY) score -= 5e7;
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
  const types = [...items].filter(it => it.load > 0)
    .map(it => ({ ...it, vol: it.ancho * it.alto * it.fondo }))
    .sort((a, b) => b.vol - a.vol || a.id - b.id);
  for (const type of types) {
    let rem = type.load;
    while (rem > 0) {
      const pos = findBestPos([type.ancho, type.alto, type.fondo], placed, trailer, mode, type.id);
      if (!pos) break;
      placed.push({ id: type.id, name: type.name, color: type.color,
        x: pos.x, y: pos.y, z: pos.z, l: pos.l, w: pos.w, h: pos.h });
      rem--;
    }
  }
  return { placed };
}
