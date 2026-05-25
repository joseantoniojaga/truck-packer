import { Package, Plus } from 'lucide-react';

// Estado vacío del visor. Cambia el mensaje según el contexto:
//   - inventario completamente vacío (totalInventory===0) → "Crea tu primer mueble"
//   - hay muebles definidos pero ninguno colocado     → "Usa + o una estrategia"
// Se renderiza absoluto sobre el viewer-content para que ocupe siempre el
// centro visual del área, sin importar la vista activa (3D, ortográficas o
// "Todas"). pointer-events: none porque no debe interceptar clicks del visor.
export default function EmptyViewerState({ totalInventory = 0 }) {
  const isInventoryEmpty = totalInventory === 0;
  const Icon = isInventoryEmpty ? Plus : Package;
  const text = isInventoryEmpty ? "Crea tu primer mueble" : "Usa + o una estrategia";

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
      <Icon size={48} strokeWidth={1.5} aria-hidden />
      <div style={{
        fontSize: "var(--text-md)",
        fontWeight: 500,
      }}>
        {text}
      </div>
    </div>
  );
}
