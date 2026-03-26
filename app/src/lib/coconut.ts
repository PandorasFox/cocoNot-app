import type { OcrHit } from './types'

/** Minimal word shape needed by tagCoconutWords. */
export interface WordBox {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * Split keywords into single-word patterns and multi-word phrases.
 * Multi-word phrases are matched as consecutive word sequences.
 */
function buildMatchers(keywords: string[]) {
  const singles: string[] = []
  const phrases: string[][] = [] // each phrase is an array of words

  for (const kw of keywords) {
    const parts = kw.trim().toLowerCase().split(/\s+/)
    if (parts.length === 1 && parts[0]) {
      singles.push(parts[0])
    } else if (parts.length > 1) {
      phrases.push(parts)
    }
  }

  const singleRe = singles.length > 0
    ? new RegExp(`^(${singles.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i')
    : null

  return { singleRe, phrases }
}

/**
 * Tag words with isCoconut based on configurable keywords.
 * Single keywords match individual words; multi-word keywords match
 * consecutive word sequences and merge their bounding boxes.
 */
const DEFAULT_KEYWORDS = ['coconut', 'copra', 'cocos nucifera']

export function tagCoconutWords(words: WordBox[], keywords: string[] = DEFAULT_KEYWORDS): OcrHit[] {
  if (words.length === 0) return []

  const { singleRe, phrases } = buildMatchers(keywords)

  const hits: OcrHit[] = []
  const coconutIndices = new Set<number>()
  const phraseStarts = new Map<number, number>() // start index → phrase length

  // First pass: identify matches
  for (let i = 0; i < words.length; i++) {
    const text = words[i].text.replace(/[^a-zA-Z]/g, '')

    // Single-word match
    if (singleRe?.test(text)) {
      coconutIndices.add(i)
      continue
    }

    // Multi-word phrase match
    for (const phrase of phrases) {
      if (i + phrase.length > words.length) continue
      let match = true
      for (let j = 0; j < phrase.length; j++) {
        const wordText = words[i + j].text.replace(/[^a-zA-Z]/g, '').toLowerCase()
        if (wordText !== phrase[j]) { match = false; break }
      }
      if (match) {
        for (let j = 0; j < phrase.length; j++) coconutIndices.add(i + j)
        phraseStarts.set(i, phrase.length)
        break
      }
    }
  }

  // Second pass: emit hits, merging multi-word phrases
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const bb = w.bbox
    const isCoconut = coconutIndices.has(i)

    // Multi-word phrase start — merge bounding boxes
    const phraseLen = phraseStarts.get(i)
    if (phraseLen) {
      const phraseWords = words.slice(i, i + phraseLen)
      const bboxes = phraseWords.map(pw => pw.bbox)
      const x = Math.min(...bboxes.map(b => b.x0))
      const y = Math.min(...bboxes.map(b => b.y0))
      hits.push({
        text: phraseWords.map(pw => pw.text).join(' '),
        x,
        y,
        w: Math.max(...bboxes.map(b => b.x1)) - x,
        h: Math.max(...bboxes.map(b => b.y1)) - y,
        isCoconut: true,
      })
      i += phraseLen - 1
      continue
    }

    // Skip words that are part of a phrase (not the start)
    if (isCoconut && !phraseStarts.has(i) && isPhraseMiddle(i, phraseStarts)) continue

    hits.push({
      text: w.text,
      x: bb.x0,
      y: bb.y0,
      w: bb.x1 - bb.x0,
      h: bb.y1 - bb.y0,
      isCoconut,
    })
  }

  return hits
}

function isPhraseMiddle(idx: number, phraseStarts: Map<number, number>): boolean {
  for (const [start, len] of phraseStarts) {
    if (idx > start && idx < start + len) return true
  }
  return false
}
