import { useState, useRef, useEffect, useCallback } from 'react'
import { getKeywords, setKeywords, getGeigerEnabled, setGeigerEnabled } from '../lib/settings'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsSheet({ open, onClose }: Props) {
  const [keywords, setLocal] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [geigerOn, setGeigerOn] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setLocal(getKeywords())
      setGeigerOn(getGeigerEnabled())
    }
  }, [open])

  function save(updated: string[]) {
    setLocal(updated)
    setKeywords(updated)
  }

  function addKeyword() {
    const kw = newKeyword.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) {
      setNewKeyword('')
      return
    }
    save([...keywords, kw])
    setNewKeyword('')
  }

  function removeKeyword(idx: number) {
    save(keywords.filter((_, i) => i !== idx))
  }

  // Swipe-to-dismiss — tracks anywhere on the sheet except interactive elements
  const dragStartY = useRef(0)
  const dragOffsetY = useRef(0)
  const dragging = useRef(false)
  const [sheetTranslateY, setSheetTranslateY] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const isInteractive = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || el.isContentEditable
  }

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isInteractive(e.target)) { dragging.current = false; return }
    dragStartY.current = e.touches[0].clientY
    dragOffsetY.current = 0
    dragging.current = true
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    const dy = e.touches[0].clientY - dragStartY.current
    dragOffsetY.current = Math.max(0, dy)
    if (dragOffsetY.current > 8) {
      setSheetTranslateY(dragOffsetY.current)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    if (dragOffsetY.current > 80) {
      onClose()
    }
    setSheetTranslateY(0)
    dragOffsetY.current = 0
  }, [onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop — blurred top 1/3, tap to dismiss */}
      <div
        className="fixed inset-0 z-50"
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Sheet — bottom 2/3 */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 h-2/3"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: `translateY(${sheetTranslateY}px)`,
          transition: sheetTranslateY === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="h-full bg-gray-950/95 rounded-t-2xl flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          <div className="px-4 pt-2 pb-3">
            <h2 className="text-white text-lg font-semibold">Settings</h2>
            <p className="text-gray-400 text-xs mt-0.5">Detection keywords</p>
          </div>

          {/* Keyword list */}
          <div className="flex-1 overflow-y-auto px-4">
            {keywords.map((kw, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-white text-sm">{kw}</span>
                {confirmDelete === i ? (
                  <button
                    onClick={() => { removeKeyword(i); setConfirmDelete(null) }}
                    className="text-red-400 text-xs font-medium px-2 py-0.5 bg-red-400/10 rounded"
                  >
                    delete
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(i)}
                    className="text-gray-500 text-lg px-2"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}

            {/* Add keyword */}
            <div className="flex items-center gap-2 py-3">
              <input
                ref={inputRef}
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addKeyword() }}
                onBlur={addKeyword}
                placeholder="Add keyword..."
                className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg
                           placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-gray-600"
              />
            </div>

            {/* Geiger counter toggle */}
            <div className="flex items-center justify-between py-3 mt-2 border-t border-gray-800">
              <div>
                <p className="text-white text-sm">Geiger counter SFX</p>
                <p className="text-gray-500 text-xs">Click sound on detection</p>
              </div>
              <button
                onClick={() => {
                  const next = !geigerOn
                  setGeigerOn(next)
                  setGeigerEnabled(next)
                }}
                className={`w-11 h-6 rounded-full transition-colors ${
                  geigerOn ? 'bg-red-500' : 'bg-gray-700'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  geigerOn ? 'translate-x-5.5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
