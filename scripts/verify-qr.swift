import AppKit
import Vision
import Foundation

// 使用 macOS 原生二维码识别器独立验证导出码，不依赖游戏自己的编码逻辑。
for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    let handler = VNImageRequestHandler(url: url)
    do {
        try handler.perform([request])
        let values = (request.results ?? []).compactMap { $0.payloadStringValue }
        if values.isEmpty { fputs("二维码无法解码：\(path)\n", stderr); exit(1) }
        print("解码成功：\(path) → \(values.joined(separator: ", "))")
    } catch {
        fputs("二维码验证失败：\(error)\n", stderr)
        exit(1)
    }
}
