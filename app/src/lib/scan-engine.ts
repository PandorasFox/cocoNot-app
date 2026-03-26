import type { OcrHit } from './types'
import type { BarcodeHit } from './ocr-bridge'
import { startCamera, stopCamera, captureFrame } from './camera-bridge'
import { scanFrame } from './ocr-bridge'

export interface ScanResult {
  ocrHits: OcrHit[]
  barcodes: BarcodeHit[]
  screenW: number
  screenH: number
  scanTimeMs: number
}

export interface ScanEngineOpts {
  cooldown: number
  onResult: (result: ScanResult) => void
  onError: (err: Error) => void
}

/**
 * Standalone scan loop that captures frames, runs OCR + barcode detection,
 * and emits results. Handles camera lifecycle and app visibility changes.
 */
export class ScanEngine {
  private alive = false
  private paused = false
  private opts: ScanEngineOpts
  private onVisChange = () => {
    if (document.visibilityState === 'visible') {
      this.resume()
    } else {
      this.pause()
    }
  }

  constructor(opts: ScanEngineOpts) {
    this.opts = opts
  }

  get running(): boolean {
    return this.alive && !this.paused
  }

  async start(): Promise<void> {
    await startCamera()
    this.alive = true
    this.paused = false
    document.addEventListener('visibilitychange', this.onVisChange)
    this.loop()
  }

  stop(): void {
    this.alive = false
    this.paused = false
    document.removeEventListener('visibilitychange', this.onVisChange)
    this.safeStopCamera()
  }

  async pause(): Promise<void> {
    this.paused = true
    this.safeStopCamera()
  }

  async resume(): Promise<void> {
    if (!this.alive) return
    try {
      await startCamera()
      this.paused = false
      this.loop()
    } catch {
      // Camera may be unavailable after resume — not fatal
    }
  }

  private safeStopCamera(): void {
    try { stopCamera().catch(() => {}) } catch { /* bridge may be dead */ }
  }

  private async loop(): Promise<void> {
    while (this.alive && !this.paused) {
      const t0 = performance.now()

      try {
        const base64 = await captureFrame()
        const screenW = window.innerWidth
        const screenH = window.innerHeight
        const { ocrHits, barcodes } = await scanFrame(base64, screenW, screenH)

        if (!this.alive || this.paused) break

        this.opts.onResult({
          ocrHits,
          barcodes,
          screenW,
          screenH,
          scanTimeMs: Math.round(performance.now() - t0),
        })
      } catch (err) {
        // During teardown, the bridge or WebView may be gone — swallow silently
        if (!this.alive) break
        try {
          this.opts.onError(err instanceof Error ? err : new Error(String(err)))
        } catch { /* callback may be dead too */ }
      }

      const elapsed = performance.now() - t0
      if (elapsed < this.opts.cooldown) {
        await new Promise(r => setTimeout(r, this.opts.cooldown - elapsed))
      }
    }
  }
}
