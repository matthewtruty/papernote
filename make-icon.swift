#!/usr/bin/swift
import AppKit
import CoreGraphics

let size = 1024
let s = CGFloat(size)

func makeIcon(size: Int) -> NSImage {
    let s = CGFloat(size)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()

    guard let ctx = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        return image
    }

    // Background — warm off-white paper
    let radius = s * 0.18
    let paperInset = s * 0.10
    let paperRect = CGRect(x: paperInset, y: paperInset,
                           width: s - paperInset * 2, height: s - paperInset * 2)
    let foldSize = s * 0.18

    // Shadow
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.025),
                  blur: s * 0.08,
                  color: CGColor(gray: 0, alpha: 0.22))

    // Paper path (with top-right fold cut out)
    let path = CGMutablePath()
    path.move(to: CGPoint(x: paperRect.minX + radius, y: paperRect.minY))
    path.addArc(center: CGPoint(x: paperRect.minX + radius, y: paperRect.minY + radius),
                radius: radius, startAngle: -.pi / 2, endAngle: .pi, clockwise: true)
    path.addLine(to: CGPoint(x: paperRect.minX, y: paperRect.maxY - radius))
    path.addArc(center: CGPoint(x: paperRect.minX + radius, y: paperRect.maxY - radius),
                radius: radius, startAngle: .pi, endAngle: .pi / 2, clockwise: true)
    path.addLine(to: CGPoint(x: paperRect.maxX - foldSize, y: paperRect.maxY))
    path.addLine(to: CGPoint(x: paperRect.maxX, y: paperRect.maxY - foldSize))
    path.addLine(to: CGPoint(x: paperRect.maxX, y: paperRect.minY + radius))
    path.addArc(center: CGPoint(x: paperRect.maxX - radius, y: paperRect.minY + radius),
                radius: radius, startAngle: 0, endAngle: -.pi / 2, clockwise: true)
    path.closeSubpath()

    ctx.addPath(path)
    ctx.setFillColor(CGColor(red: 0.99, green: 0.98, blue: 0.96, alpha: 1))
    ctx.fillPath()
    ctx.setShadow(offset: .zero, blur: 0, color: nil)

    // Fold triangle
    let foldPath = CGMutablePath()
    foldPath.move(to: CGPoint(x: paperRect.maxX - foldSize, y: paperRect.maxY))
    foldPath.addLine(to: CGPoint(x: paperRect.maxX, y: paperRect.maxY - foldSize))
    foldPath.addLine(to: CGPoint(x: paperRect.maxX - foldSize, y: paperRect.maxY - foldSize))
    foldPath.closeSubpath()

    ctx.setShadow(offset: CGSize(width: -s * 0.01, height: -s * 0.01),
                  blur: s * 0.03, color: CGColor(gray: 0, alpha: 0.15))
    ctx.addPath(foldPath)
    ctx.setFillColor(CGColor(red: 0.88, green: 0.86, blue: 0.82, alpha: 1))
    ctx.fillPath()
    ctx.setShadow(offset: .zero, blur: 0, color: nil)

    // Ruled lines
    let lineColor = CGColor(red: 0.78, green: 0.82, blue: 0.90, alpha: 0.7)
    let lineLeft = paperRect.minX + s * 0.10
    let lineRight = paperRect.maxX - s * 0.10
    let lineStartY = paperRect.minY + s * 0.16
    let lineSpacing = s * 0.09
    let lineCount = 5

    ctx.setStrokeColor(lineColor)
    ctx.setLineWidth(s * 0.012)
    ctx.setLineCap(.round)

    for i in 0..<lineCount {
        let y = lineStartY + CGFloat(i) * lineSpacing
        let rightEdge = (i == 0) ? lineRight - foldSize * 0.5 : lineRight
        ctx.move(to: CGPoint(x: lineLeft, y: y))
        ctx.addLine(to: CGPoint(x: rightEdge, y: y))
    }
    ctx.strokePath()

    image.unlockFocus()
    return image
}

let sizes = [16, 32, 64, 128, 256, 512, 1024]
let iconsetDir = "/tmp/AppIcon.iconset"
try? FileManager.default.createDirectory(atPath: iconsetDir,
                                         withIntermediateDirectories: true)

for sz in sizes {
    let img = makeIcon(size: sz)
    let names = sz == 16  ? ["icon_16x16"]         :
                sz == 32  ? ["icon_16x16@2x", "icon_32x32"] :
                sz == 64  ? ["icon_32x32@2x"]      :
                sz == 128 ? ["icon_128x128"]        :
                sz == 256 ? ["icon_128x128@2x", "icon_256x256"] :
                sz == 512 ? ["icon_256x256@2x", "icon_512x512"] :
                            ["icon_512x512@2x"]

    for name in names {
        let path = "\(iconsetDir)/\(name).png"
        guard let tiff = img.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else { continue }
        try? png.write(to: URL(fileURLWithPath: path))
        print("wrote \(path)")
    }
}
print("Done")
