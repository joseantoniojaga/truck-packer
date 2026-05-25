import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import { alpha } from '../styles/util.js';
import { Edit2, Trash2, Plus } from 'lucide-react';

// Paleta sugerida (botones rápidos debajo del color picker).
const PALETTE = [
  "#E07A5F", "#7B9ACC", "#81B29A", "#F2CC8F",
  "#6A994E", "#A7C957", "#BC4749", "#9B5DE5",
  "#0F4C5C", "#06B6D4", "#F59E0B", "#A78BFA",
];

const inputStyle = {
  fontSize: 12, padding: "6px 8px",
  background: "var(--bg-subtle)", border: `1px solid var(--border)`,
  borderRadius: "var(--radius-sm)", color: "var(--text-primary)", outline: "none", width: "100%",
  boxSizing: "border-box",
};

const labelStyle = { fontSize: 10, color: "var(--text-secondary)", marginBottom: 3, display: "block" };
const errorStyle = { fontSize: 10, color: "var(--error)", marginTop: 3 };

const baseBtn = {
  borderRadius: "var(--radius-sm)", border: `1px solid var(--border)`, background: "var(--bg-subtle)",
  cursor: "pointer", fontWeight: 600,
  padding: "8px 12px", fontSize: 11,
};

export default function FurnitureEditorModal({
  open, onClose, onSave, onDelete,
  initialFurniture, existingFurniture = [], trailerVolume,
  hidden = false,
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

  const TitleIcon = isEdit ? Edit2 : Plus;
  const titleText = isEdit ? 'Editar mueble' : 'Nuevo mueble';

  return (
    <Modal
      open={open} onClose={onClose}
      title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><TitleIcon size={20}/>{titleText}</span>}
      titleColor={"var(--primary)"} accentColor={alpha('--primary', 27)}
      maxWidth={500}
      hidden={hidden}
    >
      {isEdit && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", marginBottom: 16, lineHeight: 1.4 }}>
          Si cambias las dimensiones, los muebles ya colocados de este tipo NO se actualizarán automáticamente. Reorganiza la carga después.
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Nombre</label>
        <input
          type="text" value={name} maxLength={40}
          onChange={e => setName(e.target.value)}
          placeholder="Ej. Silla de comedor"
          style={inputStyle}
        />
        {errors.name && <div style={errorStyle}>{errors.name}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
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

      {errors.volume && <div style={{ ...errorStyle, marginTop: -8, marginBottom: 12 }}>{errors.volume}</div>}

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Inventario inicial</label>
        <input type="number" min={0} max={999} step={1} value={inv}
               onChange={e => setInv(e.target.value)} style={inputStyle} />
        {errors.inv && <div style={errorStyle}>{errors.inv}</div>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <label style={{ ...labelStyle, margin: 0 }}>Color</label>
          {/* Círculo grande mostrando el color seleccionado (sin hex visible) */}
          <div
            aria-hidden
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: color,
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
              flexShrink: 0,
            }}
          />
          {/* Color picker oculto detrás de un pequeño botón */}
          <input
            type="color" value={color}
            onChange={e => setColor(e.target.value)}
            aria-label="Personalizado"
            title="Personalizado"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--border)", background: "transparent",
              cursor: "pointer", padding: 0,
            }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {PALETTE.map(c => {
            const isSelected = color.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c} type="button" onClick={() => setColor(c)}
                aria-label={`Color ${c}`} title={c}
                className="color-swatch"
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  padding: 0, cursor: "pointer", background: c,
                  border: "1px solid var(--border)",
                  outline: isSelected ? "3px solid var(--text-primary)" : "none",
                  outlineOffset: 2,
                  transition: "transform 150ms ease",
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        {isEdit && onDelete && (
          <button onClick={handleDelete}
                  className="action-btn"
                  style={{ background: "transparent", color: "var(--error)", border: `1px solid ${alpha('--error', 27)}`, fontSize: "var(--text-sm)", padding: "8px 14px" }}>
            <Trash2 size={14}/>Borrar mueble
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose}
                className="action-btn action-btn--secondary"
                style={{ padding: "8px 14px", fontSize: "var(--text-sm)" }}>
          Cancelar
        </button>
        <button
          onClick={handleSave} disabled={!isValid}
          className="action-btn action-btn--primary"
          style={{ padding: "8px 14px", fontSize: "var(--text-sm)" }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
