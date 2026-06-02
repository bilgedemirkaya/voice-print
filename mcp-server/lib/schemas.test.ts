import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getVoiceSettingsInput, transformVoiceInput, voiceSettingsSchema } from "./schemas.js";

const transformSchema = z.object(transformVoiceInput);
const getSettingsSchema = z.object(getVoiceSettingsInput);

describe("transform_voice input schema", () => {
  it("rejects missing required fields", () => {
    expect(transformSchema.safeParse({}).success).toBe(false);
    expect(transformSchema.safeParse({ audioHandle: "a.webm" }).success).toBe(false);
  });

  it("accepts a valid payload with optional settings", () => {
    const result = transformSchema.safeParse({
      audioHandle: "a.webm",
      targetVoiceId: "v1",
      settings: { stability: 0.5, similarity_boost: 0.8 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range settings", () => {
    expect(
      transformSchema.safeParse({
        audioHandle: "a.webm",
        targetVoiceId: "v1",
        settings: { stability: 2 },
      }).success,
    ).toBe(false);
  });
});

describe("get_voice_settings input schema", () => {
  it("requires a non-empty voiceId", () => {
    expect(getSettingsSchema.safeParse({}).success).toBe(false);
    expect(getSettingsSchema.safeParse({ voiceId: "" }).success).toBe(false);
    expect(getSettingsSchema.safeParse({ voiceId: "v1" }).success).toBe(true);
  });
});

describe("voiceSettingsSchema bounds", () => {
  it("enforces 0..1 ranges and the speed range", () => {
    expect(voiceSettingsSchema.safeParse({ stability: -0.1 }).success).toBe(false);
    expect(voiceSettingsSchema.safeParse({ speed: 3 }).success).toBe(false);
    expect(voiceSettingsSchema.safeParse({ speed: 1, use_speaker_boost: true }).success).toBe(true);
  });
});
