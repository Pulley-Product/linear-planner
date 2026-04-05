# Linear Initiative Planner

An internal planning tool that connects to your Linear workspace and generates a forward-looking delivery plan across cycles — respecting team capacity, label-based skill assignments, project priority ordering, issue dependencies, and committed work (PTO, on-call, etc.).

---

## Quick Start

```bash
git clone https://github.com/Pulley-Product/linear-planner.git
cd linear-planner
npm install
npm start
```

Open http://localhost:5173 and paste your Linear API key.

To get your API key: **linear.app → Settings → Security & Access → Personal API Keys → New API Key** (select read-only permissions).

---

## What it does

The planner guides you through a step-by-step wizard:

1. **Connect** — paste your Linear API key (stored locally in your browser only)
2. **Team & Members** — pick the team and select which members to include in the plan
3. **Start Cycle** — choose which cycle planning starts from
4. **Initiatives** — select which initiatives to plan
5. **Projects** — pick specific projects from those initiatives
6. **Project Priority** — drag projects into priority order and set project dependencies
7. **Issue States** — filter which issue states to include (backlog, started, etc.)
8. **Label & Estimate** — set labels, estimates, and member assignments for each issue
9. **Order Issues** — drag to reorder issues within each project, set issue dependencies
10. **Labels > Team Members** — map labels to team members (who can work on what)
11. **Capacity** — set story points per cycle for each team member
12. **Plan** — generate the forward plan with a spreadsheet view and downloadable .xlsx

---

## Prepare your Linear workspace

For best results, set up the following in Linear before generating a plan:

- **Add estimates** to issues — the planner uses story points to allocate work across cycles
- **Add labels** like `frontend`, `backend`, `design` — during planning you'll map these to team members so the planner knows who can work on what
- **Use [N] prefixes** in issue titles for ordering — e.g. `[1] Set up auth`, `[2] Build dashboard`, `[2.1] Dashboard UI`
- **Create an initiative for capacity constraints** (e.g. "OnCall/PTO/Holiday/Other") with projects for on-call rotations, PTO, and holidays. Add issues for each person's known absences, assign them to the right person and cycle, and set estimates. The planner will schedule around these.
- **Assign issues to cycles** for any committed/in-progress work — the planner respects these and schedules remaining work around them

---

## How the scheduling algorithm works

The planner works in two passes:

**Pass 1 — Committed work first:** All issues already assigned to a cycle in Linear (PTO, on-call, in-progress work) are placed first. This blocks capacity so the planner knows what time is actually available.

**Pass 2 — Schedule everything else:** Projects are processed in priority order. Within each project, issues are processed in your chosen order. For each issue:
- It finds the earliest possible cycle (respecting project and issue dependencies)
- It picks who should do it (your explicit assignment, the Linear assignee, or auto-pick by label)
- It fills their available capacity, splitting across cycles if needed
- No member ever exceeds their capacity in any cycle

---

## What gets saved between sessions

**Persisted** (survives reload): team selection, cycle, initiatives, projects, project order & dependencies, issue dependencies, issue states, label-to-member mappings, member capacity.

**Session only** (resets on reload): labels, estimates, member assignments, issue ordering — these always come fresh from Linear. Changes made during planning are for that session only.

---

## Architecture

```
Browser (React app on localhost:5173)
    ↓  fetch to localhost:3131
proxy.js (Node.js CORS proxy, runs locally)
    ↓  forwards to
api.linear.app (Linear's GraphQL API)
```

Your API key and all data stay on your machine. Nothing is sent to any third party.

---

## Requirements

- Node.js 18 or higher
- A Linear workspace with initiatives, projects, and active cycles
- A Linear Personal API Key (read-only)

---

## Getting back up and running

If the server is down and you need to start it again:

```bash
cd ~/linear-planner
npm start
```

Then open http://localhost:5173. Your saved selections (team, initiatives, projects, etc.) are still in your browser's localStorage — you just need to reconnect with your API key.

If you're on a new machine or the repo isn't cloned yet:

```bash
git clone https://github.com/Pulley-Product/linear-planner.git
cd linear-planner
npm install
npm start
```

---

## Making changes with Claude Code

To modify this app using Claude Code:

1. **Open your terminal** and navigate to the project:
   ```bash
   cd ~/linear-planner
   ```

2. **Start Claude Code**:
   ```bash
   claude
   ```

3. **Ask Claude to make changes** — for example:
   - "Add a new column to the plan view"
   - "Change the capacity default from 10 to 8"
   - "Add a filter for issue priority"

4. **Test your changes** — the dev server auto-reloads:
   ```bash
   npm start
   ```
   Open http://localhost:5173 and verify.

5. **Commit and push** when happy:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```

   Or just ask Claude: "commit and push to GitHub"

### Key files to know

| File | What it does |
|------|-------------|
| `src/App.jsx` | Main app — step flow, state management, step transitions |
| `src/utils/plan.js` | Scheduling algorithm (pure function, no UI) |
| `src/components/PlanView.jsx` | Plan output — spreadsheet table, .xlsx export |
| `src/components/StepSetup.jsx` | Most wizard steps (team, initiatives, projects, labels, etc.) |
| `src/components/StepOrder.jsx` | Issue ordering step with drag-and-drop and dependencies |
| `src/components/StepConnect.jsx` | Connect screen with API key input and prep guide |
| `src/utils/linear.js` | Linear API GraphQL queries |
| `proxy.js` | Local CORS proxy for Linear API |

---

## License

Internal use. Contact Tamar Shor with questions.
