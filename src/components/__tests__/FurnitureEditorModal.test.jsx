import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FurnitureEditorModal from '../FurnitureEditorModal.jsx';

// Volumen del tráiler real (mismo cálculo que App.jsx → TV).
const TRAILER_VOLUME = 1615.4 * 247 * 280;

const sampleFurn = (over = {}) => ({
  id: 'fixture-1', name: 'Mueble fixture', color: '#E07A5F',
  ancho: 50, alto: 50, fondo: 50, inv: 3, ...over,
});

// Devuelve los inputs en el orden de aparición en el JSX:
// [name (text), ancho, alto, fondo, inv (number), color]
function getInputs(container) {
  return {
    name: container.querySelector('input[type="text"]'),
    numbers: container.querySelectorAll('input[type="number"]'),
    color: container.querySelector('input[type="color"]'),
  };
}

function renderModal(props = {}) {
  return render(
    <FurnitureEditorModal
      open
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      initialFurniture={null}
      existingFurniture={[]}
      trailerVolume={TRAILER_VOLUME}
      {...props}
    />
  );
}

describe('FurnitureEditorModal — modo nuevo', () => {
  it('título "➕ Nuevo mueble", campos default, Guardar disabled', () => {
    renderModal();
    expect(screen.getByText('➕ Nuevo mueble')).toBeInTheDocument();
    const { name, numbers } = getInputs(document.body);
    expect(name.value).toBe('');
    // ancho/alto/fondo = 50, inv = 1
    expect(numbers[0].value).toBe('50');
    expect(numbers[3].value).toBe('1');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('no muestra el botón "🗑️ Borrar mueble" en modo nuevo', () => {
    renderModal();
    expect(screen.queryByText(/Borrar mueble/)).toBeNull();
  });
});

describe('FurnitureEditorModal — modo edición', () => {
  it('título "✏️ Editar mueble", campos pre-cargados, nota tenue, botón Borrar visible', () => {
    renderModal({ initialFurniture: sampleFurn({ name: 'Cama Lux', ancho: 200, alto: 30, fondo: 150, inv: 5, color: '#06B6D4' }) });
    expect(screen.getByText('✏️ Editar mueble')).toBeInTheDocument();
    const { name, numbers } = getInputs(document.body);
    expect(name.value).toBe('Cama Lux');
    expect(numbers[0].value).toBe('200');
    expect(numbers[3].value).toBe('5');
    expect(screen.getByText(/Si cambias las dimensiones/)).toBeInTheDocument();
    expect(screen.getByText(/Borrar mueble/)).toBeInTheDocument();
  });
});

describe('FurnitureEditorModal — validación nombre', () => {
  it('nombre vacío → "Nombre requerido", Guardar disabled', () => {
    renderModal();
    expect(screen.getByText('Nombre requerido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('nombre duplicado en existingFurniture → mensaje de error (case-insensitive)', () => {
    renderModal({
      existingFurniture: [sampleFurn({ id: 'other', name: 'Mesa Centro' })],
    });
    const { name } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'mesa centro' } }); // distinto case
    expect(screen.getByText('Ya existe un mueble con este nombre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('nombre con >40 chars → "Máximo 40 caracteres"', () => {
    renderModal();
    const { name } = getInputs(document.body);
    // fireEvent.change bypassea el maxLength del HTML
    fireEvent.change(name, { target: { value: 'x'.repeat(41) } });
    expect(screen.getByText('Máximo 40 caracteres')).toBeInTheDocument();
  });

  it('editar el propio mueble: el nombre original no cuenta como duplicado', () => {
    const own = sampleFurn({ id: 'self-1', name: 'Mismo Nombre' });
    renderModal({
      initialFurniture: own,
      existingFurniture: [own, sampleFurn({ id: 'other', name: 'Otro' })],
    });
    // Sin cambios, no debería haber error de duplicado
    expect(screen.queryByText('Ya existe un mueble con este nombre')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });
});

describe('FurnitureEditorModal — validación dimensiones e inventario', () => {
  it('ancho = 0 → "Debe ser mayor a 0"', () => {
    renderModal();
    const { name, numbers } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'OK' } });
    fireEvent.change(numbers[0], { target: { value: '0' } });
    expect(screen.getByText('Debe ser mayor a 0')).toBeInTheDocument();
  });

  it('ancho > 500 → "Máximo 500 cm"', () => {
    renderModal();
    const { name, numbers } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'OK' } });
    fireEvent.change(numbers[0], { target: { value: '600' } });
    expect(screen.getByText('Máximo 500 cm')).toBeInTheDocument();
  });

  it('inv < 0 → "Debe ser ≥ 0"', () => {
    renderModal();
    const { name, numbers } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'OK' } });
    fireEvent.change(numbers[3], { target: { value: '-1' } });
    expect(screen.getByText('Debe ser ≥ 0')).toBeInTheDocument();
  });

  it('inv > 999 → "Máximo 999"', () => {
    renderModal();
    const { name, numbers } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'OK' } });
    fireEvent.change(numbers[3], { target: { value: '1000' } });
    expect(screen.getByText('Máximo 999')).toBeInTheDocument();
  });

  it('volumen > tráiler → "Este mueble no cabe en el tráiler"', () => {
    // 500×500×500 = 125M > 111.7M del tráiler.
    // (El spec original decía 400×400×400 = 64M pero eso no excede el tráiler;
    // ajustado al comportamiento REAL — ver notas del commit.)
    renderModal();
    const { name, numbers } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'Gigante' } });
    fireEvent.change(numbers[0], { target: { value: '500' } });
    fireEvent.change(numbers[1], { target: { value: '500' } });
    fireEvent.change(numbers[2], { target: { value: '500' } });
    expect(screen.getByText('Este mueble no cabe en el tráiler')).toBeInTheDocument();
  });
});

describe('FurnitureEditorModal — color picker y presets', () => {
  it('click en un preset de color actualiza el input color', () => {
    const { container } = renderModal();
    const { color } = getInputs(container);
    expect(color.value.toLowerCase()).toBe('#e07a5f'); // primero del PALETTE
    // Buscar el botón del preset cyan (#06B6D4) por su title
    const preset = container.querySelector('button[title="#06B6D4"]');
    expect(preset).not.toBeNull();
    fireEvent.click(preset);
    expect(color.value.toLowerCase()).toBe('#06b6d4');
  });
});

describe('FurnitureEditorModal — acciones', () => {
  it('Guardar con datos válidos: llama onSave con el objeto, luego onClose', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSave, onClose });
    const { name, numbers } = getInputs(document.body);
    fireEvent.change(name, { target: { value: 'Silla X' } });
    fireEvent.change(numbers[0], { target: { value: '60' } });
    fireEvent.change(numbers[1], { target: { value: '90' } });
    fireEvent.change(numbers[2], { target: { value: '60' } });
    fireEvent.change(numbers[3], { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.name).toBe('Silla X');
    expect(arg.ancho).toBe(60);
    expect(arg.alto).toBe(90);
    expect(arg.fondo).toBe(60);
    expect(arg.inv).toBe(3);
    expect(typeof arg.id).toBe('string');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancelar: llama onClose, no llama onSave', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSave, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('FurnitureEditorModal — borrado (modo edición)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Borrar con confirm true: llama onDelete con el mueble', () => {
    const onDelete = vi.fn();
    const furn = sampleFurn({ id: 'self-1', name: 'Cama' });
    renderModal({ initialFurniture: furn, onDelete });
    // El confirm ocurre dentro del handler del padre (App.jsx). Aquí solo
    // verifico que onDelete recibe el mueble; el confirm lo simula el padre.
    fireEvent.click(screen.getByText(/Borrar mueble/));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0]).toEqual(furn);
  });
});
