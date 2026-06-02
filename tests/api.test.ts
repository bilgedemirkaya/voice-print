// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Mock the MCP client so we don't spawn the real MCP server / call ElevenLabs.
vi.mock("@/lib/mcp-client", () => ({
  transformVoice: vi.fn(async (input: { audioHandle: string; targetVoiceId: string }) => ({
    resultHandle: "converted-test.mp3",
    durationMs: 1500,
    voiceId: input.targetVoiceId,
  })),
  listVoices: vi.fn(async () => [{ id: "v1", name: "Robo", labels: {} }]),
}));

import { writeAudio } from "@/lib/store/audioFiles";
import { GET as audioGet } from "@/app/api/audio/[handle]/route";
import { POST as transformPost } from "@/app/api/transform/route";
import { GET as voicesGet } from "@/app/api/voices/route";
import { transformVoice } from "@/lib/mcp-client";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "vs-api-"));
  process.env.AUDIO_TMP_DIR = dir;
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("/api/audio/[handle]", () => {
  it("round-trips stored bytes with the right content-type", async () => {
    const bytes = Buffer.from("CONVERTED_MP3_BYTES");
    const handle = await writeAudio(bytes, "mp3");

    const res = await audioGet(new Request(`http://localhost/api/audio/${handle}`), {
      params: Promise.resolve({ handle }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(bytes)).toBe(true);
  });

  it("404s for missing or path-traversal handles", async () => {
    const missing = await audioGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ handle: "nope.mp3" }),
    });
    expect(missing.status).toBe(404);

    const bad = await audioGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ handle: "../escape" }),
    });
    expect(bad.status).toBe(404);
  });
});

describe("/api/transform", () => {
  it("stores the upload, forwards the handle to transform_voice, returns the result", async () => {
    const form = new FormData();
    form.append("audio", new Blob([Buffer.from("REC")], { type: "audio/webm" }), "rec.webm");
    form.append("targetVoiceId", "voice_robot");

    const res = await transformPost(
      new Request("http://localhost/api/transform", { method: "POST", body: form }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { resultHandle: string; voiceId: string };
    expect(json).toMatchObject({ resultHandle: "converted-test.mp3", voiceId: "voice_robot" });

    expect(vi.mocked(transformVoice)).toHaveBeenCalledWith(
      expect.objectContaining({
        targetVoiceId: "voice_robot",
        audioHandle: expect.stringMatching(/\.webm$/),
      }),
    );
  });

  it("400s when audio or targetVoiceId is missing", async () => {
    const form = new FormData();
    form.append("targetVoiceId", "v1");
    const res = await transformPost(
      new Request("http://localhost/api/transform", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/voices", () => {
  it("returns the voice list from the MCP client", async () => {
    const res = await voicesGet();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { voices: Array<{ id: string }> };
    expect(json.voices).toEqual([{ id: "v1", name: "Robo", labels: {} }]);
  });
});
