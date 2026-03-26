/** A single recognized word with bounding box and coconut classification. */
export interface OcrHit {
  text: string
  x: number
  y: number
  w: number
  h: number
  isCoconut: boolean
}

/** Persistent hitbox entry with TTL tracking for overlay smoothing. */
export interface HitboxEntry {
  key: string
  kind: 'coconut' | 'barcode'
  x: number
  y: number
  w: number
  h: number
  label: string
  lastSeenAt: number
  /** Raw barcode value — used to construct Open Food Facts URL. */
  code?: string
}
