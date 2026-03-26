import type { HitboxEntry } from './types'

/** Do two rectangles overlap? */
function overlaps(a: HitboxEntry, b: HitboxEntry): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x
      && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Upsert a hit into the map. If it overlaps an existing entry of the
 * same kind, replace that entry's position/size and reset its lifetime.
 * Different kinds are independent and may overlap freely.
 */
export function upsertHit(map: Map<string, HitboxEntry>, entry: HitboxEntry, now: number): void {
  for (const [, existing] of map) {
    if (existing.kind !== entry.kind) continue
    if (overlaps(existing, entry)) {
      // Replace with the new position, reset lifetime
      existing.x = entry.x
      existing.y = entry.y
      existing.w = entry.w
      existing.h = entry.h
      existing.label = entry.label
      existing.lastSeenAt = now
      return
    }
  }
  map.set(entry.key, entry)
}
