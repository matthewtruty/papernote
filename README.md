# Papernote

A quiet, local-first Markdown notebook for macOS and Windows. The desktop shell is Electron; the writing UI follows the redesign in `design/Papernote.dc.html`.

Working on the code? See [CONTRIBUTING.md](CONTRIBUTING.md). All changes land through pull requests.

Licensed under the [MIT License](LICENSE).

## Run

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

## Installers

```sh
npm run build:mac    # .dmg + .app on macOS
npm run build:win    # NSIS installer on Windows
```

On this Mac:

- App: `release/mac-arm64/Papernote.app`
- Installer: `release/Papernote-2.0.0-arm64.dmg`

Drag the app into Applications. macOS may ask you to open it anyway because the build is unsigned. Windows installers must be built on Windows (`npm run build:win`).

Notes autosave in the app’s user-data folder. Filed notes are JSON documents containing Markdown.

## Shortcuts

- `⌘/Ctrl + E` — Live / Markdown
- `⌘/Ctrl + O` — search recent notes
- `⌘/Ctrl + B` / `⌘/Ctrl + I` — bold / italic
- `⌘/Ctrl + K` — link
- `⌘/Ctrl + 1–9` — file in Thoughts, Notes, Archive, or a custom area
- `⌘/Ctrl + .` — Zen
- `Esc` — close an overlay or leave Zen

The printable one-page brief is `docs/redesign-spec.html`.
