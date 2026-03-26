import { CameraPreview } from '@capacitor-community/camera-preview'

/** Start the rear camera behind the WebView. */
export async function startCamera(): Promise<void> {
  await CameraPreview.start({
    position: 'rear',
    toBack: true,
    storeToFile: false,
    enableHighResolution: false,
    width: window.screen.width,
    height: window.screen.height,
  })
}

/** Stop the camera preview. */
export async function stopCamera(): Promise<void> {
  await CameraPreview.stop()
}

/** Capture a single frame as a base64 JPEG string (no data URI prefix). */
export async function captureFrame(): Promise<string> {
  const result = await CameraPreview.capture({ quality: 80 })
  return result.value
}
