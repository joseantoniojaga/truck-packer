import { fullPack, getCounts } from './packing.js';

// Calcula qué muebles se pueden quitar para que quepa el nuevo
export function calculateSwapOptions(itemToAdd, currentItems, placed, trailer, mode) {
  const options = [];

  // IDs de tipos que están colocados (excepto el que quiero agregar)
  const placedTypeIds = [...new Set(placed.map(p => p.id))].filter(id => id !== itemToAdd.id);

  for (const typeId of placedTypeIds) {
    const typeInfo = currentItems.find(it => it.id === typeId);
    if (!typeInfo || typeInfo.load <= 0) continue;

    const typeVol = typeInfo.ancho * typeInfo.alto * typeInfo.fondo;

    // Probar quitando 1, 2, 3... de este tipo hasta que quepa el nuevo
    for (let removeCount = 1; removeCount <= typeInfo.load; removeCount++) {
      const testItems = currentItems.map(it => {
        if (it.id === typeId) return { ...it, load: it.load - removeCount };
        if (it.id === itemToAdd.id) return { ...it, load: (it.load || 0) + 1 };
        return { ...it };
      });
      // Si itemToAdd no está en currentItems, agregarlo
      if (!currentItems.some(it => it.id === itemToAdd.id)) {
        testItems.push({ ...itemToAdd, load: 1 });
      }

      const { placed: testPlaced } = fullPack(testItems, trailer, mode);
      const counts = getCounts(testPlaced);

      // Verificar que el nuevo item quedó colocado
      if ((counts[itemToAdd.id] || 0) >= (itemToAdd.load || 0) + 1) {
        options.push({
          removeTypeId: typeId,
          removeName: typeInfo.name,
          removeColor: typeInfo.color,
          removeCount,
          removeTotalVol: typeVol * removeCount,
          newItems: testItems,
          newPlaced: testPlaced,
        });
        break; // mínimo encontrado para este tipo, no seguir
      }
    }
  }

  // Ordenar: menos items a quitar primero
  options.sort((a, b) => a.removeCount - b.removeCount || a.removeTotalVol - b.removeTotalVol);
  return options;
}
