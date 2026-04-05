// Core scheduling algorithm — pure function, no React dependencies

export function parsePfx(title) {
  const m = (title || '').match(/^\[(\d+(?:\.\d+)*)\]/)
  if (!m) return Infinity
  return m[1].split('.').map(Number).reduce((acc, p, i) => acc + p * Math.pow(1000, 3 - i), 0)
}

export function getOrdered(issues, projectId, orderMap, initId) {
  const sv = orderMap[initId]?.[projectId]
  const base = issues.filter(i => i.project?.id === projectId)
  if (!sv) {
    const hasPfx = base.some(i => parsePfx(i.title) < Infinity)
    if (hasPfx) return [...base].sort((a, b) => parsePfx(a.title) - parsePfx(b.title))
    return base
  }
  const byId = Object.fromEntries(base.map(i => [i.id, i]))
  return [...sv.map(id => byId[id]).filter(Boolean), ...base.filter(i => !sv.includes(i.id))]
}

export function getEligible(issue, members, labelMap, issueLabels) {
  const lbls = [
    ...(issue.labels?.nodes || []).map(l => l.name),
    ...(issueLabels[issue.id] ? [issueLabels[issue.id]] : []),
  ]
  if (!lbls.length) return members
  const el = new Set()
  lbls.forEach(l => (labelMap[l] || []).forEach(mid => el.add(mid)))
  return members.filter(m => el.has(m.id))
}

export function computePlan({
  issues,
  projects,
  members,
  cycles,
  startIso,
  orderMap,
  initId,
  assignMap,
  caps,
  labelMap,
  issueLabels,
  projOrder,
  projDeps,
  issueDeps,
}) {
  const getCap = mid => caps[initId]?.[mid] ?? 10
  const getAssign = id => assignMap[initId]?.[id] ?? null

  const mems = members.map((m, i) => ({ ...m, i, cap: getCap(m.id), cp: {} }))
  const byMid = Object.fromEntries(mems.map(m => [m.id, m]))

  const sortedCycles = [...cycles].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const maxCI = sortedCycles.length - 1 // last available cycle index

  const dateToCI = isoDate => {
    if (!isoDate || !sortedCycles.length) return 0
    const d = new Date(isoDate)
    for (let ci = 0; ci < sortedCycles.length; ci++) {
      if (d >= new Date(sortedCycles[ci].startsAt) && d <= new Date(sortedCycles[ci].endsAt)) return ci
    }
    if (d < new Date(sortedCycles[0].startsAt)) return 0
    return sortedCycles.length - 1
  }

  // Find startCI by matching the startIso date to a cycle's startsAt directly
  let startCI = 0
  if (startIso) {
    const idx = sortedCycles.findIndex(c => c.startsAt === startIso)
    startCI = idx >= 0 ? idx : dateToCI(startIso)
  }

  // Identify committed issues (those with a Linear cycle assignment)
  const committedCI = {}
  issues.forEach(i => {
    if (i.cycle?.startsAt) committedCI[i.id] = dateToCI(i.cycle.startsAt)
  })

  // Helper: find the member for an issue (user-assigned or auto-pick by label)
  const eligible = (issue) => getEligible(issue, members, labelMap, issueLabels).map(m => byMid[m.id]).filter(Boolean)

  const pickMember = (issue, minCI) => {
    const pinnedId = getAssign(issue.id)
    if (pinnedId && pinnedId !== '__auto__' && byMid[pinnedId]) return byMid[pinnedId]
    // If no explicit override and not set to Auto, respect Linear assignee
    if (!pinnedId && issue.assignee?.id && byMid[issue.assignee.id]) return byMid[issue.assignee.id]
    // Auto-pick from eligible members by label
    const pool = eligible(issue)
    if (!pool.length) return null // no eligible members — error case
    const pts = issue.estimate || 1
    return pool.reduce((best, m) => {
      const lastBest = simulateLastCycle(best, pts, minCI)
      const lastM = simulateLastCycle(m, pts, minCI)
      return lastM < lastBest ? m : best
    }, pool[0])
  }

  // Simulate placing pts on a member from minCI, return the last cycle used
  const simulateLastCycle = (member, pts, minCI) => {
    let remaining = pts
    let ci = minCI
    while (remaining > 0 && ci <= maxCI) {
      const avail = member.cap - (member.cp[ci] || 0)
      if (avail <= 0) { ci++; continue }
      remaining -= Math.min(remaining, avail)
      if (remaining > 0) ci++
    }
    return remaining > 0 ? maxCI + 1 : ci // return beyond maxCI if can't fit
  }

  // Place an issue on a member, splitting across cycles. Returns { splits, remaining }
  const placeIssue = (member, pts, startFrom) => {
    let remaining = pts
    let ci = startFrom
    const issueSplits = []
    while (remaining > 0 && ci <= maxCI) {
      const avail = member.cap - (member.cp[ci] || 0)
      if (avail <= 0) { ci++; continue }
      const take = Math.min(remaining, avail)
      member.cp[ci] = (member.cp[ci] || 0) + take
      issueSplits.push({ ci, pts: take })
      remaining -= take
      if (remaining > 0) ci++
    }
    return { splits: issueSplits, remaining }
  }

  const sc = []           // { ...issue, _m, _ci, _pts, _committed } — one entry per split
  const splits = {}       // { issueId -> [{ ci, pts }] } — for spreadsheet view
  const projLastCI = {}
  const issueLastCI = {}  // { issueId -> lastCycleIndex } — for issue-level dependencies
  const unscheduled = []  // issues that couldn't fit in available cycles
  const errors = []       // issues with no eligible members

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 1: Place all committed issues first
  // These are issues already assigned to a cycle in Linear.
  // They get placed regardless of project order, issue order, or dependencies.
  // This establishes the capacity landscape before we schedule anything new.
  // ═══════════════════════════════════════════════════════════════════════════

  const committedIssueIds = new Set()

  issues.forEach(issue => {
    if (committedCI[issue.id] === undefined) return // not committed
    if (committedCI[issue.id] < startCI) return // committed to a past cycle — skip

    committedIssueIds.add(issue.id)
    const totalPts = issue.estimate || 1
    const ci = committedCI[issue.id]

    // Pick member: user-assigned first, then auto-pick
    const m = pickMember(issue, ci)
    if (!m) {
      errors.push({ ...issue, _error: 'No eligible team member' })
      return
    }

    // Place at the committed cycle, spill forward if needed
    const result = placeIssue(m, totalPts, ci)
    splits[issue.id] = result.splits

    if (result.remaining > 0) {
      unscheduled.push({ ...issue, _m: m, _scheduled: totalPts - result.remaining, _remaining: result.remaining })
    }

    result.splits.forEach(({ ci: splitCI, pts }) => {
      sc.push({ ...issue, _m: m, _ci: splitCI, _pts: pts, _committed: true })
    })

    // Track for dependency resolution in pass 2
    const lastCI = result.splits.length ? result.splits[result.splits.length - 1].ci : ci
    issueLastCI[issue.id] = lastCI
    if (issue.project?.id) {
      projLastCI[issue.project.id] = Math.max(projLastCI[issue.project.id] ?? 0, lastCI)
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 2: Schedule remaining (non-committed) issues
  // Process projects in priority order, issues in user-defined order.
  // Respect project dependencies and issue dependencies.
  // Never schedule before the start cycle.
  // ═══════════════════════════════════════════════════════════════════════════

  const getOrderedProjIds = () => {
    const extra = projects.filter(p => !projOrder.includes(p.id)).map(p => p.id)
    return [...projOrder.filter(id => projects.some(p => p.id === id)), ...extra]
  }

  getOrderedProjIds().forEach(pid => {
    const proj = projects.find(p => p.id === pid)
    if (!proj) return

    // Project dependency: can't start before all dependency projects finish
    const projMinCI = (projDeps[pid] || []).reduce((mx, depId) => {
      return Math.max(mx, (projLastCI[depId] ?? startCI - 1) + 1)
    }, startCI)

    getOrdered(issues, pid, orderMap, initId).forEach(issue => {
      // Skip committed issues — already handled in pass 1
      if (committedIssueIds.has(issue.id)) return
      // Skip issues committed to past cycles
      if (committedCI[issue.id] !== undefined && committedCI[issue.id] < startCI) return

      const totalPts = issue.estimate || 1

      // Calculate earliest start: project deps + issue deps, never before startCI
      let minCI = Math.max(projMinCI, startCI)
      ;(issueDeps[issue.id] || []).forEach(depId => {
        if (issueLastCI[depId] !== undefined) {
          minCI = Math.max(minCI, issueLastCI[depId] + 1)
        }
      })

      // Pick member
      const m = pickMember(issue, minCI)
      if (!m) {
        errors.push({ ...issue, _error: 'No eligible team member' })
        return
      }

      // Place the issue
      const result = placeIssue(m, totalPts, minCI)
      splits[issue.id] = result.splits

      if (result.remaining > 0) {
        unscheduled.push({ ...issue, _m: m, _scheduled: totalPts - result.remaining, _remaining: result.remaining })
      }

      result.splits.forEach(({ ci: splitCI, pts }) => {
        sc.push({ ...issue, _m: m, _ci: splitCI, _pts: pts, _committed: false })
      })

      // Track for future dependencies
      const lastCI = result.splits.length ? result.splits[result.splits.length - 1].ci : minCI
      issueLastCI[issue.id] = lastCI
      projLastCI[pid] = Math.max(projLastCI[pid] ?? 0, lastCI)
    })
  })

  return { sc, splits, mems, cycles: sortedCycles, startCI, projLastCI, unscheduled, errors }
}
