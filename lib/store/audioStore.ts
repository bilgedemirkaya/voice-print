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
  convertedUrl: string | null;
  transforming: boolean;
  transformError: string | null;
  // display
  crtEnabled: boolean;
  soundEnabled: boolean;
  // whether settings have changed since the last Apply (drives the Apply button)
  dirty: boolean;
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
  setConvertedUrl: (url: string | null) => void;
  setTransforming: (transforming: boolean) => void;
  setTransformError: (error: string | null) => void;
  setCrtEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDirty: (dirty: boolean) => void;
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
  convertedUrl: null,
  transforming: false,
  transformError: null,
  crtEnabled: true,
  soundEnabled: true,
  dirty: false,
  voices: [],
  voicesStatus: "idle",
  voicesError: null,

  setParams: (params) => set({ params }),
  setRecording: (recording) => set({ recording }),
  setActiveScene: (activeScene) => set({ activeScene }),
  setTargetVoiceId: (targetVoiceId) => set({ targetVoiceId }),
  setVoiceSettings: (voiceSettings) => set({ voiceSettings }),
  setRecordedBlob: (recordedBlob) => set({ recordedBlob, dirty: true }),
  setConvertedUrl: (convertedUrl) => set({ convertedUrl }),
  setTransforming: (transforming) => set({ transforming }),
  setTransformError: (transformError) => set({ transformError }),
  setCrtEnabled: (crtEnabled) => set({ crtEnabled }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setDirty: (dirty) => set({ dirty }),
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
