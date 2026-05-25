import { useState } from 'react';
import { createPortal } from 'react-dom';
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
  fontSize: "var(--text-xs)",
};

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
      description: null,
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

  // Cuando hay un sub-modal abierto, ocultar el padre para no superponer
  // contenido. Los sub-modales se portalean a document.body para que la
  // ocultación del padre no los afecte.
  const hasChildModal = promptConfig !== null || !!confirmDeleteInv;

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><FolderOpen size={20}/>Mis inventarios</span>}
      titleColor={"var(--primary)"}
      accentColor={alpha('--primary', 27)}
      maxWidth={420}
      hidden={hasChildModal}
      showClose
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14, maxHeight: 320, overflowY: "auto" }}>
        {inventories.map(inv => {
          const isActive = inv.id === activeInventoryId;
          const totalUnits = inv.items.reduce((s, it) => s + (it.inv || 0), 0);
          return (
            <div
              key={inv.id}
              onClick={!isActive ? () => handleLoad(inv.id) : undefined}
              className={isActive ? undefined : "inv-card"}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                background: isActive ? alpha('--success', 13) : "var(--surface)",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${isActive ? alpha('--success', 27) : 'var(--border)'}`,
                cursor: isActive ? "default" : "pointer",
                transition: "background-color 150ms ease, box-shadow 150ms ease",
              }}
            >
              {isActive && (
                <Check size={16} style={{ color: "var(--success)", flexShrink: 0 }} aria-label="Activo" />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {inv.name}
                </div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 2, fontFeatureSettings: "'tnum'" }}>
                  {inv.items.length} {inv.items.length === 1 ? "tipo" : "tipos"} · {totalUnits} {totalUnits === 1 ? "mueble" : "muebles"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                {!isActive && (
                  <button
                    onClick={() => handleLoad(inv.id)}
                    style={{ ...btn, color: "var(--primary)" }}
                  >
                    Cargar
                  </button>
                )}
                <button
                  onClick={() => setPromptState({ kind: 'rename', invId: inv.id })}
                  title="Renombrar" aria-label="Renombrar"
                  style={{ ...btn, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center" }}
                >
                  <Edit2 size={14}/>
                </button>
                <button
                  onClick={() => setConfirmDeleteInv(inv)}
                  disabled={inventories.length <= 1}
                  title={inventories.length <= 1 ? "No puedes borrar el único" : "Borrar"}
                  style={{ ...btn, color: "var(--error)", opacity: inventories.length <= 1 ? 0.3 : 1, cursor: inventories.length <= 1 ? "default" : "pointer", display: "inline-flex", alignItems: "center" }}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: acciones globales en fila, separadas por border-top.
          "Sobrescribir" va al final con un divider visual (acción destructiva,
          se separa del flujo principal "Crear" / "Guardar como"). */}
      <div style={{
        display: "flex", gap: 6, paddingTop: 14,
        borderTop: "1px solid var(--border)",
        alignItems: "center",
      }}>
        <button
          onClick={() => setPromptState({ kind: 'createEmpty' })}
          className="inv-footer-btn"
          style={{ color: "var(--success)" }}
        >
          <Plus/><span>Crear vacío</span>
        </button>
        <button
          onClick={() => setPromptState({ kind: 'saveAsNew' })}
          className="inv-footer-btn"
          style={{ color: "var(--primary)" }}
        >
          <Save/><span>Guardar como</span>
        </button>
        <div aria-hidden style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
        <button
          onClick={handleOverwriteActive}
          disabled={!activeInventoryId}
          className="inv-footer-btn"
          style={{ color: savedFlash ? "var(--success)" : "var(--warning)" }}
          title="Reemplaza los items del inventario activo con los actuales"
        >
          {savedFlash
            ? <><Check/><span>Guardado</span></>
            : <><Save/><span>Guardar</span></>}
        </button>
      </div>

    </Modal>

    {/* Sub-modales: portales a document.body para que la ocultación del
        Modal padre (hidden=true) no los afecte. */}
    {promptConfig && createPortal(
      <PromptModal
        open
        nested={false}
        title={promptConfig.title}
        label={promptConfig.label}
        description={promptConfig.description}
        placeholder={promptConfig.placeholder}
        initialValue={promptConfig.initialValue}
        submitLabel={promptConfig.submitLabel}
        validate={promptConfig.validate}
        onSubmit={submitPrompt}
        onCancel={() => setPromptState(null)}
      />,
      document.body
    )}

    {confirmDeleteInv && createPortal(
      <ConfirmModal
        open
        nested={false}
        variant="danger"
        title="Borrar inventario"
        message={`¿Borrar "${confirmDeleteInv.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteInv(null)}
      />,
      document.body
    )}
    </>
  );
}
