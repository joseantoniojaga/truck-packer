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
      position: "fixed", inset: 0, background: "#000000CC", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        background: "#1E293B", borderRadius: 12, padding: 16,
        maxWidth, width: "100%", border: `1px solid ${accentColor}`
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
