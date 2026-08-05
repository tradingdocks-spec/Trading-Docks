import ExpoModulesCore
import UIKit
import Vision

public class TradingDocksVisionOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TradingDocksVisionOcr")

    AsyncFunction("getDiagnostics") { () -> [String: Any] in
      return [
        "moduleLinked": true,
        "runtimeModuleName": "TradingDocksVisionOcr",
        "nativeModuleVersion": "0.1.1",
        "platform": "ios"
      ]
    }

    AsyncFunction("recognizeText") { (request: [String: Any], promise: Promise) in
      let started = Date()
      if #available(iOS 13.0, *) {
        self.recognizeText(request: request, started: started, promise: promise)
      } else {
        promise.resolve(self.errorResult(
          code: "vision_unavailable",
          message: "Apple Vision text recognition requires iOS 13 or newer.",
          started: started,
          warnings: []
        ))
      }
    }
  }

  @available(iOS 13.0, *)
  private func recognizeText(request: [String: Any], started: Date, promise: Promise) {
    guard let imageUri = request["imageUri"] as? String,
          imageUri.starts(with: "file://"),
          let imageUrl = URL(string: imageUri),
          let image = UIImage(contentsOfFile: imageUrl.path),
          let cgImage = image.cgImage else {
      promise.resolve(errorResult(
        code: "image_load_failed",
        message: "Apple Vision OCR could not load the local captured image.",
        started: started,
        warnings: []
      ))
      return
    }

    let languages = request["languages"] as? [String] ?? ["en-US"]
    let level = request["recognitionLevel"] as? String ?? "accurate"
    let regions = request["regions"] as? [[String: Any]] ?? []
    if regions.isEmpty {
      promise.resolve(errorResult(
        code: "invalid_request",
        message: "At least one OCR region is required.",
        started: started,
        warnings: []
      ))
      return
    }

    let orientation = CGImagePropertyOrientation(image.imageOrientation)
    var observations: [[String: Any]] = []
    var fullText: [String] = []
    var warnings: [String] = []

    for region in regions {
      guard let regionId = region["id"] as? String,
            let regionType = region["regionType"] as? String,
            let x = region["x"] as? Double,
            let y = region["y"] as? Double,
            let width = region["width"] as? Double,
            let height = region["height"] as? Double,
            x >= 0,
            y >= 0,
            width > 0,
            height > 0,
            x + width <= 1,
            y + height <= 1 else {
        warnings.append("Skipped invalid OCR region.")
        continue
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = level == "fast" ? .fast : .accurate
      request.recognitionLanguages = languages
      request.usesLanguageCorrection = true
      request.regionOfInterest = CGRect(x: x, y: 1.0 - y - height, width: width, height: height)

      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      do {
        try handler.perform([request])
        let regionObservations = request.results ?? []
        for observation in regionObservations {
          guard let candidate = observation.topCandidates(1).first else {
            continue
          }
          let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
          if text.isEmpty {
            continue
          }
          fullText.append(text)
          observations.append([
            "id": "\(regionId):\(observations.count)",
            "requestedRegionId": regionId,
            "regionType": mapRegionType(regionType),
            "text": text,
            "rawText": text,
            "confidence": Int(max(0, min(100, round(candidate.confidence * 100)))),
            "bounds": [
              "x": observation.boundingBox.origin.x,
              "y": 1.0 - observation.boundingBox.origin.y - observation.boundingBox.height,
              "width": observation.boundingBox.width,
              "height": observation.boundingBox.height
            ]
          ])
        }
      } catch {
        promise.resolve(errorResult(
          code: "vision_failed",
          message: "Apple Vision OCR failed while processing a targeted region.",
          started: started,
          warnings: warnings
        ))
        return
      }
    }

    if observations.isEmpty {
      promise.resolve([
        "ok": false,
        "provider": "apple_vision",
        "code": "empty_result",
        "message": "Apple Vision OCR did not return readable text for the requested regions.",
        "latencyMs": latencyMs(started),
        "warnings": warnings
      ])
      return
    }

    promise.resolve([
      "ok": true,
      "provider": "apple_vision",
      "fullText": fullText.joined(separator: "\n"),
      "observations": observations,
      "latencyMs": latencyMs(started),
      "orientationUsed": "\(orientation.rawValue)",
      "warnings": warnings
    ])
  }

  private func mapRegionType(_ regionType: String) -> String {
    switch regionType {
    case "title":
      return "name"
    case "bottom_left", "bottom_right":
      return "collector_info"
    default:
      return regionType
    }
  }

  private func errorResult(code: String, message: String, started: Date, warnings: [String]) -> [String: Any] {
    return [
      "ok": false,
      "provider": "apple_vision",
      "code": code,
      "message": message,
      "latencyMs": latencyMs(started),
      "warnings": warnings
    ]
  }

  private func latencyMs(_ started: Date) -> Int {
    return max(0, Int(Date().timeIntervalSince(started) * 1000))
  }
}

private extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up:
      self = .up
    case .upMirrored:
      self = .upMirrored
    case .down:
      self = .down
    case .downMirrored:
      self = .downMirrored
    case .left:
      self = .left
    case .leftMirrored:
      self = .leftMirrored
    case .right:
      self = .right
    case .rightMirrored:
      self = .rightMirrored
    @unknown default:
      self = .up
    }
  }
}
