# Contributing to Papernote

Papernote is a local-first Markdown notebook. The product you run and ship is the **Electron** app in this repo. Notes stay on the machine; there is no cloud backend.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- macOS if you need a `.dmg` (`npm run build:mac`)
- Windows if you need the NSIS installer (`npm run build:win`)

## Get the code

```sh
git clone git@github.com:matthewtruty/papernote.git
cd papernote
npm install
```

Ask for write access if you cannot push. The repo is private.

## Everyday workflow

Create a branch from `main`:

```sh
git checkout main
git pull
git checkout -b your-initials/short-description
```

Run the desktop app:

```sh
npm run dev
```

That starts Vite on `http://localhost:5173` and opens the Electron window. Leave it running while you edit `src/` — the UI reloads.

Run tests before you open a pull request:

```sh
npm test
```

## What to change

| Area | Path |
| --- | --- |
| Writing UI, shortcuts, filing, fonts | `src/` |
| Markdown parsing and live editor | `src/markdown.ts`, `src/LiveEditor.tsx` |
| Desktop window, menus, file/image IPC | `electron/main.js`, `electron/preload.cjs` |
| Visual spec | `design/Papernote.dc.html`, `docs/redesign-spec.html` |

Keep the UI quiet. Prefer the existing patterns in `src/App.tsx` over new chrome.

Do not commit `node_modules/`, `dist/`, `release/`, `.env` files, or built `.dmg` / `.app` artifacts. Build those locally.

## Pull requests

1. Keep the branch focused on one change.
2. Make sure `npm test` passes.
3. Open a PR against `main` with a short “why” and how you checked it (dev app, tests, or a DMG).
4. If you changed UI, layout, or shortcuts, say what you clicked through.

## Shipping a build

macOS:

```sh
npm run build:mac
```

Installer: `release/Papernote-2.0.0-arm64.dmg`  
App: `release/mac-arm64/Papernote.app`

Windows (run on Windows):

```sh
npm run build:win
```

Current macOS builds are signed with an Apple Development certificate only. They are **not notarized**. That is fine for a trusted team, but Gatekeeper will warn. Recipients can right-click the app → **Open**, or run:

```sh
xattr -dr com.apple.quarantine /Applications/Papernote.app
```

Do not put Apple ID passwords or notarization secrets in the repo. If we later add Developer ID signing, use local environment variables (`CSC_NAME`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

## Sharing a DMG with the team

Send `release/Papernote-2.0.0-arm64.dmg` over Slack, Drive, or a private GitHub Release. This build is Apple Silicon (`arm64`) only. Intel Macs need a separate universal or x64 build.

Notes live in the app user-data folder on each machine. Installing a new DMG does not upload or sync anyone’s notes.
