import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import TrailerPreview from './TrailerPreview.jsx';
import { alpha } from '../styles/util.js';
import { Truck, RotateCcw } from 'lucide-react';

// Defaults — el tráiler que viene con la app desde el inicio.
const DEFAULT_TRAILER = { largo: 1615.4, ancho: 247, alto: 280, placas: "49-UT-7V" };

// Rango válido por dimensión, en cm. 0.5 m a 50 m.
const MIN_CM = 50;
const MAX_CM = 5000;

const inputStyle = {
  fontSize: "var(--text-md)", padding: "8px 10px",
  background: "var(--bg-subtle)", border: `1px solid var(--border)`,
  borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none", width: "100%",
  boxSizing: "border-box", fontVariantNumeric: "tabular-nums",
};
const labelStyle = { fontSize: "var(--text-base)", color: "var(--text-secondary)", marginBottom: 6, display: "block" };
const errorStyle = { fontSize: "var(--text-xs)", color: "var(--error)", marginTop: 4 };

// Conversores. Mantenemos cm como unidad interna canónica; las cadenas en
// el form se interpretan según `unit` activo.
function toCm(strValue, unit) {
  const n = parseFloat(strValue);
  if (!isFinite(n)) return NaN;
  return unit === 'm' ? n * 100 : n;
}
function fromCm(cm, unit) {
  if (!isFinite(cm)) return '';
  return unit === 'm' ? (cm / 100).toFixed(2) : String(Math.round(cm));
}

// Heurística de unidad inicial: si todas las dims son >= 100 cm, mostrar en
// metros (más natural para un tráiler real). Si hay alguna < 100 cm (raro,
// mueble pequeño o test), mostrar en cm.
function pickInitialUnit(trailer) {
  return (trailer.largo >= 100 && trailer.ancho >= 100 && trailer.alto >= 100) ? 'm' : 'cm';
}

export default function TrailerEditorModal({
  open, trailer, hasPlacedItems = false,
  onSave, onCancel,
}) {
  const [unit, setUnit] = useState('m');
  const [placas, setPlacas] = useState('');
  const [largo, setLargo] = useState('');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');

  // Reset cada vez que el modal abre — toma los valores actuales del tráiler
  // como punto de partida.
  useEffect(() => {
    if (!open || !trailer) return;
    const u = pickInitialUnit(trailer);
    setUnit(u);
    setPlacas(trailer.placas || '');
    setLargo(fromCm(trailer.largo, u));
    setAncho(fromCm(trailer.ancho, u));
    setAlto(fromCm(trailer.alto, u));
  }, [open, trailer]);

  // Cambia la unidad y CONVIERTE los valores actuales (no resetea — el
  // usuario podría haber escrito algo que no vale la pena perder).
  const switchUnit = (newUnit) => {
    if (newUnit === unit) return;
    setLargo(fromCm(toCm(largo, unit), newUnit));
    setAncho(fromCm(toCm(ancho, unit), newUnit));
    setAlto(fromCm(toCm(alto, unit), newUnit));
    setUnit(newUnit);
  };

  // Validación por dimensión, en cm.
  const largoCm = toCm(largo, unit);
  const anchoCm = toCm(ancho, unit);
  const altoCm = toCm(alto, unit);

  const errors = {};
  const checkDim = (cm, key) => {
    if (!isFinite(cm) || cm < MIN_CM || cm > MAX_CM) errors[key] = 'Entre 0.5 m y 50 m';
  };
  checkDim(largoCm, 'largo');
  checkDim(anchoCm, 'ancho');
  checkDim(altoCm, 'alto');
  const isValid = Object.keys(errors).length === 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      largo: largoCm,
      ancho: anchoCm,
      alto: altoCm,
      placas: placas.trim(),
    });
  };

  const handleRestore = () => {
    setUnit('m');
    setPlacas(DEFAULT_TRAILER.placas);
    setLargo(fromCm(DEFAULT_TRAILER.largo, 'm'));
    setAncho(fromCm(DEFAULT_TRAILER.ancho, 'm'));
    setAlto(fromCm(DEFAULT_TRAILER.alto, 'm'));
  };

  const unitLabel = unit === 'm' ? 'm' : 'cm';
  const step = unit === 'm' ? '0.01' : '1';

  // Para el preview en vivo, intentamos parsear lo que hay en el form en
  // cm. Si algo es NaN o fuera de rango, mantenemos las dims actuales del
  // tráiler para que el SVG no colapse.
  const previewL = isFinite(largoCm) && largoCm > 0 ? largoCm : trailer?.largo;
  const previewW = isFinite(anchoCm) && anchoCm > 0 ? anchoCm : trailer?.ancho;
  const previewH = isFinite(altoCm) && altoCm > 0 ? altoCm : trailer?.alto;

  // Segmented control (m/cm). Mismo patrón visual que Libre/Fondo→Frente.
  const segBtn = (val, label) => {
    const active = unit === val;
    return (
      <button
        type="button"
        onClick={() => switchUnit(val)}
        style={{
          flex: 1, padding: "7px 0",
          fontSize: "var(--text-sm)", fontWeight: 600,
          color: active ? "var(--bg-base)" : "var(--text-secondary)",
          background: active ? "var(--primary)" : "var(--bg-subtle)",
          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          transition: "background-color 120ms ease",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><Truck size={20}/>Editar tráiler</span>}
      titleColor={"var(--primary)"}
      accentColor={alpha('--primary', 27)}
      maxWidth={640}
      showClose
    >
      {/* Banner informativo — solo si hay carga. Reduce confusión cuando se
          cambia el tamaño con muebles ya colocados. */}
      {hasPlacedItems && (
        <div style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-secondary)",
          padding: "10px 12px",
          background: alpha('--info', 13),
          border: `1px solid ${alpha('--info', 40)}`,
          borderRadius: "var(--radius-sm)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}>
          Si reduces alguna dimensión del tráiler, la carga actual se vaciará.
          Si solo lo agrandas, la carga se mantiene.
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 240px",
        gap: 24,
        alignItems: "start",
      }}>
        {/* COLUMNA IZQUIERDA — form */}
        <div>
          {/* Placa (opcional) */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Placa (opcional)</label>
            <input
              type="text"
              value={placas}
              maxLength={20}
              onChange={e => setPlacas(e.target.value)}
              placeholder="ej. 49-UT-7V"
              style={inputStyle}
            />
          </div>

          {/* Toggle de unidades */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Unidades</label>
            <div style={{ display: "flex", gap: 6 }}>
              {segBtn('m', 'm')}
              {segBtn('cm', 'cm')}
            </div>
          </div>

          {/* 3 inputs: Largo / Ancho / Alto */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Largo ({unitLabel})</label>
              <input
                type="number" min={0} step={step} value={largo}
                onChange={e => setLargo(e.target.value)}
                style={inputStyle}
              />
              {errors.largo && <div style={errorStyle}>{errors.largo}</div>}
            </div>
            <div>
              <label style={labelStyle}>Ancho ({unitLabel})</label>
              <input
                type="number" min={0} step={step} value={ancho}
                onChange={e => setAncho(e.target.value)}
                style={inputStyle}
              />
              {errors.ancho && <div style={errorStyle}>{errors.ancho}</div>}
            </div>
            <div>
              <label style={labelStyle}>Alto ({unitLabel})</label>
              <input
                type="number" min={0} step={step} value={alto}
                onChange={e => setAlto(e.target.value)}
                style={inputStyle}
              />
              {errors.alto && <div style={errorStyle}>{errors.alto}</div>}
            </div>
          </div>

          {/* Restaurar default */}
          <button
            type="button"
            onClick={handleRestore}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 12px",
              fontSize: "var(--text-sm)", fontWeight: 600,
              color: "var(--text-tertiary)",
              background: "transparent",
              border: `1px solid var(--border)`,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              transition: "background-color 120ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-subtle)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <RotateCcw size={16}/>Restaurar default
          </button>
        </div>

        {/* COLUMNA DERECHA — preview SVG */}
        <div style={{
          background: "var(--bg-subtle)",
          border: `1px solid var(--border)`,
          borderRadius: "var(--radius-md)",
          padding: 12,
          position: "sticky", top: 0,
        }}>
          <TrailerPreview largo={previewL} ancho={previewW} alto={previewH}/>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
        <button
          onClick={onCancel}
          className="action-btn action-btn--secondary"
          style={{ padding: "8px 14px", fontSize: "var(--text-sm)" }}
        >
          Cancelar
        </button>
        <div style={{ flex: 1 }}/>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="action-btn action-btn--primary"
          style={{ padding: "8px 14px", fontSize: "var(--text-sm)" }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
