import { WebPlugin } from '@capacitor/core'
import type { CameraPlugin } from './definitions'

export class CameraWeb extends WebPlugin implements CameraPlugin {
  async start(): Promise<void> {
    throw new Error('Camera preview is not available in the browser')
  }
  async stop(): Promise<void> {
    throw new Error('Camera preview is not available in the browser')
  }
  async capture(): Promise<{ base64: string }> {
    throw new Error('Camera preview is not available in the browser')
  }
}
