import { useState, useRef, useEffect } from 'react'
import { SEG, Avatar, Btn, GBtn, Card, Row, H1, R, Sub, SaveDot, inpS } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'

function IssueRow({ issue, idx, pin, hasE, isBlocked, isCommitted, isEditingBlock,
  eligible, members, lbls, onAssign, onStartBlock, onUnblock, onCommitBlock,
  blockVal, setBlockVal, startIso }) {

  const col = issue.labels?.nodes?.find(l => l.name === lbls[0])?.color

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: isBlocked ? '#fff8f8' : isCommitted ? '#f0fff4' : 'white',
          border: `1.5px solid ${isBlocked ? '#fecaca' : isCommitted ? '#bbf7d0' : '#dddcd5'}`,
          borderRadius: 8, padding: '7px 10px', marginBottom: isEditingBlock ? 0 : 4,
          cursor: isEditingBlock ? 'default' : 'grab', userSelect: 'none',
        }}
      >
        <span style={{ color: '#c8c7be', fontSize: 14, flexShrink: 0 }}>⠿</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', width: 16, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', color: '#9a9a9e', padding: '2px 5px', borderRadius: 4, flexShrink: 0 }}>
          {issue.identifier}
        </span>
        <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: isBlocked ? 0.5 : 1, textDecoration: isBlocked ? 'line-through' : 'none' }}>
          {issue.title}
        </span>
        {isCommitted && (
          <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 3, background: '#bbf7d0', color: '#166534', flexShrink: 0 }}>
            committed
          </span>
        )}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {lbls.map(l => {
            const lc = issue.labels?.nodes?.find(ll => ll.name === l)?.color
            return (
              <span key={l} style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 4px', borderRadius: 3,
                background: lc ? `#${lc}22` : '#f0efe9', border: `1px solid ${lc ? `#${lc}55` : '#dddcd5'}`,
                color: lc ? `#${lc}` : '#9a9a9e' }}>
                {l}
              </span>
            )
          })}
        </div>
        {!isBlocked && (
          <select value={pin || ''} onChange={e => onAssign(issue.id, e.target.value)}
            style={{ ...inpS, width: 110, padding: '3px 6px', fontSize: 11,
              background: pin ? 'rgba(45,106,79,0.08)' : '#f0efe9',
              borderColor: pin ? 'rgba(45,106,79,0.3)' : '#dddcd5',
              color: pin ? '#2d6a4f' : '#5a5a72',
            }}>
            <option value=''>Auto</option>
            {eligible.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
          background: hasE ? '#1a1a2e' : '#fef3c7',
          color: hasE ? 'white' : '#92400e',
          border: hasE ? 'none' : '1px solid #fde68a',
        }}>
          {hasE ? `${issue.estimate}pt` : '–'}
        </span>
        {isBlocked ? (
          <span onClick={() => onUnblock(issue.id)} title='Unblock'
            style={{ fontSize: 10, cursor: 'pointer', color: '#ef4444', fontFamily: 'monospace', flexShrink: 0, padding: '2px 5px', background: '#fee2e2', borderRadius: 4 }}>
            🚫 unblock
          </span>
        ) : (
          <span onClick={() => onStartBlock(issue)} title='Mark as blocked'
            style={{ fontSize: 10, cursor: 'pointer', color: '#9a9a9e', fontFamily: 'monospace', flexShrink: 0, padding: '2px 5px', background: '#f0efe9', borderRadius: 4, border: '1px solid #dddcd5' }}>
            block
          </span>
        )}
      </div>
      {isEditingBlock && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 4, padding: '6px 8px', background: '#fff8f8', border: '1.5px solid #fecaca', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
          <input autoFocus value={blockVal} onChange={e => setBlockVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onCommitBlock(issue.id); if (e.key === 'Escape') onCommitBlock(null) }}
            placeholder='Why is this blocked? (optional)'
            style={{ ...inpS, flex: 1, padding: '5px 9px', fontSize: 12, background: 'white' }} />
          <Btn onClick={() => onCommitBlock(issue.id)}>Save</Btn>
        </div>
      )}
      {isBlocked && issue._blockNote && !isEditingBlock && (
        <div style={{ fontSize: 11, color: '#ef4444', fontFamily: 'monospace', padding: '3px 8px 6px', marginTop: -4, marginBottom: 4 }}>
          🚫 {issue._blockNote}
        </div>
      )}
    </div>
  )
}

function ProjectBlock({ proj, pi, issues, orderMap, initId, getAssign, setAssign, members, labelMap, issueLabels, blocked, setBlockNote, getEligible, startIso, saveOrder }) {
  const [ord, setOrd] = useState(() => getOrdered(issues, proj.id, orderMap, initId))
  const [editingBlock, setEditingBlock] = useState(null)
  const [blockVal, setBlockVal] = useState('')
  const from = useRef(null)

  useEffect(() => setOrd(getOrdered(issues, proj.id, orderMap, initId)), [issues, orderMap])

  const drop = (e, toIdx) => {
    e.preventDefault()
    if (from.current == null || from.current === toIdx) return
    const next = [...ord]
    const [mv] = next.splice(from.current, 1)
    next.splice(toIdx, 0, mv)
    setOrd(next)
    saveOrder(proj.id, next.map(i => i.id))
    from.current = null
  }

  const startBlock = issue => { setEditingBlock(issue.id); setBlockVal(blocked[issue.id] || '') }
  const commitBlock = id => { if (id) setBlockNote(id, blockVal.trim() || null); setEditingBlock(null) }
  const unblock = id => setBlockNote(id, null)

  return (
    <div style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 12, padding: 18, marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG[pi % SEG.length], flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>{proj.name}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', border: '1px solid #dddcd5', color: '#9a9a9e', padding: '2px 6px', borderRadius: 4 }}>
          {ord.length} issues
        </span>
      </div>
      {ord.length === 0 && <div style={{ color: '#9a9a9e', fontFamily: 'monospace', fontSize: 12 }}>No backlog issues.</div>}
      {ord.map((issue, idx) => {
        const pin = getAssign(issue.id)
        const hasE = issue.estimate != null && issue.estimate > 0
        const isBlocked = blocked[issue.id] != null && blocked[issue.id] !== ''
        const isEditingBlock = editingBlock === issue.id
        const isCommitted = !!(issue.cycle?.startsAt && startIso)
        const eligible = getEligible(issue)
        const lbls = [...(issue.labels?.nodes || []).map(l => l.name), ...(issueLabels[issue.id] ? [issueLabels[issue.id]] : [])]

        return (
          <div key={issue.id} draggable={!isEditingBlock}
            onDragStart={e => { from.current = idx; e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => drop(e, idx)}>
            <IssueRow
              issue={issue} idx={idx} pin={pin} hasE={hasE}
              isBlocked={isBlocked} isCommitted={isCommitted} isEditingBlock={isEditingBlock}
              eligible={eligible} members={members} lbls={lbls}
              onAssign={setAssign}
              onStartBlock={startBlock} onUnblock={unblock} onCommitBlock={commitBlock}
              blockVal={blockVal} setBlockVal={setBlockVal}
              startIso={startIso}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function StepOrder({ chosenInits, projects, issues, orderMap, initId, getAssign, setAssign, members, labelMap, issueLabels, blocked, setBlockNote, getEligible, startIso, saveOrder, savedState, resetSaved, onNext, onBack }) {
  return (
    <div>
      <H1>Order & <R>Assign</R></H1>
      <Sub>Drag to set priority. Mark issues as blocked. Assignee shows eligible members only.</Sub>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SaveDot state={savedState} />
        <GBtn onClick={resetSaved} sm>↺ Reset order</GBtn>
      </div>
      {chosenInits.map(it => {
        const itProjs = (it.projects?.nodes || []).filter(p => projects.find(pp => pp.id === p.id))
        if (!itProjs.length) return null
        return (
          <div key={it.id} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9a9a9e', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Initiative</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{it.name}</div>
              <div style={{ flex: 1, height: 2, background: '#e8e7e0', borderRadius: 1 }} />
              <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {itProjs.length} project{itProjs.length !== 1 ? 's' : ''}
              </div>
            </div>
            {itProjs.map((p, pi) => (
              <ProjectBlock key={p.id}
                proj={projects.find(pp => pp.id === p.id) || p} pi={pi}
                issues={issues} orderMap={orderMap} initId={initId}
                getAssign={getAssign} setAssign={setAssign}
                members={members} labelMap={labelMap} issueLabels={issueLabels}
                blocked={blocked} setBlockNote={setBlockNote}
                getEligible={getEligible} startIso={startIso}
                saveOrder={saveOrder}
              />
            ))}
          </div>
        )
      })}
      <Row><GBtn onClick={onBack}>← Back</GBtn><Btn onClick={onNext}>Next: Estimates →</Btn></Row>
    </div>
  )
}
