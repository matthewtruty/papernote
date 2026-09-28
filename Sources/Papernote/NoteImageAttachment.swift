import AppKit
import Foundation

enum NoteImageAttachment {
    static let minimumWidth: CGFloat = 80
    static let defaultMaximumWidth: CGFloat = 720

    enum Corner: CaseIterable {
        case topLeft
        case topRight
        case bottomLeft
        case bottomRight

        var horizontalSign: CGFloat {
            switch self {
            case .topLeft, .bottomLeft:
                return -1
            case .topRight, .bottomRight:
                return 1
            }
        }

        var verticalSign: CGFloat {
            switch self {
            case .topLeft, .topRight:
                return 1
            case .bottomLeft, .bottomRight:
                return -1
            }
        }
    }

    struct Selection: Equatable {
        let range: NSRange
        let size: NSSize
    }

    static func makeAttachment(from image: NSImage, maximumWidth: CGFloat) -> NSTextAttachment {
        let attachment = NSTextAttachment()
        attachment.image = image
        attachment.bounds = CGRect(origin: .zero, size: fittedSize(for: image.size, maximumWidth: maximumWidth))
        return attachment
    }

    static func fittedSize(for size: NSSize, maximumWidth: CGFloat) -> NSSize {
        guard size.width > 0, size.height > 0 else {
            return NSSize(width: maximumWidth, height: maximumWidth * 0.75)
        }

        let clampedMaximumWidth = max(minimumWidth, maximumWidth)
        let targetWidth = min(size.width, clampedMaximumWidth)
        let scale = targetWidth / size.width

        return NSSize(width: targetWidth, height: size.height * scale)
    }

    static func resizedSize(for currentSize: NSSize, scale: CGFloat, maximumWidth: CGFloat) -> NSSize {
        guard currentSize.width > 0, currentSize.height > 0 else {
            return currentSize
        }

        let clampedMaximumWidth = max(minimumWidth, maximumWidth)
        let targetWidth = min(max(currentSize.width * scale, minimumWidth), clampedMaximumWidth)
        let aspectRatio = currentSize.height / currentSize.width

        return NSSize(width: targetWidth, height: targetWidth * aspectRatio)
    }

    static func resizedSize(for currentSize: NSSize, targetWidth: CGFloat, maximumWidth: CGFloat) -> NSSize {
        guard currentSize.width > 0, currentSize.height > 0 else {
            return currentSize
        }

        let clampedMaximumWidth = max(minimumWidth, maximumWidth)
        let resolvedWidth = min(max(targetWidth, minimumWidth), clampedMaximumWidth)
        let aspectRatio = currentSize.height / currentSize.width

        return NSSize(width: resolvedWidth, height: resolvedWidth * aspectRatio)
    }

    static func targetWidth(
        for currentSize: NSSize,
        dragTranslation: CGSize,
        corner: Corner,
        maximumWidth: CGFloat
    ) -> CGFloat {
        guard currentSize.width > 0, currentSize.height > 0 else {
            return minimumWidth
        }

        let aspectRatio = currentSize.height / currentSize.width
        let widthDeltaFromX = dragTranslation.width * corner.horizontalSign
        let widthDeltaFromY = aspectRatio > 0 ? (dragTranslation.height * corner.verticalSign) / aspectRatio : 0

        let widthDelta: CGFloat
        if abs(widthDeltaFromX) > abs(widthDeltaFromY) {
            widthDelta = widthDeltaFromX
        } else {
            widthDelta = widthDeltaFromY
        }

        return min(max(currentSize.width + widthDelta, minimumWidth), maximumWidth)
    }

    @MainActor
    static func selection(in textView: NSTextView) -> Selection? {
        let selectedRange = textView.selectedRange()
        let candidateLocations: [Int]

        if selectedRange.length == 1 {
            candidateLocations = [selectedRange.location]
        } else if selectedRange.length == 0, selectedRange.location > 0 {
            candidateLocations = [selectedRange.location - 1]
        } else {
            candidateLocations = []
        }

        for location in candidateLocations where location >= 0 && location < textView.attributedString().length {
            if let attachment = textView.textStorage?.attribute(.attachment, at: location, effectiveRange: nil) as? NSTextAttachment {
                return Selection(range: NSRange(location: location, length: 1), size: displaySize(for: attachment))
            }
        }

        return nil
    }

    static func displaySize(for attachment: NSTextAttachment) -> NSSize {
        if attachment.bounds.width > 0, attachment.bounds.height > 0 {
            return attachment.bounds.size
        }

        if let image = attachment.image {
            return image.size
        }

        return attachment.attachmentCell?.cellSize() ?? NSSize(width: minimumWidth, height: minimumWidth)
    }

    @MainActor
    static func frame(in textView: NSTextView, for range: NSRange) -> NSRect? {
        guard let layoutManager = textView.layoutManager,
              let textContainer = textView.textContainer,
              range.location >= 0,
              range.upperBound <= textView.attributedString().length else {
            return nil
        }

        let glyphRange = layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
        var frame = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
        let origin = textView.textContainerOrigin
        frame.origin.x += origin.x
        frame.origin.y += origin.y
        return frame
    }
}
