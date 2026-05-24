import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CapacityCard from '../CapacityCard.jsx';

// Formato simple para los tests: cm³ → m³ con 2 decimales.
const fmt = (cm3) => `${(cm3 / 1e6).toFixed(2)} m³`;

describe('CapacityCard', () => {
  it('renderiza el label y el porcentaje calculado', () => {
    render(
      <CapacityCard
        placedCount={5} totalRequested={10}
        placedVolume={50_000_000} totalVolume={100_000_000}
        formatVolume={fmt}
      />
    );
    expect(screen.getByText(/Capacidad del tráiler/i)).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('muestra el volumen formateado actual y total', () => {
    render(
      <CapacityCard
        placedCount={0} totalRequested={0}
        placedVolume={102_520_000} totalVolume={111_720_000}
        formatVolume={fmt}
      />
    );
    expect(screen.getByText('102.52 m³')).toBeInTheDocument();
    expect(screen.getByText('/ 111.72 m³')).toBeInTheDocument();
  });

  it('clampa el porcentaje a 100 si placedVolume excede totalVolume', () => {
    render(
      <CapacityCard
        placedCount={0} totalRequested={0}
        placedVolume={200_000_000} totalVolume={100_000_000}
        formatVolume={fmt}
      />
    );
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('porcentaje 0% cuando placedVolume es 0', () => {
    render(
      <CapacityCard
        placedCount={0} totalRequested={0}
        placedVolume={0} totalVolume={100_000_000}
        formatVolume={fmt}
      />
    );
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('porcentaje 0% cuando totalVolume es 0 (evita división por cero)', () => {
    render(
      <CapacityCard
        placedCount={0} totalRequested={0}
        placedVolume={0} totalVolume={0}
        formatVolume={fmt}
      />
    );
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('progressbar tiene aria-valuenow correcto', () => {
    render(
      <CapacityCard
        placedCount={0} totalRequested={0}
        placedVolume={91_800_000} totalVolume={100_000_000}
        formatVolume={fmt}
      />
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '92'); // 91.8 redondeado
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});
