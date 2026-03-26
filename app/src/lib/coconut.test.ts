// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { tagCoconutWords, type WordBox } from './coconut'

function word(text: string, x0 = 0, y0 = 0, x1 = 100, y1 = 20): WordBox {
  return { text, bbox: { x0, y0, x1, y1 } }
}

describe('tagCoconutWords', () => {
  it('returns empty array for empty input', () => {
    expect(tagCoconutWords([])).toEqual([])
  })

  it('tags "coconut" as isCoconut', () => {
    const result = tagCoconutWords([word('coconut')])
    expect(result).toHaveLength(1)
    expect(result[0].isCoconut).toBe(true)
    expect(result[0].text).toBe('coconut')
  })

  it('tags "COCONUT" case-insensitively', () => {
    const result = tagCoconutWords([word('COCONUT')])
    expect(result[0].isCoconut).toBe(true)
  })

  it('tags "copra" as isCoconut', () => {
    const result = tagCoconutWords([word('copra')])
    expect(result[0].isCoconut).toBe(true)
  })

  it('does not tag unrelated words', () => {
    const result = tagCoconutWords([word('sugar'), word('water')])
    expect(result).toHaveLength(2)
    expect(result.every(h => !h.isCoconut)).toBe(true)
  })

  it('merges "cocos nucifera" into one hit', () => {
    const result = tagCoconutWords([
      word('cocos', 0, 0, 50, 20),
      word('nucifera', 55, 0, 130, 20),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].isCoconut).toBe(true)
    expect(result[0].text).toBe('cocos nucifera')
    expect(result[0].x).toBe(0)
    expect(result[0].w).toBe(130)
  })

  it('handles "cocos" without "nucifera" as non-coconut', () => {
    const result = tagCoconutWords([word('cocos'), word('butter')])
    expect(result).toHaveLength(2)
    expect(result[0].isCoconut).toBe(false)
    expect(result[1].isCoconut).toBe(false)
  })

  it('strips punctuation before matching', () => {
    const result = tagCoconutWords([word('coconut,')])
    expect(result[0].isCoconut).toBe(true)
  })

  it('handles mixed coconut and non-coconut words', () => {
    const result = tagCoconutWords([
      word('sugar'),
      word('coconut'),
      word('oil'),
    ])
    expect(result).toHaveLength(3)
    expect(result[0].isCoconut).toBe(false)
    expect(result[1].isCoconut).toBe(true)
    expect(result[2].isCoconut).toBe(false)
  })

  it('computes correct bounding box from word bbox', () => {
    const result = tagCoconutWords([word('coconut', 10, 20, 110, 40)])
    expect(result[0]).toMatchObject({ x: 10, y: 20, w: 100, h: 20 })
  })
})
