import ExpoModulesCore
import UIKit
import Vision

public class TradingDocksVisionOcrModule: Module {
  private let liveOcrQueue = DispatchQueue(label: "com.tradingdocks.visionocr.live-title", qos: .userInitiated)

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

    AsyncFunction("recognizeFrameTitle") { (request: [String: Any], promise: Promise) in
      let started = Date()
      if #available(iOS 13.0, *) {
        self.liveOcrQueue.async {
          self.recognizeFrameTitle(request: request, started: started, promise: promise)
        }
      } else {
        promise.resolve(self.liveTitleErrorResult(
          frameId: request["frameId"] as? String ?? "unknown-frame",
          code: "vision_unavailable",
          message: "Apple Vision live title OCR requires iOS 13 or newer.",
          started: started,
          warnings: []
        ))
      }
    }

    AsyncFunction("analyzeRecognitionImage") { (request: [String: Any], promise: Promise) in
      let started = Date()
      self.analyzeRecognitionImage(request: request, started: started, promise: promise)
    }

    AsyncFunction("generateFeaturePrint") { (request: [String: Any], promise: Promise) in
      let started = Date()
      if #available(iOS 13.0, *) {
        self.generateFeaturePrint(request: request, started: started, promise: promise)
      } else {
        promise.resolve(self.imageAnalysisErrorResult(
          provider: "apple_vision_feature_print",
          code: "vision_unavailable",
          message: "Apple Vision feature prints require iOS 13 or newer.",
          started: started,
          warnings: []
        ))
      }
    }

    AsyncFunction("compareFeaturePrints") { (request: [String: Any], promise: Promise) in
      let started = Date()
      if #available(iOS 13.0, *) {
        self.compareFeaturePrints(request: request, started: started, promise: promise)
      } else {
        promise.resolve(self.featurePrintDistanceErrorResult(
          code: "vision_unavailable",
          message: "Apple Vision feature print comparison requires iOS 13 or newer.",
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

  @available(iOS 13.0, *)
  private func recognizeFrameTitle(request: [String: Any], started: Date, promise: Promise) {
    let frameId = request["frameId"] as? String ?? "unknown-frame"
    guard let width = request["width"] as? Int,
          let height = request["height"] as? Int,
          width > 0,
          height > 0,
          let pixels = request["pixels"] as? [Int],
          pixels.count == width * height,
          let roi = request["roi"] as? [String: Any],
          let x = roi["x"] as? Double,
          let y = roi["y"] as? Double,
          let roiWidth = roi["width"] as? Double,
          let roiHeight = roi["height"] as? Double,
          x >= 0,
          y >= 0,
          roiWidth > 0,
          roiHeight > 0,
          x + roiWidth <= 1,
          y + roiHeight <= 1 else {
      promise.resolve(liveTitleErrorResult(
        frameId: frameId,
        code: "invalid_request",
        message: "Live title OCR requires normalized ROI and a bounded luma frame.",
        started: started,
        warnings: []
      ))
      return
    }

    guard let cgImage = makeLumaImage(width: width, height: height, pixels: pixels) else {
      promise.resolve(liveTitleErrorResult(
        frameId: frameId,
        code: "invalid_request",
        message: "Live title OCR could not prepare the luma frame.",
        started: started,
        warnings: []
      ))
      return
    }

    let languages = request["languages"] as? [String] ?? ["en-US"]
    let level = request["recognitionLevel"] as? String ?? "fast"
    let visionRequest = VNRecognizeTextRequest()
    visionRequest.recognitionLevel = level == "accurate" ? .accurate : .fast
    visionRequest.recognitionLanguages = languages
    visionRequest.usesLanguageCorrection = true
    visionRequest.regionOfInterest = CGRect(x: x, y: 1.0 - y - roiHeight, width: roiWidth, height: roiHeight)

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
    do {
      try handler.perform([visionRequest])
      let candidates = (visionRequest.results ?? [])
        .compactMap { observation -> (String, Float)? in
          guard let candidate = observation.topCandidates(1).first else {
            return nil
          }
          let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
          return text.isEmpty ? nil : (text, candidate.confidence)
        }
      guard let best = candidates.sorted(by: { $0.1 > $1.1 }).first else {
        promise.resolve([
          "ok": false,
          "provider": "apple_vision",
          "frameId": frameId,
          "code": "empty_result",
          "message": "Apple Vision OCR did not return readable title text for the live frame.",
          "durationMs": latencyMs(started),
          "warnings": []
        ])
        return
      }
      promise.resolve([
        "ok": true,
        "provider": "apple_vision",
        "frameId": frameId,
        "text": best.0,
        "confidence": Int(max(0, min(100, round(best.1 * 100)))),
        "durationMs": latencyMs(started),
        "roi": [
          "x": x,
          "y": y,
          "width": roiWidth,
          "height": roiHeight
        ],
        "warnings": []
      ])
    } catch {
      promise.resolve(liveTitleErrorResult(
        frameId: frameId,
        code: "vision_failed",
        message: "Apple Vision live title OCR failed while processing the ROI.",
        started: started,
        warnings: []
      ))
    }
  }

  private func analyzeRecognitionImage(request: [String: Any], started: Date, promise: Promise) {
    guard let loaded = loadLocalImage(request: request) else {
      promise.resolve(imageAnalysisErrorResult(
        provider: "apple_vision",
        code: "image_load_failed",
        message: "Apple Vision could not load the local recognition image.",
        started: started,
        warnings: []
      ))
      return
    }
    let metrics = imageMetrics(image: loaded.image)
    promise.resolve([
      "ok": true,
      "provider": "apple_vision",
      "imageUri": loaded.imageUri,
      "width": Int(loaded.image.size.width * loaded.image.scale),
      "height": Int(loaded.image.size.height * loaded.image.scale),
      "lumaHash": metrics.lumaHash,
      "sharpness": metrics.sharpness,
      "exposure": metrics.exposure,
      "durationMs": latencyMs(started),
      "warnings": []
    ])
  }

  @available(iOS 13.0, *)
  private func generateFeaturePrint(request: [String: Any], started: Date, promise: Promise) {
    guard let loaded = loadLocalImage(request: request),
          let cgImage = loaded.image.cgImage else {
      promise.resolve(imageAnalysisErrorResult(
        provider: "apple_vision_feature_print",
        code: "image_load_failed",
        message: "Apple Vision could not load the local image for feature-print generation.",
        started: started,
        warnings: []
      ))
      return
    }
    let featureRequest = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: CGImagePropertyOrientation(loaded.image.imageOrientation), options: [:])
    do {
      try handler.perform([featureRequest])
      guard let observation = featureRequest.results?.first as? VNFeaturePrintObservation else {
        promise.resolve(imageAnalysisErrorResult(
          provider: "apple_vision_feature_print",
          code: "vision_failed",
          message: "Apple Vision did not return a feature print.",
          started: started,
          warnings: []
        ))
        return
      }
      let data = try NSKeyedArchiver.archivedData(withRootObject: observation, requiringSecureCoding: true)
      promise.resolve([
        "ok": true,
        "provider": "apple_vision_feature_print",
        "imageUri": loaded.imageUri,
        "featurePrint": data.base64EncodedString(),
        "descriptorBytes": data.count,
        "durationMs": latencyMs(started),
        "warnings": []
      ])
    } catch {
      promise.resolve(imageAnalysisErrorResult(
        provider: "apple_vision_feature_print",
        code: "vision_failed",
        message: "Apple Vision failed while generating a feature print.",
        started: started,
        warnings: []
      ))
    }
  }

  @available(iOS 13.0, *)
  private func compareFeaturePrints(request: [String: Any], started: Date, promise: Promise) {
    guard let left = request["leftFeaturePrint"] as? String,
          let right = request["rightFeaturePrint"] as? String,
          let leftData = Data(base64Encoded: left),
          let rightData = Data(base64Encoded: right),
          let leftObservation = try? NSKeyedUnarchiver.unarchivedObject(ofClass: VNFeaturePrintObservation.self, from: leftData),
          let rightObservation = try? NSKeyedUnarchiver.unarchivedObject(ofClass: VNFeaturePrintObservation.self, from: rightData) else {
      promise.resolve(featurePrintDistanceErrorResult(
        code: "invalid_request",
        message: "Feature print comparison requires two valid encoded Apple Vision feature prints.",
        started: started,
        warnings: []
      ))
      return
    }
    do {
      var distance = Float(0)
      try leftObservation.computeDistance(&distance, to: rightObservation)
      promise.resolve([
        "ok": true,
        "provider": "apple_vision_feature_print",
        "distance": Double(distance),
        "durationMs": latencyMs(started),
        "warnings": []
      ])
    } catch {
      promise.resolve(featurePrintDistanceErrorResult(
        code: "vision_failed",
        message: "Apple Vision failed while comparing feature prints.",
        started: started,
        warnings: []
      ))
    }
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

  private func liveTitleErrorResult(frameId: String, code: String, message: String, started: Date, warnings: [String]) -> [String: Any] {
    return [
      "ok": false,
      "provider": "apple_vision",
      "frameId": frameId,
      "code": code,
      "message": message,
      "durationMs": latencyMs(started),
      "warnings": warnings
    ]
  }

  private func imageAnalysisErrorResult(provider: String, code: String, message: String, started: Date, warnings: [String]) -> [String: Any] {
    return [
      "ok": false,
      "provider": provider,
      "code": code,
      "message": message,
      "durationMs": latencyMs(started),
      "warnings": warnings
    ]
  }

  private func featurePrintDistanceErrorResult(code: String, message: String, started: Date, warnings: [String]) -> [String: Any] {
    return [
      "ok": false,
      "provider": "apple_vision_feature_print",
      "code": code,
      "message": message,
      "durationMs": latencyMs(started),
      "warnings": warnings
    ]
  }

  private func latencyMs(_ started: Date) -> Int {
    return max(0, Int(Date().timeIntervalSince(started) * 1000))
  }

  private func makeLumaImage(width: Int, height: Int, pixels: [Int]) -> CGImage? {
    let clamped = pixels.map { UInt8(max(0, min(255, $0))) }
    let data = Data(clamped)
    guard let provider = CGDataProvider(data: data as CFData),
          let colorSpace = CGColorSpace(name: CGColorSpace.linearGray) else {
      return nil
    }
    return CGImage(
      width: width,
      height: height,
      bitsPerComponent: 8,
      bitsPerPixel: 8,
      bytesPerRow: width,
      space: colorSpace,
      bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
      provider: provider,
      decode: nil,
      shouldInterpolate: false,
      intent: .defaultIntent
    )
  }

  private func loadLocalImage(request: [String: Any]) -> (imageUri: String, image: UIImage)? {
    guard let imageUri = request["imageUri"] as? String,
          imageUri.starts(with: "file://"),
          let imageUrl = URL(string: imageUri),
          let image = UIImage(contentsOfFile: imageUrl.path) else {
      return nil
    }
    return (imageUri, image)
  }

  private func imageMetrics(image: UIImage) -> (lumaHash: String, sharpness: Double, exposure: Double) {
    guard let cgImage = image.cgImage else {
      return ("0000000000000000", 0, 0)
    }
    let width = 8
    let height = 8
    var pixels = [UInt8](repeating: 0, count: width * height)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.linearGray),
          let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
          ) else {
      return ("0000000000000000", 0, 0)
    }
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    let mean = pixels.reduce(0) { $0 + Int($1) } / max(1, pixels.count)
    var bits = ""
    for pixel in pixels {
      bits += Int(pixel) >= mean ? "1" : "0"
    }
    let upper = UInt32(String(bits.prefix(32)), radix: 2) ?? 0
    let lower = UInt32(String(bits.suffix(32)), radix: 2) ?? 0
    let hash = String(format: "%08x%08x", upper, lower)
    return (hash, lumaSharpness(pixels: pixels, width: width, height: height), Double(mean) / 255.0)
  }

  private func lumaSharpness(pixels: [UInt8], width: Int, height: Int) -> Double {
    if width < 3 || height < 3 {
      return 0
    }
    var total = 0.0
    var count = 0.0
    for y in 1..<(height - 1) {
      for x in 1..<(width - 1) {
        let center = Double(pixels[y * width + x]) * 4.0
        let laplacian = abs(center
          - Double(pixels[y * width + x - 1])
          - Double(pixels[y * width + x + 1])
          - Double(pixels[(y - 1) * width + x])
          - Double(pixels[(y + 1) * width + x]))
        total += laplacian
        count += 1
      }
    }
    return min(1, max(0, (count > 0 ? total / count : 0) / 80.0))
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
