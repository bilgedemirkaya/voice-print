"use client";

import { useCallback, useRef, useState } from "react";
import { createAudioAnalyser, type AudioAnalyser } from "@/lib/audio/analyser";
import { useAudioStore } from "@/lib/store/audioStore";

/**
 * Playback of the selected clip through the analyser, so the scene re-reacts to whichever take is
 * playing. Owns the audio graph (element → speakers + analyser + a stream tap for export), the
 * transport (play/pause/seek), and the MediaRecorder `duration: Infinity` discovery dance.
 *
 * The audio element is rendered by the caller; spread `audioProps` onto it and attach `audioRef`.
 */
export function useClipPlayback({
  ensureContext,
  label,
}: {
  ensureContext: () => AudioContext;
  /** Label of the clip currently selected (e.g. "You" / a voice name), shown while playing. */
  label: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AudioAnalyser | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const scrubbingRef = useRef(false);
  const primingRef = useRef(false);
  const pendingPlayRef = useRef(false);

  const setParams = useAudioStore((s) => s.setParams);
  const setPlayingLabel = useAudioStore((s) => s.setPlayingLabel);

  // Build the playback graph once: element → destination (audible) + analyser + a stream tap so
  // export can mux the audio into the recorded clip.
  const ensureGraph = useCallback((): AudioContext | null => {
    const element = audioRef.current;
    if (!element) return null;
    const context = ensureContext();
    if (!elementSourceRef.current) {
      elementSourceRef.current = context.createMediaElementSource(element);
      elementSourceRef.current.connect(context.destination);
    }
    if (!streamDestRef.current) {
      streamDestRef.current = context.createMediaStreamDestination();
      elementSourceRef.current.connect(streamDestRef.current);
    }
    if (!analyserRef.current) {
      analyserRef.current = createAudioAnalyser(context, elementSourceRef.current, setParams);
    }
    return context;
  }, [ensureContext, setParams]);

  /** The export stream tap (clip audio), for muxing into a recorded video. */
  const getAudioStream = useCallback((): MediaStream | null => streamDestRef.current?.stream ?? null, []);

  const maybePlay = useCallback(() => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    void audioRef.current?.play().catch(() => undefined);
  }, []);

  /** Queue autoplay for the next time a clip's metadata loads (after the src changes). */
  const requestPlay = useCallback(() => {
    pendingPlayRef.current = true;
  }, []);

  const playNow = useCallback(() => {
    void audioRef.current?.play().catch(() => undefined);
  }, []);

  const togglePlay = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  }, []);

  const seekToClientX = useCallback((clientX: number, rect: DOMRect) => {
    const element = audioRef.current;
    if (!element || !Number.isFinite(element.duration)) return;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    element.currentTime = fraction * element.duration;
    setCurrentTime(element.currentTime);
  }, []);

  const onSeekDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      scrubbingRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      seekToClientX(event.clientX, event.currentTarget.getBoundingClientRect());
    },
    [seekToClientX],
  );
  const onSeekMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (scrubbingRef.current) {
        seekToClientX(event.clientX, event.currentTarget.getBoundingClientRect());
      }
    },
    [seekToClientX],
  );
  const onSeekUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    scrubbingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const handlePlay = useCallback(() => {
    const context = ensureGraph();
    if (!context || !analyserRef.current) return;
    if (context.state === "suspended") void context.resume();
    analyserRef.current.start();
    setIsPlaying(true);
    setPlayingLabel(label);
  }, [ensureGraph, setPlayingLabel, label]);

  const handleStop = useCallback(() => {
    analyserRef.current?.stop();
    setIsPlaying(false);
    setPlayingLabel(null);
  }, [setPlayingLabel]);

  /** Hard-stop playback (e.g. on reset): pause the element and tear down the running analyser. */
  const stopPlayback = useCallback(() => {
    pendingPlayRef.current = false;
    audioRef.current?.pause();
    handleStop();
  }, [handleStop]);

  // MediaRecorder webm reports duration: Infinity until forced — discover it, then reset.
  const handleLoadedMetadata = useCallback(
    (event: React.SyntheticEvent<HTMLAudioElement>) => {
      const element = event.currentTarget;
      if (Number.isFinite(element.duration)) {
        setDuration(element.duration);
        maybePlay();
      } else {
        primingRef.current = true;
        element.currentTime = 1e7;
      }
    },
    [maybePlay],
  );
  const handleDurationChange = useCallback(
    (event: React.SyntheticEvent<HTMLAudioElement>) => {
      const element = event.currentTarget;
      if (!Number.isFinite(element.duration)) return;
      setDuration(element.duration);
      if (primingRef.current) {
        primingRef.current = false;
        element.currentTime = 0;
        setCurrentTime(0);
        maybePlay();
      }
    },
    [maybePlay],
  );

  const audioProps = {
    onLoadedMetadata: handleLoadedMetadata,
    onDurationChange: handleDurationChange,
    onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) => setCurrentTime(e.currentTarget.currentTime),
    onPlay: handlePlay,
    onPause: handleStop,
    onEnded: handleStop,
  };

  return {
    audioRef,
    audioProps,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    playNow,
    requestPlay,
    stopPlayback,
    onSeekDown,
    onSeekMove,
    onSeekUp,
    ensureGraph,
    getAudioStream,
  };
}
