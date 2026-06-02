// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  contentTypeForHandle,
  extForMimeType,
  readAudio,
  resolveHandle,
  writeAudio,
} from "@/lib/store/audioFiles";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "vs-store-"));
  process.env.AUDIO_TMP_DIR = dir;
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("audioFiles store", () => {
  it("round-trips bytes through writeAudio/readAudio", async () => {
    const bytes = Buffer.from("hello-audio-bytes");
    const handle = await writeAudio(bytes, "webm");
    expect(handle).toMatch(/\.webm$/);
    const read = await readAudio(handle);
    expect(read.equals(bytes)).toBe(true);
  });

  it("rejects path-traversal handles", () => {
    expect(() => resolveHandle("../secret")).toThrow();
    expect(() => resolveHandle("a/b")).toThrow();
  });

  it("maps mime → ext and handle → content-type", () => {
    expect(extForMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(extForMimeType("audio/mpeg")).toBe("mp3");
    expect(extForMimeType("weird/thing")).toBe("webm");
    expect(contentTypeForHandle("x.mp3")).toBe("audio/mpeg");
    expect(contentTypeForHandle("x.unknown")).toBe("application/octet-stream");
  });
});
