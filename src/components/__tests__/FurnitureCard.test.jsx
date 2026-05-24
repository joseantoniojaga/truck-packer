import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FurnitureCard from '../FurnitureCard.jsx';

const sampleFurn = (over = {}) => ({
  id: 1, name: 'Silla X', color: '#06B6D4',
  ancho: 50, alto: 80, fondo: 50, inv: 16, ...over,
});

function renderCard(props = {}) {
  return render(
    <FurnitureCard
      furniture={sampleFurn()}
      placed={0}
      editMode={false}
      selected={false}
      onSelect={vi.fn()}
      onIncrement={vi.fn()}
      onDecrement={vi.fn()}
      onSetCount={vi.fn()}
      onEdit={vi.fn()}
      {...props}
    />
  );
}

describe('FurnitureCard', () => {
  it('render base: nombre, dimensiones y stepper en 0/16', () => {
    renderCard();
    expect(screen.getByText('Silla X')).toBeInTheDocument();
    expect(screen.getByText('50 × 80 × 50 cm')).toBeInTheDocument();
    expect(screen.getByText('/16')).toBeInTheDocument();
    expect(screen.getByLabelText('Cargadas')).toHaveValue(0);
  });

  it('placed === inv muestra el checkmark "Completo"', () => {
    renderCard({ placed: 16 });
    expect(screen.getByLabelText('Completo')).toBeInTheDocument();
  });

  it('placed < inv: no muestra checkmark', () => {
    renderCard({ placed: 5 });
    expect(screen.queryByLabelText('Completo')).toBeNull();
  });

  it('placed === 0: no muestra checkmark (aunque inv > 0)', () => {
    renderCard({ placed: 0 });
    expect(screen.queryByLabelText('Completo')).toBeNull();
  });

  it('botón − dispara onDecrement; deshabilitado cuando placed === 0', () => {
    const onDecrement = vi.fn();
    const { rerender } = renderCard({ placed: 0, onDecrement });
    const minusBtn = screen.getByLabelText('Menos');
    expect(minusBtn).toBeDisabled();
    fireEvent.mouseDown(minusBtn);
    // No se dispara cuando está disabled
    expect(onDecrement).not.toHaveBeenCalled();

    rerender(
      <FurnitureCard
        furniture={sampleFurn()} placed={3} editMode={false} selected={false}
        onSelect={vi.fn()} onIncrement={vi.fn()} onDecrement={onDecrement}
        onSetCount={vi.fn()} onEdit={vi.fn()}
      />
    );
    fireEvent.mouseDown(screen.getByLabelText('Menos'));
    expect(onDecrement).toHaveBeenCalledTimes(1);
    fireEvent.mouseUp(screen.getByLabelText('Menos'));
  });

  it('botón + dispara onIncrement; deshabilitado cuando placed === inv', () => {
    const onIncrement = vi.fn();
    const { rerender } = renderCard({ placed: 16, onIncrement });
    const plusBtn = screen.getByLabelText('Más');
    expect(plusBtn).toBeDisabled();

    rerender(
      <FurnitureCard
        furniture={sampleFurn()} placed={5} editMode={false} selected={false}
        onSelect={vi.fn()} onIncrement={onIncrement} onDecrement={vi.fn()}
        onSetCount={vi.fn()} onEdit={vi.fn()}
      />
    );
    fireEvent.mouseDown(screen.getByLabelText('Más'));
    expect(onIncrement).toHaveBeenCalledTimes(1);
    fireEvent.mouseUp(screen.getByLabelText('Más'));
  });

  it('escribir un número en el input dispara onSetCount con el valor clamp', () => {
    const onSetCount = vi.fn();
    renderCard({ placed: 0, onSetCount });
    const input = screen.getByLabelText('Cargadas');
    fireEvent.change(input, { target: { value: '5' } });
    expect(onSetCount).toHaveBeenLastCalledWith(5);
    // Mayor que inv (16): clamp a 16
    fireEvent.change(input, { target: { value: '999' } });
    expect(onSetCount).toHaveBeenLastCalledWith(16);
    // Vacío: 0
    fireEvent.change(input, { target: { value: '' } });
    expect(onSetCount).toHaveBeenLastCalledWith(0);
  });

  it('click en el botón ✏ dispara onEdit', () => {
    const onEdit = vi.fn();
    renderCard({ onEdit });
    fireEvent.click(screen.getByLabelText('Editar mueble'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('click en el card dispara onSelect', () => {
    const onSelect = vi.fn();
    const { container } = renderCard({ onSelect });
    fireEvent.click(container.querySelector('.furniture-card'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('editMode: stepper edita inv, sin "/M" después del número', () => {
    renderCard({ editMode: true, placed: 0 });
    expect(screen.getByLabelText('Inventario')).toHaveValue(16);
    expect(screen.queryByText('/16')).toBeNull();
  });
});
