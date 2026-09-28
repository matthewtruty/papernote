import SwiftUI

struct FileNoteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: NoteStore
    @State private var title = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("File this note")
                .font(.system(size: 18, weight: .semibold))

            TextField("Note name", text: $title)
                .textFieldStyle(.roundedBorder)
                .focused($isFocused)
                .onSubmit(save)

            HStack {
                Spacer()

                Button("Cancel") {
                    dismiss()
                }

                Button("Save") {
                    save()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !store.canFileCurrentNote)
            }
        }
        .padding(20)
        .frame(width: 340)
        .onAppear {
            isFocused = true
        }
    }

    private func save() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            return
        }

        store.fileCurrentNote(named: trimmedTitle)
        dismiss()
    }
}
