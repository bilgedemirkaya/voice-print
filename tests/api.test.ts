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
import { ACCESS_CODE_HEADER, BYOK_HEADER, FREE_TRIAL_LIMIT, TRIAL_COOKIE } from "@/lib/trialConfig";
import { signTrialCount } from "@/lib/trial";

function transformForm(): FormData {
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from("REC")], { type: "audio/webm" }), "rec.webm");
  form.append("targetVoiceId", "voice_robot");
  return form;
}

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
    const res = await transformPost(
      new Request("http://localhost/api/transform", { method: "POST", body: transformForm() }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { resultHandle: string; voiceId: string; remaining: number };
    expect(json).toMatchObject({ resultHandle: "converted-test.mp3", voiceId: "voice_robot" });
    // a fresh visitor (no cookie) consumes one free transform and is told how many remain
    expect(json.remaining).toBe(FREE_TRIAL_LIMIT - 1);
    expect(res.headers.get("set-cookie") ?? "").toContain(`${TRIAL_COOKIE}=`);

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

  it("402s once the free trial is used up (no own key)", async () => {
    const usedUp = signTrialCount(FREE_TRIAL_LIMIT);
    const res = await transformPost(
      new Request("http://localhost/api/transform", {
        method: "POST",
        body: transformForm(),
        headers: { cookie: `${TRIAL_COOKIE}=${usedUp}` },
      }),
    );
    expect(res.status).toBe(402);
    const json = (await res.json()) as { code: string; remaining: number };
    expect(json).toMatchObject({ code: "trial_exhausted", remaining: 0 });
  });

  it("a valid access code bypasses the trial (unlimited), case-insensitively", async () => {
    vi.stubEnv("ACCESS_CODE", "sesame");
    try {
      const res = await transformPost(
        new Request("http://localhost/api/transform", {
          method: "POST",
          body: transformForm(),
          headers: {
            cookie: `${TRIAL_COOKIE}=${signTrialCount(FREE_TRIAL_LIMIT)}`,
            [ACCESS_CODE_HEADER]: "SESAME",
          },
        }),
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as { remaining: number | null }).remaining).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("a wrong access code does not bypass the trial", async () => {
    vi.stubEnv("ACCESS_CODE", "sesame");
    try {
      const res = await transformPost(
        new Request("http://localhost/api/transform", {
          method: "POST",
          body: transformForm(),
          headers: {
            cookie: `${TRIAL_COOKIE}=${signTrialCount(FREE_TRIAL_LIMIT)}`,
            [ACCESS_CODE_HEADER]: "nope",
          },
        }),
      );
      expect(res.status).toBe(402);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("a bring-your-own-key request bypasses the trial and forwards the key", async () => {
    const res = await transformPost(
      new Request("http://localhost/api/transform", {
        method: "POST",
        body: transformForm(),
        headers: {
          cookie: `${TRIAL_COOKIE}=${signTrialCount(FREE_TRIAL_LIMIT)}`,
          [BYOK_HEADER]: "xi-user-key",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(transformVoice)).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "xi-user-key" }),
    );
  });

  it("is unlimited on local dev, ignoring the trial cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const res = await transformPost(
        new Request("http://localhost/api/transform", {
          method: "POST",
          body: transformForm(),
          headers: { cookie: `${TRIAL_COOKIE}=${signTrialCount(FREE_TRIAL_LIMIT)}` },
        }),
      );
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("/api/transform per-IP backstop (Upstash)", () => {
  beforeAll(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    process.env.TRIAL_IP_DAILY_CAP = "2";
  });
  afterAll(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.TRIAL_IP_DAILY_CAP;
    vi.unstubAllGlobals();
  });

  it("429s when the IP is already over the daily cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes("/GET/")
          ? new Response(JSON.stringify({ result: "2" }), { status: 200 })
          : new Response(JSON.stringify({ result: 1 }), { status: 200 }),
      ),
    );
    const res = await transformPost(
      new Request("http://localhost/api/transform", {
        method: "POST",
        body: transformForm(),
        headers: { "x-forwarded-for": "9.9.9.9" },
      }),
    );
    expect(res.status).toBe(429);
    expect(((await res.json()) as { code: string }).code).toBe("ip_rate_limited");
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
