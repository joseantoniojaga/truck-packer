import { Box, Edit2, Plus, Minus, Check } from 'lucide-react';
import { useHoldRepeat } from '../hooks/useHoldRepeat.js';

// Card individual de un mueble en la lista del Paso 3.
//
// Props:
//   furniture        - objeto { id, name, ancho, alto, fondo, inv, color }
//   placed           - cantidad actualmente colocada en el tráiler
//   editMode         - boolean; si true, el stepper edita inv (no load)
//   selected         - boolean; resalta el card cuando coincide con selId
//   onSelect         - click en el card (selecciona el mueble)
//   onIncrement      - + (parent decide si es load o inv según editMode)
//   onDecrement      - −
//   onSetCount       - cambio directo via input numérico (recibe el número)
//   onEdit           - botón ✏ (abre el modal de edición)
export default function FurnitureCard({
  furniture: f, placed, editMode = false, selected = false,
  onSelect, onIncrement, onDecrement, onSetCount, onEdit,
}) {
  const incHold = useHoldRepeat(() => onIncrement());
  const decHold = useHoldRepeat(() => onDecrement());

  const currentValue = editMode ? f.inv : placed;
  const maxValue = editMode ? 999 : f.inv;
  const isComplete = !editMode && placed === f.inv && f.inv > 0;
  const cantDecrement = currentValue <= 0;
  const cantIncrement = currentValue >= maxValue;

  return (
    <div
      className="furniture-card"
      onClick={onSelect}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: "var(--surface)",
        border: `1px solid ${selected ? f.color : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
      }}
    >
      {/* Barra lateral del color del mueble */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: 4,
          background: f.color,
          borderTopLeftRadius: "var(--radius-md)",
          borderBottomLeftRadius: "var(--radius-md)",
        }}
      />

      {/* Caja icono */}
      <div style={{
        width: 40, height: 40,
        background: "var(--bg-subtle)",
        borderRadius: "var(--radius-sm)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-secondary)",
        flexShrink: 0,
        marginLeft: 4, // separación visual de la barra lateral
      }}>
        <Box size={18} />
      </div>

      {/* Nombre + dimensiones */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            minWidth: 0,
          }}>
            {f.name}
          </span>
          {isComplete && (
            <Check
              size={14}
              style={{ color: "var(--success)", flexShrink: 0 }}
              aria-label="Completo"
            />
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
          {f.ancho} × {f.alto} × {f.fondo} cm
        </div>
      </div>

      {/* Stepper integrado */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="stepper-btn"
          onMouseDown={e => { e.stopPropagation(); decHold.start(); }}
          onMouseUp={decHold.stop}
          onMouseLeave={decHold.stop}
          onTouchStart={e => { e.stopPropagation(); decHold.start(); }}
          onTouchEnd={decHold.stop}
          disabled={cantDecrement}
          aria-label="Menos"
        >
          <Minus size={14} />
        </button>

        <div style={{
          background: "var(--bg-subtle)",
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
          padding: "8px 12px",
          minWidth: 60,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <input
            type="number"
            className="stepper-input"
            value={currentValue}
            min={0}
            max={maxValue}
            onChange={e => {
              const raw = e.target.value;
              const n = raw === "" ? 0 : Math.max(0, Math.min(maxValue, parseInt(raw, 10) || 0));
              onSetCount(n);
            }}
            onClick={e => e.stopPropagation()}
            onFocus={e => e.target.select()}
            aria-label={editMode ? "Inventario" : "Cargadas"}
            style={{
              width: 36,
              border: "none", background: "transparent", outline: "none",
              padding: 0, margin: 0,
              textAlign: "center",
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFeatureSettings: "'tnum'",
              fontSize: 14,
            }}
          />
          {!editMode && (
            <span style={{ color: "var(--text-tertiary)", fontWeight: 500, fontSize: 14 }}>
              /{f.inv}
            </span>
          )}
        </div>

        <button
          type="button"
          className="stepper-btn"
          onMouseDown={e => { e.stopPropagation(); incHold.start(); }}
          onMouseUp={incHold.stop}
          onMouseLeave={incHold.stop}
          onTouchStart={e => { e.stopPropagation(); incHold.start(); }}
          onTouchEnd={incHold.stop}
          disabled={cantIncrement}
          aria-label="Más"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Edit (lápiz) */}
      <button
        type="button"
        className="icon-btn"
        onClick={e => { e.stopPropagation(); onEdit(); }}
        title="Editar mueble"
        aria-label="Editar mueble"
        style={{ width: 32, height: 32, flexShrink: 0 }}
      >
        <Edit2 size={14} />
      </button>
    </div>
  );
}
