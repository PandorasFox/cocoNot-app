import { useState, useEffect, useRef } from 'react'
import type { OcrHit, HitboxEntry } from '../lib/types'
import type { BarcodeHit } from '../lib/ocr-bridge'
import { startCamera, stopCamera, captureFrame } from '../lib/camera-bridge'
import { upsertHit } from '../lib/hitbox-merge'
import { scanFrame } from '../lib/ocr-bridge'
import HitboxOverlay from './HitboxOverlay'
import DebugOverlay from './DebugOverlay'

const HITBOX_TTL = 3000
const SCAN_COOLDOWN = 150

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

/** Plugin returns normalized 0-1 coords, top-left origin. Scale to screen pixels. */
function toScreenSpace(hits: OcrHit[], screenW: number, screenH: number): OcrHit[] {
  return hits.map(h => ({
    ...h,
    x: h.x * screenW,
    y: h.y * screenH,
    w: h.w * screenW,
    h: h.h * screenH,
  }))
}

export default function CameraScreen() {
  const [entries, setEntries] = useState<HitboxEntry[]>([])
  const [coconutDetected, setCoconutDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [lastHits, setLastHits] = useState<OcrHit[]>([])
  const [barcodeCount, setBarcodeCount] = useState(0)
  const [scanTimeMs, setScanTimeMs] = useState(0)
  const hitboxMapRef = useRef(new Map<string, HitboxEntry>())
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    const map = hitboxMapRef.current

    async function scanLoop() {
      while (aliveRef.current) {
        const t0 = performance.now()

        try {
          const base64 = await captureFrame()
          const screenW = window.innerWidth
          const screenH = window.innerHeight
          const { ocrHits, barcodes } = await scanFrame(base64, screenW, screenH)

          if (!aliveRef.current) break

          const screenHits = toScreenSpace(ocrHits, screenW, screenH)
          const now = Date.now()

          setLastHits(screenHits)
          setBarcodeCount(barcodes.length)
          setScanTimeMs(Math.round(performance.now() - t0))

          // Coconut hitboxes
          for (const hit of screenHits) {
            if (!hit.isCoconut) continue
            const key = hitKey(hit)
            upsertHit(map, {
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

          // Barcode hitboxes (skip empty values — false positives from text/patterns)
          for (const bc of barcodes) {
            if (!bc.value.trim()) continue
            const key = barcodeKey(bc, screenW, screenH)
            upsertHit(map, {
              key,
              kind: 'barcode',
              x: bc.x * screenW,
              y: bc.y * screenH,
              w: bc.w * screenW,
              h: bc.h * screenH,
              label: bc.value,
              lastSeenAt: now,
            }, now)
          }

          for (const [key, entry] of map) {
            if (now - entry.lastSeenAt > HITBOX_TTL) map.delete(key)
          }

          const active = Array.from(map.values())
          setEntries(active)
          setCoconutDetected(active.some(e => e.kind === 'coconut'))
        } catch (err) {
          console.error('Scan error:', err)
          setScanTimeMs(Math.round(performance.now() - t0))
        }

        const elapsed = performance.now() - t0
        if (elapsed < SCAN_COOLDOWN) {
          await new Promise(r => setTimeout(r, SCAN_COOLDOWN - elapsed))
        }
      }
    }

    async function init() {
      try {
        await startCamera()
        setScanning(true)
        scanLoop()
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
      aliveRef.current = false
      stopCamera().catch(() => {})
    }
  }, [])

  return (
    <div className="fixed inset-0">
      <HitboxOverlay entries={entries} />

      <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-20">
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

      <DebugOverlay lastHits={lastHits} barcodeCount={barcodeCount} scanTimeMs={scanTimeMs} />

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
