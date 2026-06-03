"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/retro/Button";
import { VuMeter } from "@/components/controls/VuMeter";
import { sfx } from "@/lib/sfx";
import { createAudioAnalyser, type AudioAnalyser } from "@/lib/audio/analyser";
import { exportSceneVideo } from "@/lib/exportVideo";
import { exportSceneGif } from "@/lib/exportGif";
import { useAudioStore } from "@/lib/store/audioStore";
import { cn } from "@/lib/cn";

type Status = "idle" | "requesting" | "recording" | "recorded";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready",
  requesting: "Requesting mic…",
  recording: "Recording…",
  recorded: "Recorded",
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Short tab label from a long voice name, e.g. "Roger - Laid-Back, …" → "Roger". */
function shortVoiceName(name: string): string {
  return name.split(/\s*[-(]/)[0].trim() || name;
}

/**
 * Records the mic and offers an A/B/C compare gallery: flip between "You" (original) and one or
 * more converted voices — each drives the analyser, so the scene re-reacts to each (M5/M6).
 */
export function Recorder({
  onRecorded,
  onAddVoice,
  getSceneCanvas,
}: {
  onRecorded?: () => void;
  onAddVoice?: () => void;
  getSceneCanvas?: () => HTMLCanvasElement | null;
} = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [source, setSource] = useState<string>("original"); // "original" or a voiceId
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"webm" | "gif">("webm");

  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AudioAnalyser | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const elementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playbackAnalyserRef = useRef<AudioAnalyser | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const scrubbingRef = useRef(false);
  const primingRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const lastConversionRef = useRef<string | null>(null);

  const setParams = useAudioStore((s) => s.setParams);
  const setRecording = useAudioStore((s) => s.setRecording);
  const setRecordedBlob = useAudioStore((s) => s.setRecordedBlob);
  const recordedBlob = useAudioStore((s) => s.recordedBlob);
  const conversions = useAudioStore((s) => s.conversions);
  const transforming = useAudioStore((s) => s.transforming);
  const transformError = useAudioStore((s) => s.transformError);
  const setPlayingLabel = useAudioStore((s) => s.setPlayingLabel);
  const setActiveScene = useAudioStore((s) => s.setActiveScene);
  const setVoicePalette = useAudioStore((s) => s.setVoicePalette);
  const exporting = useAudioStore((s) => s.exporting);
  const setExporting = useAudioStore((s) => s.setExporting);

  const activeConversion = conversions.find((c) => c.voiceId === source) ?? null;
  const currentUrl = source === "original" ? originalUrl : (activeConversion?.url ?? originalUrl);
  const currentLabel = source === "original" ? "You" : (activeConversion?.voiceName ?? "Voice");

  // Each converted voice carries its own screensaver + color; "You" uses the live audio palette.
  const applyVisualsFor = useCallback(
    (next: string) => {
      if (next === "original") {
        setVoicePalette(null);
        return;
      }
      const conv = conversions.find((c) => c.voiceId === next);
      if (conv) {
        setActiveScene(conv.sceneId);
        setVoicePalette(conv.palette);
      }
    },
    [conversions, setActiveScene, setVoicePalette],
  );

  const ensureContext = useCallback((): AudioContext => {
    if (!contextRef.current || contextRef.current.state === "closed") {
      contextRef.current = new AudioContext();
    }
    return contextRef.current;
  }, []);

  useEffect(() => {
    if (!recordedBlob) {
      setOriginalUrl(null);
      return;
    }
    const url = URL.createObjectURL(recordedBlob);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedBlob]);

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

  // When a fresh conversion arrives, select it and queue playback.
  useEffect(() => {
    const latest = conversions[conversions.length - 1];
    if (latest && latest.url !== lastConversionRef.current) {
      lastConversionRef.current = latest.url;
      pendingPlayRef.current = true;
      setSource(latest.voiceId);
      applyVisualsFor(latest.voiceId);
    }
  }, [conversions, applyVisualsFor]);

  const maybePlay = useCallback(() => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    void audioElRef.current?.play().catch(() => undefined);
  }, []);

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
        setRecordedBlob(blob);
        setSource("original");
        lastConversionRef.current = null;
        micAnalyserRef.current?.stop();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setStatus("recorded");
        onRecorded?.();
      };
      recorder.start();
      setStatus("recording");
      setRecording(true);
      sfx.record();
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Microphone access failed");
      setStatus("idle");
    }
  }, [ensureContext, setParams, setRecording, setRecordedBlob, onRecorded]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
    sfx.stop();
  }, [setRecording]);

  // Build the playback graph once: element → destination (audible) + analyser + a stream tap so
  // export can mux the audio into the recorded clip.
  const ensureGraph = useCallback((): AudioContext | null => {
    const element = audioElRef.current;
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
    if (!playbackAnalyserRef.current) {
      playbackAnalyserRef.current = createAudioAnalyser(context, elementSourceRef.current, setParams);
    }
    return context;
  }, [ensureContext, setParams]);

  const handlePlay = useCallback(() => {
    const context = ensureGraph();
    if (!context || !playbackAnalyserRef.current) return;
    if (context.state === "suspended") void context.resume();
    playbackAnalyserRef.current.start();
    setIsPlaying(true);
    setPlayingLabel(currentLabel);
  }, [ensureGraph, setPlayingLabel, currentLabel]);

  // Play the current clip from the top and record the live canvas + its audio into a webm.
  const handleExport = useCallback(async () => {
    const canvas = getSceneCanvas?.();
    const element = audioElRef.current;
    if (!canvas || !element || !currentUrl || exporting) return;
    setExporting(true);
    try {
      const context = ensureGraph();
      if (context?.state === "suspended") await context.resume();
      element.currentTime = 0;
      await element.play().catch(() => undefined);
      const clipMs =
        Number.isFinite(element.duration) && element.duration > 0 ? element.duration * 1000 : 0;
      if (exportFormat === "gif") {
        // GIFs are silent + balloon fast, so cap shorter; audio still plays to drive the visuals.
        await exportSceneGif(canvas, { durationMs: clipMs ? Math.min(clipMs, 6000) : 5000 });
      } else {
        await exportSceneVideo(canvas, {
          audioStream: streamDestRef.current?.stream ?? null,
          durationMs: clipMs ? Math.min(clipMs + 200, 20000) : 6000,
        });
      }
    } finally {
      setExporting(false);
    }
  }, [getSceneCanvas, currentUrl, exporting, exportFormat, ensureGraph, setExporting]);

  const handleStop = useCallback(() => {
    playbackAnalyserRef.current?.stop();
    setIsPlaying(false);
    setPlayingLabel(null);
  }, [setPlayingLabel]);

  const selectSource = useCallback(
    (next: string) => {
      applyVisualsFor(next);
      if (next === source) {
        void audioElRef.current?.play().catch(() => undefined);
        return;
      }
      pendingPlayRef.current = true;
      setSource(next);
    },
    [source, applyVisualsFor],
  );

  const togglePlay = useCallback(() => {
    const element = audioElRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  }, []);

  const seekToClientX = useCallback((clientX: number, rect: DOMRect) => {
    const element = audioElRef.current;
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

      {(status === "recording" || isPlaying) && <VuMeter />}
      {micError && <p className="text-[#b00020]">{micError}</p>}
      {transforming && <p className="text-w95-darkgray">Transforming…</p>}
      {transformError && <p className="text-[#b00020]">{transformError}</p>}

      {originalUrl && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-w95-darkgray">Compare:</span>
            <button
              type="button"
              onClick={() => selectSource("original")}
              className={cn(
                "bg-w95-silver px-2 py-0.5",
                source === "original" ? "bevel-pressed" : "bevel-raised active:bevel-pressed",
              )}
            >
              You
            </button>
            {conversions.map((conversion) => (
              <button
                key={conversion.voiceId}
                type="button"
                title={conversion.voiceName}
                onClick={() => selectSource(conversion.voiceId)}
                className={cn(
                  "bg-w95-silver px-2 py-0.5",
                  source === conversion.voiceId
                    ? "bevel-pressed"
                    : "bevel-raised active:bevel-pressed",
                )}
              >
                {shortVoiceName(conversion.voiceName)}
              </button>
            ))}
            {onAddVoice && (
              <button
                type="button"
                onClick={onAddVoice}
                aria-label="Add a voice"
                title="Add another voice"
                className="bevel-raised active:bevel-pressed bg-w95-silver px-2 py-0.5 font-bold"
              >
                +
              </button>
            )}
          </div>

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
              aria-label="Seek"
              onPointerDown={onSeekDown}
              onPointerMove={onSeekMove}
              onPointerUp={onSeekUp}
              className="bevel-inset relative h-3 flex-1 cursor-pointer touch-none bg-white"
            >
              <div
                className="absolute inset-y-0 left-0 bg-w95-navy"
                style={{ width: `${progress * 100}%` }}
              />
            </button>
            <span className="w-20 shrink-0 text-right tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {getSceneCanvas && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-w95-darkgray">Save a shareable clip:</span>
              <div className="flex items-center gap-1">
                <select
                  aria-label="Export format"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as "webm" | "gif")}
                  disabled={exporting}
                  className="bevel-inset bg-white px-1 py-0.5"
                >
                  <option value="webm">Video + sound</option>
                  <option value="gif">GIF</option>
                </select>
                <Button onClick={() => void handleExport()} disabled={exporting}>
                  {exporting ? "● Exporting…" : "🎬 Export"}
                </Button>
              </div>
            </div>
          )}

          <audio
            ref={audioElRef}
            src={currentUrl ?? undefined}
            className="hidden"
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleDurationChange}
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
