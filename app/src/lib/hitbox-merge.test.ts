import { describe, it, expect } from 'vitest'
import type { HitboxEntry } from './types'
import { upsertHit } from './hitbox-merge'

function entry(overrides: Partial<HitboxEntry> & { key: string }): HitboxEntry {
  return {
    x: 0, y: 0, w: 10, h: 10,
    kind: 'coconut', label: 'COCONUT', lastSeenAt: 0,
    ...overrides,
  }
}

describe('upsertHit', () => {
  it('inserts into empty map', () => {
    const map = new Map<string, HitboxEntry>()
    upsertHit(map, entry({ key: 'a', lastSeenAt: 100 }), 100)
    expect(map.size).toBe(1)
    expect(map.get('a')!.lastSeenAt).toBe(100)
  })

  it('keeps non-overlapping boxes separate', () => {
    const map = new Map<string, HitboxEntry>()
    upsertHit(map, entry({ key: 'a', x: 0, y: 0, w: 10, h: 10 }), 100)
    upsertHit(map, entry({ key: 'b', x: 50, y: 50, w: 10, h: 10 }), 200)
    expect(map.size).toBe(2)
  })

  it('replaces overlapping same-kind box with new position', () => {
    const map = new Map<string, HitboxEntry>()
    upsertHit(map, entry({ key: 'a', x: 0, y: 0, w: 20, h: 20, lastSeenAt: 100 }), 100)
    upsertHit(map, entry({ key: 'b', x: 10, y: 10, w: 25, h: 25 }), 200)

    expect(map.size).toBe(1)
    const replaced = map.get('a')!
    // Takes the NEW entry's position, not the union
    expect(replaced.x).toBe(10)
    expect(replaced.y).toBe(10)
    expect(replaced.w).toBe(25)
    expect(replaced.h).toBe(25)
    expect(replaced.lastSeenAt).toBe(200)
  })

  it('resets lifetime on replace', () => {
    const map = new Map<string, HitboxEntry>()
    upsertHit(map, entry({ key: 'a', x: 0, y: 0, w: 20, h: 20 }), 100)
    upsertHit(map, entry({ key: 'b', x: 5, y: 5, w: 10, h: 10 }), 500)

    expect(map.get('a')!.lastSeenAt).toBe(500)
  })

  it('allows different kinds to overlap independently', () => {
    const map = new Map<string, HitboxEntry>()
    upsertHit(map, entry({ key: 'a', kind: 'coconut', x: 0, y: 0, w: 20, h: 20 }), 100)
    upsertHit(map, entry({ key: 'b', kind: 'barcode', x: 5, y: 5, w: 10, h: 10 }), 200)

    // Both survive — different kinds don't interact
    expect(map.size).toBe(2)
  })

  it('replaces identical boxes', () => {
    const map = new Map<string, HitboxEntry>()
    upsertHit(map, entry({ key: 'a', x: 10, y: 10, w: 20, h: 20 }), 100)
    upsertHit(map, entry({ key: 'b', x: 10, y: 10, w: 20, h: 20 }), 200)

    expect(map.size).toBe(1)
    expect(map.get('a')!.lastSeenAt).toBe(200)
  })
})
