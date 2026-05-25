import { useState } from 'react';
import Modal from './Modal.jsx';
import PromptModal from './PromptModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { alpha } from '../styles/util.js';
import { FolderOpen, Edit2, Trash2, Plus, Save, Check } from 'lucide-react';
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
  borderRadius: "var(--radius-sm)",
  border: `1px solid var(--border)`,
  background: "var(--bg-subtle)",
  cursor: "pointer",
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
  // Sub-modales: prompt para crear/snapshot/rename, confirm para borrar.
  const [promptState, setPromptState] = useState(null); // { kind, invId? }
  const [confirmDeleteInv, setConfirmDeleteInv] = useState(null);

  // Hace activo un inventario tanto en React state como en localStorage.
  const activate = (id) => {
    persistActiveId(id);
    setActiveInventoryIdState(id);
  };

  // Detecta nombre duplicado (case-insensitive, ignora un inv específico).
  const isDuplicateName = (name, ignoreId = null) =>
    inventories.some(x => x.id !== ignoreId && x.name.toLowerCase() === name.toLowerCase());

  const handleLoad = (id) => {
    if (id === activeInventoryId) return;
    const inv = inventories.find(x => x.id === id);
    if (!inv) return;
    activate(id);
    setItems(inv.items.map(it => ({ ...it, load: 0 })));
    setPlaced([]);
    onClose();
  };

  const submitPrompt = (value) => {
    if (!promptState) return;
    if (promptState.kind === 'createEmpty') {
      const inv = createInventory(value, []);
      setInventories(loadInventories());
      activate(inv.id);
      setItems([]);
      setPlaced([]);
      setPromptState(null);
      onClose();
    } else if (promptState.kind === 'saveAsNew') {
      createInventory(value, stripLoad(items));
      setInventories(loadInventories());
      setPromptState(null);
    } else if (promptState.kind === 'rename') {
      updateInventory(promptState.invId, { name: value });
      setInventories(loadInventories());
      setPromptState(null);
    }
  };

  const handleOverwriteActive = () => {
    if (!activeInventoryId) return;
    updateInventory(activeInventoryId, { items: stripLoad(items) });
    setInventories(loadInventories());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const confirmDelete = () => {
    if (!confirmDeleteInv) return;
    const id = confirmDeleteInv.id;
    deleteInventory(id);
    const remaining = loadInventories();
    setInventories(remaining);
    if (id === activeInventoryId && remaining.length > 0) {
      const next = remaining[0];
      activate(next.id);
      setItems(next.items.map(it => ({ ...it, load: 0 })));
      setPlaced([]);
    }
    setConfirmDeleteInv(null);
  };

  // Configuración del PromptModal según el kind activo.
  const promptConfig = (() => {
    if (!promptState) return null;
    if (promptState.kind === 'createEmpty') return {
      title: 'Nuevo inventario',
      label: 'Nombre del nuevo inventario',
      description: 'Arranca vacío — vas a agregar muebles después en el Paso 3.',
      placeholder: 'Ej. Mudanza Hampton',
      submitLabel: 'Crear',
      initialValue: '',
      validate: (v) => !v ? 'No puede estar vacío' : isDuplicateName(v) ? 'Ya existe un inventario con ese nombre' : null,
    };
    if (promptState.kind === 'saveAsNew') return {
      title: 'Guardar como nuevo',
      label: 'Nombre del snapshot',
      description: 'Guarda el inventario actual como uno nuevo, sin activarlo.',
      placeholder: 'Ej. Backup pre-cambios',
      submitLabel: 'Guardar',
      initialValue: '',
      validate: (v) => !v ? 'No puede estar vacío' : isDuplicateName(v) ? 'Ya existe un inventario con ese nombre' : null,
    };
    if (promptState.kind === 'rename') {
      const inv = inventories.find(x => x.id === promptState.invId);
      return {
        title: 'Renombrar inventario',
        label: 'Nuevo nombre',
        description: null,
        placeholder: '',
        submitLabel: 'Guardar',
        initialValue: inv?.name || '',
        validate: (v) => !v ? 'No puede estar vacío' : isDuplicateName(v, promptState.invId) ? 'Ya existe un inventario con ese nombre' : null,
      };
    }
    return null;
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span style={{display:'inline-flex',alignItems:'center',gap:6}}><FolderOpen size={16}/>Mis inventarios</span>}
      titleColor={"var(--primary)"}
      accentColor={alpha('--primary', 27)}
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
                padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)",
                border: `1px solid ${isActive ? alpha('--success', 27) : 'var(--border)'}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                  {isActive && <Check size={14} style={{ color: "var(--success)" }} aria-label="Activo" />}
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.name}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                  {inv.items.length} {inv.items.length === 1 ? "tipo de mueble" : "tipos de muebles"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handleLoad(inv.id)}
                  disabled={isActive}
                  style={{ ...btn, color: isActive ? "var(--text-secondary)" : "var(--primary)", opacity: isActive ? 0.4 : 1, cursor: isActive ? "default" : "pointer" }}
                >
                  Cargar
                </button>
                <button onClick={() => setPromptState({ kind: 'rename', invId: inv.id })} title="Renombrar" aria-label="Renombrar" style={{ ...btn, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center" }}><Edit2 size={12}/></button>
                <button
                  onClick={() => setConfirmDeleteInv(inv)}
                  disabled={inventories.length <= 1}
                  title={inventories.length <= 1 ? "No puedes borrar el único" : "Borrar"}
                  style={{ ...btn, color: "var(--error)", opacity: inventories.length <= 1 ? 0.3 : 1, cursor: inventories.length <= 1 ? "default" : "pointer" }}
                >
                  <Trash2 size={12}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => setPromptState({ kind: 'createEmpty' })} style={{ ...btnFull, color: "var(--success)", borderColor: alpha('--success', 27) }}>
          <Plus size={14} style={{marginRight:6,verticalAlign:'-2px'}}/>Crear inventario nuevo (vacío)
        </button>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", padding: "0 4px", marginTop: -2, lineHeight: 1.4 }}>
          Arranca sin muebles; los agregas después en el Paso 3.
        </div>
        <button onClick={() => setPromptState({ kind: 'saveAsNew' })} style={{ ...btnFull, color: "var(--primary)", borderColor: alpha('--primary', 27) }}>
          <Save size={14} style={{marginRight:6,verticalAlign:'-2px'}}/>Guardar inventario actual como nuevo
        </button>
        <button
          onClick={handleOverwriteActive}
          disabled={!activeInventoryId}
          style={{
            ...btnFull,
            color: savedFlash ? "var(--success)" : "var(--warning)",
            borderColor: savedFlash ? alpha('--success', 27) : alpha('--warning', 27),
          }}
        >
          {savedFlash
            ? <><Check size={14} style={{marginRight:6,verticalAlign:'-2px'}}/>Guardado</>
            : <><Save size={14} style={{marginRight:6,verticalAlign:'-2px'}}/>Sobrescribir activo</>}
        </button>
      </div>

      <button onClick={onClose} style={{ ...btnFull, color: "var(--text-secondary)", marginTop: 10 }}>
        Cerrar
      </button>

      {/* Sub-modal: PromptModal (crear vacío / snapshot / renombrar) */}
      {promptConfig && (
        <PromptModal
          open
          title={promptConfig.title}
          label={promptConfig.label}
          description={promptConfig.description}
          placeholder={promptConfig.placeholder}
          initialValue={promptConfig.initialValue}
          submitLabel={promptConfig.submitLabel}
          validate={promptConfig.validate}
          onSubmit={submitPrompt}
          onCancel={() => setPromptState(null)}
        />
      )}

      {/* Sub-modal: ConfirmModal (borrar inventario) */}
      <ConfirmModal
        open={!!confirmDeleteInv}
        variant="danger"
        title="Borrar inventario"
        message={confirmDeleteInv ? `¿Borrar "${confirmDeleteInv.name}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteInv(null)}
      />
    </Modal>
  );
}
