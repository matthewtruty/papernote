import AppKit
import Combine
import Foundation

@MainActor
final class NoteStore: ObservableObject {
    private enum Destination: Equatable {
        case scratchpad
        case filed(FiledNoteSummary)

        var title: String {
            switch self {
            case .scratchpad:
                return "Scratchpad"
            case .filed(let summary):
                return summary.title
            }
        }
    }

    enum SaveState {
        case idle
        case saving
        case saved
        case failed
    }

    @Published private(set) var note: NSAttributedString
    @Published private(set) var saveState: SaveState = .idle
    @Published private(set) var filedNotes: [FiledNoteSummary] = []

    private let library: NoteLibrary
    private var destination: Destination = .scratchpad
    private var saveTask: Task<Void, Never>?

    init(library: NoteLibrary = NoteLibrary()) {
        self.library = library

        do {
            let loadedNote = try library.loadScratchpad() ?? NSAttributedString(string: "")
            let normalizedNote = NoteTypography.normalized(loadedNote)
            self.note = normalizedNote
            self.filedNotes = try library.listFiledNotes()
            self.saveState = .saved

            if !loadedNote.isEqual(to: normalizedNote) {
                try library.saveScratchpad(normalizedNote)
            }
        } catch {
            self.note = NSAttributedString(string: "")
            self.saveState = .failed
        }
    }

    var isEmpty: Bool {
        note.length == 0
    }

    var canFileCurrentNote: Bool {
        note.length > 0
    }

    var hasError: Bool {
        if case .failed = saveState {
            return true
        }

        return false
    }

    var currentNoteTitle: String {
        destination.title
    }

    var canDeleteCurrentNote: Bool {
        if case .filed = destination {
            return true
        }

        return false
    }

    var statusText: String {
        switch saveState {
        case .idle:
            return "Local prototype"
        case .saving:
            return "Saving..."
        case .saved:
            return "Saved locally"
        case .failed:
            return "Save failed"
        }
    }

    func update(note: NSAttributedString) {
        let normalizedNote = NoteTypography.normalized(note)

        guard !self.note.isEqual(to: normalizedNote) else {
            return
        }

        self.note = normalizedNote
        scheduleSave()
    }

    func fileCurrentNote(named title: String) {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            return
        }

        saveTask?.cancel()

        do {
            _ = try persist(note: note, to: destination)
            _ = try library.file(note, titled: trimmedTitle)
            filedNotes = try library.listFiledNotes()
            destination = .scratchpad
            note = NSAttributedString(string: "")
            try library.saveScratchpad(note)
            saveState = .saved
        } catch {
            saveState = .failed
        }
    }

    func openFiledNote(_ summary: FiledNoteSummary) {
        saveTask?.cancel()

        do {
            destination = try persist(note: note, to: destination)
            let loadedNote = try library.load(summary) ?? NSAttributedString(string: "")
            let normalizedNote = NoteTypography.normalized(loadedNote)
            let savedSummary = loadedNote.isEqual(to: normalizedNote) ? summary : try library.save(normalizedNote, for: summary)

            note = normalizedNote
            destination = .filed(savedSummary)
            filedNotes = try library.listFiledNotes()
            saveState = .saved
        } catch {
            saveState = .failed
        }
    }

    func isCurrent(_ summary: FiledNoteSummary) -> Bool {
        if case .filed(let currentSummary) = destination {
            return currentSummary.id == summary.id
        }

        return false
    }

    func deleteCurrentNote() {
        guard case .filed(let summary) = destination else {
            return
        }

        saveTask?.cancel()

        do {
            try library.delete(summary)
            filedNotes = try library.listFiledNotes()
            destination = .scratchpad
            note = NSAttributedString(string: "")
            try library.saveScratchpad(note)
            saveState = .saved
        } catch {
            saveState = .failed
        }
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveState = .saving

        let noteSnapshot = note
        let destinationSnapshot = destination

        saveTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(350))
            guard let self, !Task.isCancelled else {
                return
            }

            do {
                let updatedDestination = try persist(note: noteSnapshot, to: destinationSnapshot)

                if destination == destinationSnapshot {
                    destination = updatedDestination
                }

                filedNotes = try library.listFiledNotes()
                saveState = .saved
            } catch {
                saveState = .failed
            }
        }
    }

    private func persist(note: NSAttributedString, to destination: Destination) throws -> Destination {
        switch destination {
        case .scratchpad:
            try library.saveScratchpad(note)
            return .scratchpad
        case .filed(let summary):
            let updatedSummary = try library.save(note, for: summary)
            return .filed(updatedSummary)
        }
    }
}
