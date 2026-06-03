import os from "node:os";
import path from "node:path";

/** ElevenLabs key, read lazily so the server still boots (and lists tools) without it. */
export function elevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Add it to mcp-server/.env (see mcp-server/.env.example).",
    );
  }
  return key;
}

/** Directory backing the audio handle store. Override with AUDIO_TMP_DIR. */
export function audioDir(): string {
  const dir = process.env.AUDIO_TMP_DIR?.trim();
  return dir ? path.resolve(dir) : path.join(os.tmpdir(), "voiceprint-audio");
}
