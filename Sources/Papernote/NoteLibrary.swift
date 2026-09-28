import AppKit
import Foundation

struct NoteLibrary {
    let baseURL: URL

    init(baseURL: URL = NoteStorage.appDirectory()) {
        self.baseURL = baseURL
    }

    func loadScratchpad() throws -> NSAttributedString? {
        try scratchpadStorage().load()
    }

    func saveScratchpad(_ note: NSAttributedString) throws {
        try scratchpadStorage().save(note)
    }

    func file(_ note: NSAttributedString, titled title: String) throws -> FiledNoteSummary {
        let now = Date()
        let summary = FiledNoteSummary(id: UUID(), title: title, createdAt: now, updatedAt: now)
        return try save(note, for: summary)
    }

    func save(_ note: NSAttributedString, for summary: FiledNoteSummary) throws -> FiledNoteSummary {
        var updatedSummary = summary
        updatedSummary.updatedAt = Date()

        try storage(for: updatedSummary).save(note)
        try saveMetadata(updatedSummary)

        return updatedSummary
    }

    func load(_ summary: FiledNoteSummary) throws -> NSAttributedString? {
        try storage(for: summary).load()
    }

    func delete(_ summary: FiledNoteSummary) throws {
        let noteURL = storage(for: summary).url
        let metadataURL = metadataURL(for: summary.id)

        if FileManager.default.fileExists(atPath: noteURL.path) {
            try FileManager.default.removeItem(at: noteURL)
        }

        if FileManager.default.fileExists(atPath: metadataURL.path) {
            try FileManager.default.removeItem(at: metadataURL)
        }
    }

    func listFiledNotes() throws -> [FiledNoteSummary] {
        guard FileManager.default.fileExists(atPath: metadataDirectoryURL.path) else {
            return []
        }

        return try FileManager.default.contentsOfDirectory(
            at: metadataDirectoryURL,
            includingPropertiesForKeys: nil
        )
        .filter { $0.pathExtension == "json" }
        .map { url in
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(FiledNoteSummary.self, from: data)
        }
        .sorted { lhs, rhs in
            if lhs.updatedAt == rhs.updatedAt {
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            }

            return lhs.updatedAt > rhs.updatedAt
        }
    }

    private func scratchpadStorage() -> NoteStorage {
        NoteStorage(url: baseURL.appendingPathComponent("Scratchpad.rtfd", isDirectory: true))
    }

    private func storage(for summary: FiledNoteSummary) -> NoteStorage {
        NoteStorage(url: filedNotesDirectoryURL.appendingPathComponent(summary.id.uuidString).appendingPathExtension("rtfd"))
    }

    private func saveMetadata(_ summary: FiledNoteSummary) throws {
        try FileManager.default.createDirectory(at: filedNotesDirectoryURL, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: metadataDirectoryURL, withIntermediateDirectories: true)

        let data = try JSONEncoder().encode(summary)
        try data.write(to: metadataURL(for: summary.id), options: .atomic)
    }

    private func metadataURL(for id: UUID) -> URL {
        metadataDirectoryURL.appendingPathComponent(id.uuidString).appendingPathExtension("json")
    }

    private var filedNotesDirectoryURL: URL {
        baseURL.appendingPathComponent("FiledNotes", isDirectory: true)
    }

    private var metadataDirectoryURL: URL {
        baseURL.appendingPathComponent("FiledMetadata", isDirectory: true)
    }
}
