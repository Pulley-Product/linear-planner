import { useState } from 'react'
import { SEG, GBtn, Btn } from './ui.jsx'
import { getOrdered } from '../utils/plan.js'
// ExcelJS and file-saver loaded dynamically on download to avoid browser polyfill issues

export default function PlanView({ issues, projects, members, plan, getCap, chosenInits, projOrder, orderMap, initId, issueLabels, teamName, onBack, onOrder }) {
  const [showAlgo, setShowAlgo] = useState(false)
  const { sc, splits, mems, cycles, startCI, unscheduled, errors } = plan

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
  const initColor = {}

  // Build project→initiative lookup
  const projInitName = {}
  chosenInits.forEach(init => {
    (init.projects?.nodes || []).forEach(p => { projInitName[p.id] = init.name })
  })

  // Group projects by initiative, ordered by the earliest project priority within each initiative
  const projPriorityIdx = {}
  projOrder.forEach((id, i) => { projPriorityIdx[id] = i })

  const initGroups = [] // [{ init, projects: [proj] }]
  const initSeen = new Set()
  // Walk projOrder; for each project, find its initiative and add all that initiative's projects (in priority order)
  projOrder.forEach(pid => {
    const init = chosenInits.find(it => (it.projects?.nodes || []).some(p => p.id === pid))
    if (!init || initSeen.has(init.id)) return
    initSeen.add(init.id)
    const initProjIds = (init.projects?.nodes || []).map(p => p.id)
    const initProjs = projOrder
      .filter(id => initProjIds.includes(id))
      .map(id => projects.find(p => p.id === id))
      .filter(Boolean)
    if (initProjs.length) initGroups.push({ init, projects: initProjs })
  })

  // Flat ordered list for the xlsx download
  const orderedProjs = initGroups.flatMap(g => g.projects)

  // Assign colors: each initiative gets a base color, projects within get shades
  const hexToHsl = (hex) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255
    let g = parseInt(hex.slice(3, 5), 16) / 255
    let b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2
    if (max === min) { h = s = 0 } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    return [h * 360, s * 100, l * 100]
  }
  const hslToHex = (h, s, l) => {
    s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1) }
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
  }
  initGroups.forEach(({ init, projects: initProjs }, gi) => {
    const baseHex = SEG[gi % SEG.length]
    initColor[init.id] = baseHex
    const [h, s] = hexToHsl(baseHex)
    initProjs.forEach((proj, pi) => {
      const count = initProjs.length
      const lightness = count === 1 ? 45 : 35 + (pi / (count - 1)) * 20
      projColor[proj.id] = hslToHex(h, s, lightness)
    })
  })

  // Build member totals per cycle
  const memberCyclePts = {} // { memberId -> { ci -> pts } }
  sc.forEach(item => {
    if (!item._m) return
    const mid = item._m.id
    if (!memberCyclePts[mid]) memberCyclePts[mid] = {}
    const ci = item._ci - startCI
    memberCyclePts[mid][ci] = (memberCyclePts[mid][ci] || 0) + item._pts
  })

  // Find issue's member, splits, and committed status
  const issueInfo = (issueId) => {
    const entry = sc.find(s => s.id === issueId)
    return { member: entry?._m, splits: splits[issueId] || [], committed: entry?._committed || false }
  }

  // Cycle header label
  const cycleLabel = (c) => c.name ? `C${c.number} ${c.name}` : `Cycle ${c.number}`
  const cycleDates = (c) => c.startsAt
    ? `${new Date(c.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(c.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  // Stats
  const totalSched = sc.length

  const COL_W = 80
  const FIXED_W = 520

  // ── Download XLSX ──────────────────────────────────────────────────────────
  const downloadXlsx = async () => {
    const ExcelJS = (await import('exceljs')).default
    const { saveAs } = await import('file-saver')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Plan')

    const colLetter = (idx) => {
      let s = '', n = idx
      while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 }
      return s
    }

    const totalCols = 6 + numCols // A-E + cycles + Total
    const memberColIdx = 5 // column E = member
    const firstCycCol = 6 // column F onwards
    const totalColIdx = firstCycCol + numCols

    // Styles
    const darkHeader = { font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }, alignment: { horizontal: 'center', vertical: 'middle' } }
    const lightHeader = { font: { bold: true, size: 10 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F4F0' } }, alignment: { horizontal: 'center' } }
    const memberStyle = { font: { bold: true, size: 10 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EFE9' } } }
    const memberNumStyle = { font: { bold: true, size: 11 }, alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EFE9' } } }
    const projHeaderFont = { font: { bold: true, size: 11 } }
    const cycleNumStyle = { alignment: { horizontal: 'center' }, font: { size: 10 } }
    const thinBorder = { top: { style: 'thin', color: { argb: 'FFDDDCD5' } }, bottom: { style: 'thin', color: { argb: 'FFDDDCD5' } }, left: { style: 'thin', color: { argb: 'FFDDDCD5' } }, right: { style: 'thin', color: { argb: 'FFDDDCD5' } } }

    // ── Column widths ──
    ws.getColumn(1).width = 14  // ID
    ws.getColumn(2).width = 45  // Issue
    ws.getColumn(3).width = 10  // Estimate
    ws.getColumn(4).width = 15  // Label
    ws.getColumn(5).width = 22  // Member
    for (let c = 0; c < numCols; c++) ws.getColumn(firstCycCol + c).width = 14
    ws.getColumn(totalColIdx).width = 10

    const fmtD = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 1: Member allocation
    // ══════════════════════════════════════════════════════════════════════

    const allocHeaderRow = ws.addRow(['', '', '', '', 'TEAM MEMBER ALLOCATION', ...displayCycles.map(c => cycleLabel(c)), 'TOTAL'])
    allocHeaderRow.eachCell((cell, ci) => {
      if (ci >= memberColIdx) Object.assign(cell, darkHeader)
      cell.border = thinBorder
    })

    const dateRow = ws.addRow(['', '', '', '', '', ...displayCycles.map(c => cycleDates(c)), ''])
    dateRow.eachCell((cell, ci) => {
      if (ci >= memberColIdx) { cell.font = { size: 8, color: { argb: 'FF9A9A9E' } }; cell.alignment = { horizontal: 'center' } }
      cell.border = thinBorder
    })

    const memberStartXlRow = ws.rowCount + 1
    const activeMems = mems.filter(m => Object.keys(memberCyclePts[m.id] || {}).length > 0)
    activeMems.forEach(m => {
      const row = ws.addRow(['', '', '', `cap: ${m.cap}pt`, m.name])
      row.eachCell((cell) => { Object.assign(cell, memberStyle); cell.border = thinBorder })
      row.getCell(memberColIdx).font = { bold: true, size: 11 }
      row.getCell(4).font = { size: 8, italic: true, color: { argb: 'FF9A9A9E' } }
      for (let c = 0; c < numCols; c++) {
        const cell = row.getCell(firstCycCol + c)
        Object.assign(cell, memberNumStyle)
        cell.border = thinBorder
      }
      const totalCell = row.getCell(totalColIdx)
      Object.assign(totalCell, memberNumStyle)
      totalCell.border = thinBorder
    })

    ws.addRow([])

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 3: Issue data
    // ══════════════════════════════════════════════════════════════════════

    const issueHeaderXlRow = ws.rowCount + 1
    const ihRow = ws.addRow(['ID', 'Issue', 'Est', 'Label', 'Member', ...displayCycles.map(c => cycleLabel(c)), 'Total'])
    ihRow.eachCell((cell) => { Object.assign(cell, darkHeader); cell.border = thinBorder })

    const issueDataStartXlRow = ws.rowCount + 1

    let projIdx = 0
    const projBgColors = ['FFEEF2FF', 'FFECFDF5', 'FFFEFCE8', 'FFFEF2F2', 'FFF5F3FF', 'FFECFEFF', 'FFFFF7ED', 'FFFDF2F8']

    initGroups.forEach(({ init, projects: initProjs }) => {
      initProjs.forEach(proj => {
        const projIssues = getOrdered(issues, proj.id, orderMap, initId)
        if (!projIssues.length) return

        const bgColor = projBgColors[projIdx % projBgColors.length]
        const color = projColor[proj.id] || '#3b82f6'
        const colorArgb = 'FF' + color.replace('#', '')
        projIdx++

        const phRow = ws.addRow([`${init.name} >> ${proj.name}`, '', '', '', '', ...displayCycles.map(() => ''), ''])
        ws.mergeCells(phRow.number, 1, phRow.number, totalColIdx)
        phRow.getCell(1).font = { bold: true, size: 11, color: { argb: colorArgb } }
        phRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        phRow.eachCell((cell) => { cell.border = thinBorder })

        projIssues.forEach((issue, idx) => {
          const info = issueInfo(issue.id)
          const linearLabel = (issue.labels?.nodes || [])[0]?.name || ''
          const label = issueLabels[issue.id] || linearLabel
          const rowData = [issue.identifier, issue.title, issue.estimate || '', label, info.member?.name || '']
          displayCycles.forEach((_, ci) => {
            const split = info.splits.find(s => s.ci - startCI === ci)
            rowData.push(split ? split.pts : '')
          })
          rowData.push('')

          const iRow = ws.addRow(rowData)
          iRow.eachCell((cell, ci) => {
            cell.border = thinBorder
            cell.font = { size: 10 }
            if (ci >= firstCycCol) cell.alignment = { horizontal: 'center' }
          })
          iRow.getCell(1).font = { size: 9, color: { argb: 'FF9A9A9E' }, name: 'Courier New' }
          iRow.getCell(3).font = { size: 10, bold: true }
          iRow.getCell(3).alignment = { horizontal: 'center' }

          displayCycles.forEach((_, ci) => {
            const cell = iRow.getCell(firstCycCol + ci)
            if (cell.value) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
              cell.font = { size: 10, bold: true, color: { argb: colorArgb } }
            }
          })

          const firstCyc = colLetter(firstCycCol - 1)
          const lastCyc = colLetter(firstCycCol + numCols - 2)
          iRow.getCell(totalColIdx).value = { formula: `SUM(${firstCyc}${iRow.number}:${lastCyc}${iRow.number})` }
          iRow.getCell(totalColIdx).font = { size: 10, bold: true }
          iRow.getCell(totalColIdx).alignment = { horizontal: 'center' }
        })
      })
    })

    const issueDataEndXlRow = ws.rowCount

    // ── Inject SUMIF formulas for member rows ──
    const memberColLetter = colLetter(memberColIdx - 1)
    const memberRange = `$${memberColLetter}$${issueDataStartXlRow}:$${memberColLetter}$${issueDataEndXlRow}`

    activeMems.forEach((m, mi) => {
      const xlRow = memberStartXlRow + mi
      const row = ws.getRow(xlRow)
      displayCycles.forEach((_, ci) => {
        const cycCol = colLetter(firstCycCol + ci - 1)
        const cycRange = `$${cycCol}$${issueDataStartXlRow}:$${cycCol}$${issueDataEndXlRow}`
        const nameRef = `${memberColLetter}${xlRow}`
        row.getCell(firstCycCol + ci).value = { formula: `SUMIF(${memberRange},${nameRef},${cycRange})` }
      })
      const firstCyc = colLetter(firstCycCol - 1)
      const lastCyc = colLetter(firstCycCol + numCols - 2)
      row.getCell(totalColIdx).value = { formula: `SUM(${firstCyc}${xlRow}:${lastCyc}${xlRow})` }
    })

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 3: Forward Plan Summary
    // ══════════════════════════════════════════════════════════════════════

    ws.addRow([])
    const summaryTitleRow = ws.addRow(['FORWARD PLAN SUMMARY'])
    summaryTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1A1A2E' } }
    ws.mergeCells(summaryTitleRow.number, 1, summaryTitleRow.number, 5)

    const summaryDateRow = ws.addRow([`Generated: ${new Date().toLocaleString()}`])
    summaryDateRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF9A9A9E' } }

    ws.addRow([])

    const sumHeaderRow = ws.addRow(['Initiative', 'Project', 'Planned End Cycle', 'Cycle End Date', 'Linear Target Date'])
    sumHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
      cell.border = thinBorder
    })

    initGroups.forEach(({ init, projects: initProjs }) => {
      const initIssues = sc.filter(s => initProjs.some(p => p.id === s.project?.id))
      const initMaxCI = initIssues.length ? Math.max(...initIssues.map(s => s._ci)) - startCI : -1
      const initEndCycle = initMaxCI >= 0 ? displayCycles[Math.min(initMaxCI, displayCycles.length - 1)] : null
      const initRow = ws.addRow([
        init.name, '',
        initEndCycle ? cycleLabel(initEndCycle) : '–',
        initEndCycle?.endsAt ? fmtD(initEndCycle.endsAt) : '–',
        fmtD(init.targetDate),
      ])
      initRow.getCell(1).font = { bold: true, size: 11 }
      initRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F7' } }
      initRow.eachCell((cell) => { cell.border = thinBorder })

      initProjs.forEach(proj => {
        const pIss = sc.filter(s => s.project?.id === proj.id)
        const pMaxCI = pIss.length ? Math.max(...pIss.map(s => s._ci)) - startCI : -1
        const pEndCycle = pMaxCI >= 0 ? displayCycles[Math.min(pMaxCI, displayCycles.length - 1)] : null
        const projData = (init.projects?.nodes || []).find(p => p.id === proj.id)
        const pColor = projColor[proj.id] || '#5a5a72'
        const pRow = ws.addRow([
          '', proj.name,
          pEndCycle ? cycleLabel(pEndCycle) : '–',
          pEndCycle?.endsAt ? fmtD(pEndCycle.endsAt) : '–',
          fmtD(projData?.targetDate),
        ])
        pRow.getCell(2).font = { size: 10, color: { argb: 'FF' + pColor.replace('#', '') } }
        pRow.eachCell((cell) => { cell.border = thinBorder })
      })
    })

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 4: Verification (collapsed via row grouping)
    // ══════════════════════════════════════════════════════════════════════
    ws.addRow([])
    ws.addRow([])
    const verifyStartRow = ws.rowCount + 1
    const verifyTitleRow = ws.addRow(['VERIFICATION'])
    verifyTitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF9A9A9E' } }
    const verifyExplainRow = ws.addRow(['Checks that SUMIF formulas in the member allocation table match the app calculations. "OK" = match, "MISMATCH" = investigate.'])
    ws.mergeCells(verifyExplainRow.number, 1, verifyExplainRow.number, totalColIdx)
    verifyExplainRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF9A9A9E' } }
    verifyExplainRow.getCell(1).alignment = { wrapText: true }

    const vhRow = ws.addRow(['', '', '', 'Type', 'Member', ...displayCycles.map(c => cycleLabel(c)), 'Total'])
    vhRow.eachCell((cell) => { Object.assign(cell, lightHeader); cell.border = thinBorder })

    activeMems.forEach((m, mi) => {
      const memberAllocXlRow = memberStartXlRow + mi

      const expRowData = ['', '', '', 'Expected', m.name]
      let expectedTotal = 0
      displayCycles.forEach((_, ci) => {
        const pts = memberCyclePts[m.id]?.[ci] || 0
        expRowData.push(pts)
        expectedTotal += pts
      })
      expRowData.push(expectedTotal)
      const expRow = ws.addRow(expRowData)
      expRow.eachCell((cell, ci) => { cell.border = thinBorder; if (ci >= firstCycCol) cell.alignment = { horizontal: 'center' } })
      expRow.getCell(4).font = { italic: true, size: 9, color: { argb: 'FF9A9A9E' } }

      const frmRow = ws.addRow(['', '', '', 'Formula', m.name])
      displayCycles.forEach((_, ci) => {
        const cycCol = colLetter(firstCycCol + ci - 1)
        frmRow.getCell(firstCycCol + ci).value = { formula: `${cycCol}${memberAllocXlRow}` }
      })
      frmRow.getCell(totalColIdx).value = { formula: `${colLetter(totalColIdx - 1)}${memberAllocXlRow}` }
      frmRow.eachCell((cell, ci) => { cell.border = thinBorder; if (ci >= firstCycCol) cell.alignment = { horizontal: 'center' } })
      frmRow.getCell(4).font = { italic: true, size: 9, color: { argb: 'FF9A9A9E' } }

      const chkRow = ws.addRow(['', '', '', 'Check', m.name])
      displayCycles.forEach((_, ci) => {
        const cycCol = colLetter(firstCycCol + ci - 1)
        chkRow.getCell(firstCycCol + ci).value = { formula: `IF(${cycCol}${expRow.number}=${cycCol}${frmRow.number},"OK","MISMATCH")` }
      })
      chkRow.getCell(totalColIdx).value = { formula: `IF(${colLetter(totalColIdx - 1)}${expRow.number}=${colLetter(totalColIdx - 1)}${frmRow.number},"OK","MISMATCH")` }
      chkRow.eachCell((cell, ci) => { cell.border = thinBorder; if (ci >= firstCycCol) cell.alignment = { horizontal: 'center' } })
      chkRow.getCell(4).font = { italic: true, size: 9, color: { argb: 'FF9A9A9E' } }

      for (let ci = 0; ci <= numCols; ci++) {
        const col = firstCycCol + ci
        const cellRef = `${colLetter(col - 1)}${chkRow.number}`
        ws.addConditionalFormatting({
          ref: cellRef,
          rules: [
            { type: 'containsText', operator: 'containsText', text: 'OK', style: { font: { bold: true, color: { argb: 'FF166534' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } } }, priority: 1 },
            { type: 'containsText', operator: 'containsText', text: 'MISMATCH', style: { font: { bold: true, color: { argb: 'FF991B1B' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } } }, priority: 2 },
          ]
        })
      }
    })

    // ── Group verification rows (collapsed by default) ──
    const verifyEndRow = ws.rowCount
    for (let r = verifyStartRow; r <= verifyEndRow; r++) {
      ws.getRow(r).outlineLevel = 1
      ws.getRow(r).hidden = true
    }
    ws.properties.outlineLevelRow = 1

    // ── Freeze panes ──
    ws.views = [{ state: 'frozen', xSplit: 5, ySplit: issueHeaderXlRow }]

    // ── Write file ──
    const buf = await wb.xlsx.writeBuffer()
    const now = new Date()
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`
    const safeName = (teamName || 'Team').replace(/[^a-zA-Z0-9]/g, '_')
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `LP_${safeName}_${ts}.xlsx`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 style={{ fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 6 }}>
        Forward <span style={{ color: '#e63946' }}>Plan</span>
      </h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, marginBottom: 20 }}>
        <GBtn onClick={onBack}>&#8592; Back</GBtn>
        <Btn onClick={downloadXlsx}>Download .xlsx</Btn>
      </div>
      {/* Algorithm explanation — collapsible */}
      <div style={{ marginBottom: 16 }}>
        <div onClick={() => setShowAlgo(!showAlgo)} style={{
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontFamily: 'monospace', color: '#9a9a9e',
          padding: '4px 10px', borderRadius: 6, background: '#f0efe9', border: '1px solid #dddcd5',
        }}>
          <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: showAlgo ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
          How the plan is generated
        </div>
        {showAlgo && (
          <div style={{
            marginTop: 8, padding: '16px 20px', background: 'white', border: '1px solid #dddcd5',
            borderRadius: 10, fontSize: 12, color: '#5a5a72', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e', marginBottom: 8 }}>How the plan is generated</div>
            <p style={{ margin: '0 0 10px', lineHeight: 1.8 }}>The planner works in two passes to build a realistic schedule:</p>

            <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>First: lock in what's already committed</div>
            <p style={{ margin: '0 0 12px', lineHeight: 1.8 }}>
              Before scheduling any new work, the planner looks at all issues that are already assigned to a cycle in Linear — things like PTO, on-call shifts, holidays, and in-progress work. These are placed first, blocking out each person's capacity so the planner knows what time is actually available. Any issues committed to cycles before your selected start cycle are ignored.
            </p>

            <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>Then: schedule everything else</div>
            <p style={{ margin: '0 0 8px', lineHeight: 1.8 }}>
              The planner goes through your projects in the priority order you set. Within each project, it processes issues in your chosen order (or by the [N] prefix in the title if you didn't reorder them). For each issue:
            </p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>It figures out the <strong>earliest cycle</strong> the issue can start — taking into account project dependencies ("project B can't start until project A finishes") and issue dependencies ("this issue can't start until that issue finishes"). New work is never placed before your selected start cycle.</li>
              <li>It picks <strong>who should do it</strong> — if you assigned a specific person, they're used. Otherwise, it looks at the issue's label, finds all team members you mapped to that label, and picks the person who can finish the issue soonest.</li>
              <li>It <strong>fills their available capacity</strong> starting from the earliest possible cycle. If the issue is bigger than what fits in one cycle, it spills into the next cycle(s). A person is never given more work than their capacity allows in any single cycle.</li>
              <li>If there <strong>aren't enough cycles</strong> to fit the issue, it's flagged as unscheduled and shown in a warning above.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Unscheduled warning */}
      {unscheduled.length > 0 && (
        <div style={{
          background: '#fff8f8', border: '2px solid #e63946', borderRadius: 12,
          padding: '16px 20px', marginBottom: 18,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#e63946', marginBottom: 8 }}>
            Not enough cycles — {unscheduled.length} issue{unscheduled.length !== 1 ? 's' : ''} could not be fully scheduled
          </div>
          <div style={{ fontSize: 12, color: '#5a5a72', marginBottom: 12, lineHeight: 1.6 }}>
            The team's available cycles ({numCols}) don't have enough capacity to fit all the work.
            Add more cycles in Linear for this team and regenerate the plan.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {unscheduled.map(issue => (
              <div key={issue.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: '#fee2e2', borderRadius: 6,
                fontSize: 11, fontFamily: 'monospace',
              }}>
                <span style={{ color: '#991b1b', fontWeight: 600 }}>{issue.identifier}</span>
                <span style={{ color: '#5a5a72', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{issue.title}</span>
                <span style={{ color: '#991b1b' }}>{issue._remaining}pt unscheduled</span>
                <span style={{ color: '#9a9a9e' }}>of {issue.estimate}pt</span>
                {issue._m && <span style={{ color: '#9a9a9e' }}>({issue._m.name})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors — issues with no eligible members */}
      {errors.length > 0 && (
        <div style={{
          background: '#fff8f8', border: '2px solid #e63946', borderRadius: 12,
          padding: '16px 20px', marginBottom: 18,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#e63946', marginBottom: 8 }}>
            {errors.length} issue{errors.length !== 1 ? 's' : ''} could not be assigned — no eligible team member
          </div>
          <div style={{ fontSize: 12, color: '#5a5a72', marginBottom: 12, lineHeight: 1.6 }}>
            These issues have a label but no team member is mapped to that label, or they have no label and no member assigned. Go back to Label & Estimate or Labels &gt; Team Members to fix.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {errors.map(issue => (
              <div key={issue.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: '#fee2e2', borderRadius: 6,
                fontSize: 11, fontFamily: 'monospace',
              }}>
                <span style={{ color: '#991b1b', fontWeight: 600 }}>{issue.identifier}</span>
                <span style={{ color: '#5a5a72', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                <span style={{ color: '#991b1b' }}>{issue._error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary table — initiatives and projects with end dates */}
      <div style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #dddcd5' }}>Initiative / Project</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #dddcd5' }}>Planned End Cycle</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #dddcd5' }}>Cycle End Date</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #dddcd5' }}>Linear Target Date</th>
            </tr>
          </thead>
          <tbody>
            {initGroups.map(({ init, projects: initProjs }) => {
              // Find the latest cycle across all projects in this initiative
              const initIssues = sc.filter(s => initProjs.some(p => p.id === s.project?.id))
              const initMaxCI = initIssues.length ? Math.max(...initIssues.map(s => s._ci)) - startCI : -1
              const initEndCycle = initMaxCI >= 0 ? displayCycles[Math.min(initMaxCI, displayCycles.length - 1)] : null
              return [
                <tr key={`init-${init.id}`} style={{ background: '#f9f9f7' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>{init.name}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>
                    {initEndCycle ? cycleLabel(initEndCycle) : '–'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72' }}>
                    {initEndCycle?.endsAt ? new Date(initEndCycle.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72' }}>
                    {init.targetDate ? new Date(init.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'}
                  </td>
                </tr>,
                ...initProjs.map(proj => {
                  const pIss = sc.filter(s => s.project?.id === proj.id)
                  const pMaxCI = pIss.length ? Math.max(...pIss.map(s => s._ci)) - startCI : -1
                  const pEndCycle = pMaxCI >= 0 ? displayCycles[Math.min(pMaxCI, displayCycles.length - 1)] : null
                  // Look up targetDate from the initiative's project data
                  const projData = (init.projects?.nodes || []).find(p => p.id === proj.id)
                  return (
                    <tr key={`proj-${proj.id}`} style={{ borderBottom: '1px solid #f0efe9' }}>
                      <td style={{ padding: '6px 12px 6px 28px', fontSize: 12, color: '#5a5a72' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: projColor[proj.id], marginRight: 8, verticalAlign: 'middle' }} />
                        {proj.name}
                      </td>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                        {pEndCycle ? cycleLabel(pEndCycle) : '–'}
                      </td>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72' }}>
                        {pEndCycle?.endsAt ? new Date(pEndCycle.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'}
                      </td>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11, color: '#5a5a72' }}>
                        {projData?.targetDate ? new Date(projData.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '–'}
                      </td>
                    </tr>
                  )
                })
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Combined scrollable area */}
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <div style={{ minWidth: FIXED_W + COL_W * numCols }}>

          {/* Per-member allocation table */}
          <table style={{ width: FIXED_W + COL_W * numCols, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#1a1a2e', borderRadius: '10px 10px 0 0' }}>
                <th style={{ width: FIXED_W, padding: '8px 10px', textAlign: 'left', fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team Member</th>
                {displayCycles.map(c => (
                  <th key={c.id} style={{ width: COL_W, padding: '6px 8px', textAlign: 'center', color: 'white', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                    {cycleLabel(c)}
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginTop: 2 }}>{cycleDates(c)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mems.map((m, mi) => {
                const hasWork = Object.keys(memberCyclePts[m.id] || {}).length > 0
                if (!hasWork) return null
                const totalMemberPts = Object.values(memberCyclePts[m.id] || {}).reduce((a, b) => a + b, 0)
                return (
                  <tr key={m.id} style={{ background: mi % 2 === 0 ? '#f9f9f7' : 'white', borderBottom: '1px solid #f0efe9' }}>
                    <td style={{ width: FIXED_W, padding: '8px 10px', fontWeight: 600, fontSize: 12 }}>
                      {m.name}
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#9a9a9e', marginLeft: 6 }}>cap: {m.cap}pt/cycle</span>
                    </td>
                    {displayCycles.map((_, ci) => {
                      const pts = memberCyclePts[m.id]?.[ci] || 0
                      const over = pts > m.cap
                      return (
                        <td key={ci} style={{
                          width: COL_W, padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
                          borderLeft: '1px solid #f0efe9',
                          color: over ? '#e63946' : pts > 0 ? '#1a1a2e' : '#dddcd5',
                          background: over ? '#fff8f8' : 'transparent',
                        }}>
                          {pts > 0 ? pts : '–'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>


          {/* Issue spreadsheet table */}
          <table style={{ width: FIXED_W + COL_W * numCols, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#1a1a2e' }}>
                {[
                  { label: 'ID', width: 80 },
                  { label: 'Issue', width: FIXED_W - 80 - 50 - 100 - 120 },
                  { label: 'Est', width: 50 },
                  { label: 'Label', width: 100 },
                  { label: 'Member', width: 120 },
                ].map(h => (
                  <th key={h.label} style={{ width: h.width, padding: '8px 10px', textAlign: 'left', fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h.label}</th>
                ))}
                {displayCycles.map(c => (
                  <th key={c.id} style={{ width: COL_W, padding: '6px 8px', textAlign: 'center', color: 'white', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                    {cycleLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Issue rows grouped by initiative > project */}
              {initGroups.map(({ init, projects: initProjs }) => {
                return initProjs.map((proj, pi) => {
                  const projIssues = getOrdered(issues, proj.id, orderMap, initId)
                            if (!projIssues.length) return null
                  const color = projColor[proj.id]
                  return [
                    // Project header row
                    <tr key={`h-${proj.id}`} style={{ background: `${color}12` }}>
                      <td colSpan={5 + numCols} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 12 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, marginRight: 8, verticalAlign: 'middle' }} />
                        <span style={{ color: '#9a9a9e', fontWeight: 400 }}>{init.name}</span>
                        <span style={{ color: '#c8c7be', margin: '0 5px' }}>&gt;&gt;</span>
                        {proj.name}
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9a9a9e', marginLeft: 8 }}>{projIssues.length} issues</span>
                      </td>
                    </tr>,
                    // Issue rows
                    ...projIssues.map((issue, idx) => {
                      const info = issueInfo(issue.id)
                      const linearLabel = (issue.labels?.nodes || [])[0]?.name || ''
                      const label = issueLabels[issue.id] || linearLabel
                      const isUnscheduled = unscheduled.some(u => u.id === issue.id)
                      return (
                        <tr key={issue.id} style={{ borderBottom: '1px solid #f0efe9', background: isUnscheduled ? '#fff8f8' : idx % 2 === 0 ? 'white' : '#fafaf9' }}>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, color: isUnscheduled ? '#e63946' : '#9a9a9e', whiteSpace: 'nowrap' }}>{issue.identifier}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 11, textAlign: 'center', fontWeight: 600 }}>{issue.estimate || '–'}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, color: '#5a5a72' }}>{label}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: '#5a5a72', whiteSpace: 'nowrap' }}>{info.member?.name || '–'}</td>
                          {displayCycles.map((_, ci) => {
                            const split = info.splits.find(s => s.ci - startCI === ci)
                            return (
                              <td key={ci} style={{
                                padding: '5px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
                                borderLeft: '1px solid #f0efe9',
                                background: split ? `${color}18` : 'transparent',
                                color: split ? color : '#dddcd5',
                              }}>
                                {split ? split.pts : ''}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  ]
                })
              })}
            </tbody>
          </table>
        </div>
      </div>


      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <GBtn onClick={onBack}>&#8592; Back</GBtn>
        <Btn onClick={downloadXlsx}>Download .xlsx</Btn>
      </div>
    </div>
  )
}
