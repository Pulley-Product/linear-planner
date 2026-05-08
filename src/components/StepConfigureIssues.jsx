import { useState, useRef, useEffect } from 'react'
import { Btn, GBtn, Check, Row, H1, R, Sub, Err, Card, inpS } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'
import { linearQuery, buildIssueCreateMutation, buildIssueUpdateMutation, buildRelationCreateMutation, buildRelationDeleteMutation } from '../utils/linear.js'

// Small "was:" indicator for changed fields
function Was({ text }) {
  if (!text) return null
  return <div style={{ fontSize: 8, color: '#e63946', fontFamily: 'monospace', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Linear: {text}</div>
}

// ── Issue Row (combined: drag, estimate, label, assignment, deps) ────────────
function IssueRow({
  issue, idx, displayLabel, isDragging, isExcluded, issueLabels, setIssueLabel, availableLabels,
  setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  deps, linearDepsSet, onOpenDepModal, trackEdit, issueEdits,
  isSelected, onToggleSelect, removeIssue,
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

  const titleInputRef = useRef(null)
  const startTitle = () => { setEditingTitle(true); setTitleVal(issue.title); setTimeout(() => { if (titleInputRef.current) { titleInputRef.current.setSelectionRange(0, 0); titleInputRef.current.scrollLeft = 0 } }, 0) }
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
    const origId = issueEdits?.assignee?.original ?? issue.assignee?.id ?? null
    const origName = issueEdits?.assignee?.originalName ?? issue.assignee?.name ?? null
    trackEdit(issue.id, 'assignee', origId, val === '__auto__' ? null : val, { originalName: origName })
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
    return issueEdits.assignee.originalName || members.find(m => m.id === origId)?.name || '—'
  })() : null
  const wasParent = issueEdits?.parent ? (issueEdits.parent.original ? 'had parent' : 'no parent') : null

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
        display: 'flex', alignItems: 'flex-start', gap: 14,
        background: isExcluded ? '#f5f4f0' : 'white',
        border: `1.5px solid ${isExcluded ? '#e8e7e3' : '#e8e7e3'}`,
        borderRadius: 8, padding: '7px 10px',
        userSelect: 'none',
        opacity: isDragging ? 0.4 : isExcluded ? 0.45 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Select checkbox — clicking restores if excluded */}
      <span
        onMouseDown={e => e.stopPropagation()}
        onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
        draggable={false}
        onClick={e => { e.stopPropagation(); onToggleSelect() }}
        style={{ flexShrink: 0, cursor: 'pointer', marginTop: 2, pointerEvents: 'auto' }}
      >
        <Check checked={isExcluded ? false : isSelected} />
      </span>

      {/* Drag handle */}
      <span style={{ color: '#c8c7be', fontSize: 14, flexShrink: 0, cursor: 'grab', marginTop: 1 }}>⠿</span>

      {/* Index */}
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', minWidth: 20, textAlign: 'center', flexShrink: 0, marginTop: 3 }}>{displayLabel || idx + 1}</span>

      {/* Identifier */}
      <span style={{ fontFamily: 'monospace', fontSize: issue.id.startsWith('__new__') ? 8 : 10, background: '#f0efe9', color: issue.id.startsWith('__new__') ? '#e63946' : '#9a9a9e', padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginTop: 2 }}>
        {issue.id.startsWith('__new__') ? 'Not on Linear' : issue.identifier}
      </span>

      {/* State */}
      {issue.state?.name && (
        <span style={{
          fontFamily: 'monospace', fontSize: 8, padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginTop: 2,
          background: '#f0efe9', color: '#9a9a9e',
        }}>
          {issue.state.name}
        </span>
      )}

      {/* Parent change indicator */}
      {wasParent && <Was text={wasParent} />}

      {/* Title — click to edit */}
      <div style={{ flex: 1, minWidth: 120 }}>
        {editingTitle ? (
          <input ref={titleInputRef} autoFocus value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
            onBlur={commitTitle}
            onMouseDown={e => e.stopPropagation()}
            draggable={false}
            style={{ ...ctrlStyle(true, false), width: '100%', fontSize: 11 }} />
        ) : (
          <>
            <div data-title-text onClick={startTitle}
              style={{ ...ctrlStyle(true, false), fontSize: 11, whiteSpace: 'normal', wordBreak: 'break-word', cursor: 'text' }}>
              {issue.title}
            </div>
          </>
        )}
        {wasTitle && <Was text={wasTitle} />}
      </div>

      {/* Cycle */}
      <div style={{ flexShrink: 0 }}>
        <select value={issue.cycle?.id || ''} onChange={handleCycleChange}
          onMouseDown={e => e.stopPropagation()} draggable={false}
          style={{ ...ctrlStyle(hasCycle, false), width: 60 }}>
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
          style={{ ...ctrlStyle(hasLabel, !hasLabelOrAssignment), width: 90 }}>
          {linearLabel && !issueLabels[issue.id]
            ? <option value=''>{linearLabel}</option>
            : <option value=''>{linearLabel || 'no label'}</option>
          }
          {availableLabels.filter(l => l !== linearLabel).map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {wasLabel && <Was text={wasLabel} />}
      </div>

      {/* Member */}
      <div style={{ flexShrink: 0 }}>
        <select value={getAssign(issue.id) || issue.assignee?.id || '__auto__'} onChange={handleAssignChange}
          onMouseDown={e => e.stopPropagation()} draggable={false}
          style={{ ...ctrlStyle(hasAssignment && !assigneeNotOnTeam, !hasLabelOrAssignment || assigneeNotOnTeam), width: 90 }}>
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
            style={{ ...ctrlStyle(true, false), width: 45, textAlign: 'center' }} />
        ) : (
          <span onClick={startEst} title='Click to edit estimate'
            style={{ ...ctrlStyle(hasEst, !hasEst), width: 45, textAlign: 'center', cursor: 'pointer', display: 'inline-block' }}>
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
          style={{ ...ctrlStyle(deps.length > 0, false), width: 55, textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {deps.length
            ? `${deps.length} dep${deps.length > 1 ? 's' : ''}`
            : 'no deps'}
        </button>
        {(() => {
          const origSet = linearDepsSet[issue.id]
          const origCount = origSet?.size || 0
          const currentSet = new Set(deps)
          const sameDeps = origCount === currentSet.size && (origCount === 0 || [...origSet].every(d => currentSet.has(d)))
          if (!sameDeps) return <Was text="changed" />
          return null
        })()}
      </div>

      {/* Delete button for new (unsaved) issues */}
      {issue.id.startsWith('__new__') && (
        <span
          onClick={e => { e.stopPropagation(); removeIssue(issue.id) }}
          onMouseDown={e => e.stopPropagation()}
          draggable={false}
          style={{
            flexShrink: 0, cursor: 'pointer', marginTop: 2, fontSize: 13, color: '#e63946',
            fontWeight: 700, lineHeight: '20px', width: 20, textAlign: 'center',
          }}
          title="Delete new issue"
        >&times;</span>
      )}
    </div>
  )
}

// ── Project Block (collapsible, with drag-order + dep modal) ─────────────────
function ProjectBlock({
  proj, pi, initName, issues, excludedIssues, orderMap, initId, issueLabels, setIssueLabel,
  availableLabels, setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  issueDeps, linearDepsSet, setIssueDepsFor, saveOrder, startIso, trackEdit, edits,
  selected, toggleSelect, expandAll, isFirst, addIssue, removeIssue, setParent,
}) {
  const [collapsed, setCollapsed] = useState(!isFirst)
  useEffect(() => { if (expandAll !== null) setCollapsed(!expandAll) }, [expandAll])
  const [ord, setOrd] = useState(() => getOrdered(issues, proj.id, orderMap, initId))
  const [modalIssueId, setModalIssueId] = useState(null)
  const dragFrom = useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [nestMode, setNestMode] = useState(false) // 'nest', 'unnest', or false
  const dragStartX = useRef(null)
  const [dropError, setDropError] = useState(null)
  const [addingIssue, setAddingIssue] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const newTitleRef = useRef(null)
  const reassignPrefixes = () => {
    // Build parent→children grouping
    const ordIds = new Set(ord.map(i => i.id))
    const childrenOf = {}
    const childIds = new Set()
    ord.forEach(issue => {
      if (issue.parent?.id && ordIds.has(issue.parent.id)) {
        if (!childrenOf[issue.parent.id]) childrenOf[issue.parent.id] = []
        childrenOf[issue.parent.id].push(issue)
        childIds.add(issue.id)
      }
    })
    // Assign [N] prefixes: top-level gets [1], [2], etc. Children get [1.1], [1.2], etc.
    let topIdx = 0
    ord.filter(i => !childIds.has(i.id)).forEach(issue => {
      topIdx++
      const applyPrefix = (iss, prefix) => {
        const stripped = iss.title.replace(/^\[\d+(?:\.\d+)*\]\s*/, '')
        const newTitle = `[${prefix}] ${stripped}`
        if (newTitle !== iss.title) {
          trackEdit(iss.id, 'title', edits[iss.id]?.title?.original ?? iss.title, newTitle)
          setTitle(iss.id, newTitle)
        }
      }
      applyPrefix(issue, String(topIdx))
      const children = childrenOf[issue.id] || []
      children.forEach((child, ci) => applyPrefix(child, `${topIdx}.${ci + 1}`))
    })
  }

  // Check if [N] prefixes are out of sync with current order
  const prefixesStale = (() => {
    const ordIds = new Set(ord.map(i => i.id))
    const childIds = new Set()
    ord.forEach(issue => {
      if (issue.parent?.id && ordIds.has(issue.parent.id)) childIds.add(issue.id)
    })
    const childrenOf = {}
    ord.forEach(issue => {
      if (issue.parent?.id && ordIds.has(issue.parent.id)) {
        if (!childrenOf[issue.parent.id]) childrenOf[issue.parent.id] = []
        childrenOf[issue.parent.id].push(issue)
      }
    })
    let topIdx = 0
    for (const issue of ord.filter(i => !childIds.has(i.id))) {
      topIdx++
      const stripped = issue.title.replace(/^\[\d+(?:\.\d+)*\]\s*/, '')
      if (issue.title !== `[${topIdx}] ${stripped}`) return true
      const children = childrenOf[issue.id] || []
      for (let ci = 0; ci < children.length; ci++) {
        const child = children[ci]
        const cStripped = child.title.replace(/^\[\d+(?:\.\d+)*\]\s*/, '')
        if (child.title !== `[${topIdx}.${ci + 1}] ${cStripped}`) return true
      }
    }
    return false
  })()

  const handleAddIssue = () => {
    const title = newTitle.trim()
    if (title && addIssue) {
      addIssue(proj.id, title)
      setNewTitle('')
      setAddingIssue(false)
    }
  }

  useEffect(() => setOrd(getOrdered(issues, proj.id, orderMap, initId)), [issues, orderMap])

  // ── Drag handlers ──
  const NEST_THRESHOLD = 40

  const handleDragStart = (e, idx) => {
    dragFrom.current = idx
    dragStartX.current = e.clientX
    setDraggingIdx(idx)
    setNestMode(false)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', idx.toString())
  }

  const detectNestMode = (clientX) => {
    if (dragStartX.current === null) return
    const dx = clientX - dragStartX.current
    if (dx > NEST_THRESHOLD) setNestMode('nest')
    else if (dx < -NEST_THRESHOLD) setNestMode('unnest')
    else setNestMode(false)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverIdx(e.clientY < midY ? idx : idx + 1)
    detectNestMode(e.clientX)
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
    detectNestMode(e.clientX)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const fromIdx = dragFrom.current
    const toGap = dragOverIdx
    const shouldNest = nestMode
    dragFrom.current = null
    dragStartX.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)
    setNestMode(false)

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

    // Handle nesting / un-nesting
    const movedIssue = next[insertAt]
    if (shouldNest === 'nest' && insertAt > 0) {
      const above = next[insertAt - 1]
      if (above.parent?.id) {
        // Above is a sub-issue → become a sibling (same parent)
        setParent(movedIssue.id, above.parent.id)
      } else {
        // Above is top-level → nest under it
        setParent(movedIssue.id, above.id)
      }
    } else if (shouldNest === 'unnest' && movedIssue.parent?.id) {
      // Explicit drag left = un-nest
      setParent(movedIssue.id, null)
    }
    // Normal drag (no horizontal shift) = keep existing parent as-is

    setDropError(null)
    setOrd(next)
    saveOrder(proj.id, next.map(i => i.id))
  }

  const handleDragEnd = () => {
    dragFrom.current = null
    dragStartX.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)
    setNestMode(false)
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
        <span
          onClick={e => { e.stopPropagation(); reassignPrefixes() }}
          style={{
            fontFamily: 'monospace', fontSize: 9, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
            background: prefixesStale ? '#fef3c7' : '#f0efe9',
            border: `1px solid ${prefixesStale ? '#fde68a' : '#dddcd5'}`,
            color: prefixesStale ? '#92400e' : '#9a9a9e',
            fontWeight: prefixesStale ? 700 : 400,
          }}
          title="Update [N] prefixes in issue titles to match current order"
        >Reassign [N]</span>
        <span
          onClick={e => { e.stopPropagation(); setAddingIssue(true); setCollapsed(false); setTimeout(() => newTitleRef.current?.focus(), 50) }}
          style={{
            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: '#2d6a4f', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
          title="Add new issue"
        >+</span>
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
                const isExcluded = excludedIssues.has(issue.id)
                return (
                  <div key={issue.id}>
                    {showLine(ordIdx) && <div style={{ height: 3, background: nestMode === 'nest' ? '#2d6a4f' : nestMode === 'unnest' ? '#e67e22' : '#e63946', borderRadius: 2, margin: '2px 0', marginLeft: nestMode === 'nest' ? 30 : 0 }} />}
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
                        draggable={!isExcluded}
                        onDragStart={e => !isExcluded && handleDragStart(e, ordIdx)}
                        onDragOver={e => handleDragOver(e, ordIdx)}
                        onDragEnd={handleDragEnd}
                        style={{ marginBottom: 4, cursor: isExcluded ? 'default' : 'grab', flex: 1 }}
                      >
                        <IssueRow
                          issue={issue} idx={ordIdx} displayLabel={displayLabel}
                          isDragging={draggingIdx === ordIdx} isExcluded={isExcluded}
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
                          removeIssue={removeIssue}
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
            {showLine(ord.length) && <div style={{ height: 3, background: nestMode === 'nest' ? '#2d6a4f' : nestMode === 'unnest' ? '#e67e22' : '#e63946', borderRadius: 2, margin: '2px 0', marginLeft: nestMode === 'nest' ? 30 : 0 }} />}
          </div>

          {/* Add issue inline */}
          {addingIssue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', marginTop: 4 }}>
              <input
                ref={newTitleRef}
                autoFocus
                placeholder="New issue title..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddIssue(); if (e.key === 'Escape') { setAddingIssue(false); setNewTitle('') } }}
                style={{ ...inpS, flex: 1, fontSize: 12 }}
              />
              <GBtn sm onClick={handleAddIssue} disabled={!newTitle.trim()}>Add</GBtn>
              <GBtn sm onClick={() => { setAddingIssue(false); setNewTitle('') }}>Cancel</GBtn>
            </div>
          )}

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
                  const isFromLinear = linearDepsSet[modalIssueId]?.has(op.id)
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
  init, projects, projOrder, issues, excludedIssues, orderMap, initId,
  issueLabels, setIssueLabel, availableLabels,
  setEst, setTitle, members, getAssign, setAssign, cycles, setCycle,
  issueDeps, linearDepsSet, setIssueDepsFor, saveOrder, startIso, trackEdit, edits,
  selected, toggleSelect, expandAll, isFirst, addIssue, removeIssue, setParent,
}) {
  const [collapsed, setCollapsed] = useState(!isFirst)
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
              proj={proj} pi={pi} initName={init.name} isFirst={isFirst && pi === 0}
              issues={issues} excludedIssues={excludedIssues} orderMap={orderMap} initId={initId}
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
              expandAll={expandAll} addIssue={addIssue} removeIssue={removeIssue} setParent={setParent}
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
  addIssue, removeIssue, setParent, teamId, onReplaceNewIssues,
  saveOrder, startIso, trackEdit,
  edits, setEdits, apiKey, onSaveComplete,
  linearRelationIds, baselineDeps,
  excludedIssues, setExcludedIssues,
  refreshFromLinear,
  err, onNext, onBack,
}) {
  const [selected, setSelected] = useState(new Set())
  const [showExcluded, setShowExcluded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showCrossProjectDeps, setShowCrossProjectDeps] = useState(false)
  const [userChangedDeps, setUserChangedDeps] = useState(false)
  const wrappedSetIssueDepsFor = (issueId, depIds) => {
    setUserChangedDeps(true)
    setSaveResult(null)
    setIssueDepsFor(issueId, depIds)
  }
  const [expandSignal, setExpandSignal] = useState(0) // positive=expand, negative=collapse, 0=default
  const expandAll = expandSignal === 0 ? null : expandSignal > 0
  const activeIssues = issues.filter(i => !excludedIssues.has(i.id))
  const excludedList = issues.filter(i => excludedIssues.has(i.id))
  const issueIds = new Set(issues.map(i => i.id))
  const relevantCrossProjectDeps = (crossProjectDeps || []).filter(d => issueIds.has(d.blocker.id) || issueIds.has(d.blocked.id))
  const memberIds = new Set(members.map(m => m.id))

  // Error counts
  const missingEst = activeIssues.filter(i => !i.estimate || i.estimate <= 0)
  const missingLabelOrAssign = activeIssues.filter(i => {
    const hasLabel = (i.labels?.nodes || []).length > 0 || !!issueLabels[i.id]
    const assignVal = getAssign(i.id)
    const hasAssignment = (assignVal && assignVal !== '__auto__') || (!assignVal && !!i.assignee?.id)
    return !hasLabel && !hasAssignment
  })
  const offTeamAssign = activeIssues.filter(i => {
    const assignVal = getAssign(i.id)
    return !assignVal && i.assignee?.id && !memberIds.has(i.assignee.id)
  })
  const totalErrors = missingEst.length + missingLabelOrAssign.length + offTeamAssign.length
  const [showErrors, setShowErrors] = useState(false)

  const toggleSelect = (id) => {
    // If excluded, restore it instead of selecting
    if (excludedIssues.has(id)) {
      restoreIssue(id)
      return
    }
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

  // ── Dep diffs (only after user has changed deps this session) ──
  const depAdded = []
  const depRemoved = []
  if (userChangedDeps) {
    Object.entries(issueDeps).forEach(([blockedId, blockerIds]) => {
      const baseSet = new Set(baselineDeps[blockedId] || [])
      blockerIds.forEach(blockerId => {
        if (!baseSet.has(blockerId)) {
          depAdded.push({ blockedId, blockerId })
        }
      })
    })
    Object.entries(baselineDeps).forEach(([blockedId, baseBlockerIds]) => {
      const currentDeps = new Set(issueDeps[blockedId] || [])
      baseBlockerIds.forEach(blockerId => {
        if (!currentDeps.has(blockerId)) {
          const relationId = linearRelationIds[`${blockedId}::${blockerId}`]
          if (relationId) depRemoved.push({ blockedId, blockerId, relationId })
        }
      })
    })
  }
  const depChangeCount = depAdded.length + depRemoved.length

  // ── Save to Linear ──
  const newIssueCount = issues.filter(i => i.id.startsWith('__new__')).length
  const editCount = Object.keys(edits).length ? Object.values(edits).reduce((sum, e) => sum + Object.keys(e).length, 0) : 0
  const totalChangeCount = editCount + depChangeCount + newIssueCount
  const hasChanges = editCount > 0 || userChangedDeps || newIssueCount > 0
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  const saveToLinear = async () => {
    setSaving(true)
    setSaveResult(null)
    let ok = 0, failed = 0
    const errors = []

    // Create new issues in Linear
    const newIssues = issues.filter(i => i.id.startsWith('__new__'))
    const backlogStateId = issues.find(i => i.state?.type === 'backlog')?.state?.id || null
    const idMap = {} // tempId → realId
    for (const issue of newIssues) {
      try {
        const input = { title: issue.title, teamId, projectId: issue.project?.id }
        if (backlogStateId) input.stateId = backlogStateId
        if (issue.estimate) input.estimate = issue.estimate
        if (issue.parent?.id && !issue.parent.id.startsWith('__new__')) input.parentId = issue.parent.id
        const assignVal = getAssign(issue.id)
        if (assignVal && assignVal !== '__auto__') input.assigneeId = assignVal
        const result = await linearQuery(apiKey, buildIssueCreateMutation(), { input })
        const created = result.issueCreate.issue
        // Clear any auto-assigned assignee if user didn't explicitly set one
        if (!assignVal || assignVal === '__auto__') {
          await linearQuery(apiKey, buildIssueUpdateMutation(), { id: created.id, input: { assigneeId: null } }).catch(() => {})
        }
        idMap[issue.id] = created
        ok++
      } catch (e) {
        errors.push(`New "${issue.title}": ${e.message}`)
        failed++
      }
    }
    // Replace temp IDs in local state with real Linear IDs
    if (Object.keys(idMap).length) {
      onReplaceNewIssues(idMap)
    }

    // Save field edits (skip new issues — they were just created)
    for (const [issueId, fields] of Object.entries(edits)) {
      if (issueId.startsWith('__new__')) continue
      const issue = issues.find(i => i.id === issueId)
      const label = issue?.identifier || issueId
      try {
        const input = {}
        if (fields.title) input.title = fields.title.edited
        if (fields.estimate) input.estimate = fields.estimate.edited
        if (fields.cycle) input.cycleId = fields.cycle.edited || null
        if (fields.assignee) input.assigneeId = fields.assignee.edited || null
        if (fields.parent !== undefined) input.parentId = fields.parent.edited || null
        if (Object.keys(input).length) {
          await linearQuery(apiKey, buildIssueUpdateMutation(), { id: issueId, input })
        }
        ok++
      } catch (e) {
        const msg = e.message.includes('Discrepancy between issue team')
          ? 'issue belongs to a different team than the selected cycle — update the issue\'s team in Linear first'
          : e.message
        errors.push(`${label}: ${msg}`)
        failed++
      }
    }

    // Create new dep relations
    for (const { blockedId, blockerId } of depAdded) {
      const issue = issues.find(i => i.id === blockedId)
      const label = issue?.identifier || blockedId
      try {
        await linearQuery(apiKey, buildRelationCreateMutation(), {
          issueId: blockerId, relatedIssueId: blockedId, type: 'blocks',
        })
        ok++
      } catch (e) {
        errors.push(`${label} dep: ${e.message}`)
        failed++
      }
    }

    // Delete removed dep relations
    for (const { blockedId, relationId } of depRemoved) {
      const issue = issues.find(i => i.id === blockedId)
      const label = issue?.identifier || blockedId
      try {
        await linearQuery(apiKey, buildRelationDeleteMutation(), { id: relationId })
        ok++
      } catch (e) {
        errors.push(`${label} dep remove: ${e.message}`)
        failed++
      }
    }

    setSaving(false)
    setSaveResult({ ok, failed, errors })
    if (failed === 0) {
      setEdits({})
      setUserChangedDeps(false)
      // Update linearDepsSet to match current issueDeps so "Linear: changed" indicators disappear
      if (onSaveComplete) onSaveComplete()
    }
  }

  return (
    <div>
      <H1>Configure <R>Issues</R></H1>
      <Sub>Set estimates, labels, assignments, order, and dependencies for all issues. Drag to reorder within each project. Click a title to edit it (e.g. add [N] prefixes).</Sub>

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

      {/* Issue errors summary */}
      {totalErrors > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '8px 14px', marginBottom: 14, fontSize: 11, color: '#991b1b',
        }}>
          <div onClick={() => setShowErrors(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: showErrors ? 'rotate(0deg)' : 'rotate(-90deg)' }}>&#9660;</span>
            <span style={{ fontWeight: 700 }}>{totalErrors} issue{totalErrors !== 1 ? 's' : ''} need attention</span>
          </div>
          {showErrors && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(() => {
                const truncTitle = (t) => t.length > 40 ? t.slice(0, 40) + '...' : t
                const issueLine = (i, extra) => (
                  <div key={i.id} style={{ fontFamily: 'monospace', fontSize: 10, padding: '1px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {i.identifier} — {truncTitle(i.title)}{extra || ''}
                  </div>
                )
                return <>
                  {missingEst.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{missingEst.length} missing estimate{missingEst.length !== 1 ? 's' : ''}</div>
                      {missingEst.map(i => issueLine(i))}
                    </div>
                  )}
                  {missingLabelOrAssign.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{missingLabelOrAssign.length} missing label or assignment</div>
                      {missingLabelOrAssign.map(i => issueLine(i))}
                    </div>
                  )}
                  {offTeamAssign.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{offTeamAssign.length} assigned to people outside selected team</div>
                      {offTeamAssign.map(i => issueLine(i, ` — ${i.assignee?.name}`))}
                    </div>
                  )}
                </>
              })()}
            </div>
          )}
        </div>
      )}

      {err && <Err>{err}</Err>}

      {/* Save to Linear */}
      {hasChanges && totalChangeCount > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '8px 14px', marginBottom: 14, fontSize: 11, color: '#991b1b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, flex: 1 }}>
              {totalChangeCount} change{totalChangeCount !== 1 ? 's' : ''} from Linear data
            </span>
            <Btn onClick={saveToLinear} disabled={saving}>
              {saving ? 'Saving...' : 'Save to Linear'}
            </Btn>
          </div>
          {saveResult?.failed > 0 && (
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace',
              background: '#fef2f2', color: '#991b1b',
            }}>
              {saveResult.ok} saved, {saveResult.failed} failed:{saveResult.errors?.map((err, i) => <div key={i} style={{ marginTop: 4 }}>{err}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Selection actions */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 14,
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, color: '#991b1b', fontFamily: 'monospace' }}>{selected.size} selected</span>
          <GBtn sm onClick={removeSelected}>Exclude from plan</GBtn>
          <GBtn sm onClick={() => setSelected(new Set())}>Cancel</GBtn>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
        <GBtn onClick={onBack}>&#8592; Back</GBtn>
        <div style={{ display: 'flex', gap: 8 }}>
          <GBtn sm disabled={refreshing} onClick={() => {
            const warnings = []
            if (newIssueCount > 0) warnings.push(`${newIssueCount} new issue${newIssueCount !== 1 ? 's' : ''} not yet saved to Linear`)
            if (editCount > 0) warnings.push(`${editCount} unsaved edit${editCount !== 1 ? 's' : ''}`)
            if (userChangedDeps) warnings.push('unsaved dependency changes')
            if (warnings.length > 0) {
              const msg = `You have:\n- ${warnings.join('\n- ')}\n\nRefreshing will discard these changes. Continue?`
              if (!window.confirm(msg)) return
            }
            setRefreshing(true)
            setSaveResult(null)
            setUserChangedDeps(false)
            refreshFromLinear().then(() => setRefreshing(false)).catch(() => setRefreshing(false))
          }}>{refreshing ? 'Refreshing...' : 'Refresh from Linear'}</GBtn>
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
      }).map((init, initIdx) => (
        <InitiativeSection key={init.id} isFirst={initIdx === 0}
          init={init} projects={projects} projOrder={projOrder}
          issues={issues} excludedIssues={excludedIssues} orderMap={orderMap} initId={initId}
          issueLabels={issueLabels} setIssueLabel={setIssueLabel}
          availableLabels={availableLabels}
          setEst={setEst} setTitle={setTitle} members={members}
          getAssign={getAssign} setAssign={setAssign}
          cycles={cycles} setCycle={setCycle}
          issueDeps={issueDeps} linearDepsSet={linearDepsSet}
          setIssueDepsFor={wrappedSetIssueDepsFor}
          saveOrder={saveOrder} startIso={startIso}
          trackEdit={trackEdit} edits={edits}
          selected={selected} toggleSelect={toggleSelect}
          expandAll={expandAll} addIssue={addIssue} removeIssue={removeIssue} setParent={setParent}
        />
      ))}

      <Row>
        <GBtn onClick={onBack}>&#8592; Back</GBtn>
        <Btn onClick={onNext}>Next &#8594;</Btn>
      </Row>
    </div>
  )
}
