import { useState, useEffect, useRef, useCallback } from 'react'
import type { OcrHit, HitboxEntry } from '../lib/types'
import { startCamera, stopCamera, captureFrame } from '../lib/camera-bridge'
import { recognizeText } from '../lib/ocr-bridge'
import HitboxOverlay from './HitboxOverlay'

/** How long a hitbox persists after last detection (ms). */
const HITBOX_TTL = 3000
/** Interval between scan cycles (ms). */
const SCAN_INTERVAL = 300

/** Generate a stable key for deduplicating hitbox entries. */
function hitKey(hit: OcrHit): string {
  // Round to 20px grid to merge nearby repeated detections
  const gx = Math.round(hit.x / 20) * 20
  const gy = Math.round(hit.y / 20) * 20
  return `${hit.text.toLowerCase()}@${gx},${gy}`
}

/**
 * Convert OCR hits (image-space coords) to screen-space HitboxEntries.
 *
 * iOS Vision returns normalized coords (0-1) with bottom-left origin.
 * Android ML Kit returns pixel coords with top-left origin.
 * We detect this heuristically: if all coords are <= 1, assume normalized.
 */
function toScreenSpace(
  hits: OcrHit[],
  screenW: number,
  screenH: number,
): OcrHit[] {
  if (hits.length === 0) return hits

  // Check if coordinates look normalized (all values between 0 and 1)
  const isNormalized = hits.every(
    h => h.x >= 0 && h.x <= 1 && h.y >= 0 && h.y <= 1 &&
         h.w >= 0 && h.w <= 1 && h.h >= 0 && h.h <= 1,
  )

  if (isNormalized) {
    // iOS Vision: normalized with bottom-left origin → flip Y
    return hits.map(h => ({
      ...h,
      x: h.x * screenW,
      y: (1 - h.y - h.h) * screenH,
      w: h.w * screenW,
      h: h.h * screenH,
    }))
  }

  // Android ML Kit or web: pixel coords, assume capture size matches screen
  // Scale from capture resolution to screen
  const maxX = Math.max(...hits.map(h => h.x + h.w))
  const maxY = Math.max(...hits.map(h => h.y + h.h))

  // If coords are already roughly screen-sized, no scaling needed
  if (maxX <= screenW * 1.2 && maxY <= screenH * 1.2) return hits

  const scaleX = screenW / maxX
  const scaleY = screenH / maxY
  return hits.map(h => ({
    ...h,
    x: h.x * scaleX,
    y: h.y * scaleY,
    w: h.w * scaleX,
    h: h.h * scaleY,
  }))
}

export default function CameraScreen() {
  const [entries, setEntries] = useState<HitboxEntry[]>([])
  const [coconutDetected, setCoconutDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const hitboxMapRef = useRef(new Map<string, HitboxEntry>())
  const scanningRef = useRef(false)

  const scan = useCallback(async () => {
    if (scanningRef.current) return
    scanningRef.current = true

    try {
      const base64 = await captureFrame()
      const hits = await recognizeText(base64)

      const screenW = window.innerWidth
      const screenH = window.innerHeight
      const screenHits = toScreenSpace(hits, screenW, screenH)

      const now = Date.now()
      const map = hitboxMapRef.current

      // Update/add coconut hits
      for (const hit of screenHits) {
        if (!hit.isCoconut) continue
        const key = hitKey(hit)
        map.set(key, {
          key,
          x: hit.x,
          y: hit.y,
          w: hit.w,
          h: hit.h,
          label: hit.text.toUpperCase(),
          lastSeenAt: now,
        })
      }

      // Prune expired entries
      for (const [key, entry] of map) {
        if (now - entry.lastSeenAt > HITBOX_TTL) {
          map.delete(key)
        }
      }

      const active = Array.from(map.values())
      setEntries(active)
      setCoconutDetected(active.length > 0)
    } catch (err) {
      console.error('Scan error:', err)
    } finally {
      scanningRef.current = false
    }
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    async function init() {
      try {
        await startCamera()
        setScanning(true)
        interval = setInterval(scan, SCAN_INTERVAL)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('permission')) {
          setError('Camera permission denied. Please enable camera access in Settings.')
        } else {
          setError(`Camera error: ${msg}`)
        }
      }
    }

    init()

    return () => {
      clearInterval(interval)
      stopCamera().catch(() => {})
    }
  }, [scan])

  return (
    <div className="fixed inset-0">
      {/* Hitbox overlay */}
      <HitboxOverlay entries={entries} />

      {/* Status pill */}
      <div
        className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-20"
      >
        {coconutDetected ? (
          <div className="bg-red-600 text-white font-bold text-sm px-4 py-2 rounded-full shadow-lg animate-pulse">
            COCONUT DETECTED
          </div>
        ) : scanning ? (
          <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-full shadow-lg">
            Scanning...
          </div>
        ) : null}
      </div>

      {/* Error display */}
      {error && (
        <div className="fixed inset-0 flex items-center justify-center z-30 bg-black/80">
          <div className="bg-white text-gray-900 rounded-xl p-6 mx-6 max-w-sm text-center shadow-2xl">
            <p className="text-lg font-semibold mb-2">Unable to start camera</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
