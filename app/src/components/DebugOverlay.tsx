import { useState } from 'react'
import type { OcrHit } from '../lib/types'

interface Props {
  lastHits: OcrHit[]
  scanTimeMs: number
}

export default function DebugOverlay({ lastHits, scanTimeMs }: Props) {
  const [expanded, setExpanded] = useState(false)

  const coconutHits = lastHits.filter(h => h.isCoconut)
  const fps = scanTimeMs > 0 ? (1000 / scanTimeMs).toFixed(1) : '—'

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-2 z-30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="bg-black/70 text-white text-xs font-mono px-3 py-1.5 rounded-full"
      >
        {fps} fps · {lastHits.length} words · {coconutHits.length} hits
      </button>

      {expanded && (
        <div className="bg-black/85 text-white text-xs font-mono p-3 rounded-lg mt-2 max-h-60 overflow-y-auto max-w-[90vw]">
          <div className="mb-2 text-green-400">
            Scan: {scanTimeMs}ms · {lastHits.length} words · {coconutHits.length} coconut
          </div>

          {coconutHits.length > 0 && (
            <div className="mb-2">
              <div className="text-red-400 font-bold">Coconut:</div>
              {coconutHits.map((h, i) => (
                <div key={i} className="text-red-300 ml-2">
                  "{h.text}" ({Math.round(h.x)},{Math.round(h.y)}) {Math.round(h.w)}x{Math.round(h.h)}
                </div>
              ))}
            </div>
          )}

          <div className="text-gray-400">
            All text: {lastHits.map(h => h.text).join(' ').slice(0, 300)}
            {lastHits.map(h => h.text).join(' ').length > 300 ? '…' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
