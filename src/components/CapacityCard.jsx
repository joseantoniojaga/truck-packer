// Card flotante de capacidad del tráiler. Vive arriba-derecha del visor 3D.
//
// Props (todos en cm³ excepto los counts):
//   placedCount      - número de items colocados
//   totalRequested   - cantidad pedida (load total)  [no se muestra ahora, reservado]
//   placedVolume     - volumen ocupado en cm³
//   totalVolume      - volumen total del tráiler en cm³
//   formatVolume     - función que convierte cm³ a string legible (e.g. "102.52 m³")
export default function CapacityCard({
  placedCount, totalRequested, placedVolume, totalVolume, formatVolume,
}) {
  const percent = totalVolume > 0 ? Math.min(100, (placedVolume / totalVolume) * 100) : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 30,
        width: 280,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 16px",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          letterSpacing: "0.5px",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Capacidad del tráiler
      </div>

      {/* Fila de números: % grande a la izquierda, volumen a la derecha */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--text-primary)",
            fontFeatureSettings: "'tnum'",
            lineHeight: 1,
          }}
        >
          {percent.toFixed(1)}%
        </span>
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontFeatureSettings: "'tnum'",
            whiteSpace: "nowrap",
          }}
        >
          {formatVolume(placedVolume)}{" "}
          <span style={{ color: "var(--text-tertiary)" }}>
            / {formatVolume(totalVolume)}
          </span>
        </span>
      </div>

      {/* Línea pequeña con conteo de muebles */}
      {typeof placedCount === "number" && typeof totalRequested === "number" && totalRequested > 0 && (
        <div style={{
          marginTop: 6,
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          fontWeight: 500,
          fontFeatureSettings: "'tnum'",
        }}>
          {placedCount} de {totalRequested} muebles colocados
        </div>
      )}

      {/* Barra de progreso con gradiente azul → cyan → amarillo → rojo */}
      <div
        style={{
          marginTop: 10,
          height: 6,
          background: "var(--bg-subtle)",
          borderRadius: 999,
          overflow: "hidden",
          position: "relative",
        }}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Capacidad del tráiler"
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 999,
            background:
              "linear-gradient(to right, var(--primary) 0%, var(--secondary) 40%, var(--warning) 75%, var(--error) 100%)",
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}
