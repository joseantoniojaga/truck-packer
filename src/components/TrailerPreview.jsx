// SVG isométrico del tráiler con proporciones reales. Componente puro:
// recibe dimensiones en cm y renderiza wireframe Cargo Trust + labels en m.
//
// Sistema de ejes 3D:
//   X = largo (profundidad del tráiler, eje frente↔fondo)
//   Y = ancho (lado izquierdo↔derecho del tráiler)
//   Z = alto  (vertical)
//
// Proyección isométrica clásica (ángulos 30°):
//   px = (x - y) * cos(30°)
//   py = (x + y) * sin(30°) - z
//
// Después se escala uniformemente al viewBox 280×240 manteniendo las
// proporciones de las 3 dimensiones, con padding para que las etiquetas
// no toquen el borde.

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

// Las etiquetas viven en una row HTML debajo del SVG (no compiten con las
// aristas), así que el padding interno del viewBox solo necesita evitar que
// el wireframe toque los bordes — basta con un margen ligero.
const VB_W = 280, VB_H = 200;
const PAD_X = 16, PAD_Y = 16;

function project(x, y, z) {
  return { px: (x - y) * COS30, py: (x + y) * SIN30 - z };
}

// Etiquetas dimensionales en una row debajo del SVG. Componente trivial,
// extraído para que la lógica de proyección quede compacta.
function DimsRow({ L, W, H }) {
  const fmt = (cm) => (cm / 100).toFixed(2) + " m";
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-around",
      gap: 8,
      marginTop: 8,
      fontSize: "var(--text-xs)",
      color: "var(--text-tertiary)",
      fontVariantNumeric: "tabular-nums",
    }}>
      <span>Largo {fmt(L)}</span>
      <span>Ancho {fmt(W)}</span>
      <span>Alto {fmt(H)}</span>
    </div>
  );
}

export default function TrailerPreview({ largo, ancho, alto }) {
  const L = Number(largo) || 0;
  const W = Number(ancho) || 0;
  const H = Number(alto) || 0;
  if (L <= 0 || W <= 0 || H <= 0) {
    return (
      <div>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: "100%", height: "auto" }} />
        <DimsRow L={L} W={W} H={H}/>
      </div>
    );
  }

  // 8 vértices del box (en orden indexado).
  //   0: front-left-bottom    1: front-right-bottom
  //   2: back-left-bottom     3: back-right-bottom
  //   4: front-left-top       5: front-right-top
  //   6: back-left-top        7: back-right-top
  const V = [
    project(0, 0, 0),
    project(L, 0, 0),
    project(0, W, 0),
    project(L, W, 0),
    project(0, 0, H),
    project(L, 0, H),
    project(0, W, H),
    project(L, W, H),
  ];

  const minX = Math.min(...V.map(v => v.px));
  const maxX = Math.max(...V.map(v => v.px));
  const minY = Math.min(...V.map(v => v.py));
  const maxY = Math.max(...V.map(v => v.py));
  const projW = maxX - minX;
  const projH = maxY - minY;

  const usableW = VB_W - 2 * PAD_X;
  const usableH = VB_H - 2 * PAD_Y;
  const scale = Math.min(usableW / projW, usableH / projH);

  // Centra el bounding box proyectado en el viewBox.
  const offsetX = (VB_W - projW * scale) / 2 - minX * scale;
  const offsetY = (VB_H - projH * scale) / 2 - minY * scale;
  const T = (v) => ({ x: v.px * scale + offsetX, y: v.py * scale + offsetY });

  const p = V.map(T);

  // Edges visibles desde la cámara iso estándar (frente-derecha-arriba):
  // todas excepto las 3 adyacentes al vértice oculto (back-left-bottom = 2).
  const VISIBLE = [
    [0, 1], [1, 3], [3, 7], [7, 5], [5, 4], [4, 6], [6, 7], [5, 1], [4, 0],
  ];
  // Edges ocultos (líneas punteadas): aristas adyacentes al vértice 2.
  const HIDDEN = [
    [0, 2], [2, 3], [2, 6],
  ];

  const line = ([a, b], idx, hidden) => (
    <line
      key={`${hidden ? 'h' : 'v'}-${idx}`}
      x1={p[a].x} y1={p[a].y} x2={p[b].x} y2={p[b].y}
      stroke="var(--primary)"
      strokeWidth="2"
      strokeLinecap="round"
      opacity={hidden ? 0.35 : 1}
      strokeDasharray={hidden ? "3 3" : undefined}
    />
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="Vista isométrica del tráiler"
      >
        {/* Edges ocultos primero (debajo) */}
        {HIDDEN.map((e, i) => line(e, i, true))}
        {/* Edges visibles encima */}
        {VISIBLE.map((e, i) => line(e, i, false))}
      </svg>
      <DimsRow L={L} W={W} H={H}/>
    </div>
  );
}
