"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/retro/Button";
import { SCENES, SceneView } from "@/components/scenes/registry";
import { voicePaletteForLabels } from "@/lib/voicePalette";
import { useTransform, useIsTransforming } from "@/components/controls/useTransform";
import { exportVoiceCard } from "@/components/controls/exportCard";
import { sfx } from "@/lib/sfx";
import { useVoices, useSubmitAccessCode } from "@/lib/queries";
import { ORIGINAL_TAKE_ID, selectActiveScene, useAudioStore } from "@/lib/store/audioStore";
import type { VoiceSettings } from "@/lib/types";
import { FREE_TRIAL_LIMIT } from "@/lib/trialConfig";
import { cn } from "@/lib/cn";

const SLIDERS: Array<{ key: keyof VoiceSettings; label: string; hint: string }> = [
  { key: "stability", label: "Stability", hint: "Steady vs. expressive — higher is calmer and more consistent." },
  { key: "similarity_boost", label: "Similarity", hint: "How closely it matches the target voice — higher is closer." },
  { key: "style", label: "Style", hint: "Exaggerates the voice's character — 0 is neutral." },
];

// Maps our filter dials to ElevenLabs voice-label keys.
const VOICE_FILTERS: Array<{ key: string; label: string }> = [
  { key: "gender", label: "Gender" },
  { key: "age", label: "Age" },
  { key: "accent", label: "Accent" },
  { key: "descriptive", label: "Vibe" },
];

/**
 * The fake Display Properties → Screen Saver dialog body (CLAUDE.md §2, §6, §11):
 * pick a screensaver scene, a target voice, and tune the voice settings, then Apply to convert.
 *
 * The screensaver always edits whatever is *displayed* — a draft when composing a new voice, else
 * the selected take — so configuring a different voice never overwrites another take's scene.
 */
export function FilterPicker({ onApplied }: { onApplied?: () => void } = {}) {
  const activeScene = useAudioStore(selectActiveScene);
  const setEditingScene = useAudioStore((s) => s.setEditingScene);
  const setDraftVoice = useAudioStore((s) => s.setDraftVoice);
  const draft = useAudioStore((s) => s.draft);
  const selectedTakeId = useAudioStore((s) => s.selectedTakeId);
  const conversions = useAudioStore((s) => s.conversions);
  const recordedBlob = useAudioStore((s) => s.recordedBlob);
  const voiceSettings = useAudioStore((s) => s.voiceSettings);
  const setVoiceSettings = useAudioStore((s) => s.setVoiceSettings);
  const transformError = useAudioStore((s) => s.transformError);
  const crtEnabled = useAudioStore((s) => s.crtEnabled);
  const setCrtEnabled = useAudioStore((s) => s.setCrtEnabled);
  const soundEnabled = useAudioStore((s) => s.soundEnabled);
  const setSoundEnabled = useAudioStore((s) => s.setSoundEnabled);
  const dirty = useAudioStore((s) => s.dirty);
  const setDirty = useAudioStore((s) => s.setDirty);
  const accessCode = useAudioStore((s) => s.accessCode);
  const setAccessCode = useAudioStore((s) => s.setAccessCode);
  const userApiKey = useAudioStore((s) => s.userApiKey);
  const setUserApiKey = useAudioStore((s) => s.setUserApiKey);
  const trialRemaining = useAudioStore((s) => s.trialRemaining);

  const { data: voicesData, isError: voicesIsError } = useVoices();
  const voices = voicesData?.voices ?? [];
  const voicesError = voicesIsError ? "Couldn't load voices." : null;

  const transform = useTransform();
  const transforming = useIsTransforming();
  const accessMutation = useSubmitAccessCode();

  // The voice the dialog will (re)convert: the draft's when composing, else the selected take's.
  const currentVoiceId =
    draft?.voiceId ?? (selectedTakeId !== ORIGINAL_TAKE_ID ? selectedTakeId : "");
  const currentVoice = voices.find((v) => v.id === currentVoiceId);

  const sceneName = SCENES.find((s) => s.id === activeScene)?.name ?? activeScene;
  const voiceName = currentVoice?.name ?? currentVoiceId;
  const [activeHint, setActiveHint] = useState(SLIDERS[0].hint);
  // The user re-skinned the screensaver this session — lets Apply confirm it (no transform needed).
  const [sceneTouched, setSceneTouched] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  // Local dev is unlimited; otherwise the trial applies until a code or a personal key unlocks it.
  const isLocal = process.env.NODE_ENV === "development";
  const unlocked = isLocal || Boolean(accessCode) || Boolean(userApiKey);
  const freeLeft = trialRemaining ?? voicesData?.remaining ?? FREE_TRIAL_LIMIT;
  const trialBlocked = !unlocked && freeLeft <= 0;

  const [filters, setFilters] = useState<Record<string, string>>({
    gender: "",
    age: "",
    accent: "",
    descriptive: "",
  });

  const matchesFilters = (labels: Record<string, string>, active: Record<string, string>): boolean =>
    VOICE_FILTERS.every((f) => !active[f.key] || labels[f.key] === active[f.key]);
  const matchedVoices = voices.filter((v) => matchesFilters(v.labels, filters));
  const firstMatch = matchedVoices[0];
  // Cascading: only show values still achievable given the *other* selected filters.
  const optionsFor = (key: string, active: Record<string, string> = filters): string[] =>
    Array.from(
      new Set(
        voices
          .filter((v) => matchesFilters(v.labels, { ...active, [key]: "" }))
          .map((v) => v.labels[key])
          .filter(Boolean),
      ),
    ).sort();

  // Picking a voice (or a filter jumping to one) composes a draft, seeding its scene from what's on
  // screen. Changing the voice therefore only updates the target + its colors — never the
  // screensaver, which changes solely when you click one in the list.
  const applyVoice = (id: string): void => {
    const voice = voices.find((v) => v.id === id);
    setDraftVoice(id, voice?.name ?? id, voice ? voicePaletteForLabels(voice.labels) : null);
  };

  const onFilterChange = (key: string, value: string): void => {
    let next = { ...filters, [key]: value };
    // drop other selections that are no longer achievable under the new filter
    for (const f of VOICE_FILTERS) {
      if (f.key !== key && next[f.key] && !optionsFor(f.key, next).includes(next[f.key])) {
        next = { ...next, [f.key]: "" };
      }
    }
    setFilters(next);
    // keep the current voice if it still matches; otherwise jump to the first match
    if (!voices.some((v) => v.id === currentVoiceId && matchesFilters(v.labels, next))) {
      const first = voices.find((v) => matchesFilters(v.labels, next));
      if (first) applyVoice(first.id);
    }
  };

  // Just recorded and nothing converted yet → default to a voice so Apply is ready in one click.
  // Once any take exists, selecting "You" lets you edit its screensaver without being retargeted.
  useEffect(() => {
    if (
      recordedBlob &&
      !draft &&
      selectedTakeId === ORIGINAL_TAKE_ID &&
      conversions.length === 0 &&
      firstMatch
    ) {
      setDraftVoice(firstMatch.id, firstMatch.name, voicePaletteForLabels(firstMatch.labels));
    }
  }, [recordedBlob, draft, selectedTakeId, conversions.length, firstMatch, setDraftVoice]);

  const submitCode = (): void => {
    const code = codeDraft.trim();
    if (!code) return;
    accessMutation.mutate(code, {
      onSuccess: (ok) => {
        if (ok) {
          setCodeDraft("");
          setCodeError(null);
        } else {
          setCodeError("That code didn't work.");
        }
      },
      onError: () => setCodeError("That code didn't work."),
    });
  };

  // A transform is only warranted when there's a recording + a chosen voice + un-applied changes.
  const needsTransform =
    Boolean(recordedBlob) && Boolean(currentVoiceId) && dirty && !trialBlocked;
  // Apply is enabled either to run that transform, or just to confirm a screensaver change (which is
  // already applied live to the main window — no ElevenLabs request).
  const canApply = !transforming && (needsTransform || sceneTouched);

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* CRT monitor — a live preview of the selected screensaver (CLAUDE.md §11). */}
      <div className="flex justify-center">
        <div className="bevel-raised bg-w95-silver p-2">
          <div className="bevel-inset relative aspect-[4/3] w-40 overflow-hidden bg-[#0a0618]">
            <SceneView scene={activeScene} />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px)",
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 text-center text-[9px] font-bold tracking-[0.2em] text-white">
              {sceneName}
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
                    setEditingScene(scene.id); // applies to the main window live
                    setSceneTouched(true);
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

      <div className="flex flex-col gap-1.5">
        <p className="font-bold">Voice</p>
        <div className="grid grid-cols-2 gap-1.5">
          {VOICE_FILTERS.map((f) => (
            <label key={f.key} className="flex items-center gap-1">
              <span className="w-12 text-w95-darkgray">{f.label}</span>
              <select
                value={filters[f.key]}
                onChange={(event) => onFilterChange(f.key, event.target.value)}
                className="bevel-inset min-w-0 flex-1 bg-white px-1 py-0.5 capitalize"
              >
                <option value="">Any</option>
                {optionsFor(f.key).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="text-[10px] italic text-w95-darkgray">
          {matchedVoices.length === 0
            ? voicesError
              ? "Couldn't load voices."
              : "No voices match these filters."
            : `${matchedVoices.length} voice${matchedVoices.length === 1 ? "" : "s"} → ${
                voiceName || matchedVoices[0].name
              }`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-bold">Settings</p>
        {SLIDERS.map(({ key, label, hint }) => (
          <label
            key={key}
            title={hint}
            onMouseEnter={() => setActiveHint(hint)}
            className="flex items-center gap-2"
          >
            <span className="w-16">{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voiceSettings[key]}
              onFocus={() => setActiveHint(hint)}
              onChange={(event) => {
                setVoiceSettings({ ...voiceSettings, [key]: Number(event.target.value) });
                setDirty(true);
                setActiveHint(hint);
              }}
              className="flex-1"
            />
            <span className="w-8 text-right tabular-nums">{voiceSettings[key].toFixed(2)}</span>
          </label>
        ))}
        <p className="min-h-[2.4em] text-[10px] italic leading-tight text-w95-darkgray">
          {activeHint}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={crtEnabled}
            onChange={(event) => setCrtEnabled(event.target.checked)}
          />
          <span>CRT effect</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
          />
          <span>Sounds</span>
        </label>
      </div>

      {/* Local dev is unlimited; deployed visitors get a free trial, then a code or their own key. */}
      <div className="bevel-inset flex flex-col gap-1.5 bg-white p-2">
        {isLocal ? (
          <span className="font-bold">🔓 Running locally — unlimited transforms.</span>
        ) : accessCode ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">🔓 Access code accepted — unlimited transforms.</span>
            <button
              type="button"
              onClick={() => {
                setAccessCode(null);
                setDirty(true);
              }}
              className="bevel-raised active:bevel-pressed bg-w95-silver px-2 py-0.5"
            >
              Remove
            </button>
          </div>
        ) : userApiKey ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">🔑 Using your own ElevenLabs key.</span>
            <button
              type="button"
              onClick={() => {
                setUserApiKey(null);
                setDirty(true);
              }}
              className="bevel-raised active:bevel-pressed bg-w95-silver px-2 py-0.5"
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <span className={cn("font-bold", trialBlocked && "text-[#b00020]")}>
              {trialBlocked ? "Free trial used up" : `Free voices left: ${freeLeft} / ${FREE_TRIAL_LIMIT}`}
            </span>

            <label className="text-[10px] text-w95-darkgray">Got an access code?</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={codeDraft}
                onChange={(event) => {
                  setCodeDraft(event.target.value);
                  setCodeError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitCode();
                }}
                placeholder="Access code"
                aria-label="Access code"
                className="bevel-inset min-w-0 flex-1 bg-white px-1 py-0.5"
              />
              <Button onClick={submitCode} disabled={!codeDraft.trim()}>
                Unlock
              </Button>
            </div>
            {codeError && <p className="text-[10px] text-[#b00020]">{codeError}</p>}

            <label className="text-[10px] leading-tight text-w95-darkgray">
              Or use your own ElevenLabs key —{" "}
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-w95-navy underline"
              >
                get one free
              </a>{" "}
              (kept in your browser only).
            </label>
            <div className="flex gap-1">
              <input
                type="password"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                placeholder="Paste your xi-… key"
                aria-label="ElevenLabs API key"
                className="bevel-inset min-w-0 flex-1 bg-white px-1 py-0.5"
              />
              <Button
                onClick={() => {
                  const key = keyDraft.trim();
                  if (!key) return;
                  setUserApiKey(key);
                  setKeyDraft("");
                  setDirty(true);
                }}
                disabled={!keyDraft.trim()}
              >
                Save key
              </Button>
            </div>
          </>
        )}
      </div>

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
            sfx.apply();
            if (needsTransform) transform(); // otherwise it's just a screensaver change — already live
            onApplied?.();
          }}
          disabled={!canApply}
        >
          {transforming ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
