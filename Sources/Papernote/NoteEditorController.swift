import AppKit
import Foundation

@MainActor
final class NoteEditorController: ObservableObject {
    @Published private(set) var selectedImage: NoteImageAttachment.Selection?

    weak var textView: NoteTextView?
    weak var containerView: NoteEditorContainerView?

    var canResizeSelectedImage: Bool { selectedImage != nil }

    func bind(to textView: NoteTextView, containerView: NoteEditorContainerView) {
        let changedTextView  = self.textView !== textView
        let changedContainer = self.containerView !== containerView

        self.textView      = textView
        self.containerView = containerView

        if changedTextView || changedContainer {
            refreshSelectedImage()
        }
    }

    func refreshSelectedImage() {
        let nextSelection = textView.flatMap { NoteImageAttachment.selection(in: $0) }
        if selectedImage != nextSelection {
            selectedImage = nextSelection
        }
        textView?.updateCornerHandles(for: selectedImage)
    }
}
