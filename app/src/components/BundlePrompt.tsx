import { useState, useEffect } from 'react'
import {
  fetchMeta, fetchBundle, loadBundle, getCachedMeta, setCachedMeta,
  getPref, setPref, type BundleMeta,
} from '../lib/bundle'

export type PromptState = 'checking' | 'prompt' | 'downloading' | 'up-to-date' | 'error' | 'done'

/**
 * Determine what the prompt should do based on remote vs cached meta.
 * Exported for testing.
 */
export function decideAction(
  remoteMeta: BundleMeta,
  cachedMeta: BundleMeta | null,
  pref: string,
): 'up-to-date' | 'auto-download' | 'prompt' {
  if (cachedMeta && cachedMeta.updated_at === remoteMeta.updated_at) {
    return 'up-to-date'
  }
  if (pref === 'always') {
    return 'auto-download'
  }
  return 'prompt'
}

export default function BundlePrompt() {
  const [state, setState] = useState<PromptState>('checking')
  const [meta, setMeta] = useState<BundleMeta | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    checkForUpdate()
  }, [])

  // Auto-dismiss transient states after 3s
  useEffect(() => {
    if (state !== 'up-to-date' && state !== 'error') return
    const t = setTimeout(() => setState('done'), 3000)
    return () => clearTimeout(t)
  }, [state])

  async function checkForUpdate() {
    try {
      await loadBundle()
      const remoteMeta = await fetchMeta()
      const cachedMeta = getCachedMeta()
      const action = decideAction(remoteMeta, cachedMeta, getPref())

      setMeta(remoteMeta)

      if (action === 'up-to-date') {
        setState('up-to-date')
      } else if (action === 'auto-download') {
        await doDownload(remoteMeta, false)
      } else {
        setState('prompt')
      }
    } catch (err) {
      console.warn('Bundle check failed:', err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  async function doDownload(m: BundleMeta, setAlways: boolean) {
    setState('downloading')
    try {
      await fetchBundle((received, total) => {
        setProgress(received / total)
      })
      setCachedMeta(m)
      if (setAlways) setPref('always')
      setState('done')
    } catch (err) {
      console.warn('Bundle download failed:', err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  if (state === 'done' || state === 'checking') return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40"
         style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-2 bg-gray-900/95 backdrop-blur rounded-xl p-3 shadow-2xl">
        {state === 'up-to-date' && (
          <p className="text-green-400 text-sm text-center">
            Product database up to date
          </p>
        )}

        {state === 'error' && (
          <p className="text-red-400 text-sm text-center">
            Bundle error: {errorMsg}
          </p>
        )}

        {state === 'downloading' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">Downloading product data...</span>
              <span className="text-gray-400 text-xs">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {state === 'prompt' && meta && (
          <div>
            <p className="text-white text-sm mb-2">
              Download SKU-to-coconut mapping data? ({(meta.compressed_bytes / (1024 * 1024)).toFixed(1)} MB)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => doDownload(meta, false)}
                className="flex-1 bg-white text-gray-900 text-sm font-medium py-1.5 rounded-lg"
              >
                Yes
              </button>
              <button
                onClick={() => doDownload(meta, true)}
                className="flex-1 bg-gray-700 text-white text-sm py-1.5 rounded-lg"
              >
                Always
              </button>
              <button
                onClick={() => setState('done')}
                className="flex-1 text-gray-400 text-sm py-1.5"
              >
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
