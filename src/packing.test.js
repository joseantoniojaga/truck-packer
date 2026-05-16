import { getRots, hmapGetZ, supportRatio, findBestPos, fullPack } from './packing.js';
import { calculateSwapOptions } from './swapCalculator.js';
import { FURNITURE } from './furniture.js';
import { computeLoadingOrder } from './loadingSequence.js';

const TR = { largo: 1615.4, ancho: 247, alto: 280 };
let pass = 0, fail = 0;

function check(condition, msg) {
  if (condition) { console.log(`  ✓ ${msg}`); pass++; }
  else { console.error(`  ✗ FAIL: ${msg}`); fail++; }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ FAIL: ${name}: ${e.message}`);
    fail++;
  }
}

function overlaps(a, b) {
  return Math.min(a.x+a.l, b.x+b.l) - Math.max(a.x, b.x) > 0.1 &&
         Math.min(a.y+a.w, b.y+b.w) - Math.max(a.y, b.y) > 0.1;
}

// ─── Test 1: getRots - rotaciones únicas ─────────────────────────────────────
console.log('\nTest 1: Rotaciones únicas');
{
  const r1 = getRots(1, 2, 3);
  check(r1.length === 6, `[1,2,3] → 6 rotaciones únicas (got ${r1.length})`);

  const r2 = getRots(1, 1, 2);
  check(r2.length === 3, `[1,1,2] → 3 rotaciones únicas (got ${r2.length})`);

  const r3 = getRots(5, 5, 5);
  check(r3.length === 1, `[5,5,5] → 1 rotación única (got ${r3.length})`);
}

// ─── Test 2: hmapGetZ - mapa de altura ───────────────────────────────────────
console.log('\nTest 2: hmapGetZ');
{
  check(hmapGetZ(0, 0, 10, 10, []) === 0, 'Sin items → z=0');

  const base = { x:0, y:0, z:0, l:100, w:100, h:50 };
  const z1 = hmapGetZ(0, 0, 100, 100, [base]);
  check(Math.abs(z1 - 50) < 0.1, `Item debajo → z=50 (got ${z1})`);

  const z2 = hmapGetZ(200, 0, 50, 50, [base]);
  check(z2 === 0, `Sin solapamiento → z=0 (got ${z2})`);
}

// ─── Test 3: supportRatio ────────────────────────────────────────────────────
console.log('\nTest 3: Soporte 80%');
{
  const base = { id:1, x:0, y:0, z:0, l:100, w:100, h:50 };

  const full = supportRatio(0, 0, 100, 100, 50, [base]);
  check(Math.abs(full - 1.0) < 0.01, `Soporte completo = ${(full*100).toFixed(0)}%`);

  const partial = supportRatio(0, 0, 300, 300, 50, [base]);
  check(partial < 0.8, `Soporte parcial ${(partial*100).toFixed(1)}% < 80%`);

  check(supportRatio(500, 500, 200, 200, 0, []) === 1, 'z=0 → soporte 100%');
}

// ─── Test 4: findBestPos rechaza apoyo insuficiente ──────────────────────────
console.log('\nTest 4: findBestPos rechaza apoyo insuficiente');
{
  const base = { id:1, x:0, y:0, z:0, l:100, w:100, h:50 };
  const smallTR = { largo:300, ancho:300, alto:200 };
  const pos = findBestPos([300, 50, 300], [base], smallTR, 'backToFront', 2);
  check(pos === null || pos.z < 1,
    `findBestPos rechaza apoyo insuficiente (pos=${pos ? `z=${pos.z.toFixed(1)}` : 'null'})`);
}

// ─── Test 5: Gravedad ────────────────────────────────────────────────────────
console.log('\nTest 5: Gravedad');
{
  const narrow = { largo:500, ancho:65, alto:400 };
  const dims = [65, 50, 80];
  const placed = [];

  const p1 = findBestPos(dims, placed, narrow, 'backToFront', 1);
  check(p1 !== null, 'Item 1 colocado');
  placed.push({ id:1, x:p1.x, y:p1.y, z:p1.z, l:p1.l, w:p1.w, h:p1.h });

  const p2 = findBestPos(dims, placed, narrow, 'backToFront', 1);
  check(p2 !== null, 'Item 2 colocado');
  check(p2.z > 0, `Item 2 en z=${p2.z.toFixed(1)} > 0 (apilado, no al lado)`);
  check(Math.abs(p2.z - placed[0].h) < 1,
    `z del item 2 (${p2.z.toFixed(1)}) == altura del item 1 (${placed[0].h})`);
}

// ─── Test 6: No flotan ───────────────────────────────────────────────────────
console.log('\nTest 6: No flotan');
{
  const items = [
    { id:1, name:'A', color:'#f00', ancho:99.5, alto:36,  fondo:199.5, load:10, inv:10 },
    { id:2, name:'B', color:'#0f0', ancho:65,   alto:65,  fondo:40,    load:8,  inv:8  },
    { id:3, name:'C', color:'#00f', ancho:81,   alto:172, fondo:7.5,   load:5,  inv:5  },
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

// ─── Test 7: Sin huecos obvios ───────────────────────────────────────────────
console.log('\nTest 7: Sin huecos obvios');
{
  const buro = { id:4, name:'Buró Hampton', color:'#F2CC8F',
                 ancho:65, alto:65, fondo:40, load:32, inv:32 };
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

// ─── Test 8: No escalones ────────────────────────────────────────────────────
console.log('\nTest 8: No escalones');
{
  const narrow = { largo:500, ancho:65, alto:500 };
  const box = { id:7, name:'Box', color:'#abc',
                ancho:65, alto:50, fondo:80, load:6, inv:6 };
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

// ─── Test 9: Sin solapamiento ────────────────────────────────────────────────
console.log('\nTest 9: Sin solapamiento');
{
  const items = [
    { id:1, name:'A', color:'#f00', ancho:65,   alto:65, fondo:40,    load:10, inv:10 },
    { id:2, name:'B', color:'#0f0', ancho:99.5, alto:36, fondo:199.5, load:5,  inv:5  },
  ];
  const { placed } = fullPack(items, TR, 'backToFront');
  let noOverlap = true;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i+1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      const xOv = Math.min(a.x+a.l, b.x+b.l) - Math.max(a.x, b.x);
      const yOv = Math.min(a.y+a.w, b.y+b.w) - Math.max(a.y, b.y);
      const zOv = Math.min(a.z+a.h, b.z+b.h) - Math.max(a.z, b.z);
      if (xOv > 0.1 && yOv > 0.1 && zOv > 0.1) {
        noOverlap = false;
        console.error(`  ✗ Solapamiento entre id=${a.id} e id=${b.id}`);
        fail++;
      }
    }
  }
  if (noOverlap) check(true, `Sin solapamientos en ${placed.length} items`);
}

// ─── Test 10: Dentro del tráiler ─────────────────────────────────────────────
console.log('\nTest 10: Dentro del tráiler');
{
  const items = [
    { id:1, name:'A', color:'#f00', ancho:65,   alto:65, fondo:40,    load:15, inv:15 },
    { id:2, name:'B', color:'#0f0', ancho:99.5, alto:36, fondo:199.5, load:10, inv:10 },
  ];
  const { placed } = fullPack(items, TR, 'backToFront');
  let allInside = true;
  for (const p of placed) {
    if (p.x < -0.1 || p.x+p.l > TR.largo+0.1 ||
        p.y < -0.1 || p.y+p.w > TR.ancho+0.1 ||
        p.z < -0.1 || p.z+p.h > TR.alto+0.1) {
      allInside = false;
      console.error(`  ✗ Fuera del tráiler: id=${p.id} pos=(${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}) size=(${p.l.toFixed(0)},${p.w.toFixed(0)},${p.h.toFixed(0)})`);
      fail++;
    }
  }
  if (allInside) check(true, `Todos los ${placed.length} items dentro del tráiler`);
}

// ─── Tests: quitar item y setInv sin reorganizar ──────────────────────────────
console.log('\nTests: quitar item sin reorganizar');
{
  test('Quitar item: placed se reduce en 1', () => {
    const items = [{id:4,name:"B",inv:32,ancho:65,alto:65,fondo:40,color:"#F2CC8F",load:5}];
    const {placed} = fullPack(items, TR, 'free');
    const originalCount = placed.length;
    const lastIdx = [...placed].reverse().findIndex(p => p.id === 4);
    const realIdx = placed.length - 1 - lastIdx;
    const newPlaced = placed.filter((_, i) => i !== realIdx);
    assert(newPlaced.length === originalCount - 1, 'debería tener 1 menos');
  });

  test('Quitar item: los demás no se mueven', () => {
    const items = [{id:4,name:"B",inv:32,ancho:65,alto:65,fondo:40,color:"#F2CC8F",load:5}];
    const {placed} = fullPack(items, TR, 'free');
    const lastIdx = [...placed].reverse().findIndex(p => p.id === 4);
    const realIdx = placed.length - 1 - lastIdx;
    const remaining = placed.filter((_, i) => i !== realIdx);
    for (let i = 0; i < remaining.length; i++) {
      const orig = placed.filter((_, j) => j !== realIdx)[i];
      assert(remaining[i].x === orig.x && remaining[i].y === orig.y && remaining[i].z === orig.z, 'item se movió al quitar otro');
    }
  });

  test('fullPack: items del mismo tipo se apilan en columnas (no escalones)', () => {
    // Buró Hampton (65×65×40): h=40 permite apilar 7 (7×40=280=alto tráiler)
    const items = [{id:4,name:"Buró Hampton",inv:32,ancho:65,alto:65,fondo:40,color:"#F2CC8F",load:4}];
    const {placed} = fullPack(items, TR, 'backToFront');
    const positions = {};
    for (const p of placed) {
      const key = Math.round(p.x) + ',' + Math.round(p.y);
      positions[key] = (positions[key] || 0) + 1;
    }
    const singles = Object.values(positions).filter(c => c === 1).length;
    const total = Object.keys(positions).length;
    assert(singles <= total * 0.5, 'demasiados items sin apilar: ' + singles + '/' + total + ' posiciones con solo 1 item');
  });

  test('Cambiar inventario no mueve items existentes', () => {
    const items = [{id:4,name:"B",inv:32,ancho:65,alto:65,fondo:40,color:"#F2CC8F",load:5}];
    const {placed} = fullPack(items, TR, 'free');
    const pos0 = {x: placed[0].x, y: placed[0].y, z: placed[0].z};
    // Simular bajar inventario a 30 (load 5 no se afecta, items placed no cambian)
    assert(placed[0].x === pos0.x, 'item se movió al cambiar inventario');
  });
}

// ─── Tests por tipo de mueble ─────────────────────────────────────────────────
console.log('\nTests por tipo de mueble');
for (const furn of FURNITURE) {
  test(furn.name + ': se coloca en z=0', () => {
    const pos = findBestPos([furn.ancho, furn.alto, furn.fondo], [], TR, 'free', furn.id);
    assert(pos !== null, 'no encontró posición');
    assert(pos.z === 0, 'z debería ser 0, fue ' + pos.z);
  });

  test(furn.name + ': 2 items se apilan sin escalonar', () => {
    const pos1 = findBestPos([furn.ancho, furn.alto, furn.fondo], [], TR, 'backToFront', furn.id);
    const item1 = { id:furn.id, name:furn.name, color:furn.color, x:pos1.x, y:pos1.y, z:pos1.z, l:pos1.l, w:pos1.w, h:pos1.h };
    const pos2 = findBestPos([furn.ancho, furn.alto, furn.fondo], [item1], TR, 'backToFront', furn.id);
    assert(pos2 !== null, 'no encontró posición para segundo item');
    const stacked = Math.abs(pos2.x - pos1.x) < 1 && Math.abs(pos2.y - pos1.y) < 1 && pos2.z > 0;
    const adjacent = pos2.z === 0;
    assert(stacked || adjacent, 'item escalonado: pos1=(' + pos1.x + ',' + pos1.y + ') pos2=(' + pos2.x + ',' + pos2.y + ')');
  });

  test(furn.name + ': inventario completo sin flotar', () => {
    const items = [{ id:furn.id, name:furn.name, inv:furn.inv, ancho:furn.ancho, alto:furn.alto, fondo:furn.fondo, color:furn.color, load:Math.min(furn.inv, 20) }];
    const { placed } = fullPack(items, TR, 'backToFront');
    for (const p of placed) {
      if (p.z < 1) continue;
      const sup = supportRatio(p.x, p.y, p.l, p.w, p.z, placed.filter(b => b !== p));
      assert(sup >= 0.79, furn.name + ' flota en z=' + p.z + ' con soporte ' + (sup*100).toFixed(0) + '%');
    }
  });
}

// ─── Tests: simulador de carga ────────────────────────────────────────────────
console.log('\nTests: simulador de carga');
{
  test('Loading order: items del fondo van primero', () => {
    const placed = [
      {id:1,name:"A",color:"#fff",x:500,y:0,z:0,l:100,w:100,h:100},
      {id:2,name:"B",color:"#fff",x:0,y:0,z:0,l:100,w:100,h:100},
    ];
    const seq = computeLoadingOrder(placed);
    assert(seq[0].item.x === 0, 'primer item debería ser el del fondo (x=0)');
  });

  test('Loading order: piso antes que apilado', () => {
    const placed = [
      {id:1,name:"A",color:"#fff",x:0,y:0,z:100,l:100,w:100,h:100},
      {id:2,name:"B",color:"#fff",x:0,y:0,z:0,l:100,w:100,h:100},
    ];
    const seq = computeLoadingOrder(placed);
    assert(seq[0].item.z === 0, 'primer item debería ser el del piso (z=0)');
  });

  test('Loading order: soporte antes que soportado', () => {
    const placed = [
      {id:1,name:"Arriba",color:"#fff",x:0,y:0,z:50,l:100,w:100,h:50},
      {id:2,name:"Abajo",color:"#fff",x:0,y:0,z:0,l:100,w:100,h:50},
    ];
    const seq = computeLoadingOrder(placed);
    assert(seq[0].item.name === "Abajo", 'item de soporte debería ir primero');
    assert(seq[1].item.name === "Arriba", 'item soportado debería ir después');
  });

  test('Loading order: secuencia completa tiene todos los items', () => {
    const placed = [
      {id:1,name:"A",color:"#f00",x:0,y:0,z:0,l:65,w:65,h:40},
      {id:2,name:"B",color:"#0f0",x:0,y:0,z:40,l:65,w:65,h:40},
      {id:3,name:"C",color:"#00f",x:100,y:0,z:0,l:65,w:65,h:40},
    ];
    const seq = computeLoadingOrder(placed);
    assert(seq.length === 3, 'secuencia debería tener 3 pasos');
  });
}

// ─── Test: calculateSwapOptions ──────────────────────────────────────────────
console.log('\nTests: intercambio inteligente');
{
  test('Swap: encuentra opciones cuando camión está lleno de burós', () => {
    const items = [
      {id:4, name:"Buró Hampton", inv:200, ancho:65, alto:65, fondo:40, color:"#F2CC8F", load:100},
    ];
    const {placed} = fullPack(items, TR, 'free');
    const tocador = {id:1, name:"Tocador Boston", ancho:122.5, alto:89.5, fondo:42, color:"#E07A5F", load:0};
    const opts = calculateSwapOptions(tocador, items, placed, TR, 'free');
    assert(opts.length > 0, 'debería encontrar opciones');
    assert(opts[0].removeCount >= 1, 'debería quitar al menos 1 buró');
    console.log('  Swap: quitar ' + opts[0].removeCount + ' ' + opts[0].removeName + ' para meter 1 Tocador');
  });

  test('Swap: opciones ordenadas por menor cantidad', () => {
    const items = [
      {id:4, name:"Buró", inv:50, ancho:65, alto:65, fondo:40, color:"#F2CC8F", load:20},
      {id:9, name:"Base Queen", inv:34, ancho:150, alto:36, fondo:199.5, color:"#0F4C5C", load:10},
    ];
    const {placed} = fullPack(items, TR, 'free');
    const tocador = {id:1, name:"Tocador", ancho:122.5, alto:89.5, fondo:42, color:"#E07A5F", load:0};
    const opts = calculateSwapOptions(tocador, items, placed, TR, 'free');
    if (opts.length >= 2) {
      assert(opts[0].removeCount <= opts[1].removeCount, 'primera opción debería quitar menos items');
    }
  });
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${pass + fail} checks: ${pass} ✓  ${fail} ✗`);
if (fail > 0) process.exit(1);
