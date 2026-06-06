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
      const store = useAudioStore.getState();
      const blob = store.recordedBlob;
      // The take to (re)convert: the draft's voice when composing, else the selected voice take.
      const targetVoiceId =
        store.draft?.voiceId ??
        (store.selectedTakeId !== ORIGINAL_TAKE_ID ? store.selectedTakeId : "");
      if (!blob || !targetVoiceId) return;

      // Snapshot the take's identity *as it is when Apply is pressed*. The converted audio belongs to
      // this voice, with the scene + color shown in the dialog right now — so we bind them here and
      // not after the network round-trip. Reading them post-`await` would let a take the user clicks
      // mid-conversion silently retarget where this clip lands.
      const target = {
        voiceId: targetVoiceId,
        voiceName:
          store.draft?.voiceName ??
          store.conversions.find((c) => c.voiceId === targetVoiceId)?.voiceName ??
          targetVoiceId,
        sceneId: selectActiveScene(store),
        palette: store.voicePalette ?? store.params.palette,
      };
      const { voiceSettings, accessCode, userApiKey } = store;

      store.setTransformError(null);
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        form.append("targetVoiceId", target.voiceId);
        form.append("settings", JSON.stringify(voiceSettings));

        const headers: Record<string, string> = {};
        if (accessCode) headers[ACCESS_CODE_HEADER] = accessCode;
        if (userApiKey) headers[BYOK_HEADER] = userApiKey;

        const res = await fetch("/api/transform", {
          method: "POST",
          body: form,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });

        // Re-read the store for the post-`await` *writes* (its actions are stable, but this keeps the
        // mutation honest about reading current state); the take's identity stays the pre-flight snapshot.
        const live = useAudioStore.getState();

        if (!res.ok) {
          // Errors come back as JSON (e.g. quota / trial-exhausted), which may carry a fresh count.
          const data = (await res.json().catch(() => ({}))) as TransformError;
          if (data.remaining !== undefined) live.setTrialRemaining(data.remaining);
          throw new Error(data.error ?? "Transform failed");
        }

        // Success is the converted audio itself (no server-side storage); play it via an object URL.
        const remaining = parseRemaining(res.headers.get("X-Trial-Remaining"));
        if (remaining !== undefined) live.setTrialRemaining(remaining);
        const url = URL.createObjectURL(await res.blob());

        live.addConversion({ ...target, url });
        live.setDirty(false);
      } catch (err) {
        useAudioStore
          .getState()
          .setTransformError(friendlyError(err instanceof Error ? err.message : "Transform failed"));
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
