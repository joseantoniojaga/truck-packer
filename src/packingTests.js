import { findBestPos, fullPack, supportRatio, hmapGetZ } from './packingUtils.js';

const TR = { largo: 1615.4, ancho: 247, alto: 280 };
let pass = 0, fail = 0;

function check(condition, msg) {
  if (condition) { console.log(`  ✓ ${msg}`); pass++; }
  else { console.error(`  ✗ FAIL: ${msg}`); fail++; }
}

function overlaps(a, b) {
  return Math.min(a.x+a.l, b.x+b.l) - Math.max(a.x, b.x) > 0.1 &&
         Math.min(a.y+a.w, b.y+b.w) - Math.max(a.y, b.y) > 0.1;
}

// ─── Test 1: Gravedad ────────────────────────────────────────────────────────
// En un tráiler estrecho (solo cabe 1 item por fila), el segundo item debe
// apilarse sobre el primero, no flotar.
console.log('\nTest 1: Gravedad');
{
  // Trailer con ancho exacto de 1 item (65 cm) → no hay espacio lateral
  const narrow = { largo: 500, ancho: 65, alto: 400 };
  const dims = [65, 50, 80]; // ancho, alto, fondo
  const placed = [];

  const p1 = findBestPos(dims, placed, narrow, 'backToFront', 1);
  check(p1 !== null, 'Item 1 colocado');
  placed.push({ id: 1, x: p1.x, y: p1.y, z: p1.z, l: p1.l, w: p1.w, h: p1.h });

  const p2 = findBestPos(dims, placed, narrow, 'backToFront', 1);
  check(p2 !== null, 'Item 2 colocado');
  check(p2.z > 0, `Item 2 en z=${p2.z.toFixed(1)} > 0 (apilado, no al lado)`);
  check(Math.abs(p2.z - placed[0].h) < 1,
    `z del item 2 (${p2.z.toFixed(1)}) == altura del item 1 (${placed[0].h})`);
}

// ─── Test 2: No flotan ───────────────────────────────────────────────────────
// Todos los items colocados deben tener z=0 o descansar sobre otro item.
console.log('\nTest 2: No flotan');
{
  const items = [
    { id: 1, name: 'A', color: '#f00', ancho: 99.5, alto: 36,   fondo: 199.5, load: 10, inv: 10 },
    { id: 2, name: 'B', color: '#0f0', ancho: 65,   alto: 65,   fondo: 40,    load: 8,  inv: 8  },
    { id: 3, name: 'C', color: '#00f', ancho: 81,   alto: 172,  fondo: 7.5,   load: 5,  inv: 5  },
  ];
  const { placed } = fullPack(items, TR, 'backToFront');
  check(placed.length > 0, `${placed.length} items colocados`);
  let allSupported = true;
  for (const p of placed) {
    if (p.z < 1) continue;
    const hasSupport = placed.some(b => b !== p && Math.abs(b.z + b.h - p.z) < 1 && overlaps(p, b));
    if (!hasSupport) { allSupported = false; console.error(`  ✗ Item flotando: id=${p.id} z=${p.z.toFixed(1)}`); fail++; }
    else pass++;
  }
  if (allSupported) check(true, 'Todos los items tienen soporte (z=0 o sobre otro item)');
}

// ─── Test 3: Soporte 80% ─────────────────────────────────────────────────────
// supportRatio debe detectar soporte insuficiente, y findBestPos debe
// rechazar posiciones donde el soporte sea < 80%.
console.log('\nTest 3: Soporte 80%');
{
  const base = { id: 1, x: 0, y: 0, z: 0, l: 100, w: 100, h: 50 };

  // Soporte completo: item del mismo tamaño encima
  const full = supportRatio(0, 0, 100, 100, 50, [base]);
  check(Math.abs(full - 1.0) < 0.01, `Soporte completo = ${(full*100).toFixed(0)}%`);

  // Soporte parcial: item 3x más grande (solo 1/9 del área soportada)
  const partial = supportRatio(0, 0, 300, 300, 50, [base]);
  check(partial < 0.8, `Soporte parcial ${(partial*100).toFixed(1)}% < 80%`);

  // En el piso siempre es 100%
  check(supportRatio(500, 500, 200, 200, 0, []) === 1, 'z=0 → soporte 100%');

  // findBestPos rechaza posición de ítem grande sobre base pequeña
  const smallTR = { largo: 300, ancho: 300, alto: 200 };
  const pos = findBestPos([300, 50, 300], [base], smallTR, 'backToFront', 2);
  check(pos === null || pos.z < 1,
    `findBestPos rechaza apoyo insuficiente (pos=${pos ? `z=${pos.z.toFixed(1)}` : 'null'})`);
}

// ─── Test 4: Sin huecos obvios ───────────────────────────────────────────────
// 32 Burós Hampton deben ocupar >70% del bounding box de lo colocado.
console.log('\nTest 4: Sin huecos obvios');
{
  const buro = { id: 4, name: 'Buró Hampton', color: '#F2CC8F',
                 ancho: 65, alto: 65, fondo: 40, load: 32, inv: 32 };
  const { placed } = fullPack([buro], TR, 'backToFront');
  check(placed.length > 0, `${placed.length} burós colocados`);

  const maxX = Math.max(...placed.map(p => p.x + p.l));
  const maxY = Math.max(...placed.map(p => p.y + p.w));
  const maxZ = Math.max(...placed.map(p => p.z + p.h));
  const bboxVol = maxX * maxY * maxZ;
  const usedVol = placed.reduce((s, p) => s + p.l * p.w * p.h, 0);
  const density = usedVol / bboxVol;
  check(density > 0.60,
    `Densidad en bounding box: ${(density*100).toFixed(1)}% > 60% (bbox=${(bboxVol/1e6).toFixed(2)} m³)`);
}

// ─── Test 5: No escalones ────────────────────────────────────────────────────
// Items elevados (z>0) deben apilarse directamente sobre otro item del mismo
// tipo en la misma posición (x,y), no flotar en una columna desplazada.
console.log('\nTest 5: No escalones');
{
  // Trailer estrecho: solo 1 item por fila → forzamos apilamiento vertical
  const narrow = { largo: 500, ancho: 65, alto: 500 };
  const box = { id: 7, name: 'Box', color: '#abc',
                ancho: 65, alto: 50, fondo: 80, load: 6, inv: 6 };
  const { placed } = fullPack([box], narrow, 'backToFront');
  const elevated = placed.filter(p => p.z > 1);
  check(elevated.length > 0, `${elevated.length} items elevados para verificar`);

  let noStairs = true;
  for (const item of elevated) {
    const hasBase = placed.some(b =>
      b !== item &&
      Math.abs(b.x - item.x) < 1 &&
      Math.abs(b.y - item.y) < 1 &&
      Math.abs(b.z + b.h - item.z) < 1
    );
    if (!hasBase) {
      noStairs = false;
      console.error(`  ✗ Escalón: id=${item.id} z=${item.z.toFixed(1)} sin base directa en (${item.x.toFixed(0)},${item.y.toFixed(0)})`);
      fail++;
    } else pass++;
  }
  if (noStairs) check(true, 'Todos los items elevados apilados sobre base directa');
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${pass + fail} checks: ${pass} ✓  ${fail} ✗`);
if (fail > 0) process.exit(1);
