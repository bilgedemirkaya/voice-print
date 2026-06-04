"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * A lazily-created AudioContext shared by recording + playback. Returns a stable `ensureContext`
 * (browsers require a user gesture before audio can start) and closes the context on unmount.
 */
export function useAudioContext(): () => AudioContext {
  const ref = useRef<AudioContext | null>(null);

  const ensureContext = useCallback((): AudioContext => {
    if (!ref.current || ref.current.state === "closed") {
      ref.current = new AudioContext();
    }
    return ref.current;
  }, []);

  useEffect(() => {
    return () => {
      if (ref.current && ref.current.state !== "closed") void ref.current.close();
    };
  }, []);

  return ensureContext;
}
