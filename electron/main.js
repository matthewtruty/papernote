import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, protocol } from "electron";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "papernote-image",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isMac = process.platform === "darwin";
const PRODUCT_NAME = "Papernote";
let mainWindow = null;

app.setName(PRODUCT_NAME);
app.setAboutPanelOptions({
  applicationName: PRODUCT_NAME,
  applicationVersion: app.getVersion(),
  copyright: "Copyright © 2026 Papernote"
});

const FIRST_RUN_NOTE = `# The shape of a quiet tool

Papernote should disappear while you write. One column of text, a caret, and nothing else asking for attention.

- No toolbar overhead
- Formatting lives at the bottom, out of the eye line
- Zen mode (⌘.) removes even that

**Bold**, *italic*, and ~~strikethrough~~ stay as plain markdown. What you see is what you typed.

> The tool should be quieter than the thought.
`;

const notesDirectory = () => path.join(app.getPath("userData"), "notes");
const imagesDirectory = () => path.join(app.getPath("userData"), "images");
const scratchpadPath = () => path.join(app.getPath("userData"), "scratchpad.md");

function extensionForMime(mime) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "png";
}

function imagePathFromUrl(url) {
  const name = decodeURIComponent(url.replace(/^papernote-image:\/\//, "").replace(/^\//, ""));
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error("Invalid image url");
  }
  return path.join(imagesDirectory(), name);
}

function dataUrlFromBuffer(buffer, mime) {
  return `data:${mime || "image/png"};base64,${Buffer.from(buffer).toString("base64")}`;
}

async function saveImageBuffer(buffer, mime) {
  const type = mime || "image/png";
  await mkdir(imagesDirectory(), { recursive: true });
  const file = `${crypto.randomUUID()}.${extensionForMime(type)}`;
  await writeFile(path.join(imagesDirectory(), file), buffer);
  return dataUrlFromBuffer(buffer, type);
}

async function embedLocalImages(markdown) {
  const matches = markdown.matchAll(/!\[([^\]]*)\]\(papernote-image:\/\/([^)]+)\)/g);
  let next = markdown;
  for (const match of matches) {
    try {
      const file = path.basename(match[2]);
      const buffer = await readFile(path.join(imagesDirectory(), file));
      const ext = path.extname(file).slice(1) || "png";
      const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      next = next.replaceAll(match[0], `![${match[1]}](${dataUrlFromBuffer(buffer, mime)})`);
    } catch {
      /* leave the original reference if the file is missing */
    }
  }
  return next;
}

async function ensureStorage() {
  await mkdir(notesDirectory(), { recursive: true });
}

async function readScratchpad() {
  try {
    return await readFile(scratchpadPath(), "utf8");
  } catch {
    return FIRST_RUN_NOTE;
  }
}

async function listNotes() {
  await ensureStorage();
  const files = (await readdir(notesDirectory())).filter((file) => file.endsWith(".json"));
  const notes = await Promise.all(
    files.map(async (file) => {
      try {
        return JSON.parse(await readFile(path.join(notesDirectory(), file), "utf8"));
      } catch {
        return null;
      }
    })
  );
  return notes.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeNote(note) {
  await ensureStorage();
  const target = path.join(notesDirectory(), `${note.id}.json`);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify(note, null, 2), "utf8");
  await rename(temporary, target);
  return note;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#FBFBF9",
    show: false,
    title: PRODUCT_NAME,
    icon: path.join(__dirname, "../build/icon.png"),
    frame: true,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    titleBarOverlay: isMac
      ? undefined
      : { color: "#FBFBF9", symbolColor: "#6e6e69", height: 36 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (!isMac) mainWindow.setMenuBarVisibility(false);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) void mainWindow.loadURL(devServer);
  else void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

function createApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac
        ? [
            {
              label: PRODUCT_NAME,
              submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" }
              ]
            }
          ]
        : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" }
    ])
  );
}

app.whenReady().then(() => {
  protocol.handle("papernote-image", async (request) => {
    try {
      const file = imagePathFromUrl(request.url);
      const buffer = await readFile(file);
      const ext = path.extname(file).slice(1) || "png";
      const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      return new Response(buffer, { headers: { "content-type": mime } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  nativeTheme.themeSource = "light";
  createApplicationMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

ipcMain.handle("notes:load", async () => ({
  scratchpad: await embedLocalImages(await readScratchpad()),
  notes: await Promise.all(
    (await listNotes()).map(async (note) => ({
      ...note,
      markdown: await embedLocalImages(note.markdown)
    }))
  )
}));

ipcMain.handle("notes:saveScratchpad", async (_event, markdown) => {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(scratchpadPath(), markdown, "utf8");
});

ipcMain.handle("notes:file", async (_event, input) => {
  const note = {
    id: crypto.randomUUID(),
    title: String(input.title || "").trim(),
    folder: input.folder,
    markdown: input.markdown,
    updatedAt: new Date().toISOString()
  };
  await writeNote(note);
  await writeFile(scratchpadPath(), "", "utf8");
  return { note, notes: await listNotes() };
});

ipcMain.handle("notes:save", async (_event, note) => {
  const updated = { ...note, updatedAt: new Date().toISOString() };
  await writeNote(updated);
  return updated;
});

ipcMain.handle("notes:delete", async (_event, id) => {
  await unlink(path.join(notesDirectory(), `${id}.json`));
  return listNotes();
});

ipcMain.handle("note:export", async (_event, input) => {
  const extension = input.format === "md" ? "md" : "html";
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${input.title || "Untitled note"}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  });
  if (result.canceled || !result.filePath) return false;
  const content =
    input.format === "md"
      ? input.markdown
      : `<!doctype html><meta charset="utf-8"><title>${input.title}</title><style>body{font:16.5px/1.72 Rubik,sans-serif;color:#1f1f1e;background:#FBFBF9;max-width:860px;margin:64px auto;padding:0 24px;}blockquote{margin:0 0 1em;padding-left:1em;border-left:2px solid #d8d8d2;color:#6e6e69;font-style:italic;}a{color:#0f8bbd;text-decoration:none;}</style><article>${input.html}</article>`;
  await writeFile(result.filePath, content, "utf8");
  return true;
});

ipcMain.handle("clipboard:write", (_event, input) => {
  clipboard.write({ text: input.markdown || "", html: input.html || undefined });
});

ipcMain.handle("images:save", async (_event, input) => {
  const mime = String(input?.mime || "image/png");
  const buffer = Buffer.from(String(input?.base64 || ""), "base64");
  if (!buffer.length) throw new Error("Empty image");
  return saveImageBuffer(buffer, mime);
});

ipcMain.handle("images:fromClipboard", async () => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;
  return saveImageBuffer(image.toPNG(), "image/png");
});

ipcMain.on("window:zen", (_event, isZen) => {
  if (isMac) mainWindow?.setWindowButtonVisibility(!isZen);
});
