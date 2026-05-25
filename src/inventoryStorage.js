// Persistencia de inventarios en localStorage.
//
// Estructura por inventario: { id, name, items, customColors, trailer }
//   items:        Array<Furniture> con shape { id, name, color, ancho, alto, fondo, inv }
//                 — sin `load` (eso es estado de sesión, no de inventario).
//   customColors: string[] de hex `#RRGGBB` que el usuario eligió via el color
//                 picker nativo. Vive por inventario (cada uno tiene su paleta
//                 ampliada propia). Migración: si un inventario viejo no tiene
//                 este campo, `loadInventories` lo normaliza a `[]`.
//   trailer:      { largo, ancho, alto, placas } — dimensiones del tráiler en
//                 cm (placas es string opcional). Cada inventario tiene su
//                 propio tráiler. Migración: si no existe, se asigna el default.
//                 Compat legacy: si hay un `placas` en la raíz del inventario,
//                 se mueve a `trailer.placas` y se elimina del root.

export const DEFAULT_TRAILER = { largo: 1615.4, ancho: 247, alto: 280, placas: "49-UT-7V" };

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
    .map(inv => {
      // Migración trailer: si no existe, asignar default. Si hay un
      // campo `placas` legacy en la raíz, moverlo a trailer.placas y
      // eliminarlo. Validamos shape mínima de un trailer válido.
      let trailer;
      if (inv.trailer && typeof inv.trailer === 'object'
          && typeof inv.trailer.largo === 'number'
          && typeof inv.trailer.ancho === 'number'
          && typeof inv.trailer.alto === 'number') {
        trailer = {
          largo: inv.trailer.largo,
          ancho: inv.trailer.ancho,
          alto: inv.trailer.alto,
          placas: typeof inv.trailer.placas === 'string' ? inv.trailer.placas : '',
        };
      } else {
        trailer = { ...DEFAULT_TRAILER };
        if (typeof inv.placas === 'string') trailer.placas = inv.placas;
      }
      const { placas: _legacyPlacas, ...rest } = inv;
      return {
        ...rest,
        items: inv.items.filter(isValidItem),
        // Migración: inventarios viejos sin customColors → array vacío.
        // Filtrado defensivo: si está pero no es array de strings, ignorar.
        customColors: Array.isArray(inv.customColors)
          ? inv.customColors.filter(c => typeof c === 'string')
          : [],
        trailer,
      };
    });
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
  const inv = {
    id, name,
    items: items.map(it => ({ ...it })),
    customColors: [],
    trailer: { ...DEFAULT_TRAILER },
  };
  list.push(inv);
  saveInventories(list);
  return inv;
}

// Actualiza solo el campo `trailer` del inventario con ese id en localStorage,
// sin tocar items / customColors / name. Devuelve el inventario actualizado o
// null si no existe.
export function updateInventoryTrailer(id, trailer) {
  return updateInventory(id, { trailer: { ...trailer } });
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
