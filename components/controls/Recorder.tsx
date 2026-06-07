"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/retro/Button";
import { Dialog } from "@/components/retro/Dialog";
import { VuMeter } from "@/components/controls/VuMeter";
import { CompareGallery } from "@/components/controls/CompareGallery";
import { ClipTransport } from "@/components/controls/ClipTransport";
import { exportSceneVideo } from "@/lib/exportVideo";
import { ORIGINAL_TAKE_ID, useAudioStore } from "@/lib/store/audioStore";
import { useIsTransforming } from "@/components/controls/useTransform";
import { useAudioContext } from "@/components/controls/useAudioContext";
import { useRecording, type RecordingStatus } from "@/components/controls/useRecording";
import { useClipPlayback } from "@/components/controls/useClipPlayback";
import { useIsMobile } from "@/lib/useIsMobile";
import { sfx } from "@/lib/sfx";

const STATUS_LABEL: Record<RecordingStatus, string> = {
  idle: "Ready",
  requesting: "Requesting mic…",
  recording: "Recording…",
  recorded: "Recorded",
};

/**
 * Records the mic and offers an A/B/C compare gallery: flip between "You" (original) and one or
 * more converted voices — each drives the analyser, so the scene re-reacts to each (M5/M6).
 *
 * This component is the orchestrator: it wires the recording / playback hooks together and hands
 * presentation off to {@link CompareGallery} (take tabs) and {@link ClipTransport} (play/scrub).
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
  const [confirmingReset, setConfirmingReset] = useState(false);
  const isMobile = useIsMobile();

  const source = useAudioStore((s) => s.selectedTakeId); // "original" or a voiceId
  const selectTake = useAudioStore((s) => s.selectTake);
  const recordedBlob = useAudioStore((s) => s.recordedBlob);
  const conversions = useAudioStore((s) => s.conversions);
  const lastConverted = useAudioStore((s) => s.lastConverted);
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

  // When a take is (re)converted, select it (swapping in its scene + color) and queue playback. The
  // store's `lastConverted.nonce` changes on every conversion — including re-converting an existing
  // voice — so this fires reliably without inferring "latest" from the list.
  useEffect(() => {
    if (!lastConverted) return;
    requestPlay();
    selectTake(lastConverted.voiceId);
  }, [lastConverted, selectTake, requestPlay]);

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

  // Play the current clip from the top and record the live canvas + its audio into a webm.
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
      await exportSceneVideo(canvas, {
        audioStream: getAudioStream(),
        durationMs: clipMs ? Math.min(clipMs + 200, 20000) : 6000,
      });
    } finally {
      setExporting(false);
    }
  }, [getSceneCanvas, audioRef, currentUrl, exporting, ensureGraph, getAudioStream, duration, setExporting]);

  return (
    <>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          {status === "recording" ? (
            <Button onClick={stop}>■ Stop</Button>
          ) : recordedBlob ? (
            // Once a recording exists, "record again" would discard the clip *and* every converted
            // take — exactly what Start over does — so we surface a single, clearly-labelled Start
            // over (with confirm) instead of a Record button that silently wipes your work.
            <Button onClick={() => setConfirmingReset(true)}>↺ Start over</Button>
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

        {/* The intensity bar grows the controls and shoves the small mobile window's scene up over the
            title bar — and the scene already shows the mic is live — so it's desktop-only. */}
        {status === "recording" && !isMobile && <VuMeter />}
        {micError && <p className="text-[#b00020]">{micError}</p>}
        {transforming && <p className="text-w95-darkgray">Transforming…</p>}
        {transformError && <p className="text-[#b00020]">{transformError}</p>}

        {originalUrl && (
          <div className="flex flex-col gap-2">
            <CompareGallery
              source={source}
              conversions={conversions}
              onSelect={selectSource}
              onAddVoice={onAddVoice}
            />

            <ClipTransport
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onTogglePlay={togglePlay}
              onSeekDown={onSeekDown}
              onSeekMove={onSeekMove}
              onSeekUp={onSeekUp}
            />

            {getSceneCanvas && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-w95-darkgray">Save a shareable clip (video + sound):</span>
                <Button onClick={() => void handleExport()} disabled={exporting}>
                  {exporting ? "● Exporting…" : "🎬 Export"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Mounted for the component's lifetime so its Web Audio source node is created exactly once
            (re-creating it per take would leave the analyser tapping a detached element). */}
        <audio ref={audioRef} src={currentUrl ?? undefined} className="hidden" {...audioProps} />
      </div>

      <Dialog open={confirmingReset} title="Start over" onClose={() => setConfirmingReset(false)}>
        <div className="flex flex-col gap-3 text-xs">
          <p className="leading-snug">
            This discards your recording and all converted voices.
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
