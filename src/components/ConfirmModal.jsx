import { useEffect } from 'react';
import Modal from './Modal.jsx';
import { COLORS } from '../constants.js';
import { AlertTriangle, Check } from 'lucide-react';

// Modal de confirmación (reemplazo de window.confirm nativo).
//
// Props:
//   open
//   title         - JSX o string
//   message       - cuerpo del mensaje
//   confirmLabel  - default "Aceptar"
//   cancelLabel   - default "Cancelar"
//   variant       - 'default' | 'danger' | 'info' (cambia color del acento)
//   onConfirm
//   onCancel
export default function ConfirmModal({
  open, title, message,
  confirmLabel = 'Aceptar', cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm, onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const accentColor =
    variant === 'danger' ? COLORS.red + '44' :
    variant === 'info'   ? COLORS.cyan + '44' :
                           COLORS.amber + '44';
  const titleColor =
    variant === 'danger' ? COLORS.red :
    variant === 'info'   ? COLORS.cyan :
                           COLORS.amber;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {variant === 'danger' ? <AlertTriangle size={16}/> : <Check size={16}/>}
          {title}
        </span>
      }
      titleColor={titleColor}
      accentColor={accentColor}
      maxWidth={420}
    >
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="action-btn action-btn--secondary"
          onClick={onCancel}
          style={{ padding: '8px 14px', fontSize: 13 }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="action-btn action-btn--primary"
          onClick={onConfirm}
          style={{
            padding: '8px 14px', fontSize: 13,
            background: variant === 'danger' ? 'var(--error)' : 'var(--primary)',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
