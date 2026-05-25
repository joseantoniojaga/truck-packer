import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import { COLORS } from '../constants.js';
import { Plus } from 'lucide-react';

// Modal de captura de texto (reemplazo de window.prompt nativo).
//
// Props:
//   open          - boolean
//   title         - JSX o string para el título del modal
//   label         - etiqueta sobre el input (e.g. "Nombre del nuevo inventario")
//   description   - subtítulo opcional debajo del label
//   placeholder   - placeholder del input
//   initialValue  - valor inicial (e.g. para renombrar)
//   submitLabel   - texto del botón principal (default "Crear")
//   submitIcon    - componente icono (default Plus)
//   accentColor   - color del border del card (default cyan token)
//   validate      - (value) => error string | null
//   onSubmit      - (value: string) => void
//   onCancel      - () => void
export default function PromptModal({
  open, title, label, description, placeholder, initialValue = '',
  submitLabel = 'Crear', submitIcon: SubmitIcon = Plus,
  accentColor, validate, onSubmit, onCancel,
  nested = true,
}) {
  const [value, setValue] = useState(initialValue);

  // Resetea el input cada vez que se abre el modal.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  // Escape cierra (ya lo maneja el usuario via onCancel, pero por accesibilidad)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const trimmed = value.trim();
  const error = validate ? validate(trimmed) : (trimmed === '' ? 'No puede estar vacío' : null);
  const canSubmit = !error;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      titleColor={COLORS.cyan}
      accentColor={accentColor || (COLORS.cyan + '44')}
      maxWidth={420}
      nested={nested}
    >
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
          {label}
        </label>
        {description && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
        <input
          type="text"
          value={value}
          autoFocus
          maxLength={60}
          placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            fontSize: 14,
            background: 'var(--bg-subtle)',
            border: `1px solid var(--border)`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            outline: 'none',
            marginBottom: error && value !== '' ? 4 : 0,
          }}
        />
        {error && value !== '' && (
          <div style={{ fontSize: 11, color: 'var(--error)', marginBottom: 4 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button
            type="button"
            className="action-btn action-btn--secondary"
            onClick={onCancel}
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="action-btn action-btn--primary"
            disabled={!canSubmit}
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            <SubmitIcon size={14} />
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
