"use client";

import { useCallback } from "react";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { ORIGINAL_TAKE_ID, selectActiveScene, useAudioStore } from "@/lib/store/audioStore";
import { sfx } from "@/lib/sfx";
import { ACCESS_CODE_HEADER, BYOK_HEADER } from "@/lib/trialConfig";

const TRANSFORM_KEY = ["transform"] as const;

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

type TransformError = { error?: string; remaining?: number | null };

/** Header value → trial count: "" means unlimited (null), a number is the remaining free tries. */
function parseRemaining(header: string | null): number | null | undefined {
  if (header === null) return undefined;
  return header === "" ? null : Number(header);
}

/**
 * Apply action: POST the recorded clip + chosen voice/settings to /api/transform, then store the
 * converted take (with the scene/color chosen in the dialog). The Recorder selects + plays it.
 *
 * The *request* is a TanStack Query mutation (shared status via {@link useIsTransforming}); the
 * *result* — a converted take — is session state, so it lands in the Zustand store. All store
 * writes happen inside the mutation fn so they still run if the dialog (this hook) unmounts.
 */
export function useTransform() {
  const mutation = useMutation({
    mutationKey: TRANSFORM_KEY,
    mutationFn: async (): Promise<void> => {
      const s = useAudioStore.getState();
      const blob = s.recordedBlob;
      // The take to (re)convert: the draft's voice when composing, else the selected voice take.
      const targetVoiceId =
        s.draft?.voiceId ?? (s.selectedTakeId !== ORIGINAL_TAKE_ID ? s.selectedTakeId : "");
      if (!blob || !targetVoiceId) return;

      s.setTransformError(null);
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        form.append("targetVoiceId", targetVoiceId);
        form.append("settings", JSON.stringify(s.voiceSettings));

        const headers: Record<string, string> = {};
        if (s.accessCode) headers[ACCESS_CODE_HEADER] = s.accessCode;
        if (s.userApiKey) headers[BYOK_HEADER] = s.userApiKey;

        const res = await fetch("/api/transform", {
          method: "POST",
          body: form,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });

        if (!res.ok) {
          // Errors come back as JSON (e.g. quota / trial-exhausted), which may carry a fresh count.
          const data = (await res.json().catch(() => ({}))) as TransformError;
          if (data.remaining !== undefined) s.setTrialRemaining(data.remaining);
          throw new Error(data.error ?? "Transform failed");
        }

        // Success is the converted audio itself (no server-side storage); play it via an object URL.
        const remaining = parseRemaining(res.headers.get("X-Trial-Remaining"));
        if (remaining !== undefined) s.setTrialRemaining(remaining);
        const url = URL.createObjectURL(await res.blob());

        const voiceName =
          s.draft?.voiceName ??
          s.conversions.find((c) => c.voiceId === targetVoiceId)?.voiceName ??
          targetVoiceId;
        s.addConversion({
          voiceId: targetVoiceId,
          voiceName,
          url,
          sceneId: selectActiveScene(s),
          palette: s.voicePalette ?? s.params.palette,
        });
        s.setDirty(false);
      } catch (err) {
        s.setTransformError(friendlyError(err instanceof Error ? err.message : "Transform failed"));
        sfx.error();
      }
    },
  });

  return useCallback(() => mutation.mutate(), [mutation]);
}

/** Whether a transform is in flight — shared across components via the mutation key. */
export function useIsTransforming(): boolean {
  return useIsMutating({ mutationKey: TRANSFORM_KEY }) > 0;
}
