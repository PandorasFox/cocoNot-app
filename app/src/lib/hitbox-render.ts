import type { HitboxEntry } from './types'

const COCONUT_COLOR = '#ef4444'

/** WCAG relative luminance for a hex color. */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Draw a rounded rectangle path. */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Draw coconut detection hitboxes onto the canvas.
 * Only renders coconut-detected entries (red box + label chip).
 *
 * Coordinate transform: caller must supply entries already in screen space.
 */
export function drawHitboxes(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  entries: HitboxEntry[],
) {
  ctx.clearRect(0, 0, dw, dh)

  const chipFontSize = 11
  const chipPadX = 4
  const chipPadY = 2
  const chipRadius = 3
  const lineWidth = 5
  const outset = lineWidth / 2
  const cornerRadius = 6
  const color = COCONUT_COLOR

  for (const entry of entries) {
    const { x, y, w, h, label } = entry

    // Outset so border doesn't cover text
    const rx = x - outset
    const ry = y - outset
    const rw = w + outset * 2
    const rh = h + outset * 2

    // Rounded rect border
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    roundedRectPath(ctx, rx, ry, rw, rh, cornerRadius)
    ctx.stroke()

    // Label chip above the bounding box
    const chipLabel = label.length > 20 ? label.slice(0, 19) + '\u2026' : label
    ctx.font = `bold ${chipFontSize}px sans-serif`
    const textWidth = ctx.measureText(chipLabel).width
    const chipW = textWidth + chipPadX * 2
    const chipH = chipFontSize + chipPadY * 2
    const chipX = x
    const chipY = y - chipH - 2

    // Chip background
    ctx.fillStyle = color
    roundedRectPath(ctx, chipX, chipY, chipW, chipH, chipRadius)
    ctx.fill()

    // Chip text — WCAG contrast
    const lum = relativeLuminance(color)
    ctx.fillStyle = lum > 0.5 ? '#000000' : '#ffffff'
    ctx.textBaseline = 'top'
    ctx.fillText(chipLabel, chipX + chipPadX, chipY + chipPadY)
  }
}
