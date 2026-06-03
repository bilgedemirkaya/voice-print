import { create } from "zustand";
import { silentParams } from "@/lib/audio/params";
import type { AnimationParams } from "@/lib/audio/types";

export type SceneId = "wavefield" | "mystify" | "starfield" | "pipes";

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

export type Voice = { id: string; name: string; labels: Record<string, string> };

/** One converted take of the current recording, with its own scene + color identity. */
export type Conversion = {
  voiceId: string;
  voiceName: string;
  url: string;
  sceneId: SceneId;
  palette: [string, string, string];
};

export type VoicesStatus = "idle" | "loading" | "ready" | "error";

type AudioState = {
  // live analysis
  params: AnimationParams;
  recording: boolean;
  // scene + voice selection (driven by the Display Properties picker)
  activeScene: SceneId;
  targetVoiceId: string;
  voiceSettings: VoiceSettings;
  // recorded source + converted result + transform status
  recordedBlob: Blob | null;
  // converted takes of the current recording (one per voice), for the A/B/C compare gallery
  conversions: Conversion[];
  transforming: boolean;
  transformError: string | null;
  // whether a visualization clip is currently being recorded for export
  exporting: boolean;
  // display
  crtEnabled: boolean;
  soundEnabled: boolean;
  // label of the clip currently driving the visuals (e.g. "You" / a voice name), or null
  playingLabel: string | null;
  // color identity for the selected voice (gender/vibe), overriding the audio palette; or null
  voicePalette: [string, string, string] | null;
  // whether settings have changed since the last Apply (drives the Apply button)
  dirty: boolean;
  // shared access code that unlocks the host's key (in-memory + sessionStorage), or null
  accessCode: string | null;
  // a visitor's own ElevenLabs key (BYOK, in-memory + sessionStorage), or null
  userApiKey: string | null;
  // free transforms left on the shared key per the server, or null when unknown / unlimited
  trialRemaining: number | null;
  // voices, fetched once and cached
  voices: Voice[];
  voicesStatus: VoicesStatus;
  voicesError: string | null;

  setParams: (params: AnimationParams) => void;
  setRecording: (recording: boolean) => void;
  setActiveScene: (scene: SceneId) => void;
  setTargetVoiceId: (voiceId: string) => void;
  setVoiceSettings: (settings: VoiceSettings) => void;
  setRecordedBlob: (blob: Blob | null) => void;
  addConversion: (conversion: Conversion) => void;
  setTransforming: (transforming: boolean) => void;
  setTransformError: (error: string | null) => void;
  setExporting: (exporting: boolean) => void;
  setCrtEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setPlayingLabel: (label: string | null) => void;
  setVoicePalette: (palette: [string, string, string] | null) => void;
  setDirty: (dirty: boolean) => void;
  setAccessCode: (code: string | null) => void;
  setUserApiKey: (key: string | null) => void;
  setTrialRemaining: (remaining: number | null) => void;
  /** Restore a previously-accepted access code + BYOK key from sessionStorage (client only). */
  hydrateAccess: () => void;
  /** Fetch voices once and cache them; no-op if already loading/ready. */
  loadVoices: () => Promise<void>;
};

/** Single source of truth for live audio-reactive state + filter selection (CLAUDE.md §3). */
export const useAudioStore = create<AudioState>()((set, get) => ({
  params: silentParams(),
  recording: false,
  activeScene: "wavefield",
  targetVoiceId: "",
  voiceSettings: DEFAULT_VOICE_SETTINGS,
  recordedBlob: null,
  conversions: [],
  transforming: false,
  transformError: null,
  exporting: false,
  crtEnabled: true,
  soundEnabled: true,
  playingLabel: null,
  voicePalette: null,
  dirty: false,
  accessCode: null,
  userApiKey: null,
  trialRemaining: null,
  voices: [],
  voicesStatus: "idle",
  voicesError: null,

  setParams: (params) => set({ params }),
  setRecording: (recording) => set({ recording }),
  setActiveScene: (activeScene) => set({ activeScene }),
  setTargetVoiceId: (targetVoiceId) => set({ targetVoiceId }),
  setVoiceSettings: (voiceSettings) => set({ voiceSettings }),
  // a new recording invalidates prior conversions (they were of the old audio)
  setRecordedBlob: (recordedBlob) =>
    set({ recordedBlob, dirty: true, conversions: [], voicePalette: null }),
  addConversion: (conversion) =>
    set((s) => {
      const index = s.conversions.findIndex((c) => c.voiceId === conversion.voiceId);
      const conversions =
        index >= 0
          ? s.conversions.map((c, i) => (i === index ? conversion : c))
          : [...s.conversions, conversion];
      return { conversions };
    }),
  setTransforming: (transforming) => set({ transforming }),
  setTransformError: (transformError) => set({ transformError }),
  setExporting: (exporting) => set({ exporting }),
  setCrtEnabled: (crtEnabled) => set({ crtEnabled }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setPlayingLabel: (playingLabel) => set({ playingLabel }),
  setVoicePalette: (voicePalette) => set({ voicePalette }),
  setDirty: (dirty) => set({ dirty }),
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
  loadVoices: async () => {
    const status = get().voicesStatus;
    if (status === "loading" || status === "ready") return;
    set({ voicesStatus: "loading", voicesError: null });
    try {
      const res = await fetch("/api/voices");
      const data = (await res.json()) as { voices?: Voice[]; error?: string };
      if (!res.ok || !data.voices) throw new Error(data.error ?? "Failed to load voices");
      const voices = data.voices;
      set((s) => ({
        voices,
        voicesStatus: "ready",
        targetVoiceId: s.targetVoiceId || voices[0]?.id || "",
      }));
    } catch (err) {
      set({
        voicesStatus: "error",
        voicesError: err instanceof Error ? err.message : "Failed to load voices",
      });
    }
  },
}));
