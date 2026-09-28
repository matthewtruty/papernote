import { useEffect, useRef, type RefObject } from "react";
import { api } from "./api";
import { filesFromClipboard, insertImageAtCaret, persistImageFile } from "./images";
import {
  closestBlock,
  htmlToMarkdown,
  lineAtOffset,
  liveBlockFromText,
  markdownToHtml,
  normalizeMarkdownLine,
  readBlockInnerText,
  setCaretIn,
  visibleCaretOffset
} from "./markdown";

export type LiveAction = "heading" | "list" | "quote" | "bold" | "italic" | "strike" | "link";

interface LiveEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  fontFamily: string;
  fontSize: string;
  caretColor: string;
  liveRef: RefObject<HTMLDivElement | null>;
}

export function applyLiveAction(element: HTMLDivElement, action: LiveAction) {
  element.focus();
  if (action === "heading") document.execCommand("formatBlock", false, "h1");
  else if (action === "list") document.execCommand("insertUnorderedList");
  else if (action === "quote") document.execCommand("formatBlock", false, "blockquote");
  else if (action === "bold") document.execCommand("bold");
  else if (action === "italic") document.execCommand("italic");
  else if (action === "strike") document.execCommand("strikeThrough");
  else if (action === "link") document.execCommand("createLink", false, "https://");
}

function isLooseNode(node: Node) {
  return node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && node.tagName === "BR");
}

function wrapLooseText(root: HTMLElement) {
  let index = 0;
  while (index < root.childNodes.length) {
    const node = root.childNodes[index];
    if (!isLooseNode(node)) {
      index += 1;
      continue;
    }
    const paragraph = document.createElement("p");
    root.insertBefore(paragraph, node);
    while (paragraph.nextSibling && isLooseNode(paragraph.nextSibling)) {
      paragraph.appendChild(paragraph.nextSibling);
    }
    if (!paragraph.childNodes.length) paragraph.innerHTML = "<br>";
    index = [...root.childNodes].indexOf(paragraph) + 1;
  }
}

function applyCurrentBlock(root: HTMLElement) {
  wrapLooseText(root);
  const selection = window.getSelection();
  const block = closestBlock(selection?.anchorNode ?? null, root);
  if (block === root) return false;

  const { text, caret } = readBlockInnerText(block);
  const line = lineAtOffset(text, caret);
  const raw = normalizeMarkdownLine(line.text);
  const converted = liveBlockFromText(raw);
  if (!converted) return false;

  const nextOffset = visibleCaretOffset(raw, line.offset);
  const listTag = converted.list;
  const prev = block.previousElementSibling;

  if (converted.tag === "li" && prev && prev.tagName === (listTag === "ol" ? "OL" : "UL")) {
    const item = document.createElement("li");
    item.innerHTML = converted.innerHtml;
    prev.appendChild(item);
    block.remove();
    setCaretIn(item, nextOffset);
    return true;
  }

  if (converted.tag === "li" && block.parentElement?.tagName === (listTag === "ol" ? "OL" : "UL")) {
    block.innerHTML = converted.innerHtml;
    setCaretIn(block, nextOffset);
    return true;
  }

  const next = document.createElement(listTag ?? converted.tag);
  next.innerHTML = converted.tag === "li" ? `<li>${converted.innerHtml}</li>` : converted.innerHtml;
  const caretTarget = converted.tag === "li" ? (next.firstElementChild as HTMLElement) : next;
  const before = text.slice(0, line.start).replace(/\n+$/, "");
  const after = text.slice(line.end).replace(/^\n+/, "");
  const nodes: HTMLElement[] = [];
  if (before) {
    const paragraph = document.createElement("p");
    paragraph.textContent = before;
    nodes.push(paragraph);
  }
  nodes.push(next);
  if (after) {
    const paragraph = document.createElement("p");
    paragraph.textContent = after;
    nodes.push(paragraph);
  }
  block.replaceWith(...nodes);
  setCaretIn(caretTarget, nextOffset);
  return true;
}

export default function LiveEditor({
  markdown,
  onChange,
  fontFamily,
  fontSize,
  caretColor,
  liveRef
}: LiveEditorProps) {
  const applied = useRef(markdown);

  useEffect(() => {
    const element = liveRef.current;
    if (!element) return;
    document.execCommand("defaultParagraphSeparator", false, "p");
    if (markdown === applied.current) {
      if (!element.childNodes.length) {
        element.innerHTML = markdownToHtml(markdown) || "<p><br></p>";
      }
      return;
    }
    applied.current = markdown;
    element.innerHTML = markdownToHtml(markdown) || "<p><br></p>";
  }, [liveRef, markdown]);

  const sync = () => {
    const element = liveRef.current;
    if (!element) return;
    applyCurrentBlock(element);
    const next = htmlToMarkdown(element);
    applied.current = next;
    onChange(next);
  };

  const insertImages = async (files: File[]) => {
    const element = liveRef.current;
    if (!element || !files.length) return;
    element.focus();
    for (const file of files) {
      const src = await persistImageFile(file);
      insertImageAtCaret(element, src);
    }
    sync();
  };

  const onPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = filesFromClipboard(event.clipboardData);
    if (files.length) {
      event.preventDefault();
      await insertImages(files);
      return;
    }
    if (event.clipboardData.getData("text/plain").trim()) return;
    event.preventDefault();
    const fromClipboard = await api().imageFromClipboard();
    if (!fromClipboard) return;
    const element = liveRef.current;
    if (!element) return;
    insertImageAtCaret(element, fromClipboard);
    sync();
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    const files = filesFromClipboard(event.dataTransfer);
    if (!files.length) return;
    event.preventDefault();
    await insertImages(files);
  };

  return (
    <div
      ref={liveRef}
      className={`pn-live${markdown.trim() ? "" : " is-empty"}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder="Start typing…"
      style={{ fontFamily, fontSize, caretColor }}
      onInput={sync}
      onPaste={onPaste}
      onDragOver={(event) => {
        if (filesFromClipboard(event.dataTransfer).length) event.preventDefault();
      }}
      onDrop={onDrop}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "A") event.preventDefault();
      }}
    />
  );
}
