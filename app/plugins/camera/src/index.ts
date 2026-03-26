import { registerPlugin } from '@capacitor/core'
import type { CameraPlugin } from './definitions'

const Camera = registerPlugin<CameraPlugin>('Camera', {
  web: () => import('./web').then(m => new m.CameraWeb()),
})

export { Camera }
export type { CameraPlugin } from './definitions'
