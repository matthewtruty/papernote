import AppKit
import Foundation

struct NoteStorage {
    let url: URL

    init(url: URL = Self.defaultURL()) {
        self.url = url
    }

    func load() throws -> NSAttributedString? {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }

        return try NSAttributedString(
            url: url,
            options: [.documentType: NSAttributedString.DocumentType.rtfd],
            documentAttributes: nil
        )
    }

    func save(_ note: NSAttributedString) throws {
        let directoryURL = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)

        let wrapper = try note.fileWrapper(
            from: NSRange(location: 0, length: note.length),
            documentAttributes: [.documentType: NSAttributedString.DocumentType.rtfd]
        )

        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }

        try wrapper.write(to: url, options: .atomic, originalContentsURL: nil)
    }

    static func appDirectory() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Papernote", isDirectory: true)
    }

    private static func defaultURL() -> URL {
        appDirectory()
            .appendingPathComponent("Scratchpad.rtfd", isDirectory: true)
    }
}
