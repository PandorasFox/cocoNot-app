import Capacitor
import Vision

@objc(OcrPlugin)
public class OcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OcrPlugin"
    public let jsName = "Ocr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.reject("Invalid base64 image")
            return
        }

        // Center-crop to viewport aspect ratio
        let vpW = call.getInt("viewportWidth") ?? 0
        let vpH = call.getInt("viewportHeight") ?? 0
        let inputImage = centerCropToAspect(cgImage, targetW: vpW, targetH: vpH)

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("Vision error: \(error.localizedDescription)")
                return
            }

            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve(["words": []])
                return
            }

            var words: [[String: Any]] = []

            for observation in observations {
                guard let candidate = observation.topCandidates(1).first else { continue }
                let fullText = candidate.string
                let tokens = fullText.split(separator: " ")
                var searchStart = fullText.startIndex

                for token in tokens {
                    guard let range = fullText.range(of: String(token), range: searchStart..<fullText.endIndex),
                          let box = try? candidate.boundingBox(for: range) else {
                        continue
                    }
                    searchStart = range.upperBound

                    let rect = box.boundingBox
                    // Vision: normalized, bottom-left origin → top-left origin
                    words.append([
                        "text": String(token),
                        "x": rect.origin.x,
                        "y": 1.0 - rect.origin.y - rect.height,
                        "w": rect.width,
                        "h": rect.height
                    ])
                }
            }

            call.resolve(["words": words])
        }

        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false

        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(cgImage: inputImage, options: [:])
            try? handler.perform([request])
        }
    }

    /// Center-crop a CGImage to match the target aspect ratio.
    private func centerCropToAspect(_ src: CGImage, targetW: Int, targetH: Int) -> CGImage {
        guard targetW > 0, targetH > 0 else { return src }

        let srcW = src.width
        let srcH = src.height
        let srcAspect = Double(srcW) / Double(srcH)
        let targetAspect = Double(targetW) / Double(targetH)

        let cropW: Int
        let cropH: Int
        let cropX: Int
        let cropY: Int

        if srcAspect > targetAspect {
            // Frame wider than viewport — crop horizontally
            cropH = srcH
            cropW = Int(Double(srcH) * targetAspect)
            cropX = (srcW - cropW) / 2
            cropY = 0
        } else {
            // Frame taller than viewport — crop vertically
            cropW = srcW
            cropH = Int(Double(srcW) / targetAspect)
            cropX = 0
            cropY = (srcH - cropH) / 2
        }

        if cropW == srcW && cropH == srcH { return src }

        let rect = CGRect(x: cropX, y: cropY, width: cropW, height: cropH)
        return src.cropping(to: rect) ?? src
    }
}
