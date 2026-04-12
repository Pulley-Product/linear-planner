import { useState, useEffect, useRef } from 'react'
import { Btn, Card, H1, R, Sub, Err, inpS } from './ui.jsx'
import { linearQuery, GQL_INITIATIVES, GQL_TEAMS, buildIssueQuery, STATE_TYPES } from '../utils/linear.js'

export default function StepConnect({ onConnected, autoConnect }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('lp-apikey') || '')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPrep, setShowPrep] = useState(false)
  const didAutoConnect = useRef(false)
  const cancelled = useRef(false)

  const connect = async () => {
    const key = apiKey.replace(/[^ -~]/g, '').trim()
    if (!key) { setStatus('Please enter your API key.'); return }
    cancelled.current = false
    setLoading(true)
    setStatus(null)
    try {
      setStatus('Loading initiatives…')
      const dInits = await linearQuery(key, GQL_INITIATIVES)
      if (!dInits.initiatives?.nodes?.length) throw new Error('No initiatives found. Check your API key and permissions.')

      setStatus('Loading teams…')
      const dTeams = await linearQuery(key, GQL_TEAMS)
      if (!dTeams.teams?.nodes?.length) throw new Error('No teams found.')

      const d1 = { initiatives: dInits.initiatives, teams: dTeams.teams }

      setStatus('Loading issues…')
      const allIssueNodes = []
      for (const st of STATE_TYPES) {
        const d2 = await linearQuery(key, buildIssueQuery(st))
        if (d2.issues?.nodes?.length) allIssueNodes.push(...d2.issues.nodes)
      }
      if (!allIssueNodes.length) throw new Error('No issues found.')
      const d2 = { issues: { nodes: allIssueNodes } }

      // Save key for next session
      localStorage.setItem('lp-apikey', key)

      // Attach issues to projects
      const byProj = {}
      d2.issues.nodes.forEach(i => {
        if (i.project?.id) {
          if (!byProj[i.project.id]) byProj[i.project.id] = []
          byProj[i.project.id].push(i)
        }
      })
      const enrichedInits = d1.initiatives.nodes.map(it => ({
        ...it,
        projects: { nodes: (it.projects?.nodes || []).map(p => ({ ...p, _issues: byProj[p.id] || [] })) },
      }))

      // Extract issue dependencies from Linear relations
      // Linear relation types: "blocks" = this issue blocks relatedIssue
      // We need issueDeps format: { issueId -> [issueIds it depends on] }
      const allIssueIds = new Set(allIssueNodes.map(i => i.id))
      const issueProj = {} // issueId -> projectId
      allIssueNodes.forEach(i => { if (i.project?.id) issueProj[i.id] = i.project.id })

      const linearDeps = {}
      const crossProjectDeps = [] // [{ issue, dep }] — for warning display
      allIssueNodes.forEach(issue => {
        (issue.relations?.nodes || []).forEach(rel => {
          const rid = rel.relatedIssue?.id
          if (!rid || !allIssueIds.has(rid)) return

          let fromId, toId // toId depends on fromId
          if (rel.type === 'blocks') {
            fromId = issue.id; toId = rid
          } else if (rel.type === 'is blocked by') {
            fromId = rid; toId = issue.id
          } else return

          // Check if cross-project
          if (issueProj[fromId] && issueProj[toId] && issueProj[fromId] !== issueProj[toId]) {
            const fromIssue = allIssueNodes.find(i => i.id === fromId)
            const toIssue = allIssueNodes.find(i => i.id === toId)
            if (fromIssue && toIssue) {
              crossProjectDeps.push({ blocker: fromIssue, blocked: toIssue })
            }
            return // skip — don't import cross-project deps
          }

          if (!linearDeps[toId]) linearDeps[toId] = []
          if (!linearDeps[toId].includes(fromId)) linearDeps[toId].push(fromId)
        })
      })

      if (cancelled.current) return
      onConnected({
        apiKey: key,
        allInits: enrichedInits,
        allTeams: d1.teams.nodes,
        rawIssues: d2.issues.nodes,
        linearDeps,
        crossProjectDeps,
      })
    } catch (e) {
      if (cancelled.current) return
      setStatus(e.message || 'Failed to connect')
      setLoading(false)
    }
  }

  const [autoConnecting, setAutoConnecting] = useState(false)

  // Auto-connect on mount if saved key exists and autoConnect is requested
  useEffect(() => {
    if (autoConnect && apiKey && !didAutoConnect.current) {
      didAutoConnect.current = true
      setAutoConnecting(true)
      connect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAutoConnect = () => {
    cancelled.current = true
    setAutoConnecting(false)
    setLoading(false)
    setStatus(null)
  }

  return (
    <div>
      <H1>Connect to <R>Linear</R></H1>
      <Sub>Enter your Linear API key to load your workspace. Your key is stored locally in your browser only.</Sub>

      {autoConnecting && loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14,
          background: 'rgba(26,26,46,0.04)', border: '1px solid #dddcd5', borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, color: '#5a5a72' }}>Reconnecting with saved key...</span>
          <span onClick={cancelAutoConnect} style={{ fontSize: 11, color: '#1d4ed8', cursor: 'pointer', fontFamily: 'monospace' }}>cancel & change key</span>
        </div>
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#5a5a72', fontWeight: 500, marginBottom: 6 }}>
            Personal API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            placeholder="lin_api_xxxxxxxxxxxxxxxx"
            style={inpS}
          />
        </div>
        <Btn onClick={connect} disabled={loading}>
          {loading ? 'Connecting…' : 'Connect →'}
        </Btn>

        {status && (
          <div style={{
            marginTop: 14, padding: '9px 13px', borderRadius: 6,
            fontFamily: 'monospace', fontSize: 12,
            background: status.startsWith('Connect') || status.startsWith('Loading')
              ? 'rgba(26,26,46,0.06)' : 'rgba(230,57,70,0.08)',
            border: status.startsWith('Connect') || status.startsWith('Loading')
              ? '1px solid rgba(26,26,46,0.12)' : '1px solid rgba(230,57,70,0.2)',
            color: status.startsWith('Connect') || status.startsWith('Loading') ? '#5a5a72' : '#e63946',
          }}>
            {status}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: '#9a9a9e', fontFamily: 'monospace', lineHeight: 1.8 }}>
          ↳ Get your key: linear.app → Settings → Security & Access → Personal API Keys → New API Key<br />
          ↳ Select <strong>read-write</strong> permissions if you want to save changes back to Linear (read-only works for planning only)
        </div>
      </Card>

      {/* Prep guide — collapsible */}
      <div style={{ marginTop: 24 }}>
        <div onClick={() => setShowPrep(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 10, color: '#9a9a9e', transition: 'transform 0.15s', transform: showPrep ? 'rotate(0deg)' : 'rotate(-90deg)' }}>&#9660;</span>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Prepare your <span style={{ color: '#e63946' }}>Linear workspace</span></div>
        </div>
        {!showPrep ? null : <><p style={{ color: '#5a5a72', fontSize: 13, fontWeight: 300, marginBottom: 14, marginTop: 6 }}>
          For best results, set up the following in Linear before generating a plan:
        </p>

        <div style={{ background: 'white', border: '1px solid #dddcd5', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>1. Add estimates to issues</div>
              <div style={{ fontSize: 12, color: '#5a5a72', lineHeight: 1.6 }}>
                Set story point estimates on each issue. The planner uses these to allocate work across cycles based on team capacity. Issues without estimates can be set during planning, but won't persist back to Linear.
              </div>
            </div>

            <div style={{ height: 1, background: '#f0efe9' }} />

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>2. Add labels to issues</div>
              <div style={{ fontSize: 12, color: '#5a5a72', lineHeight: 1.6 }}>
                Use labels like <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>frontend</code>, <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>backend</code>, <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>design</code> to indicate what kind of work each issue requires. During planning, you'll map these labels to team members — this is how the planner knows who can work on what.
              </div>
            </div>

            <div style={{ height: 1, background: '#f0efe9' }} />

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>3. Use [N] prefixes for issue ordering</div>
              <div style={{ fontSize: 12, color: '#5a5a72', lineHeight: 1.6 }}>
                Add a number prefix to issue titles to control priority order, e.g. <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>[1] Set up auth</code>, <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>[2] Build dashboard</code>. Decimals work too: <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>[2.1]</code>, <code style={{ background: '#f0efe9', padding: '1px 5px', borderRadius: 3 }}>[2.2]</code>. The planner auto-sorts by these numbers.
              </div>
            </div>

            <div style={{ height: 1, background: '#f0efe9' }} />

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>4. Account for capacity constraints</div>
              <div style={{ fontSize: 12, color: '#5a5a72', lineHeight: 1.6 }}>
                Create an initiative (e.g. "OnCall/PTO/Holiday/Other") with projects for things that take up team capacity but aren't product work — such as <strong>on-call rotations</strong>, <strong>PTO / vacations</strong>, and <strong>company holidays</strong>. Add issues for each person's known absences and on-call shifts, assign them to the right person and cycle, and set estimates for the capacity they consume. The planner will treat these as committed work and schedule around them.
              </div>
            </div>

            <div style={{ height: 1, background: '#f0efe9' }} />

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>5. Assign issues to cycles for committed work</div>
              <div style={{ fontSize: 12, color: '#5a5a72', lineHeight: 1.6 }}>
                If work is already committed to a specific cycle in Linear (e.g. in-progress issues), assign them to that cycle. The planner will respect these assignments and schedule remaining work around them. Issues committed to past cycles are automatically excluded.
              </div>
            </div>

          </div>
        </div>
        </>}
      </div>
    </div>
  )
}
