"use client";

import { useEffect } from "react";
import { Button } from "@/components/retro/Button";
import { SCENES } from "@/components/scenes/registry";
import { useTransform } from "@/components/controls/useTransform";
import { exportVoiceCard } from "@/components/controls/exportCard";
import { useAudioStore, type VoiceSettings } from "@/lib/store/audioStore";
import { cn } from "@/lib/cn";

const SLIDERS: Array<{ key: keyof VoiceSettings; label: string }> = [
  { key: "stability", label: "Stability" },
  { key: "similarity_boost", label: "Similarity" },
  { key: "style", label: "Style" },
];

/**
 * The fake Display Properties → Screen Saver dialog body (CLAUDE.md §2, §6, §11):
 * pick a screensaver scene, a target voice, and tune the voice settings, then Apply to convert.
 */
export function FilterPicker({ onApplied }: { onApplied?: () => void } = {}) {
  const activeScene = useAudioStore((s) => s.activeScene);
  const setActiveScene = useAudioStore((s) => s.setActiveScene);
  const targetVoiceId = useAudioStore((s) => s.targetVoiceId);
  const setTargetVoiceId = useAudioStore((s) => s.setTargetVoiceId);
  const voiceSettings = useAudioStore((s) => s.voiceSettings);
  const setVoiceSettings = useAudioStore((s) => s.setVoiceSettings);
  const transforming = useAudioStore((s) => s.transforming);
  const transformError = useAudioStore((s) => s.transformError);
  const crtEnabled = useAudioStore((s) => s.crtEnabled);
  const setCrtEnabled = useAudioStore((s) => s.setCrtEnabled);
  const palette = useAudioStore((s) => s.params.palette);
  const dirty = useAudioStore((s) => s.dirty);
  const setDirty = useAudioStore((s) => s.setDirty);
  const voices = useAudioStore((s) => s.voices);
  const voicesError = useAudioStore((s) => s.voicesError);
  const loadVoices = useAudioStore((s) => s.loadVoices);

  const transform = useTransform();
  const sceneName = SCENES.find((s) => s.id === activeScene)?.name ?? activeScene;
  const voiceName = voices.find((v) => v.id === targetVoiceId)?.name ?? targetVoiceId;

  // No-op if already cached; otherwise fetches once.
  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* CRT monitor preview — glows with the voice's live palette (CLAUDE.md §11). */}
      <div className="flex justify-center">
        <div className="bevel-raised bg-w95-silver p-2">
          <div className="bevel-inset relative aspect-[4/3] w-40 overflow-hidden bg-[#0a0618]">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]}, ${palette[2]})`,
                opacity: 0.65,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold tracking-[0.2em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
                {sceneName}
              </span>
            </div>
          </div>
          <div className="mx-auto mt-1 h-1.5 w-12 bevel-raised bg-w95-gray" />
        </div>
      </div>

      <div>
        <p className="mb-1 font-bold">Screen Saver</p>
        <ul className="bevel-inset max-h-32 overflow-auto bg-white">
          {SCENES.map((scene) => (
            <li key={scene.id}>
              <button
                type="button"
                onClick={() => {
                  if (scene.id !== activeScene) {
                    setActiveScene(scene.id);
                    setDirty(true);
                  }
                }}
                className={cn(
                  "w-full px-2 py-1 text-left",
                  scene.id === activeScene
                    ? "bg-w95-navy text-white"
                    : "hover:bg-w95-navy/20 focus-visible:bg-w95-navy/20",
                )}
              >
                {scene.name}
                {!scene.implemented && <span className="opacity-60"> (soon)</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-center gap-2">
        <span className="w-16">Voice</span>
        <select
          value={targetVoiceId}
          onChange={(event) => {
            setTargetVoiceId(event.target.value);
            setDirty(true);
          }}
          className="bevel-inset flex-1 bg-white px-1 py-0.5"
        >
          {voices.length === 0 && <option value="">{voicesError ? "no voices" : "loading…"}</option>}
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <p className="font-bold">Settings</p>
        {SLIDERS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2">
            <span className="w-16">{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voiceSettings[key]}
              onChange={(event) => {
                setVoiceSettings({ ...voiceSettings, [key]: Number(event.target.value) });
                setDirty(true);
              }}
              className="flex-1"
            />
            <span className="w-8 text-right tabular-nums">{voiceSettings[key].toFixed(2)}</span>
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={crtEnabled}
          onChange={(event) => setCrtEnabled(event.target.checked)}
        />
        <span>CRT effect</span>
      </label>

      {voicesError && <p className="text-[#b00020]">{voicesError}</p>}
      {transformError && <p className="text-[#b00020]">{transformError}</p>}

      <div className="flex justify-end gap-2">
        <Button
          onClick={() =>
            exportVoiceCard({ params: useAudioStore.getState().params, sceneName, voiceName })
          }
        >
          Export card
        </Button>
        <Button
          onClick={() => {
            void transform();
            setDirty(false);
            onApplied?.();
          }}
          disabled={transforming || !dirty || !targetVoiceId}
        >
          {transforming ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
