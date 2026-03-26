// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ScanResult } from './scan-engine'

// Mock the native bridges
vi.mock('./camera-bridge', () => ({
  startCamera: vi.fn().mockResolvedValue(undefined),
  stopCamera: vi.fn().mockResolvedValue(undefined),
  captureFrame: vi.fn().mockResolvedValue('base64data'),
}))

vi.mock('./ocr-bridge', () => ({
  scanFrame: vi.fn().mockResolvedValue({ ocrHits: [], barcodes: [] }),
}))

import { ScanEngine } from './scan-engine'
import { startCamera, stopCamera, captureFrame } from './camera-bridge'
import { scanFrame } from './ocr-bridge'

const mockStartCamera = vi.mocked(startCamera)
const mockStopCamera = vi.mocked(stopCamera)
const mockCaptureFrame = vi.mocked(captureFrame)
const mockScanFrame = vi.mocked(scanFrame)

describe('ScanEngine', () => {
  let results: ScanResult[]
  let errors: Error[]
  let engine: ScanEngine

  beforeEach(() => {
    vi.clearAllMocks()
    results = []
    errors = []

    // Make captureFrame resolve once then hang (so the loop doesn't spin forever)
    let callCount = 0
    mockCaptureFrame.mockImplementation(async () => {
      callCount++
      if (callCount > 1) {
        // Hang forever on subsequent calls so the loop pauses
        return new Promise(() => {})
      }
      return 'base64data'
    })

    mockScanFrame.mockResolvedValue({
      ocrHits: [{ text: 'coconut', x: 0.1, y: 0.2, w: 0.05, h: 0.03, isCoconut: true }],
      barcodes: [],
    })

    engine = new ScanEngine({
      cooldown: 0,
      onResult: (r) => results.push(r),
      onError: (e) => errors.push(e),
    })
  })

  afterEach(() => {
    engine.stop()
  })

  it('starts the camera and runs the scan loop', async () => {
    await engine.start()

    // Wait for first loop iteration
    await vi.waitFor(() => expect(results.length).toBeGreaterThan(0))

    expect(mockStartCamera).toHaveBeenCalledOnce()
    expect(mockCaptureFrame).toHaveBeenCalled()
    expect(mockScanFrame).toHaveBeenCalled()
    expect(engine.running).toBe(true)
  })

  it('emits scan results with screen dimensions and timing', async () => {
    await engine.start()
    await vi.waitFor(() => expect(results.length).toBeGreaterThan(0))

    const result = results[0]
    expect(result.ocrHits).toHaveLength(1)
    expect(result.ocrHits[0].text).toBe('coconut')
    expect(result.screenW).toBe(window.innerWidth)
    expect(result.screenH).toBe(window.innerHeight)
    expect(result.scanTimeMs).toBeTypeOf('number')
  })

  it('stop() kills the loop and stops the camera', async () => {
    await engine.start()
    await vi.waitFor(() => expect(results.length).toBeGreaterThan(0))

    engine.stop()

    expect(engine.running).toBe(false)
    expect(mockStopCamera).toHaveBeenCalled()
  })

  it('emits errors when captureFrame fails', async () => {
    mockCaptureFrame.mockRejectedValueOnce(new Error('camera unavailable'))

    await engine.start()
    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0))

    expect(errors[0].message).toBe('camera unavailable')
  })

  it('emits errors when scanFrame fails', async () => {
    mockScanFrame.mockRejectedValueOnce(new Error('OCR failed'))

    await engine.start()
    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0))

    expect(errors[0].message).toBe('OCR failed')
  })

  it('reports start failure via thrown error', async () => {
    mockStartCamera.mockRejectedValueOnce(new Error('permission denied'))

    await expect(engine.start()).rejects.toThrow('permission denied')
    expect(engine.running).toBe(false)
  })

  describe('visibility changes (suspend/resume)', () => {
    it('stops camera when app goes to background', async () => {
      await engine.start()
      await vi.waitFor(() => expect(results.length).toBeGreaterThan(0))

      mockStopCamera.mockClear()

      // Simulate going to background
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))

      // Give the async pause a tick
      await new Promise(r => setTimeout(r, 0))

      expect(mockStopCamera).toHaveBeenCalled()
      expect(engine.running).toBe(false)
    })

    it('restarts camera when app comes back to foreground', async () => {
      await engine.start()
      await vi.waitFor(() => expect(results.length).toBeGreaterThan(0))

      // Background
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise(r => setTimeout(r, 0))

      mockStartCamera.mockClear()
      mockCaptureFrame.mockResolvedValueOnce('base64resumed')

      // Foreground
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise(r => setTimeout(r, 0))

      expect(mockStartCamera).toHaveBeenCalled()
    })

    it('does not restart if engine was stopped while backgrounded', async () => {
      await engine.start()
      await vi.waitFor(() => expect(results.length).toBeGreaterThan(0))

      // Background
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise(r => setTimeout(r, 0))

      // User stops the engine while backgrounded
      engine.stop()
      mockStartCamera.mockClear()

      // Foreground — should NOT restart
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise(r => setTimeout(r, 0))

      expect(mockStartCamera).not.toHaveBeenCalled()
    })

    it('cleans up visibilitychange listener on stop', async () => {
      const spy = vi.spyOn(document, 'removeEventListener')
      await engine.start()

      engine.stop()

      expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      spy.mockRestore()
    })
  })
})
