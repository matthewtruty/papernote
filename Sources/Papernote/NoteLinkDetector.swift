import Foundation

enum NoteLinkDetector {
    private static let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)

    static func normalized(_ note: NSAttributedString) -> NSAttributedString {
        guard note.length > 0, let detector else {
            return note
        }

        let normalizedNote = NSMutableAttributedString(attributedString: note)
        let fullRange = NSRange(location: 0, length: normalizedNote.length)
        normalizedNote.removeAttribute(.link, range: fullRange)

        detector.enumerateMatches(in: normalizedNote.string, options: [], range: fullRange) { result, _, _ in
            guard let result, let url = result.url else {
                return
            }

            normalizedNote.addAttribute(.link, value: url, range: result.range)
        }

        return normalizedNote
    }
}
