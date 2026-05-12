# Truck Packer - Handoff para Claude Code

## Contexto
Estoy construyendo una calculadora visual de carga para un tráiler de mudanza de muebles. Es una app React (JSX artifact de claude.ai) que calcula cuántos muebles caben en un tráiler y lo muestra en 3D (Three.js) y 6 vistas 2D ortográficas.

## Archivo actual
El código actual está en el archivo `truck-packer.jsx` que adjunto. Es funcional pero tiene problemas que necesito que arregles.

## Datos del tráiler
- Dimensiones: 16.154m (largo) × 2.47m (ancho) × 2.80m (alto) — todo en cm internamente
- Placas: 49-UT-7V
- Volumen: ~111.72 m³

## Muebles (medidas en cm: ancho × alto × fondo)
| Cant | Nombre | Ancho | Alto | Fondo |
|------|--------|-------|------|-------|
| 16 | Tocador Boston | 122.5 | 89.5 | 42 |
| 28 | Portaluna Habana | 81 | 172 | 7.5 |
| 38 | Cabecera Hampton | 143 | 9 | 151 |
| 32 | Buró Hampton | 65 | 65 | 40 |
| 12 | Base Individual Cielo | 99 | 30.5 | 191 |
| 10 | Base Matrimonial Cielo | 136.5 | 30.5 | 191 |
| 25 | Base Individual Sierra | 99.5 | 36 | 199.5 |
| 32 | Base Mat. Sierra | 137 | 36 | 199.5 |
| 34 | Base Queen Sierra | 150 | 36 | 199.5 |

## Lo que YA funciona
1. ✅ Vista 3D interactiva con Three.js (rotar con drag, zoom con scroll)
2. ✅ 6 vistas 2D ortográficas (superior, inferior, derecha, izquierda, frontal, trasera)
3. ✅ Edición de inventario (cuántas tenemos de cada mueble)
4. ✅ Botones +/- para elegir cuántas meter
5. ✅ Colocación INCREMENTAL: al dar + los muebles existentes NO se mueven
6. ✅ Al dar - se hace repack completo
7. ✅ Diálogo de conflicto cuando agregar un mueble desplazaría otros
8. ✅ 5 estrategias de auto-llenado (máx piezas, máx volumen, grandes primero, planos primero, balanceado)
9. ✅ Botón "Todos a 0" y "Restablecer inventario"
10. ✅ Detalle de cada mueble al tocarlo (medidas, volumen, inventario, colocadas)
11. ✅ Fusión básica de espacios adyacentes (mergeSpaces)

## Problemas a resolver (PRIORIDAD)

### 1. 🔴 GRAVEDAD — Muebles flotan
Los muebles se colocan en espacios elevados (z>0) que no tienen soporte real debajo. El check actual de `supRatio` no es suficiente.

**Solución recomendada:** Implementar un HEIGHT MAP 2D que rastree la altura máxima ocupada en cada punto (x,y) del piso del tráiler. Un mueble solo puede colocarse a z = heightmap[x][y] (encima de lo que hay) o z=0 (en el piso). Nunca en un z arbitrario.

### 2. 🔴 FRAGMENTACIÓN DE ESPACIOS — No encuentra huecos que visualmente existen
El algoritmo Guillotine split crea muchos sub-espacios que individualmente son muy chicos, pero juntos formarían un espacio útil. El merge actual solo fusiona espacios con dimensiones EXACTAS en caras compartidas.

**Solución recomendada:** Implementar "Maximal Rectangles" en lugar de Guillotine splits. Mantener una lista de todos los rectángulos libres máximos (pueden solaparse). Al colocar un item, recortar todos los rectángulos que se solapan con él y generar los rectángulos máximos resultantes.

### 3. 🟡 SMART HEIGHT — No aprovecha espacio vertical
Cuando apila bases (36cm × 7 = 252cm), deja 28cm arriba que no sirven para nada. Debería apilar 6 capas (216cm) dejando 64cm donde SÍ caben burós (40cm).

**Solución:** Al calcular nH (capas de apilamiento), verificar si reducir por 1 crearía espacio útil para otros muebles pendientes.

### 4. 🟡 REORGANIZACIÓN — Botón para defragmentar
Agregar un botón "Reorganizar" que haga full repack optimizado para consolidar espacios libres y meter más muebles.

## Restricciones técnicas (es un artifact de claude.ai)
- React funcional con hooks (useState, useMemo, useCallback, useEffect, useRef)
- Three.js disponible como `import * as THREE from "three"` (r128, NO hay OrbitControls)
- Tailwind NO disponible, usar inline styles
- NO localStorage/sessionStorage
- Un solo archivo JSX con default export
- Las medidas del tráiler son en metros, las de muebles en centímetros (convertir internamente a cm)
- El archivo debe funcionar como artifact en claude.ai

## UI/UX que debe mantenerse
- Dark theme (#0B1121 fondo, #1E293B cards, #F8FAFC texto)
- Font: DM Sans (body) + JetBrains Mono (números)
- Barra de capacidad con % y volumen
- Tabs para 3D / 6 Vistas
- Lista de muebles con +/- y conteo colocadas/tenemos
- Botones: Estrategias, Inventario, Todos a 0
- Diálogo de conflicto cuando hay desplazamiento
- Colores por tipo de mueble (cada uno tiene su color asignado)

## Cómo probarlo
1. Agregar muebles uno por uno con + y verificar que NADA flote
2. Llenar con estrategia "Máx volumen" y verificar que todo esté apoyado
3. Poner inventario de 98 Burós Hampton e intentar llenar — debe aprovechar todo el espacio disponible
4. Agregar distintos tipos y verificar que se metan en huecos entre otros muebles (rotados)
5. Verificar en 6 vistas que la vista lateral muestre todo apilado correctamente

## Entregable
Un solo archivo `truck-packer.jsx` que funcione como React artifact en claude.ai con todos los fixes implementados.
