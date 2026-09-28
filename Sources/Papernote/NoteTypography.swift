import AppKit
import Foundation

enum NoteTypography {
    static let bodyFontSize: CGFloat = 19
    static let placeholderFontSize: CGFloat = 15

    static func defaultFont() -> NSFont {
        .systemFont(ofSize: bodyFontSize, weight: .regular)
    }

    static func normalized(_ note: NSAttributedString) -> NSAttributedString {
        let normalizedNote = NSMutableAttributedString(attributedString: note)
        let fullRange = NSRange(location: 0, length: normalizedNote.length)

        normalizedNote.enumerateAttributes(in: fullRange) { attributes, range, _ in
            if attributes[.attachment] != nil {
                return
            }

            let resizedFont: NSFont
            if let font = attributes[.font] as? NSFont,
               let descriptor = font.fontDescriptor.withSize(bodyFontSize) as NSFontDescriptor?,
               let adjustedFont = NSFont(descriptor: descriptor, size: bodyFontSize) {
                resizedFont = adjustedFont
            } else {
                resizedFont = defaultFont()
            }

            normalizedNote.addAttribute(.font, value: resizedFont, range: range)
        }

        return normalizedNote
    }
}
