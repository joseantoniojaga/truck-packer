import { Truck, Sun, Moon } from 'lucide-react';

// Topbar Cargo Trust: logo + nombre del producto + info del inventario,
// pill de capacidad y toggle de tema. Sticky en la parte superior.
//
// Props:
//   inventoryName: string  — nombre del inventario activo (e.g. "Inventario base")
//   trailerPlate:  string  — placa del tráiler (e.g. "49-UT-7V")
//   capacityText:  string  — volumen total ya formateado (e.g. "111.74 m³")
//   theme:         'light' | 'dark'
//   onToggleTheme: () => void
export default function Topbar({ inventoryName, trailerPlate, capacityText, theme, onToggleTheme }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        minHeight: 64,
      }}
    >
      {/* Izquierda: logo + nombre */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-sm)",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Truck size={20} color="#FFFFFF" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>
          Truck Packer
        </span>
      </div>

      {/* Centro: info del inventario y tráiler */}
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: 14,
          color: "var(--text-secondary)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {inventoryName} · Tráiler {trailerPlate}
      </div>

      {/* Derecha: pill de capacidad + toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--primary)",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
            {capacityText}
          </span>
        </div>

        <button
          onClick={onToggleTheme}
          aria-label="Cambiar tema"
          title={theme === 'light' ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 0,
            transition: "background-color 150ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-subtle)"; }}
        >
          {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
