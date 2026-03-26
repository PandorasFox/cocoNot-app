import type { HitboxEntry } from './types'

/** Do two rectangles overlap? */
function overlaps(a: HitboxEntry, b: HitboxEntry): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x
      && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Expand `target` to cover `source`, reset lifetime. */
function absorb(target: HitboxEntry, source: HitboxEntry, now: number): void {
  const x = Math.min(target.x, source.x)
  const y = Math.min(target.y, source.y)
  target.w = Math.max(target.x + target.w, source.x + source.w) - x
  target.h = Math.max(target.y + target.h, source.y + source.h) - y
  target.x = x
  target.y = y
  target.lastSeenAt = now
}

/**
 * Merge a new hit into the map. If it overlaps any existing entry,
 * expand that entry to cover both. Chain-merge if the expanded entry
 * now overlaps others.
 */
export function mergeHit(map: Map<string, HitboxEntry>, entry: HitboxEntry, now: number): void {
  for (const [key, existing] of map) {
    if (overlaps(existing, entry)) {
      absorb(existing, entry, now)
      collapseOverlaps(map, key, now)
      return
    }
  }
  map.set(entry.key, entry)
}

/** After expanding an entry, absorb any other entries it now overlaps. */
function collapseOverlaps(map: Map<string, HitboxEntry>, anchorKey: string, now: number): void {
  const anchor = map.get(anchorKey)!
  let merged = true
  while (merged) {
    merged = false
    for (const [key, other] of map) {
      if (key === anchorKey) continue
      if (overlaps(anchor, other)) {
        absorb(anchor, other, now)
        map.delete(key)
        merged = true
      }
    }
  }
}
