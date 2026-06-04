"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/retro/Button";
import { Dialog } from "@/components/retro/Dialog";
import { VuMeter } from "@/components/controls/VuMeter";
import { exportSceneVideo } from "@/lib/exportVideo";
import { exportSceneGif } from "@/lib/exportGif";
import { ORIGINAL_TAKE_ID, useAudioStore } from "@/lib/store/audioStore";
import { useIsTransforming } from "@/components/controls/useTransform";
import { useAudioContext } from "@/components/controls/useAudioContext";
import { useRecording, type RecordingStatus } from "@/components/controls/useRecording";
import { useClipPlayback } from "@/components/controls/useClipPlayback";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/cn";

const STATUS_LABEL: Record<RecordingStatus, string> = {
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
 * Recording + playback live in the useRecording / useClipPlayback hooks; this wires them together.
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
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"webm" | "gif">("webm");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const lastConversionRef = useRef<string | null>(null);

  const source = useAudioStore((s) => s.selectedTakeId); // "original" or a voiceId
  const selectTake = useAudioStore((s) => s.selectTake);
  const recordedBlob = useAudioStore((s) => s.recordedBlob);
  const conversions = useAudioStore((s) => s.conversions);
  const transformError = useAudioStore((s) => s.transformError);
  const exporting = useAudioStore((s) => s.exporting);
  const setExporting = useAudioStore((s) => s.setExporting);
  const reset = useAudioStore((s) => s.reset);
  const transforming = useIsTransforming();

  const activeConversion = conversions.find((c) => c.voiceId === source) ?? null;
  const currentUrl = source === ORIGINAL_TAKE_ID ? originalUrl : (activeConversion?.url ?? originalUrl);
  const currentLabel = source === ORIGINAL_TAKE_ID ? "You" : (activeConversion?.voiceName ?? "Voice");

  const ensureContext = useAudioContext();
  const { status, micError, recordSecondsLeft, start, stop, reset: resetRecording } = useRecording({
    ensureContext,
    onRecorded,
  });
  const {
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
  } = useClipPlayback({ ensureContext, label: currentLabel });

  // "Start over": stop playback, clear the recorder UI, and wipe the session (recording + voices).
  const handleReset = useCallback(() => {
    stopPlayback();
    resetRecording();
    reset();
    setConfirmingReset(false);
    sfx.stop();
  }, [stopPlayback, resetRecording, reset]);

  // Keep an object URL alive for the original recording while it's the selected source.
  useEffect(() => {
    if (!recordedBlob) {
      setOriginalUrl(null);
      return;
    }
    const url = URL.createObjectURL(recordedBlob);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedBlob]);

  // When a fresh conversion arrives, select it (swapping in its scene + color) and queue playback.
  useEffect(() => {
    const latest = conversions[conversions.length - 1];
    if (latest && latest.url !== lastConversionRef.current) {
      lastConversionRef.current = latest.url;
      requestPlay();
      selectTake(latest.voiceId);
    }
  }, [conversions, selectTake, requestPlay]);

  const selectSource = useCallback(
    (next: string) => {
      if (next === source) {
        playNow(); // re-selecting the current take: just replay it
      } else {
        requestPlay(); // play once the new src's metadata loads
        selectTake(next); // swaps in the take's scene + color, exits any in-progress draft
      }
    },
    [source, selectTake, requestPlay, playNow],
  );

  // Play the current clip from the top and record the live canvas + its audio into a clip.
  const handleExport = useCallback(async () => {
    const canvas = getSceneCanvas?.();
    const element = audioRef.current;
    if (!canvas || !element || !currentUrl || exporting) return;
    setExporting(true);
    try {
      const context = ensureGraph();
      if (context?.state === "suspended") await context.resume();
      element.currentTime = 0;
      await element.play().catch(() => undefined);
      const clipMs = duration > 0 ? duration * 1000 : 0;
      if (exportFormat === "gif") {
        // GIFs are silent + balloon fast, so cap shorter; audio still plays to drive the visuals.
        await exportSceneGif(canvas, { durationMs: clipMs ? Math.min(clipMs, 6000) : 5000 });
      } else {
        await exportSceneVideo(canvas, {
          audioStream: getAudioStream(),
          durationMs: clipMs ? Math.min(clipMs + 200, 20000) : 6000,
        });
      }
    } finally {
      setExporting(false);
    }
  }, [
    getSceneCanvas,
    audioRef,
    currentUrl,
    exporting,
    exportFormat,
    ensureGraph,
    getAudioStream,
    duration,
    setExporting,
  ]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <>
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
        <span className="text-w95-darkgray">
          {status === "recording" ? `Recording… ${recordSecondsLeft}s left` : STATUS_LABEL[status]}
        </span>
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
              onClick={() => selectSource(ORIGINAL_TAKE_ID)}
              className={cn(
                "bg-w95-silver px-2 py-0.5",
                source === ORIGINAL_TAKE_ID ? "bevel-pressed" : "bevel-raised active:bevel-pressed",
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
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              title="Discard the recording and all voices"
              className="bevel-raised active:bevel-pressed ml-auto bg-w95-silver px-2 py-0.5"
            >
              ↺ Start over
            </button>
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

          <audio ref={audioRef} src={currentUrl ?? undefined} className="hidden" {...audioProps} />
        </div>
      )}
    </div>

      <Dialog open={confirmingReset} title="Start over" onClose={() => setConfirmingReset(false)}>
        <div className="flex flex-col gap-3 text-xs">
          <p className="leading-snug">
            This discards your recording and all converted voices. You&apos;ll start from a blank
            slate.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmingReset(false)}>Cancel</Button>
            <Button onClick={handleReset}>Start over</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
