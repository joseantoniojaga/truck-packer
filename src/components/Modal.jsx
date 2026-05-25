// Reusable modal: dark overlay + centered card with title.
// Props:
//   open        - boolean; renders nothing when false
//   onClose     - optional callback (not auto-wired; available to parents)
//   title       - header text (rendered above children)
//   titleColor  - color for the header text
//   accentColor - color used for the card's border
//   maxWidth    - optional card max width (default 340)
//   nested      - boolean; cuando true, NO renderiza el backdrop (para modales
//                 que abren sobre otros modales — evita stacking de overlays)
//   hidden      - boolean; cuando true, el modal queda montado pero invisible
//                 (display:none) — útil mientras un sub-modal está abierto.
//   showClose   - boolean; cuando true, muestra una X en la esquina superior
//                 derecha del header que dispara onClose.
//   children    - body content
import { X as XIcon } from 'lucide-react';

export default function Modal({
  open, onClose, title, titleColor, accentColor,
  maxWidth = 340, nested = false, hidden = false, showClose = false,
  children,
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: nested ? "transparent" : "rgba(0,0,0,0.8)",
      zIndex: nested ? 1100 : 1000,
      display: hidden ? "none" : "flex",
      alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        position: "relative",
        background: "var(--surface)", borderRadius: "var(--radius-md)", padding: 16,
        maxWidth, width: "100%", border: `1px solid ${accentColor}`,
        boxShadow: "var(--shadow-md)"
      }}>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            style={{
              position: "absolute", top: 12, right: 12,
              width: 32, height: 32, padding: 0,
              borderRadius: "50%", border: "none",
              background: "transparent", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-secondary)",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <XIcon size={18} />
          </button>
        )}
        {title && (
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: titleColor, marginBottom: 14, paddingRight: showClose ? 36 : 0 }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
