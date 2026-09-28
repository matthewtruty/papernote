export type Folder = string;
export type EditorMode = "live" | "md";
export type MenuName = "file" | "publish" | "copy" | "fonts" | null;

export interface StoredNote {
  id: string;
  title: string;
  folder: Folder;
  markdown: string;
  updatedAt: string;
}

export interface PapernoteAPI {
  load(): Promise<{ scratchpad: string; notes: StoredNote[] }>;
  saveScratchpad(markdown: string): Promise<void>;
  fileNote(input: {
    title: string;
    folder: Folder;
    markdown: string;
  }): Promise<{ note: StoredNote; notes: StoredNote[] }>;
  saveNote(note: StoredNote): Promise<StoredNote>;
  deleteNote(id: string): Promise<StoredNote[]>;
  exportNote(input: {
    title: string;
    markdown: string;
    html: string;
    format: "md" | "html";
  }): Promise<boolean>;
  copy(input: { markdown: string; html?: string }): Promise<void>;
  saveImage(input: { base64: string; mime: string; name?: string }): Promise<string>;
  imageFromClipboard(): Promise<string | null>;
  setZen(isZen: boolean): void;
}

declare global {
  interface Window {
    papernote?: PapernoteAPI;
  }
}
