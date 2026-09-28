import AppKit
import SwiftUI

struct NoteEditor: NSViewRepresentable {
    @Binding var note: NSAttributedString
    let controller: NoteEditorController

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NoteEditorContainerView {
        let containerView = NoteEditorContainerView()
        let scrollView = containerView.scrollView
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true

        let textView = NoteTextView(frame: .zero)
        textView.isRichText = true
        textView.importsGraphics = true
        textView.allowsImageEditing = true
        textView.allowsUndo = true
        textView.drawsBackground = false
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.autoresizingMask = [.width]
        textView.textContainerInset = NSSize(width: 12, height: 12)
        textView.textColor = .labelColor
        textView.insertionPointColor = .labelColor
        textView.font = NoteTypography.defaultFont()
        textView.usesAdaptiveColorMappingForDarkAppearance = true
        textView.delegate = context.coordinator
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticTextCompletionEnabled = false
        textView.isAutomaticLinkDetectionEnabled = true
        textView.isContinuousSpellCheckingEnabled = true
        textView.isIncrementalSearchingEnabled = true
        textView.usesFindBar = true
        textView.linkTextAttributes = [
            .foregroundColor: NSColor.linkColor,
            .underlineStyle: NSUnderlineStyle.single.rawValue
        ]

        if let textContainer = textView.textContainer {
            textContainer.widthTracksTextView = true
            textContainer.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
            textContainer.lineFragmentPadding = 0
        }

        textView.typingAttributes[.font] = NoteTypography.defaultFont()
        textView.textStorage?.setAttributedString(note)
        scrollView.documentView = textView
        containerView.textView = textView
        containerView.controller = controller
        controller.bind(to: textView, containerView: containerView)
        return containerView
    }

    func updateNSView(_ containerView: NoteEditorContainerView, context: Context) {
        guard let textView = containerView.textView else {
            return
        }

        if context.coordinator.isUpdatingView {
            return
        }

        if !textView.attributedString().isEqual(to: note) {
            context.coordinator.isUpdatingView = true
            textView.typingAttributes[.font] = NoteTypography.defaultFont()
            textView.textStorage?.setAttributedString(note)
            context.coordinator.isUpdatingView = false
        }

        containerView.controller = controller
        controller.bind(to: textView, containerView: containerView)
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: NoteEditor
        var isUpdatingView = false

        init(_ parent: NoteEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard !isUpdatingView, let textView = notification.object as? NoteTextView else {
                return
            }

            let selection = textView.selectedRange()
            let linkedNote = NoteLinkDetector.normalized(textView.attributedString())

            if !textView.attributedString().isEqual(to: linkedNote) {
                isUpdatingView = true
                textView.textStorage?.setAttributedString(linkedNote)
                textView.setSelectedRange(selection)
                isUpdatingView = false
            }

            parent.controller.refreshSelectedImage()
            parent.note = textView.attributedString()
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            parent.controller.refreshSelectedImage()
        }
    }
}

/// An NSView that is invisible to hit testing — clicks fall through to the parent view.
private final class PassthroughView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

final class NoteTextView: NSTextView {

    // MARK: – Corner handles (subviews: scroll naturally with text content)

    private let handleSize: CGFloat = 14
    private let cornerHitRadius: CGFloat = 18

    private lazy var cornerHandleViews: [NoteImageAttachment.Corner: NSView] = {
        Dictionary(uniqueKeysWithValues: NoteImageAttachment.Corner.allCases.map { corner in
            let v = PassthroughView()
            v.wantsLayer = true
            v.layer?.backgroundColor = NSColor.controlAccentColor.cgColor
            v.layer?.cornerRadius = handleSize / 2
            v.layer?.borderColor = NSColor.white.withAlphaComponent(0.9).cgColor
            v.layer?.borderWidth = 1.5
            v.isHidden = true
            return (corner, v)
        })
    }()

    // MARK: – Resize state (tracking loop, not stored)

    // MARK: – Handle layout

    func updateCornerHandles(for selection: NoteImageAttachment.Selection?) {
        let half = handleSize / 2

        guard let selection,
              let imageFrame = NoteImageAttachment.frame(in: self, for: selection.range) else {
            cornerHandleViews.values.forEach { $0.isHidden = true }
            return
        }

        // imageFrame is in the textView's flipped coordinate space (Y increases downward)
        let positions: [NoteImageAttachment.Corner: CGPoint] = [
            .topLeft:     CGPoint(x: imageFrame.minX - half, y: imageFrame.minY - half),
            .topRight:    CGPoint(x: imageFrame.maxX - half, y: imageFrame.minY - half),
            .bottomLeft:  CGPoint(x: imageFrame.minX - half, y: imageFrame.maxY - half),
            .bottomRight: CGPoint(x: imageFrame.maxX - half, y: imageFrame.maxY - half)
        ]

        for (corner, view) in cornerHandleViews {
            guard let origin = positions[corner] else { continue }
            view.frame = CGRect(origin: origin, size: CGSize(width: handleSize, height: handleSize))
            if view.superview == nil {
                addSubview(view, positioned: .above, relativeTo: nil)
            }
            view.isHidden = false
        }
    }

    // MARK: – Cursor

    override func resetCursorRects() {
        super.resetCursorRects()
        for handleView in cornerHandleViews.values where !handleView.isHidden {
            addCursorRect(handleView.frame.insetBy(dx: -4, dy: -4), cursor: .crosshair)
        }
    }

    // MARK: – Mouse events

    override func mouseDown(with event: NSEvent) {
        let pointInView = convert(event.locationInWindow, from: nil)
        guard let hit = selectedImageCornerHit(at: pointInView) else {
            super.mouseDown(with: event)
            return
        }

        // Run a synchronous drag-tracking loop — the same pattern NSTextView uses internally.
        // This guarantees we receive every drag event without relying on mouseDragged delivery.
        let startLocation = event.locationInWindow
        NSCursor.crosshair.push()

        var keepGoing = true
        while keepGoing {
            guard let next = window?.nextEvent(matching: [.leftMouseDragged, .leftMouseUp]) else { break }
            switch next.type {
            case .leftMouseDragged:
                let current = next.locationInWindow
                let translation = CGSize(
                    width:  current.x - startLocation.x,
                    height: current.y - startLocation.y
                )
                let targetWidth = NoteImageAttachment.targetWidth(
                    for: hit.baseSize,
                    dragTranslation: translation,
                    corner: hit.corner,
                    maximumWidth: maximumImageWidth()
                )
                resizeImage(in: hit.range, toWidth: targetWidth)
            default:
                keepGoing = false
            }
        }

        NSCursor.pop()
        window?.invalidateCursorRects(for: self)
    }

    // MARK: – Paste

    override func paste(_ sender: Any?) {
        if insertImageFromPasteboard() { return }
        super.paste(sender)
    }

    @discardableResult
    private func insertImageFromPasteboard() -> Bool {
        guard let image = NSImage(pasteboard: .general) else { return false }

        let attachment = NoteImageAttachment.makeAttachment(from: image, maximumWidth: maximumImageWidth())
        let insertedImage = NSMutableAttributedString(attributedString: NSAttributedString(attachment: attachment))
        insertedImage.addAttribute(.font, value: NoteTypography.defaultFont(), range: NSRange(location: 0, length: insertedImage.length))

        let selectedRange = selectedRange()
        guard shouldChangeText(in: selectedRange, replacementString: nil) else { return false }

        textStorage?.replaceCharacters(in: selectedRange, with: insertedImage)
        setSelectedRange(NSRange(location: selectedRange.location, length: 1))
        didChangeText()
        return true
    }

    // MARK: – Resize helpers

    func resizeImage(in range: NSRange, by scale: CGFloat) {
        guard let attachment = attachment(at: range) else { return }
        resizeImage(in: range, toWidth: NoteImageAttachment.displaySize(for: attachment).width * scale)
    }

    func resizeImage(in range: NSRange, toWidth width: CGFloat) {
        guard range.location >= 0,
              range.location < attributedString().length,
              let attachment = attachment(at: range) else { return }

        let newSize = NoteImageAttachment.resizedSize(
            for: NoteImageAttachment.displaySize(for: attachment),
            targetWidth: width,
            maximumWidth: maximumImageWidth()
        )
        attachment.bounds = CGRect(origin: .zero, size: newSize)
        textStorage?.edited(.editedAttributes, range: range, changeInLength: 0)
        setSelectedRange(range)
        didChangeText()
    }

    func maximumImageWidth() -> CGFloat {
        let availableWidth = bounds.width - (textContainerInset.width * 2)
        return max(NoteImageAttachment.minimumWidth, min(availableWidth, NoteImageAttachment.defaultMaximumWidth))
    }

    // MARK: – Private helpers

    private func attachment(at range: NSRange) -> NSTextAttachment? {
        textStorage?.attribute(.attachment, at: range.location, effectiveRange: nil) as? NSTextAttachment
    }

    private func selectedImageCornerHit(at point: NSPoint) -> (range: NSRange, corner: NoteImageAttachment.Corner, baseSize: NSSize)? {
        guard let selection = NoteImageAttachment.selection(in: self),
              let frame = NoteImageAttachment.frame(in: self, for: selection.range),
              let att = attachment(at: selection.range) else { return nil }

        let size = NoteImageAttachment.displaySize(for: att)
        let candidates: [(NoteImageAttachment.Corner, CGPoint)] = [
            (.topLeft,     CGPoint(x: frame.minX, y: frame.minY)),
            (.topRight,    CGPoint(x: frame.maxX, y: frame.minY)),
            (.bottomLeft,  CGPoint(x: frame.minX, y: frame.maxY)),
            (.bottomRight, CGPoint(x: frame.maxX, y: frame.maxY))
        ]
        for (corner, cornerPoint) in candidates {
            if hypot(point.x - cornerPoint.x, point.y - cornerPoint.y) <= cornerHitRadius {
                return (selection.range, corner, size)
            }
        }
        return nil
    }
}
