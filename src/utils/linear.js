// All Linear GraphQL calls go through the local proxy (proxy.js)
// which forwards them to api.linear.app server-side, avoiding CORS.

const PROXY_URL = '/linear'

export async function linearQuery(apiKey, query, variables = {}) {
  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, query, variables }),
  })

  if (!resp.ok) {
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

export const GQL_WORKSPACE = `{
  initiatives {
    nodes {
      id name
      projects { nodes { id name } }
    }
  }
  teams {
    nodes {
      id name
      members { nodes { id name } }
      cycles(filter: { endsAt: { gt: "${new Date().toISOString()}" } }) {
        nodes { id name startsAt endsAt number }
      }
    }
  }
}`

export const GQL_ISSUES = `{
  issues(
    filter: { state: { type: { in: ["backlog","unstarted","started"] } } }
    first: 250
  ) {
    nodes {
      id identifier title estimate
      assignee { id name }
      project { id name }
      state { name type }
      labels { nodes { id name color } }
      cycle { id startsAt endsAt number }
    }
  }
}`
