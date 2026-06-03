// Direct ElevenLabs client, server-side only. The host's key is read from ELEVENLABS_API_KEY and
// never reaches the browser; a caller may pass their own key (BYOK) per request. Verified against
// ElevenLabs docs: GET /v1/voices and POST /v1/speech-to-speech (Voice Changer). Auth: xi-api-key.
const BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_STS_MODEL = "eleven_english_sts_v2";
const OUTPUT_FORMAT = "mp3_44100_128";
const BYTES_PER_MS = 16; // 128 kbps CBR ≈ 16 bytes/ms → approximate clip duration

export type Voice = { id: string; name: string; labels: Record<string, string> };

export type VoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
};

// Sensible defaults for intelligible conversions when the caller doesn't specify settings.
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.85,
  style: 0,
  use_speaker_boost: true,
};

export type SpeechToSpeechResult = {
  audio: Buffer;
  contentType: string;
  durationMsApprox: number;
};

function hostKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
  return key;
}

function authHeaders(apiKey?: string): Record<string, string> {
  return { "xi-api-key": apiKey?.trim() || hostKey() };
}

async function fail(res: Response, action: string): Promise<never> {
  const detail = await res.text().catch(() => "");
  throw new Error(`ElevenLabs ${action} failed (${res.status}): ${detail.slice(0, 300)}`);
}

export async function listVoices(): Promise<Voice[]> {
  const res = await fetch(`${BASE_URL}/voices`, { headers: authHeaders() });
  if (!res.ok) return fail(res, "list voices");
  const data = (await res.json()) as {
    voices: Array<{ voice_id: string; name: string; labels?: Record<string, string> | null }>;
  };
  return data.voices.map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels ?? {} }));
}

/** Convert source audio to the target voice (preserving cadence/emotion). Returns mp3 bytes. */
export async function speechToSpeech(params: {
  voiceId: string;
  audio: Buffer;
  audioContentType: string;
  settings?: VoiceSettings;
  apiKey?: string;
}): Promise<SpeechToSpeechResult> {
  const settings = params.settings ?? DEFAULT_VOICE_SETTINGS;
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(params.audio)], { type: params.audioContentType }), "input");
  form.append("model_id", DEFAULT_STS_MODEL);
  form.append("voice_settings", JSON.stringify(settings));
  // Clean up noisy mic input — improves conversion intelligibility.
  form.append("remove_background_noise", "true");

  const url = `${BASE_URL}/speech-to-speech/${encodeURIComponent(params.voiceId)}?output_format=${OUTPUT_FORMAT}`;
  const res = await fetch(url, { method: "POST", headers: authHeaders(params.apiKey), body: form });
  if (!res.ok) return fail(res, "speech-to-speech");

  const audio = Buffer.from(await res.arrayBuffer());
  return {
    audio,
    contentType: "audio/mpeg",
    durationMsApprox: Math.round(audio.byteLength / BYTES_PER_MS),
  };
}
