import { COLORS } from "../constants.js";

// `vk` y `trailer` son props externas; aliasadas a viewKind y TR adentro para
// mantener legibilidad sin romper el call site en App.jsx.
function OV({ placed, vk: viewKind, selId, onSel, trailer: TR }) {
  const getCoords = (placedItem) => {
    const trailerLargo = TR.largo;
    const trailerAncho = TR.ancho;
    const trailerAlto = TR.alto;
    switch (viewKind) {
      case "top":
        return {
          x: placedItem.x / trailerLargo * 100,
          y: placedItem.y / trailerAncho * 100,
          w: placedItem.l / trailerLargo * 100,
          h: placedItem.w / trailerAncho * 100,
        };
      case "bottom":
        return {
          x: placedItem.x / trailerLargo * 100,
          y: (trailerAncho - placedItem.y - placedItem.w) / trailerAncho * 100,
          w: placedItem.l / trailerLargo * 100,
          h: placedItem.w / trailerAncho * 100,
        };
      case "front":
        return {
          x: placedItem.y / trailerAncho * 100,
          y: (trailerAlto - placedItem.z - placedItem.h) / trailerAlto * 100,
          w: placedItem.w / trailerAncho * 100,
          h: placedItem.h / trailerAlto * 100,
        };
      case "back":
        return {
          x: (trailerAncho - placedItem.y - placedItem.w) / trailerAncho * 100,
          y: (trailerAlto - placedItem.z - placedItem.h) / trailerAlto * 100,
          w: placedItem.w / trailerAncho * 100,
          h: placedItem.h / trailerAlto * 100,
        };
      case "right":
        return {
          x: placedItem.x / trailerLargo * 100,
          y: (trailerAlto - placedItem.z - placedItem.h) / trailerAlto * 100,
          w: placedItem.l / trailerLargo * 100,
          h: placedItem.h / trailerAlto * 100,
        };
      case "left":
        return {
          x: (trailerLargo - placedItem.x - placedItem.l) / trailerLargo * 100,
          y: (trailerAlto - placedItem.z - placedItem.h) / trailerAlto * 100,
          w: placedItem.l / trailerLargo * 100,
          h: placedItem.h / trailerAlto * 100,
        };
      default:
        return { x: 0, y: 0, w: 0, h: 0 };
    }
  };

  // aspectRatios calculados dinámicamente de las dims reales del tráiler.
  // paddingBottom = height/width × 100 (técnica clásica de aspect ratio sin
  // `aspect-ratio` CSS). Para cada vista, el "ancho" del viewport corresponde
  // a la dim horizontal de la proyección, y la "altura" a la vertical:
  //   - top/bottom : H=largo,  V=ancho
  //   - front/back : H=ancho,  V=alto
  //   - right/left : H=largo,  V=alto
  const trailerLargo = TR.largo;
  const trailerAncho = TR.ancho;
  const trailerAlto  = TR.alto;
  const aspectRatios = {
    top:    (trailerAncho / trailerLargo) * 100,
    bottom: (trailerAncho / trailerLargo) * 100,
    front:  (trailerAlto  / trailerAncho) * 100,
    back:   (trailerAlto  / trailerAncho) * 100,
    right:  (trailerAlto  / trailerLargo) * 100,
    left:   (trailerAlto  / trailerLargo) * 100,
  };
  const labels = {
    top: "Superior",
    bottom: "Inferior",
    front: "Frontal",
    back: "Trasera",
    right: "Derecha",
    left: "Izquierda",
  };

  let visibleItems = placed;
  if (viewKind === "front") visibleItems = placed.filter(placedItem => placedItem.x < TR.largo * 0.06);
  if (viewKind === "back") visibleItems = placed.filter(placedItem => placedItem.x + placedItem.l > TR.largo * 0.94);
  if (viewKind === "right") {
    const silhouetteMap = new Map();
    for (const placedItem of placed) {
      const silhouetteKey = `${Math.round(placedItem.x / 5)}-${Math.round(placedItem.z / 5)}`;
      if (!silhouetteMap.has(silhouetteKey) || placedItem.y > silhouetteMap.get(silhouetteKey).y) {
        silhouetteMap.set(silhouetteKey, placedItem);
      }
    }
    visibleItems = Array.from(silhouetteMap.values());
  }
  if (viewKind === "left") {
    const silhouetteMap = new Map();
    for (const placedItem of placed) {
      const silhouetteKey = `${Math.round(placedItem.x / 5)}-${Math.round(placedItem.z / 5)}`;
      if (!silhouetteMap.has(silhouetteKey) || placedItem.y < silhouetteMap.get(silhouetteKey).y) {
        silhouetteMap.set(silhouetteKey, placedItem);
      }
    }
    visibleItems = Array.from(silhouetteMap.values());
  }

  return (
    <div style={{ flex: 1, minWidth: "48%" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 2, fontWeight: 600, textAlign: "center" }}>
        {labels[viewKind]}
      </div>
      <div style={{
        position: "relative",
        width: "100%",
        paddingBottom: `${aspectRatios[viewKind]}%`,
        background: "var(--bg-subtle)",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${COLORS.card}`,
        overflow: "hidden",
        // Stacking context local: el item seleccionado se eleva via z-index
        // relativo a sus hermanos, no a la página entera (antes saltaba
        // encima de la ActionBar global).
        isolation: "isolate",
      }}>
        {visibleItems.map((placedItem, index) => {
          const coords = getCoords(placedItem);
          if (coords.w < 0.3 || coords.h < 0.3) return null;
          const isSelected = selId === placedItem.id;
          return (
            <div
              key={index}
              onClick={e => { e.stopPropagation(); onSel(placedItem.id); }}
              style={{
                position: "absolute",
                left: `${coords.x}%`,
                top: `${coords.y}%`,
                width: `${coords.w}%`,
                height: `${coords.h}%`,
                background: placedItem.color,
                border: `1.5px solid var(--ortho-edge)`,
                borderRadius: 1,
                cursor: "pointer",
                opacity: isSelected ? 1 : 0.85,
                zIndex: isSelected ? 2 : 1,
                boxShadow: isSelected ? `0 0 0 2px ${placedItem.color}` : "none",
              }}
              title={placedItem.name}
            />
          );
        })}
      </div>
    </div>
  );
}

export default OV;
