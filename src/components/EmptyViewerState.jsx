import { Package } from 'lucide-react';

// Estado vacío del visor cuando no hay muebles colocados todavía.
// Reemplaza al Viewer3D (no se renderiza Three.js en ese caso) para
// evitar el costo de inicializar la escena y proyectar un mensaje claro.
export default function EmptyViewerState() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      color: "var(--text-tertiary)",
      pointerEvents: "none",
      zIndex: 5,
      textAlign: "center",
      padding: 24,
    }}>
      <Package size={48} aria-hidden />
      <div style={{
        fontSize: "var(--text-md)",
        fontWeight: 500,
      }}>
        Usa + o una estrategia
      </div>
    </div>
  );
}
