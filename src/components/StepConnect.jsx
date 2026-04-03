import { useState } from 'react'
import { Btn, Card, H1, R, Sub, Err, inpS } from './ui.jsx'
import { linearQuery, GQL_WORKSPACE, GQL_ISSUES } from '../utils/linear.js'

export default function StepConnect({ onConnected }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('lp-apikey') || '')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    const key = apiKey.replace(/[^ -~]/g, '').trim()
    if (!key) { setStatus('Please enter your API key.'); return }
    setLoading(true)
    setStatus(null)
    try {
      setStatus('Connecting to Linear…')
      const d1 = await linearQuery(key, GQL_WORKSPACE)
      if (!d1.initiatives?.nodes?.length) throw new Error('No initiatives found. Check your API key and permissions.')
      if (!d1.teams?.nodes?.length) throw new Error('No teams found.')

      setStatus('Loading issues…')
      const d2 = await linearQuery(key, GQL_ISSUES)
      if (!d2.issues?.nodes?.length) throw new Error('No backlog issues found.')

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

      onConnected({
        apiKey: key,
        allInits: enrichedInits,
        allTeams: d1.teams.nodes,
        rawIssues: d2.issues.nodes,
      })
    } catch (e) {
      setStatus(e.message || 'Failed to connect')
      setLoading(false)
    }
  }

  return (
    <div>
      <H1>Connect to <R>Linear</R></H1>
      <Sub>Enter your Linear API key to load your workspace. Your key is stored locally in your browser only.</Sub>

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
          ↳ Get your key: linear.app → Settings → API → Personal API Keys<br />
          ↳ When creating the key, select <strong>read-only</strong> permissions<br />
          ↳ Requires the local proxy to be running: <code>npm run proxy</code>
        </div>
      </Card>
    </div>
  )
}
