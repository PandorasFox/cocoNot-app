import { WebPlugin } from '@capacitor/core'
import type { OcrPlugin } from './definitions'

export class OcrWeb extends WebPlugin implements OcrPlugin {
  async recognizeText(): Promise<{ words: [] }> {
    throw new Error('OCR is not available in the browser')
  }
}
