import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Modal from '../Modal.jsx';

describe('Modal', () => {
  it('no renderiza nada cuando open es false', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="Hola" titleColor="#000" accentColor="#fff">
        <p>contenido</p>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza title y children cuando open es true', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Mi modal" titleColor="#06B6D4" accentColor="#06B6D444">
        <p>cuerpo del modal</p>
      </Modal>
    );
    expect(screen.getByText('Mi modal')).toBeInTheDocument();
    expect(screen.getByText('cuerpo del modal')).toBeInTheDocument();
  });

  it('aplica accentColor al borde del card', () => {
    const { container } = render(
      <Modal open={true} onClose={() => {}} title="X" titleColor="#000" accentColor="#06B6D444">
        <p>x</p>
      </Modal>
    );
    // jsdom normaliza el color a rgba; #06B6D444 = rgba(6, 182, 212, ~0.267).
    const card = container.querySelector('[style*="border-radius"]');
    expect(card).not.toBeNull();
    expect(card.style.border.replace(/\s+/g, ' ')).toMatch(/rgba\(6,\s*182,\s*212/);
  });

  it('no dispara onClose automáticamente (preserva la lógica de los modales existentes)', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="X" titleColor="#000" accentColor="#fff">
        <p>x</p>
      </Modal>
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('respeta maxWidth opcional', () => {
    const { container } = render(
      <Modal open={true} onClose={() => {}} title="X" titleColor="#000" accentColor="#fff" maxWidth={500}>
        <p>x</p>
      </Modal>
    );
    const card = container.querySelector('[style*="max-width"]');
    expect(card.style.maxWidth).toBe('500px');
  });
});
