import AppKit
import Foundation
import Testing
@testable import Papernote

@Suite struct NoteStorageTests {
    @Test func roundTripsPlainText() throws {
        let storageURL = makeStorageURL()
        let storage = NoteStorage(url: storageURL)
        defer { try? FileManager.default.removeItem(at: storageURL) }

        try storage.save(NSAttributedString(string: "A quiet note."))

        let loadedNote = try #require(try storage.load())
        #expect(loadedNote.string == "A quiet note.")
    }

    @Test func roundTripsImageAttachment() throws {
        let storageURL = makeStorageURL()
        let storage = NoteStorage(url: storageURL)
        defer { try? FileManager.default.removeItem(at: storageURL) }

        let note = NSMutableAttributedString(string: "Inline image\n")
        let attachment = NSTextAttachment()
        attachment.image = makeImage()
        note.append(NSAttributedString(attachment: attachment))

        try storage.save(note)

        let loadedNote = try #require(try storage.load())
        var foundAttachment = false
        loadedNote.enumerateAttribute(.attachment, in: NSRange(location: 0, length: loadedNote.length)) { value, _, stop in
            if value != nil {
                foundAttachment = true
                stop.pointee = true
            }
        }

        #expect(foundAttachment)
    }

    @Test func normalizesFontSizeWhileKeepingBoldTrait() throws {
        let note = NSMutableAttributedString(string: "Bold")
        let boldFont = NSFont.systemFont(ofSize: 28, weight: .bold)
        note.addAttribute(.font, value: boldFont, range: NSRange(location: 0, length: note.length))

        let normalized = NoteTypography.normalized(note)
        let normalizedFont = try #require(normalized.attribute(.font, at: 0, effectiveRange: nil) as? NSFont)

        #expect(normalizedFont.pointSize == NoteTypography.bodyFontSize)
        #expect(normalizedFont.fontDescriptor.symbolicTraits.contains(NSFontDescriptor.SymbolicTraits.bold))
    }

    @Test func filesAndListsLocalNotes() throws {
        let libraryURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let library = NoteLibrary(baseURL: libraryURL)
        defer { try? FileManager.default.removeItem(at: libraryURL) }

        let summary = try library.file(NSAttributedString(string: "Filed away"), titled: "Project ideas")
        let loadedNote = try #require(try library.load(summary))
        let listedNotes = try library.listFiledNotes()

        #expect(loadedNote.string == "Filed away")
        #expect(listedNotes.count == 1)
        #expect(listedNotes.first?.title == "Project ideas")
    }

    @Test func deletesFiledNotes() throws {
        let libraryURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let library = NoteLibrary(baseURL: libraryURL)
        defer { try? FileManager.default.removeItem(at: libraryURL) }

        let summary = try library.file(NSAttributedString(string: "Trash me"), titled: "Old note")
        try library.delete(summary)

        let listedNotes = try library.listFiledNotes()
        let loadedNote = try library.load(summary)

        #expect(listedNotes.isEmpty)
        #expect(loadedNote == nil)
    }

    @Test func detectsPastedLinks() throws {
        let note = NSAttributedString(string: "https://example.com")
        let normalized = NoteLinkDetector.normalized(note)
        let link = try #require(normalized.attribute(.link, at: 0, effectiveRange: nil) as? URL)

        #expect(link.absoluteString == "https://example.com")
    }

    @Test func resizesImagesProportionally() {
        let resized = NoteImageAttachment.resizedSize(
            for: NSSize(width: 400, height: 200),
            scale: 0.5,
            maximumWidth: 500
        )

        #expect(resized.width == 200)
        #expect(resized.height == 100)
    }

    @Test func computesTargetWidthFromCornerDrag() {
        let targetWidth = NoteImageAttachment.targetWidth(
            for: NSSize(width: 200, height: 100),
            dragTranslation: CGSize(width: -40, height: 20),
            corner: .topLeft,
            maximumWidth: 500
        )

        #expect(targetWidth == 240)
    }

    private func makeStorageURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent("Scratchpad.rtfd", isDirectory: true)
    }

    private func makeImage() -> NSImage {
        let size = NSSize(width: 24, height: 24)
        let image = NSImage(size: size)
        image.lockFocus()
        NSColor.systemBlue.setFill()
        NSBezierPath(roundedRect: NSRect(origin: .zero, size: size), xRadius: 6, yRadius: 6).fill()
        image.unlockFocus()
        return image
    }
}
