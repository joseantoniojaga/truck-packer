import { fullPack, getCounts } from './packing.js';

export function calculateSwapOptions(itemToAdd, currentItems, currentPlaced, trailer) {
  const addVol = itemToAdd.ancho * itemToAdd.alto * itemToAdd.fondo;
  const options = [];

  const placedTypes = [...new Set(currentPlaced.map(p => p.id))];

  for (const typeId of placedTypes) {
    if (typeId === itemToAdd.id) continue;
    const typeInfo = currentItems.find(it => it.id === typeId);
    if (!typeInfo) continue;
    const typeVol = typeInfo.ancho * typeInfo.alto * typeInfo.fondo;

    for (let removeCount = 1; removeCount <= (typeInfo.load || 0); removeCount++) {
      const testItems = currentItems.map(it => {
        if (it.id === typeId) return { ...it, load: it.load - removeCount };
        if (it.id === itemToAdd.id) return { ...it, load: (it.load || 0) + 1 };
        return it;
      });
      // Handle case where itemToAdd is not in currentItems at all
      if (!currentItems.some(it => it.id === itemToAdd.id)) {
        testItems.push({ ...itemToAdd, load: 1 });
      }

      const { placed: testPlaced } = fullPack(testItems, trailer, 'free');
      const counts = getCounts(testPlaced);

      const newItemPlaced = (counts[itemToAdd.id] || 0) >= (itemToAdd.load || 0) + 1;
      const othersOk = currentItems.every(it => {
        if (it.id === typeId || it.id === itemToAdd.id) return true;
        return (counts[it.id] || 0) >= it.load;
      });

      if (newItemPlaced && othersOk) {
        options.push({
          removeType: typeId,
          removeName: typeInfo.name,
          removeColor: typeInfo.color,
          removeCount,
          removeVol: typeVol * removeCount,
          addVol,
          volumeDiff: (typeVol * removeCount) - addVol,
          newItems: testItems,
          newPlaced: testPlaced,
        });
        break;
      }
    }
  }

  options.sort((a, b) => a.removeCount - b.removeCount || a.removeVol - b.removeVol);

  return options;
}
