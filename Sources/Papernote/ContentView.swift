import SwiftUI

struct ContentView: View {
    @ObservedObject var store: NoteStore
    @StateObject private var editorController = NoteEditorController()
    @State private var isShowingFileSheet = false
    @State private var isShowingSearchSheet = false
    @State private var isShowingDeleteAlert = false

    var body: some View {
        ZStack {
            Color(nsColor: .textBackgroundColor)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header

                ZStack(alignment: .topLeading) {
                    NoteEditor(
                        note: Binding(
                            get: { store.note },
                            set: { store.update(note: $0) }
                        ),
                        controller: editorController
                    )

                    if store.isEmpty {
                        Text("Start typing...")
                            .font(.system(size: NoteTypography.placeholderFontSize, weight: .regular))
                            .foregroundStyle(.tertiary)
                            .padding(.top, 14)
                            .padding(.leading, 14)
                            .allowsHitTesting(false)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .sheet(isPresented: $isShowingFileSheet) {
            FileNoteSheet(store: store)
        }
        .sheet(isPresented: $isShowingSearchSheet) {
            SearchNotesSheet(store: store)
        }
        .alert("Delete this note?", isPresented: $isShowingDeleteAlert) {
            Button("Delete", role: .destructive) {
                store.deleteCurrentNote()
            }
            Button("Cancel", role: .cancel) {
            }
        } message: {
            Text("This removes the filed note from local storage and returns you to a blank scratchpad.")
        }
    }

    private var header: some View {
        HStack {
            Text("Papernote")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(1.2)

            HStack(spacing: 6) {
                Button("Search") {
                    isShowingSearchSheet = true
                }

                Button("File It") {
                    isShowingFileSheet = true
                }
                .disabled(!store.canFileCurrentNote)

                Button("Publish") {
                }

                if store.canDeleteCurrentNote {
                    Button("Delete") {
                        isShowingDeleteAlert = true
                    }
                    .foregroundStyle(Color.red.opacity(0.85))
                }
            }
            .buttonStyle(HeaderActionButtonStyle())

            Spacer()

            Text(store.currentNoteTitle)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)

            Text(store.statusText)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(store.hasError ? AnyShapeStyle(Color.red.opacity(0.9)) : AnyShapeStyle(.tertiary))
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 6)
    }
}

private struct HeaderActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.primary.opacity(configuration.isPressed ? 0.08 : 0.04))
            )
    }
}
