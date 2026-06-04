import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Opaque file-name handles within the store dir — no slashes, no traversal.
const HANDLE_RE = /^[A-Za-z0-9._-]+$/;

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
};

const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** Shared audio temp dir. Passed to the MCP server via AUDIO_TMP_DIR so both sides agree. */
export function audioStoreDir(): string {
  const dir = process.env.AUDIO_TMP_DIR?.trim();
  return dir ? path.resolve(dir) : path.join(os.tmpdir(), "voiceprint-audio");
}

export function extForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_EXT[base] ?? "webm";
}

export function contentTypeForHandle(handle: string): string {
  const ext = handle.split(".").pop()?.toLowerCase() ?? "";
  return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

export function resolveHandle(handle: string): string {
  if (!HANDLE_RE.test(handle)) throw new Error(`Invalid audio handle: ${handle}`);
  return path.join(audioStoreDir(), handle);
}

// Converted clips are transient — sweep anything older than this so nothing lingers on disk.
const AUDIO_TTL_MS = 60 * 60 * 1000; // 1 hour

async function sweepOldAudio(dir: string): Promise<void> {
  try {
    const cutoff = Date.now() - AUDIO_TTL_MS;
    const names = await readdir(dir);
    await Promise.all(
      names.map(async (name) => {
        const file = path.join(dir, name);
        const info = await stat(file).catch(() => null);
        if (info && info.mtimeMs < cutoff) await rm(file, { force: true }).catch(() => undefined);
      }),
    );
  } catch {
    // best-effort cleanup; never block a request
  }
}

export async function writeAudio(data: Buffer, ext: string): Promise<string> {
  const dir = audioStoreDir();
  await mkdir(dir, { recursive: true });
  void sweepOldAudio(dir); // fire-and-forget: keep the temp store from accumulating
  const handle = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, handle), data);
  return handle;
}

export async function readAudio(handle: string): Promise<Buffer> {
  return readFile(resolveHandle(handle));
}
