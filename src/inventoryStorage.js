// Persistencia de inventarios en localStorage.
//
// Estructura por inventario: { id: string, name: string, items: Array<Furniture> }
// Cada item: { id, name, color, ancho, alto, fondo, inv } — sin `load` (eso es
// estado de sesión, no de inventario).

const KEY_INVENTORIES = 'truck-packer-inventories';
const KEY_ACTIVE = 'truck-packer-active-inventory-id';

export const DEFAULT_INVENTORY_NAME = 'Inventario base';

function isValidItem(it) {
  return it && typeof it === 'object'
    && (typeof it.id === 'number' || typeof it.id === 'string')
    && typeof it.name === 'string'
    && typeof it.ancho === 'number'
    && typeof it.alto === 'number'
    && typeof it.fondo === 'number';
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

// Devuelve el array de inventarios, descartando entradas o items malformados.
// Si el JSON está corrupto, trata como vacío (no lanza).
export function loadInventories() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY_INVENTORIES);
  if (!raw) return [];
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(inv => inv && typeof inv.id === 'string'
                       && typeof inv.name === 'string'
                       && Array.isArray(inv.items))
    .map(inv => ({ ...inv, items: inv.items.filter(isValidItem) }));
}

export function saveInventories(arr) {
  try { localStorage.setItem(KEY_INVENTORIES, JSON.stringify(arr)); } catch { /* quota / private mode */ }
}

export function getActiveInventoryId() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(KEY_ACTIVE);
}

export function setActiveInventoryId(id) {
  try { localStorage.setItem(KEY_ACTIVE, id); } catch { /* ignore */ }
}

// Crea un inventario nuevo, lo persiste y lo devuelve. NO modifica el activo.
// El id es Date.now().toString() + un sufijo aleatorio corto para evitar
// colisiones si se crean dos inventarios en el mismo milisegundo.
export function createInventory(name, items) {
  const list = loadInventories();
  const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 6);
  const inv = { id, name, items: items.map(it => ({ ...it })) };
  list.push(inv);
  saveInventories(list);
  return inv;
}

// Hace merge de `updates` sobre el inventario con ese id y persiste.
export function updateInventory(id, updates) {
  const list = loadInventories();
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...updates };
  saveInventories(list);
  return list[idx];
}

export function deleteInventory(id) {
  const list = loadInventories().filter(x => x.id !== id);
  saveInventories(list);
}
