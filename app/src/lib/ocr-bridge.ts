import { Ocr } from 'coconot-ocr'
import type { OcrRegion } from 'coconot-ocr'
import type { OcrHit } from './types'
import { tagCoconutWords, type WordBox } from './coconut'

/**
 * Run native OCR on a base64 image and return classified hits.
 * Returns word-level results with normalized 0-1 coords (top-left origin).
 * If region is provided, only that portion of the image is scanned,
 * but returned coords are in full-frame space.
 */
export async function recognizeText(base64: string, region?: OcrRegion): Promise<OcrHit[]> {
  const result = await Ocr.recognizeText({ base64, region })

  const words: WordBox[] = result.words.map(w => ({
    text: w.text,
    bbox: { x0: w.x, y0: w.y, x1: w.x + w.w, y1: w.y + w.h },
  }))

  return tagCoconutWords(words)
}
