import { Ocr } from 'coconot-ocr'
import type { BarcodeHit } from 'coconot-ocr'
import type { OcrHit } from './types'
import { tagCoconutWords, type WordBox } from './coconut'

export type { BarcodeHit }

export interface ScanResult {
  ocrHits: OcrHit[]
  barcodes: BarcodeHit[]
}

/**
 * Run native OCR and barcode scanning in parallel on a base64 image.
 * The native plugin center-crops the frame to match the viewport aspect
 * ratio, so returned coords map directly to screen space.
 */
export async function scanFrame(base64: string, viewportWidth: number, viewportHeight: number): Promise<ScanResult> {
  const result = await Ocr.recognizeText({ base64, viewportWidth, viewportHeight })

  const words: WordBox[] = result.words.map(w => ({
    text: w.text,
    bbox: { x0: w.x, y0: w.y, x1: w.x + w.w, y1: w.y + w.h },
  }))

  return {
    ocrHits: tagCoconutWords(words),
    barcodes: result.barcodes,
  }
}
