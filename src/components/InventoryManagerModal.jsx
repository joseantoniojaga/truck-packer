import { useState } from 'react';
import Modal from './Modal.jsx';
import { COLORS } from '../constants.js';
import {
  loadInventories,
  setActiveInventoryId as persistActiveId,
  createInventory,
  updateInventory,
  deleteInventory,
} from '../inventoryStorage.js';

// Quita el campo `load` de cada item (estado de sesión, no se persiste).
const stripLoad = (arr) => arr.map(({ load, ...rest }) => rest);

const btn = {
  borderRadius: 5,
  border: `1px solid ${COLORS.border}`,
  background: "#0F172A",
  cursor: "pointer",
  fontFamily: "DM Sans",
  fontWeight: 600,
  padding: "4px 8px",
  fontSize: 10,
};

const btnFull = { ...btn, padding: "8px", fontSize: 11, width: "100%" };

export default function InventoryManagerModal({
  open, onClose,
  inventories, setInventories,
  activeInventoryId, setActiveInventoryIdState,
  items, setItems, setPlaced,
}) {
  const [savedFlash, setSavedFlash] = useState(false);

  // Hace activo un inventario tanto en React state como en localStorage.
  const activate = (id) => {
    persistActiveId(id);
    setActiveInventoryIdState(id);
  };

  const handleLoad = (id) => {
    if (id === activeInventoryId) return;
    const inv = inventories.find(x => x.id === id);
    if (!inv) return;
    activate(id);
    setItems(inv.items.map(it => ({ ...it, load: 0 })));
    setPlaced([]);
    onClose();
  };

  const handleCreateEmpty = () => {
    const name = window.prompt('Nombre del nuevo inventario:\n(arranca vacío — vas a agregar muebles después en el Paso 3)');
    if (!name || !name.trim()) return;
    const inv = createInventory(name.trim(), []);
    setInventories(loadInventories());
    activate(inv.id);
    setItems([]);
    setPlaced([]);
    onClose();
  };

  const handleSaveAsNew = () => {
    const name = window.prompt('Nombre del snapshot:\n(guarda el inventario actual como uno nuevo, sin activarlo)');
    if (!name || !name.trim()) return;
    createInventory(name.trim(), stripLoad(items));
    setInventories(loadInventories());
  };

  const handleOverwriteActive = () => {
    if (!activeInventoryId) return;
    updateInventory(activeInventoryId, { items: stripLoad(items) });
    setInventories(loadInventories());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleRename = (id) => {
    const inv = inventories.find(x => x.id === id);
    if (!inv) return;
    const newName = window.prompt('Nuevo nombre:', inv.name);
    if (!newName || !newName.trim() || newName.trim() === inv.name) return;
    updateInventory(id, { name: newName.trim() });
    setInventories(loadInventories());
  };

  const handleDelete = (id) => {
    if (inventories.length <= 1) {
      window.alert('No puedes borrar el único inventario.');
      return;
    }
    const inv = inventories.find(x => x.id === id);
    if (!inv) return;
    if (!window.confirm(`¿Borrar "${inv.name}"? Esta acción no se puede deshacer.`)) return;
    deleteInventory(id);
    const remaining = loadInventories();
    setInventories(remaining);
    if (id === activeInventoryId && remaining.length > 0) {
      const next = remaining[0];
      activate(next.id);
      setItems(next.items.map(it => ({ ...it, load: 0 })));
      setPlaced([]);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🗂️ Mis inventarios"
      titleColor={COLORS.cyan}
      accentColor={COLORS.cyan + "44"}
      maxWidth={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 280, overflowY: "auto" }}>
        {inventories.map(inv => {
          const isActive = inv.id === activeInventoryId;
          return (
            <div
              key={inv.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", background: "#0F172A", borderRadius: 6,
                border: `1px solid ${isActive ? COLORS.green + "44" : COLORS.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
                  {isActive && <span style={{ color: COLORS.green }}>✓</span>}
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.name}</span>
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
                  {inv.items.length} {inv.items.length === 1 ? "tipo de mueble" : "tipos de muebles"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handleLoad(inv.id)}
                  disabled={isActive}
                  style={{ ...btn, color: isActive ? COLORS.muted : COLORS.cyan, opacity: isActive ? 0.4 : 1, cursor: isActive ? "default" : "pointer" }}
                >
                  Cargar
                </button>
                <button onClick={() => handleRename(inv.id)} title="Renombrar" style={{ ...btn, color: COLORS.muted }}>✏️</button>
                <button
                  onClick={() => handleDelete(inv.id)}
                  disabled={inventories.length <= 1}
                  title={inventories.length <= 1 ? "No puedes borrar el único" : "Borrar"}
                  style={{ ...btn, color: COLORS.red, opacity: inventories.length <= 1 ? 0.3 : 1, cursor: inventories.length <= 1 ? "default" : "pointer" }}
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={handleCreateEmpty} style={{ ...btnFull, color: COLORS.green, borderColor: COLORS.green + "44" }}>
          ➕ Crear inventario nuevo (vacío)
        </button>
        <div style={{ fontSize: 10, color: COLORS.muted, padding: "0 4px", marginTop: -2, lineHeight: 1.4 }}>
          Arranca sin muebles; los agregas después en el Paso 3.
        </div>
        <button onClick={handleSaveAsNew} style={{ ...btnFull, color: COLORS.cyan, borderColor: COLORS.cyan + "44" }}>
          💾 Guardar inventario actual como nuevo
        </button>
        <button
          onClick={handleOverwriteActive}
          disabled={!activeInventoryId}
          style={{
            ...btnFull,
            color: savedFlash ? COLORS.green : COLORS.amber,
            borderColor: (savedFlash ? COLORS.green : COLORS.amber) + "44",
          }}
        >
          {savedFlash ? "✓ Guardado" : "💾 Sobrescribir activo"}
        </button>
      </div>

      <button onClick={onClose} style={{ ...btnFull, color: COLORS.muted, marginTop: 10 }}>
        Cerrar
      </button>
    </Modal>
  );
}
