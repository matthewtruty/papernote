import { api } from "./api";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]);

export function filesFromClipboard(data: DataTransfer | null) {
  if (!data) return [];
  const files: File[] = [];
  for (const file of data.files) {
    if (IMAGE_TYPES.has(file.type)) files.push(file);
  }
  if (files.length) return files;
  for (const item of data.items) {
    if (item.kind === "file" && IMAGE_TYPES.has(item.type)) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function persistImageFile(file: File) {
  const dataUrl = await fileToDataUrl(file);
  const base64 = dataUrl.split(",")[1];
  if (base64) {
    try {
      return await api().saveImage({
        base64,
        mime: file.type || "image/png",
        name: file.name || "image.png"
      });
    } catch {
      return dataUrl;
    }
  }
  return dataUrl;
}

export function imageMarkdown(src: string, alt = "image") {
  return `![${alt}](${src})`;
}

export function insertImageAtCaret(root: HTMLElement, src: string, alt = "image") {
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.draggable = false;

  const block = document.createElement("p");
  block.className = "pn-image";
  block.appendChild(image);

  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode)) {
    root.appendChild(block);
    placeCaretAfter(block);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const blockParent =
    range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
  const host =
    blockParent && blockParent !== root && root.contains(blockParent) && ["P", "DIV"].includes(blockParent.tagName)
      ? blockParent
      : null;

  if (host && !host.textContent?.trim() && host.childElementCount === 0) {
    host.replaceWith(block);
  } else {
    range.insertNode(block);
  }

  placeCaretAfter(block);
}

function placeCaretAfter(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
