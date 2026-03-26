import { Camera } from 'coconot-camera'

/** Start the rear camera behind the WebView. */
export async function startCamera(): Promise<void> {
  await Camera.start()
}

/** Stop the camera preview. */
export async function stopCamera(): Promise<void> {
  await Camera.stop()
}

/** Grab a preview frame as base64 JPEG. */
export async function captureFrame(): Promise<string> {
  const result = await Camera.capture({ quality: 60 })
  return result.base64
}
