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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Records the mic (live analysis), stores the clip for the picker, and plays the converted clip
 * back through the analyser. The converted clip uses a hand-built retro player (no native chrome).
 */
export function Recorder({ onRecorded }: { onRecorded?: () => void } = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
  const transforming = useAudioStore((s) => s.transforming);
  const transformError = useAudioStore((s) => s.transformError);

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
        onRecorded?.();
      };
      recorder.start();
      setStatus("recording");
      setRecording(true);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Microphone access failed");
      setStatus("idle");
    }
  }, [ensureContext, setParams, setRecording, setRecordedBlob, onRecorded]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, [setRecording]);

  const handlePlay = useCallback(() => {
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
    setIsPlaying(true);
  }, [ensureContext, setParams]);

  const handleStop = useCallback(() => {
    playbackAnalyserRef.current?.stop();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const element = convertedElRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  }, []);

  const seek = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const element = convertedElRef.current;
    if (!element || !Number.isFinite(element.duration)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    element.currentTime = fraction * element.duration;
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

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
        {status === "recording" && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full bg-[#e53935] motion-safe:animate-pulse"
          />
        )}
        <span className="text-w95-darkgray">{STATUS_LABEL[status]}</span>
      </div>

      {micError && <p className="text-[#b00020]">{micError}</p>}
      {transforming && <p className="text-w95-darkgray">Transforming…</p>}
      {transformError && <p className="text-[#b00020]">{transformError}</p>}

      {convertedUrl && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="bevel-raised active:bevel-pressed flex h-6 w-8 items-center justify-center bg-w95-silver text-black focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:-outline-offset-2"
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            onClick={seek}
            aria-label="Seek"
            className="bevel-inset relative h-3 flex-1 cursor-pointer bg-white"
          >
            <div
              className="absolute inset-y-0 left-0 bg-w95-navy"
              style={{ width: `${progress * 100}%` }}
            />
          </button>
          <span className="w-20 shrink-0 text-right tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <audio
            ref={convertedElRef}
            src={convertedUrl}
            className="hidden"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={handlePlay}
            onPause={handleStop}
            onEnded={handleStop}
          />
        </div>
      )}
    </div>
  );
}
