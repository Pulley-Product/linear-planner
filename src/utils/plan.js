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
  blocked,
  projDeps,
}) {
  const getCap = mid => caps[initId]?.[mid] ?? 10
  const getAssign = id => assignMap[initId]?.[id] ?? null

  const mems = members.map((m, i) => ({ ...m, i, cap: getCap(m.id), cp: {} }))
  const byMid = Object.fromEntries(mems.map(m => [m.id, m]))

  const sortedCycles = [...cycles].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))

  const dateToCI = isoDate => {
    if (!isoDate || !sortedCycles.length) return 0
    const d = new Date(isoDate)
    for (let ci = 0; ci < sortedCycles.length; ci++) {
      if (d >= new Date(sortedCycles[ci].startsAt) && d <= new Date(sortedCycles[ci].endsAt)) return ci
    }
    if (d < new Date(sortedCycles[0].startsAt)) return 0
    return sortedCycles.length - 1
  }

  const startCI = startIso ? dateToCI(startIso) : 0

  const committedCI = {}
  issues.forEach(i => {
    if (i.cycle?.startsAt) committedCI[i.id] = dateToCI(i.cycle.startsAt)
  })

  const getOrderedProjIds = () => {
    const visited = new Set(), result = []
    const visit = id => {
      if (visited.has(id)) return
      visited.add(id)
      ;(projDeps[id] || []).forEach(dep => visit(dep))
      result.push(id)
    }
    projects.forEach(p => visit(p.id))
    return result
  }

  const eligible = (issue) => getEligible(issue, members, labelMap, issueLabels).map(m => byMid[m.id]).filter(Boolean)

  const bestMember = (issue, pinnedId) => {
    if (pinnedId && byMid[pinnedId]) return byMid[pinnedId]
    const pool = eligible(issue).length ? eligible(issue) : mems
    return pool.reduce((b, m) => {
      const tb = Object.values(b.cp).reduce((a, x) => a + x, 0)
      const tm = Object.values(m.cp).reduce((a, x) => a + x, 0)
      return tm < tb ? m : b
    }, pool[0])
  }

  const findCycle = (member, pts, minCI) => {
    for (let ci = minCI; ci < minCI + 52; ci++) {
      if ((member.cp[ci] || 0) + pts <= member.cap) return ci
    }
    return minCI + 52
  }

  const sc = []
  const projLastCI = {}

  getOrderedProjIds().forEach(pid => {
    const proj = projects.find(p => p.id === pid)
    if (!proj) return

    const minCI = (projDeps[pid] || []).reduce((mx, depId) => {
      return Math.max(mx, (projLastCI[depId] ?? startCI - 1) + 1)
    }, startCI)

    getOrdered(issues, pid, orderMap, initId).forEach(issue => {
      if (blocked[issue.id] != null && blocked[issue.id] !== '') return

      const pts = issue.estimate || 1

      if (committedCI[issue.id] !== undefined) {
        const ci = committedCI[issue.id]
        const m = bestMember(issue, getAssign(issue.id))
        sc.push({ ...issue, _m: m, _ci: ci, _pts: pts, _committed: true })
        projLastCI[pid] = Math.max(projLastCI[pid] ?? 0, ci)
        return
      }

      const m = bestMember(issue, getAssign(issue.id))
      if (!m) return

      const ci = findCycle(m, pts, minCI)
      m.cp[ci] = (m.cp[ci] || 0) + pts
      sc.push({ ...issue, _m: m, _ci: ci, _pts: pts, _committed: false })
      projLastCI[pid] = Math.max(projLastCI[pid] ?? 0, ci)
    })
  })

  const blockedList = issues.filter(i => blocked[i.id] != null && blocked[i.id] !== '')
  return { sc, mems, blockedList, cycles: sortedCycles, startCI, projLastCI }
}
