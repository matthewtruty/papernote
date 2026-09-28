import AppKit
import Foundation

@MainActor
final class NoteEditorContainerView: NSView {
    override var isFlipped: Bool { true }

    let scrollView = NSScrollView()

    weak var textView: NoteTextView?
    weak var controller: NoteEditorController?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupViews()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }

    override func layout() {
        super.layout()
        scrollView.frame = bounds
    }

    // Corner handles are now subviews of NoteTextView — no overlay needed.
    func updateResizeHandle() { }

    private func setupViews() {
        addSubview(scrollView)
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = false
        scrollView.autoresizingMask = [.width, .height]
    }
}
