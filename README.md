# Linear Initiative Planner

An internal planning tool that connects to your Linear workspace and generates a forward-looking delivery plan across cycles — respecting team capacity, label-based skill assignments, project priority ordering, and issue priorities.

---

## What it does

1. Connects live to your Linear workspace via a local proxy (no data leaves your machine)
2. Lets you pick a team, a start cycle, and which initiatives to plan
3. Maps issue labels (e.g. "frontend", "backend") to team members
4. Auto-sorts issues by `[N]` prefix in the title (e.g. `[1] Build login`, `[2] Add dashboard`)
5. Lets you drag to reorder, pin assignees, mark issues as blocked, and set estimates
6. Generates a cycle-based plan grid: one row per person, one column per cycle, colour-coded by project

---

## Requirements

- Node.js 18 or higher (`node --version` to check)
- A Linear workspace with at least one initiative and active cycles
- A Linear Personal API Key (read-only)

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd linear-planner
npm install
```

### 2. Create your Linear API key

1. Go to **linear.app → Settings → API → Personal API Keys**
2. Click **Create key**, give it a name like "Planner"
3. **Important: select read-only permissions only**
4. Copy the key — you'll paste it into the app

### 3. Run the app

Open **two terminal tabs**:

**Tab 1 — start the proxy:**
```bash
npm run proxy
```
You should see: `✅ Linear proxy running on http://localhost:3131`

**Tab 2 — start the app:**
```bash
npm run dev
```

Open your browser at **http://localhost:5173**

### 4. First time use

1. Paste your API key and click Connect
2. Pick your team, start cycle, and initiatives
3. Map labels to team members
4. Set issue estimates and drag to order
5. Generate your plan

Your ordering, assignments, and capacity settings are saved in your browser's localStorage automatically.

---

## Issue ordering

Add a `[N]` prefix to issue titles in Linear to control priority order:

```
[1] Set up authentication
[2] Build dashboard
[2.1] Dashboard data layer
[2.2] Dashboard UI
[3] Write tests
```

The planner auto-sorts by these numbers. No manual dragging needed. Gaps are fine — `[1]`, `[5]`, `[10]` works just as well.

---

## Architecture

```
Browser (React app)
    ↓  fetch to localhost:3131
proxy.js (Node.js, runs locally)
    ↓  forwards to
api.linear.app (Linear's API)
```

Your Linear API key and all data stay on your machine. The proxy only runs locally and forwards requests to Linear — nothing is sent to any third party.

---

## Decisions & future improvements

This section documents the current technical decisions and what should be changed when the tool becomes more widely used.

| Area | Current approach | Change when... |
|------|-----------------|----------------|
| **Authentication** | Personal API key per user, stored in localStorage | Switch to **Linear OAuth** with read-only scope — no keys to manage, proper auth flow, users log in via Linear's own login screen |
| **Proxy** | Local `proxy.js` — each user runs it on their own machine | Host a **shared internal proxy** on company infrastructure (e.g. internal server, AWS Lambda) so users just open a URL |
| **Data persistence** | localStorage — per-user, per-browser | Move to a **shared backend** (e.g. a small database) so the team sees the same plan and changes sync across users |
| **Permissions** | API key has access to everything the user can see in Linear | OAuth will scope to read-only; add **project-level filtering** in the app so users can restrict which projects the tool sees |
| **Deployment** | Run locally with `npm run dev` | Host internally so anyone on the team can open a URL without any setup |
| **Issue ordering** | `[N]` prefix in Linear titles | Consider using Linear's native priority field or a custom field instead |
| **Multi-user planning** | Not supported — each user has their own plan | Add collaboration so the team lead's ordering/assignments are shared |

---

## Contributing / extending

The codebase is split into logical components:

```
src/
  App.jsx                        # Main orchestrator — step flow and shared state
  components/
    StepConnect.jsx              # Step 0: Connect to Linear
    StepSetup.jsx                # Steps 1-6: Team, Cycle, Initiatives, Labels, Unlabelled, Proj Order
    StepOrder.jsx                # Step 7: Drag-to-order issues, assign, block
    StepEstimatesCapacity.jsx    # Steps 8-9: Estimates and capacity
    PlanView.jsx                 # Step 10: The plan grid
    ui.jsx                       # Shared design system components
  utils/
    linear.js                    # Linear API calls and GraphQL queries
    plan.js                      # Scheduling algorithm (pure function, no React)
    storage.js                   # localStorage helpers
proxy.js                         # Local CORS proxy (Node.js)
```

The scheduling algorithm in `src/utils/plan.js` is a pure function — easy to test and extend independently of the UI.

---

## License

Internal use. Contact [your name] with questions.
