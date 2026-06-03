"use client";

import { useCallback } from "react";
import { useAudioStore } from "@/lib/store/audioStore";
import { sfx } from "@/lib/sfx";

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

      const res = await fetch("/api/transform", { method: "POST", body: form });
      const data = (await res.json()) as { resultHandle?: string; error?: string };
      if (!res.ok || !data.resultHandle) throw new Error(data.error ?? "Transform failed");

      const voiceName =
        state.voices.find((v) => v.id === state.targetVoiceId)?.name ?? state.targetVoiceId;
      state.addConversion({
        voiceId: state.targetVoiceId,
        voiceName,
        url: `/api/audio/${data.resultHandle}`,
      });
    } catch (err) {
      state.setTransformError(friendlyError(err instanceof Error ? err.message : "Transform failed"));
      sfx.error();
    } finally {
      state.setTransforming(false);
    }
  }, []);
}
