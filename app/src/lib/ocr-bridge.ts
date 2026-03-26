import { Ocr } from 'coconot-ocr'
import type { OcrHit } from './types'
import { tagCoconutWords, type WordBox } from './coconut'

/**
 * Run native OCR on a base64 image and return classified hits.
 * Returns word-level results with normalized 0-1 coords (top-left origin).
 * The native plugin center-crops the frame to match the viewport aspect
 * ratio, so returned coords map directly to screen space.
 */
export async function recognizeText(base64: string, viewportWidth: number, viewportHeight: number): Promise<OcrHit[]> {
  const result = await Ocr.recognizeText({ base64, viewportWidth, viewportHeight })

  const words: WordBox[] = result.words.map(w => ({
    text: w.text,
    bbox: { x0: w.x, y0: w.y, x1: w.x + w.w, y1: w.y + w.h },
  }))

  return tagCoconutWords(words)
}
