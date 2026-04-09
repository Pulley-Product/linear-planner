// All Linear GraphQL calls go through a proxy to avoid CORS.
// Local dev: Vite proxies /linear to proxy.js (localhost:3131)
// Deployed:  Vercel rewrites /linear to /api/linear (serverless function)

const PROXY_URL = '/linear'

export async function linearQuery(apiKey, query, variables = {}) {
  const appPassword = localStorage.getItem('lp-app-password') || ''
  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appPassword, apiKey, query, variables }),
  })

  if (!resp.ok) {
    if (resp.status === 401) {
      localStorage.removeItem('lp-app-password')
      window.location.reload()
      throw new Error('Session expired — please re-enter the app password.')
    }
    const text = await resp.text().catch(() => resp.statusText)
    if (resp.status === 0 || !resp.status) {
      throw new Error('Cannot reach proxy — is it running? Run: npm run proxy')
    }
    throw new Error(`Proxy error ${resp.status}: ${text.slice(0, 200)}`)
  }

  const json = await resp.json()
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Linear API error')
  return json.data ?? json
}

export const GQL_INITIATIVES = `{
  initiatives {
    nodes {
      id name status targetDate
      projects { nodes { id name state targetDate } }
    }
  }
}`

export const GQL_TEAMS = `{
  teams {
    nodes {
      id name
      members { nodes { id name avatarUrl } }
      cycles(filter: { endsAt: { gt: "${new Date().toISOString()}" } }) {
        nodes { id name startsAt endsAt number }
      }
    }
  }
}`

const ISSUE_FIELDS = `
  id identifier title estimate
  assignee { id name }
  project { id name }
  state { name type }
  labels { nodes { id name color } }
  cycle { id startsAt endsAt number }
`

const STATE_TYPES = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'cancelled']

export function buildIssueQuery(stateType) {
  return `{
    issues(
      filter: { state: { type: { eq: "${stateType}" } } }
      first: 250
    ) {
      nodes { ${ISSUE_FIELDS} }
    }
  }`
}

export { STATE_TYPES }
