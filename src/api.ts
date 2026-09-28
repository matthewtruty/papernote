import type { PapernoteAPI, StoredNote } from "./types";
import { FIRST_RUN_NOTE } from "./welcome";

const STORAGE_KEY = "papernote.local";

interface LocalState {
  scratchpad: string;
  notes: StoredNote[];
}

function readLocal(): LocalState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    if (parsed && typeof parsed === "object") {
      return {
        scratchpad: typeof parsed.scratchpad === "string" ? parsed.scratchpad : "",
        notes: Array.isArray(parsed.notes) ? parsed.notes : []
      };
    }
  } catch {
    /* empty */
  }
  return { scratchpad: FIRST_RUN_NOTE, notes: [] };
}

function writeLocal(state: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const localApi: PapernoteAPI = {
  async load() {
    return readLocal();
  },
  async saveScratchpad(markdown) {
    writeLocal({ ...readLocal(), scratchpad: markdown });
  },
  async fileNote(input) {
    const state = readLocal();
    const note: StoredNote = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      folder: input.folder,
      markdown: input.markdown,
      updatedAt: new Date().toISOString()
    };
    const notes = [note, ...state.notes];
    writeLocal({ scratchpad: "", notes });
    return { note, notes };
  },
  async saveNote(note) {
    const state = readLocal();
    const updated = { ...note, updatedAt: new Date().toISOString() };
    writeLocal({
      ...state,
      notes: state.notes.map((item) => (item.id === updated.id ? updated : item))
    });
    return updated;
  },
  async deleteNote(id) {
    const state = readLocal();
    const notes = state.notes.filter((note) => note.id !== id);
    writeLocal({ ...state, notes });
    return notes;
  },
  async exportNote(input) {
    const blob = new Blob(
      [
        input.format === "md"
          ? input.markdown
          : `<!doctype html><meta charset="utf-8"><title>${input.title}</title><article>${input.html}</article>`
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${input.title || "Untitled note"}.${input.format === "md" ? "md" : "html"}`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  },
  async saveImage(input) {
    return `data:${input.mime || "image/png"};base64,${input.base64}`;
  },
  async imageFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((value) => value.startsWith("image/"));
        if (!type) continue;
        return await blobToDataUrl(await item.getType(type));
      }
    } catch {
      /* clipboard image read is optional in the browser */
    }
    return null;
  },
  async copy(input) {
    if (input.html && "ClipboardItem" in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([input.html], { type: "text/html" }),
          "text/plain": new Blob([input.markdown], { type: "text/plain" })
        })
      ]);
      return;
    }
    await navigator.clipboard.writeText(input.markdown);
  },
  setZen() {
    /* no-op in browser */
  }
};

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function api(): PapernoteAPI {
  return window.papernote ?? localApi;
}

