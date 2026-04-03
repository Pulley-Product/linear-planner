#!/usr/bin/env node
/**
 * Linear API CORS Proxy
 * Runs locally alongside the React app to forward requests to Linear.
 * Your API key and Linear data never leave your machine.
 *
 * Usage: npm run proxy  (or: node proxy.js)
 * Requires: Node.js 18+
 */

const http = require('http')
const PORT = 3131

const server = http.createServer(async (req, res) => {
  // CORS headers — allow requests from the local Vite dev server
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return
  }

  if (req.method !== 'POST' || req.url !== '/linear') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'POST to /linear only' })); return
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', async () => {
    try {
      const { apiKey, query, variables } = JSON.parse(body)
      if (!apiKey || !query) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing apiKey or query' })); return
      }

      const linearResp = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({ query, variables }),
      })

      const data = await linearResp.json()
      res.writeHead(linearResp.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))

    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅  Linear proxy running on http://localhost:${PORT}`)
  console.log(`    Forwarding /linear → https://api.linear.app/graphql`)
  console.log(`    Your data stays on this machine — no third parties involved.\n`)
  console.log(`    Press Ctrl+C to stop.\n`)
})
