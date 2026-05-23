import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import InventoryManagerModal from '../InventoryManagerModal.jsx';
import { saveInventories, loadInventories, setActiveInventoryId } from '../../inventoryStorage.js';

const sampleItem = (over = {}) => ({
  id: 1, name: 'X', color: '#fff', ancho: 10, alto: 10, fondo: 10, inv: 1, ...over,
});

function mountModal(initial = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    inventories: [],
    setInventories: vi.fn(),
    activeInventoryId: null,
    setActiveInventoryIdState: vi.fn(),
    items: [],
    setItems: vi.fn(),
    setPlaced: vi.fn(),
    ...initial,
  };
  const utils = render(<InventoryManagerModal {...props} />);
  return { ...utils, props };
}

describe('InventoryManagerModal — render', () => {
  it('un solo inventario activo: muestra check verde, Cargar disabled, Renombrar/Borrar visibles', () => {
    const inv = { id: 'a', name: 'Solo', items: [sampleItem()] };
    mountModal({ inventories: [inv], activeInventoryId: 'a' });

    expect(screen.getByText('Solo')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('1 tipo de mueble')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar' })).toBeDisabled();
    // Renombrar (✏️) y Borrar (🗑️) están presentes pero Borrar disabled (único)
    expect(screen.getByTitle('Renombrar')).toBeInTheDocument();
    const delBtn = screen.getByTitle(/No puedes borrar/);
    expect(delBtn).toBeDisabled();
  });

  it('múltiples inventarios: el activo tiene check, los demás tienen Cargar habilitado', () => {
    const invs = [
      { id: 'a', name: 'Base', items: [sampleItem()] },
      { id: 'b', name: 'Otro', items: [sampleItem(), sampleItem({ id: 2 })] },
    ];
    mountModal({ inventories: invs, activeInventoryId: 'a' });

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Otro')).toBeInTheDocument();
    expect(screen.getByText('2 tipos de muebles')).toBeInTheDocument();
    const cargarButtons = screen.getAllByRole('button', { name: 'Cargar' });
    // Uno disabled (el activo), el otro habilitado
    expect(cargarButtons.some(b => b.disabled)).toBe(true);
    expect(cargarButtons.some(b => !b.disabled)).toBe(true);
  });
});

describe('InventoryManagerModal — acciones', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Click Cargar en inventario no-activo: activa el inv y reemplaza items', () => {
    const invs = [
      { id: 'a', name: 'Base', items: [sampleItem({ id: 1, name: 'A' })] },
      { id: 'b', name: 'Otro', items: [sampleItem({ id: 2, name: 'B' })] },
    ];
    saveInventories(invs);
    const { props } = mountModal({ inventories: invs, activeInventoryId: 'a' });

    // El "Cargar" del segundo inventario (el no-activo) es el habilitado
    const cargarButtons = screen.getAllByRole('button', { name: 'Cargar' });
    const enabled = cargarButtons.find(b => !b.disabled);
    fireEvent.click(enabled);

    expect(props.setActiveInventoryIdState).toHaveBeenCalledWith('b');
    expect(props.setItems).toHaveBeenCalledTimes(1);
    const itemsArg = props.setItems.mock.calls[0][0];
    expect(itemsArg).toHaveLength(1);
    expect(itemsArg[0].name).toBe('B');
    expect(itemsArg[0].load).toBe(0);
    expect(props.setPlaced).toHaveBeenCalledWith([]);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('Click Renombrar con prompt válido: persiste el nuevo nombre', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Renombrado');
    const invs = [{ id: 'a', name: 'Antiguo', items: [sampleItem()] }];
    saveInventories(invs);
    const { props } = mountModal({ inventories: invs, activeInventoryId: 'a' });

    fireEvent.click(screen.getByTitle('Renombrar'));

    expect(window.prompt).toHaveBeenCalled();
    expect(loadInventories()[0].name).toBe('Renombrado');
    expect(props.setInventories).toHaveBeenCalled();
  });

  it('Click Renombrar con prompt vacío o cancelado: no cambia nada', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const invs = [{ id: 'a', name: 'Antiguo', items: [sampleItem()] }];
    saveInventories(invs);
    const { props } = mountModal({ inventories: invs, activeInventoryId: 'a' });

    fireEvent.click(screen.getByTitle('Renombrar'));

    expect(loadInventories()[0].name).toBe('Antiguo');
    expect(props.setInventories).not.toHaveBeenCalled();
  });

  it('Click Borrar con confirm true (2+ inventarios): elimina del storage', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const invs = [
      { id: 'a', name: 'Uno', items: [] },
      { id: 'b', name: 'Dos', items: [] },
    ];
    saveInventories(invs);
    const { props } = mountModal({ inventories: invs, activeInventoryId: 'a' });

    // El primer 🗑️ corresponde al primer inventario (activo). Lo borra.
    const trashButtons = screen.getAllByTitle('Borrar');
    fireEvent.click(trashButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(loadInventories()).toHaveLength(1);
    expect(loadInventories()[0].id).toBe('b');
    expect(props.setInventories).toHaveBeenCalled();
  });

  it('Click Borrar cuando solo hay 1 inventario: botón disabled + no borra', () => {
    const invs = [{ id: 'a', name: 'Único', items: [] }];
    saveInventories(invs);
    mountModal({ inventories: invs, activeInventoryId: 'a' });

    const delBtn = screen.getByTitle(/No puedes borrar/);
    expect(delBtn).toBeDisabled();
    fireEvent.click(delBtn);
    // Como el botón está disabled, el click no dispara handler ni storage cambia
    expect(loadInventories()).toHaveLength(1);
  });

  it('"➕ Crear inventario nuevo (vacío)": prompt válido → crea inv vacío y lo activa', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Test');
    const invs = [{ id: 'a', name: 'Base', items: [sampleItem()] }];
    saveInventories(invs);
    setActiveInventoryId('a');
    const { props } = mountModal({ inventories: invs, activeInventoryId: 'a' });

    fireEvent.click(screen.getByText(/Crear inventario nuevo/));

    expect(window.prompt).toHaveBeenCalled();
    const after = loadInventories();
    expect(after).toHaveLength(2);
    const created = after.find(x => x.name === 'Test');
    expect(created).toBeDefined();
    expect(created.items).toEqual([]);
    expect(props.setActiveInventoryIdState).toHaveBeenCalledWith(created.id);
    expect(props.setItems).toHaveBeenCalledWith([]);
    expect(props.setPlaced).toHaveBeenCalledWith([]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('"💾 Guardar inventario actual como nuevo": crea snapshot SIN activarlo', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Snapshot 1');
    const invs = [{ id: 'a', name: 'Base', items: [sampleItem()] }];
    saveInventories(invs);
    const currentItems = [sampleItem({ id: 1, name: 'A', load: 5 })];
    const { props } = mountModal({
      inventories: invs, activeInventoryId: 'a', items: currentItems,
    });

    fireEvent.click(screen.getByText(/Guardar inventario actual como nuevo/));

    const after = loadInventories();
    expect(after).toHaveLength(2);
    const snap = after.find(x => x.name === 'Snapshot 1');
    expect(snap.items).toHaveLength(1);
    // El load NO se persiste
    expect(snap.items[0].load).toBeUndefined();
    // No se activa: setActiveInventoryIdState no se llama
    expect(props.setActiveInventoryIdState).not.toHaveBeenCalled();
    // No se cierra el modal automáticamente al guardar como nuevo
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('"💾 Sobrescribir activo": actualiza items del activo y muestra flash', () => {
    vi.useFakeTimers();
    const invs = [{ id: 'a', name: 'Base', items: [sampleItem({ id: 1, name: 'viejo' })] }];
    saveInventories(invs);
    const currentItems = [sampleItem({ id: 1, name: 'nuevo', load: 3 })];
    mountModal({ inventories: invs, activeInventoryId: 'a', items: currentItems });

    fireEvent.click(screen.getByText(/Sobrescribir activo/));

    // Storage actualizado (sin load)
    const after = loadInventories()[0];
    expect(after.items[0].name).toBe('nuevo');
    expect(after.items[0].load).toBeUndefined();

    // Flash visible inmediatamente después del click
    expect(screen.getByText('✓ Guardado')).toBeInTheDocument();

    // Pasa el timeout y el flash desaparece
    vi.advanceTimersByTime(1600);
    vi.useRealTimers();
  });
});
