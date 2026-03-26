import { describe, it, expect } from 'vitest'
import type { HitboxEntry } from './types'
import { mergeHit } from './hitbox-merge'

function entry(overrides: Partial<HitboxEntry> & { key: string }): HitboxEntry {
  return {
    x: 0, y: 0, w: 10, h: 10,
    label: 'COCONUT', lastSeenAt: 0,
    ...overrides,
  }
}

describe('mergeHit', () => {
  it('inserts into empty map', () => {
    const map = new Map<string, HitboxEntry>()
    mergeHit(map, entry({ key: 'a', x: 0, y: 0, w: 10, h: 10, lastSeenAt: 100 }), 100)
    expect(map.size).toBe(1)
    expect(map.get('a')!.lastSeenAt).toBe(100)
  })

  it('keeps non-overlapping boxes separate', () => {
    const map = new Map<string, HitboxEntry>()
    mergeHit(map, entry({ key: 'a', x: 0, y: 0, w: 10, h: 10 }), 100)
    mergeHit(map, entry({ key: 'b', x: 50, y: 50, w: 10, h: 10 }), 200)
    expect(map.size).toBe(2)
  })

  it('merges overlapping boxes into union rect', () => {
    const map = new Map<string, HitboxEntry>()
    mergeHit(map, entry({ key: 'a', x: 0, y: 0, w: 20, h: 20, lastSeenAt: 100 }), 100)
    mergeHit(map, entry({ key: 'b', x: 10, y: 10, w: 20, h: 20 }), 200)

    expect(map.size).toBe(1)
    const merged = map.get('a')!
    expect(merged.x).toBe(0)
    expect(merged.y).toBe(0)
    expect(merged.w).toBe(30)
    expect(merged.h).toBe(30)
    expect(merged.lastSeenAt).toBe(200)
  })

  it('resets lifetime on merge', () => {
    const map = new Map<string, HitboxEntry>()
    mergeHit(map, entry({ key: 'a', x: 0, y: 0, w: 20, h: 20 }), 100)
    mergeHit(map, entry({ key: 'b', x: 5, y: 5, w: 10, h: 10 }), 500)

    expect(map.get('a')!.lastSeenAt).toBe(500)
  })

  it('chain-merges when expanded box overlaps a third entry', () => {
    const map = new Map<string, HitboxEntry>()
    // A and C don't overlap, but B overlaps A, and after A expands it overlaps C
    mergeHit(map, entry({ key: 'a', x: 0, y: 0, w: 10, h: 10 }), 100)
    mergeHit(map, entry({ key: 'c', x: 25, y: 0, w: 10, h: 10 }), 100)
    expect(map.size).toBe(2)

    // B spans from 5 to 30, overlapping A and once A expands it covers C
    mergeHit(map, entry({ key: 'b', x: 5, y: 0, w: 25, h: 10 }), 200)

    expect(map.size).toBe(1)
    const merged = Array.from(map.values())[0]
    expect(merged.x).toBe(0)
    expect(merged.w).toBe(35)
    expect(merged.lastSeenAt).toBe(200)
  })

  it('merges identical boxes', () => {
    const map = new Map<string, HitboxEntry>()
    mergeHit(map, entry({ key: 'a', x: 10, y: 10, w: 20, h: 20 }), 100)
    mergeHit(map, entry({ key: 'b', x: 10, y: 10, w: 20, h: 20 }), 200)

    expect(map.size).toBe(1)
    const merged = map.get('a')!
    expect(merged.x).toBe(10)
    expect(merged.y).toBe(10)
    expect(merged.w).toBe(20)
    expect(merged.h).toBe(20)
    expect(merged.lastSeenAt).toBe(200)
  })
})
