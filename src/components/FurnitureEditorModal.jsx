import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import { COLORS } from '../constants.js';

// Paleta sugerida (botones rápidos debajo del color picker).
const PALETTE = [
  "#E07A5F", "#7B9ACC", "#81B29A", "#F2CC8F",
  "#6A994E", "#A7C957", "#BC4749", "#9B5DE5",
  "#0F4C5C", "#06B6D4", "#F59E0B", "#A78BFA",
];

const inputStyle = {
  fontFamily: "JetBrains Mono", fontSize: 12, padding: "6px 8px",
  background: "#0F172A", border: `1px solid ${COLORS.border}`,
  borderRadius: 4, color: COLORS.text, outline: "none", width: "100%",
  boxSizing: "border-box",
};

const labelStyle = { fontSize: 10, color: COLORS.muted, marginBottom: 3, display: "block" };
const errorStyle = { fontSize: 10, color: COLORS.red, marginTop: 3 };

const baseBtn = {
  borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "#0F172A",
  cursor: "pointer", fontFamily: "DM Sans", fontWeight: 600,
  padding: "8px 12px", fontSize: 11,
};

export default function FurnitureEditorModal({
  open, onClose, onSave, onDelete,
  initialFurniture, existingFurniture = [], trailerVolume,
}) {
  const isEdit = !!initialFurniture;

  const [name, setName] = useState('');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [fondo, setFondo] = useState('');
  const [inv, setInv] = useState('');
  const [color, setColor] = useState(PALETTE[0]);

  // Reset form cada vez que el modal abre o cambia el mueble inicial
  useEffect(() => {
    if (!open) return;
    if (initialFurniture) {
      setName(initialFurniture.name || '');
      setAncho(String(initialFurniture.ancho));
      setAlto(String(initialFurniture.alto));
      setFondo(String(initialFurniture.fondo));
      setInv(String(initialFurniture.inv));
      setColor(initialFurniture.color || PALETTE[0]);
    } else {
      setName('');
      setAncho('50');
      setAlto('50');
      setFondo('50');
      setInv('1');
      setColor(PALETTE[0]);
    }
  }, [open, initialFurniture]);

  // --- Validación ---
  const trimmed = name.trim();
  const pa = parseFloat(ancho);
  const pH = parseFloat(alto);
  const pF = parseFloat(fondo);
  const pI = parseInt(inv, 10);

  const errors = {};
  if (!trimmed) errors.name = "Nombre requerido";
  else if (trimmed.length > 40) errors.name = "Máximo 40 caracteres";
  else {
    const lc = trimmed.toLowerCase();
    const dup = existingFurniture.some(f =>
      f.name.toLowerCase() === lc && (!isEdit || f.id !== initialFurniture.id)
    );
    if (dup) errors.name = "Ya existe un mueble con este nombre";
  }

  if (ancho === '' || isNaN(pa) || pa <= 0) errors.ancho = "Debe ser mayor a 0";
  else if (pa > 500) errors.ancho = "Máximo 500 cm";

  if (alto === '' || isNaN(pH) || pH <= 0) errors.alto = "Debe ser mayor a 0";
  else if (pH > 500) errors.alto = "Máximo 500 cm";

  if (fondo === '' || isNaN(pF) || pF <= 0) errors.fondo = "Debe ser mayor a 0";
  else if (pF > 500) errors.fondo = "Máximo 500 cm";

  if (inv === '' || isNaN(pI) || pI < 0) errors.inv = "Debe ser ≥ 0";
  else if (pI > 999) errors.inv = "Máximo 999";

  if (!errors.ancho && !errors.alto && !errors.fondo) {
    const vol = pa * pH * pF;
    if (trailerVolume && vol > trailerVolume) errors.volume = "Este mueble no cabe en el tráiler";
  }

  const isValid = Object.keys(errors).length === 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      id: isEdit ? initialFurniture.id : (Date.now().toString() + '-' + Math.random().toString(36).slice(2, 6)),
      name: trimmed,
      color,
      ancho: pa,
      alto: pH,
      fondo: pF,
      inv: pI,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!isEdit) return;
    // El padre maneja confirm + state cleanup + cierre del modal
    onDelete(initialFurniture);
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? "✏️ Editar mueble" : "➕ Nuevo mueble"}
      titleColor={COLORS.cyan} accentColor={COLORS.cyan + "44"}
      maxWidth={380}
    >
      {isEdit && (
        <div style={{ fontSize: 10, color: COLORS.muted, padding: "6px 8px", background: "#0F172A", borderRadius: 4, marginBottom: 10, lineHeight: 1.4 }}>
          Si cambias las dimensiones, los muebles ya colocados de este tipo NO se actualizarán automáticamente. Reorganiza la carga después.
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Nombre</label>
        <input
          type="text" value={name} maxLength={40}
          onChange={e => setName(e.target.value)}
          placeholder="Ej. Silla de comedor"
          style={inputStyle}
        />
        {errors.name && <div style={errorStyle}>{errors.name}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Ancho (cm)</label>
          <input type="number" min={1} max={500} step={0.5} value={ancho}
                 onChange={e => setAncho(e.target.value)} style={inputStyle} />
          {errors.ancho && <div style={errorStyle}>{errors.ancho}</div>}
        </div>
        <div>
          <label style={labelStyle}>Alto (cm)</label>
          <input type="number" min={1} max={500} step={0.5} value={alto}
                 onChange={e => setAlto(e.target.value)} style={inputStyle} />
          {errors.alto && <div style={errorStyle}>{errors.alto}</div>}
        </div>
        <div>
          <label style={labelStyle}>Fondo (cm)</label>
          <input type="number" min={1} max={500} step={0.5} value={fondo}
                 onChange={e => setFondo(e.target.value)} style={inputStyle} />
          {errors.fondo && <div style={errorStyle}>{errors.fondo}</div>}
        </div>
      </div>

      {errors.volume && <div style={{ ...errorStyle, marginTop: -4, marginBottom: 8 }}>{errors.volume}</div>}

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Inventario inicial</label>
        <input type="number" min={0} max={999} step={1} value={inv}
               onChange={e => setInv(e.target.value)} style={inputStyle} />
        {errors.inv && <div style={errorStyle}>{errors.inv}</div>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Color</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <input
            type="color" value={color}
            onChange={e => setColor(e.target.value)}
            style={{ width: 40, height: 30, border: `1px solid ${COLORS.border}`, borderRadius: 4, background: "transparent", cursor: "pointer", padding: 2 }}
          />
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.muted }}>{color}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
          {PALETTE.map(c => (
            <button
              key={c} type="button" onClick={() => setColor(c)} title={c}
              style={{
                height: 22, borderRadius: 4, padding: 0, cursor: "pointer", background: c,
                border: color.toLowerCase() === c.toLowerCase()
                  ? `2px solid ${COLORS.text}`
                  : `1px solid ${COLORS.border}`,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        {isEdit && onDelete && (
          <button onClick={handleDelete}
                  style={{ ...baseBtn, color: COLORS.red, borderColor: COLORS.red + "44", fontSize: 10, padding: "6px 10px" }}>
            🗑️ Borrar mueble
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...baseBtn, color: COLORS.muted }}>Cancelar</button>
        <button
          onClick={handleSave} disabled={!isValid}
          style={{
            ...baseBtn,
            color: isValid ? COLORS.green : COLORS.muted,
            borderColor: isValid ? COLORS.green + "44" : COLORS.border,
            opacity: isValid ? 1 : 0.5,
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
