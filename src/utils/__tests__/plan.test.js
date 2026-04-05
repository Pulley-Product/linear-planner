import { describe, it, expect } from 'vitest'
import { parsePfx, getOrdered, getEligible, computePlan } from '../plan.js'

// ── Factory helpers ──────────────────────────────────────────────────────────

let _id = 0
const uid = () => `id-${++_id}`

function mkMember(name = 'Alice') {
  return { id: uid(), name, avatarUrl: '' }
}

function mkCycle(startsAt, endsAt, number = 1) {
  return { id: uid(), name: `Cycle ${number}`, startsAt, endsAt, number }
}

function mkIssue(title, { estimate = 3, projectId = 'p1', assigneeId, labels = [], cycleStartsAt } = {}) {
  return {
    id: uid(),
    identifier: `APP-${_id}`,
    title,
    estimate,
    assignee: assigneeId ? { id: assigneeId, name: 'Assigned' } : null,
    project: { id: projectId, name: 'Project' },
    state: { name: 'Todo', type: 'unstarted' },
    labels: { nodes: labels.map(l => ({ id: uid(), name: l, color: '#000' })) },
    cycle: cycleStartsAt ? { id: uid(), startsAt: cycleStartsAt, endsAt: cycleStartsAt, number: 1 } : null,
  }
}

function plan(overrides) {
  const defaults = {
    issues: [],
    projects: [{ id: 'p1', name: 'Project 1' }],
    members: [],
    cycles: [],
    startIso: '2026-01-05',
    orderMap: {},
    initId: 'init1',
    assignMap: {},
    caps: {},
    labelMap: {},
    issueLabels: {},
    projOrder: ['p1'],
    projDeps: {},
    issueDeps: {},
  }
  return computePlan({ ...defaults, ...overrides })
}

// ── parsePfx ─────────────────────────────────────────────────────────────────

describe('parsePfx', () => {
  it('parses simple [N] prefix', () => {
    expect(parsePfx('[1] Setup')).toBeLessThan(parsePfx('[2] Build'))
  })

  it('parses decimal [N.M] prefix', () => {
    const a = parsePfx('[2.1] Sub-task A')
    const b = parsePfx('[2.2] Sub-task B')
    expect(a).toBeLessThan(b)
    expect(parsePfx('[2] Parent')).toBeLessThan(a)
  })

  it('returns Infinity for no prefix', () => {
    expect(parsePfx('No prefix')).toBe(Infinity)
    expect(parsePfx('')).toBe(Infinity)
    expect(parsePfx(null)).toBe(Infinity)
  })
})

// ── getOrdered ───────────────────────────────────────────────────────────────

describe('getOrdered', () => {
  it('sorts by [N] prefix when present', () => {
    const issues = [
      mkIssue('[3] Third'),
      mkIssue('[1] First'),
      mkIssue('[2] Second'),
    ]
    const ordered = getOrdered(issues, issues[0].project.id, {}, 'init1')
    expect(ordered.map(i => i.title)).toEqual(['[1] First', '[2] Second', '[3] Third'])
  })

  it('uses saved order from orderMap when provided', () => {
    const issues = [mkIssue('A'), mkIssue('B'), mkIssue('C')]
    const orderMap = { init1: { [issues[0].project.id]: [issues[2].id, issues[0].id, issues[1].id] } }
    const ordered = getOrdered(issues, issues[0].project.id, orderMap, 'init1')
    expect(ordered.map(i => i.title)).toEqual(['C', 'A', 'B'])
  })

  it('appends unsaved issues after saved order', () => {
    const issues = [mkIssue('A'), mkIssue('B'), mkIssue('New')]
    const orderMap = { init1: { [issues[0].project.id]: [issues[1].id, issues[0].id] } }
    const ordered = getOrdered(issues, issues[0].project.id, orderMap, 'init1')
    expect(ordered.map(i => i.title)).toEqual(['B', 'A', 'New'])
  })

  it('returns original order when no prefix and no saved order', () => {
    const issues = [mkIssue('X'), mkIssue('Y'), mkIssue('Z')]
    const ordered = getOrdered(issues, issues[0].project.id, {}, 'init1')
    expect(ordered.map(i => i.title)).toEqual(['X', 'Y', 'Z'])
  })
})

// ── getEligible ──────────────────────────────────────────────────────────────

describe('getEligible', () => {
  it('returns all members when issue has no labels', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issue = mkIssue('No labels')
    const result = getEligible(issue, [m1, m2], {}, {})
    expect(result).toHaveLength(2)
  })

  it('filters members by label mapping', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issue = mkIssue('Frontend', { labels: ['frontend'] })
    const labelMap = { frontend: [m1.id] }
    const result = getEligible(issue, [m1, m2], labelMap, {})
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(m1.id)
  })

  it('uses issueLabels override', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issue = mkIssue('Task')
    const labelMap = { backend: [m2.id] }
    const issueLabels = { [issue.id]: 'backend' }
    const result = getEligible(issue, [m1, m2], labelMap, issueLabels)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(m2.id)
  })

  it('returns empty when label has no mapped members', () => {
    const m1 = mkMember('Alice')
    const issue = mkIssue('Orphan', { labels: ['design'] })
    const labelMap = { frontend: [m1.id] }
    const result = getEligible(issue, [m1], labelMap, {})
    expect(result).toHaveLength(0)
  })
})

// ── computePlan ──────────────────────────────────────────────────────────────

describe('computePlan', () => {
  const C1 = '2026-01-05'
  const C1E = '2026-01-18'
  const C2 = '2026-01-19'
  const C2E = '2026-02-01'
  const C3 = '2026-02-02'
  const C3E = '2026-02-15'

  function twoCycles() {
    return [mkCycle(C1, C1E, 1), mkCycle(C2, C2E, 2)]
  }

  function threeCycles() {
    return [mkCycle(C1, C1E, 1), mkCycle(C2, C2E, 2), mkCycle(C3, C3E, 3)]
  }

  it('schedules a single issue to a single member', () => {
    const m = mkMember()
    const issue = mkIssue('Task', { estimate: 5 })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
    })
    expect(result.sc).toHaveLength(1)
    expect(result.sc[0]._m.id).toBe(m.id)
    expect(result.sc[0]._pts).toBe(5)
    expect(result.sc[0]._ci).toBe(0)
    expect(result.unscheduled).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('splits large issues across cycles', () => {
    const m = mkMember()
    const issue = mkIssue('Big Task', { estimate: 15 })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
      caps: { init1: { [m.id]: 10 } },
    })
    expect(result.sc).toHaveLength(2)
    expect(result.sc[0]._pts).toBe(10)
    expect(result.sc[1]._pts).toBe(5)
    expect(result.splits[issue.id]).toHaveLength(2)
  })

  it('marks issues as unscheduled when capacity is exhausted', () => {
    const m = mkMember()
    const issue = mkIssue('Huge Task', { estimate: 25 })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
      caps: { init1: { [m.id]: 10 } },
    })
    expect(result.unscheduled).toHaveLength(1)
    expect(result.unscheduled[0]._remaining).toBe(5)
  })

  it('respects project dependencies', () => {
    const m = mkMember()
    const issueA = mkIssue('Task A', { estimate: 5, projectId: 'p1' })
    const issueB = mkIssue('Task B', { estimate: 5, projectId: 'p2' })
    const result = plan({
      issues: [issueA, issueB],
      projects: [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }],
      members: [m],
      cycles: threeCycles(),
      projOrder: ['p1', 'p2'],
      projDeps: { p2: ['p1'] },
    })
    // P2's issue must start after P1's issue finishes
    const aEntry = result.sc.find(s => s.id === issueA.id)
    const bEntry = result.sc.find(s => s.id === issueB.id)
    expect(bEntry._ci).toBeGreaterThan(aEntry._ci)
  })

  it('respects issue dependencies', () => {
    const m = mkMember()
    const issueA = mkIssue('Dep', { estimate: 5 })
    const issueB = mkIssue('Blocked', { estimate: 5 })
    const result = plan({
      issues: [issueA, issueB],
      members: [m],
      cycles: threeCycles(),
      issueDeps: { [issueB.id]: [issueA.id] },
    })
    const aEntry = result.sc.find(s => s.id === issueA.id)
    const bEntry = result.sc.find(s => s.id === issueB.id)
    expect(bEntry._ci).toBeGreaterThan(aEntry._ci)
  })

  it('distributes work across members', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issues = [
      mkIssue('Task 1', { estimate: 8 }),
      mkIssue('Task 2', { estimate: 8 }),
    ]
    const result = plan({
      issues,
      members: [m1, m2],
      cycles: twoCycles(),
    })
    const assigned = new Set(result.sc.map(s => s._m.id))
    expect(assigned.size).toBe(2)
  })

  it('uses explicit member assignment from assignMap', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issue = mkIssue('Assigned Task', { estimate: 3 })
    const result = plan({
      issues: [issue],
      members: [m1, m2],
      cycles: twoCycles(),
      assignMap: { init1: { [issue.id]: m2.id } },
    })
    expect(result.sc[0]._m.id).toBe(m2.id)
  })

  it('respects Linear assignee when no override', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issue = mkIssue('Pre-assigned', { estimate: 3, assigneeId: m1.id })
    const result = plan({
      issues: [issue],
      members: [m1, m2],
      cycles: twoCycles(),
    })
    expect(result.sc[0]._m.id).toBe(m1.id)
  })

  it('places committed issues in pass 1 at their cycle', () => {
    const m = mkMember()
    const issue = mkIssue('Committed', { estimate: 5, cycleStartsAt: C2 })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
    })
    expect(result.sc[0]._ci).toBe(1) // cycle index 1 = C2
    expect(result.sc[0]._committed).toBe(true)
  })

  it('skips committed issues in past cycles', () => {
    const m = mkMember()
    // Issue committed to cycle 1, but startCI is cycle 2 — so it's in the past
    const issue = mkIssue('Old', { estimate: 5, cycleStartsAt: C1 })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: threeCycles(),
      startIso: C2, // start from cycle 2, so cycle 1 is "past"
    })
    // Committed to past cycle (C1) and not picked up in pass 2 either
    // since it's still committed to a known cycle, pass 2 skips it
    expect(result.sc).toHaveLength(0)
  })

  it('reports errors for issues with no eligible members', () => {
    const m = mkMember()
    const issue = mkIssue('Orphan', { estimate: 3, labels: ['design'] })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
      labelMap: { frontend: [m.id] },
    })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]._error).toBe('No eligible team member')
  })

  it('respects per-member capacity', () => {
    const m = mkMember()
    const issue = mkIssue('Task', { estimate: 3 })
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
      caps: { init1: { [m.id]: 3 } },
    })
    expect(result.sc).toHaveLength(1)
    expect(result.sc[0]._pts).toBe(3)
    expect(result.mems[0].cap).toBe(3)
  })

  it('defaults estimate to 1 when missing', () => {
    const m = mkMember()
    const issue = mkIssue('No estimate', { estimate: undefined })
    issue.estimate = undefined
    const result = plan({
      issues: [issue],
      members: [m],
      cycles: twoCycles(),
    })
    expect(result.sc).toHaveLength(1)
    expect(result.sc[0]._pts).toBe(1)
  })

  it('handles empty inputs gracefully', () => {
    const result = plan({
      issues: [],
      members: [],
      cycles: [],
    })
    expect(result.sc).toHaveLength(0)
    expect(result.unscheduled).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('processes projects in projOrder priority', () => {
    const m = mkMember()
    const issueA = mkIssue('From P2', { estimate: 8, projectId: 'p2' })
    const issueB = mkIssue('From P1', { estimate: 8, projectId: 'p1' })
    const result = plan({
      issues: [issueA, issueB],
      projects: [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }],
      members: [m],
      cycles: twoCycles(),
      projOrder: ['p2', 'p1'], // P2 first
    })
    // P2's issue should be scheduled first (cycle 0)
    const p2Entry = result.sc.find(s => s.project.id === 'p2')
    const p1Entry = result.sc.find(s => s.project.id === 'p1')
    expect(p2Entry._ci).toBeLessThanOrEqual(p1Entry._ci)
  })

  it('auto-assigns by label mapping', () => {
    const m1 = mkMember('Alice')
    const m2 = mkMember('Bob')
    const issue = mkIssue('FE work', { estimate: 3, labels: ['frontend'] })
    const result = plan({
      issues: [issue],
      members: [m1, m2],
      cycles: twoCycles(),
      labelMap: { frontend: [m1.id] },
    })
    expect(result.sc[0]._m.id).toBe(m1.id)
  })

  it('committed work blocks capacity for pass 2 issues', () => {
    const m = mkMember()
    const committed = mkIssue('Sprint work', { estimate: 10, cycleStartsAt: C1 })
    const newIssue = mkIssue('New work', { estimate: 5 })
    const result = plan({
      issues: [committed, newIssue],
      members: [m],
      cycles: twoCycles(),
      caps: { init1: { [m.id]: 10 } },
    })
    // Committed takes all of cycle 0, new work goes to cycle 1
    const newEntry = result.sc.find(s => s.id === newIssue.id)
    expect(newEntry._ci).toBe(1)
  })
})
