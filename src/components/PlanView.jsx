import { SEG, Avatar, GBtn, SecTitle, fmtDate } from './ui.jsx'
import { parsePfx } from '../utils/plan.js'

const fmtDate2 = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  : '–'

export default function PlanView({ issues, projects, members, plan, blocked, getCap, onBack, onOrder }) {
  const { sc, mems, blockedList, cycles, startCI } = plan

  if (!sc.length) return <p style={{ color: '#9a9a9e', padding: 40, textAlign: 'center' }}>No issues to schedule.</p>

  const maxCI = Math.max(...sc.map(i => i._ci), startCI)
  const displayCycles = cycles.length
    ? cycles.slice(startCI, maxCI + 1)
    : Array.from({ length: maxCI - startCI + 1 }, (_, i) => ({
        id: `s${i}`, number: startCI + i + 1, name: '',
        startsAt: null, endsAt: null,
      }))
  const numCols = displayCycles.length

  const projColor = {}
  projects.forEach((p, i) => { projColor[p.id] = SEG[i % SEG.length] })

  // Build grid: memberId -> colIdx -> [issues]
  const grid = {}
  mems.forEach(m => { grid[m.id] = Array.from({ length: numCols }, () => []) })
  const fallbackGrid = Array.from({ length: numCols }, () => [])

  sc.forEach(issue => {
    const col = issue._ci - startCI
    if (col < 0 || col >= numCols) return
    if (issue._m) {
      if (!grid[issue._m.id]) grid[issue._m.id] = Array.from({ length: numCols }, () => [])
      grid[issue._m.id][col].push(issue)
    } else {
      fallbackGrid[col].push(issue)
    }
  })

  // Sort each cell by [N] prefix
  Object.values(grid).forEach(row => row.forEach(cell => cell.sort((a, b) => parsePfx(a.title) - parsePfx(b.title))))
  fallbackGrid.forEach(cell => cell.sort((a, b) => parsePfx(a.title) - parsePfx(b.title)))

  const fmtHdr = c => {
    const label = c.name ? `C${c.number} ${c.name}` : `Cycle ${c.number}`
    const dates = c.startsAt
      ? `${new Date(c.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(c.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : ''
    return { label, dates }
  }

  const totalSched = sc.filter(i => !i._committed).length
  const totalComm = sc.filter(i => i._committed).length
  const totalPts = sc.filter(i => !i._committed).reduce((s, i) => s + i._pts, 0)
  const hasFallback = fallbackGrid.some(c => c.length > 0)

  const COL_W = 130
  const NAME_W = 155

  return (
    <div>
      <h1 style={{ fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 6 }}>
        Forward <span style={{ color: '#e63946' }}>Plan</span>
      </h1>
      <p style={{ color: '#5a5a72', marginBottom: 20, fontSize: 13, fontWeight: 300 }}>
        Colour = project · solid border = scheduled · dashed border = already committed in Linear
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { l: 'Scheduled', v: totalSched, s: 'new', c: '#457b9d' },
          { l: 'Committed', v: totalComm, s: 'in Linear', c: '#2d6a4f' },
          { l: 'Blocked', v: blockedList.length, s: 'skipped', c: '#e63946' },
          { l: 'Points', v: totalPts, s: 'to plan', c: '#1a1a2e' },
          { l: 'Cycles', v: numCols, s: 'to complete', c: '#8b5cf6' },
        ].map(s => (
          <div key={s.l} style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.l}</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: s.c, marginTop: 3, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#9a9a9e', marginTop: 3 }}>{s.s}</div>
          </div>
        ))}
      </div>

      {/* Project legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {projects.map((p, pi) => {
          const pIss = sc.filter(i => i.project?.id === p.id)
          if (!pIss.length) return null
          const lastCol = Math.max(...pIss.map(i => i._ci)) - startCI
          const endCycle = displayCycles[Math.min(lastCol, displayCycles.length - 1)]
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #dddcd5', borderRadius: 20, padding: '4px 12px', fontSize: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: projColor[p.id], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: '#9a9a9e', fontFamily: 'monospace', fontSize: 10 }}>
                · ends C{endCycle?.number} · {pIss.length}i
              </span>
            </div>
          )
        })}
      </div>

      {/* Blocked callout */}
      {blockedList.length > 0 && (
        <div style={{ background: '#fff8f8', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#ef4444', fontFamily: 'monospace', marginBottom: 6 }}>
            🚫 {blockedList.length} blocked — excluded from plan
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {blockedList.map(i => (
              <span key={i.id} title={blocked[i.id] || ''} style={{ fontFamily: 'monospace', fontSize: 11, background: '#fee2e2', padding: '2px 7px', borderRadius: 4, color: '#991b1b' }}>
                {i.identifier}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <div style={{ minWidth: NAME_W + COL_W * numCols }}>
          {/* Header */}
          <div style={{ display: 'flex', borderBottom: '2px solid #1a1a2e', background: '#1a1a2e', borderRadius: '10px 10px 0 0' }}>
            <div style={{ width: NAME_W, flexShrink: 0, padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Member
            </div>
            {displayCycles.map((c, i) => {
              const { label, dates } = fmtHdr(c)
              return (
                <div key={c.id} style={{ width: COL_W, flexShrink: 0, padding: '8px 10px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'white' }}>{label}</div>
                  {dates && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: 2 }}>{dates}</div>}
                </div>
              )
            })}
          </div>

          {/* Member rows */}
          {mems.map((m, mi) => {
            const row = grid[m.id] || []
            const hasWork = row.some(cell => cell.length > 0)
            if (!hasWork) return null
            const rowPts = Object.values(m.cp || {}).reduce((a, x) => a + x, 0)
            return (
              <div key={m.id} style={{ display: 'flex', borderBottom: '1px solid #e8e7e0', background: mi % 2 === 0 ? 'white' : '#fafaf9' }}>
                <div style={{ width: NAME_W, flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRight: '1px solid #dddcd5' }}>
                  <Avatar name={m.name} i={mi} sz={26} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: '#9a9a9e', fontFamily: 'monospace', marginTop: 2 }}>{rowPts}pt total</div>
                  </div>
                </div>
                {displayCycles.map((c, ci) => {
                  const cell = row[ci] || []
                  const usedPts = cell.reduce((s, i) => s + i._pts, 0)
                  const over = usedPts > getCap(m.id)
                  return (
                    <div key={c.id} style={{ width: COL_W, flexShrink: 0, padding: '8px 8px', borderLeft: '1px solid #f0efe9', background: over ? '#fff8f8' : 'transparent', minHeight: 40 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {cell.map(issue => {
                          const col = projColor[issue.project?.id] || '#9a9a9e'
                          const isLinear = !!(issue.cycle?.startsAt)
                          return (
                            <div key={issue.id} title={`${issue.title} · ${issue._pts}pt`}
                              style={{ padding: '3px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                                background: `${col}28`, color: col,
                                border: isLinear ? `2px dashed ${col}` : `2px solid ${col}`,
                                cursor: 'default', lineHeight: 1.4 }}>
                              {issue.identifier}
                            </div>
                          )
                        })}
                        {over && <div style={{ fontSize: 9, color: '#ef4444', fontFamily: 'monospace', marginTop: 2 }}>⚠ {usedPts}/{getCap(m.id)}pt</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Fallback row for unassigned committed issues */}
          {hasFallback && (
            <div style={{ display: 'flex', borderBottom: '1px solid #e8e7e0', background: '#f0fff4' }}>
              <div style={{ width: NAME_W, flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRight: '1px solid #dddcd5' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✓</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginTop: 4 }}>Unassigned<br /><span style={{ fontSize: 10, fontWeight: 400, color: '#9a9a9e' }}>committed in Linear</span></div>
              </div>
              {displayCycles.map((c, ci) => {
                const cell = fallbackGrid[ci] || []
                return (
                  <div key={c.id} style={{ width: COL_W, flexShrink: 0, padding: '8px 8px', borderLeft: '1px solid #dcfce7', minHeight: 40 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {cell.map(issue => {
                        const col = projColor[issue.project?.id] || '#22c55e'
                        return (
                          <div key={issue.id} title={issue.title}
                            style={{ padding: '3px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                              background: `${col}28`, color: col, border: `2px dashed ${col}`, cursor: 'default', lineHeight: 1.4 }}>
                            {issue.identifier}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ height: 2, background: '#1a1a2e', borderRadius: '0 0 10px 10px' }} />
        </div>
      </div>

      {/* Project summary table */}
      <div style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <SecTitle>Project Summary</SecTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f4f0' }}>
                {['Project', 'Start', 'End', 'Issues', 'Pts', ...mems.map(m => m.name.split(' ')[0])].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #dddcd5', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((proj, pi) => {
                const pIss = sc.filter(i => i.project?.id === proj.id)
                if (!pIss.length) return null
                const minCol = Math.min(...pIss.map(i => i._ci - startCI))
                const maxCol = Math.max(...pIss.map(i => i._ci - startCI))
                const startC = displayCycles[Math.max(0, minCol)]
                const endC = displayCycles[Math.min(maxCol, displayCycles.length - 1)]
                const pts = pIss.filter(i => !i._committed).reduce((s, i) => s + i._pts, 0)
                return (
                  <tr key={proj.id} style={{ borderBottom: '1px solid #f0efe9' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: projColor[proj.id], display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{proj.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72', whiteSpace: 'nowrap' }}>{fmtDate2(startC?.startsAt)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72', whiteSpace: 'nowrap' }}>{fmtDate2(endC?.endsAt)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{pIss.length}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72' }}>{pts}</td>
                    {mems.map(m => {
                      const cnt = pIss.filter(i => !i._committed && i._m?.id === m.id).length
                      return (
                        <td key={m.id} style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: cnt > 0 ? '#1a1a2e' : '#dddcd5', textAlign: 'center', fontWeight: cnt > 0 ? 600 : 400 }}>
                          {cnt > 0 ? cnt : '–'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <GBtn onClick={onBack}>← Capacity</GBtn>
        <GBtn onClick={onOrder}>Edit Order</GBtn>
      </div>
    </div>
  )
}
