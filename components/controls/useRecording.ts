"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { createAudioAnalyser, type AudioAnalyser } from "@/lib/audio/analyser";
import { useAudioStore } from "@/lib/store/audioStore";

export type RecordingStatus = "idle" | "requesting" | "recording" | "recorded";

// Cap recordings: keeps ElevenLabs credit cost predictable and avoids transform timeouts.
const MAX_RECORD_MS = 15_000;

/**
 * Mic capture: requests the mic, drives the analyser live while recording (so the scene reacts to
 * your voice), enforces the length cap with a countdown, and stores the recorded blob on stop.
 */
export function useRecording({
  ensureContext,
  onRecorded,
}: {
  ensureContext: () => AudioContext;
  onRecorded?: () => void;
}) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AudioAnalyser | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);

  const setParams = useAudioStore((s) => s.setParams);
  const setRecordedBlob = useAudioStore((s) => s.setRecordedBlob);

  const start = useCallback(async () => {
    setMicError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = ensureContext();
      if (context.state === "suspended") await context.resume();

      const micSource = context.createMediaStreamSource(stream);
      micAnalyserRef.current = createAudioAnalyser(context, micSource, setParams);
      micAnalyserRef.current.start();

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob); // resets takes/selection to the "You" original
        micAnalyserRef.current?.stop();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setStatus("recorded");
        onRecorded?.();
      };
      recorder.start();
      setStatus("recording");
      recordStartRef.current = Date.now();
      setRecordSecondsLeft(Math.ceil(MAX_RECORD_MS / 1000));
      sfx.record();
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Microphone access failed");
      setStatus("idle");
    }
  }, [ensureContext, setParams, setRecordedBlob, onRecorded]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    sfx.stop();
  }, []);

  // Tick the countdown while recording and auto-stop at the cap.
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => {
      const left = MAX_RECORD_MS - (Date.now() - recordStartRef.current);
      if (left <= 0) stop();
      else setRecordSecondsLeft(Math.ceil(left / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [status, stop]);

  useEffect(() => {
    return () => {
      micAnalyserRef.current?.dispose();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { status, micError, recordSecondsLeft, start, stop };
}
