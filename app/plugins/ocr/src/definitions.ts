export interface OcrWord {
  text: string
  /** Normalized 0-1, top-left origin (always in full-frame coords) */
  x: number
  y: number
  w: number
  h: number
}

/** Normalized crop region within the full frame. */
export interface OcrRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface OcrPlugin {
  recognizeText(options: { base64: string; region?: OcrRegion }): Promise<{ words: OcrWord[] }>
}
