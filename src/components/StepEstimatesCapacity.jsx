import { useState } from 'react'
import { SEG, Avatar, Btn, GBtn, Card, Row, H1, R, Sub, Err, inpS } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'

// ── Estimate Row ───────────────────────────────────────────────────────────
function EstimateRow({ issue, idx, setEst }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const hasE = issue.estimate != null && issue.estimate > 0

  const start = () => { setEditing(true); setVal(hasE ? String(issue.estimate) : '') }
  const commit = () => {
    const n = parseInt(val)
    if (!isNaN(n) && n > 0) setEst(issue.id, n)
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8,
      background: hasE ? 'white' : '#fffbeb',
      border: `1.5px solid ${hasE ? '#dddcd5' : '#fde68a'}`,
      borderRadius: 8, padding: '8px 11px', marginBottom: 4 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', width: 18, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', color: '#9a9a9e', padding: '2px 5px', borderRadius: 4, flexShrink: 0 }}>
        {issue.identifier}
      </span>
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {issue.title}
      </span>
      <span style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', flexShrink: 0 }}>
        {issue.project?.name}
      </span>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <input autoFocus type='number' min={1} max={200} value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={commit}
            style={{ width: 52, textAlign: 'center', padding: '4px 6px', fontFamily: 'monospace', fontSize: 13, borderRadius: 6, border: '1.5px solid #1a1a2e', outline: 'none', background: 'white' }} />
          <span style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace' }}>pt</span>
        </div>
      ) : (
        <span onClick={start} title='Click to edit'
          style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 5,
            flexShrink: 0, cursor: 'pointer', minWidth: 42, textAlign: 'center',
            background: hasE ? '#1a1a2e' : '#f97316', color: 'white' }}>
          {hasE ? `${issue.estimate}pt` : '? pt'}
        </span>
      )}
    </div>
  )
}

// ── Step: Estimates ────────────────────────────────────────────────────────
export function StepEstimates({ chosenInits, projects, issues, projOrder, orderMap, initId, setEst, err, onNext, onBack }) {
  const unestCount = issues.filter(i => !i.estimate || i.estimate <= 0).length

  const projInitName = {}
  chosenInits.forEach(init => {
    (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name })
  })

  const orderedProjs = projOrder.map(id => projects.find(p => p.id === id)).filter(Boolean)

  return (
    <div>
      <H1>Issue <R>Estimates</R></H1>
      <Sub>Review and set story point estimates. Amber = missing. Click any badge to edit.</Sub>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9a9a9e', marginBottom: 16 }}>
        {unestCount} unestimated · {issues.filter(i => i.estimate > 0).length} estimated
      </div>
      {err && <div style={{ color: '#e63946', fontFamily: 'monospace', fontSize: 12, marginBottom: 14, padding: '9px 13px', background: 'rgba(230,57,70,0.08)', borderRadius: 6, border: '1px solid rgba(230,57,70,0.2)' }}>{err}</div>}
      {orderedProjs.map((proj, pi) => {
        const projIssues = getOrdered(issues, proj.id, orderMap, initId)
        if (!projIssues.length) return null
        const unest = projIssues.filter(i => !i.estimate || i.estimate <= 0).length
        return (
          <div key={proj.id} style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 12, padding: 18, marginBottom: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
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
              {unest > 0 && (
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#e63946', background: '#fff7ed', border: '1px solid #fed7aa', padding: '2px 6px', borderRadius: 4 }}>
                  {unest} need estimates
                </span>
              )}
            </div>
            {projIssues.map((issue, idx) => (
              <EstimateRow key={issue.id} issue={issue} idx={idx} setEst={setEst} />
            ))}
          </div>
        )
      })}
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext}>Next: Capacity →</Btn>
      </Row>
    </div>
  )
}

// ── Step: Capacity ─────────────────────────────────────────────────────────
export function StepCapacity({ members, getCap, setCap, onNext, onBack }) {
  return (
    <div>
      <H1>Team <R>Capacity</R></H1>
      <Sub>Story points each person can complete per cycle.</Sub>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} danger>Generate Plan →</Btn>
      </Row>
      <Card>
        {members.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f0efe9', border: '1.5px solid #dddcd5', borderRadius: 8, padding: '11px 14px', marginBottom: 8 }}>
            <Avatar name={m.name} i={i} sz={32} />
            <div style={{ flex: 1, fontWeight: 500 }}>{m.name}</div>
            <input type='number' min={1} max={200} value={getCap(m.id)}
              onChange={e => setCap(m.id, e.target.value)}
              style={{ ...inpS, width: 65, textAlign: 'center', padding: '5px 8px' }} />
            <span style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace' }}>pts/cycle</span>
          </div>
        ))}
      </Card>
      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext} danger>Generate Plan →</Btn>
      </Row>
    </div>
  )
}
