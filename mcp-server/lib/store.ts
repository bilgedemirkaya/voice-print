import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { audioDir } from "./config.js";

// Handles are opaque file names within audioDir — no slashes, no traversal.
const HANDLE_RE = /^[A-Za-z0-9._-]+$/;

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
};

export function contentTypeForHandle(handle: string): string {
  const ext = handle.split(".").pop()?.toLowerCase() ?? "";
  return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

/** Resolve a handle to an absolute path, rejecting anything that could escape the store. */
export function resolveHandle(handle: string): string {
  if (!HANDLE_RE.test(handle)) {
    throw new Error(`Invalid audio handle: ${handle}`);
  }
  return path.join(audioDir(), handle);
}

/** Persist audio bytes and return a fresh handle. */
export async function writeAudio(data: Buffer, ext: string): Promise<string> {
  const dir = audioDir();
  await mkdir(dir, { recursive: true });
  const handle = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, handle), data);
  return handle;
}

/** Read audio bytes for a handle. Throws if the handle is invalid or missing. */
export async function readAudio(handle: string): Promise<Buffer> {
  return readFile(resolveHandle(handle));
}
