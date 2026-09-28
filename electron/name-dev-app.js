import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const plist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/electron/dist/Electron.app/Contents/Info.plist"
);

if (!existsSync(plist)) process.exit(0);

for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
  execFileSync("plutil", ["-replace", key, "-string", "Papernote", plist]);
}
