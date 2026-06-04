import { create } from "zustand";
import { silentParams } from "@/lib/audio/params";
import type { AnimationParams } from "@/lib/audio/types";
import type { Conversion, Palette, SceneId, VoiceDraft, VoiceSettings } from "@/lib/types";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/types";

/** The id of the original "You" recording in the compare gallery. */
export const ORIGINAL_TAKE_ID = "original";

type AudioState = {
  // --- live analysis -------------------------------------------------------
  params: AnimationParams;

  // --- recording + takes ---------------------------------------------------
  recordedBlob: Blob | null;
  /** The "You" recording's own screensaver (captured on record, restored when selected). */
  originalScene: SceneId;
  /** Converted takes of the current recording (one per voice), for the compare gallery. */
  conversions: Conversion[];
  /** Which take is shown + played: ORIGINAL_TAKE_ID, or a conversion's voiceId. */
  selectedTakeId: string;
  /**
   * A new voice being composed in the dialog, or null when editing the selected take directly.
   * While a draft exists it *is* the displayed take — its scene/voice/color never touch an
   * existing take until Apply materializes it. This is what stops "add a voice" from clobbering
   * another take's screensaver.
   */
  draft: VoiceDraft | null;

  // --- voice-changer settings (applied on Apply) ---------------------------
  voiceSettings: VoiceSettings;
  /** Whether settings/voice have changed since the last Apply (drives the Apply button). */
  dirty: boolean;
  transformError: string | null;

  // --- display -------------------------------------------------------------
  crtEnabled: boolean;
  soundEnabled: boolean;
  /** Whether a visualization clip is currently being recorded for export. */
  exporting: boolean;
  /** Label of the clip currently driving the visuals (e.g. "You" / a voice name), or null. */
  playingLabel: string | null;
  /** Color identity of the displayed take (overrides the audio palette); read by every scene. */
  voicePalette: Palette | null;

  // --- access model --------------------------------------------------------
  accessCode: string | null;
  userApiKey: string | null;
  trialRemaining: number | null;

  // --- actions -------------------------------------------------------------
  setParams: (params: AnimationParams) => void;
  setRecordedBlob: (blob: Blob | null) => void;

  /** Pick a take to view + edit; exits any in-progress draft. */
  selectTake: (id: string) => void;
  /** Set the screensaver of the thing currently being edited (the draft, or the selected take). */
  setEditingScene: (scene: SceneId) => void;
  /** Begin (or retarget) composing a new voice; its scene starts from what's on screen. */
  setDraftVoice: (voiceId: string, voiceName: string, palette: Palette | null) => void;
  /** Discard the draft and fall back to editing the selected take. */
  clearDraft: () => void;
  /** Insert or replace a converted take (used on transform success). */
  addConversion: (conversion: Conversion) => void;
  /** Discard the recording + all takes and return to a clean slate (keeps display + access prefs). */
  reset: () => void;

  setVoiceSettings: (settings: VoiceSettings) => void;
  setDirty: (dirty: boolean) => void;
  setTransformError: (error: string | null) => void;

  setCrtEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setExporting: (exporting: boolean) => void;
  setPlayingLabel: (label: string | null) => void;

  setAccessCode: (code: string | null) => void;
  setUserApiKey: (key: string | null) => void;
  setTrialRemaining: (remaining: number | null) => void;
  /** Restore a previously-accepted access code + BYOK key from sessionStorage (client only). */
  hydrateAccess: () => void;
};

/** The screensaver currently on screen: the draft's, else the selected take's. */
export function selectActiveScene(s: AudioState): SceneId {
  if (s.draft) return s.draft.sceneId;
  if (s.selectedTakeId === ORIGINAL_TAKE_ID) return s.originalScene;
  return s.conversions.find((c) => c.voiceId === s.selectedTakeId)?.sceneId ?? s.originalScene;
}

/**
 * The live params a scene should paint with: the displayed take's voice palette overrides the
 * audio-derived one (CLAUDE.md §5). One home for this rule so scenes stay dumb consumers.
 */
export function selectVisualParams(s: AudioState): AnimationParams {
  return s.voicePalette ? { ...s.params, palette: s.voicePalette } : s.params;
}

/** The color identity of a take by id (null for the original "You" take). */
function paletteForTake(s: Pick<AudioState, "conversions">, id: string): Palette | null {
  if (id === ORIGINAL_TAKE_ID) return null;
  return s.conversions.find((c) => c.voiceId === id)?.palette ?? null;
}

/** Single source of truth for the user's working session: recording, takes, selection (CLAUDE.md §3). */
export const useAudioStore = create<AudioState>()((set) => ({
  params: silentParams(),
  recordedBlob: null,
  originalScene: "nyan",
  conversions: [],
  selectedTakeId: ORIGINAL_TAKE_ID,
  draft: null,
  voiceSettings: DEFAULT_VOICE_SETTINGS,
  dirty: false,
  transformError: null,
  crtEnabled: true,
  soundEnabled: true,
  exporting: false,
  playingLabel: null,
  voicePalette: null,
  accessCode: null,
  userApiKey: null,
  trialRemaining: null,

  setParams: (params) => set({ params }),

  // A new recording invalidates prior conversions (they were of the old audio). "You" keeps
  // whatever screensaver was on screen while recording.
  setRecordedBlob: (recordedBlob) =>
    set((s) => ({
      recordedBlob,
      conversions: [],
      selectedTakeId: ORIGINAL_TAKE_ID,
      draft: null,
      voicePalette: null,
      originalScene: selectActiveScene(s),
      dirty: true,
    })),

  selectTake: (id) =>
    set((s) => ({
      selectedTakeId: id,
      draft: null,
      voicePalette: paletteForTake(s, id),
    })),

  setEditingScene: (scene) =>
    set((s) => {
      if (s.draft) return { draft: { ...s.draft, sceneId: scene } };
      if (s.selectedTakeId === ORIGINAL_TAKE_ID) return { originalScene: scene };
      return {
        conversions: s.conversions.map((c) =>
          c.voiceId === s.selectedTakeId ? { ...c, sceneId: scene } : c,
        ),
      };
    }),

  setDraftVoice: (voiceId, voiceName, palette) =>
    set((s) => ({
      draft: { voiceId, voiceName, sceneId: selectActiveScene(s), palette },
      voicePalette: palette,
      dirty: true,
    })),

  clearDraft: () =>
    set((s) => ({ draft: null, voicePalette: paletteForTake(s, s.selectedTakeId) })),

  addConversion: (conversion) =>
    set((s) => {
      const index = s.conversions.findIndex((c) => c.voiceId === conversion.voiceId);
      const conversions =
        index >= 0
          ? s.conversions.map((c, i) => (i === index ? conversion : c))
          : [...s.conversions, conversion];
      return { conversions };
    }),

  // Wipe the working session (recording, takes, draft, tuning) but keep display + access prefs.
  // The chosen "You" screensaver is a preference, so it survives too.
  reset: () =>
    set({
      params: silentParams(),
      recordedBlob: null,
      conversions: [],
      selectedTakeId: ORIGINAL_TAKE_ID,
      draft: null,
      voiceSettings: DEFAULT_VOICE_SETTINGS,
      dirty: false,
      transformError: null,
      playingLabel: null,
      voicePalette: null,
    }),

  setVoiceSettings: (voiceSettings) => set({ voiceSettings }),
  setDirty: (dirty) => set({ dirty }),
  setTransformError: (transformError) => set({ transformError }),

  setCrtEnabled: (crtEnabled) => set({ crtEnabled }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setExporting: (exporting) => set({ exporting }),
  setPlayingLabel: (playingLabel) => set({ playingLabel }),

  setAccessCode: (accessCode) => {
    if (typeof window !== "undefined") {
      if (accessCode) window.sessionStorage.setItem("vp_access_code", accessCode);
      else window.sessionStorage.removeItem("vp_access_code");
    }
    set({ accessCode });
  },
  setUserApiKey: (userApiKey) => {
    if (typeof window !== "undefined") {
      if (userApiKey) window.sessionStorage.setItem("vp_byok_key", userApiKey);
      else window.sessionStorage.removeItem("vp_byok_key");
    }
    set({ userApiKey });
  },
  setTrialRemaining: (trialRemaining) => set({ trialRemaining }),
  hydrateAccess: () => {
    if (typeof window === "undefined") return;
    const code = window.sessionStorage.getItem("vp_access_code");
    const key = window.sessionStorage.getItem("vp_byok_key");
    set({ accessCode: code || null, userApiKey: key || null });
  },
}));
