import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.send('LexaLab API is live!')
})

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`✅ LexaLab API running on http://localhost:${PORT}`)
})
