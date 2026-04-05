# Linear Initiative Planner

Internal planning tool that generates forward-looking delivery plans from Linear data, respecting team capacity, skill assignments, dependencies, and committed work.

## Quick Reference

```bash
npm start          # Run proxy + dev server (localhost:5173)
npm run dev        # Vite dev server only
npm run proxy      # CORS proxy only (localhost:3131)
npm run build      # Production build to dist/
npm test           # Run Vitest unit tests
```

## Tech Stack

- **React 18** (no TypeScript) with **Vite 5**
- **Inline styles only** — no CSS files, no Tailwind
- **No state library** — React hooks (`useState`, `useRef`, `useCallback`) in App.jsx
- **localStorage** for persistence (key: `linear-planner-v1`)
- **xlsx** for Excel export
- **Vitest** for unit tests

## Architecture

### 12-Step Wizard Flow

```
Step 0  StepConnect.jsx        → API key, fetch Linear data
Step 1  StepSetup.jsx          → Pick team & members
Step 2  StepSetup.jsx          → Pick start cycle
Step 3  StepSetup.jsx          → Select initiatives (grouped by status tabs)
Step 4  StepSetup.jsx          → Select projects from initiatives
Step 5  StepSetup.jsx          → Drag projects into priority order, set project deps
Step 6  StepSetup.jsx          → Filter issue states (backlog, started, etc.)
Step 7  StepSetup.jsx          → Label & estimate issues (labels optional)
Step 8  StepOrder.jsx          → Drag-order issues within projects, set issue deps
Step 9  StepSetup.jsx          → Map labels → team members
Step 10 StepEstimatesCapacity  → Set pts/cycle capacity per member
Step 11 PlanView.jsx           → Output: spreadsheet view + .xlsx export
```

### Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main state management, step routing, persistence |
| `src/utils/plan.js` | **Core scheduling algorithm** (pure function, no React) |
| `src/utils/linear.js` | Linear GraphQL queries |
| `src/utils/storage.js` | localStorage wrapper |
| `src/components/ui.jsx` | Design system: buttons, cards, avatars |
| `src/components/StepSetup.jsx` | Steps 1-7 and 9 (wizard setup screens) |
| `src/components/StepOrder.jsx` | Step 8 (issue ordering + dependencies) |
| `src/components/PlanView.jsx` | Step 11 (plan output + Excel export) |
| `proxy.js` | Node.js CORS proxy for Linear API |

### Scheduling Algorithm (`src/utils/plan.js`)

**Two-pass algorithm:**

1. **Pass 1 — Committed work:** Places issues already assigned to a Linear cycle. These lock in capacity before anything else is scheduled.
2. **Pass 2 — New work:** Processes projects in priority order, issues in user-defined order. Respects project deps, issue deps, label-based member eligibility, and capacity constraints. Splits issues across cycles when a single cycle doesn't have enough capacity.

**Key functions:**
- `computePlan({...})` — Main entry point, returns scheduled items, splits, unscheduled, errors
- `parsePfx(title)` — Extracts `[N]` prefix from issue titles for auto-ordering
- `getOrdered(issues, projectId, orderMap, initId)` — Returns issues in user or `[N]` order
- `getEligible(issue, members, labelMap, issueLabels)` — Returns members eligible by label mapping

**Member selection priority:** explicit override → Linear assignee → auto-pick (by label eligibility, earliest finish, then least total work).

### Data Flow

- Linear API → `proxy.js` (CORS) → `StepConnect` fetches initiatives, teams, issues
- Issues carry: `id, identifier, title, estimate, assignee, project, state, labels, cycle`
- Labels are optional — they control auto-assignment via the label→member mapping step
- `computePlan()` is a pure function called at step 11 with all collected state

### Persistence

- **Persisted (localStorage):** team, cycle, initiatives, projects, project order/deps, issue deps, label map, capacity, issue states
- **Session-only (resets on reload):** issue estimates, labels, member assignments, issue order

## Conventions

- All styling is inline (no CSS files) — use the style objects and helpers from `ui.jsx`
- Component props use short names: `selInits`, `setSelInits`, `onNext`, `onBack`
- State setter patterns: `setXxxRaw` for direct state, `setXxx` for state + persist
- Colors: `#1a1a2e` (dark), `#e63946` (red/accent), `#2d6a4f` (green/success), `#9a9a9e` (muted)
- Font: DM Sans (body), monospace (badges, counts, identifiers)
- The `init.id` is a composite key derived from selected project IDs (not a Linear initiative ID)

## Testing

Tests live in `src/utils/__tests__/`. Run with `npm test`.

The scheduling algorithm (`plan.js`) is the critical path — any changes to scheduling logic should include test updates. Tests use factory helpers (`mkIssue`, `mkMember`, `mkCycle`) to build minimal test fixtures.
