import { CameraPreview } from '@capacitor-community/camera-preview'

/** Start the rear camera behind the WebView. */
export async function startCamera(): Promise<void> {
  await CameraPreview.start({
    position: 'rear',
    toBack: true,
    storeToFile: false,
    enableHighResolution: false,
    disableAudio: true,
    width: window.screen.width,
    height: window.screen.height,
  })
}

/** Stop the camera preview. */
export async function stopCamera(): Promise<void> {
  await CameraPreview.stop()
}

/** Grab a preview frame as base64 JPEG. Silent, no shutter, no autofocus. */
export async function captureFrame(): Promise<string> {
  const result = await CameraPreview.captureSample({ quality: 60 })
  return result.value
}
