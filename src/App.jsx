import { useState, useRef, useEffect, useCallback } from 'react'
import { loadStorage, saveStorage } from './utils/storage.js'
import { computePlan, getEligible, getOrdered } from './utils/plan.js'
import StepConnect from './components/StepConnect.jsx'
import { StepTeam, StepCycle, StepInitiatives, StepProjects, StepProjOrder, StepStates, StepLabelMap } from './components/StepSetup.jsx'
import StepConfigureIssues from './components/StepConfigureIssues.jsx'
import { StepCapacity } from './components/StepEstimatesCapacity.jsx'
import PlanView from './components/PlanView.jsx'

// ── Password Gate ────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!pw.trim()) return
    setChecking(true)
    setError('')
    try {
      const resp = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appPassword: pw.trim() }),
      })
      if (resp.ok || resp.status === 404) {
        // 404 = local dev (no /auth endpoint) — skip the gate
        localStorage.setItem('lp-app-password', pw.trim())
        onUnlock()
      } else {
        setError('Wrong password')
      }
    } catch {
      // If /auth 404s (local dev without Vercel), skip the gate
      localStorage.setItem('lp-app-password', pw.trim())
      onUnlock()
    }
    setChecking(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0' }}>
      <form onSubmit={submit} style={{ background: 'white', borderRadius: 12, padding: '40px 36px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', width: 360, textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, background: '#e63946', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: 'white', marginBottom: 16 }}>LP</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 4 }}>Initiative Planner</div>
        <div style={{ fontSize: 12, color: '#9a9a9e', marginBottom: 24 }}>Enter the team password to continue</div>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 14, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        {error && <div style={{ color: '#e63946', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <button type="submit" disabled={checking} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: '#1a1a2e', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

// Steps: 0=connect 1=team 2=cycle 3=initiatives 4=projects 5=projpriority 6=states
//        7=configure 8=labels>members 9=capacity 10=plan
const STEPS = ['Connect','Team & Members','Start Cycle','Initiatives','Projects','Project Priority','Issue States','Configure Issues','Labels > Team Members','Capacity','Plan']

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('lp-app-password'))
  const [step, setStepRaw] = useState(0)
  const [err, setErr]   = useState('')
  const mainRef = useRef(null)
  const setStep = (s) => { setStepRaw(s); saveStorage({ step: s }); setTimeout(() => mainRef.current?.scrollTo(0, 0), 0) }

  // From Linear
  const [apiKey, setApiKey]       = useState('')
  const [allInits, setAllInits]   = useState([])
  const [allTeams, setAllTeams]   = useState([])

  // Selections
  const [selTeamId, setSelTeamIdRaw] = useState(null)
  const [selCycleId, setSelCycleIdRaw] = useState(null)
  const [selInits, setSelInitsRaw]  = useState(new Set())
  const [selProjects, setSelProjectsRaw] = useState(new Set())
  const [selStates, setSelStatesRaw] = useState(new Set())

  // Working data
  const [projects, setProjects]       = useState([])
  const [allIssues, setAllIssues]     = useState([])
  const [issues, setIssues]           = useState([])
  const [allMembers, setAllMembers]   = useState([])
  const [selMemberIds, setSelMemberIdsRaw] = useState(new Set())
  const members = allMembers.filter(m => selMemberIds.has(m.id))
  const [chosenInits, setChosenInits] = useState([])
  const [init, setInit]               = useState(null)
  const [startIso, setStartIso]       = useState(null)
  const [excludedIssues, setExcludedIssuesRaw] = useState(new Set())

  // Persisted state
  const [labelMap, setLabelMap]       = useState({})   // { labelName -> [memberId] }
  const [issueLabels, setIssueLabels] = useState({})   // { issueId -> labelName }
  const [projDeps, setProjDeps]       = useState({})   // { projId -> [projId] }
  const [issueDeps, setIssueDeps]     = useState({})   // { issueId -> [issueId] }
  const [linearDepsSet, setLinearDepsSet] = useState({}) // { issueId -> Set<issueId> } — tracks which deps came from Linear (display only)
  const [linearRelationIds, setLinearRelationIds] = useState({}) // { "blockedId::blockerId" -> relationId }
  const [baselineDeps, setBaselineDeps] = useState({}) // issueDeps snapshot after merge — baseline for session diff
  const [crossProjectDeps, setCrossProjectDeps] = useState([]) // [{ blocker, blocked }] — Linear deps across projects (warning only)
  const [projOrder, setProjOrderState] = useState([])  // [projId] in priority order
  const [orderMap, setOrderMap]       = useState({})   // { initId -> { projId -> [issueId] } }
  const [assignMap, setAssignMap]     = useState({})   // { initId -> { issueId -> memberId } }
  const [caps, setCapsState]          = useState({})   // { initId -> { memberId -> pts } }
  const [edits, setEdits]             = useState({})   // { issueId -> { field -> { original, edited } } } — for future write-back
  const [savedState, setSavedState]   = useState('saved')
  const timer = useRef(null)
  const pendingUpdates = useRef({})

  // Load persisted state on mount
  useEffect(() => {
    const d = loadStorage()
    if (d.labelMap)    setLabelMap(d.labelMap)
    if (d.projDeps)    setProjDeps(d.projDeps)
    if (d.issueDeps)   setIssueDeps(d.issueDeps)
    if (d.projOrder)   setProjOrderState(d.projOrder)
    if (d.selStates)   setSelStatesRaw(new Set(d.selStates))
    if (d.selTeamId)   setSelTeamIdRaw(d.selTeamId)
    if (d.selMemberIds) setSelMemberIdsRaw(new Set(d.selMemberIds))
    if (d.selCycleId)  setSelCycleIdRaw(d.selCycleId)
    if (d.selInits)    setSelInitsRaw(new Set(d.selInits))
    if (d.selProjects) setSelProjectsRaw(new Set(d.selProjects))
    if (d.caps)        setCapsState(d.caps)
    if (d.excludedIssues) setExcludedIssuesRaw(new Set(d.excludedIssues))
  }, [])

  const persist = useCallback((updates) => {
    setSavedState('saving')
    pendingUpdates.current = { ...pendingUpdates.current, ...updates }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      saveStorage(pendingUpdates.current)
      pendingUpdates.current = {}
      setSavedState('saved')
    }, 600)
  }, [])

  const snap = (overrides = {}) => ({
    labelMap, projDeps, issueDeps, projOrder, caps,
    selStates: [...selStates],
    ...overrides,
  })

  const setSelStates = (s) => {
    setSelStatesRaw(s); persist(snap({ selStates: [...s] }))
  }

  const setExcludedIssues = (s) => {
    setExcludedIssuesRaw(s); persist({ excludedIssues: [...s] })
  }

  const setSelTeamId = (id) => {
    setSelTeamIdRaw(id); persist({ selTeamId: id })
  }

  const setSelMemberIds = (s) => {
    setSelMemberIdsRaw(s); persist({ selMemberIds: [...s] })
  }

  const setSelCycleId = (id) => {
    setSelCycleIdRaw(id); persist({ selCycleId: id })
  }

  const setSelInits = (s) => {
    setSelInitsRaw(s); persist({ selInits: [...s] })
  }

  const setSelProjects = (s) => {
    setSelProjectsRaw(s); persist({ selProjects: [...s] })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCap    = mid => caps[init?.id]?.[mid] ?? 10
  const getAssign = id  => assignMap[init?.id]?.[id] ?? null

  const setCap = (mid, v) => {
    const cp = { ...caps, [init.id]: { ...(caps[init.id] || {}), [mid]: parseInt(v) || 10 } }
    setCapsState(cp); persist(snap({ caps: cp }))
  }

  const setAssign = (id, mid) => {
    const am = { ...assignMap, [init.id]: { ...(assignMap[init.id] || {}), [id]: mid || null } }
    setAssignMap(am) // Session only — not persisted
  }

  const saveOrder = (pid, ids) => {
    const om = { ...orderMap, [init.id]: { ...(orderMap[init.id] || {}), [pid]: ids } }
    setOrderMap(om) // In-memory only — not persisted, resets to Linear order next session
  }

  const setEst = (id, v) => setIssues(prev => prev.map(i => i.id === id ? { ...i, estimate: parseInt(v) || 1 } : i))

  const setTitle = (id, title) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, title } : i))
    // If title has a [N] prefix, clear saved order for that project so it re-sorts
    if (/^\[\d+/.test(title)) {
      const issue = issues.find(i => i.id === id)
      if (issue?.project?.id && init?.id) {
        const om = { ...orderMap }
        if (om[init.id]) {
          const { [issue.project.id]: _, ...rest } = om[init.id]
          om[init.id] = rest
        }
        setOrderMap(om)
      }
    }
  }

  const setCycle = (id, cycleId) => {
    const cycle = cycleId ? cycles.find(c => c.id === cycleId) : null
    setIssues(prev => prev.map(i => i.id === id ? { ...i, cycle: cycle ? { id: cycle.id, startsAt: cycle.startsAt, endsAt: cycle.endsAt, number: cycle.number } : null } : i))
  }

  const toggleLabelMember = (label, mid) => {
    const cur = new Set(labelMap[label] || [])
    cur.has(mid) ? cur.delete(mid) : cur.add(mid)
    const lm = { ...labelMap, [label]: [...cur] }
    setLabelMap(lm); persist(snap({ labelMap: lm }))
  }

  const setIssueLabel = (id, label) => {
    const il = { ...issueLabels, [id]: label }
    setIssueLabels(il) // Session only — not persisted
  }

  const setProjOrder = (order) => {
    setProjOrderState(order); persist(snap({ projOrder: order }))
  }

  const toggleProjDep = (projId, depId) => {
    const cur = new Set(projDeps[projId] || [])
    cur.has(depId) ? cur.delete(depId) : cur.add(depId)
    const pd = { ...projDeps, [projId]: [...cur] }
    setProjDeps(pd); persist(snap({ projDeps: pd }))
  }

  const setProjDepsFor = (projId, depIds) => {
    const pd = { ...projDeps, [projId]: depIds }
    setProjDeps(pd); persist(snap({ projDeps: pd }))
  }

  const setIssueDepsFor = (issueId, depIds) => {
    const id = { ...issueDeps, [issueId]: depIds }
    setIssueDeps(id); persist(snap({ issueDeps: id }))
  }


  const getEligibleForIssue = issue => getEligible(issue, members, labelMap, issueLabels)

  const trackEdit = (issueId, field, original, edited, extra) => {
    // Only record if the value actually changed from the original
    if (original === edited) {
      setEdits(prev => {
        const next = { ...prev }
        if (next[issueId]) {
          const { [field]: _, ...rest } = next[issueId]
          if (Object.keys(rest).length) next[issueId] = rest
          else delete next[issueId]
        }
        return next
      })
    } else {
      setEdits(prev => ({
        ...prev,
        [issueId]: { ...(prev[issueId] || {}), [field]: { original, edited, ...extra } },
      }))
    }
  }

  const allLabels = Object.keys(labelMap)
  const availableLabels = [...new Set(issues.flatMap(i => (i.labels?.nodes || []).map(l => l.name)))]

  // ── Step transitions ────────────────────────────────────────────────────────
  const goStep = s => { if (s > 2 && !init) return; setStep(s) }

  const onConnected = ({ apiKey: key, allInits: inits, allTeams: teams, linearDeps, linearRelationIds: relIds, crossProjectDeps: xDeps }) => {
    setApiKey(key); setAllInits(inits); setAllTeams(teams)
    if (teams.length === 1 && !selTeamId) setSelTeamIdRaw(teams[0].id)
    // Validate saved team still exists
    if (selTeamId && !teams.find(t => t.id === selTeamId)) setSelTeamIdRaw(null)

    // Merge Linear deps into saved deps (additive — Linear deps + manual deps)
    let mergedIssueDeps = issueDeps
    if (linearDeps && Object.keys(linearDeps).length) {
      const merged = { ...issueDeps }
      const ldSet = {}
      Object.entries(linearDeps).forEach(([issueId, deps]) => {
        const existing = new Set(merged[issueId] || [])
        ldSet[issueId] = new Set(deps)
        deps.forEach(d => existing.add(d))
        merged[issueId] = [...existing]
      })
      mergedIssueDeps = merged
      setIssueDeps(merged)
      setLinearDepsSet(ldSet)
      persist(snap({ issueDeps: merged }))
    }
    if (relIds) setLinearRelationIds(relIds)
    if (xDeps?.length) setCrossProjectDeps(xDeps)
    setEdits({}) // Reset session edits on fresh connect

    // ── Restore session if we have a saved step and valid selections ──
    const savedStep = loadStorage().step || 0
    const effectiveTeamId = selTeamId || (teams.length === 1 ? teams[0].id : null)

    if (savedStep >= 2 && effectiveTeamId) {
      const team = teams.find(t => t.id === effectiveTeamId)
      if (team) {
        // Restore team/members (confirmTeam logic)
        const teamMembers = team.members?.nodes || []
        setAllMembers(teamMembers)
        const teamMemberIds = new Set(teamMembers.map(m => m.id))
        const validSel = new Set([...selMemberIds].filter(id => teamMemberIds.has(id)))
        if (!validSel.size) setSelMemberIdsRaw(teamMemberIds)
        else setSelMemberIdsRaw(validSel)
        const tc = (team.cycles?.nodes || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        if (selCycleId && !tc.find(c => c.id === selCycleId)) setSelCycleIdRaw(null)

        // Restore cycle (confirmCycle logic)
        const cycle = tc.find(c => c.id === selCycleId)
        if (savedStep >= 3 && cycle) {
          setStartIso(cycle.startsAt)

          // Restore projects/issues (loadSel logic)
          if (savedStep >= 5 && selProjects.size) {
            const projMap = {}
            inits.forEach(it => (it.projects?.nodes || []).forEach(p => {
              if (selProjects.has(p.id)) projMap[p.id] = p
            }))
            const projs = Object.values(projMap)
            if (projs.length) {
              const chosen = inits.filter(it => (it.projects?.nodes || []).some(p => selProjects.has(p.id)))
              let allIss = []
              projs.forEach(p => (p._issues || []).forEach(i => { allIss.push({ ...i, project: { id: p.id, name: p.name } }) }))
              const cid = [...selProjects].sort().join('|')
              setProjects(projs); setAllIssues(allIss)
              setChosenInits(chosen)
              setInit({ id: cid, name: chosen.map(i => i.name).join(' + ') })

              // Restore projOrder
              const projIds = new Set(projs.map(p => p.id))
              const projInitName = {}
              chosen.forEach(init => (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name }))
              const sortName = id => `${projInitName[id] || ''} >> ${projs.find(p => p.id === id)?.name || ''}`
              const kept = projOrder.filter(id => projIds.has(id))
              const added = [...projIds].filter(id => !kept.includes(id)).sort((a, b) => sortName(a).localeCompare(sortName(b)))
              const order = kept.length ? [...kept, ...added] : [...projIds].sort((a, b) => sortName(a).localeCompare(sortName(b)))
              setProjOrderState(order)

              // Clean deps
              const cleanedProjDeps = {}
              Object.entries(projDeps).forEach(([pid, deps]) => {
                if (projIds.has(pid)) {
                  const filtered = deps.filter(d => projIds.has(d))
                  if (filtered.length) cleanedProjDeps[pid] = filtered
                }
              })
              setProjDeps(cleanedProjDeps)
              const allIssueIds = new Set(allIss.map(i => i.id))
              const cleanedIssueDeps = {}
              Object.entries(mergedIssueDeps).forEach(([iid, deps]) => {
                if (allIssueIds.has(iid)) {
                  const filtered = deps.filter(d => allIssueIds.has(d))
                  if (filtered.length) cleanedIssueDeps[iid] = filtered
                }
              })
              setIssueDeps(cleanedIssueDeps)
              setBaselineDeps(cleanedIssueDeps)

              // Restore state filter (confirmStates logic)
              if (savedStep >= 7 && selStates.size) {
                const filtered = allIss.filter(i => selStates.has(i.state?.type))
                setIssues(filtered)
              } else {
                setIssues(allIss)
              }

              // Jump to saved step (cap at 10 — step 11 recomputes plan automatically)
              setStep(Math.min(savedStep, 10))
              return
            }
          }
        }
      }
    }

    setBaselineDeps(mergedIssueDeps)
    setStep(1)
  }

  const confirmTeam = () => {
    const team = allTeams.find(t => t.id === selTeamId)
    if (!team) return
    const teamMembers = team.members?.nodes || []
    setAllMembers(teamMembers)
    // Validate saved member selection — keep only members still on team, default to all if none saved
    const teamMemberIds = new Set(teamMembers.map(m => m.id))
    const validSel = new Set([...selMemberIds].filter(id => teamMemberIds.has(id)))
    if (!validSel.size) setSelMemberIdsRaw(teamMemberIds) // default: all selected
    else setSelMemberIdsRaw(validSel)
    // Validate saved cycle still exists
    const cycles = (team.cycles?.nodes || [])
    if (selCycleId && !cycles.find(c => c.id === selCycleId)) setSelCycleIdRaw(null)
    // Validate saved capacity — remove members no longer on team
    const cleanCaps = {}
    Object.entries(caps).forEach(([initId, initCaps]) => {
      const cleaned = {}
      Object.entries(initCaps).forEach(([mid, val]) => { if (teamMemberIds.has(mid)) cleaned[mid] = val })
      if (Object.keys(cleaned).length) cleanCaps[initId] = cleaned
    })
    setCapsState(cleanCaps)
    persist({ caps: cleanCaps })
    setStep(2)
  }

  const teamCycles = () => {
    const team = allTeams.find(t => t.id === selTeamId)
    return (team?.cycles?.nodes || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  }

  const confirmCycle = () => {
    const cycle = teamCycles().find(c => c.id === selCycleId)
    if (!cycle) { setErr('Please select a cycle.'); return }
    setStartIso(cycle.startsAt); setErr('')
    // Validate saved initiative selections still exist
    const validInits = new Set([...selInits].filter(id => allInits.some(i => i.id === id)))
    if (validInits.size !== selInits.size) setSelInitsRaw(validInits)
    setStep(3) // → Initiatives
  }

  const loadSel = () => {
    // Get selected projects and derive which initiatives they belong to
    const projMap = {}
    allInits.forEach(it => (it.projects?.nodes || []).forEach(p => {
      if (selProjects.has(p.id)) projMap[p.id] = p
    }))
    const projs = Object.values(projMap)
    if (!projs.length) return
    const chosen = allInits.filter(it => (it.projects?.nodes || []).some(p => selProjects.has(p.id)))
    let allIss = []
    projs.forEach(p => (p._issues || []).forEach(i => { allIss.push({ ...i, project: { id: p.id, name: p.name } }) }))
    const cid = [...selProjects].sort().join('|')
    setProjects(projs); setAllIssues(allIss); setIssues(allIss)
    setChosenInits(chosen)
    setInit({ id: cid, name: chosen.map(i => i.name).join(' + ') })
    // Initialize project order A→Z and clean up deps
    const projInitName = {}
    chosen.forEach(init => (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name }))
    const sortName = id => `${projInitName[id] || ''} >> ${projs.find(p => p.id === id)?.name || ''}`
    const projIds = new Set(projs.map(p => p.id))
    // Keep persisted order for known projects, append new ones sorted A→Z
    const kept = projOrder.filter(id => projIds.has(id))
    const added = [...projIds].filter(id => !kept.includes(id)).sort((a, b) => sortName(a).localeCompare(sortName(b)))
    const order = kept.length ? [...kept, ...added] : [...projIds].sort((a, b) => sortName(a).localeCompare(sortName(b)))
    setProjOrderState(order)
    const cleanedDeps = {}
    Object.entries(projDeps).forEach(([pid, deps]) => {
      if (projIds.has(pid)) {
        const filtered = deps.filter(d => projIds.has(d))
        if (filtered.length) cleanedDeps[pid] = filtered
      }
    })
    setProjDeps(cleanedDeps)
    // Clean up issue deps: remove references to issues no longer in the data
    const allIssueIds = new Set(allIss.map(i => i.id))
    const cleanedIssueDeps = {}
    Object.entries(issueDeps).forEach(([iid, deps]) => {
      if (allIssueIds.has(iid)) {
        const filtered = deps.filter(d => allIssueIds.has(d))
        if (filtered.length) cleanedIssueDeps[iid] = filtered
      }
    })
    setIssueDeps(cleanedIssueDeps)
    persist(snap({ projOrder: order, projDeps: cleanedDeps, issueDeps: cleanedIssueDeps }))
    // Derive available states from Linear data
    const availableTypes = new Set(allIss.map(i => i.state?.type).filter(Boolean))
    const saved = selStates
    const prevAvailable = loadStorage().availableStates || []
    const next = new Set()
    availableTypes.forEach(t => {
      if (!saved.size) next.add(t)
      else if (saved.has(t)) next.add(t)
      else if (!prevAvailable.includes(t)) next.add(t)
    })
    setSelStatesRaw(next)
    persist(snap({ selStates: [...next], availableStates: [...availableTypes] }))
    setStep(5) // → Project Priority
  }

  const confirmProjOrder = () => {
    setStep(6) // → Issue States
  }

  const confirmStates = () => {
    const filtered = allIssues.filter(i => selStates.has(i.state?.type))
    setIssues(filtered)
    // Initialize issue order from [N] prefixes and fix for dependencies
    const om = { ...orderMap }
    if (init?.id) delete om[init.id]
    const newInitOrder = {}
    projects.forEach(proj => {
      const projIssues = getOrdered(filtered, proj.id, {}, null)
      const sorted = [...projIssues]
      // Sort committed issues by cycle date
      let changed = true
      while (changed) {
        changed = false
        for (let i = 0; i < sorted.length - 1; i++) {
          const aDate = sorted[i].cycle?.startsAt
          const bDate = sorted[i + 1].cycle?.startsAt
          if (aDate && bDate && new Date(aDate) > new Date(bDate)) {
            ;[sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]]
            changed = true
          }
        }
      }
      // Fix for issue dependencies
      changed = true
      while (changed) {
        changed = false
        for (let i = 0; i < sorted.length; i++) {
          const deps = issueDeps[sorted[i].id] || []
          for (const depId of deps) {
            const depIdx = sorted.findIndex(s => s.id === depId)
            if (depIdx > i) {
              const [dep] = sorted.splice(depIdx, 1)
              sorted.splice(i, 0, dep)
              changed = true
              break
            }
          }
          if (changed) break
        }
      }
      newInitOrder[proj.id] = sorted.map(i => i.id)
    })
    om[init.id] = newInitOrder
    setOrderMap(om)
    setStep(7) // → Configure Issues
  }

  const confirmConfigureIssues = () => {
    const activeIssues = issues.filter(i => !excludedIssues.has(i.id))
    // Check all active issues have labels or member assignment
    const unlabelled = activeIssues.filter(i => {
      const hasLabel = (i.labels?.nodes || []).length > 0 || !!issueLabels[i.id]
      const assignVal = getAssign(i.id)
      const hasAssignment = (!!assignVal && assignVal !== '__auto__') || (!assignVal && !!i.assignee?.id)
      return !hasLabel && !hasAssignment
    })
    if (unlabelled.length) { setErr(unlabelled.length + ' issue' + (unlabelled.length !== 1 ? 's' : '') + ' still need labels (or a member assignment).'); return }
    // Check all active issues have estimates
    const unest = activeIssues.filter(i => !i.estimate || i.estimate <= 0)
    if (unest.length) { setErr(unest.length + ' issue' + (unest.length !== 1 ? 's' : '') + ' still need estimates.'); return }
    // Rebuild labelMap from Linear data for the Labels > Team Members step
    const freshLabels = [...new Set(issues.flatMap(i => (i.labels?.nodes || []).map(l => l.name)))]
    const memberIds = new Set(members.map(m => m.id))
    const lm = {}
    freshLabels.forEach(l => { lm[l] = (labelMap[l] || []).filter(mid => memberIds.has(mid)) })
    setLabelMap(lm)
    persist(snap({ labelMap: lm }))
    setErr(''); setStep(8) // → Labels > Team Members
  }

  const confirmLabelMap = () => {
    const empty = allLabels.filter(l => !(labelMap[l]?.length))
    if (empty.length) { setErr('Assign at least one member to: ' + empty.join(', ')); return }
    setErr(''); setStep(9) // → Capacity
  }

  // ── Plan ────────────────────────────────────────────────────────────────────
  const team = allTeams.find(t => t.id === selTeamId)
  const cycles = (team?.cycles?.nodes || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))

  const planIssues = excludedIssues.size ? issues.filter(i => !excludedIssues.has(i.id)) : issues
  const plan = step === 10 && init ? computePlan({
    issues: planIssues, projects, members, cycles, startIso,
    orderMap, initId: init.id, assignMap, caps,
    labelMap, issueLabels, projOrder, projDeps, issueDeps,
  }) : null

  // ── Layout ──────────────────────────────────────────────────────────────────
  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f4f0', color: '#1a1a2e', fontSize: 14 }}>

      {/* Sidebar */}
      <nav style={{ width: 200, flexShrink: 0, background: '#1a1a2e', display: 'flex', flexDirection: 'column', padding: '24px 0', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 32, height: 32, background: '#e63946', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'white', marginBottom: 10 }}>LP</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>Initiative Planner</div>
          {init && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontFamily: 'monospace', wordBreak: 'break-word' }}>{init.name}</div>}
        </div>
        <div style={{ padding: '12px 0', flex: 1 }}>
          {STEPS.map((label, i) => (
            <div key={i} onClick={() => goStep(i)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 20px', cursor: 'pointer',
              background: step === i ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderLeft: step === i ? '3px solid #e63946' : '3px solid transparent' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${step === i ? '#e63946' : i < step ? '#2d6a4f' : 'rgba(255,255,255,0.2)'}`,
                background: i < step ? '#2d6a4f' : 'transparent',
                fontSize: 8, color: step === i ? '#e63946' : i < step ? 'white' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: step === i ? 'white' : i < step ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)', fontWeight: step === i ? 500 : 400 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        {startIso && (
          <div style={{ padding: '12px 20px 0', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            from {new Date(startIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </nav>

      {/* Main */}
      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 32px' }}>
        <div style={{ maxWidth: step === 10 ? 'none' : 860, margin: '0 auto' }}>


          {step === 0  && <StepConnect onConnected={onConnected} autoConnect={!!(loadStorage().step && localStorage.getItem('lp-apikey'))} />}

          {step === 1  && <StepTeam allTeams={allTeams} selTeamId={selTeamId} setSelTeamId={setSelTeamId} selMemberIds={selMemberIds} setSelMemberIds={setSelMemberIds} onNext={confirmTeam} onBack={() => setStep(0)} />}

          {step === 2  && <StepCycle cycles={teamCycles()} selCycleId={selCycleId} setSelCycleId={setSelCycleId} err={err} onNext={confirmCycle} onBack={() => setStep(1)} />}

          {step === 3  && <StepInitiatives allInits={allInits} selInits={selInits} setSelInits={setSelInits} onNext={() => {
            // Validate saved project selections — remove projects from deselected initiatives
            const validProjIds = new Set()
            allInits.filter(it => selInits.has(it.id)).forEach(it => (it.projects?.nodes || []).forEach(p => validProjIds.add(p.id)))
            const cleanedProjects = new Set([...selProjects].filter(id => validProjIds.has(id)))
            if (cleanedProjects.size !== selProjects.size) setSelProjectsRaw(cleanedProjects)
            setStep(4)
          }} onBack={() => setStep(2)} />}

          {step === 4  && <StepProjects allInits={allInits} selInits={selInits} selProjects={selProjects} setSelProjects={setSelProjects} onNext={loadSel} onBack={() => setStep(3)} />}

          {step === 5  && <StepProjOrder projects={projects} issues={allIssues} chosenInits={chosenInits} projOrder={projOrder} setProjOrder={setProjOrder} projDeps={projDeps} setProjDepsFor={setProjDepsFor} onNext={confirmProjOrder} onBack={() => setStep(4)} />}

          {step === 6  && <StepStates issues={allIssues} selStates={selStates} setSelStates={setSelStates} onNext={confirmStates} onBack={() => setStep(5)} />}

          {step === 7  && <StepConfigureIssues
            chosenInits={chosenInits} projects={projects} issues={issues}
            projOrder={projOrder}
            orderMap={orderMap} initId={init?.id}
            issueLabels={issueLabels} setIssueLabel={setIssueLabel} availableLabels={availableLabels}
            setEst={setEst} members={members} getAssign={getAssign} setAssign={setAssign}
            cycles={cycles} setCycle={setCycle}
            issueDeps={issueDeps} linearDepsSet={linearDepsSet} crossProjectDeps={crossProjectDeps}
            setIssueDepsFor={setIssueDepsFor}
            setTitle={setTitle}
            saveOrder={saveOrder} startIso={startIso} trackEdit={trackEdit}
            edits={edits} setEdits={setEdits} apiKey={apiKey}
            onSaveComplete={() => {
              // Update baselines to match current state so indicators clear
              const ldSet = {}
              Object.entries(issueDeps).forEach(([id, deps]) => { ldSet[id] = new Set(deps) })
              setLinearDepsSet(ldSet)
              setBaselineDeps(issueDeps)
            }}
            linearRelationIds={linearRelationIds} baselineDeps={baselineDeps}
            excludedIssues={excludedIssues} setExcludedIssues={setExcludedIssues}
            err={err}
            onNext={confirmConfigureIssues} onBack={() => setStep(6)}
          />}

          {step === 8  && <StepLabelMap labels={allLabels} members={members} labelMap={labelMap} issues={issues} toggleLabelMember={toggleLabelMember} err={err} onNext={confirmLabelMap} onBack={() => setStep(7)} />}

          {step === 9  && <StepCapacity members={members} getCap={getCap} setCap={setCap} onNext={() => setStep(10)} onBack={() => setStep(8)} />}

          {step === 10 && plan && (
            <PlanView
              issues={issues} projects={projects} members={members}
              plan={plan} getCap={getCap}
              chosenInits={chosenInits} projOrder={projOrder}
              orderMap={orderMap} initId={init?.id} issueLabels={issueLabels}
              teamName={team?.name || 'Team'}
              onBack={() => setStep(9)}
            />
          )}

        </div>
      </main>
    </div>
  )
}
