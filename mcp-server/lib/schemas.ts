import { z } from "zod";

/** ElevenLabs voice settings (subset surfaced as advanced sliders in the UI). */
export const voiceSettingsShape = {
  stability: z.number().min(0).max(1).optional(),
  similarity_boost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  use_speaker_boost: z.boolean().optional(),
  speed: z.number().min(0.5).max(2).optional(),
};
export const voiceSettingsSchema = z.object(voiceSettingsShape);

export const voiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  labels: z.record(z.string(), z.string()),
});

// --- tool input shapes (ZodRawShape for registerTool) ---

export const getVoiceSettingsInput = {
  voiceId: z.string().min(1).describe("ElevenLabs voice id"),
};

export const transformVoiceInput = {
  audioHandle: z.string().min(1).describe("Handle of the source audio in the temp store"),
  targetVoiceId: z.string().min(1).describe("ElevenLabs voice id to convert to"),
  settings: voiceSettingsSchema.optional().describe("Optional voice settings override"),
  apiKey: z
    .string()
    .min(1)
    .optional()
    .describe("Optional caller-supplied ElevenLabs key (BYOK); falls back to the server's env key"),
};
