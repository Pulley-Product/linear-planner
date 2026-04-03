import { useState, useRef, useEffect, useCallback } from 'react'
import { loadStorage, saveStorage } from './utils/storage.js'
import { computePlan, getEligible } from './utils/plan.js'
import StepConnect from './components/StepConnect.jsx'
import { StepTeam, StepCycle, StepInitiatives, StepLabelMap, StepUnlabelled, StepProjOrder } from './components/StepSetup.jsx'
import StepOrder from './components/StepOrder.jsx'
import { StepEstimates, StepCapacity } from './components/StepEstimatesCapacity.jsx'
import PlanView from './components/PlanView.jsx'

// Steps: 0=connect 1=team 2=cycle 3=initiatives 4=labels 5=unlabelled
//        6=projorder 7=order 8=estimates 9=capacity 10=plan
const STEPS = ['Connect','Team','Cycle','Initiatives','Labels','Unlabelled','Proj Order','Order','Estimates','Capacity','Plan']

export default function App() {
  const [step, setStep] = useState(0)
  const [err, setErr]   = useState('')

  // From Linear
  const [apiKey, setApiKey]       = useState('')
  const [allInits, setAllInits]   = useState([])
  const [allTeams, setAllTeams]   = useState([])

  // Selections
  const [selTeamId, setSelTeamId]   = useState(null)
  const [selCycleId, setSelCycleId] = useState(null)
  const [selInits, setSelInits]     = useState(new Set())

  // Working data
  const [projects, setProjects]       = useState([])
  const [issues, setIssues]           = useState([])
  const [members, setMembers]         = useState([])
  const [chosenInits, setChosenInits] = useState([])
  const [init, setInit]               = useState(null)
  const [startIso, setStartIso]       = useState(null)

  // Persisted state
  const [labelMap, setLabelMap]       = useState({})   // { labelName -> [memberId] }
  const [issueLabels, setIssueLabels] = useState({})   // { issueId -> labelName }
  const [blocked, setBlocked]         = useState({})   // { issueId -> note }
  const [projDeps, setProjDeps]       = useState({})   // { projId -> [projId] }
  const [orderMap, setOrderMap]       = useState({})   // { initId -> { projId -> [issueId] } }
  const [assignMap, setAssignMap]     = useState({})   // { initId -> { issueId -> memberId } }
  const [caps, setCapsState]          = useState({})   // { initId -> { memberId -> pts } }
  const [savedState, setSavedState]   = useState('saved')
  const timer = useRef(null)

  // Load persisted state on mount
  useEffect(() => {
    const d = loadStorage()
    if (d.labelMap)    setLabelMap(d.labelMap)
    if (d.issueLabels) setIssueLabels(d.issueLabels)
    if (d.blocked)     setBlocked(d.blocked)
    if (d.projDeps)    setProjDeps(d.projDeps)
    if (d.orderMap)    setOrderMap(d.orderMap)
    if (d.assignMap)   setAssignMap(d.assignMap)
    if (d.caps)        setCapsState(d.caps)
  }, [])

  const persist = useCallback((updates) => {
    setSavedState('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      saveStorage(updates)
      setSavedState('saved')
    }, 600)
  }, [])

  const snap = (overrides = {}) => ({
    labelMap, issueLabels, blocked, projDeps, orderMap, assignMap, caps,
    ...overrides,
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCap    = mid => caps[init?.id]?.[mid] ?? 10
  const getAssign = id  => assignMap[init?.id]?.[id] ?? null

  const setCap = (mid, v) => {
    const cp = { ...caps, [init.id]: { ...(caps[init.id] || {}), [mid]: parseInt(v) || 10 } }
    setCapsState(cp); persist(snap({ caps: cp }))
  }

  const setAssign = (id, mid) => {
    const am = { ...assignMap, [init.id]: { ...(assignMap[init.id] || {}), [id]: mid || null } }
    setAssignMap(am); persist(snap({ assignMap: am }))
  }

  const saveOrder = (pid, ids) => {
    const om = { ...orderMap, [init.id]: { ...(orderMap[init.id] || {}), [pid]: ids } }
    setOrderMap(om); persist(snap({ orderMap: om }))
  }

  const setEst = (id, v) => setIssues(prev => prev.map(i => i.id === id ? { ...i, estimate: parseInt(v) || 1 } : i))

  const setBlockNote = (id, note) => {
    const bl = { ...blocked, [id]: note }
    setBlocked(bl); persist(snap({ blocked: bl }))
  }

  const toggleLabelMember = (label, mid) => {
    const cur = new Set(labelMap[label] || [])
    cur.has(mid) ? cur.delete(mid) : cur.add(mid)
    const lm = { ...labelMap, [label]: [...cur] }
    setLabelMap(lm); persist(snap({ labelMap: lm }))
  }

  const setIssueLabel = (id, label) => {
    const il = { ...issueLabels, [id]: label }
    setIssueLabels(il); persist(snap({ issueLabels: il }))
  }

  const toggleProjDep = (projId, depId) => {
    const cur = new Set(projDeps[projId] || [])
    cur.has(depId) ? cur.delete(depId) : cur.add(depId)
    const pd = { ...projDeps, [projId]: [...cur] }
    setProjDeps(pd); persist(snap({ projDeps: pd }))
  }

  const resetSaved = () => {
    const om = { ...orderMap }; delete om[init.id]
    const am = { ...assignMap }; delete am[init.id]
    setOrderMap(om); setAssignMap(am); persist(snap({ orderMap: om, assignMap: am }))
  }

  const getEligibleForIssue = issue => getEligible(issue, members, labelMap, issueLabels)

  const allLabels = Object.keys(labelMap)

  // ── Step transitions ────────────────────────────────────────────────────────
  const goStep = s => { if (s > 2 && !init) return; setStep(s) }

  const onConnected = ({ apiKey: key, allInits: inits, allTeams: teams }) => {
    setApiKey(key); setAllInits(inits); setAllTeams(teams)
    if (teams.length === 1) setSelTeamId(teams[0].id)
    setStep(1)
  }

  const confirmTeam = () => {
    const team = allTeams.find(t => t.id === selTeamId)
    if (!team) return
    setMembers(team.members?.nodes || [])
    setStep(2)
  }

  const teamCycles = () => {
    const team = allTeams.find(t => t.id === selTeamId)
    return (team?.cycles?.nodes || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  }

  const confirmCycle = () => {
    const cycle = teamCycles().find(c => c.id === selCycleId)
    if (!cycle) { setErr('Please select a cycle.'); return }
    setStartIso(cycle.startsAt); setErr(''); setStep(3)
  }

  const loadSel = () => {
    const chosen = allInits.filter(i => selInits.has(i.id))
    const projMap = {}
    chosen.forEach(it => (it.projects?.nodes || []).forEach(p => { projMap[p.id] = p }))
    const projs = Object.values(projMap)
    let allIss = []
    projs.forEach(p => (p._issues || []).forEach(i => { allIss.push({ ...i, project: { id: p.id, name: p.name } }) }))
    const cid = [...selInits].sort().join('|')
    setProjects(projs); setIssues(allIss)
    setChosenInits(chosen)
    setInit({ id: cid, name: chosen.map(i => i.name).join(' + ') })
    const lm = { ...labelMap }
    const newLabels = [...new Set(allIss.flatMap(i => (i.labels?.nodes || []).map(l => l.name)))]
    newLabels.forEach(l => { if (!lm[l]) lm[l] = [] })
    setLabelMap(lm)
    setStep(4)
  }

  const confirmLabelMap = () => {
    const empty = allLabels.filter(l => !(labelMap[l]?.length))
    if (empty.length) { setErr('Assign at least one member to: ' + empty.join(', ')); return }
    setErr('')
    const unlabelled = issues.filter(i => !(i.labels?.nodes || []).length && !issueLabels[i.id])
    setStep(unlabelled.length > 0 ? 5 : 6)
  }

  const confirmUnlabelled = () => {
    const still = issues.filter(i => !(i.labels?.nodes || []).length && !issueLabels[i.id])
    if (still.length) { setErr(still.length + ' issues still need a label.'); return }
    setErr(''); setStep(6)
  }

  const confirmEstimates = () => {
    const unest = issues.filter(i => !i.estimate || i.estimate <= 0)
    if (unest.length > 0) { setErr(unest.length + ' issues still need estimates.'); return }
    setErr(''); setStep(9)
  }

  // ── Plan ────────────────────────────────────────────────────────────────────
  const team = allTeams.find(t => t.id === selTeamId)
  const cycles = (team?.cycles?.nodes || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))

  const plan = step === 10 && init ? computePlan({
    issues, projects, members, cycles, startIso,
    orderMap, initId: init.id, assignMap, caps,
    labelMap, issueLabels, blocked, projDeps,
  }) : null

  // ── Layout ──────────────────────────────────────────────────────────────────
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
      <main style={{ flex: 1, overflowY: 'auto', padding: '40px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {step === 0  && <StepConnect onConnected={onConnected} />}

          {step === 1  && <StepTeam allTeams={allTeams} selTeamId={selTeamId} setSelTeamId={setSelTeamId} onNext={confirmTeam} onBack={() => setStep(0)} />}

          {step === 2  && <StepCycle cycles={teamCycles()} selCycleId={selCycleId} setSelCycleId={setSelCycleId} err={err} onNext={confirmCycle} onBack={() => setStep(1)} />}

          {step === 3  && <StepInitiatives allInits={allInits} selInits={selInits} setSelInits={setSelInits} onNext={loadSel} onBack={() => setStep(2)} />}

          {step === 4  && <StepLabelMap labels={allLabels} members={members} labelMap={labelMap} issues={issues} toggleLabelMember={toggleLabelMember} err={err} onNext={confirmLabelMap} onBack={() => setStep(3)} />}

          {step === 5  && <StepUnlabelled unlabelledIssues={issues.filter(i => !(i.labels?.nodes || []).length && !issueLabels[i.id])} issueLabels={issueLabels} setIssueLabel={setIssueLabel} labels={allLabels} err={err} onNext={confirmUnlabelled} onBack={() => setStep(4)} />}

          {step === 6  && <StepProjOrder projects={projects} projDeps={projDeps} toggleProjDep={toggleProjDep} onNext={() => setStep(7)} onBack={() => setStep(allLabels.length > 0 ? 5 : 4)} />}

          {step === 7  && <StepOrder
            chosenInits={chosenInits} projects={projects} issues={issues}
            orderMap={orderMap} initId={init?.id}
            getAssign={getAssign} setAssign={setAssign}
            members={members} labelMap={labelMap} issueLabels={issueLabels}
            blocked={blocked} setBlockNote={setBlockNote}
            getEligible={getEligibleForIssue} startIso={startIso}
            saveOrder={saveOrder} savedState={savedState} resetSaved={resetSaved}
            onNext={() => setStep(8)} onBack={() => setStep(6)}
          />}

          {step === 8  && <StepEstimates
            chosenInits={chosenInits} projects={projects} issues={issues}
            orderMap={orderMap} initId={init?.id}
            setEst={setEst} err={err}
            onNext={confirmEstimates} onBack={() => setStep(7)}
          />}

          {step === 9  && <StepCapacity members={members} getCap={getCap} setCap={setCap} onNext={() => setStep(10)} onBack={() => setStep(8)} />}

          {step === 10 && plan && (
            <PlanView
              issues={issues} projects={projects} members={members}
              plan={plan} blocked={blocked} getCap={getCap}
              onBack={() => setStep(9)} onOrder={() => setStep(7)}
            />
          )}

        </div>
      </main>
    </div>
  )
}
