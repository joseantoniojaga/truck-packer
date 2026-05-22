// Constantes compartidas del proyecto.

// Mínimo de área soportada (fracción 0..1) para apilar un item sobre otros.
export const SUPPORT_RATIO_THRESHOLD = 0.8;

// Tolerancia geométrica (cm) para solapamientos y comparaciones de bordes.
export const GEOMETRIC_TOLERANCE = 0.1;

// Tolerancia (cm) al comparar la cara superior de un item contra el z de otro
// para considerarlos en contacto vertical.
export const HEIGHT_TOLERANCE = 2;

// Pesos del score en findBestPos. Menor score = mejor posición.
// - *_BACK_TO_FRONT: modo "llenar de fondo a frente" (prioriza x bajo, luego z).
// - *_FREE: modo "apilar libre" (prioriza z bajo, luego x).
// - *_BONUS: penalizaciones negativas que premian apilar items del mismo tipo
//            y conservar la misma rotación.
export const SCORE_WEIGHTS = {
  X_BACK_TO_FRONT: 1e8,
  Z_BACK_TO_FRONT: 1e4,
  Z_FREE: 1e6,
  X_FREE: 1e3,
  SAME_TYPE_BONUS: -5e7,
  SAME_ROTATION_BONUS: -3e7,
};

// Paleta de la UI.
export const COLORS = {
  bg:     "#0B1121",
  card:   "#1E293B",
  text:   "#F8FAFC",
  muted:  "#94A3B8",
  border: "#334155",
  cyan:   "#06B6D4",
  green:  "#34D399",
  amber:  "#F59E0B",
  red:    "#EF4444",
  purple: "#A78BFA",
};
