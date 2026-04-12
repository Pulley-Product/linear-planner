import { useState } from 'react'
import { Avatar, Btn, GBtn, Card, Row, H1, R, Sub, Err, Check, Radio, SEG, inpS, pickRowStyle } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'

// ── Step 1: Pick Team ──────────────────────────────────────────────────────
export function StepTeam({ allTeams, selTeamId, setSelTeamId, selMemberIds, setSelMemberIds, onNext, onBack }) {
  const selTeam = allTeams.find(t => t.id === selTeamId)
  const teamMembers = selTeam?.members?.nodes || []
  const [showAllTeams, setShowAllTeams] = useState(false)

  const toggleMember = (mid) => {
    const ns = new Set(selMemberIds)
    ns.has(mid) ? ns.delete(mid) : ns.add(mid)
    setSelMemberIds(ns)
  }

  return (
    <div>
      <H1>Pick a Team & Select <R>Members</R></H1>
      <Sub>Select the team whose members and cycles will be used for this plan. Uncheck members who should not be assigned issues.</Sub>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selTeamId || !selMemberIds.size}>Confirm Team & Members →</Btn>
      </Row>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card>
            {(() => {
              const priorityNames = ['App Team 1', 'App Team 2', 'AI Team 1', 'AI Team 2', 'Platform']
              const popular = priorityNames.map(n => allTeams.find(t => t.name === n)).filter(Boolean)
              const all = [...allTeams].sort((a, b) => a.name.localeCompare(b.name))
              const renderTeam = (t) => (
                <div key={t.id} onClick={() => {
                  setSelTeamId(t.id)
                  const mids = new Set((t.members?.nodes || []).map(m => m.id))
                  setSelMemberIds(mids)
                }} style={pickRowStyle(selTeamId === t.id)}>
                  <Radio checked={selTeamId === t.id} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 2 }}>
                      {t.members?.nodes?.length || 0} members &middot;{' '}
                      {t.cycles?.nodes?.length || 0} active/upcoming cycles
                    </div>
                  </div>
                </div>
              )
              return <>
                {popular.length > 0 && <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 12px 6px', fontFamily: 'monospace' }}>Popular Teams</div>
                  {popular.map(renderTeam)}
                  <div onClick={() => setShowAllTeams(p => !p)} style={{ fontSize: 10, fontWeight: 700, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 12px 6px', fontFamily: 'monospace', borderTop: '1px solid #e8e7e3', marginTop: 8, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: showAllTeams ? 'rotate(0deg)' : 'rotate(-90deg)' }}>&#9660;</span>
                    All Teams ({all.length})
                  </div>
                </>}
                {showAllTeams && all.map(renderTeam)}
              </>
            })()}
          </Card>
        </div>

        {selTeamId && teamMembers.length > 0 && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Team Members</div>
              {[...teamMembers].sort((a, b) => a.name.localeCompare(b.name)).map(m => {
                const sel = selMemberIds.has(m.id)
                return (
                  <div key={m.id} onClick={() => toggleMember(m.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginBottom: 3,
                    background: sel ? 'white' : '#f9f9f7',
                    border: `1.5px solid ${sel ? '#1a1a2e' : '#e8e7e3'}`,
                    borderRadius: 7, cursor: 'pointer',
                  }}>
                    <Check checked={sel} />
                    {m.avatarUrl
                      ? <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                      : <Avatar name={m.name} i={0} sz={22} />
                    }
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <GBtn onClick={() => setSelMemberIds(new Set(teamMembers.map(m => m.id)))}>All</GBtn>
                <GBtn onClick={() => setSelMemberIds(new Set())}>None</GBtn>
              </div>
            </Card>
          </div>
        )}
      </div>

      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selTeamId || !selMemberIds.size}>Confirm Team & Members →</Btn>
      </Row>
    </div>
  )
}

// ── Step 2: Pick Start Cycle ───────────────────────────────────────────────
export function StepCycle({ cycles, selCycleId, setSelCycleId, err, onNext, onBack }) {
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return (
    <div>
      <H1>Pick <R>Start Cycle</R></H1>
      <Sub>The plan starts at the beginning of this cycle. Week 1 = first week of the selected cycle.</Sub>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selCycleId}>Confirm Start Cycle →</Btn>
      </Row>
      <Card>
        {cycles.length === 0 && (
          <p style={{ color: '#9a9a9e', fontFamily: 'monospace', fontSize: 13 }}>
            No active or upcoming cycles found for this team.
          </p>
        )}
        {cycles.map(c => (
          <div key={c.id} onClick={() => setSelCycleId(c.id)} style={pickRowStyle(selCycleId === c.id)}>
            <Radio checked={selCycleId === c.id} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                Cycle {c.number}{c.name ? ` — ${c.name}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 2 }}>
                {fmt(c.startsAt)} → {fmt(c.endsAt)}
              </div>
            </div>
          </div>
        ))}
      </Card>
      {err && <Err>{err}</Err>}
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selCycleId}>Confirm Start Cycle →</Btn>
      </Row>
    </div>
  )
}

// ── Step 3: Pick Initiatives ──────────────────────────────────────────────
export function StepInitiatives({ allInits, selInits, setSelInits, onNext, onBack }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('active')
  const toggle = id => {
    const ns = new Set(selInits)
    ns.has(id) ? ns.delete(id) : ns.add(id)
    setSelInits(ns)
  }

  // Group initiatives by status
  const statusGroups = {}
  allInits.forEach(it => {
    const s = (it.status || 'unknown').toLowerCase()
    if (!statusGroups[s]) statusGroups[s] = []
    statusGroups[s].push(it)
  })
  // Sort each group alphabetically
  Object.values(statusGroups).forEach(group => group.sort((a, b) => a.name.localeCompare(b.name)))

  const STATUS_TAB_ORDER = ['active', 'planned', 'started', 'backlog', 'completed', 'paused', 'canceled']
  const tabs = STATUS_TAB_ORDER.filter(s => statusGroups[s]?.length > 0)
  // Add any remaining statuses not in the predefined order
  Object.keys(statusGroups).forEach(s => { if (!tabs.includes(s)) tabs.push(s) })

  // If activeTab doesn't exist in tabs, default to first tab
  const currentTab = tabs.includes(activeTab) ? activeTab : tabs[0] || 'active'
  const tabInits = (statusGroups[currentTab] || [])
    .filter(it => it.name.toLowerCase().includes(search.toLowerCase()))

  const TAB_COLORS = {
    active:  { bg: '#dcfce7', color: '#166534', activeBg: '#166534', activeColor: 'white' },
    planned: { bg: '#dbeafe', color: '#1d4ed8', activeBg: '#1d4ed8', activeColor: 'white' },
    started: { bg: '#dcfce7', color: '#166534', activeBg: '#166534', activeColor: 'white' },
    backlog: { bg: '#f0efe9', color: '#9a9a9e', activeBg: '#5a5a72', activeColor: 'white' },
    completed: { bg: '#e8e7e3', color: '#5a5a72', activeBg: '#5a5a72', activeColor: 'white' },
    paused:  { bg: '#fef9c3', color: '#854d0e', activeBg: '#854d0e', activeColor: 'white' },
    canceled: { bg: '#fee2e2', color: '#991b1b', activeBg: '#991b1b', activeColor: 'white' },
  }
  const defaultTabColor = { bg: '#f0efe9', color: '#9a9a9e', activeBg: '#5a5a72', activeColor: 'white' }

  return (
    <div>
      <H1>Select <R>Initiatives</R></H1>
      <Sub>Pick which initiatives to include. This determines which projects are available in the next step.</Sub>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selInits.size}>Next →</Btn>
      </Row>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search initiatives..."
        style={{ ...inpS, marginBottom: 12, width: '100%' }} />

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const isActive = tab === currentTab
          const tc = TAB_COLORS[tab] || defaultTabColor
          const selectedInTab = (statusGroups[tab] || []).filter(it => selInits.has(it.id)).length
          const totalInTab = (statusGroups[tab] || []).length
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontFamily: 'monospace', fontWeight: isActive ? 700 : 500,
                background: isActive ? tc.activeBg : tc.bg,
                color: isActive ? tc.activeColor : tc.color,
                transition: 'all 0.15s ease',
              }}>
              {tab} ({selectedInTab}/{totalInTab})
            </button>
          )
        })}
      </div>

      <Card>
        {tabInits.map(it => {
          const sel = selInits.has(it.id)
          return (
            <div key={it.id} onClick={() => toggle(it.id)} style={pickRowStyle(sel)}>
              <Check checked={sel} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</div>
                <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace' }}>
                  {it.projects?.nodes?.length || 0} projects
                </div>
              </div>
            </div>
          )
        })}
        {tabInits.length === 0 && (
          <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: '#9a9a9e' }}>
            No initiatives match your search.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <GBtn onClick={() => {
            const tabIds = (statusGroups[currentTab] || []).map(i => i.id)
            const ns = new Set(selInits)
            tabIds.forEach(id => ns.add(id))
            setSelInits(ns)
          }}>Select All in Tab</GBtn>
          <GBtn onClick={() => {
            const tabIds = new Set((statusGroups[currentTab] || []).map(i => i.id))
            const ns = new Set([...selInits].filter(id => !tabIds.has(id)))
            setSelInits(ns)
          }}>Deselect All in Tab</GBtn>
          <GBtn onClick={() => setSelInits(new Set(allInits.map(i => i.id)))}>All</GBtn>
          <GBtn onClick={() => setSelInits(new Set())}>None</GBtn>
        </div>
      </Card>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selInits.size}>Next →</Btn>
      </Row>
    </div>
  )
}

// ── Step 4: Pick Projects ─────────────────────────────────────────────────
const PROJ_STATE_COLORS = {
  backlog: { bg: '#f0efe9', color: '#9a9a9e' },
  planned: { bg: '#dbeafe', color: '#1d4ed8' },
  started: { bg: '#dcfce7', color: '#166534' },
  active:  { bg: '#dcfce7', color: '#166534' },
  paused:  { bg: '#fef9c3', color: '#854d0e' },
  completed: { bg: '#e8e7e3', color: '#5a5a72' },
  canceled: { bg: '#fee2e2', color: '#991b1b' },
}

function StateBadge({ state }) {
  const s = (state || 'unknown').toLowerCase()
  const c = PROJ_STATE_COLORS[s] || { bg: '#f0efe9', color: '#9a9a9e' }
  return (
    <span style={{
      fontSize: 9, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4,
      background: c.bg, color: c.color, flexShrink: 0, textTransform: 'lowercase',
    }}>
      {s}
    </span>
  )
}

export function StepProjects({ allInits, selInits, selProjects, setSelProjects, onNext, onBack }) {
  const [search, setSearch] = useState('')
  // Only show initiatives that were selected in the previous step
  const filteredInits = allInits.filter(it => selInits.has(it.id))
  const toggleProject = id => {
    const ns = new Set(selProjects)
    ns.has(id) ? ns.delete(id) : ns.add(id)
    setSelProjects(ns)
  }

  const toggleInitiative = (init) => {
    const projIds = (init.projects?.nodes || []).map(p => p.id)
    const allSelected = projIds.every(id => selProjects.has(id))
    const ns = new Set(selProjects)
    projIds.forEach(id => allSelected ? ns.delete(id) : ns.add(id))
    setSelProjects(ns)
  }

  const allProjIds = filteredInits.flatMap(it => (it.projects?.nodes || []).map(p => p.id))

  return (
    <div>
      <H1>Select <R>Projects</R></H1>
      <Sub>Pick which projects to include from the selected initiatives. Check an initiative name to select all its projects.</Sub>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
        <GBtn onClick={onBack}>← Back</GBtn>
        <div style={{ display: 'flex', gap: 8 }}>
          <GBtn onClick={() => setSelProjects(new Set(allProjIds))}>All</GBtn>
          <GBtn onClick={() => setSelProjects(new Set())}>None</GBtn>
          <Btn onClick={onNext} disabled={!selProjects.size}>
            Load {selProjects.size} Project{selProjects.size !== 1 ? 's' : ''} →
          </Btn>
        </div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects or initiatives..."
        style={{ ...inpS, marginBottom: 12, width: '100%' }} />

      {filteredInits.map(init => {
        const allProjs = init.projects?.nodes || []
        // Filter projects by search (match on project name or initiative name)
        const projs = search ? allProjs.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || init.name.toLowerCase().includes(search.toLowerCase())) : allProjs
        if (!projs.length) return null
        const allSel = projs.every(p => selProjects.has(p.id))
        const someSel = projs.some(p => selProjects.has(p.id))
        return (
          <Card key={init.id} style={{ marginBottom: 12 }}>
            <div onClick={() => toggleInitiative(init)} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #f0efe9',
            }}>
              <Check checked={allSel} />
              <span style={{ fontSize: 13, fontWeight: 700, color: allSel ? '#1a1a2e' : someSel ? '#5a5a72' : '#9a9a9e', flex: 1 }}>
                {init.name}
              </span>
              <StateBadge state={init.status} />
            </div>
            {projs.map(p => {
              const sel = selProjects.has(p.id)
              return (
                <div key={p.id} onClick={() => toggleProject(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px', marginLeft: 27, marginBottom: 3,
                  background: sel ? 'white' : '#f9f9f7',
                  border: `1.5px solid ${sel ? '#1a1a2e' : '#e8e7e3'}`,
                  borderRadius: 7, cursor: 'pointer',
                }}>
                  <Check checked={sel} />
                  <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{p.name}</span>
                  <StateBadge state={p.state} />
                </div>
              )
            })}
          </Card>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
        <GBtn onClick={onBack}>← Back</GBtn>
        <div style={{ display: 'flex', gap: 8 }}>
          <GBtn onClick={() => setSelProjects(new Set(allProjIds))}>All</GBtn>
          <GBtn onClick={() => setSelProjects(new Set())}>None</GBtn>
          <Btn onClick={onNext} disabled={!selProjects.size}>
            Load {selProjects.size} Project{selProjects.size !== 1 ? 's' : ''} →
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Issue State Types ─────────────────────────────────────────────
export function StepStates({ issues, selStates, setSelStates, onNext, onBack }) {
  const stateTypes = [...new Set(issues.map(i => i.state?.type).filter(Boolean))].sort()

  // Clean up: remove any selected states that no longer exist in the data
  const staleRemoved = [...selStates].filter(t => stateTypes.includes(t))
  if (staleRemoved.length !== selStates.size) {
    // Defer to avoid updating during render
    setTimeout(() => setSelStates(new Set(staleRemoved)), 0)
  }

  const toggle = t => {
    const ns = new Set(selStates)
    ns.has(t) ? ns.delete(t) : ns.add(t)
    setSelStates(ns)
  }
  const countByType = t => issues.filter(i => i.state?.type === t).length
  return (
    <div>
      <H1>Select <R>Issue States</R></H1>
      <Sub>Pick which issue states to include in the plan. Unselected states will be excluded.</Sub>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selStates.size}>Next →</Btn>
      </Row>
      <Card>
        {stateTypes.map(t => {
          const sel = selStates.has(t)
          return (
            <div key={t} onClick={() => toggle(t)} style={pickRowStyle(sel)}>
              <Check checked={sel} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{t}</div>
                <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 2 }}>
                  {countByType(t)} issue{countByType(t) !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <GBtn onClick={() => setSelStates(new Set(stateTypes))}>All</GBtn>
          <GBtn onClick={() => setSelStates(new Set())}>None</GBtn>
        </div>
      </Card>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selStates.size}>Next →</Btn>
      </Row>
    </div>
  )
}

// ── Step 5: Label → Member mapping ────────────────────────────────────────
const AV_BG = ['#dbeafe','#dcfce7','#fef9c3','#fee2e2','#ede9fe','#cffafe','#ffedd5','#fce7f3']
const AV_FG = ['#1d4ed8','#166534','#854d0e','#991b1b','#5b21b6','#0e7490','#9a3412','#9d174d']

export function StepLabelMap({ labels, members, labelMap, issues, toggleLabelMember, err, onNext, onBack }) {
  if (!labels.length) {
    return (
      <div>
        <H1>Assign <R>Issue Labels</R> to <R>Team Members</R></H1>
        <Sub>No labels found on any issues — all members will be eligible for all issues.</Sub>
        <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Continue →</Btn></Row>
      </div>
    )
  }

  // Split labels into used (assigned to at least one issue) and unused
  const usedLabels = labels.filter(l => issues.some(i => (i.labels?.nodes || []).some(ll => ll.name === l)))
  const unusedLabels = labels.filter(l => !usedLabels.includes(l))

  const MW = 60 // member column width

  const renderLabelGrid = (labelList) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 170, padding: '8px 0', textAlign: 'left', fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #dddcd5' }}>Label</th>
            {members.map((m, i) => (
              <th key={m.id} style={{ width: MW, padding: '4px 2px 8px', textAlign: 'center', borderBottom: '1px solid #dddcd5' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {m.avatarUrl
                    ? <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                    : <Avatar name={m.name} i={i} sz={22} />
                  }
                  <div style={{ fontSize: 8, color: '#9a9a9e', marginTop: 2, width: MW - 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {m.name.split(' ')[0]}
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labelList.map(label => {
            const cnt = issues.filter(i => (i.labels?.nodes || []).some(l => l.name === label)).length
            const col = issues.flatMap(i => i.labels?.nodes || []).find(l => l.name === label)?.color
            return (
              <tr key={label} style={{ borderBottom: '1px solid #f0efe9' }}>
                <td style={{ padding: '7px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: col ? `#${col}` : '#9a9a9e', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
                  <span style={{ fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace' }}>{cnt}i</span>
                </td>
                {members.map((m, mi) => {
                  const checked = (labelMap[label] || []).includes(m.id)
                  return (
                    <td key={m.id} style={{ width: MW, textAlign: 'center', padding: '3px 0' }}>
                      <div onClick={() => toggleLabelMember(label, m.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <div style={{
                          width: 17, height: 17, borderRadius: 4,
                          border: `2px solid ${checked ? AV_FG[mi % AV_FG.length] : '#dddcd5'}`,
                          background: checked ? AV_BG[mi % AV_BG.length] : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: AV_FG[mi % AV_FG.length], transition: 'all 0.12s',
                        }}>
                          {checked ? '✓' : ''}
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <H1>Assign <R>Issue Labels</R> to <R>Team Members</R></H1>
      <Sub>Tick which team members can work on each label. Members can cover multiple labels.</Sub>
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Next →</Btn></Row>

      {usedLabels.length > 0 && (
        <Card>{renderLabelGrid(usedLabels)}</Card>
      )}

      {unusedLabels.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 8 }}>
            Not used in any issue — {unusedLabels.length} label{unusedLabels.length !== 1 ? 's' : ''}
          </div>
          <Card style={{ opacity: 0.6 }}>{renderLabelGrid(unusedLabels)}</Card>
        </>
      )}

      {err && <Err>{err}</Err>}
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Next →</Btn></Row>
    </div>
  )
}

// ── Project Priority Step ────────────────────────────────────────────────
const STATE_TYPE_ORDER = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'cancelled']

export function StepProjOrder({ projects, issues, chosenInits, projOrder, setProjOrder, projDeps, setProjDepsFor, onNext, onBack }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [dropIdx, setDropIdx] = useState(null)
  const [modalProjId, setModalProjId] = useState(null)
  const [dropError, setDropError] = useState(null)

  const ordered = projOrder.map(id => projects.find(p => p.id === id)).filter(Boolean)

  const projInitName = {}
  chosenInits.forEach(init => {
    (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name })
  })
  const fullName = pid => `${projInitName[pid] || 'Unknown'} >> ${projects.find(p => p.id === pid)?.name || ''}`

  const projIssues = pid => issues.filter(i => i.project?.id === pid)
  const stateCounts = (pid) => {
    const byType = {}
    projIssues(pid).forEach(i => {
      const t = i.state?.type || 'unknown'
      const name = i.state?.name || t
      const key = `${t}::${name}`
      byType[key] = (byType[key] || 0) + 1
    })
    return Object.entries(byType)
      .map(([key, count]) => { const [type, name] = key.split('::'); return { type, name, count } })
      .sort((a, b) => STATE_TYPE_ORDER.indexOf(a.type) - STATE_TYPE_ORDER.indexOf(b.type))
  }

  const onDragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move' }
  const onDragOverRow = (e, i) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    setDropIdx(e.clientY < rect.top + rect.height / 2 ? i : i + 1)
  }
  const validateOrder = (order) => {
    for (let i = 0; i < order.length; i++) {
      const deps = projDeps[order[i]] || []
      for (const depId of deps) {
        if (order.indexOf(depId) > i) {
          const pn = projects.find(p => p.id === order[i])?.name || '?'
          const dn = projects.find(p => p.id === depId)?.name || '?'
          return `"${pn}" depends on completion of "${dn}" — "${dn}" must be higher in the list.`
        }
      }
    }
    return null
  }
  const onDrop = (e) => {
    e.preventDefault()
    if (dragIdx === null || dropIdx === null || dropIdx === dragIdx || dropIdx === dragIdx + 1) { setDragIdx(null); setDropIdx(null); return }
    const next = [...projOrder]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(dropIdx > dragIdx ? dropIdx - 1 : dropIdx, 0, moved)
    const err = validateOrder(next)
    if (err) { setDropError(err); setDragIdx(null); setDropIdx(null); return }
    setProjOrder(next); setDropError(null); setDragIdx(null); setDropIdx(null)
  }
  const onDragEnd = () => { setDragIdx(null); setDropIdx(null) }

  const wouldCreateCycle = (projId, depId) => {
    const visited = new Set()
    const walk = (id) => { if (id === projId) return true; if (visited.has(id)) return false; visited.add(id); return (projDeps[id] || []).some(d => walk(d)) }
    return walk(depId)
  }
  const toggleDep = (projId, depId) => {
    const cur = new Set(projDeps[projId] || [])
    const adding = !cur.has(depId)
    if (adding && wouldCreateCycle(projId, depId)) return
    adding ? cur.add(depId) : cur.delete(depId)
    setProjDepsFor(projId, [...cur])
    if (adding) {
      const order = [...projOrder]; const pi = order.indexOf(projId); const di = order.indexOf(depId)
      if (di > pi) { order.splice(di, 1); order.splice(pi, 0, depId); setProjOrder(order) }
    }
  }

  const modalOthers = modalProjId ? ordered.filter(p => p.id !== modalProjId) : []
  const modalDeps = modalProjId ? (projDeps[modalProjId] || []) : []

  return (
    <div>
      <H1>Determine <R>Project Priority</R></H1>
      <Sub>Drag projects into priority order. #1 gets first pick of capacity. Click "depends on completion of" to set hard dependencies.</Sub>
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={() => {
        const err = validateOrder(projOrder)
        if (err) setDropError(err)
        else onNext()
      }}>Next →</Btn></Row>
      <div
        onDragOver={e => {
          e.preventDefault(); e.dataTransfer.dropEffect = 'move'
          const children = e.currentTarget.querySelectorAll('[data-proj-row]')
          if (children.length) {
            const fr = children[0].getBoundingClientRect(); const lr = children[children.length - 1].getBoundingClientRect()
            if (e.clientY < fr.top + fr.height / 2) setDropIdx(0)
            else if (e.clientY > lr.top + lr.height / 2) setDropIdx(ordered.length)
          }
        }}
        onDrop={onDrop}
      >
        {ordered.map((proj, i) => {
          const deps = projDeps[proj.id] || []
          const depNames = deps.map(d => projects.find(p => p.id === d)?.name).filter(Boolean)
          const showBefore = dragIdx !== null && dropIdx === i && dropIdx !== dragIdx && dropIdx !== dragIdx + 1
          const showAfter = dragIdx !== null && i === ordered.length - 1 && dropIdx === ordered.length && dropIdx !== dragIdx + 1
          return (
            <div key={proj.id}>
              {showBefore && <div style={{ height: 3, background: '#e63946', borderRadius: 2, margin: '4px 0' }} />}
              <div data-proj-row draggable onDragStart={e => onDragStart(e, i)} onDragOver={e => onDragOverRow(e, i)} onDragEnd={onDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 6, background: 'white', border: '1.5px solid #e8e7e3', borderRadius: 8, cursor: 'grab', opacity: dragIdx === i ? 0.4 : 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: '#1a1a2e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 400, color: '#9a9a9e' }}>{projInitName[proj.id] || 'Unknown'}</span>
                    <span style={{ color: '#c8c7be', margin: '0 5px' }}>&gt;&gt;</span>
                    <span style={{ fontWeight: 600 }}>{proj.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                    {stateCounts(proj.id).map(({ name, count }) => (
                      <span key={name} style={{ fontSize: 9, color: '#9a9a9e', fontFamily: 'monospace', background: '#f0efe9', padding: '1px 6px', borderRadius: 3 }}>{count} {name.toLowerCase()}</span>
                    ))}
                  </div>
                </div>
                <div onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setModalProjId(proj.id) }}
                  style={{ flexShrink: 0, cursor: 'pointer', textAlign: 'right', maxWidth: 180 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: deps.length ? '#e63946' : '#c8c7be', whiteSpace: 'nowrap' }}>depends on completion of</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', marginTop: 1, color: deps.length ? '#1a1a2e' : '#c8c7be', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deps.length ? depNames.join(', ') : 'none'}</div>
                </div>
                <div style={{ color: '#c8c7be', fontSize: 14, cursor: 'grab', padding: '0 4px' }}>⠿</div>
              </div>
              {showAfter && <div style={{ height: 3, background: '#e63946', borderRadius: 2, margin: '4px 0' }} />}
            </div>
          )
        })}
      </div>
      {dropError && (
        <div style={{ color: '#e63946', fontFamily: 'monospace', fontSize: 12, marginBottom: 14, padding: '9px 13px', background: 'rgba(230,57,70,0.08)', borderRadius: 6, border: '1px solid rgba(230,57,70,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{dropError}</span>
          <span onClick={() => setDropError(null)} style={{ cursor: 'pointer', fontSize: 14, opacity: 0.6, flexShrink: 0 }}>✕</span>
        </div>
      )}
      {modalProjId && (
        <div onClick={() => setModalProjId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 420, maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', border: '1px solid #e8e7e3' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Depends on completion of</div>
            <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginBottom: 4 }}>{fullName(modalProjId)}</div>
            <div style={{ fontSize: 11, color: '#9a9a9e', marginBottom: 16 }}>Select projects that must finish before this one can start.</div>
            {modalOthers.map(op => {
              const checked = modalDeps.includes(op.id)
              const circular = !checked && wouldCreateCycle(modalProjId, op.id)
              return (
                <div key={op.id} onClick={() => !circular && toggleDep(modalProjId, op.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4, background: checked ? 'rgba(230,57,70,0.05)' : '#f9f9f7', border: `1.5px solid ${checked ? 'rgba(230,57,70,0.3)' : '#e8e7e3'}`, borderRadius: 8, cursor: circular ? 'not-allowed' : 'pointer', opacity: circular ? 0.4 : 1 }}>
                  <Check checked={checked} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12 }}><span style={{ color: '#9a9a9e' }}>{projInitName[op.id] || 'Unknown'}</span><span style={{ color: '#c8c7be', margin: '0 4px' }}>&gt;&gt;</span><span style={{ fontWeight: 600 }}>{op.name}</span></div></div>
                </div>
              )
            })}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}><Btn onClick={() => setModalProjId(null)}>Done</Btn></div>
          </div>
        </div>
      )}
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={() => {
        const err = validateOrder(projOrder)
        if (err) setDropError(err)
        else onNext()
      }}>Next →</Btn></Row>
    </div>
  )
}

// ── Label & Estimate Step ────────────────────────────────────────────────
export function StepLabelEstimate({ issues, chosenInits, projOrder, projects, orderMap, initId, issueLabels, setIssueLabel, availableLabels, setEst, members, getAssign, setAssign, err, onNext, onBack }) {
  const unestCount = issues.filter(i => !i.estimate || i.estimate <= 0).length

  const projInitName = {}
  chosenInits.forEach(init => {
    (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name })
  })

  const orderedProjs = projOrder.map(id => projects.find(p => p.id === id)).filter(Boolean)

  const getProjectIssues = (projId) => getOrdered(issues, projId, orderMap, initId)

  return (
    <div>
      <H1>Label & <R>Estimate</R></H1>
      <Sub>Set story point estimates for every issue. Labels are optional and help with auto-assignment via the label mapping step.</Sub>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 14,
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
        fontSize: 11, color: '#92400e', lineHeight: 1.6,
      }}>
        <span style={{ flexShrink: 0, fontSize: 14 }}>&#9432;</span>
        <span>Every issue needs an <strong>estimate</strong> and either a <strong>label</strong> or an <strong>assigned member</strong>. If both are set, the member takes priority. Changes on this screen are <strong>for this planning session only</strong> — update them directly in Linear to make permanent changes.</span>
      </div>

      {unestCount > 0 && (
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#e63946', marginBottom: 12 }}>
          <span>{unestCount} need estimates</span>
        </div>
      )}
      {err && <Err>{err}</Err>}

      {orderedProjs.map((proj, pi) => {
        const projIssues = getProjectIssues(proj.id)
        if (!projIssues.length) return null
        return (
          <Card key={proj.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 5, flexShrink: 0,
                background: '#1a1a2e', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
              }}>
                {pi + 1}
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 400, color: '#9a9a9e' }}>{projInitName[proj.id] || 'Unknown'}</span>
                <span style={{ color: '#c8c7be', margin: '0 5px' }}>&gt;&gt;</span>
                <span style={{ fontWeight: 700 }}>{proj.name}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', border: '1px solid #dddcd5', color: '#9a9a9e', padding: '2px 6px', borderRadius: 4 }}>
                {projIssues.length} issues
              </span>
            </div>
            {projIssues.map(issue => {
              const linearLabel = (issue.labels?.nodes || [])[0]?.name || ''
              const hasLabel = !!(issueLabels[issue.id] || linearLabel)
              const hasEst = issue.estimate != null && issue.estimate > 0
              const needsAttention = !hasEst
              return (
                <LabelEstimateRow key={issue.id} issue={issue}
                  issueLabels={issueLabels} setIssueLabel={setIssueLabel} availableLabels={availableLabels}
                  setEst={setEst} hasLabel={hasLabel} hasEst={hasEst} needsAttention={needsAttention}
                  linearLabel={linearLabel}
                  members={members} getAssign={getAssign} setAssign={setAssign}
                />
              )
            })}
          </Card>
        )
      })}

      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext}>Next →</Btn>
      </Row>
    </div>
  )
}

function LabelEstimateRow({ issue, issueLabels, setIssueLabel, availableLabels, setEst, hasLabel, hasEst, needsAttention, linearLabel, members, getAssign, setAssign }) {
  // Labels are always optional - they help with auto-assignment but are not required
  const [editingEst, setEditingEst] = useState(false)
  const [estVal, setEstVal] = useState('')

  const startEst = () => { setEditingEst(true); setEstVal(hasEst ? String(issue.estimate) : '') }
  const commitEst = () => {
    const n = parseInt(estVal)
    if (!isNaN(n) && n > 0) setEst(issue.id, n)
    setEditingEst(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      background: needsAttention ? '#fff8f8' : 'white',
      border: `1.5px solid ${needsAttention ? '#fecaca' : '#e8e7e3'}`,
      borderRadius: 8, padding: '9px 12px', marginBottom: 4,
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', color: '#9a9a9e', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
        {issue.identifier}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{issue.title}</div>
      </div>
      {/* Label dropdown (optional) */}
      <select value={issueLabels[issue.id] || ''} onChange={e => setIssueLabel(issue.id, e.target.value)}
        style={{ ...inpS, width: 130, padding: '4px 8px', fontSize: 11,
          background: hasLabel ? 'rgba(45,106,79,0.08)' : '#f0efe9',
          borderColor: hasLabel ? 'rgba(45,106,79,0.3)' : '#dddcd5',
          color: hasLabel ? '#2d6a4f' : '#9a9a9e',
        }}>
        {linearLabel && !issueLabels[issue.id]
          ? <option value=''>{linearLabel}</option>
          : <option value=''>{linearLabel ? linearLabel + ' (original)' : 'No label'}</option>
        }
        {availableLabels.filter(l => l !== linearLabel).map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      {/* Assignment dropdown */}
      <select value={getAssign(issue.id) || (issue.assignee?.id || '')} onChange={e => setAssign(issue.id, e.target.value === '__auto__' ? '__auto__' : e.target.value)}
        style={{ ...inpS, width: 120, padding: '4px 8px', fontSize: 11,
          background: (getAssign(issue.id) && getAssign(issue.id) !== '__auto__') || (!getAssign(issue.id) && issue.assignee?.id) ? 'rgba(45,106,79,0.08)' : '#f0efe9',
          borderColor: (getAssign(issue.id) && getAssign(issue.id) !== '__auto__') || (!getAssign(issue.id) && issue.assignee?.id) ? 'rgba(45,106,79,0.3)' : '#dddcd5',
          color: (getAssign(issue.id) && getAssign(issue.id) !== '__auto__') || (!getAssign(issue.id) && issue.assignee?.id) ? '#2d6a4f' : '#5a5a72',
        }}>
        <option value='__auto__'>Auto</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {/* Estimate */}
      {editingEst ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <input autoFocus type='number' min={1} max={200} value={estVal}
            onChange={e => setEstVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEst(); if (e.key === 'Escape') setEditingEst(false) }}
            onBlur={commitEst}
            style={{ width: 48, textAlign: 'center', padding: '3px 5px', fontFamily: 'monospace', fontSize: 12, borderRadius: 5, border: '1.5px solid #1a1a2e', outline: 'none', background: 'white' }} />
          <span style={{ fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace' }}>pt</span>
        </div>
      ) : (
        <span onClick={startEst} title='Click to edit estimate'
          style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
            flexShrink: 0, cursor: 'pointer', minWidth: 38, textAlign: 'center',
            background: hasEst ? '#1a1a2e' : '#f97316', color: 'white' }}>
          {hasEst ? `${issue.estimate}pt` : '? pt'}
        </span>
      )}
    </div>
  )
}
