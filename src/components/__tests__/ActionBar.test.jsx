import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionBar from '../ActionBar.jsx';

const sampleStrategies = [
  { key: 'max_volume', label: 'Máx volumen', icon: '📦', desc: 'Llena al máximo' },
  { key: 'max_pieces', label: 'Máx piezas',  icon: '🔢', desc: 'Mayor número de muebles' },
  { key: 'balanced',   label: 'Balanceado',  icon: '⚖️', desc: 'Reparte entre todos' },
];

function renderBar(props = {}) {
  return render(
    <ActionBar
      canReorganize={true}
      canSimulate={true}
      isCalculating={false}
      activeStrategyId={null}
      strategies={sampleStrategies}
      onReorganize={vi.fn()}
      onApplyStrategy={vi.fn()}
      onSimulate={vi.fn()}
      {...props}
    />
  );
}

describe('ActionBar', () => {
  it('renderiza los tres botones (Reorganizar, Estrategias, Simular)', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /Reorganizar carga/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar estrategia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar simulador/i })).toBeInTheDocument();
  });

  it('Reorganizar disabled cuando canReorganize=false', () => {
    renderBar({ canReorganize: false });
    expect(screen.getByRole('button', { name: /Reorganizar carga/i })).toBeDisabled();
  });

  it('Simular disabled cuando canSimulate=false', () => {
    renderBar({ canSimulate: false });
    expect(screen.getByRole('button', { name: /Iniciar simulador/i })).toBeDisabled();
  });

  it('Click en Reorganizar dispara onReorganize', () => {
    const onReorganize = vi.fn();
    renderBar({ onReorganize });
    fireEvent.click(screen.getByRole('button', { name: /Reorganizar carga/i }));
    expect(onReorganize).toHaveBeenCalledTimes(1);
  });

  it('Click en Simular dispara onSimulate', () => {
    const onSimulate = vi.fn();
    renderBar({ onSimulate });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar simulador/i }));
    expect(onSimulate).toHaveBeenCalledTimes(1);
  });

  it('Click en Estrategias abre el dropdown con las N estrategias', () => {
    renderBar();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Aplicar estrategia/i }));
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(sampleStrategies.length);
    expect(screen.getByText('Máx volumen')).toBeInTheDocument();
    expect(screen.getByText('Llena al máximo')).toBeInTheDocument();
  });

  it('Click en una estrategia llama onApplyStrategy con el id correcto', () => {
    const onApplyStrategy = vi.fn();
    renderBar({ onApplyStrategy });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar estrategia/i }));
    fireEvent.click(screen.getByText('Máx piezas'));
    expect(onApplyStrategy).toHaveBeenCalledWith('max_pieces');
  });

  it('Escape cierra el dropdown', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Aplicar estrategia/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Click fuera del dropdown lo cierra', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Aplicar estrategia/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('isCalculating muestra "Calculando..." en el botón Estrategias', () => {
    renderBar({ isCalculating: true });
    expect(screen.getByText(/Calculando/)).toBeInTheDocument();
  });

  it('Mientras isCalculating=true el botón Reorganizar está disabled (no se interrumpe)', () => {
    renderBar({ isCalculating: true });
    expect(screen.getByRole('button', { name: /Reorganizar carga/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Iniciar simulador/i })).toBeDisabled();
  });
});
