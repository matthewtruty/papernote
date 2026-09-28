import SwiftUI

struct SearchNotesSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: NoteStore
    @State private var query = ""

    private var filteredNotes: [FiledNoteSummary] {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            return store.filedNotes
        }

        return store.filedNotes.filter { summary in
            summary.title.localizedCaseInsensitiveContains(trimmedQuery)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            TextField("Search notes", text: $query)
                .textFieldStyle(.roundedBorder)
                .padding(16)

            Divider()

            if filteredNotes.isEmpty {
                ContentUnavailableView("No matching notes", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredNotes) { summary in
                    Button {
                        store.openFiledNote(summary)
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(summary.title)
                                    .foregroundStyle(.primary)
                                Text(summary.updatedAt, format: .dateTime.month().day().year().hour().minute())
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if store.isCurrent(summary) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        }
        .frame(minWidth: 420, minHeight: 320)
    }
}
