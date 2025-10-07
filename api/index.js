import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.send('LexaLab API is live!')
})

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})


// parse JSON bodies
app.use(express.json())

// --- Simple phrase library (v1) ---
const PHRASES = [
  {
    id: "to_be_honest",
    patterns: [/^\s*to be honest\b/i, /\bto be honest\b/i],
    category: "hedge",
    severity: 3,
    replacements: [
      "I want to be clear:",
      "Candidly,",
      "Here’s my view:",
      "Let me be direct:"
    ],
    rationale: "“To be honest” can imply you weren’t honest before. Use a direct opener that signals clarity without self-undermining."
  },
  {
    id: "i_feel_like",
    patterns: [/\bi feel like\b/i],
    category: "hedge",
    severity: 2,
    replacements: [
      "The data indicates",
      "Evidence suggests",
      "My assessment is",
      "I recommend"
    ],
    rationale: "“I feel like” reads as subjective. Anchor to data, assessment, or recommendation to project executive confidence."
  },
  {
    id: "just",
    patterns: [/\bjust\b/i],
    category: "minimizer",
    severity: 1,
    replacements: [
      "I’m following up on",
      "I’m requesting",
      "I’d like to"
    ],
    rationale: "“Just” minimizes your ask. Remove it or use a clear action verb."
  },
  {
    id: "sorry_to_bother",
    patterns: [/\bsorry to bother\b/i],
    category: "apology",
    severity: 2,
    replacements: [
      "Quick question:",
      "When you have a moment:",
      "Request:"
    ],
    rationale: "Unnecessary apology reduces authority. Be courteous without diminishing yourself."
  },
  {
    id: "no_worries",
    patterns: [/\bno worries\b/i],
    category: "casualism",
    severity: 1,
    replacements: [
      "All good.",
      "That works.",
      "No problem."
    ],
    rationale: "“No worries” can feel overly casual in exec contexts. Choose neutral acceptance."
  }
]

// Utility to scan text and propose replacements
function analyzeText(text, { industry, goal } = {}) {
  const findings = []

  PHRASES.forEach(p => {
    p.patterns.forEach(rx => {
      let match
      const regex = new RegExp(rx.source, rx.flags + (rx.sticky ? "y" : ""))
      // scan through occurrences
      let lastIndex = 0
      while ((match = regex.exec(text)) !== null) {
        findings.push({
          id: p.id,
          match: match[0],
          start: match.index,
          end: match.index + match[0].length,
          category: p.category,
          severity: p.severity,
          suggestions: p.replacements.slice(0, 3),
          rationale: p.rationale
        })
        // move forward to find additional matches
        lastIndex = regex.lastIndex || (match.index + match[0].length)
        if (!regex.global) break
      }
    })
  })

  // Build a suggested rewrite (simple v1: replace first occurrence of each)
  let suggestion = text
  findings.forEach(f => {
    const replacement = f.suggestions[0]
    try {
      // replace only the first exact segment found, case-insensitive
      suggestion = suggestion.replace(new RegExp(escapeForRegExp(f.match), "i"), replacement)
    } catch {}
  })

  // lightweight tailoring hint (we’ll expand this later)
  const personalization_note = industry || goal
    ? `Tailored for ${[industry, goal].filter(Boolean).join(" · ")} (v1 heuristic).`
    : "Generic (no profile provided)."

  return { findings, suggestion, personalization_note }
}

function escapeForRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// POST /phrases/analyze
app.post('/phrases/analyze', (req, res) => {
  const { text, industry, goal } = req.body || {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: "Send { text: '...' } in JSON body." })
  }
  const result = analyzeText(text, { industry, goal })
  res.json({
    input: text,
    ...result
  })
})

// --- In-memory profiles (reset on server restart; fine for v1 dev) ---
const PROFILES = new Map()

/**
 * POST /onboarding
 * Body: { userId, industry, goals: string[], tone: "formal"|"neutral"|"warm", experienceLevel?: "junior"|"mid"|"senior" }
 */
app.post('/onboarding', (req, res) => {
  const { userId, industry, goals = [], tone = "neutral", experienceLevel } = req.body || {}
  if (!userId || !industry) {
    return res.status(400).json({ error: "userId and industry are required" })
  }
  const profile = { userId, industry, goals, tone, experienceLevel, updatedAt: new Date().toISOString() }
  PROFILES.set(userId, profile)
  res.json({ ok: true, profile })
})

// Example: GET /profile/:userId
app.get('/profile/:userId', (req, res) => {
  const p = PROFILES.get(req.params.userId)
  if (!p) return res.status(404).json({ error: "not found" })
  res.json(p)
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`✅ LexaLab API running on http://localhost:${PORT}`)
})
