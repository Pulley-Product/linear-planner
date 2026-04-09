// Vercel serverless function — replaces proxy.js for deployed environments.
// Validates APP_PASSWORD, then forwards GraphQL requests to Linear.

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { appPassword, apiKey, query, variables } = req.body || {}

  // Check app password
  if (!process.env.APP_PASSWORD || appPassword !== process.env.APP_PASSWORD) {
    return res.status(401).json({ error: 'Invalid app password' })
  }

  if (!apiKey || !query) {
    return res.status(400).json({ error: 'Missing apiKey or query' })
  }

  try {
    const linearResp = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    })

    const data = await linearResp.json()
    return res.status(linearResp.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
