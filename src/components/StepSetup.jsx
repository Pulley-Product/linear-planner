import { Avatar, Btn, GBtn, Card, Row, H1, R, Sub, Err, Check, Radio, SEG, inpS, pickRowStyle } from './ui.jsx'

// ── Step 1: Pick Team ──────────────────────────────────────────────────────
export function StepTeam({ allTeams, selTeamId, setSelTeamId, onNext, onBack }) {
  return (
    <div>
      <H1>Pick a <R>Team</R></H1>
      <Sub>Select the team whose members and cycles will be used for this plan.</Sub>
      <Card>
        {allTeams.map(t => (
          <div key={t.id} onClick={() => setSelTeamId(t.id)} style={pickRowStyle(selTeamId === t.id)}>
            <Radio checked={selTeamId === t.id} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 2 }}>
                {t.members?.nodes?.length || 0} members ·{' '}
                {t.cycles?.nodes?.length || 0} active/upcoming cycles
              </div>
            </div>
          </div>
        ))}
      </Card>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} disabled={!selTeamId}>Confirm Team →</Btn>
      </Row>
    </div>
  )
}

// ── Step 2: Pick Start Cycle ───────────────────────────────────────────────
export function StepCycle({ cycles, selCycleId, setSelCycleId, err, onNext, onBack }) {
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return (
    <div>
      <H1>Pick Start <R>Cycle</R></H1>
      <Sub>The plan starts at the beginning of this cycle. Week 1 = first week of the selected cycle.</Sub>
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
        <Btn onClick={onNext} disabled={!selCycleId}>Confirm Cycle →</Btn>
      </Row>
    </div>
  )
}

// ── Step 3: Pick Initiatives ───────────────────────────────────────────────
export function StepInitiatives({ allInits, selInits, setSelInits, onNext, onBack }) {
  const toggle = id => {
    const ns = new Set(selInits)
    ns.has(id) ? ns.delete(id) : ns.add(id)
    setSelInits(ns)
  }
  return (
    <div>
      <H1>Select <R>Initiatives</R></H1>
      <Sub>Pick which initiatives to include. Multiple selections are merged into one plan.</Sub>
      <Card>
        {allInits.map(it => {
          const sel = selInits.has(it.id)
          return (
            <div key={it.id} onClick={() => toggle(it.id)} style={pickRowStyle(sel)}>
              <Check checked={sel} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</div>
                <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace' }}>
                  {it.projects?.nodes?.length || 0} projects
                </div>
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Btn onClick={onNext} disabled={!selInits.size}>
            Load {selInits.size} Initiative{selInits.size !== 1 ? 's' : ''} →
          </Btn>
          <GBtn onClick={() => setSelInits(new Set(allInits.map(i => i.id)))}>All</GBtn>
          <GBtn onClick={() => setSelInits(new Set())}>None</GBtn>
        </div>
      </Card>
      <Row><GBtn onClick={onBack}>← Back</GBtn></Row>
    </div>
  )
}

// ── Step 4: Label → Member mapping ────────────────────────────────────────
const AV_BG = ['#dbeafe','#dcfce7','#fef9c3','#fee2e2','#ede9fe','#cffafe','#ffedd5','#fce7f3']
const AV_FG = ['#1d4ed8','#166534','#854d0e','#991b1b','#5b21b6','#0e7490','#9a3412','#9d174d']

export function StepLabelMap({ labels, members, labelMap, issues, toggleLabelMember, err, onNext, onBack }) {
  if (!labels.length) {
    return (
      <div>
        <H1>Map <R>Labels</R> → Members</H1>
        <Sub>No labels found on any issues — all members will be eligible for all issues.</Sub>
        <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Continue →</Btn></Row>
      </div>
    )
  }
  return (
    <div>
      <H1>Map <R>Labels</R> → Members</H1>
      <Sub>Tick which team members can work on each label. Members can cover multiple labels.</Sub>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #dddcd5' }}>
          <div style={{ width: 170, flexShrink: 0, fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Label</div>
          <div style={{ display: 'flex', flex: 1 }}>
            {members.map((m, i) => (
              <div key={m.id} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <Avatar name={m.name} i={i} sz={24} />
                <div style={{ fontSize: 9, color: '#9a9a9e', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                  {m.name.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
        {labels.map(label => {
          const cnt = issues.filter(i => (i.labels?.nodes || []).some(l => l.name === label)).length
          const col = issues.flatMap(i => i.labels?.nodes || []).find(l => l.name === label)?.color
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f0efe9' }}>
              <div style={{ width: 170, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: col ? `#${col}` : '#9a9a9e', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace' }}>{cnt}i</span>
              </div>
              <div style={{ display: 'flex', flex: 1 }}>
                {members.map((m, mi) => {
                  const checked = (labelMap[label] || []).includes(m.id)
                  return (
                    <div key={m.id} onClick={() => toggleLabelMember(label, m.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '3px 0' }}>
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
                  )
                })}
              </div>
            </div>
          )
        })}
      </Card>
      {err && <Err>{err}</Err>}
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Next →</Btn></Row>
    </div>
  )
}

// ── Step 5: Unlabelled Issues ──────────────────────────────────────────────
export function StepUnlabelled({ unlabelledIssues, issueLabels, setIssueLabel, labels, err, onNext, onBack }) {
  return (
    <div>
      <H1>Unlabelled <R>Issues</R></H1>
      <Sub>These issues have no label. Assign one so the planner knows who can work on them.</Sub>
      <Card>
        {unlabelledIssues.length === 0 && (
          <p style={{ color: '#2d6a4f', fontFamily: 'monospace', fontSize: 13 }}>✓ All issues have labels.</p>
        )}
        {unlabelledIssues.map(issue => (
          <div key={issue.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f0efe9', border: '1.5px solid #dddcd5', borderRadius: 8, padding: '9px 12px', marginBottom: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, background: 'white', border: '1px solid #dddcd5', color: '#9a9a9e', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
              {issue.identifier}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{issue.title}</div>
              <div style={{ fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 1 }}>{issue.project?.name}</div>
            </div>
            <select value={issueLabels[issue.id] || ''} onChange={e => setIssueLabel(issue.id, e.target.value)}
              style={{ ...inpS, width: 140, padding: '4px 8px', fontSize: 12,
                background: issueLabels[issue.id] ? 'rgba(45,106,79,0.08)' : 'white',
                borderColor: issueLabels[issue.id] ? 'rgba(45,106,79,0.3)' : '#dddcd5',
                color: issueLabels[issue.id] ? '#2d6a4f' : '#9a9a9e',
              }}>
              <option value=''>Pick label…</option>
              {labels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        ))}
      </Card>
      {err && <Err>{err}</Err>}
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Continue →</Btn></Row>
    </div>
  )
}

// ── Step 6: Project Scheduling Order ──────────────────────────────────────
export function StepProjOrder({ projects, projDeps, toggleProjDep, onNext, onBack }) {
  return (
    <div>
      <H1>Project <R>Scheduling Order</R></H1>
      <Sub>
        Set the order in which projects get staffed. The planner fills Project 1 first — once its members
        have no more capacity, it moves to Project 2, and so on.
      </Sub>
      <Card>
        {projects.map((proj, pi) => {
          const otherProjs = projects.filter(p => p.id !== proj.id)
          const deps = projDeps[proj.id] || []
          return (
            <div key={proj.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: pi < projects.length - 1 ? '1px solid #f0efe9' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG[pi % SEG.length], flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{proj.name}</span>
                {deps.length > 0 && (
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9a9a9e' }}>
                    staffed after {deps.length} other project{deps.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {otherProjs.map((op, opi) => {
                  const checked = deps.includes(op.id)
                  return (
                    <div key={op.id} onClick={() => toggleProjDep(proj.id, op.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
                        background: checked ? '#1a1a2e' : '#f0efe9',
                        border: `1.5px solid ${checked ? '#1a1a2e' : '#dddcd5'}`,
                        color: checked ? 'white' : '#5a5a72', fontSize: 12, transition: 'all 0.15s',
                      }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: checked ? 'white' : SEG[projects.indexOf(op) % SEG.length], flexShrink: 0, display: 'inline-block' }} />
                      {op.name}
                      {checked && <span style={{ fontSize: 10, opacity: 0.7 }}>✓</span>}
                    </div>
                  )
                })}
              </div>
              {deps.length > 0 && (
                <p style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 8 }}>
                  ↳ Staff {proj.name} after: {deps.map(d => projects.find(p => p.id === d)?.name).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          )
        })}
      </Card>
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Next: Order & Assign →</Btn></Row>
    </div>
  )
}
