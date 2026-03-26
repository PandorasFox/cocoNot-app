import { useState, useEffect, useRef } from 'react'
import type { OcrHit, HitboxEntry } from '../lib/types'
import type { OcrRegion } from 'coconot-ocr'
import { startCamera, stopCamera, captureFrame } from '../lib/camera-bridge'
import { recognizeText } from '../lib/ocr-bridge'
import HitboxOverlay from './HitboxOverlay'
import ScanZoneOverlay from './ScanZoneOverlay'
import DebugOverlay from './DebugOverlay'

const HITBOX_TTL = 3000
const SCAN_COOLDOWN = 150

/** Center 50% of the frame. */
const SCAN_ZONE: OcrRegion = { x: 0.15, y: 0.25, w: 0.7, h: 0.5 }

function hitKey(hit: OcrHit): string {
  const gx = Math.round(hit.x / 20) * 20
  const gy = Math.round(hit.y / 20) * 20
  return `${hit.text.toLowerCase()}@${gx},${gy}`
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
  const [scanTimeMs, setScanTimeMs] = useState(0)
  const [zoneMode, setZoneMode] = useState(true)
  const hitboxMapRef = useRef(new Map<string, HitboxEntry>())
  const zoneModeRef = useRef(true)
  const aliveRef = useRef(true)

  // Keep ref in sync so scan loop reads latest value without re-mounting
  useEffect(() => { zoneModeRef.current = zoneMode }, [zoneMode])

  useEffect(() => {
    aliveRef.current = true
    const map = hitboxMapRef.current

    async function scanLoop() {
      while (aliveRef.current) {
        const t0 = performance.now()

        try {
          const base64 = await captureFrame()
          const region = zoneModeRef.current ? SCAN_ZONE : undefined
          const hits = await recognizeText(base64, region)

          if (!aliveRef.current) break

          const screenW = window.innerWidth
          const screenH = window.innerHeight
          const screenHits = toScreenSpace(hits, screenW, screenH)
          const now = Date.now()

          setLastHits(screenHits)
          setScanTimeMs(Math.round(performance.now() - t0))

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

          for (const [key, entry] of map) {
            if (now - entry.lastSeenAt > HITBOX_TTL) map.delete(key)
          }

          const active = Array.from(map.values())
          setEntries(active)
          setCoconutDetected(active.length > 0)
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

      {zoneMode && <ScanZoneOverlay region={SCAN_ZONE} />}

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

      {/* Scan zone toggle */}
      <button
        onClick={() => setZoneMode(z => !z)}
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-3 z-20
                   bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full"
      >
        {zoneMode ? 'ZONE' : 'FULL'}
      </button>

      <DebugOverlay lastHits={lastHits} scanTimeMs={scanTimeMs} />

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
