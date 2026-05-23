// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadInventories,
  saveInventories,
  getActiveInventoryId,
  setActiveInventoryId,
  createInventory,
  updateInventory,
  deleteInventory,
  DEFAULT_INVENTORY_NAME,
} from '../inventoryStorage.js';

// El setup global ya hace localStorage.clear() en beforeEach, pero lo
// repetimos aquí para claridad cuando se lea el archivo aislado.
beforeEach(() => {
  globalThis.localStorage.clear();
});

const sampleItem = (overrides = {}) => ({
  id: 1, name: 'X', color: '#fff', ancho: 10, alto: 10, fondo: 10, inv: 1,
  ...overrides,
});

describe('inventoryStorage', () => {
  it('loadInventories devuelve [] cuando localStorage está vacío', () => {
    expect(loadInventories()).toEqual([]);
  });

  it('saveInventories + loadInventories: round-trip preserva los datos', () => {
    const arr = [{ id: 'a1', name: 'Uno', items: [sampleItem()] }];
    saveInventories(arr);
    const loaded = loadInventories();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('a1');
    expect(loaded[0].name).toBe('Uno');
    expect(loaded[0].items).toHaveLength(1);
    expect(loaded[0].items[0].name).toBe('X');
  });

  it('JSON corrupto en localStorage → loadInventories devuelve [] sin lanzar', () => {
    globalThis.localStorage.setItem('truck-packer-inventories', '{not json');
    expect(() => loadInventories()).not.toThrow();
    expect(loadInventories()).toEqual([]);
  });

  it('createInventory: agrega y devuelve el nuevo con id único string', () => {
    const inv = createInventory(DEFAULT_INVENTORY_NAME, [sampleItem()]);
    expect(typeof inv.id).toBe('string');
    expect(inv.id.length).toBeGreaterThan(0);
    expect(inv.name).toBe(DEFAULT_INVENTORY_NAME);
    expect(inv.items).toHaveLength(1);
    expect(loadInventories()).toHaveLength(1);
  });

  it('createInventory dos veces seguidas: ids diferentes (sin colisión Date.now)', () => {
    const a = createInventory('A', []);
    const b = createInventory('B', []);
    expect(a.id).not.toBe(b.id);
    expect(loadInventories()).toHaveLength(2);
  });

  it('updateInventory: hace merge correcto, no afecta otros inventarios', () => {
    const a = createInventory('A', [sampleItem({ id: 1, name: 'A1' })]);
    const b = createInventory('B', [sampleItem({ id: 2, name: 'B1' })]);
    updateInventory(a.id, { name: 'A renombrado' });
    const list = loadInventories();
    const updatedA = list.find(x => x.id === a.id);
    const untouchedB = list.find(x => x.id === b.id);
    expect(updatedA.name).toBe('A renombrado');
    expect(updatedA.items).toHaveLength(1); // items preservados via merge
    expect(untouchedB.name).toBe('B');
  });

  it('updateInventory con id inexistente: no rompe, no agrega', () => {
    createInventory('A', []);
    const result = updateInventory('no-existe', { name: 'X' });
    expect(result).toBeNull();
    expect(loadInventories()).toHaveLength(1);
  });

  it('deleteInventory: quita el correcto, deja los demás', () => {
    const a = createInventory('A', []);
    const b = createInventory('B', []);
    deleteInventory(a.id);
    const list = loadInventories();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });

  it('getActiveInventoryId / setActiveInventoryId: round-trip', () => {
    expect(getActiveInventoryId()).toBeNull();
    setActiveInventoryId('xyz-123');
    expect(getActiveInventoryId()).toBe('xyz-123');
  });

  it('items malformados se filtran al cargar', () => {
    const corruptedList = [
      {
        id: 'a',
        name: 'Con basura',
        items: [
          sampleItem({ id: 1, name: 'OK' }),
          { id: 2 }, // sin name, ancho, alto, fondo
          { garbage: true }, // sin id
          { name: 'no dims', ancho: 10, alto: 10 }, // falta fondo
          'string suelto', // no es objeto
          null,
        ],
      },
    ];
    globalThis.localStorage.setItem('truck-packer-inventories', JSON.stringify(corruptedList));
    const loaded = loadInventories();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].items).toHaveLength(1);
    expect(loaded[0].items[0].name).toBe('OK');
  });
});
