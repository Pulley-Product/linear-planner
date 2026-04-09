// Vercel serverless function — validates the shared app password.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { appPassword } = req.body || {}

  if (!process.env.APP_PASSWORD || appPassword !== process.env.APP_PASSWORD) {
    return res.status(401).json({ ok: false })
  }

  return res.status(200).json({ ok: true })
}
