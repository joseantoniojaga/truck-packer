import { useRef, useCallback, useEffect } from "react";

// Hook "hold-to-repeat": dispara un callback al press y lo repite con
// intervalo `intervalMs` hasta que el caller llame a stop().
//
// Uso típico:
//   const addHold = useHoldRepeat(id => addOne(id));
//   ...
//   <button
//     onMouseDown={e => { e.stopPropagation(); addHold.start(itemId); }}
//     onMouseUp={addHold.stop}
//     onMouseLeave={addHold.stop}
//     onTouchStart={e => { e.stopPropagation(); addHold.start(itemId); }}
//     onTouchEnd={addHold.stop}
//   >+</button>
//
// Detalles:
// - start() dispara el callback UNA vez sincronamente, después lanza un
//   setInterval con esos mismos args.
// - El callback se guarda en un ref que se refresca en cada render, así
//   start no captura una versión vieja del callback (sin stale closure).
// - El interval se limpia al unmount automáticamente.
export function useHoldRepeat(callback, intervalMs = 150) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const intervalRef = useRef(null);

  const start = useCallback((...args) => {
    // Disparo inmediato (click rápido = 1 acción sin esperar al primer tick).
    callbackRef.current(...args);
    // Si por alguna razón ya había un interval activo, limpiarlo antes.
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      callbackRef.current(...args);
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { start, stop };
}
