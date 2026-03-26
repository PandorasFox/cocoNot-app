import { useState, useEffect, useRef, useCallback } from 'react'
import type { OcrHit } from '../lib/types'
import { ScanEngine } from '../lib/scan-engine'
import { HitboxManager } from '../lib/hitbox-manager'
import { GeigerEngine } from '../lib/geiger'
import BundlePrompt from './BundlePrompt'
import HitboxOverlay from './HitboxOverlay'
import DebugOverlay from './DebugOverlay'
import SettingsSheet from './SettingsSheet'

const SCAN_COOLDOWN = 150

export default function CameraScreen() {
  const [entries, setEntries] = useState<import('../lib/types').HitboxEntry[]>([])
  const [coconutDetected, setCoconutDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [lastHits, setLastHits] = useState<OcrHit[]>([])
  const [barcodeCount, setBarcodeCount] = useState(0)
  const [scanTimeMs, setScanTimeMs] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const engineRef = useRef<ScanEngine | null>(null)
  const managerRef = useRef<HitboxManager | null>(null)
  const geigerRef = useRef<GeigerEngine | null>(null)

  useEffect(() => {
    const geiger = new GeigerEngine()
    geigerRef.current = geiger

    const manager = new HitboxManager(({ entries, coconutDetected }) => {
      setEntries(entries)
      setCoconutDetected(coconutDetected)
      geiger.update(coconutDetected)
    })

    const engine = new ScanEngine({
      cooldown: SCAN_COOLDOWN,
      onResult: ({ ocrHits, barcodes, screenW, screenH, scanTimeMs }) => {
        const screenHits = ocrHits.map(h => ({
          ...h,
          x: h.x * screenW,
          y: h.y * screenH,
          w: h.w * screenW,
          h: h.h * screenH,
        }))
        setLastHits(screenHits)
        setBarcodeCount(barcodes.length)
        setScanTimeMs(scanTimeMs)
        manager.ingest(ocrHits, barcodes, screenW, screenH)
      },
      onError: (err) => {
        console.error('Scan error:', err)
      },
    })

    engineRef.current = engine
    managerRef.current = manager

    manager.start()
    engine.start()
      .then(() => setScanning(true))
      .catch((err) => {
        const msg = err.message || String(err)
        if (msg.toLowerCase().includes('permission')) {
          setError('Camera permission denied. Please enable camera access in Settings.')
        } else {
          setError(`Camera error: ${msg}`)
        }
      })

    return () => {
      engine.stop()
      manager.stop()
      geiger.dispose()
    }
  }, [])

  const openSettings = useCallback(() => {
    setSettingsOpen(true)
    engineRef.current?.pause()
  }, [])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    managerRef.current?.clear()
    engineRef.current?.resume()
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

      {/* Settings cog */}
      <button
        onClick={openSettings}
        className="fixed right-3 top-1/2 -translate-y-1/2 z-20
                   bg-black/60 text-white w-10 h-10 rounded-full
                   flex items-center justify-center text-lg"
      >
        &#9881;
      </button>

      <DebugOverlay lastHits={lastHits} barcodeCount={barcodeCount} scanTimeMs={scanTimeMs} />

      <BundlePrompt />

      <SettingsSheet open={settingsOpen} onClose={closeSettings} />

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
