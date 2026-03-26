import { Ocr } from '@capacitor-community/image-to-text'
import type { TextDetection } from '@capacitor-community/image-to-text'
import type { OcrHit } from './types'
import { tagCoconutWords, type WordBox } from './coconut'

/**
 * Run native OCR on a base64 image and return classified hits.
 * Converts image-to-text corner points → bbox for tagCoconutWords.
 */
export async function recognizeText(base64: string): Promise<OcrHit[]> {
  const result = await Ocr.detectText({ base64 })

  const words: WordBox[] = result.textDetections.map((d: TextDetection) => {
    const xs = [d.topLeft[0], d.topRight[0], d.bottomLeft[0], d.bottomRight[0]]
    const ys = [d.topLeft[1], d.topRight[1], d.bottomLeft[1], d.bottomRight[1]]
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    const x1 = Math.max(...xs)
    const y1 = Math.max(...ys)
    return { text: d.text, bbox: { x0, y0, x1, y1 } }
  })

  return tagCoconutWords(words)
}
