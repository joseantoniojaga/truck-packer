import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Sparkles, Play, Loader2, Check } from 'lucide-react';

// Action bar flotante en la parte inferior del visor.
//
// Props:
//   canReorganize: boolean
//   canSimulate:   boolean
//   isCalculating: boolean (cuando es true, deshabilita y muestra spinner)
//   activeStrategyId: string | null (qué opción muestra el spinner inline)
//   strategies: PACKING_STRATEGIES (array)
//   onReorganize: () => void
//   onApplyStrategy: (key: string) => void
//   onSimulate: () => void
export default function ActionBar({
  canReorganize, canSimulate, isCalculating,
  activeStrategyId, lastAppliedStrategyId = null, strategies = [],
  onReorganize, onApplyStrategy, onSimulate,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const stratBtnRef = useRef(null);

  // Cierra el dropdown al hacer click fuera (excluyendo el botón Estrategias
  // que lo abre, para no entrar en bucle).
  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (e) => {
      if (isCalculating) return; // no se cierra mientras calcula
      if (dropdownRef.current?.contains(e.target)) return;
      if (stratBtnRef.current?.contains(e.target)) return;
      setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [dropdownOpen, isCalculating]);

  // Escape cierra el dropdown.
  useEffect(() => {
    if (!dropdownOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !isCalculating) setDropdownOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dropdownOpen, isCalculating]);

  // Cuando termina el cálculo, cerrar el dropdown automáticamente.
  // Detectamos la transición isCalculating: true → false.
  const wasCalculatingRef = useRef(isCalculating);
  useEffect(() => {
    if (wasCalculatingRef.current && !isCalculating && dropdownOpen) {
      setDropdownOpen(false);
    }
    wasCalculatingRef.current = isCalculating;
  }, [isCalculating, dropdownOpen]);

  const handleApply = (id) => {
    onApplyStrategy(id);
    // Si la app NO entra en estado calculando (e.g. abre un modal de confirm),
    // cerramos igual para no quedar abiertos detrás del modal. Si SÍ calcula,
    // el efecto anterior cerrará cuando termine.
    if (!isCalculating) setDropdownOpen(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 6,
        boxShadow: "var(--shadow-md)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {/* Botón Reorganizar (primario) */}
      <button
        type="button"
        className="action-btn action-btn--primary"
        onClick={onReorganize}
        disabled={!canReorganize || isCalculating}
        aria-label="Reorganizar carga"
      >
        <RotateCcw size={14} />
        Reorganizar
      </button>

      {/* Botón Estrategias (secundario) — con dropdown */}
      <div style={{ position: "relative" }} ref={stratBtnRef}>
        <button
          type="button"
          className={`action-btn action-btn--secondary${dropdownOpen ? ' action-btn--open' : ''}`}
          onClick={() => setDropdownOpen(o => !o)}
          disabled={isCalculating && !dropdownOpen}
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
          aria-label="Aplicar estrategia"
        >
          {isCalculating
            ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />
            : <Sparkles size={14} style={{ color: "var(--accent)" }} />}
          {isCalculating ? "Calculando..." : "Estrategias"}
        </button>

        {dropdownOpen && (
          <div
            ref={dropdownRef}
            role="menu"
            style={{
              position: "absolute",
              bottom: "calc(100% + 12px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 8,
              boxShadow: "var(--shadow-md)",
              minWidth: 280,
            }}
          >
            <div style={{
              fontSize: "var(--text-lg)", fontWeight: 700,
              color: "var(--text-primary)",
              padding: "10px 12px 12px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Sparkles size={20} style={{ color: "var(--accent)" }} />
              Aplicar estrategia
            </div>
            {strategies.map(s => {
              const isActive = activeStrategyId === s.key;
              const isLastApplied = !isActive && lastAppliedStrategyId === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="menuitem"
                  className="strat-option"
                  onClick={() => handleApply(s.key)}
                  disabled={isCalculating}
                  style={{
                    background: (isActive || isLastApplied) ? "var(--bg-subtle)" : "transparent",
                    borderLeft: isLastApplied ? "3px solid var(--primary)" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                      {s.desc}
                    </div>
                  </div>
                  {isActive && isCalculating && (
                    <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
                  )}
                  {isLastApplied && (
                    <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }} aria-label="Aplicada" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Divisor */}
      <div aria-hidden style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

      {/* Simular */}
      <button
        type="button"
        className="action-btn action-btn--secondary"
        onClick={onSimulate}
        disabled={!canSimulate || isCalculating}
        aria-label="Iniciar simulador de carga"
      >
        <Play size={14} />
        Simular
      </button>
    </div>
  );
}
