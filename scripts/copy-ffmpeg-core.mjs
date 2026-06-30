import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "ffmpeg");
// UMD build — loaded via importScripts in the ffmpeg worker (ESM has no default export).
const coreSrc = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");

if (!existsSync(coreSrc)) {
  console.warn(
    "[copy-ffmpeg-core] @ffmpeg/core not installed — run npm install first.",
  );
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  const from = join(coreSrc, file);
  if (existsSync(from)) {
    cpSync(from, join(dest, file));
    console.log(`[copy-ffmpeg-core] ${file}`);
  }
}
