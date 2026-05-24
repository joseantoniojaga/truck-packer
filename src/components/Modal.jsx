// Reusable modal: dark overlay + centered card with title.
// Props:
//   open        - boolean; renders nothing when false
//   onClose     - optional callback (not auto-wired; available to parents)
//   title       - header text (rendered above children)
//   titleColor  - color for the header text
//   accentColor - color used for the card's border
//   maxWidth    - optional card max width (default 340)
//   children    - body content
export default function Modal({ open, onClose, title, titleColor, accentColor, maxWidth = 340, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius-md)", padding: 16,
        maxWidth, width: "100%", border: `1px solid ${accentColor}`,
        boxShadow: "var(--shadow-md)"
      }}>
        {title && (
          <div style={{ fontSize: 14, fontWeight: 700, color: titleColor, marginBottom: 10 }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
