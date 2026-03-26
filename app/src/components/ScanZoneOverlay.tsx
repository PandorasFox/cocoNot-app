import type { OcrRegion } from 'coconot-ocr'

interface Props {
  region: OcrRegion
}

/**
 * Dims the area outside the active scan zone with a transparent cutout.
 * Uses four dark panels around the clear center to avoid masking pointer events.
 */
export default function ScanZoneOverlay({ region }: Props) {
  const { x, y, w, h } = region

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Top */}
      <div
        className="absolute left-0 right-0 top-0 bg-black/40"
        style={{ height: pct(y) }}
      />
      {/* Bottom */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-black/40"
        style={{ height: pct(1 - y - h) }}
      />
      {/* Left */}
      <div
        className="absolute left-0 bg-black/40"
        style={{ top: pct(y), height: pct(h), width: pct(x) }}
      />
      {/* Right */}
      <div
        className="absolute right-0 bg-black/40"
        style={{ top: pct(y), height: pct(h), width: pct(1 - x - w) }}
      />
      {/* Border around scan zone */}
      <div
        className="absolute border border-white/50 rounded-sm"
        style={{
          left: pct(x),
          top: pct(y),
          width: pct(w),
          height: pct(h),
        }}
      />
    </div>
  )
}
