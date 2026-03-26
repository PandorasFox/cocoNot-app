// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { OcrHit } from './types'
import type { BarcodeHit } from './ocr-bridge'
import { HitboxManager, type HitboxState } from './hitbox-manager'

// Mock bundle lookups
vi.mock('./bundle', () => ({
  lookupBarcode: vi.fn().mockReturnValue(undefined),
}))

import { lookupBarcode } from './bundle'
const mockLookup = vi.mocked(lookupBarcode)

function ocrHit(overrides: Partial<OcrHit> = {}): OcrHit {
  return { text: 'coconut', x: 0.1, y: 0.2, w: 0.05, h: 0.03, isCoconut: true, ...overrides }
}

function barcode(overrides: Partial<BarcodeHit> = {}): BarcodeHit {
  return { value: '1234567890123', format: 'EAN_13', x: 0.5, y: 0.5, w: 0.1, h: 0.05, ...overrides }
}

describe('HitboxManager', () => {
  let states: HitboxState[]
  let manager: HitboxManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    states = []
    manager = new HitboxManager((s) => states.push(structuredClone(s)))
    manager.start()
  })

  afterEach(() => {
    manager.stop()
    vi.useRealTimers()
  })

  it('ingests OCR coconut hits and emits entries', () => {
    manager.ingest([ocrHit()], [], 400, 800)

    expect(states).toHaveLength(1)
    expect(states[0].entries).toHaveLength(1)
    expect(states[0].entries[0].kind).toBe('coconut')
    expect(states[0].coconutDetected).toBe(true)
  })

  it('ignores non-coconut OCR hits', () => {
    manager.ingest([ocrHit({ isCoconut: false })], [], 400, 800)

    expect(states).toHaveLength(1)
    expect(states[0].entries).toHaveLength(0)
  })

  it('converts normalized coords to screen space', () => {
    manager.ingest([ocrHit({ x: 0.5, y: 0.25, w: 0.1, h: 0.05 })], [], 400, 800)

    const entry = states[0].entries[0]
    expect(entry.x).toBe(200)
    expect(entry.y).toBe(200)
    expect(entry.w).toBe(40)
    expect(entry.h).toBe(40)
  })

  it('ingests barcode hits', () => {
    manager.ingest([], [barcode()], 400, 800)

    expect(states[0].entries).toHaveLength(1)
    expect(states[0].entries[0].kind).toBe('barcode')
    expect(states[0].entries[0].code).toBe('1234567890123')
  })

  it('skips barcodes with empty values', () => {
    manager.ingest([], [barcode({ value: '  ' })], 400, 800)

    expect(states[0].entries).toHaveLength(0)
  })

  it('enriches barcode from bundle lookup', () => {
    mockLookup.mockReturnValue({ code: '1234567890123', name: 'Tasty Snack', coconut: 'n' })

    manager.ingest([], [barcode()], 400, 800)

    const entry = states[0].entries[0]
    expect(entry.label).toBe('Tasty Snack')
    expect(entry.kind).toBe('barcode')
  })

  it('marks barcode as coconut when bundle says so', () => {
    mockLookup.mockReturnValue({ code: '1234567890123', name: 'Coconut Oil', coconut: 'y' })

    manager.ingest([], [barcode()], 400, 800)

    const entry = states[0].entries[0]
    expect(entry.label).toBe('Coconut Oil')
    expect(entry.kind).toBe('coconut')
    expect(states[0].coconutDetected).toBe(true)
  })

  it('expires stale entries via TTL sweep', () => {
    manager.ingest([ocrHit()], [], 400, 800)
    expect(states.at(-1)!.entries).toHaveLength(1)

    // Advance past TTL (3000ms) + sweep interval (500ms)
    vi.advanceTimersByTime(3500)

    expect(states.at(-1)!.entries).toHaveLength(0)
    expect(states.at(-1)!.coconutDetected).toBe(false)
  })

  it('sweep runs independently of ingest calls', () => {
    manager.ingest([ocrHit()], [], 400, 800)

    // No more ingests — but sweep still fires and cleans up
    vi.advanceTimersByTime(4000)

    expect(states.at(-1)!.entries).toHaveLength(0)
  })

  it('refreshed entries survive sweep', () => {
    manager.ingest([ocrHit()], [], 400, 800)

    // Refresh at 2s
    vi.advanceTimersByTime(2000)
    manager.ingest([ocrHit()], [], 400, 800)

    // 2s later (4s total, but only 2s since last refresh)
    vi.advanceTimersByTime(2000)
    expect(states.at(-1)!.entries).toHaveLength(1)

    // Now let it fully expire
    vi.advanceTimersByTime(2000)
    expect(states.at(-1)!.entries).toHaveLength(0)
  })

  it('clear() removes all entries immediately', () => {
    manager.ingest([ocrHit()], [barcode()], 400, 800)
    expect(states.at(-1)!.entries).toHaveLength(2)

    manager.clear()
    expect(states.at(-1)!.entries).toHaveLength(0)
  })

  it('stop() halts the sweep timer', () => {
    manager.ingest([ocrHit()], [], 400, 800)
    manager.stop()

    const stateCount = states.length
    vi.advanceTimersByTime(5000)

    // No new emissions after stop
    expect(states.length).toBe(stateCount)
  })
})
