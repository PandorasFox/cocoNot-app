import type { OcrHit, HitboxEntry } from './types'
import type { BarcodeHit } from './ocr-bridge'
import { lookupBarcode } from './bundle'
import { upsertHit } from './hitbox-merge'

const HITBOX_TTL = 3000
const SWEEP_INTERVAL = 500

function hitKey(hit: OcrHit): string {
  const gx = Math.round(hit.x / 20) * 20
  const gy = Math.round(hit.y / 20) * 20
  return `${hit.text.toLowerCase()}@${gx},${gy}`
}

function barcodeKey(bc: BarcodeHit, screenW: number, screenH: number): string {
  const gx = Math.round((bc.x * screenW) / 40) * 40
  const gy = Math.round((bc.y * screenH) / 40) * 40
  return `barcode:${bc.value}@${gx},${gy}`
}

function toScreenSpace(hits: OcrHit[], screenW: number, screenH: number): OcrHit[] {
  return hits.map(h => ({
    ...h,
    x: h.x * screenW,
    y: h.y * screenH,
    w: h.w * screenW,
    h: h.h * screenH,
  }))
}

export interface HitboxState {
  entries: HitboxEntry[]
  coconutDetected: boolean
}

export type HitboxChangeCallback = (state: HitboxState) => void

/**
 * Manages hitbox entries independently of the scan loop.
 * Runs its own TTL sweep so stale entries expire even if scans are failing.
 */
export class HitboxManager {
  private map = new Map<string, HitboxEntry>()
  private sweepTimer: ReturnType<typeof setInterval> | null = null
  private onChange: HitboxChangeCallback

  constructor(onChange: HitboxChangeCallback) {
    this.onChange = onChange
  }

  start(): void {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL)
  }

  stop(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }

  clear(): void {
    this.map.clear()
    this.emit()
  }

  /** Process a scan result — convert to hitbox entries, enrich barcodes, upsert. */
  ingest(
    ocrHits: OcrHit[],
    barcodes: BarcodeHit[],
    screenW: number,
    screenH: number,
  ): void {
    const screenHits = toScreenSpace(ocrHits, screenW, screenH)
    const now = Date.now()

    for (const hit of screenHits) {
      if (!hit.isCoconut) continue
      const key = hitKey(hit)
      upsertHit(this.map, {
        key,
        kind: 'coconut',
        x: hit.x,
        y: hit.y,
        w: hit.w,
        h: hit.h,
        label: hit.text.toUpperCase(),
        lastSeenAt: now,
      }, now)
    }

    for (const bc of barcodes) {
      if (!bc.value.trim()) continue
      const key = barcodeKey(bc, screenW, screenH)
      const product = lookupBarcode(bc.value)
      upsertHit(this.map, {
        key,
        kind: product?.coconut === 'y' ? 'coconut' : 'barcode',
        x: bc.x * screenW,
        y: bc.y * screenH,
        w: bc.w * screenW,
        h: bc.h * screenH,
        label: product?.name ?? bc.value,
        code: bc.value,
        lastSeenAt: now,
      }, now)
    }

    this.emit()
  }

  private sweep(): void {
    const now = Date.now()
    let changed = false
    for (const [key, entry] of this.map) {
      if (now - entry.lastSeenAt > HITBOX_TTL) {
        this.map.delete(key)
        changed = true
      }
    }
    if (changed) this.emit()
  }

  private emit(): void {
    const entries = Array.from(this.map.values())
    this.onChange({
      entries,
      coconutDetected: entries.some(e => e.kind === 'coconut'),
    })
  }
}
