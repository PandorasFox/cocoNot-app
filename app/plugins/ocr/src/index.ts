import { registerPlugin } from '@capacitor/core'
import type { OcrPlugin } from './definitions'

const Ocr = registerPlugin<OcrPlugin>('Ocr', {
  web: () => import('./web').then(m => new m.OcrWeb()),
})

export { Ocr }
export type { OcrPlugin, OcrWord } from './definitions'
