import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

// ─── Three.js mock ──────────────────────────────────────────────────────────
// jsdom no implementa WebGL. Mockeamos cada constructor que App.jsx usa con
// un stub que (a) tiene métodos no-op, (b) expone domElement como un canvas
// real para que el appendChild / addEventListener / removeChild funcionen.
vi.mock('three', () => {
  function StubClass() {
    return {
      add: vi.fn(),
      remove: vi.fn(),
      traverse: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      setClearColor: vi.fn(),
      render: vi.fn(),
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
      scale: { set: vi.fn() },
      domElement: typeof document !== 'undefined' ? document.createElement('canvas') : {},
      children: [],
      userData: {},
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() },
      aspect: 1,
      parent: null,
      background: undefined,
    };
  }
  return {
    Scene: StubClass,
    Color: StubClass,
    PerspectiveCamera: StubClass,
    WebGLRenderer: StubClass,
    AmbientLight: StubClass,
    DirectionalLight: StubClass,
    LineSegments: StubClass,
    EdgesGeometry: StubClass,
    BoxGeometry: StubClass,
    LineBasicMaterial: StubClass,
    Mesh: StubClass,
    PlaneGeometry: StubClass,
    MeshBasicMaterial: StubClass,
    MeshPhongMaterial: StubClass,
    DoubleSide: 2,
  };
});

// ─── Imports después del mock ───────────────────────────────────────────────
import App from '../App.jsx';
import { FURNITURE } from '../furniture.js';
import { createInventory, setActiveInventoryId, loadInventories } from '../inventoryStorage.js';

const BASE_MUEBLES = ['Tocador Boston', 'Buró Hampton', 'Cabecera Hampton', 'Base Queen Sierra'];

// Helper para encontrar el "card" de un modal (sube por el árbol DOM hasta
// el div del card). Tras la migración a iconos lucide, el título es un
// <span> con icono + texto, así que subir 2 niveles llega al card.
function modalCardByTitle(titleText) {
  const titleEl = screen.getByText(titleText);
  // titleEl puede ser el span (con icono) o el title div directamente.
  // Subimos hasta encontrar el card (el div con maxWidth en su style).
  let el = titleEl;
  while (el && !(el.style && el.style.maxWidth)) el = el.parentElement;
  return el || titleEl.parentElement;
}

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('App: boot inicial', () => {
  it('renderiza con los 9 muebles base en la lista', () => {
    render(<App />);
    for (const nombre of BASE_MUEBLES) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
    // Verifica que se creó el "Inventario base" en localStorage
    const stored = loadInventories();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Inventario base');
    expect(stored[0].items).toHaveLength(FURNITURE.length);
  });
});

describe('App: persistencia entre montajes', () => {
  it('los items base sobreviven a un unmount/remount', () => {
    const { unmount } = render(<App />);
    expect(screen.getByText('Buró Hampton')).toBeInTheDocument();
    unmount();
    cleanup();
    render(<App />);
    // Sigue ahí
    expect(screen.getByText('Buró Hampton')).toBeInTheDocument();
    // Sigue siendo 1 solo inventario (no se duplicó en el 2do mount)
    expect(loadInventories()).toHaveLength(1);
  });
});

describe('App: flujo de inventario vacío', () => {
  it('crear inventario vacío "Test" → placeholder y lista vacía', () => {
    render(<App />);

    fireEvent.click(screen.getByText(/Inventarios/));
    fireEvent.click(screen.getByText(/Crear inventario nuevo/));
    // PromptModal abierto: escribir y submit
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    expect(screen.queryByText('Buró Hampton')).toBeNull();
    expect(screen.getByText(/Este inventario está vacío/)).toBeInTheDocument();
    const after = loadInventories();
    expect(after).toHaveLength(2);
    expect(after.find(i => i.name === 'Test')).toBeDefined();
  });

  it('volver al inventario base desde el manager: muebles reaparecen', () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Inventarios/));
    fireEvent.click(screen.getByText(/Crear inventario nuevo/));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.queryByText('Buró Hampton')).toBeNull();

    // Abrir manager y cargar el Inventario base
    fireEvent.click(screen.getByText(/Inventarios/));
    const cargarButtons = screen.getAllByRole('button', { name: 'Cargar' });
    const baseCargar = cargarButtons.find(b => !b.disabled);
    fireEvent.click(baseCargar);

    // Vuelven los muebles base
    for (const nombre of BASE_MUEBLES) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
  });
});

describe('App: crear mueble custom', () => {
  it('agrega "Silla X" desde el editor y aparece en la lista', () => {
    render(<App />);

    fireEvent.click(screen.getByText(/Agregar mueble/));

    const modal = modalCardByTitle('Nuevo mueble');
    const nameInput = within(modal).getByPlaceholderText('Ej. Silla de comedor');
    const numberInputs = modal.querySelectorAll('input[type="number"]');

    fireEvent.change(nameInput, { target: { value: 'Silla X' } });
    fireEvent.change(numberInputs[0], { target: { value: '50' } });   // ancho
    fireEvent.change(numberInputs[1], { target: { value: '80' } });   // alto
    fireEvent.change(numberInputs[2], { target: { value: '50' } });   // fondo
    fireEvent.change(numberInputs[3], { target: { value: '3' } });    // inv

    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Silla X')).toBeInTheDocument();
    // El stepper muestra el load actual en un input + "/3" en un span aparte
    // (estructura del componente FurnitureCard). Tras agregar, load === 0.
    const sillaRow = screen.getByText('Silla X').closest('.furniture-card');
    expect(sillaRow).not.toBeNull();
    expect(within(sillaRow).getByText('/3')).toBeInTheDocument();
    expect(within(sillaRow).getByDisplayValue('0')).toBeInTheDocument();

    // Persistido
    const after = loadInventories()[0];
    expect(after.items.some(i => i.name === 'Silla X')).toBe(true);
  });
});

describe('App: editar y borrar mueble custom', () => {
  // Pre-cargo un inventario con la "Silla X" para no depender del test anterior.
  beforeEach(() => {
    const baseItems = FURNITURE.map(f => ({
      id: f.id, name: f.name, color: f.color, ancho: f.ancho, alto: f.alto, fondo: f.fondo, inv: f.inv,
    }));
    baseItems.push({ id: 'custom-1', name: 'Silla X', color: '#06B6D4', ancho: 50, alto: 80, fondo: 50, inv: 3 });
    const inv = createInventory('Inventario base', baseItems);
    setActiveInventoryId(inv.id);
  });

  it('editar nombre: "Silla X" → "Silla Y"', () => {
    render(<App />);
    expect(screen.getByText('Silla X')).toBeInTheDocument();

    // Encuentra la fila de Silla X y haz click en su botón ✏️
    const sillaRow = screen.getByText('Silla X').closest('div').parentElement.parentElement;
    const editBtn = within(sillaRow).getByTitle('Editar mueble');
    fireEvent.click(editBtn);

    const modal = modalCardByTitle('Editar mueble');
    const nameInput = within(modal).getByPlaceholderText('Ej. Silla de comedor');
    expect(nameInput.value).toBe('Silla X');
    fireEvent.change(nameInput, { target: { value: 'Silla Y' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar' }));

    expect(screen.queryByText('Silla X')).toBeNull();
    expect(screen.getByText('Silla Y')).toBeInTheDocument();
  });

  it('borrar mueble: confirm true → desaparece de la lista', () => {
    render(<App />);

    const sillaRow = screen.getByText('Silla X').closest('div').parentElement.parentElement;
    fireEvent.click(within(sillaRow).getByTitle('Editar mueble'));

    const editorModal = modalCardByTitle('Editar mueble');
    fireEvent.click(within(editorModal).getByText(/Borrar mueble/));
    // ConfirmModal abre; click "Borrar" lo confirma
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(screen.queryByText('Silla X')).toBeNull();
    expect(loadInventories()[0].items.some(i => i.name === 'Silla X')).toBe(false);
  });

  it('borrar mueble: confirm cancelado → permanece', () => {
    render(<App />);

    const sillaRow = screen.getByText('Silla X').closest('div').parentElement.parentElement;
    fireEvent.click(within(sillaRow).getByTitle('Editar mueble'));

    const editorModal = modalCardByTitle('Editar mueble');
    fireEvent.click(within(editorModal).getByText(/Borrar mueble/));
    // ConfirmModal abre. Cancelar el confirm (el ÚLTIMO botón Cancelar es el del ConfirmModal).
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    expect(screen.getByText('Silla X')).toBeInTheDocument();
  });
});

describe('App: input editable de load', () => {
  it('escribir un valor válido en el input de load lo actualiza', () => {
    render(<App />);

    // Encuentra la fila del Buró Hampton y su input de load (en modo normal: el último input de la fila)
    const buroRow = screen.getByText('Buró Hampton').closest('div').parentElement.parentElement;
    const inputs = buroRow.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBeGreaterThan(0);
    const loadInput = inputs[inputs.length - 1];

    fireEvent.change(loadInput, { target: { value: '5' } });
    // Tras el repack, el input refleja el nuevo load
    expect(loadInput.value).toBe('5');
  });

  it('escribir un valor > inv: se clampa al inv máximo', () => {
    render(<App />);

    const buroRow = screen.getByText('Buró Hampton').closest('div').parentElement.parentElement;
    const inputs = buroRow.querySelectorAll('input[type="number"]');
    const loadInput = inputs[inputs.length - 1];
    // Buró Hampton tiene inv=32. Pedir 999 debería quedarse en 32.
    fireEvent.change(loadInput, { target: { value: '999' } });
    expect(parseInt(loadInput.value, 10)).toBeLessThanOrEqual(32);
  });
});
