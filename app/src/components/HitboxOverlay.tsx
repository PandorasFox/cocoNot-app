import { useRef, useEffect, useCallback } from 'react'
import type { HitboxEntry } from '../lib/types'
import { drawHitboxes } from '../lib/hitbox-render'

interface Props {
  entries: HitboxEntry[]
}

export default function HitboxOverlay({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizedRef = useRef(false)

  const ensureSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const dw = window.innerWidth
    const dh = window.innerHeight
    const needsResize = canvas.width !== dw * dpr || canvas.height !== dh * dpr
    if (!needsResize && sizedRef.current) return
    canvas.width = dw * dpr
    canvas.height = dh * dpr
    canvas.style.width = `${dw}px`
    canvas.style.height = `${dh}px`
    sizedRef.current = true
  }, [])

  useEffect(() => {
    ensureSize()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawHitboxes(ctx, window.innerWidth, window.innerHeight, entries)
  }, [entries, ensureSize])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}
