import { useRef, useEffect } from 'react'
import type { HitboxEntry } from '../lib/types'
import { drawHitboxes } from '../lib/hitbox-render'

interface Props {
  entries: HitboxEntry[]
}

export default function HitboxOverlay({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const dw = window.innerWidth
    const dh = window.innerHeight

    canvas.width = dw * dpr
    canvas.height = dh * dpr
    canvas.style.width = `${dw}px`
    canvas.style.height = `${dh}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    drawHitboxes(ctx, dw, dh, entries)
  }, [entries])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}
