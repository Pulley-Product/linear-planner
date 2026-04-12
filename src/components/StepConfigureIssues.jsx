import { useState, useRef, useEffect } from 'react'
import { Btn, GBtn, Check, Row, H1, R, Sub, Err, Card, inpS } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'
import { linearQuery, buildIssueUpdateMutation } from '../utils/linear.js'

// Small "was:" indicator for changed fields
function Was({ text }) {
  if (!text) return null
  return <div style={{ fontSize: 8, color: '#e63946', fontFamily: 'monospace', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Linear: {text}</div>
}

// ── Issue Row (combined: drag, estimate, label, assignment, deps) ────────────
function IssueRow({
  issue, idx, displayLabel, isDragging, issueLabels, setIssueLabel, availableLabels,
  setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  deps, linearDepsSet, onOpenDepModal, trackEdit, issueEdits,
  isSelected, onToggleSelect,
}) {
  const linearLabel = (issue.labels?.nodes || [])[0]?.name || ''
  const effectiveLabel = issueLabels[issue.id] || linearLabel
  const hasEst = issue.estimate != null && issue.estimate > 0
  const hasCycle = !!issue.cycle?.id

  const [editingEst, setEditingEst] = useState(false)
  const [estVal, setEstVal] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState('')

  const startEst = () => { setEditingEst(true); setEstVal(hasEst ? String(issue.estimate) : '') }
  const commitEst = () => {
    const n = parseInt(estVal)
    if (!isNaN(n) && n > 0) {
      trackEdit(issue.id, 'estimate', issueEdits?.estimate?.original ?? issue.estimate, n)
      setEst(issue.id, n)
    }
    setEditingEst(false)
  }

  const startTitle = () => { setEditingTitle(true); setTitleVal(issue.title) }
  const commitTitle = () => {
    const val = titleVal.trim()
    if (val && val !== issue.title) {
      trackEdit(issue.id, 'title', issueEdits?.title?.original ?? issue.title, val)
      setTitle(issue.id, val)
    }
    setEditingTitle(false)
  }

  const handleLabelChange = (e) => {
    const val = e.target.value
    trackEdit(issue.id, 'label', linearLabel, val || linearLabel)
    setIssueLabel(issue.id, val)
  }

  const handleAssignChange = (e) => {
    const val = e.target.value
    trackEdit(issue.id, 'assignee', issueEdits?.assignee?.original ?? issue.assignee?.id ?? null, val === '__auto__' ? null : val)
    setAssign(issue.id, val === '__auto__' ? '__auto__' : val)
  }

  const handleCycleChange = (e) => {
    const val = e.target.value
    const origId = issueEdits?.cycle?.original ?? issue.cycle?.id ?? null
    const origNum = issueEdits?.cycle?.originalNumber ?? issue.cycle?.number ?? null
    trackEdit(issue.id, 'cycle', origId, val || null, { originalNumber: origNum })
    setCycle(issue.id, val || null)
  }

  const hasLabel = !!(issueLabels[issue.id] || linearLabel)
  const assignVal = getAssign(issue.id)
  const hasAssignment = (assignVal && assignVal !== '__auto__') || (!assignVal && !!issue.assignee?.id)
  const assigneeNotOnTeam = !assignVal && issue.assignee?.id && !members.some(m => m.id === issue.assignee.id)
  const hasLabelOrAssignment = hasLabel || hasAssignment

  // "was:" values for changed fields
  const wasEst = issueEdits?.estimate ? (issueEdits.estimate.original ? `${issueEdits.estimate.original}pt` : '—') : null
  const wasTitle = issueEdits?.title ? (issueEdits.title.original || '—') : null
  const wasCycle = issueEdits?.cycle ? (issueEdits.cycle.original ? `C${issueEdits.cycle.originalNumber || cycles.find(c => c.id === issueEdits.cycle.original)?.number || '?'}` : '—') : null
  const wasLabel = issueEdits?.label ? (issueEdits.label.original || '—') : null
  const wasAssignee = issueEdits?.assignee ? (() => {
    const origId = issueEdits.assignee.original
    if (!origId) return '—'
    const m = members.find(m => m.id === origId)
    return m?.name || 'unknown'
  })() : null

  // Consistent control styling
  const ctrlStyle = (hasValue, isMandatoryMissing) => ({
    ...inpS, padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
    background: hasValue ? 'rgba(45,106,79,0.08)' : isMandatoryMissing ? 'rgba(230,57,70,0.06)' : '#f9f9f7',
    borderColor: hasValue ? 'rgba(45,106,79,0.3)' : isMandatoryMissing ? 'rgba(230,57,70,0.3)' : '#dddcd5',
    color: hasValue ? '#2d6a4f' : isMandatoryMissing ? '#e63946' : '#9a9a9e',
  })

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 7,
        background: 'white',
        border: '1.5px solid #e8e7e3',
        borderRadius: 8, padding: '7px 10px',
        userSelect: 'none',
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Select checkbox */}
      <span
        onMouseDown={e => e.stopPropagation()}
        onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
        draggable={false}
        onClick={e => { e.stopPropagation(); onToggleSelect() }}
        style={{ flexShrink: 0, cursor: 'pointer', marginTop: 2 }}
      >
        <Check checked={isSelected} />
      </span>

      {/* Drag handle */}
      <span style={{ color: '#c8c7be', fontSize: 14, flexShrink: 0, cursor: 'grab', marginTop: 1 }}>⠿</span>

      {/* Index */}
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', minWidth: 20, textAlign: 'center', flexShrink: 0, marginTop: 3 }}>{displayLabel || idx + 1}</span>

      {/* Identifier */}
      <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', color: '#9a9a9e', padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginTop: 2 }}>
        {issue.identifier}
      </span>

      {/* Title — click to edit */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingTitle ? (
          <input autoFocus value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
            onBlur={commitTitle}
            onMouseDown={e => e.stopPropagation()}
            draggable={false}
            style={{ ...ctrlStyle(true, false), width: '100%', fontSize: 11 }} />
        ) : (
          <div title={issue.title} onClick={startTitle}
            style={{ ...ctrlStyle(true, false), fontSize: 11, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'text' }}>
            {issue.title}
          </div>
        )}
        {wasTitle && <Was text={wasTitle} />}
      </div>

      {/* Cycle */}
      <div style={{ flexShrink: 0 }}>
        <select value={issue.cycle?.id || ''} onChange={handleCycleChange}
          onMouseDown={e => e.stopPropagation()} draggable={false}
          style={{ ...ctrlStyle(hasCycle, false), width: 70 }}>
          <option value=''>auto</option>
          {(() => {
            const seen = new Set()
            const opts = []
            // Add issue's current cycle first if not in future cycles
            if (issue.cycle?.id) {
              if (!cycles.some(c => c.id === issue.cycle.id)) {
                opts.push({ id: issue.cycle.id, number: issue.cycle.number })
                seen.add(issue.cycle.id)
              }
            }
            cycles.forEach(c => {
              if (!seen.has(c.id)) { seen.add(c.id); opts.push(c) }
            })
            return opts.map(c => <option key={c.id} value={c.id}>C{c.number}</option>)
          })()}
        </select>
        {wasCycle && <Was text={wasCycle} />}
      </div>

      {/* Label */}
      <div style={{ flexShrink: 0 }}>
        <select value={issueLabels[issue.id] || ''} onChange={handleLabelChange}
          onMouseDown={e => e.stopPropagation()} draggable={false}
          style={{ ...ctrlStyle(hasLabel, !hasLabelOrAssignment), width: 110 }}>
          {linearLabel && !issueLabels[issue.id]
            ? <option value=''>{linearLabel}</option>
            : <option value=''>{linearLabel ? linearLabel + ' (orig)' : 'no label'}</option>
          }
          {availableLabels.filter(l => l !== linearLabel).map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {wasLabel && <Was text={wasLabel} />}
      </div>

      {/* Member */}
      <div style={{ flexShrink: 0 }}>
        <select value={getAssign(issue.id) || issue.assignee?.id || '__auto__'} onChange={handleAssignChange}
          onMouseDown={e => e.stopPropagation()} draggable={false}
          style={{ ...ctrlStyle(hasAssignment && !assigneeNotOnTeam, !hasLabelOrAssignment || assigneeNotOnTeam), width: 110 }}>
          <option value='__auto__'>auto</option>
          {issue.assignee?.id && !members.some(m => m.id === issue.assignee.id) && (
            <option value={issue.assignee.id}>{issue.assignee.name}</option>
          )}
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {wasAssignee && <Was text={wasAssignee} />}
      </div>

      {/* Estimate */}
      <div style={{ flexShrink: 0 }}>
        {editingEst ? (
          <input autoFocus type='number' min={1} max={200} value={estVal}
            onChange={e => setEstVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEst(); if (e.key === 'Escape') setEditingEst(false) }}
            onBlur={commitEst}
            onMouseDown={e => e.stopPropagation()} draggable={false}
            style={{ ...ctrlStyle(true, false), width: 50, textAlign: 'center' }} />
        ) : (
          <span onClick={startEst} title='Click to edit estimate'
            style={{ ...ctrlStyle(hasEst, !hasEst), width: 50, textAlign: 'center', cursor: 'pointer', display: 'inline-block' }}>
            {hasEst ? `${issue.estimate}pt` : '? pt'}
          </span>
        )}
        {wasEst && <Was text={wasEst} />}
      </div>

      {/* Dependencies */}
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
          draggable={false}
          onClick={e => { e.stopPropagation(); e.preventDefault(); onOpenDepModal(issue.id) }}
          style={{ ...ctrlStyle(deps.length > 0, false), width: 65, textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {deps.length
            ? `${deps.length} dep${deps.length > 1 ? 's' : ''}`
            : 'no deps'}
        </button>
      </div>
    </div>
  )
}

// ── Project Block (collapsible, with drag-order + dep modal) ─────────────────
function ProjectBlock({
  proj, pi, initName, issues, orderMap, initId, issueLabels, setIssueLabel,
  availableLabels, setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  issueDeps, linearDepsSet, setIssueDepsFor, saveOrder, startIso, trackEdit, edits,
  selected, toggleSelect, expandAll,
}) {
  const [collapsed, setCollapsed] = useState(true)
  useEffect(() => { if (expandAll !== null) setCollapsed(!expandAll) }, [expandAll])
  const [ord, setOrd] = useState(() => getOrdered(issues, proj.id, orderMap, initId))
  const [modalIssueId, setModalIssueId] = useState(null)
  const dragFrom = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dropError, setDropError] = useState(null)

  useEffect(() => setOrd(getOrdered(issues, proj.id, orderMap, initId)), [issues, orderMap])

  // ── Drag handlers ──
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
    const children = e.currentTarget.querySelectorAll('[data-issue-row]')
    if (!children.length) return
    const firstRect = children[0].getBoundingClientRect()
    const lastRect = children[children.length - 1].getBoundingClientRect()
    if (e.clientY < firstRect.top + firstRect.height / 2) setDragOverIdx(0)
    else if (e.clientY > lastRect.top + lastRect.height / 2) setDragOverIdx(ord.length)
  }

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

    setDropError(null)
    setOrd(next)
    saveOrder(proj.id, next.map(i => i.id))
  }

  const handleDragEnd = () => {
    dragFrom.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  // ── Dependency helpers ──
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

  const toggleDep = (issueId, depId) => {
    const cur = new Set(issueDeps[issueId] || [])
    const adding = !cur.has(depId)
    if (adding && wouldCreateCycle(issueId, depId)) return
    adding ? cur.add(depId) : cur.delete(depId)
    setIssueDepsFor(issueId, [...cur])
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

  const showLine = (gapIdx) => {
    if (draggingIdx === null || dragOverIdx !== gapIdx) return false
    if (gapIdx === draggingIdx || gapIdx === draggingIdx + 1) return false
    return true
  }

  if (!ord.length) return null

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Project header — clickable to collapse */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: '#f9f9f7', border: '1px solid #e8e7e3', borderRadius: collapsed ? 8 : '8px 8px 0 0',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 10, color: '#9a9a9e', flexShrink: 0, transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
        <div style={{
          width: 22, height: 22, borderRadius: 5, flexShrink: 0,
          background: '#1a1a2e', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
        }}>
          {pi + 1}
        </div>
        <div style={{ flex: 1, fontSize: 12 }}>
          <span style={{ fontWeight: 400, color: '#9a9a9e' }}>{initName}</span>
          <span style={{ color: '#c8c7be', margin: '0 5px' }}>&gt;&gt;</span>
          <span style={{ fontWeight: 700 }}>{proj.name}</span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0efe9', border: '1px solid #dddcd5', color: '#9a9a9e', padding: '2px 6px', borderRadius: 4 }}>
          {ord.length} issues
        </span>
      </div>

      {/* Issues list */}
      {!collapsed && (
        <div style={{ border: '1px solid #e8e7e3', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 10px' }}>
          <div onDragOver={handleContainerDragOver} onDrop={handleDrop}>
            {(() => {
              // Build parent → children grouping for display
              const ordIds = new Set(ord.map(i => i.id))
              const childrenOf = {} // parentId → [child issues in ord]
              const childIds = new Set()
              ord.forEach(issue => {
                if (issue.parent?.id && ordIds.has(issue.parent.id)) {
                  if (!childrenOf[issue.parent.id]) childrenOf[issue.parent.id] = []
                  childrenOf[issue.parent.id].push(issue)
                  childIds.add(issue.id)
                }
              })

              const renderIssue = (issue, ordIdx, indent, displayLabel) => {
                const deps = issueDeps[issue.id] || []
                const isChild = indent > 0
                const children = childrenOf[issue.id] || []
                return (
                  <div key={issue.id}>
                    {showLine(ordIdx) && <div style={{ height: 3, background: '#e63946', borderRadius: 2, margin: '2px 0', marginLeft: indent }} />}
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      {/* Connecting line for sub-issues */}
                      {isChild && (
                        <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center', position: 'relative' }}>
                          <div style={{ width: 1, background: '#dddcd5', position: 'absolute', top: 0, bottom: 0 }} />
                          <div style={{ width: 10, height: 1, background: '#dddcd5', position: 'absolute', top: 16, left: 10 }} />
                        </div>
                      )}
                      <div
                        data-issue-row
                        draggable
                        onDragStart={e => handleDragStart(e, ordIdx)}
                        onDragOver={e => handleDragOver(e, ordIdx)}
                        onDragEnd={handleDragEnd}
                        style={{ marginBottom: 4, cursor: 'grab', flex: 1 }}
                      >
                        <IssueRow
                          issue={issue} idx={ordIdx} displayLabel={displayLabel}
                          isDragging={draggingIdx === ordIdx}
                          issueLabels={issueLabels} setIssueLabel={setIssueLabel}
                          availableLabels={availableLabels}
                          setEst={setEst} setTitle={setTitle} members={members}
                          getAssign={getAssign} setAssign={setAssign}
                          cycles={cycles} setCycle={setCycle}
                          deps={deps} linearDepsSet={linearDepsSet}
                          onOpenDepModal={setModalIssueId}
                          trackEdit={trackEdit} issueEdits={edits[issue.id]}
                          isSelected={selected.has(issue.id)}
                          onToggleSelect={() => toggleSelect(issue.id)}
                        />
                      </div>
                    </div>
                    {/* Render children immediately after parent */}
                    {children.map((child, ci) => renderIssue(child, ord.indexOf(child), 20, `${displayLabel}.${ci + 1}`))}
                  </div>
                )
              }

              // Render top-level issues (skip children, they're rendered under their parent)
              let topIdx = 0
              return ord.filter(i => !childIds.has(i.id)).map(issue => {
                topIdx++
                const ordIdx = ord.indexOf(issue)
                return renderIssue(issue, ordIdx, 0, String(topIdx))
              })
            })()}
            {showLine(ord.length) && <div style={{ height: 3, background: '#e63946', borderRadius: 2, margin: '2px 0' }} />}
          </div>

          {/* Drop error */}
          {dropError && (
            <div style={{
              color: '#e63946', fontFamily: 'monospace', fontSize: 11, marginTop: 6,
              padding: '8px 12px', background: 'rgba(230,57,70,0.08)',
              borderRadius: 6, border: '1px solid rgba(230,57,70,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>{dropError}</span>
              <span onClick={() => setDropError(null)} style={{ cursor: 'pointer', fontSize: 13, opacity: 0.6, flexShrink: 0 }}>&#10005;</span>
            </div>
          )}

          {/* Dependency modal */}
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
                  const disabled = circular
                  return (
                    <div key={op.id} onClick={() => !disabled && toggleDep(modalIssueId, op.id)}
                      title={circular ? 'Would create a circular dependency' : ''}
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
      )}
    </div>
  )
}

// ── Initiative Section (collapsible) ─────────────────────────────────────────
function InitiativeSection({
  init, projects, projOrder, issues, orderMap, initId,
  issueLabels, setIssueLabel, availableLabels,
  setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  issueDeps, linearDepsSet, setIssueDepsFor, saveOrder, startIso, trackEdit, edits,
  selected, toggleSelect, expandAll,
}) {
  const [collapsed, setCollapsed] = useState(true)
  useEffect(() => { if (expandAll !== null) setCollapsed(!expandAll) }, [expandAll])
  const orderedProjs = projOrder
    .map(id => projects.find(p => p.id === id))
    .filter(p => p && (init.projects?.nodes || []).some(ip => ip.id === p.id))

  if (!orderedProjs.length) return null

  const totalIssues = orderedProjs.reduce((sum, p) => {
    return sum + getOrdered(issues, p.id, orderMap, initId).length
  }, 0)

  return (
    <div style={{
      marginBottom: 14, border: '1.5px solid #dddcd5', borderRadius: 10,
      overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    }}>
      {/* Initiative header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: '#1a1a2e', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0, transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>{init.name}</div>
          {init.status && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{init.status}</span>}
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
          {orderedProjs.length} project{orderedProjs.length !== 1 ? 's' : ''} &middot; {totalIssues} issues
        </span>
      </div>

      {/* Projects inside initiative */}
      {!collapsed && (
        <div style={{ padding: '10px 12px', background: 'white' }}>
          {orderedProjs.map((proj, pi) => (
            <ProjectBlock key={proj.id}
              proj={proj} pi={pi} initName={init.name}
              issues={issues} orderMap={orderMap} initId={initId}
              issueLabels={issueLabels} setIssueLabel={setIssueLabel}
              availableLabels={availableLabels}
              setEst={setEst} setTitle={setTitle} members={members}
              getAssign={getAssign} setAssign={setAssign}
              cycles={cycles} setCycle={setCycle}
              issueDeps={issueDeps} linearDepsSet={linearDepsSet}
              setIssueDepsFor={setIssueDepsFor}
              saveOrder={saveOrder} startIso={startIso}
              trackEdit={trackEdit} edits={edits}
              selected={selected} toggleSelect={toggleSelect}
              expandAll={expandAll}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Step Component ──────────────────────────────────────────────────────
export default function StepConfigureIssues({
  chosenInits, projects, issues, projOrder,
  orderMap, initId, issueLabels, setIssueLabel, availableLabels,
  setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  issueDeps, linearDepsSet, crossProjectDeps, setIssueDepsFor,
  saveOrder, startIso, trackEdit,
  edits, setEdits, apiKey,
  excludedIssues, setExcludedIssues,
  err, onNext, onBack,
}) {
  const [selected, setSelected] = useState(new Set())
  const [showExcluded, setShowExcluded] = useState(false)
  const [showCrossProjectDeps, setShowCrossProjectDeps] = useState(false)
  const [expandSignal, setExpandSignal] = useState(0) // positive=expand, negative=collapse, 0=default
  const expandAll = expandSignal === 0 ? null : expandSignal > 0
  const activeIssues = issues.filter(i => !excludedIssues.has(i.id))
  const excludedList = issues.filter(i => excludedIssues.has(i.id))
  const issueIds = new Set(issues.map(i => i.id))
  const relevantCrossProjectDeps = (crossProjectDeps || []).filter(d => issueIds.has(d.blocker.id) || issueIds.has(d.blocked.id))
  const memberIds = new Set(members.map(m => m.id))

  const toggleSelect = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const removeSelected = () => {
    const next = new Set(excludedIssues)
    selected.forEach(id => next.add(id))
    setExcludedIssues(next)
    setSelected(new Set())
  }

  const restoreIssue = (id) => {
    const next = new Set(excludedIssues)
    next.delete(id)
    setExcludedIssues(next)
  }

  const restoreAll = () => {
    setExcludedIssues(new Set())
  }

  // ── Save to Linear ──
  const editCount = Object.values(edits).reduce((sum, e) => sum + Object.keys(e).length, 0)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null) // { ok: N, failed: N } or null

  const saveToLinear = async () => {
    setSaving(true)
    setSaveResult(null)
    let ok = 0, failed = 0
    const errors = []
    for (const [issueId, fields] of Object.entries(edits)) {
      const issue = issues.find(i => i.id === issueId)
      const label = issue?.identifier || issueId
      try {
        const input = {}
        if (fields.title) input.title = fields.title.edited
        if (fields.estimate) input.estimate = fields.estimate.edited
        if (fields.cycle) input.cycleId = fields.cycle.edited || null
        if (fields.assignee) input.assigneeId = fields.assignee.edited || null
        if (Object.keys(input).length) {
          await linearQuery(apiKey, buildIssueUpdateMutation(), { id: issueId, input })
        }
        ok++
      } catch (e) {
        errors.push(`${label}: ${e.message}`)
        failed++
      }
    }
    setSaving(false)
    setSaveResult({ ok, failed, errors })
    if (failed === 0) setEdits({})
  }

  return (
    <div>
      <H1>Configure <R>Issues</R></H1>
      <Sub>Set estimates, labels, assignments, order, and dependencies for all issues. Drag to reorder within each project. Click a title to edit it (e.g. add [N] prefixes).</Sub>

      {/* Excluded issues banner */}
      {excludedList.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 14,
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11,
        }}>
          <span style={{ color: '#92400e' }}>{excludedList.length} issue{excludedList.length !== 1 ? 's' : ''} removed from plan</span>
          <span onClick={() => setShowExcluded(p => !p)} style={{ color: '#1d4ed8', cursor: 'pointer', fontFamily: 'monospace' }}>
            {showExcluded ? 'hide' : 'show'}
          </span>
          <span onClick={restoreAll} style={{ color: '#1d4ed8', cursor: 'pointer', fontFamily: 'monospace' }}>restore all</span>
        </div>
      )}

      {/* Excluded issues list */}
      {showExcluded && excludedList.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fafaf9', border: '1px solid #e8e7e3', borderRadius: 8 }}>
          {excludedList.map(issue => (
            <div key={issue.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e' }}>{issue.identifier}</span>
              <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#9a9a9e' }}>{issue.title}</span>
              <span onClick={() => restoreIssue(issue.id)} style={{ color: '#1d4ed8', cursor: 'pointer', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>restore</span>
            </div>
          ))}
        </div>
      )}

      {/* Cross-project deps warning */}
      {relevantCrossProjectDeps.length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '8px 14px', marginBottom: 14, fontSize: 11, color: '#991b1b',
        }}>
          <div onClick={() => setShowCrossProjectDeps(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: showCrossProjectDeps ? 'rotate(0deg)' : 'rotate(-90deg)' }}>&#9660;</span>
            <span style={{ fontWeight: 700 }}>Cross-project dependencies found in Linear ({relevantCrossProjectDeps.length})</span>
          </div>
          {showCrossProjectDeps && (
            <div style={{ marginTop: 6, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}>These will not be taken into account:</div>
              {relevantCrossProjectDeps.map((d, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 0' }}>
                  {d.blocked.identifier} ({d.blocked.project?.name}) is blocked by {d.blocker.identifier} ({d.blocker.project?.name})
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {err && <Err>{err}</Err>}

      {/* Save to Linear */}
      {editCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14,
          background: 'rgba(26,26,46,0.04)', border: '1.5px solid #1a1a2e', borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#1a1a2e', flex: 1 }}>
            {editCount} unsaved change{editCount !== 1 ? 's' : ''}
          </span>
          <Btn onClick={saveToLinear} disabled={saving}>
            {saving ? 'Saving...' : `Save ${editCount} change${editCount !== 1 ? 's' : ''} to Linear`}
          </Btn>
        </div>
      )}
      {saveResult && (
        <div style={{
          padding: '8px 14px', marginBottom: 14, borderRadius: 8, fontSize: 11, fontFamily: 'monospace',
          background: saveResult.failed ? '#fef2f2' : '#f0fdf4',
          border: saveResult.failed ? '1px solid #fecaca' : '1px solid #bbf7d0',
          color: saveResult.failed ? '#991b1b' : '#166534',
        }}>
          {saveResult.failed
            ? <>{saveResult.ok} saved, {saveResult.failed} failed:{saveResult.errors?.map((err, i) => <div key={i} style={{ marginTop: 4 }}>{err}</div>)}</>
            : `${saveResult.ok} issue${saveResult.ok !== 1 ? 's' : ''} updated in Linear`}
        </div>
      )}

      {/* Selection actions */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 14,
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, color: '#991b1b', fontFamily: 'monospace' }}>{selected.size} selected</span>
          <GBtn sm onClick={removeSelected}>Remove from plan</GBtn>
          <GBtn sm onClick={() => setSelected(new Set())}>Cancel</GBtn>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
        <GBtn onClick={onBack}>&#8592; Back</GBtn>
        <div style={{ display: 'flex', gap: 8 }}>
          <GBtn sm onClick={() => setExpandSignal(p => Math.abs(p) + 1)}>Expand all</GBtn>
          <GBtn sm onClick={() => setExpandSignal(p => -(Math.abs(p) + 1))}>Collapse all</GBtn>
          <Btn onClick={onNext}>Next &#8594;</Btn>
        </div>
      </div>

      {/* Initiative sections — sorted by earliest project in priority order */}
      {[...chosenInits].sort((a, b) => {
        const aMin = Math.min(...(a.projects?.nodes || []).map(p => { const i = projOrder.indexOf(p.id); return i === -1 ? Infinity : i }))
        const bMin = Math.min(...(b.projects?.nodes || []).map(p => { const i = projOrder.indexOf(p.id); return i === -1 ? Infinity : i }))
        return aMin - bMin
      }).map(init => (
        <InitiativeSection key={init.id}
          init={init} projects={projects} projOrder={projOrder}
          issues={activeIssues} orderMap={orderMap} initId={initId}
          issueLabels={issueLabels} setIssueLabel={setIssueLabel}
          availableLabels={availableLabels}
          setEst={setEst} setTitle={setTitle} members={members}
          getAssign={getAssign} setAssign={setAssign}
          cycles={cycles} setCycle={setCycle}
          issueDeps={issueDeps} linearDepsSet={linearDepsSet}
          setIssueDepsFor={setIssueDepsFor}
          saveOrder={saveOrder} startIso={startIso}
          trackEdit={trackEdit} edits={edits}
          selected={selected} toggleSelect={toggleSelect}
          expandAll={expandAll}
        />
      ))}

      <Row>
        <GBtn onClick={onBack}>&#8592; Back</GBtn>
        <Btn onClick={onNext}>Next &#8594;</Btn>
      </Row>
    </div>
  )
}
