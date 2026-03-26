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

        var words: [[String: Any]] = []
        var barcodes: [[String: Any]] = []

        // Text recognition request
        let textRequest = VNRecognizeTextRequest { request, _ in
            guard let observations = request.results as? [VNRecognizedTextObservation] else { return }

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
        }
        textRequest.recognitionLevel = .accurate
        textRequest.usesLanguageCorrection = false

        // Barcode detection request
        let barcodeRequest = VNDetectBarcodesRequest { request, _ in
            guard let observations = request.results as? [VNBarcodeObservation] else { return }

            for observation in observations {
                guard let payload = observation.payloadStringValue else { continue }
                let rect = observation.boundingBox
                barcodes.append([
                    "value": payload,
                    "format": self.formatName(observation.symbology),
                    "x": rect.origin.x,
                    "y": 1.0 - rect.origin.y - rect.height,
                    "w": rect.width,
                    "h": rect.height
                ])
            }
        }

        // Run both requests in parallel on the same image
        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(cgImage: inputImage, options: [:])
            try? handler.perform([textRequest, barcodeRequest])

            call.resolve([
                "words": words,
                "barcodes": barcodes
            ])
        }
    }

    private func formatName(_ symbology: VNBarcodeSymbology) -> String {
        switch symbology {
        case .code128: return "CODE_128"
        case .code39: return "CODE_39"
        case .code93: return "CODE_93"
        case .codabar: return "CODABAR"
        case .ean13: return "EAN_13"
        case .ean8: return "EAN_8"
        case .itf14: return "ITF"
        case .upce: return "UPC_E"
        case .qr: return "QR_CODE"
        case .dataMatrix: return "DATA_MATRIX"
        case .aztec: return "AZTEC"
        case .pdf417: return "PDF417"
        default: return "UNKNOWN"
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
            cropH = srcH
            cropW = Int(Double(srcH) * targetAspect)
            cropX = (srcW - cropW) / 2
            cropY = 0
        } else {
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
