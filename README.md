# Truck Packer 🚛

Calculadora 3D de carga para tráiler de mudanza: acomoda muebles en el espacio disponible con física real (gravedad, soporte, sin solapamientos).

## ¿Qué es?

Truck Packer es una aplicación web que resuelve un problema concreto del día a día de mudanzas de muebles: **¿cuántos muebles caben en el tráiler y cómo acomodarlos?** Sobre un tráiler de 16.15 m × 2.47 m × 2.80 m (largo × ancho × alto), el usuario carga su inventario (9 muebles base preconfigurados o muebles custom que él define) y la aplicación calcula la disposición tridimensional óptima. El algoritmo respeta gravedad (los items no flotan), exige al menos 80% de soporte para apilar, y aprovecha las 6 rotaciones posibles de cada caja para maximizar el aprovechamiento. La app corre 100% en el navegador, sin servidor — toda la persistencia ocurre en `localStorage`.

## Demo / Screenshots

<!-- TODO: agregar screenshots cuando el UI esté pulido -->

## Stack técnico

- **React 18.3** con hooks
- **Three.js 0.170** (r170) para la visualización 3D
- **Vite 6** como bundler y dev server
- **Vitest 4** + **React Testing Library 16** para los tests
- **jsdom** como entorno de tests sin browser real
- **localStorage** para persistencia de inventarios

## Estructura del proyecto

```
src/
├── App.jsx                    # Componente raíz, orquesta UI y estado global
├── main.jsx                   # Entry point de Vite
├── packing.js                 # Algoritmo de empaquetado 3D (column packing + findBestPos)
├── packingStrategies.js       # Strategy Pattern: 5 estrategias de auto-fill intercambiables
├── swapCalculator.js          # Intercambio inteligente: qué muebles quitar para meter uno nuevo
├── loadingSequence.js         # Orden de carga paso a paso (fondo → frente, base → apilado)
├── furniture.js               # Modelo Furniture + inventario base de 9 muebles
├── inventoryStorage.js        # CRUD de inventarios en localStorage
├── constants.js               # Constantes compartidas (colores, tolerancias, score weights)
├── components/
│   ├── Modal.jsx                  # Modal genérico reutilizable
│   ├── Viewer3D.jsx               # Vista 3D con Three.js (controles orbit + zoom)
│   ├── OrthoView.jsx              # Vista 2D ortográfica (top/bottom/front/back/left/right)
│   ├── InventoryManagerModal.jsx  # Crear, cargar, renombrar y borrar inventarios
│   └── FurnitureEditorModal.jsx   # Crear, editar y borrar muebles custom
├── hooks/
│   └── useHoldRepeat.js       # Hook para botones "presionar y mantener para repetir"
└── test/
    └── setup.js               # Setup global de Vitest (jest-dom + mock de localStorage)
```

Total: ~10 archivos de lógica + 5 componentes + 1 hook, todos por debajo de 600 líneas.

## Instalación

```bash
git clone https://github.com/joseantoniojaga/truck-packer.git
cd truck-packer
npm install
```

Requiere **Node 18+** (recomendado Node 20).

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` con hot-reload |
| `npm run build` | Build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción para verificarlo localmente |
| `npm test` | Corre todos los tests una vez y termina (para CI o pre-commit) |
| `npm run test:watch` | Tests en modo watch — re-corren al cambiar archivos |
| `npm run test:ui` | Interfaz web interactiva de Vitest |

## Cómo funciona el algoritmo de empaquetado

El núcleo es **column packing con relleno**: el tráiler se llena sección por sección avanzando en el eje X (de fondo a frente). Para cada sección, el algoritmo evalúa todas las combinaciones de (tipo de mueble × rotación) y elige la que maximiza el **volumen colocado por unidad de avance** — equivalente a maximizar la utilización de la sección transversal `ancho × alto`. Una vez elegida, coloca el bloque uniforme `nW × nH` (cuántos caben a lo ancho × cuántos a lo alto) y avanza X por el `largo` de esa rotación.

Cuando ya no hay un tipo que llene bloque limpio en la sección actual, una **segunda pasada** usa `findBestPos` para colocar items individuales rellenando huecos: enumera posiciones candidatas a partir de los bordes de items ya colocados, evalúa cada una con un score que penaliza solapamiento, mala posición y falta de soporte, y elige la mejor.

Las restricciones que el algoritmo siempre respeta:
- **Sin flotación:** todo item con `z > 0` debe estar apoyado sobre otros items o sobre el piso.
- **80% de soporte:** un item solo se apila si su base está cubierta en ≥ 80% del área (`SUPPORT_RATIO_THRESHOLD` en `constants.js`).
- **Sin solapamientos:** chequeo geométrico con tolerancia de 0.1 cm.
- **Dentro del tráiler:** ningún item puede salirse de las dimensiones `1615.4 × 247 × 280 cm`.

## Features actuales

- **Vista 3D interactiva** con controles orbit (mouse y touch), zoom in/out, resaltado del item seleccionado.
- **6 vistas 2D ortográficas** (superior, inferior, frontal, trasera, derecha, izquierda) sincronizadas.
- **Edición manual del inventario:** botones `+`/`−` y inputs numéricos editables por mueble.
- **5 estrategias de auto-fill** intercambiables: máx piezas, máx volumen, grandes primero, planos primero, balanceado.
- **Simulador paso a paso** que muestra el orden de carga real (fondo → frente, base → apilado).
- **Intercambio inteligente:** cuando el camión está lleno y el usuario quiere meter otro mueble, sugiere qué quitar.
- **Inventarios múltiples** guardados en `localStorage` — cambia entre ellos sin perder datos.
- **CRUD de muebles custom:** crea, edita y elimina muebles propios con nombre, dimensiones, inventario y color.
- **Dos modos de empaque:** "back to front" (llenar de fondo a frente, prioriza X bajo) y "free" (apilar libre, prioriza Z bajo).

## Patrones de diseño aplicados

- **Strategy Pattern** — Cada estrategia de auto-fill es un objeto literal con interfaz `{ key, label, icon, desc, execute(items, trailer, mode) }` en `packingStrategies.js`. Agregar una nueva no requiere tocar `quickStrat` ni la UI (Open/Closed Principle).
- **Custom hooks (React)** — `useHoldRepeat` encapsula el comportamiento "press and hold = repetir acción" para los botones `+/−`, eliminando state intermedio y `useEffect` de orchestración del componente padre.
- **Component composition** — `<Modal>` es un wrapper genérico que reciben los 6 modales del App (conflict, mode-switch, strategy-confirm, pending-add, swap-options, reorg-confirm) más los modales especializados de inventario y mueble.
- **Separation of concerns** — La lógica de packing vive en módulos puros sin dependencias de React (`packing.js`, `packingStrategies.js`, `swapCalculator.js`, `loadingSequence.js`); los componentes solo orquestan UI y consumen esas funciones.

## Tests

122 tests automatizados con Vitest + React Testing Library, distribuidos en 8 archivos:

| Archivo | Tests | Cubre |
|---|---:|---|
| `src/packing.test.js` | 59 | Algoritmo de packing, gravedad, soporte, sin huecos, no overlaps, dentro del tráiler, performance |
| `src/__tests__/inventoryStorage.test.js` | 10 | CRUD de inventarios, JSON corrupto, items malformados |
| `src/__tests__/packingStrategies.test.js` | 6 | Strategy Pattern: contrato de cada estrategia, getStrategy, error handling |
| `src/__tests__/App.integration.test.jsx` | 10 | Flujos end-to-end: boot, crear inventario, CRUD mueble, input editable |
| `src/components/__tests__/Modal.test.jsx` | 5 | Render condicional, props, styling |
| `src/components/__tests__/InventoryManagerModal.test.jsx` | 10 | Cargar, renombrar, borrar, crear vacío, snapshot, sobrescribir |
| `src/components/__tests__/FurnitureEditorModal.test.jsx` | 17 | Validaciones (nombre único, dimensiones, volumen), guardar, borrar, defensive |
| `src/hooks/__tests__/useHoldRepeat.test.js` | 5 | Press inmediato, repeat con intervalo, release, unmount, callback dinámico |

**Tiempo total:** ~5 segundos.

Three.js está mockeado en los tests de integración mediante `vi.mock('three', …)` para que App.jsx sea renderizable en `jsdom` sin necesidad de WebGL real.

## Autor

Jose Antonio Gonzalez Jaga · <joseantoniojaga@hotmail.com>

## Licencia

Privado / no distribuible.
