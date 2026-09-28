const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("papernote", {
  load: () => ipcRenderer.invoke("notes:load"),
  saveScratchpad: (markdown) => ipcRenderer.invoke("notes:saveScratchpad", markdown),
  fileNote: (input) => ipcRenderer.invoke("notes:file", input),
  saveNote: (note) => ipcRenderer.invoke("notes:save", note),
  deleteNote: (id) => ipcRenderer.invoke("notes:delete", id),
  exportNote: (input) => ipcRenderer.invoke("note:export", input),
  copy: (input) => ipcRenderer.invoke("clipboard:write", input),
  saveImage: (input) => ipcRenderer.invoke("images:save", input),
  imageFromClipboard: () => ipcRenderer.invoke("images:fromClipboard"),
  setZen: (isZen) => ipcRenderer.send("window:zen", isZen)
});
