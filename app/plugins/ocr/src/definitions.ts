export interface OcrWord {
  text: string
  /** Normalized 0-1, top-left origin (relative to visible viewport crop) */
  x: number
  y: number
  w: number
  h: number
}

export interface BarcodeHit {
  /** Decoded barcode value */
  value: string
  /** Barcode format, e.g. "EAN_13", "QR_CODE" */
  format: string
  /** Normalized 0-1, top-left origin (relative to visible viewport crop) */
  x: number
  y: number
  w: number
  h: number
}

export interface OcrResult {
  words: OcrWord[]
  barcodes: BarcodeHit[]
}

export interface OcrPlugin {
  recognizeText(options: {
    base64: string
    /** Viewport width in pixels — used to center-crop the frame to match the visible preview. */
    viewportWidth: number
    /** Viewport height in pixels — used to center-crop the frame to match the visible preview. */
    viewportHeight: number
  }): Promise<OcrResult>
}
