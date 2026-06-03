"use client";

import { useCallback } from "react";
import { useAudioStore } from "@/lib/store/audioStore";
import { sfx } from "@/lib/sfx";
import { voicePaletteForLabels } from "@/lib/voicePalette";
import { ACCESS_CODE_HEADER, BYOK_HEADER } from "@/lib/trialConfig";

/** Turn ElevenLabs' raw error JSON into a short, friendly message. */
function friendlyError(message: string): string {
  try {
    const match = message.match(/\{.*\}/s);
    if (match) {
      const parsed = JSON.parse(match[0]) as { detail?: { code?: string; message?: string } };
      const detail = parsed.detail;
      if (detail?.code === "quota_exceeded") {
        return "Out of ElevenLabs credits for this key — raise its limit in the dashboard or record a shorter clip.";
      }
      if (detail?.message) return detail.message;
    }
  } catch {
    // fall through to the raw message
  }
  return message;
}

/**
 * Shared transform action: POST the recorded clip + chosen voice/settings to /api/transform,
 * then point the store at the converted clip so the Recorder plays it through the analyser.
 */
export function useTransform() {
  return useCallback(async () => {
    const state = useAudioStore.getState();
    const blob = state.recordedBlob;
    if (!blob || !state.targetVoiceId || state.transforming) return;

    state.setTransforming(true);
    state.setTransformError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("targetVoiceId", state.targetVoiceId);
      form.append("settings", JSON.stringify(state.voiceSettings));

      const headers: Record<string, string> = {};
      if (state.accessCode) headers[ACCESS_CODE_HEADER] = state.accessCode;
      if (state.userApiKey) headers[BYOK_HEADER] = state.userApiKey;
      const res = await fetch("/api/transform", {
        method: "POST",
        body: form,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      const data = (await res.json()) as {
        resultHandle?: string;
        error?: string;
        remaining?: number | null;
      };
      // Reflect the server's authoritative free-transform count (null = own key / unknown).
      if (data.remaining !== undefined) state.setTrialRemaining(data.remaining);
      if (!res.ok || !data.resultHandle) throw new Error(data.error ?? "Transform failed");

      const voice = state.voices.find((v) => v.id === state.targetVoiceId);
      state.addConversion({
        voiceId: state.targetVoiceId,
        voiceName: voice?.name ?? state.targetVoiceId,
        url: `/api/audio/${data.resultHandle}`,
        sceneId: state.activeScene,
        palette: voice ? voicePaletteForLabels(voice.labels) : state.params.palette,
      });
    } catch (err) {
      state.setTransformError(friendlyError(err instanceof Error ? err.message : "Transform failed"));
      sfx.error();
    } finally {
      state.setTransforming(false);
    }
  }, []);
}
