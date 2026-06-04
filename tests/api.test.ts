// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mock the ElevenLabs client so tests don't hit the network.
vi.mock("@/lib/elevenlabs", () => ({
  speechToSpeech: vi.fn(async () => ({
    audio: Buffer.from("CONVERTED"),
    contentType: "audio/mpeg",
    durationMsApprox: 1500,
  })),
  listVoices: vi.fn(async () => [{ id: "v1", name: "Robo", labels: {} }]),
}));

import { POST as transformPost } from "@/app/api/transform/route";
import { GET as voicesGet } from "@/app/api/voices/route";
import { speechToSpeech } from "@/lib/elevenlabs";
import { ACCESS_CODE_HEADER, BYOK_HEADER, FREE_TRIAL_LIMIT, TRIAL_COOKIE } from "@/lib/trialConfig";
import { signTrialCount } from "@/lib/trial";

function transformForm(): FormData {
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from("REC")], { type: "audio/webm" }), "rec.webm");
  form.append("targetVoiceId", "voice_robot");
  return form;
}

describe("/api/transform", () => {
  it("converts the upload via ElevenLabs and streams the audio back", async () => {
    const res = await transformPost(
      new Request("http://localhost/api/transform", { method: "POST", body: transformForm() }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("X-Voice-Id")).toBe("voice_robot");
    // a fresh visitor (no cookie) consumes one free transform and is told how many remain
    expect(res.headers.get("X-Trial-Remaining")).toBe(String(FREE_TRIAL_LIMIT - 1));
    expect(res.headers.get("set-cookie") ?? "").toContain(`${TRIAL_COOKIE}=`);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("CONVERTED");

    expect(vi.mocked(speechToSpeech)).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: "voice_robot" }),
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
      expect(res.headers.get("X-Trial-Remaining")).toBe(""); // empty = unlimited
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
    expect(vi.mocked(speechToSpeech)).toHaveBeenCalledWith(
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
  it("returns the voice list and the free-trial count remaining", async () => {
    const res = await voicesGet(new Request("http://localhost/api/voices"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { voices: Array<{ id: string }>; remaining: number };
    expect(json.voices).toEqual([{ id: "v1", name: "Robo", labels: {} }]);
    expect(json.remaining).toBe(FREE_TRIAL_LIMIT); // no cookie yet → full quota
  });

  it("reflects used transforms in the remaining count", async () => {
    const res = await voicesGet(
      new Request("http://localhost/api/voices", {
        headers: { cookie: `${TRIAL_COOKIE}=${signTrialCount(1)}` },
      }),
    );
    expect(((await res.json()) as { remaining: number }).remaining).toBe(FREE_TRIAL_LIMIT - 1);
  });
});
