# Truck Packer 🚛

3D load calculator for moving-truck furniture: arranges items in the available space with real physics (gravity, support, no overlaps).

## What is it?

Truck Packer is a web app that solves a concrete real-world problem in furniture moves: **how many pieces fit in the truck, and how should they be arranged?** Given a 16.15 m × 2.47 m × 2.80 m trailer (length × width × height), the user loads inventory (9 preconfigured base pieces or custom furniture they define) and the app computes the optimal 3D arrangement. The algorithm respects gravity (items don't float), requires at least 80% support to stack, and exploits the 6 possible rotations of each box to maximize space usage. The app runs 100% in the browser — no server, all persistence via `localStorage`.

## Demo / Screenshots

<!-- TODO: add screenshots once UI is polished -->

## Tech stack

- **React 18.3** with hooks
- **Three.js 0.170** (r170) for 3D visualization
- **Vite 6** as bundler and dev server
- **Vitest 4** + **React Testing Library 16** for tests
- **jsdom** as the test environment (no real browser)
- **localStorage** for inventory persistence

## Project structure

```
src/
├── App.jsx                    # Root component, orchestrates UI and global state
├── main.jsx                   # Vite entry point
├── packing.js                 # 3D packing algorithm (column packing + findBestPos)
├── packingStrategies.js       # Strategy Pattern: 5 interchangeable auto-fill strategies
├── swapCalculator.js          # Smart swap: what to remove to fit a new piece
├── loadingSequence.js         # Step-by-step loading order (back → front, base → stacked)
├── furniture.js               # Furniture model + base inventory of 9 pieces
├── inventoryStorage.js        # Inventory CRUD in localStorage
├── constants.js               # Shared constants (colors, tolerances, score weights)
├── components/
│   ├── Modal.jsx                  # Reusable generic modal
│   ├── Viewer3D.jsx               # 3D view with Three.js (orbit controls + zoom)
│   ├── OrthoView.jsx              # 2D orthographic view (top/bottom/front/back/left/right)
│   ├── InventoryManagerModal.jsx  # Create, load, rename and delete inventories
│   └── FurnitureEditorModal.jsx   # Create, edit and delete custom furniture
├── hooks/
│   └── useHoldRepeat.js       # Hook for "press-and-hold to repeat" buttons
└── test/
    └── setup.js               # Vitest global setup (jest-dom + localStorage mock)
```

Around 10 logic files + 5 components + 1 hook, all under 600 lines each.

## Installation

```bash
git clone https://github.com/joseantoniojaga/truck-packer.git
cd truck-packer
npm install
```

Requires **Node 18+** (Node 20 recommended).

## Available commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at `http://localhost:5173` with hot-reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serves the production build locally for verification |
| `npm test` | Runs all tests once and exits (for CI or pre-commit) |
| `npm run test:watch` | Tests in watch mode — re-run on file changes |
| `npm run test:ui` | Vitest interactive web UI |

## How the packing algorithm works

The core is **column packing with fill-in**: the trailer is filled section by section along the X axis (back to front). For each section, the algorithm evaluates every combination of (furniture type × rotation) and picks the one that maximizes **volume placed per unit of X advance** — equivalent to maximizing cross-section utilization (`width × height`). Once chosen, it places the uniform `nW × nH` block (how many fit width-wise × how many height-wise) and advances X by the rotation's `length`.

When no type forms a clean block in the current section, a **second pass** uses `findBestPos` to place individual items in the gaps: it enumerates candidate positions from the edges of already-placed items, scores each candidate with penalties for overlap, bad position and lack of support, and picks the best.

Constraints the algorithm always enforces:

- **No floating:** any item with `z > 0` must rest on other items or the floor.
- **80% support:** an item is only stacked if its base is covered ≥ 80% by area (`SUPPORT_RATIO_THRESHOLD` in `constants.js`).
- **No overlaps:** geometric check with 0.1 cm tolerance.
- **Inside the trailer:** no item exits the `1615.4 × 247 × 280 cm` bounds.

## Current features

- **Interactive 3D view** with orbit controls (mouse and touch), zoom in/out, selected-item highlight.
- **6 orthographic 2D views** (top, bottom, front, back, right, left) kept in sync.
- **Manual inventory editing:** `+`/`−` buttons and editable numeric inputs per piece.
- **5 interchangeable auto-fill strategies:** max pieces, max volume, big first, flat first, balanced.
- **Step-by-step loading simulator** showing the real loading order (back → front, base → stacked).
- **Smart swap:** when the truck is full and the user wants to add another piece, it suggests what to remove.
- **Multiple inventories** persisted in `localStorage` — switch between them without losing data.
- **Custom furniture CRUD:** create, edit and delete your own pieces with name, dimensions, inventory and color.
- **Two packing modes:** "back to front" (fill from the back, prioritizes low X) and "free" (stack freely, prioritizes low Z).

## Design patterns applied

- **Strategy Pattern** — Each auto-fill strategy is a literal object with the interface `{ key, label, icon, desc, execute(items, trailer, mode) }` in `packingStrategies.js`. Adding a new one requires no changes to `quickStrat` or the UI (Open/Closed Principle).
- **Custom hooks (React)** — `useHoldRepeat` encapsulates the "press and hold = repeat action" behavior for the `+/−` buttons, removing intermediate state and an orchestration `useEffect` from the parent component.
- **Component composition** — `<Modal>` is a generic wrapper consumed by the 6 App modals (conflict, mode-switch, strategy-confirm, pending-add, swap-options, reorg-confirm) plus the specialized inventory and furniture modals.
- **Separation of concerns** — Packing logic lives in pure modules with no React dependencies (`packing.js`, `packingStrategies.js`, `swapCalculator.js`, `loadingSequence.js`); components only orchestrate UI and consume those functions.

## Tests

122 automated tests with Vitest + React Testing Library, spread across 8 files:

| File | Tests | Covers |
|---|---:|---|
| `src/packing.test.js` | 59 | Packing algorithm, gravity, support, no gaps, no overlaps, inside trailer, performance |
| `src/__tests__/inventoryStorage.test.js` | 10 | Inventory CRUD, corrupted JSON, malformed items |
| `src/__tests__/packingStrategies.test.js` | 6 | Strategy Pattern: per-strategy contract, getStrategy, error handling |
| `src/__tests__/App.integration.test.jsx` | 10 | End-to-end flows: boot, create inventory, furniture CRUD, editable input |
| `src/components/__tests__/Modal.test.jsx` | 5 | Conditional render, props, styling |
| `src/components/__tests__/InventoryManagerModal.test.jsx` | 10 | Load, rename, delete, create-empty, snapshot, overwrite |
| `src/components/__tests__/FurnitureEditorModal.test.jsx` | 17 | Validations (unique name, dimensions, volume), save, delete, defensive |
| `src/hooks/__tests__/useHoldRepeat.test.js` | 5 | Immediate press, repeat with interval, release, unmount, dynamic callback |

**Total runtime:** ~5 seconds.

Three.js is mocked in integration tests via `vi.mock('three', …)` so App.jsx is renderable in `jsdom` without real WebGL.

## Author

Jose Antonio Gonzalez Jaga · <joseantoniojaga@hotmail.com>

## License

Private / not distributable.
