import type { OcrHit } from './types'

const SINGLE_WORD_RE = /^(coconut|copra)$/i

/** Minimal word shape needed by tagCoconutWords. */
export interface WordBox {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * Pure function: tag words with isCoconut and merge "cocos nucifera" pairs.
 * Ported from ../coconot/frontend/src/api/ocr.ts:204-263.
 */
export function tagCoconutWords(words: WordBox[]): OcrHit[] {
  if (words.length === 0) return []

  const hits: OcrHit[] = []
  const coconutIndices = new Set<number>()

  // First pass: identify coconut matches and mark indices
  for (let i = 0; i < words.length; i++) {
    const text = words[i].text.replace(/[^a-zA-Z]/g, '')

    if (SINGLE_WORD_RE.test(text)) {
      coconutIndices.add(i)
    } else if (/^cocos$/i.test(text) && i + 1 < words.length) {
      const nextText = words[i + 1].text.replace(/[^a-zA-Z]/g, '')
      if (/^nucifera$/i.test(nextText)) {
        coconutIndices.add(i)
        coconutIndices.add(i + 1)
      }
    }
  }

  // Second pass: emit all words, merging "cocos nucifera" pairs
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const bb = w.bbox
    const isCoconut = coconutIndices.has(i)

    // Merge "cocos nucifera" into one hit
    if (isCoconut && /^cocos$/i.test(w.text.replace(/[^a-zA-Z]/g, '')) && coconutIndices.has(i + 1)) {
      const next = words[i + 1]
      const bb2 = next.bbox
      const x = Math.min(bb.x0, bb2.x0)
      const y = Math.min(bb.y0, bb2.y0)
      hits.push({
        text: `${w.text} ${next.text}`,
        x,
        y,
        w: Math.max(bb.x1, bb2.x1) - x,
        h: Math.max(bb.y1, bb2.y1) - y,
        isCoconut: true,
      })
      i++ // skip next word
      continue
    }

    // Skip the "nucifera" half if already merged
    if (isCoconut && /^nucifera$/i.test(w.text.replace(/[^a-zA-Z]/g, ''))) continue

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
