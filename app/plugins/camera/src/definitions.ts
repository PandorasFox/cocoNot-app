export interface CameraPlugin {
  start(): Promise<void>
  stop(): Promise<void>
  capture(options: { quality: number }): Promise<{ base64: string }>
}
