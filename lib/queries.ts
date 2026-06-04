"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useAudioStore } from "@/lib/store/audioStore";
import type { Voice } from "@/lib/types";

/** Shape of `GET /api/voices`: the picker list + the visitor's remaining free transforms. */
export type VoicesResponse = { voices: Voice[]; remaining: number | null };

/**
 * Server cache for the voice list. Replaces the hand-rolled fetch/cache that used to live in
 * the store: TanStack Query gives us dedupe, caching, and status (loading/error) for free.
 */
export function useVoices() {
  return useQuery<VoicesResponse>({
    queryKey: ["voices"],
    queryFn: async () => {
      const res = await fetch("/api/voices");
      const data = (await res.json().catch(() => ({}))) as Partial<VoicesResponse> & {
        error?: string;
      };
      if (!res.ok || !data.voices) throw new Error(data.error ?? "Failed to load voices");
      return { voices: data.voices, remaining: data.remaining ?? null };
    },
  });
}

/** Validate a shared access code; on success, persist it in the store (+ sessionStorage). */
export function useSubmitAccessCode() {
  const setAccessCode = useAudioStore((s) => s.setAccessCode);
  const setDirty = useAudioStore((s) => s.setDirty);
  return useMutation({
    mutationFn: async (code: string): Promise<boolean> => {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
      return Boolean(data.ok);
    },
    onSuccess: (ok, code) => {
      if (ok) {
        setAccessCode(code);
        setDirty(true);
      }
    },
  });
}
