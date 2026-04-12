import { useState, useRef, useEffect } from 'react'
import { Btn, GBtn, Check, Row, H1, R, Sub } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'

// ── Issue Row ────────────────────────────────────────────────────────────────
function IssueRow({ issue, idx, isDragging, issueLabels, deps, linearDepsSet, onOpenDepModal, isCommitted }) {
  const linearCount = deps.filter(d => linearDepsSet[issue.id]?.has(d)).length
  const linearLabel = (issue.labels?.nodes || [])[0]?.name || ''
  const effectiveLabel = issueLabels[issue.id] || linearLabel
  const hasEst = issue.estimate != null && issue.estimate > 0
  const cycleName = issue.cycle?.number ? `C${issue.cycle.number}` : null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: isCommitted ? '#f0fff4' : 'white',
        border: `1.5px solid ${isCommitted ? '#bbf7d0' : '#dddcd5'}`,
        borderRadius: 8, padding: '7px 10px',
        userSelect: 'none',
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {!isCommitted && <span style={{ color: '#c8c7be', fontSize: 14, flexShrink: 0, cursor: 'grab' }}>⠿</span>}
      {isCommitted && <span style={{ fontSize: 10, flexShrink: 0, color: '#166534' }}>&#x1F512;</span>}
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', width: 16, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', color: '#9a9a9e', padding: '2px 5px', borderRadius: 4, flexShrink: 0 }}>
        {issue.identifier}
      </span>
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {issue.title}
      </span>
      {effectiveLabel && (
        <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, background: '#f0efe9', color: '#9a9a9e', flexShrink: 0 }}>
          {effectiveLabel}
        </span>
      )}
      {hasEst && (
        <span style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1a1a2e', color: 'white', flexShrink: 0 }}>
          {issue.estimate}pt
        </span>
      )}
      {isCommitted && cycleName && (
        <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, background: '#bbf7d0', color: '#166534', flexShrink: 0 }}>
          {cycleName}
        </span>
      )}
      {/* Dependency button — not draggable */}
      <button
        type="button"
        onMouseDown={e => e.stopPropagation()}
        onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
        draggable={false}
        onClick={e => { e.stopPropagation(); e.preventDefault(); onOpenDepModal(issue.id) }}
        style={{
          fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, flexShrink: 0,
          cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
          background: deps.length ? 'rgba(230,57,70,0.08)' : '#f0efe9',
          color: deps.length ? '#e63946' : '#c8c7be',
          outline: deps.length ? '1px solid rgba(230,57,70,0.2)' : 'none',
        }}>
        {deps.length
          ? `${deps.length} dep${deps.length > 1 ? 's' : ''}${linearCount ? ` (${linearCount} from Linear)` : ''}`
          : 'deps'}
      </button>
    </div>
  )
}

// ── Project Block (issues inside) ────────────────────────────────────────────
function ProjectBlock({ proj, pi, initName, issues, orderMap, initId, issueLabels, issueDeps, linearDepsSet, setIssueDepsFor, saveOrder, startIso }) {
  const [ord, setOrd] = useState(() => getOrdered(issues, proj.id, orderMap, initId))
  const [modalIssueId, setModalIssueId] = useState(null)
  const dragFrom = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [draggingIdx, setDraggingIdx] = useState(null)

  useEffect(() => setOrd(getOrdered(issues, proj.id, orderMap, initId)), [issues, orderMap])

  const handleDragStart = (e, idx) => {
    dragFrom.current = idx
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', idx.toString())
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverIdx(e.clientY < midY ? idx : idx + 1)
  }

  const handleContainerDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Handle dragging above first or below last item
    const children = e.currentTarget.querySelectorAll('[data-issue-row]')
    if (!children.length) return
    const firstRect = children[0].getBoundingClientRect()
    const lastRect = children[children.length - 1].getBoundingClientRect()
    if (e.clientY < firstRect.top + firstRect.height / 2) setDragOverIdx(0)
    else if (e.clientY > lastRect.top + lastRect.height / 2) setDragOverIdx(ord.length)
  }

  const [dropError, setDropError] = useState(null)

  const handleDrop = (e) => {
    e.preventDefault()
    const fromIdx = dragFrom.current
    const toGap = dragOverIdx
    dragFrom.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)

    if (fromIdx === null || toGap === null) return
    if (toGap === fromIdx || toGap === fromIdx + 1) return

    const next = [...ord]
    const [moved] = next.splice(fromIdx, 1)
    const insertAt = toGap > fromIdx ? toGap - 1 : toGap
    next.splice(insertAt, 0, moved)

    // Validate: issue dependencies
    const ids = next.map(i => i.id)
    for (let i = 0; i < ids.length; i++) {
      for (const depId of (issueDeps[ids[i]] || [])) {
        const depIdx = ids.indexOf(depId)
        if (depIdx >= 0 && depIdx > i) {
          const issueName = next[i].identifier || next[i].title
          const depName = next.find(x => x.id === depId)?.identifier || '?'
          setDropError(`"${issueName}" depends on "${depName}" — "${depName}" must come first.`)
          return
        }
      }
    }

    // Validate: committed issues must stay in cycle-date order relative to each other
    const committedInOrder = next.filter(i => i.cycle?.startsAt)
    for (let i = 1; i < committedInOrder.length; i++) {
      if (new Date(committedInOrder[i].cycle.startsAt) < new Date(committedInOrder[i - 1].cycle.startsAt)) {
        setDropError(`Committed issues must stay in cycle order — "${committedInOrder[i].identifier}" (${committedInOrder[i].cycle.number ? 'C' + committedInOrder[i].cycle.number : ''}) can't come before "${committedInOrder[i - 1].identifier}".`)
        return
      }
    }

    setDropError(null)
    setOrd(next)
    saveOrder(proj.id, next.map(i => i.id))
  }

  const handleDragEnd = () => {
    dragFrom.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  // Issue dependency helpers
  const wouldCreateCycle = (issueId, depId) => {
    const visited = new Set()
    const walk = (id) => {
      if (id === issueId) return true
      if (visited.has(id)) return false
      visited.add(id)
      return (issueDeps[id] || []).some(d => walk(d))
    }
    return walk(depId)
  }

  // Check if adding a dep would violate cycle date order
  const wouldViolateCycleOrder = (issueId, depId) => {
    const issue = ord.find(i => i.id === issueId)
    const dep = ord.find(i => i.id === depId)
    if (!issue || !dep) return false
    // If the issue is committed to an earlier cycle than the dep, it's invalid
    // (issue would need to wait for dep, but it's already committed earlier)
    if (issue.cycle?.startsAt && dep.cycle?.startsAt) {
      return new Date(issue.cycle.startsAt) < new Date(dep.cycle.startsAt)
    }
    return false
  }

  const toggleDep = (issueId, depId) => {
    const cur = new Set(issueDeps[issueId] || [])
    const adding = !cur.has(depId)
    if (adding && wouldCreateCycle(issueId, depId)) return
    if (adding && wouldViolateCycleOrder(issueId, depId)) return
    adding ? cur.add(depId) : cur.delete(depId)
    setIssueDepsFor(issueId, [...cur])
    // Auto-reorder: ensure depId comes before issueId in the list
    if (adding) {
      const next = [...ord]
      const issueIdx = next.findIndex(i => i.id === issueId)
      const depIdx = next.findIndex(i => i.id === depId)
      if (depIdx > issueIdx && depIdx !== -1 && issueIdx !== -1) {
        const [moved] = next.splice(depIdx, 1)
        next.splice(issueIdx, 0, moved)
        setOrd(next)
        saveOrder(proj.id, next.map(i => i.id))
      }
    }
  }

  const modalIssue = modalIssueId ? ord.find(i => i.id === modalIssueId) : null
  const modalOthers = modalIssue ? ord.filter(i => i.id !== modalIssueId) : []
  const modalDeps = modalIssueId ? (issueDeps[modalIssueId] || []) : []

  // Check if a drop indicator line should show
  const showLine = (gapIdx) => {
    if (draggingIdx === null || dragOverIdx !== gapIdx) return false
    if (gapIdx === draggingIdx || gapIdx === draggingIdx + 1) return false
    return true
  }

  return (
    <div style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 12, padding: 18, marginBottom: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      {/* Project header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 5, flexShrink: 0,
          background: '#1a1a2e', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
        }}>
          {pi + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 400, color: '#9a9a9e' }}>{initName}</span>
            <span style={{ color: '#c8c7be', margin: '0 5px' }}>&gt;&gt;</span>
            <span style={{ fontWeight: 700 }}>{proj.name}</span>
          </div>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', border: '1px solid #dddcd5', color: '#9a9a9e', padding: '2px 6px', borderRadius: 4 }}>
          {ord.length} issues
        </span>
      </div>

      {/* Issues list */}
      {ord.length === 0 && <div style={{ color: '#9a9a9e', fontFamily: 'monospace', fontSize: 12 }}>No issues.</div>}
      <div onDragOver={handleContainerDragOver} onDrop={handleDrop}>
        {ord.map((issue, idx) => {
          const deps = issueDeps[issue.id] || []
          const isCommitted = !!(issue.cycle?.startsAt && startIso)
          return (
            <div key={issue.id}>
              {showLine(idx) && <div style={{ height: 3, background: '#e63946', borderRadius: 2, margin: '2px 0' }} />}
              <div
                data-issue-row
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                style={{ marginBottom: 4, cursor: 'grab' }}
              >
                <IssueRow
                  issue={issue} idx={idx}
                  isDragging={draggingIdx === idx}
                  issueLabels={issueLabels}
                  deps={deps}
                  linearDepsSet={linearDepsSet}
                  isCommitted={isCommitted}
                  onOpenDepModal={setModalIssueId}
                />
              </div>
              {idx === ord.length - 1 && showLine(ord.length) && <div style={{ height: 3, background: '#e63946', borderRadius: 2, margin: '2px 0' }} />}
            </div>
          )
        })}
      </div>

      {/* Drop error */}
      {dropError && (
        <div style={{
          color: '#e63946', fontFamily: 'monospace', fontSize: 11, marginTop: 6, marginBottom: 6,
          padding: '8px 12px', background: 'rgba(230,57,70,0.08)',
          borderRadius: 6, border: '1px solid rgba(230,57,70,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{dropError}</span>
          <span onClick={() => setDropError(null)} style={{ cursor: 'pointer', fontSize: 13, opacity: 0.6, flexShrink: 0 }}>✕</span>
        </div>
      )}

      {/* Issue dependency modal */}
      {modalIssueId && (
        <div onClick={() => setModalIssueId(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 12, padding: 24, width: 460, maxHeight: '70vh', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)', border: '1px solid #e8e7e3',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Depends on completion of</div>
            <div style={{ fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', marginBottom: 4 }}>
              {modalIssue?.identifier} — {modalIssue?.title}
            </div>
            <div style={{ fontSize: 11, color: '#9a9a9e', marginBottom: 16 }}>
              Select issues that must finish before this one can start.
            </div>
            {modalOthers.map(op => {
              const checked = modalDeps.includes(op.id)
              const isFromLinear = checked && linearDepsSet[modalIssueId]?.has(op.id)
              const circular = !checked && wouldCreateCycle(modalIssueId, op.id)
              const cycleViolation = !checked && wouldViolateCycleOrder(modalIssueId, op.id)
              const disabled = circular || cycleViolation
              return (
                <div key={op.id} onClick={() => !disabled && toggleDep(modalIssueId, op.id)}
                  title={circular ? 'Would create a circular dependency' : cycleViolation ? 'This issue is committed to an earlier cycle' : ''}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginBottom: 4,
                    background: checked ? 'rgba(230,57,70,0.05)' : '#f9f9f7',
                    border: `1.5px solid ${checked ? 'rgba(230,57,70,0.3)' : '#e8e7e3'}`,
                    borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                  }}>
                  <Check checked={checked} />
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', flexShrink: 0 }}>{op.identifier}</span>
                  <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{op.title}</span>
                  {isFromLinear && (
                    <span style={{ fontSize: 8, fontFamily: 'monospace', padding: '2px 5px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', flexShrink: 0 }}>Linear</span>
                  )}
                </div>
              )
            })}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={() => setModalIssueId(null)}>Done</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Step: Order Issues ──────────────────────────────────────────────────
export default function StepOrderIssues({
  chosenInits, projects, issues, projOrder,
  orderMap, initId, issueLabels, issueDeps, linearDepsSet, crossProjectDeps, setIssueDepsFor, saveOrder, startIso, onNext, onBack
}) {
  const projInitName = {}
  chosenInits.forEach(init => {
    (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name })
  })

  const ordered = projOrder.map(id => projects.find(p => p.id === id)).filter(Boolean)

  return (
    <div>
      <H1>Order the <R>Issues</R></H1>
      <Sub>Drag issues to set order within each project. If issues have a [N] prefix in their title (e.g. [1], [2.1]), they are auto-sorted by that number, unless you make a change here. Click "deps" to set hard dependencies between issues.</Sub>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 14,
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
        fontSize: 11, color: '#92400e', lineHeight: 1.6,
      }}>
        <span style={{ flexShrink: 0, fontSize: 14 }}>&#9432;</span>
        <span>Issue ordering on this screen is <strong>for this planning session only</strong> and will not be saved. To set a permanent order, use the [N] prefix in issue titles in Linear (e.g. [1], [2], [3]). Dependencies set in Linear (blocks/blocked by) are imported automatically — you can also add or remove dependencies manually here.</span>
      </div>

      {(() => {
        const issueIds = new Set(issues.map(i => i.id))
        const relevant = (crossProjectDeps || []).filter(d => issueIds.has(d.blocker.id) || issueIds.has(d.blocked.id))
        if (!relevant.length) return null
        return (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#991b1b', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Cross-project dependencies found in Linear</div>
            <div style={{ marginBottom: 6 }}>
              The planner only supports dependencies within the same project. These cross-project dependencies will not be taken into account:
            </div>
            {relevant.map((d, i) => (
              <div key={i} style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 0' }}>
                {d.blocked.identifier} ({d.blocked.project?.name}) is blocked by {d.blocker.identifier} ({d.blocker.project?.name})
              </div>
            ))}
          </div>
        )
      })()}

      {ordered.map((proj, i) => (
        <ProjectBlock key={proj.id}
          proj={proj} pi={i} initName={projInitName[proj.id] || 'Unknown'}
          issues={issues} orderMap={orderMap} initId={initId}
          issueLabels={issueLabels} issueDeps={issueDeps} linearDepsSet={linearDepsSet} setIssueDepsFor={setIssueDepsFor}
          saveOrder={saveOrder} startIso={startIso}
        />
      ))}

      <Row>
        <GBtn onClick={onBack}>← Back</GBtn>
        <Btn onClick={onNext}>Next →</Btn>
      </Row>
    </div>
  )
}
