export function computeLoadingOrder(placed) {
  const sorted = [...placed];

  sorted.sort((a, b) => {
    const ax = Math.round(a.x / 10);
    const bx = Math.round(b.x / 10);
    if (ax !== bx) return ax - bx;
    if (Math.abs(a.z - b.z) > 1) return a.z - b.z;
    return a.y - b.y;
  });

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.z < 1) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const support = sorted[j];
      if (Math.abs(support.z + support.h - item.z) < 2) {
        const ox = Math.max(0, Math.min(item.x+item.l, support.x+support.l) - Math.max(item.x, support.x));
        const oy = Math.max(0, Math.min(item.y+item.w, support.y+support.w) - Math.max(item.y, support.y));
        if (ox > 1 && oy > 1) {
          const [moved] = sorted.splice(j, 1);
          sorted.splice(i, 0, moved);
          i--;
          break;
        }
      }
    }
  }

  return sorted.map((item, index) => ({
    step: index + 1,
    total: sorted.length,
    item: item,
    instruction: getInstruction(item, index, sorted),
  }));
}

function getInstruction(item, index, allItems) {
  const pos = item.z < 1 ? 'en el piso' : 'encima de otro mueble';
  const xPos = item.x < 200 ? 'al fondo' : item.x < 800 ? 'en la parte media' : 'hacia el frente';
  const yPos = item.y < 80 ? 'lado izquierdo' : item.y > 167 ? 'lado derecho' : 'al centro';
  return `Colocar ${item.name} ${pos}, ${xPos}, ${yPos}`;
}
