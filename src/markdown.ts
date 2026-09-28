const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"]);

const HEADING_RE = /^[ \t]{0,3}(#{1,6})(?:[ \t]+|(?=[^\s#]))(.+)$/;
const INVISIBLE_RE = /[\u200B\u200C\u200D\uFEFF]/g;
const UL_RE = /^([-*+])[ \t]+(.+)$/;
const OL_RE = /^(\d+)[.)][ \t]+(.+)$/;
const QUOTE_RE = /^>[ \t]*(.+)$/;
const IMAGE_RE = /^!\[([^\]]*)\]\((.+)\)$/;
const COMPLETE_INLINE =
  /\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|(^|[^*])\*[^*\s][^*\n]*\*(?!\*)|(^|[^_])_[^_\s][^_\n]*_(?!_)/;

export type LiveBlock = {
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "li" | "blockquote";
  list?: "ul" | "ol";
  innerHtml: string;
  body: string;
};

export function normalizeMarkdownLine(text: string) {
  return text.replace(/\u00a0/g, " ").replace(INVISIBLE_RE, "");
}

export function lineAtOffset(text: string, offset: number) {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const start = text.lastIndexOf("\n", clamped - 1) + 1;
  const end = text.indexOf("\n", clamped);
  const finish = end === -1 ? text.length : end;
  return {
    start,
    end: finish,
    text: text.slice(start, finish),
    offset: clamped - start
  };
}

export function parseBlock(raw: string): LiveBlock | null {
  const text = normalizeMarkdownLine(raw).replace(/^\n+/, "").replace(/\n+$/, "");
  const heading = text.match(HEADING_RE);
  if (heading) {
    const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    return { tag: `h${level}`, body: heading[2], innerHtml: inlineHtml(heading[2]) || "<br>" };
  }
  const ul = text.match(UL_RE);
  if (ul) return { tag: "li", list: "ul", body: ul[2], innerHtml: inlineHtml(ul[2]) || "<br>" };
  const ol = text.match(OL_RE);
  if (ol) return { tag: "li", list: "ol", body: ol[2], innerHtml: inlineHtml(ol[2]) || "<br>" };
  const quote = text.match(QUOTE_RE);
  if (quote) return { tag: "blockquote", body: quote[1], innerHtml: inlineHtml(quote[1]) || "<br>" };
  const image = text.match(IMAGE_RE);
  if (image) return { tag: "p", body: text, innerHtml: `<img alt="${escapeHtml(image[1] || "image")}" src="${escapeHtml(image[2])}">` };
  COMPLETE_INLINE.lastIndex = 0;
  if (COMPLETE_INLINE.test(text)) {
    COMPLETE_INLINE.lastIndex = 0;
    return { tag: "p", body: text, innerHtml: inlineHtml(text) || "<br>" };
  }
  return null;
}

export function hasCompletableMarkdown(text: string) {
  return parseBlock(text) !== null;
}

export function liveBlockFromText(raw: string) {
  return parseBlock(raw);
}

export function toVisibleText(raw: string) {
  const parsed = parseBlock(raw);
  const text = parsed && parsed.tag !== "p" ? parsed.body : raw;
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/___([^_]+)___/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1$2");
}

export function visibleCaretOffset(raw: string, rawOffset: number) {
  return toVisibleText(raw.slice(0, rawOffset)).length;
}

export function closestBlock(node: Node | null, root: HTMLElement): HTMLElement {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && BLOCK_TAGS.has(current.tagName)) return current;
    current = current.parentNode;
  }
  return root;
}

export function readBlockInnerText(block: HTMLElement) {
  const text = normalizeMarkdownLine(block.innerText ?? "");
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { text, caret: text.length };
  const range = selection.getRangeAt(0);
  if (!block.contains(range.endContainer)) return { text, caret: text.length };
  const prefix = document.createElement("div");
  const copy = range.cloneRange();
  copy.selectNodeContents(block);
  copy.setEnd(range.endContainer, range.endOffset);
  prefix.appendChild(copy.cloneContents());
  const caret = normalizeMarkdownLine(prefix.innerText ?? "").length;
  return { text, caret: Math.min(caret, text.length) };
}

export function blockCaretOffset(block: HTMLElement) {
  return readBlockInnerText(block).caret;
}

export function setCaretIn(element: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let accumulated = 0;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (accumulated + length >= offset) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, offset - accumulated));
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    accumulated += length;
  }
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function inlineHtml(text: string) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
}

export function markdownToHtml(markdown: string) {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  const openList = (kind: "ul" | "ol") => {
    if (list !== kind) {
      closeList();
      out.push(`<${kind}>`);
      list = kind;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const parsed = parseBlock(trimmed);
    if (parsed?.tag === "li") {
      openList(parsed.list ?? "ul");
      out.push(`<li>${parsed.innerHtml}</li>`);
      continue;
    }
    closeList();
    if (parsed?.tag.startsWith("h")) out.push(`<${parsed.tag}>${parsed.innerHtml}</${parsed.tag}>`);
    else if (parsed?.tag === "blockquote") out.push(`<blockquote>${parsed.innerHtml}</blockquote>`);
    else out.push(`<p>${inlineHtml(trimmed)}</p>`);
  }

  closeList();
  return out.join("\n");
}

function inlineFromNode(node: Node): string {
  let text = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? "";
      return;
    }
    if (child.nodeName === "BR") {
      text += "\n";
      return;
    }
    const inner = inlineFromNode(child);
    if (child.nodeName === "STRONG" || child.nodeName === "B") {
      text += child.childNodes.length === 1 && (child.firstChild as HTMLElement | null)?.nodeName === "EM"
        ? `***${inner}***`
        : `**${inner}**`;
    } else if (child.nodeName === "EM" || child.nodeName === "I") text += `*${inner}*`;
    else if (child.nodeName === "S" || child.nodeName === "STRIKE" || child.nodeName === "DEL") text += `~~${inner}~~`;
    else if (child.nodeName === "CODE") text += `\`${inner}\``;
    else if (child.nodeName === "IMG") {
      const image = child as HTMLImageElement;
      text += `![${image.getAttribute("alt") || "image"}](${image.getAttribute("src") || ""})`;
    } else if (child.nodeName === "A") {
      const href = (child as HTMLAnchorElement).getAttribute("href") || "";
      text += `[${inner}](${href})`;
    } else {
      text += inner;
    }
  });
  return text;
}

export function htmlToMarkdown(root: HTMLElement) {
  const lines: string[] = [];
  const pushBlock = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent?.replace(/\u00a0/g, " ");
      if (value?.trim()) lines.push(value);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === "BR") {
      lines.push("");
      return;
    }
    if (tag === "IMG") {
      lines.push(`![${node.getAttribute("alt") || "image"}](${node.getAttribute("src") || ""})`);
      return;
    }
    if (/^H[1-6]$/.test(tag)) lines.push(`${"#".repeat(Number(tag[1]))} ${inlineFromNode(node)}`);
    else if (tag === "BLOCKQUOTE") lines.push(`> ${inlineFromNode(node)}`);
    else if (tag === "UL") {
      node.querySelectorAll(":scope > li").forEach((item) => lines.push(`- ${inlineFromNode(item)}`));
    } else if (tag === "OL") {
      [...node.querySelectorAll(":scope > li")].forEach((item, index) => {
        lines.push(`${index + 1}. ${inlineFromNode(item)}`);
      });
    } else if (tag === "LI") lines.push(`- ${inlineFromNode(node)}`);
    else if (tag === "DIV" || tag === "P") {
      if (node.childElementCount === 1 && node.firstElementChild?.tagName === "BR" && !node.textContent?.trim()) {
        lines.push("");
        return;
      }
      inlineFromNode(node)
        .split("\n")
        .forEach((line) => lines.push(line));
    } else {
      lines.push(inlineFromNode(node));
    }
  };
  root.childNodes.forEach(pushBlock);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function noteTitle(markdown: string) {
  const firstLine = markdown
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return firstLine?.slice(0, 64) || "Untitled note";
}

export function wordCount(markdown: string) {
  const text = markdown.trim();
  return text ? text.split(/\s+/).length : 0;
}

export function plainText(markdown: string) {
  return toVisibleText(markdown)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+[.)]\s+/gm, "");
}
