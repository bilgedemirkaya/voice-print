/**
 * Shared domain types for the visualizer. These describe the app's vocabulary —
 * scenes, voices, and the converted "takes" of a recording — independent of where
 * they're stored (the Zustand store imports these, not the other way round).
 */

/** A 3-swatch color identity, e.g. derived from a voice or the live audio. */
export type Palette = [string, string, string];

/** The named "screensavers" the user can choose (CLAUDE.md §5). */
export type SceneId = "wavefield" | "mystify" | "starfield" | "axolotl" | "toasters";

/** ElevenLabs voice-changer tuning, surfaced as advanced sliders (CLAUDE.md §6). */
export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.85,
  style: 0,
};

/** A voice as returned by `GET /api/voices` (labels drive the filter picker). */
export type Voice = { id: string; name: string; labels: Record<string, string> };

/**
 * One converted take of the current recording, with its own scene + color identity.
 * Switching takes in the compare gallery swaps both the audio and these visuals.
 */
export type Conversion = {
  voiceId: string;
  voiceName: string;
  url: string;
  sceneId: SceneId;
  palette: Palette;
};

/**
 * A new voice being composed in the Display Properties dialog before it's transformed.
 * While a draft exists the dialog edits *it* — its scene/voice/color never touch an
 * existing take — so adding a voice can't clobber another take's screensaver.
 */
export type VoiceDraft = {
  voiceId: string;
  voiceName: string;
  sceneId: SceneId;
  palette: Palette | null;
};
