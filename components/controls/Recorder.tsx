"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/retro/Button";
import { createAudioAnalyser, type AudioAnalyser } from "@/lib/audio/analyser";
import { useAudioStore } from "@/lib/store/audioStore";

type Status = "idle" | "requesting" | "recording" | "recorded";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready",
  requesting: "Requesting mic…",
  recording: "Recording…",
  recorded: "Recorded — open Display Properties to apply a voice",
};

/**
 * Records the mic (live analysis), stores the clip for the picker to transform, and plays the
 * converted clip back through the analyser so the scene reacts to the new voice (M5/M6).
 */
export function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [micError, setMicError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AudioAnalyser | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const convertedElRef = useRef<HTMLAudioElement | null>(null);
  const elementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playbackAnalyserRef = useRef<AudioAnalyser | null>(null);

  const setParams = useAudioStore((s) => s.setParams);
  const setRecording = useAudioStore((s) => s.setRecording);
  const setRecordedBlob = useAudioStore((s) => s.setRecordedBlob);
  const convertedUrl = useAudioStore((s) => s.convertedUrl);

  const ensureContext = useCallback((): AudioContext => {
    if (!contextRef.current || contextRef.current.state === "closed") {
      contextRef.current = new AudioContext();
    }
    return contextRef.current;
  }, []);

  useEffect(() => {
    return () => {
      micAnalyserRef.current?.dispose();
      playbackAnalyserRef.current?.dispose();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (contextRef.current && contextRef.current.state !== "closed") {
        void contextRef.current.close();
      }
    };
  }, []);

  // When a fresh conversion arrives, try to play it (best-effort — controls allow manual replay).
  useEffect(() => {
    if (convertedUrl) {
      requestAnimationFrame(() => void convertedElRef.current?.play().catch(() => undefined));
    }
  }, [convertedUrl]);

  const start = useCallback(async () => {
    setMicError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = ensureContext();
      if (context.state === "suspended") await context.resume();

      const source = context.createMediaStreamSource(stream);
      micAnalyserRef.current = createAudioAnalyser(context, source, setParams);
      micAnalyserRef.current.start();

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        micAnalyserRef.current?.stop();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setStatus("recorded");
      };
      recorder.start();
      setStatus("recording");
      setRecording(true);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Microphone access failed");
      setStatus("idle");
    }
  }, [ensureContext, setParams, setRecording, setRecordedBlob]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, [setRecording]);

  const handleConvertedPlay = useCallback(() => {
    const context = ensureContext();
    const element = convertedElRef.current;
    if (!element) return;
    if (!elementSourceRef.current) {
      elementSourceRef.current = context.createMediaElementSource(element);
      elementSourceRef.current.connect(context.destination);
    }
    if (!playbackAnalyserRef.current) {
      playbackAnalyserRef.current = createAudioAnalyser(context, elementSourceRef.current, setParams);
    }
    if (context.state === "suspended") void context.resume();
    playbackAnalyserRef.current.start();
  }, [ensureContext, setParams]);

  const handleConvertedStop = useCallback(() => {
    playbackAnalyserRef.current?.stop();
  }, []);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        {status === "recording" ? (
          <Button onClick={stop}>■ Stop</Button>
        ) : (
          <Button onClick={() => void start()} disabled={status === "requesting"}>
            ● Record
          </Button>
        )}
        <span className="text-w95-darkgray">{STATUS_LABEL[status]}</span>
      </div>

      {micError && <p className="text-[#b00020]">{micError}</p>}

      {convertedUrl && (
        <audio
          ref={convertedElRef}
          src={convertedUrl}
          controls
          className="w-full"
          onPlay={handleConvertedPlay}
          onEnded={handleConvertedStop}
          onPause={handleConvertedStop}
        />
      )}
    </div>
  );
}
