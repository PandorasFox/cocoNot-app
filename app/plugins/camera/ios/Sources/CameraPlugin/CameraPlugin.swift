import Capacitor
import AVFoundation
import UIKit

@objc(CameraPlugin)
public class CameraPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureVideoDataOutputSampleBufferDelegate {
    public let identifier = "CameraPlugin"
    public let jsName = "Camera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "capture", returnType: CAPPluginReturnPromise)
    ]

    private var session: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var dataOutput: AVCaptureVideoDataOutput?
    private let sessionQueue = DispatchQueue(label: "com.coconot.camera.session")
    private let outputQueue = DispatchQueue(label: "com.coconot.camera.output")
    private var pendingCapture: CAPPluginCall?
    private var captureQuality: CGFloat = 0.6

    @objc func start(_ call: CAPPluginCall) {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            if !granted {
                call.reject("Camera permission denied")
                return
            }
            self.sessionQueue.async {
                self.startSession(call)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        sessionQueue.async {
            self.session?.stopRunning()
            self.session = nil
            self.dataOutput = nil

            DispatchQueue.main.async {
                self.previewLayer?.removeFromSuperlayer()
                self.previewLayer = nil
                call.resolve()
            }
        }
    }

    @objc func capture(_ call: CAPPluginCall) {
        guard session?.isRunning == true else {
            call.reject("Camera not started")
            return
        }
        captureQuality = CGFloat(call.getInt("quality") ?? 60) / 100.0
        pendingCapture = call
    }

    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

    public func captureOutput(_ output: AVCaptureOutput,
                              didOutput sampleBuffer: CMSampleBuffer,
                              from connection: AVCaptureConnection) {
        guard let call = pendingCapture else { return }
        pendingCapture = nil

        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            call.reject("Failed to get image buffer")
            return
        }

        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            call.reject("Failed to create image")
            return
        }

        let uiImage = UIImage(cgImage: cgImage)
        guard let jpegData = uiImage.jpegData(compressionQuality: captureQuality) else {
            call.reject("JPEG compression failed")
            return
        }

        let base64 = jpegData.base64EncodedString()
        call.resolve(["base64": base64])
    }

    // MARK: - Private

    private func startSession(_ call: CAPPluginCall) {
        let session = AVCaptureSession()
        session.sessionPreset = .high

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device) else {
            call.reject("No rear camera available")
            return
        }

        if session.canAddInput(input) { session.addInput(input) }

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: outputQueue)

        if session.canAddOutput(output) { session.addOutput(output) }

        session.startRunning()
        self.session = session
        self.dataOutput = output

        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("No WebView found")
                return
            }

            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = webView.bounds

            webView.superview?.layer.insertSublayer(layer, at: 0)
            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.backgroundColor = .clear

            self.previewLayer = layer
            call.resolve()
        }
    }
}
